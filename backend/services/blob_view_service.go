package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	blobViewLivePreviewLineLimit        = 200
	blobViewSearchBatchSize             = 100
	blobViewSearchScanLineLimit         = 2_000
	blobViewSearchReadBlockLines        = 512
	blobViewSessionTTL                  = 10 * time.Minute
	blobViewMaxBlobBytes                = 256 * 1024 * 1024
	blobViewMaxConcurrentSessions       = 3
	blobViewMaxAggregateTempBytes int64 = 512 * 1024 * 1024
	blobViewMaxLineWindowSize     int64 = 1_000
)

type blobViewBlobClient interface {
	DownloadRange(ctx context.Context, containerName, blobName string, offset, count int64) ([]byte, error)
}

type BlobViewService struct {
	auth                      *AzureAuthService
	saveFileDialog            func(context.Context, wruntime.SaveDialogOptions) (string, error)
	openTempFile              func() (*os.File, error)
	now                       func() time.Time
	createBlobClient          func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error)
	createVersionedBlobClient func(context.Context, string, string, string, string) (blobViewBlobClient, int64, string, error)

	mu                  sync.RWMutex
	sessions            map[string]*blobViewSession
	stopCh              chan struct{}
	pendingSessionCount int
	reservedTempBytes   int64
}

type blobViewSession struct {
	mu sync.RWMutex

	id            string
	accountName   string
	containerName string
	blobName      string
	versionID     string
	mode          models.BlobViewMode
	focus         models.BlobViewFocus
	filePath      string
	file          *os.File
	blobSize      int64
	contentType   string
	reservedBytes int64
	failureReason string
	downloadCtx   context.Context
	cancel        context.CancelFunc

	bytesDownloaded  int64
	indexedBytes     int64
	lineStarts       []int64
	isComplete       bool
	errorMessage     string
	livePreviewLines []string
	livePreviewStart int64
	downloadRunning  bool

	lastAccess time.Time
	closed     bool
}

func NewBlobViewService(auth *AzureAuthService) *BlobViewService {
	service := &BlobViewService{
		auth:           auth,
		saveFileDialog: wruntime.SaveFileDialog,
		openTempFile: func() (*os.File, error) {
			return os.CreateTemp("", "azure-blob-logviewer-blob-view-*.tmp")
		},
		now:              time.Now,
		createBlobClient: nil,
		sessions:         make(map[string]*blobViewSession),
		stopCh:           make(chan struct{}),
	}
	service.createBlobClient = service.newBlobClient
	service.createVersionedBlobClient = service.newVersionedBlobClient

	go service.cleanupLoop()

	return service
}

func (s *BlobViewService) Shutdown() {
	close(s.stopCh)
	s.CloseAllSessions()
}

func (s *BlobViewService) CloseAllSessions() {
	s.mu.Lock()
	sessions := make([]*blobViewSession, 0, len(s.sessions))
	for _, session := range s.sessions {
		sessions = append(sessions, session)
	}
	s.sessions = make(map[string]*blobViewSession)
	s.mu.Unlock()

	for _, session := range sessions {
		s.closeSession(session)
	}
}

