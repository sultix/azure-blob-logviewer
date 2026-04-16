package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	blobViewTailPreviewLineLimit        = 200
	blobViewSearchBatchSize             = 100
	blobViewSearchScanLineLimit         = 2_000
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
	auth             *AzureAuthService
	saveFileDialog   func(context.Context, wruntime.SaveDialogOptions) (string, error)
	openTempFile     func() (*os.File, error)
	now              func() time.Time
	createBlobClient func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error)

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
	tailPreviewLines []string

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
	if mode != models.BlobViewModeTail {
		mode = models.BlobViewModeSnapshot
	}

	focus := models.BlobViewFocusStart
	if mode == models.BlobViewModeTail {
		focus = models.BlobViewFocusEnd
	}

	blobClient, blobSize, contentType, err := s.createBlobClient(
		ctx,
		request.AccountName,
		request.ContainerName,
		request.BlobName,
	)
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

	var tempFile *os.File
	if mode == models.BlobViewModeSnapshot {
		tempFile, err = s.openTempFile()
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
	}

	downloadCtx, cancel := context.WithCancel(context.Background())

	session := &blobViewSession{
		id:               fmt.Sprintf("blob-view-%d", s.now().UnixNano()),
		accountName:      request.AccountName,
		containerName:    request.ContainerName,
		blobName:         request.BlobName,
		mode:             mode,
		focus:            focus,
		file:             tempFile,
		blobSize:         blobSize,
		contentType:      contentType,
		downloadCtx:      downloadCtx,
		cancel:           cancel,
		lineStarts:       makeInitialLineStarts(blobSize),
		lastAccess:       s.now(),
		tailPreviewLines: nil,
	}
	if tempFile != nil {
		session.filePath = tempFile.Name()
		session.reservedBytes = blobSize
	} else {
		session.lineStarts = nil
	}

	if blobSize == 0 {
		session.indexedBytes = 0
		session.isComplete = mode == models.BlobViewModeSnapshot
	} else if mode == models.BlobViewModeTail {
		if err := s.refreshTailSession(session); err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			logDetailedError("download blob tail session failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, blobFailureReasonFromError(err)), nil
		}
	} else if focus == models.BlobViewFocusEnd && blobSize > largeBlobThresholdBytes {
		tailStart := maxInt64(blobSize-defaultBlobChunkSizeBytes, 0)
		tailData, err := blobClient.DownloadRange(
			downloadCtx,
			request.ContainerName,
			request.BlobName,
			tailStart,
			blobSize-tailStart,
		)
		if err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			_ = tempFile.Close()
			_ = os.Remove(session.filePath)
			logDetailedError("download blob tail preview failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, blobFailureReasonFromError(err)), nil
		}
		if err := writeBlobRange(session.file, tailStart, tailData); err != nil {
			s.releasePendingSessionCapacity(blobSize)
			cancel()
			_ = tempFile.Close()
			_ = os.Remove(session.filePath)
			logDetailedError("write blob tail preview failed", err)
			return buildBlobViewFailureStatus(request.BlobName, mode, focus, models.BlobFailureReasonDownloadFailed), nil
		}

		session.bytesDownloaded = int64(len(tailData))
		session.indexedBytes = session.bytesDownloaded
		session.tailPreviewLines = buildTailPreviewLines(string(tailData), tailStart > 0)
	}

	s.mu.Lock()
	s.sessions[session.id] = session
	if s.pendingSessionCount > 0 {
		s.pendingSessionCount--
	}
	if mode == models.BlobViewModeTail {
		s.reservedTempBytes = maxInt64(s.reservedTempBytes-blobSize, 0)
	}
	s.mu.Unlock()

	if session.mode == models.BlobViewModeSnapshot && !session.isComplete {
		go s.downloadSession(session)
	}

	return s.statusForSession(session), nil
}

