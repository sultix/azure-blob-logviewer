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
	blobViewTailPreviewLineLimit = 200
	blobViewSearchBatchSize      = 100
	blobViewSessionTTL           = 10 * time.Minute
)

type BlobViewService struct {
	auth           *AzureAuthService
	saveFileDialog func(context.Context, wruntime.SaveDialogOptions) (string, error)
	openTempFile   func() (*os.File, error)
	now            func() time.Time

	mu       sync.RWMutex
	sessions map[string]*blobViewSession
	stopCh   chan struct{}
}

type blobViewSession struct {
	mu sync.RWMutex

	id            string
	accountName   string
	containerName string
	blobName      string
	focus         models.BlobViewFocus
	filePath      string
	blobSize      int64
	contentType   string

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
		now:      time.Now,
		sessions: make(map[string]*blobViewSession),
		stopCh:   make(chan struct{}),
	}

	go service.cleanupLoop()

	return service
}

func (s *BlobViewService) Shutdown() {
	close(s.stopCh)

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
	focus := request.Focus
	if focus != models.BlobViewFocusEnd {
		focus = models.BlobViewFocusStart
	}

	blobClient, blobSize, contentType, err := s.newBlobClient(
		ctx,
		request.AccountName,
		request.ContainerName,
		request.BlobName,
	)
	if err != nil {
		return nil, err
	}

	tempFile, err := s.openTempFile()
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer tempFile.Close()

	if err := tempFile.Truncate(blobSize); err != nil {
		_ = os.Remove(tempFile.Name())
		return nil, fmt.Errorf("failed to prepare temp file: %w", err)
	}

	session := &blobViewSession{
		id:               fmt.Sprintf("blob-view-%d", s.now().UnixNano()),
		accountName:      request.AccountName,
		containerName:    request.ContainerName,
		blobName:         request.BlobName,
		focus:            focus,
		filePath:         tempFile.Name(),
		blobSize:         blobSize,
		contentType:      contentType,
		lineStarts:       makeInitialLineStarts(blobSize),
		lastAccess:       s.now(),
		tailPreviewLines: nil,
	}

	if blobSize == 0 {
		session.indexedBytes = 0
		session.isComplete = true
	} else if focus == models.BlobViewFocusEnd && blobSize > largeBlobThresholdBytes {
		tailStart := maxInt64(blobSize-defaultBlobChunkSizeBytes, 0)
		tailData, err := downloadBlobRange(
			ctx,
			blobClient,
			request.ContainerName,
			request.BlobName,
			tailStart,
			blobSize-tailStart,
		)
		if err != nil {
			_ = os.Remove(session.filePath)
			return nil, err
		}
		if err := writeBlobRange(session.filePath, tailStart, tailData); err != nil {
			_ = os.Remove(session.filePath)
			return nil, err
		}

		session.bytesDownloaded = int64(len(tailData))
		session.tailPreviewLines = buildTailPreviewLines(string(tailData), tailStart > 0)
	}

	s.mu.Lock()
	s.sessions[session.id] = session
	s.mu.Unlock()

	if !session.isComplete {
		go s.downloadSession(session)
	}

	return s.statusForSession(session), nil
}