func (s *BlobViewService) OpenSession(ctx context.Context, request models.OpenBlobViewSessionRequest) (*models.BlobViewSessionStatus, error) {
	mode := request.Mode
	if mode != models.BlobViewModeLive || request.VersionID != "" {
		mode = models.BlobViewModeSnapshot
	}

	focus := models.BlobViewFocusStart
	if mode == models.BlobViewModeLive {
		focus = models.BlobViewFocusEnd
	}

	blobClient, blobSize, contentType, err := s.createRequestedBlobClient(ctx, request)
	if err != nil {
		logDetailedError("open blob view session metadata failed", err)
		return buildBlobViewFailureStatus(request.BlobName, mode, focus, blobFailureReasonFromError(err)), nil
	}

	if blobSize > blobViewMaxBlobBytes {
		return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonTooLarge), nil
	}

	if err := s.reserveSessionCapacity(blobSize); err != nil {
		return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonLimitExceeded), nil
	}

	tempFile, err := s.openTempFile()
	if err != nil {
		s.releasePendingSessionCapacity(blobSize)
		logDetailedError("create temp file for blob view failed", err)
		return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonDownloadFailed), nil
	}

	if err := tempFile.Truncate(blobSize); err != nil {
		s.releasePendingSessionCapacity(blobSize)
		_ = tempFile.Close()
		_ = os.Remove(tempFile.Name())
		logDetailedError("prepare temp file for blob view failed", err)
		return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonLimitExceeded), nil
	}

	downloadCtx, cancel := context.WithCancel(context.Background())

	session := &blobViewSession{
		id:               fmt.Sprintf("blob-view-%d", s.now().UnixNano()),
		accountName:      request.AccountName,
		containerName:    request.ContainerName,
		blobName:         request.BlobName,
		versionID:        request.VersionID,
		mode:             mode,
		focus:            focus,
		file:             tempFile,
		blobSize:         blobSize,
		contentType:      contentType,
		downloadCtx:      downloadCtx,
		cancel:           cancel,
		lineStarts:       makeInitialLineStarts(blobSize),
		lastAccess:       s.now(),
		livePreviewLines: nil,
		livePreviewStart: blobSize,
	}
	session.filePath = tempFile.Name()
	session.reservedBytes = blobSize

	if blobSize == 0 {
		session.indexedBytes = 0
		session.bytesDownloaded = 0
		session.isComplete = true
	} else if mode == models.BlobViewModeLive {
		if err := s.refreshLiveSession(session); err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			_ = tempFile.Close()
			_ = os.Remove(session.filePath)
			logDetailedError("download blob live session failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, blobFailureReasonFromError(err)), nil
		}
	} else if focus == models.BlobViewFocusEnd && blobSize > largeBlobThresholdBytes {
		liveStart := maxInt64(blobSize-defaultBlobChunkSizeBytes, 0)
		liveData, err := blobClient.DownloadRange(
			downloadCtx,
			request.ContainerName,
			request.BlobName,
			liveStart,
			blobSize-liveStart,
		)
		if err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			_ = tempFile.Close()
			_ = os.Remove(session.filePath)
			logDetailedError("download blob live preview failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, blobFailureReasonFromError(err)), nil
		}
		if err := writeBlobRange(session.file, liveStart, liveData); err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			_ = tempFile.Close()
			_ = os.Remove(session.filePath)
			logDetailedError("write blob live preview failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonDownloadFailed), nil
		}

		session.bytesDownloaded = int64(len(liveData))
		session.indexedBytes = session.bytesDownloaded
		session.livePreviewLines = buildLivePreviewLines(string(liveData), liveStart > 0)
	}

	s.mu.Lock()
	s.sessions[session.id] = session
	if s.pendingSessionCount > 0 {
		s.pendingSessionCount--
	}
	s.mu.Unlock()

	if !session.isComplete {
		s.startDownload(session)
	}

	return s.statusForSession(session), nil
}

func (s *BlobViewService) GetStatus(sessionID string) (*models.BlobViewSessionStatus, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	if session.mode == models.BlobViewModeLive {
		if err := s.refreshLiveSession(session); err != nil {
			s.failSession(session, err)
		}
	}

	return s.statusForSession(session), nil
}

func (s *BlobViewService) SetSessionMode(
	sessionID string,
	mode models.BlobViewMode,
) (*models.BlobViewSessionStatus, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	if mode != models.BlobViewModeLive || session.versionID != "" {
		mode = models.BlobViewModeSnapshot
	}

	session.mu.Lock()
	session.mode = mode
	if mode == models.BlobViewModeLive {
		session.focus = models.BlobViewFocusEnd
	} else {
		session.focus = models.BlobViewFocusStart
		session.livePreviewLines = nil
		session.livePreviewStart = session.blobSize
		session.bytesDownloaded = session.indexedBytes
	}
	session.lastAccess = s.now()
	session.mu.Unlock()

	if mode == models.BlobViewModeLive {
		if err := s.refreshLiveSession(session); err != nil {
			s.failSession(session, err)
		}
	}

	if !sessionIsComplete(session) {
		s.startDownload(session)
	}

	return s.statusForSession(session), nil
}

func (s *BlobViewService) GetLines(sessionID string, startLine, lineCount int64) (*models.BlobViewLinesResponse, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	session.mu.Lock()
	session.lastAccess = s.now()
	if len(session.livePreviewLines) > 0 {
		totalLines := int64(len(session.livePreviewLines))
		session.mu.Unlock()
		return &models.BlobViewLinesResponse{
			StartLine:  0,
			TotalLines: totalLines,
			IsComplete: false,
			Lines:      []models.BlobViewLine{},
		}, nil
	}
	totalLines := session.indexedLineCountLocked()
	indexedBytes := session.indexedBytes
	lineStarts := session.lineStartsSnapshotLocked()
	isComplete := session.isComplete
	blobSize := session.blobSize
	file := session.file
	session.mu.Unlock()

	if lineCount <= 0 {
		lineCount = 1
	}
	if lineCount > blobViewMaxLineWindowSize {
		lineCount = blobViewMaxLineWindowSize
	}
	if startLine < 0 {
		startLine = 0
	}
	if startLine >= totalLines {
		return &models.BlobViewLinesResponse{
			StartLine:  startLine,
			TotalLines: totalLines,
			IsComplete: isComplete,
			Lines:      []models.BlobViewLine{},
		}, nil
	}

	endLine := minInt64(startLine+lineCount, totalLines)
	lines, err := readLinesWindow(file, lineStarts, startLine, endLine, indexedBytes, blobSize, isComplete)
	if err != nil {
		logDetailedError("read blob view lines failed", err)
		return nil, fmt.Errorf("failed to load blob lines")
	}

	return &models.BlobViewLinesResponse{
		StartLine:  startLine,
		TotalLines: totalLines,
		IsComplete: isComplete,
		Lines:      lines,
	}, nil
}