func (s *BlobViewService) GetStatus(sessionID string) (*models.BlobViewSessionStatus, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	if session.mode == models.BlobViewModeTail {
		if err := s.refreshTailSession(session); err != nil {
			s.failSession(session, err)
		}
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
	if session.mode == models.BlobViewModeTail {
		totalLines := int64(len(session.tailPreviewLines))
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
	lineStarts := append([]int64(nil), session.lineStarts...)
	isComplete := session.isComplete
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
	lines, err := readLinesWindow(file, lineStarts, startLine, endLine, indexedBytes, session.blobSize, isComplete)
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
	if session.mode == models.BlobViewModeTail {
		tailPreviewLines := append([]string(nil), session.tailPreviewLines...)
		session.mu.Unlock()

		matches := make([]models.BlobViewSearchMatch, 0, len(tailPreviewLines))
		queryLower := strings.ToLower(query)
		for index, line := range tailPreviewLines {
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
	lineStarts := append([]int64(nil), session.lineStarts...)
	isSessionComplete := session.isComplete
	file := session.file
	tailPreviewLines := append([]string(nil), session.tailPreviewLines...)
	focus := session.focus
	session.mu.Unlock()

	matches := make([]models.BlobViewSearchMatch, 0, blobViewSearchBatchSize)
	nextCursor := int64(-1)

	if focus == models.BlobViewFocusEnd && !isSessionComplete && totalLines == 0 && len(tailPreviewLines) > 0 {
		for index, line := range tailPreviewLines {
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

	normalizedQuery := strings.ToLower(query)
	scannedLines := int64(0)
	for lineNumber := request.Cursor; lineNumber < totalLines; lineNumber++ {
		if scannedLines >= blobViewSearchScanLineLimit {
			nextCursor = lineNumber
			break
		}

		line, err := readSingleLine(file, lineStarts, lineNumber, indexedBytes, session.blobSize, isSessionComplete)
		if err != nil {
			logDetailedError("search blob view failed", err)
			return nil, fmt.Errorf("failed to search blob content")
		}

		if strings.Contains(strings.ToLower(line), normalizedQuery) {
			matches = append(matches, models.BlobViewSearchMatch{
				LineNumber: lineNumber,
				Preview:    line,
			})
		}

		if len(matches) >= blobViewSearchBatchSize {
			nextCursor = lineNumber + 1
			break
		}

		scannedLines++
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
	if session.mode == models.BlobViewModeTail {
		session.mu.Unlock()
		return nil, fmt.Errorf("tail mode export is unavailable")
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
	ctx := session.downloadCtx
	blobClient, _, _, err := s.createBlobClient(ctx, session.accountName, session.containerName, session.blobName)
	if err != nil {
		s.failSession(session, err)
		return
	}

	startOffset := int64(0)
	endOffset := session.blobSize
	if session.focus == models.BlobViewFocusEnd && session.blobSize > largeBlobThresholdBytes {
		endOffset = maxInt64(session.blobSize-defaultBlobChunkSizeBytes, 0)
	}

	for offset := startOffset; offset < endOffset; offset += defaultBlobChunkSizeBytes {
		if isSessionClosed(session) {
			return
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
		session.bytesDownloaded += int64(len(data))
		if offset == session.indexedBytes {
			appendLineStartsLocked(session, offset, data)
			session.indexedBytes += int64(len(data))
		}
		session.lastAccess = s.now()
		session.mu.Unlock()
	}

	session.mu.Lock()
	needsRebuild := session.focus == models.BlobViewFocusEnd && session.blobSize > largeBlobThresholdBytes
	if !needsRebuild {
		session.isComplete = true
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
	session.isComplete = true
	session.tailPreviewLines = nil
	session.lastAccess = s.now()
	session.mu.Unlock()
}

func (s *BlobViewService) newBlobClient(
	ctx context.Context,
	accountName string,
	containerName string,
	blobName string,
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

	props, err := client.ServiceClient().NewContainerClient(containerName).NewBlobClient(blobName).GetProperties(ctx, nil)
	if err != nil {
		return nil, 0, "", sanitizeBlobError(err)
	}

	return blobViewAzureClient{client: client}, derefInt64(props.ContentLength), derefStr(props.ContentType), nil
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
	if session.mode == models.BlobViewModeTail {
		hasPendingBefore = session.blobSize > session.bytesDownloaded
	} else if !session.isComplete {
		if session.focus == models.BlobViewFocusEnd {
			hasPendingBefore = true
		} else {
			hasPendingAfter = true
		}
	}

	return &models.BlobViewSessionStatus{
		SessionID:         session.id,
		BlobName:          session.blobName,
		BlobSize:          session.blobSize,
		ContentType:       session.contentType,
		BytesDownloaded:   session.bytesDownloaded,
		IndexedLineCount:  session.indexedLineCountLocked(),
		IndexedThrough:    session.indexedBytes,
		IsComplete:        session.isComplete,
		CanEnableWordWrap: session.mode == models.BlobViewModeSnapshot && session.isComplete,
		HasPendingBefore:  hasPendingBefore,
		HasPendingAfter:   hasPendingAfter,
		ErrorMessage:      session.errorMessage,
		FailureReason:     session.failureReason,
		Mode:              session.mode,
		Focus:             session.focus,
		TailPreviewLines:  append([]string{}, session.tailPreviewLines...),
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
		TailPreviewLines: []string{},
	}
}

type blobViewAzureClient struct {
	client *azblob.Client
}

func (c blobViewAzureClient) DownloadRange(
	ctx context.Context,
	containerName string,
	blobName string,
	offset int64,
	count int64,
) ([]byte, error) {
	resp, err := c.client.DownloadStream(ctx, containerName, blobName, &azblob.DownloadStreamOptions{
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

func (s *blobViewSession) indexedLineCountLocked() int64 {
	if s.mode == models.BlobViewModeTail {
		return int64(len(s.tailPreviewLines))
	}
	if s.indexedBytes == 0 || len(s.lineStarts) == 0 {
		return 0
	}
	return int64(len(s.lineStarts))
}

func buildTailPreviewLines(content string, droppedPrefix bool) []string {
	normalized := strings.ReplaceAll(strings.ReplaceAll(content, "\r\n", "\n"), "\r", "\n")
	lines := strings.Split(normalized, "\n")
	if droppedPrefix && len(lines) > 0 {
		lines = lines[1:]
	}
	if len(lines) > blobViewTailPreviewLineLimit {
		lines = lines[len(lines)-blobViewTailPreviewLineLimit:]
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

func (s *BlobViewService) refreshTailSession(session *blobViewSession) error {
	blobClient, blobSize, contentType, err := s.createBlobClient(
		session.downloadCtx,
		session.accountName,
		session.containerName,
		session.blobName,
	)
	if err != nil {
		return err
	}

	var tailData []byte
	if blobSize > 0 {
		tailStart := maxInt64(blobSize-defaultBlobChunkSizeBytes, 0)
		tailData, err = blobClient.DownloadRange(
			session.downloadCtx,
			session.containerName,
			session.blobName,
			tailStart,
			blobSize-tailStart,
		)
		if err != nil {
			return err
		}

		session.mu.Lock()
		if session.closed {
			session.mu.Unlock()
			return nil
		}
		session.blobSize = blobSize
		session.contentType = contentType
		session.bytesDownloaded = int64(len(tailData))
		session.indexedBytes = int64(len(tailData))
		session.tailPreviewLines = buildTailPreviewLines(string(tailData), tailStart > 0)
		session.errorMessage = ""
		session.failureReason = ""
		session.lastAccess = s.now()
		session.mu.Unlock()
		return nil
	}

	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return nil
	}
	session.blobSize = 0
	session.contentType = contentType
	session.bytesDownloaded = 0
	session.indexedBytes = 0
	session.tailPreviewLines = nil
	session.errorMessage = ""
	session.failureReason = ""
	session.lastAccess = s.now()
	session.mu.Unlock()
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
	lines := make([]models.BlobViewLine, 0, endLine-startLine)
	for lineNumber := startLine; lineNumber < endLine; lineNumber++ {
		content, err := readSingleLine(file, lineStarts, lineNumber, indexedBytes, blobSize, isComplete)
		if err != nil {
			return nil, err
		}
		lines = append(lines, models.BlobViewLine{
			LineNumber: lineNumber,
			Content:    content,
		})
	}
	return lines, nil
}

func readSingleLine(
	file *os.File,
	lineStarts []int64,
	lineNumber int64,
	indexedBytes int64,
	blobSize int64,
	isComplete bool,
) (string, error) {
	if lineNumber < 0 || lineNumber >= int64(len(lineStarts)) {
		return "", nil
	}

	startOffset := lineStarts[lineNumber]
	endOffset := indexedBytes
	if isComplete {
		endOffset = blobSize
	}
	if nextLine := lineNumber + 1; nextLine < int64(len(lineStarts)) {
		endOffset = lineStarts[nextLine]
	}
	if endOffset < startOffset {
		endOffset = startOffset
	}

	length := endOffset - startOffset
	if length == 0 {
		return "", nil
	}
	if file == nil {
		return "", fmt.Errorf("failed to open cached blob")
	}

	buffer := make([]byte, length)
	if _, err := file.ReadAt(buffer, startOffset); err != nil && err != io.EOF {
		return "", fmt.Errorf("failed to read cached blob")
	}

	content := string(buffer)
	content = strings.TrimSuffix(content, "\n")
	content = strings.TrimSuffix(content, "\r")
	return content, nil
}

func isSessionClosed(session *blobViewSession) bool {
	session.mu.RLock()
	defer session.mu.RUnlock()
	return session.closed
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