func (s *BlobViewService) GetStatus(sessionID string) (*models.BlobViewSessionStatus, error) {
	session, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
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
	totalLines := session.indexedLineCountLocked()
	indexedBytes := session.indexedBytes
	lineStarts := append([]int64(nil), session.lineStarts...)
	isComplete := session.isComplete
	filePath := session.filePath
	session.mu.Unlock()

	if lineCount <= 0 {
		lineCount = 1
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
	lines, err := readLinesWindow(filePath, lineStarts, startLine, endLine, indexedBytes, session.blobSize, isComplete)
	if err != nil {
		return nil, err
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
	totalLines := session.indexedLineCountLocked()
	indexedBytes := session.indexedBytes
	lineStarts := append([]int64(nil), session.lineStarts...)
	isSessionComplete := session.isComplete
	filePath := session.filePath
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
	for lineNumber := request.Cursor; lineNumber < totalLines; lineNumber++ {
		line, err := readSingleLine(filePath, lineStarts, lineNumber, indexedBytes, session.blobSize, isSessionComplete)
		if err != nil {
			return nil, err
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
	isComplete := session.isComplete
	blobName := session.blobName
	filePath := session.filePath
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

	source, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open cached blob: %w", err)
	}
	defer source.Close()

	target, err := os.Create(selectedPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create export file: %w", err)
	}
	defer target.Close()

	if _, err := io.Copy(target, source); err != nil {
		return nil, fmt.Errorf("failed to export blob content: %w", err)
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
	ctx := context.Background()
	blobClient, _, _, err := s.newBlobClient(ctx, session.accountName, session.containerName, session.blobName)
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
		data, err := downloadBlobRange(
			ctx,
			blobClient,
			session.containerName,
			session.blobName,
			offset,
			count,
		)
		if err != nil {
			s.failSession(session, err)
			return
		}
		if err := writeBlobRange(session.filePath, offset, data); err != nil {
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
) (*azblob.Client, int64, string, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, 0, "", err
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", accountName)
	client, err := azblob.NewClient(serviceURL, cred, nil)
	if err != nil {
		return nil, 0, "", fmt.Errorf("failed to create blob client: %w", err)
	}

	props, err := client.ServiceClient().NewContainerClient(containerName).NewBlobClient(blobName).GetProperties(ctx, nil)
	if err != nil {
		return nil, 0, "", fmt.Errorf("failed to get blob properties: %w", err)
	}

	return client, derefInt64(props.ContentLength), derefStr(props.ContentType), nil
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
	if !session.isComplete {
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
		CanEnableWordWrap: session.isComplete,
		HasPendingBefore:  hasPendingBefore,
		HasPendingAfter:   hasPendingAfter,
		ErrorMessage:      session.errorMessage,
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

	session.errorMessage = err.Error()
	session.lastAccess = s.now()
}

func (s *BlobViewService) closeSession(session *blobViewSession) {
	session.mu.Lock()
	if session.closed {
		session.mu.Unlock()
		return
	}
	session.closed = true
	filePath := session.filePath
	session.mu.Unlock()

	_ = os.Remove(filePath)
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

func downloadBlobRange(
	ctx context.Context,
	client *azblob.Client,
	containerName string,
	blobName string,
	offset int64,
	count int64,
) ([]byte, error) {
	resp, err := client.DownloadStream(ctx, containerName, blobName, &azblob.DownloadStreamOptions{
		Range: azblob.HTTPRange{
			Offset: offset,
			Count:  count,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download blob chunk: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read blob chunk: %w", err)
	}
	return data, nil
}

func writeBlobRange(filePath string, offset int64, data []byte) error {
	file, err := os.OpenFile(filePath, os.O_WRONLY, 0)
	if err != nil {
		return fmt.Errorf("failed to open temp file: %w", err)
	}
	defer file.Close()

	if _, err := file.WriteAt(data, offset); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}
	return nil
}

func rebuildFullIndex(session *blobViewSession) error {
	file, err := os.Open(session.filePath)
	if err != nil {
		return fmt.Errorf("failed to open cached blob: %w", err)
	}
	defer file.Close()

	lineStarts := makeInitialLineStarts(session.blobSize)
	buffer := make([]byte, 64*1024)
	var offset int64
	for {
		readCount, readErr := file.Read(buffer)
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
			return fmt.Errorf("failed to rebuild blob index: %w", readErr)
		}
	}

	session.mu.Lock()
	session.lineStarts = lineStarts
	session.indexedBytes = session.blobSize
	session.mu.Unlock()

	return nil
}

func readLinesWindow(
	filePath string,
	lineStarts []int64,
	startLine int64,
	endLine int64,
	indexedBytes int64,
	blobSize int64,
	isComplete bool,
) ([]models.BlobViewLine, error) {
	lines := make([]models.BlobViewLine, 0, endLine-startLine)
	for lineNumber := startLine; lineNumber < endLine; lineNumber++ {
		content, err := readSingleLine(filePath, lineStarts, lineNumber, indexedBytes, blobSize, isComplete)
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
	filePath string,
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

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open cached blob: %w", err)
	}
	defer file.Close()

	buffer := make([]byte, length)
	if _, err := file.ReadAt(buffer, startOffset); err != nil && err != io.EOF {
		return "", fmt.Errorf("failed to read cached blob: %w", err)
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