func (s *BlobViewService) Search(request models.BlobViewSearchRequest) (*models.BlobViewSearchResponse, error) {
	session, err := s.getSession(request.SessionID)
	if err != nil {
		return nil, err
	}

	query := strings.TrimSpace(request.Query)
	if query == "" {
		return &models.BlobViewSearchResponse{
			Query:      query,
			Matches:    []models.BlobViewSearchMatch{},
			NextCursor: -1,
			IsComplete: true,
		}, nil
	}

	session.mu.Lock()
	session.lastAccess = s.now()
	if len(session.livePreviewLines) > 0 {
		livePreviewLines := append([]string(nil), session.livePreviewLines...)
		session.mu.Unlock()

		matches := make([]models.BlobViewSearchMatch, 0, len(livePreviewLines))
		queryLower := strings.ToLower(query)
		for index, line := range livePreviewLines {
			if !strings.Contains(strings.ToLower(line), queryLower) {
				continue
			}
			matches = append(matches, models.BlobViewSearchMatch{
				LineNumber: int64(index),
				Preview:    line,
			})
		}

		return &models.BlobViewSearchResponse{
			Query:      query,
			Matches:    matches,
			NextCursor: -1,
			IsComplete: true,
		}, nil
	}
	totalLines := session.indexedLineCountLocked()
	indexedBytes := session.indexedBytes
	lineStarts := session.lineStartsSnapshotLocked()
	isSessionComplete := session.isComplete
	blobSize := session.blobSize
	file := session.file
	livePreviewLines := append([]string(nil), session.livePreviewLines...)
	focus := session.focus
	session.mu.Unlock()

	matches := make([]models.BlobViewSearchMatch, 0, blobViewSearchBatchSize)
	nextCursor := int64(-1)

	if focus == models.BlobViewFocusEnd && !isSessionComplete && totalLines == 0 && len(livePreviewLines) > 0 {
		for index, line := range livePreviewLines {
			if !strings.Contains(strings.ToLower(line), strings.ToLower(query)) {
				continue
			}
			matches = append(matches, models.BlobViewSearchMatch{
				LineNumber: int64(index),
				Preview:    line,
			})
			if len(matches) >= blobViewSearchBatchSize {
				break
			}
		}

		return &models.BlobViewSearchResponse{
			Query:      query,
			Matches:    matches,
			NextCursor: -1,
			IsComplete: false,
		}, nil
	}

	if request.Cursor < 0 {
		request.Cursor = 0
	}

	normalizedQuery := []byte(strings.ToLower(query))
	lowerBuffer := make([]byte, 0, 4*1024)
	scannedLines := int64(0)
	lineNumber := request.Cursor

scan:
	for lineNumber < totalLines {
		if scannedLines >= blobViewSearchScanLineLimit {
			nextCursor = lineNumber
			break
		}

		blockEndLine := minInt64(
			lineNumber+blobViewSearchReadBlockLines,
			minInt64(totalLines, lineNumber+blobViewSearchScanLineLimit-scannedLines),
		)
		block, err := readLineBlock(
			file,
			lineStarts,
			lineNumber,
			blockEndLine,
			indexedBytes,
			blobSize,
			isSessionComplete,
		)
		if err != nil {
			logDetailedError("search blob view failed", err)
			return nil, fmt.Errorf("failed to search blob content")
		}

		for index, line := range block {
			lowerBuffer = appendLowerBytes(lowerBuffer[:0], line)
			if bytes.Contains(lowerBuffer, normalizedQuery) {
				matches = append(matches, models.BlobViewSearchMatch{
					LineNumber: lineNumber + int64(index),
					Preview:    string(line),
				})
			}

			if len(matches) >= blobViewSearchBatchSize {
				nextCursor = lineNumber + int64(index) + 1
				break scan
			}

			scannedLines++
		}

		lineNumber = blockEndLine
	}

	isComplete := isSessionComplete && nextCursor == -1
	if !isSessionComplete && nextCursor == -1 {
		nextCursor = totalLines
	}

	return &models.BlobViewSearchResponse{
		Query:      query,
		Matches:    matches,
		NextCursor: nextCursor,
		IsComplete: isComplete,
	}, nil
}

func (s *BlobViewService) Export(ctx context.Context, sessionID string) (*models.BlobViewExportResult, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	session.mu.Lock()
	session.lastAccess = s.now()
	if session.mode == models.BlobViewModeLive {
		session.mu.Unlock()
		return nil, fmt.Errorf("live mode export is unavailable")
	}
	isComplete := session.isComplete
	blobName := session.blobName
	blobSize := session.blobSize
	file := session.file
	session.mu.Unlock()

	if !isComplete {
		return nil, fmt.Errorf("blob is still downloading")
	}

	selectedPath, err := s.saveFileDialog(ctx, wruntime.SaveDialogOptions{
		Title:                "Export Blob Content",
		DefaultFilename:      filepath.Base(blobName),
		CanCreateDirectories: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to export blob content")
	}
	if selectedPath == "" {
		return &models.BlobViewExportResult{Cancelled: true}, nil
	}

	if file == nil {
		return nil, fmt.Errorf("failed to open cached blob")
	}

	target, err := openExportFile(selectedPath)
	if err != nil {
		logDetailedError("create blob export file failed", err)
		return nil, fmt.Errorf("failed to create export file")
	}
	defer target.Close()

	if _, err := io.Copy(target, io.NewSectionReader(file, 0, blobSize)); err != nil {
		logDetailedError("export blob content failed", err)
		return nil, fmt.Errorf("failed to export blob content")
	}

	return &models.BlobViewExportResult{Cancelled: false}, nil
}

func (s *BlobViewService) CloseSession(sessionID string) error {
	s.mu.Lock()
	session, ok := s.sessions[sessionID]
	if ok {
		delete(s.sessions, sessionID)
	}
	s.mu.Unlock()

	if !ok {
		return nil
	}

	s.closeSession(session)
	return nil
}

func (s *BlobViewService) downloadSession(session *blobViewSession) {
	defer func() {
		session.mu.Lock()
		session.downloadRunning = false
		session.mu.Unlock()
	}()

	ctx := session.downloadCtx
	blobClient, _, _, err := s.createSessionBlobClient(ctx, session)
	if err != nil {
		s.failSession(session, err)
		return
	}

	for {
		if isSessionClosed(session) {
			return
		}

		session.mu.RLock()
		offset := session.indexedBytes
		endOffset := session.blobSize
		if len(session.livePreviewLines) > 0 {
			endOffset = session.livePreviewStart
		}
		session.mu.RUnlock()

		if offset >= endOffset {
			break
		}

		count := minInt64(defaultBlobChunkSizeBytes, endOffset-offset)
		data, err := blobClient.DownloadRange(ctx, session.containerName, session.blobName, offset, count)
		if err != nil {
			s.failSession(session, err)
			return
		}
		if err := writeBlobRange(session.file, offset, data); err != nil {
			s.failSession(session, err)
			return
		}

		session.mu.Lock()
		if offset == session.indexedBytes {
			appendLineStartsLocked(session, offset, data)
			session.indexedBytes += int64(len(data))
		}
		session.bytesDownloaded = session.indexedBytes
		session.lastAccess = s.now()
		session.mu.Unlock()
	}

	session.mu.Lock()
	needsRebuild := len(session.livePreviewLines) > 0
	if !needsRebuild {
		session.isComplete = session.indexedBytes >= session.blobSize
		session.lastAccess = s.now()
		session.mu.Unlock()
		return
	}
	session.mu.Unlock()

	if err := rebuildFullIndex(session); err != nil {
		s.failSession(session, err)
		return
	}

	session.mu.Lock()
	session.isComplete = session.indexedBytes >= session.blobSize
	session.livePreviewLines = nil
	session.livePreviewStart = session.blobSize
	session.bytesDownloaded = session.indexedBytes
	session.lastAccess = s.now()
	session.mu.Unlock()
}

func (s *BlobViewService) newBlobClient(
	ctx context.Context,
	accountName string,
	containerName string,
	blobName string,
) (blobViewBlobClient, int64, string, error) {
	return s.newBlobClientForVersion(ctx, accountName, containerName, blobName, "")
}

func (s *BlobViewService) newVersionedBlobClient(
	ctx context.Context,
	accountName string,
	containerName string,
	blobName string,
	versionID string,
) (blobViewBlobClient, int64, string, error) {
	return s.newBlobClientForVersion(ctx, accountName, containerName, blobName, versionID)
}

func (s *BlobViewService) newBlobClientForVersion(
	ctx context.Context,
	accountName string,
	containerName string,
	blobName string,
	versionID string,
) (blobViewBlobClient, int64, string, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, 0, "", sanitizeAuthError(err)
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", accountName)
	client, err := azblob.NewClient(serviceURL, cred, nil)
	if err != nil {
		return nil, 0, "", sanitizeBlobError(err)
	}

	blobClient := client.ServiceClient().NewContainerClient(containerName).NewBlobClient(blobName)
	if versionID != "" {
		blobClient, err = blobClient.WithVersionID(versionID)
		if err != nil {
			return nil, 0, "", sanitizeBlobError(err)
		}
	}

	props, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		return nil, 0, "", sanitizeBlobError(err)
	}

	return blobViewAzureClient{client: blobClient}, derefInt64(props.ContentLength), derefStr(props.ContentType), nil
}

func (s *BlobViewService) createRequestedBlobClient(
	ctx context.Context,
	request models.OpenBlobViewSessionRequest,
) (blobViewBlobClient, int64, string, error) {
	if request.VersionID != "" {
		return s.createVersionedBlobClient(
			ctx,
			request.AccountName,
			request.ContainerName,
			request.BlobName,
			request.VersionID,
		)
	}
	return s.createBlobClient(
		ctx,
		request.AccountName,
		request.ContainerName,
		request.BlobName,
	)
}

func (s *BlobViewService) createSessionBlobClient(
	ctx context.Context,
	session *blobViewSession,
) (blobViewBlobClient, int64, string, error) {
	if session.versionID != "" {
		return s.createVersionedBlobClient(
			ctx,
			session.accountName,
			session.containerName,
			session.blobName,
			session.versionID,
		)
	}
	return s.createBlobClient(
		ctx,
		session.accountName,
		session.containerName,
		session.blobName,
	)
}

func (s *BlobViewService) getSession(sessionID string) (*blobViewSession, error) {
	s.mu.RLock()
	session, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("blob view session not found")
	}
	return session, nil
}

func (s *BlobViewService) statusForSession(session *blobViewSession) *models.BlobViewSessionStatus {
	session.mu.Lock()
	defer session.mu.Unlock()

	session.lastAccess = s.now()

	hasPendingBefore := false
	hasPendingAfter := false
	if session.mode == models.BlobViewModeLive {
		hasPendingBefore = len(session.livePreviewLines) > 0 || !session.isComplete
	} else if !session.isComplete {
		if session.focus == models.BlobViewFocusEnd {
			hasPendingBefore = true
		} else {
			hasPendingAfter = true
		}
	}

	return &models.BlobViewSessionStatus{
		SessionID:        session.id,
		BlobName:         session.blobName,
		BlobSize:         session.blobSize,
		ContentType:      session.contentType,
		BytesDownloaded:  bytesDownloadedLocked(session),
		IndexedLineCount: session.indexedLineCountLocked(),
		IndexedThrough:   session.indexedBytes,
		IsComplete:       session.isComplete,
		HasPendingBefore: hasPendingBefore,
		HasPendingAfter:  hasPendingAfter,
		ErrorMessage:     session.errorMessage,
		FailureReason:    session.failureReason,
		Mode:             session.mode,
		Focus:            session.focus,
		LivePreviewLines: append([]string{}, session.livePreviewLines...),
	}
}

func (s *BlobViewService) failSession(session *blobViewSession, err error) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.closed {
		return
	}

	reason := blobFailureReasonFromError(err)
	session.failureReason = string(reason)
	session.errorMessage = blobFailureMessage(reason)
	session.lastAccess = s.now()
	logDetailedError("blob view session failed", err)
}

func (s *BlobViewService) closeSession(session *blobViewSession) {
	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return
	}
	session.closed = true
	cancel := session.cancel
	file := session.file
	filePath := session.filePath
	reservedBytes := session.reservedBytes
	session.file = nil
	session.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if file != nil {
		_ = file.Close()
	}
	_ = os.Remove(filePath)
	s.releaseAllocatedTempBytes(reservedBytes)
}

func (s *BlobViewService) reserveSessionCapacity(blobSize int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.sessions)+s.pendingSessionCount >= blobViewMaxConcurrentSessions {
		return newBlobFailureError(
			models.BlobFailureReasonLimitExceeded,
			blobFailureMessage(models.BlobFailureReasonLimitExceeded),
			fmt.Errorf("blob view session limit exceeded"),
		)
	}
	if s.reservedTempBytes+blobSize > blobViewMaxAggregateTempBytes {
		return newBlobFailureError(
			models.BlobFailureReasonLimitExceeded,
			blobFailureMessage(models.BlobFailureReasonLimitExceeded),
			fmt.Errorf("blob view temp storage quota exceeded"),
		)
	}

	s.pendingSessionCount++
	s.reservedTempBytes += blobSize
	return nil
}

func (s *BlobViewService) releasePendingSessionCapacity(blobSize int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pendingSessionCount > 0 {
		s.pendingSessionCount--
	}
	s.reservedTempBytes = maxInt64(s.reservedTempBytes-blobSize, 0)
}

func (s *BlobViewService) releaseAllocatedTempBytes(blobSize int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.reservedTempBytes = maxInt64(s.reservedTempBytes-blobSize, 0)
}

func buildBlobViewFailureStatus(
	blobName string,
	mode models.BlobViewMode,
	focus models.BlobViewFocus,
	reason models.BlobFailureReason,
) *models.BlobViewSessionStatus {
	return &models.BlobViewSessionStatus{
		BlobName:         blobName,
		ErrorMessage:     blobFailureMessage(reason),
		FailureReason:    string(reason),
		Mode:             mode,
		Focus:            focus,
		LivePreviewLines: []string{},
	}
}

type blobViewAzureClient struct {
	client *blob.Client
}

func (c blobViewAzureClient) DownloadRange(
	ctx context.Context,
	containerName string,
	blobName string,
	offset int64,
	count int64,
) ([]byte, error) {
	resp, err := c.client.DownloadStream(ctx, &azblob.DownloadStreamOptions{
		Range: azblob.HTTPRange{
			Offset: offset,
			Count:  count,
		},
	})
	if err != nil {
		return nil, sanitizeBlobError(err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, newBlobFailureError(
			models.BlobFailureReasonDownloadFailed,
			blobFailureMessage(models.BlobFailureReasonDownloadFailed),
			err,
		)
	}

	return data, nil
}

func (s *BlobViewService) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.cleanupExpiredSessions()
		case <-s.stopCh:
			return
		}
	}
}

func (s *BlobViewService) cleanupExpiredSessions() {
	now := s.now()

	s.mu.Lock()
	expiredIDs := make([]string, 0)
	expiredSessions := make([]*blobViewSession, 0)
	for id, session := range s.sessions {
		session.mu.RLock()
		expired := now.Sub(session.lastAccess) > blobViewSessionTTL
		session.mu.RUnlock()
		if expired {
			expiredIDs = append(expiredIDs, id)
			expiredSessions = append(expiredSessions, session)
		}
	}

	for _, id := range expiredIDs {
		delete(s.sessions, id)
	}
	s.mu.Unlock()

	for _, session := range expiredSessions {
		s.closeSession(session)
	}
}

func makeInitialLineStarts(blobSize int64) []int64 {
	if blobSize == 0 {
		return []int64{}
	}
	return []int64{0}
}

func appendLineStartsLocked(session *blobViewSession, offset int64, data []byte) {
	for index, value := range data {
		if value != '\n' {
			continue
		}

		nextOffset := offset + int64(index) + 1
		if nextOffset <= session.blobSize {
			session.lineStarts = append(session.lineStarts, nextOffset)
		}
	}
}

// lineStartsSnapshotLocked returns the current line index for use outside the
// session lock. Sharing the backing array is safe because indexed offsets are
// only ever appended or replaced wholesale, never rewritten in place, so a
// captured slice header keeps describing a stable prefix.
func (s *blobViewSession) lineStartsSnapshotLocked() []int64 {
	return s.lineStarts
}

func (s *blobViewSession) indexedLineCountLocked() int64 {
	if len(s.livePreviewLines) > 0 {
		return int64(len(s.livePreviewLines))
	}
	if s.indexedBytes == 0 || len(s.lineStarts) == 0 {
		return 0
	}
	return int64(len(s.lineStarts))
}

func buildLivePreviewLines(content string, droppedPrefix bool) []string {
	normalized := strings.ReplaceAll(strings.ReplaceAll(content, "\r\n", "\n"), "\r", "\n")
	lines := strings.Split(normalized, "\n")
	if droppedPrefix && len(lines) > 0 {
		lines = lines[1:]
	}
	if len(lines) > blobViewLivePreviewLineLimit {
		lines = lines[len(lines)-blobViewLivePreviewLineLimit:]
	}

	result := make([]string, 0, len(lines))
	for _, line := range lines {
		result = append(result, line)
	}
	return result
}

func writeBlobRange(file *os.File, offset int64, data []byte) error {
	if file == nil {
		return fmt.Errorf("failed to open temp file")
	}

	if _, err := file.WriteAt(data, offset); err != nil {
		return fmt.Errorf("failed to write temp file")
	}
	return nil
}

func (s *BlobViewService) refreshLiveSession(session *blobViewSession) error {
	blobClient, blobSize, contentType, err := s.createSessionBlobClient(
		session.downloadCtx,
		session,
	)
	if err != nil {
		return err
	}

	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return nil
	}
	isComplete := session.isComplete
	previousBlobSize := session.blobSize
	session.mu.Unlock()

	if err := s.resizeSessionFile(session, blobSize); err != nil {
		return err
	}

	if isComplete {
		if blobSize < previousBlobSize {
			s.resetLiveSession(session, blobSize, contentType)
		} else if blobSize > previousBlobSize {
			if err := s.appendLiveBytes(session, blobClient, previousBlobSize, blobSize); err != nil {
				return err
			}
			session.mu.Lock()
			if !session.closed {
				session.contentType = contentType
				session.errorMessage = ""
				session.failureReason = ""
				session.lastAccess = s.now()
			}
			session.mu.Unlock()
			return nil
		} else {
			session.mu.Lock()
			if !session.closed {
				session.contentType = contentType
				session.errorMessage = ""
				session.failureReason = ""
				session.lastAccess = s.now()
			}
			session.mu.Unlock()
			return nil
		}
	}

	if blobSize == 0 {
		session.mu.Lock()
		if !session.closed {
			session.blobSize = 0
			session.contentType = contentType
			session.bytesDownloaded = 0
			session.indexedBytes = 0
			session.lineStarts = makeInitialLineStarts(0)
			session.livePreviewLines = nil
			session.livePreviewStart = 0
			session.isComplete = true
			session.errorMessage = ""
			session.failureReason = ""
			session.lastAccess = s.now()
		}
		session.mu.Unlock()
		return nil
	}

	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return nil
	}
	// Refetch the preview window only when the blob actually changed. Polling
	// otherwise re-downloads a full chunk on every tick for content that is
	// already on disk.
	previewIsCurrent := len(session.livePreviewLines) > 0 && session.blobSize == blobSize
	if previewIsCurrent {
		session.contentType = contentType
		session.errorMessage = ""
		session.failureReason = ""
		session.lastAccess = s.now()
	}
	session.mu.Unlock()

	if !previewIsCurrent {
		if err := s.updateLivePreview(session, blobClient, blobSize, contentType); err != nil {
			return err
		}
	}

	s.startDownload(session)
	return nil
}

func (s *BlobViewService) startDownload(session *blobViewSession) {
	session.mu.Lock()
	if session.closed || session.downloadRunning || session.isComplete {
		session.mu.Unlock()
		return
	}
	session.downloadRunning = true
	session.mu.Unlock()

	go s.downloadSession(session)
}

func (s *BlobViewService) resizeSessionFile(session *blobViewSession, blobSize int64) error {
	session.mu.RLock()
	currentSize := session.reservedBytes
	file := session.file
	closed := session.closed
	session.mu.RUnlock()

	if closed || file == nil || currentSize == blobSize {
		return nil
	}

	s.mu.Lock()
	nextReserved := s.reservedTempBytes - currentSize + blobSize
	if nextReserved > blobViewMaxAggregateTempBytes {
		s.mu.Unlock()
		return newBlobFailureError(
			models.BlobFailureReasonLimitExceeded,
			blobFailureMessage(models.BlobFailureReasonLimitExceeded),
			fmt.Errorf("blob view temp storage quota exceeded"),
		)
	}
	if nextReserved < 0 {
		nextReserved = 0
	}
	s.reservedTempBytes = nextReserved
	s.mu.Unlock()

	if err := file.Truncate(blobSize); err != nil {
		return fmt.Errorf("failed to prepare temp file")
	}

	session.mu.Lock()
	if !session.closed {
		session.reservedBytes = blobSize
	}
	session.mu.Unlock()
	return nil
}

func (s *BlobViewService) updateLivePreview(
	session *blobViewSession,
	blobClient blobViewBlobClient,
	blobSize int64,
	contentType string,
) error {
	liveStart := maxInt64(blobSize-defaultBlobChunkSizeBytes, 0)
	liveData, err := blobClient.DownloadRange(
		session.downloadCtx,
		session.containerName,
		session.blobName,
		liveStart,
		blobSize-liveStart,
	)
	if err != nil {
		return err
	}

	session.mu.RLock()
	file := session.file
	closed := session.closed
	session.mu.RUnlock()
	if closed {
		return nil
	}

	if err := writeBlobRange(file, liveStart, liveData); err != nil {
		return err
	}

	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return nil
	}
	session.blobSize = blobSize
	session.contentType = contentType
	session.livePreviewStart = liveStart
	session.livePreviewLines = buildLivePreviewLines(string(liveData), liveStart > 0)
	session.bytesDownloaded = session.indexedBytes
	session.isComplete = session.indexedBytes >= session.blobSize && len(session.livePreviewLines) == 0
	session.errorMessage = ""
	session.failureReason = ""
	session.lastAccess = s.now()
	session.mu.Unlock()
	return nil
}

func (s *BlobViewService) resetLiveSession(
	session *blobViewSession,
	blobSize int64,
	contentType string,
) {
	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return
	}
	session.blobSize = blobSize
	session.contentType = contentType
	session.bytesDownloaded = 0
	session.indexedBytes = 0
	session.lineStarts = makeInitialLineStarts(blobSize)
	session.livePreviewLines = nil
	session.livePreviewStart = blobSize
	session.isComplete = blobSize == 0
	session.errorMessage = ""
	session.failureReason = ""
	session.lastAccess = s.now()
	session.mu.Unlock()
}

func (s *BlobViewService) appendLiveBytes(
	session *blobViewSession,
	blobClient blobViewBlobClient,
	startOffset int64,
	endOffset int64,
) error {
	for offset := startOffset; offset < endOffset; offset += defaultBlobChunkSizeBytes {
		count := minInt64(defaultBlobChunkSizeBytes, endOffset-offset)
		data, err := blobClient.DownloadRange(
			session.downloadCtx,
			session.containerName,
			session.blobName,
			offset,
			count,
		)
		if err != nil {
			return err
		}

		session.mu.RLock()
		file := session.file
		closed := session.closed
		session.mu.RUnlock()
		if closed {
			return nil
		}

		if err := writeBlobRange(file, offset, data); err != nil {
			return err
		}

		session.mu.Lock()
		if session.closed {
			session.mu.Unlock()
			return nil
		}
		// The new size has to land first: appendLineStartsLocked discards any
		// offset past session.blobSize, so indexing before the update would
		// drop every line break the appended bytes introduced.
		session.blobSize = endOffset
		appendLineStartsLocked(session, offset, data)
		session.indexedBytes = offset + int64(len(data))
		session.bytesDownloaded = session.indexedBytes
		session.livePreviewLines = nil
		session.livePreviewStart = session.blobSize
		session.isComplete = session.indexedBytes >= session.blobSize
		session.errorMessage = ""
		session.failureReason = ""
		session.lastAccess = s.now()
		session.mu.Unlock()
	}

	return nil
}

func rebuildFullIndex(session *blobViewSession) error {
	if session.file == nil {
		return fmt.Errorf("failed to open cached blob")
	}

	lineStarts := makeInitialLineStarts(session.blobSize)
	buffer := make([]byte, 64*1024)
	var offset int64
	for {
		readCount, readErr := session.file.ReadAt(buffer, offset)
		if readCount > 0 {
			chunk := buffer[:readCount]
			for index, value := range chunk {
				if value == '\n' {
					nextOffset := offset + int64(index) + 1
					if nextOffset <= session.blobSize {
						lineStarts = append(lineStarts, nextOffset)
					}
				}
			}
			offset += int64(readCount)
		}

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("failed to rebuild blob index")
		}
	}

	session.mu.Lock()
	session.lineStarts = lineStarts
	session.indexedBytes = session.blobSize
	session.mu.Unlock()

	return nil
}

func readLinesWindow(
	file *os.File,
	lineStarts []int64,
	startLine int64,
	endLine int64,
	indexedBytes int64,
	blobSize int64,
	isComplete bool,
) ([]models.BlobViewLine, error) {
	block, err := readLineBlock(file, lineStarts, startLine, endLine, indexedBytes, blobSize, isComplete)
	if err != nil {
		return nil, err
	}

	lines := make([]models.BlobViewLine, 0, len(block))
	for index, content := range block {
		lines = append(lines, models.BlobViewLine{
			LineNumber: startLine + int64(index),
			Content:    string(content),
		})
	}
	return lines, nil
}

// readLineBlock reads the bytes backing lines [startLine, endLine) with a single
// ReadAt and slices them per line. The returned slices alias one shared buffer
// and stay valid only until the caller copies them.
func readLineBlock(
	file *os.File,
	lineStarts []int64,
	startLine int64,
	endLine int64,
	indexedBytes int64,
	blobSize int64,
	isComplete bool,
) ([][]byte, error) {
	totalLines := int64(len(lineStarts))
	if startLine < 0 {
		startLine = 0
	}
	if endLine > totalLines {
		endLine = totalLines
	}
	if startLine >= endLine {
		return nil, nil
	}

	startOffset := lineStarts[startLine]
	endOffset := indexedBytes
	if isComplete {
		endOffset = blobSize
	}
	if endLine < totalLines {
		endOffset = lineStarts[endLine]
	}
	if endOffset < startOffset {
		endOffset = startOffset
	}

	lines := make([][]byte, endLine-startLine)
	if endOffset == startOffset {
		return lines, nil
	}
	if file == nil {
		return nil, fmt.Errorf("failed to open cached blob")
	}

	buffer := make([]byte, endOffset-startOffset)
	if _, err := file.ReadAt(buffer, startOffset); err != nil && err != io.EOF {
		return nil, fmt.Errorf("failed to read cached blob")
	}

	for lineNumber := startLine; lineNumber < endLine; lineNumber++ {
		lineEnd := endOffset
		if nextLine := lineNumber + 1; nextLine < totalLines {
			lineEnd = lineStarts[nextLine]
		}
		lines[lineNumber-startLine] = trimLineBreak(
			sliceLineBytes(buffer, lineStarts[lineNumber]-startOffset, lineEnd-startOffset),
		)
	}

	return lines, nil
}

func sliceLineBytes(buffer []byte, start, end int64) []byte {
	bufferLength := int64(len(buffer))
	start = minInt64(maxInt64(start, 0), bufferLength)
	end = minInt64(maxInt64(end, start), bufferLength)
	return buffer[start:end]
}

func trimLineBreak(line []byte) []byte {
	line = bytes.TrimSuffix(line, []byte("\n"))
	return bytes.TrimSuffix(line, []byte("\r"))
}

// appendLowerBytes appends the lowercase form of src to dst so that repeated
// comparisons can reuse a single buffer instead of allocating per line.
func appendLowerBytes(dst []byte, src []byte) []byte {
	for index := 0; index < len(src); {
		value := src[index]
		if value < utf8.RuneSelf {
			if 'A' <= value && value <= 'Z' {
				value += 'a' - 'A'
			}
			dst = append(dst, value)
			index++
			continue
		}

		decoded, size := utf8.DecodeRune(src[index:])
		dst = utf8.AppendRune(dst, unicode.ToLower(decoded))
		index += size
	}
	return dst
}

func isSessionClosed(session *blobViewSession) bool {
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.closed
}

func sessionIsComplete(session *blobViewSession) bool {
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.isComplete
}

func bytesDownloadedLocked(session *blobViewSession) int64 {
	if len(session.livePreviewLines) == 0 {
		return minInt64(maxInt64(session.bytesDownloaded, session.indexedBytes), session.blobSize)
	}

	if session.blobSize == 0 {
		return 0
	}

	previewStart := minInt64(maxInt64(session.livePreviewStart, 0), session.blobSize)
	previewBytes := session.blobSize - maxInt64(previewStart, session.indexedBytes)
	if previewBytes < 0 {
		previewBytes = 0
	}

	return minInt64(session.indexedBytes+previewBytes, session.blobSize)
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
