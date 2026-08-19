package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

func TestBlobViewServiceOpenSessionRejectsOversizedBlobs(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return fakeBlobViewClient{}, blobViewMaxBlobBytes + 1, "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "oversized.log",
		Mode:          models.BlobViewModeSnapshot,
	})
	if err != nil {
		t.Fatalf("expected oversized blob to return failure status, got error: %v", err)
	}
	if status.FailureReason != string(models.BlobFailureReasonTooLarge) {
		t.Fatalf("expected too_large failure reason, got %q", status.FailureReason)
	}
	if status.SessionID != "" {
		t.Fatalf("expected no session to be created, got %q", status.SessionID)
	}
}

func TestBlobViewServiceOpensVersionedBlobAsSnapshot(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		t.Fatal("expected the versioned blob client to be used")
		return nil, 0, "", nil
	}
	var capturedVersionID string
	service.createVersionedBlobClient = func(
		_ context.Context,
		_, _, _ string,
		versionID string,
	) (blobViewBlobClient, int64, string, error) {
		capturedVersionID = versionID
		return fakeBlobViewClient{}, 0, "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "deleted.log",
		VersionID:     "2026-08-17T10:00:00.0000000Z",
		Mode:          models.BlobViewModeLive,
	})
	if err != nil {
		t.Fatalf("expected versioned session to open, got %v", err)
	}
	if capturedVersionID != "2026-08-17T10:00:00.0000000Z" {
		t.Fatalf("unexpected version id %q", capturedVersionID)
	}
	if status.Mode != models.BlobViewModeSnapshot {
		t.Fatalf("expected versioned session to use snapshot mode, got %q", status.Mode)
	}
}

func TestBlobViewServiceOpenSessionRejectsWhenSessionLimitIsReached(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return fakeBlobViewClient{}, 128, "text/plain", nil
	}

	for index := 0; index < blobViewMaxConcurrentSessions; index++ {
		status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
			AccountName:   "storage-a",
			ContainerName: "logs",
			BlobName:      fmt.Sprintf("file-%d.log", index),
			Mode:          models.BlobViewModeSnapshot,
		})
		if err != nil {
			t.Fatalf("expected session %d to open successfully, got %v", index, err)
		}
		if status.FailureReason != "" {
			t.Fatalf("expected session %d to be created successfully, got failure %q", index, status.FailureReason)
		}
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "overflow.log",
		Mode:          models.BlobViewModeSnapshot,
	})
	if err != nil {
		t.Fatalf("expected session limit to return failure status, got error: %v", err)
	}
	if status.FailureReason != string(models.BlobFailureReasonLimitExceeded) {
		t.Fatalf("expected limit_exceeded failure, got %q", status.FailureReason)
	}
}

func TestBlobViewServiceOpenSessionRejectsWhenTempQuotaIsExceeded(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return fakeBlobViewClient{}, 2, "text/plain", nil
	}

	service.reservedTempBytes = blobViewMaxAggregateTempBytes - 1

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "quota.log",
		Mode:          models.BlobViewModeSnapshot,
	})
	if err != nil {
		t.Fatalf("expected temp quota failure to be returned as status, got error: %v", err)
	}
	if status.FailureReason != string(models.BlobFailureReasonLimitExceeded) {
		t.Fatalf("expected limit_exceeded failure, got %q", status.FailureReason)
	}
}

func TestBlobViewServiceCloseSessionRemovesTempFileAndReleasesQuota(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return fakeBlobViewClient{}, 64, "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "cleanup.log",
		Mode:          models.BlobViewModeSnapshot,
	})
	if err != nil {
		t.Fatalf("expected cleanup session to open successfully, got %v", err)
	}

	session, err := service.getSession(status.SessionID)
	if err != nil {
		t.Fatalf("expected session to exist, got %v", err)
	}
	filePath := session.filePath

	if err := service.CloseSession(status.SessionID); err != nil {
		t.Fatalf("expected close session to succeed, got %v", err)
	}

	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Fatalf("expected temp file to be removed, stat error: %v", err)
	}
	if service.reservedTempBytes != 0 {
		t.Fatalf("expected reserved temp bytes to be released, got %d", service.reservedTempBytes)
	}
}

func TestBlobViewServiceSearchUsesOpenFileHandleAndBoundsScanWork(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	tempFile, err := os.CreateTemp("", "blob-view-search-*.tmp")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	content := strings.Repeat("line without match\n", blobViewSearchScanLineLimit+50)
	if _, err := tempFile.WriteString(content); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	session := &blobViewSession{
		id:           "session-1",
		file:         tempFile,
		filePath:     filepath.Join(os.TempDir(), "does-not-exist.log"),
		blobSize:     int64(len(content)),
		indexedBytes: int64(len(content)),
		lineStarts:   collectLineStarts(content),
		isComplete:   true,
		lastAccess:   service.now(),
	}
	service.sessions[session.id] = session

	response, err := service.Search(models.BlobViewSearchRequest{
		SessionID: session.id,
		Query:     "missing",
		Cursor:    0,
	})
	if err != nil {
		t.Fatalf("expected search to succeed with open file handle, got %v", err)
	}
	if len(response.Matches) != 0 {
		t.Fatalf("expected no matches, got %d", len(response.Matches))
	}
	if response.NextCursor != blobViewSearchScanLineLimit {
		t.Fatalf("expected search to stop at cursor %d, got %d", blobViewSearchScanLineLimit, response.NextCursor)
	}
	if response.IsComplete {
		t.Fatal("expected bounded search to report incomplete results")
	}
}

func TestBlobViewServiceGetLinesReadsLineWindowsFromSharedBlock(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	content := "first line\r\nsecond line\n\nfourth line\nlast line without break"
	session := newFileBackedTestSession(t, service, content)
	service.sessions[session.id] = session

	response, err := service.GetLines(session.id, 0, 10)
	if err != nil {
		t.Fatalf("expected lines to load, got %v", err)
	}

	expected := []string{
		"first line",
		"second line",
		"",
		"fourth line",
		"last line without break",
	}
	if len(response.Lines) != len(expected) {
		t.Fatalf("expected %d lines, got %d (%+v)", len(expected), len(response.Lines), response.Lines)
	}
	for index, want := range expected {
		if response.Lines[index].Content != want {
			t.Fatalf("line %d: expected %q, got %q", index, want, response.Lines[index].Content)
		}
		if response.Lines[index].LineNumber != int64(index) {
			t.Fatalf("line %d: expected line number %d, got %d", index, index, response.Lines[index].LineNumber)
		}
	}

	windowed, err := service.GetLines(session.id, 3, 2)
	if err != nil {
		t.Fatalf("expected windowed lines to load, got %v", err)
	}
	if len(windowed.Lines) != 2 {
		t.Fatalf("expected 2 windowed lines, got %d", len(windowed.Lines))
	}
	if windowed.Lines[0].Content != "fourth line" || windowed.Lines[0].LineNumber != 3 {
		t.Fatalf("expected window to start at line 3, got %+v", windowed.Lines[0])
	}
}

func TestBlobViewServiceSearchMatchesAcrossReadBlocks(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	var builder strings.Builder
	matchingLines := []int64{0, blobViewSearchReadBlockLines - 1, blobViewSearchReadBlockLines + 3}
	for index := int64(0); index < blobViewSearchReadBlockLines+10; index++ {
		if index == matchingLines[0] || index == matchingLines[1] || index == matchingLines[2] {
			builder.WriteString("Contains NEEDLE token\n")
			continue
		}
		builder.WriteString("plain line\n")
	}

	session := newFileBackedTestSession(t, service, builder.String())
	service.sessions[session.id] = session

	response, err := service.Search(models.BlobViewSearchRequest{
		SessionID: session.id,
		Query:     "needle",
		Cursor:    0,
	})
	if err != nil {
		t.Fatalf("expected search to succeed, got %v", err)
	}
	if len(response.Matches) != len(matchingLines) {
		t.Fatalf("expected %d matches, got %d (%+v)", len(matchingLines), len(response.Matches), response.Matches)
	}
	for index, want := range matchingLines {
		if response.Matches[index].LineNumber != want {
			t.Fatalf("match %d: expected line %d, got %d", index, want, response.Matches[index].LineNumber)
		}
		if response.Matches[index].Preview != "Contains NEEDLE token" {
			t.Fatalf("match %d: expected preview to keep original casing, got %q", index, response.Matches[index].Preview)
		}
	}
	if !response.IsComplete {
		t.Fatal("expected search over a complete session to report completion")
	}
}

func TestBlobViewServiceSearchIsCaseInsensitiveBeyondASCII(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	session := newFileBackedTestSession(t, service, "STRASSE ÜBERLAST\nunrelated line\n")
	service.sessions[session.id] = session

	response, err := service.Search(models.BlobViewSearchRequest{
		SessionID: session.id,
		Query:     "überlast",
		Cursor:    0,
	})
	if err != nil {
		t.Fatalf("expected search to succeed, got %v", err)
	}
	if len(response.Matches) != 1 || response.Matches[0].LineNumber != 0 {
		t.Fatalf("expected a single match on line 0, got %+v", response.Matches)
	}
}

func TestBlobViewServiceGetLinesToleratesConcurrentIndexGrowth(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	session := newFileBackedTestSession(t, service, "line one\nline two\n")
	service.sessions[session.id] = session

	// A reader holding the index snapshot must stay consistent while the
	// downloader keeps appending offsets.
	session.mu.Lock()
	snapshot := session.lineStartsSnapshotLocked()
	session.mu.Unlock()

	session.mu.Lock()
	appendLineStartsLocked(session, session.indexedBytes, []byte("line three\n"))
	session.mu.Unlock()

	expectedOffsets := []int64{0, int64(len("line one\n")), int64(len("line one\nline two\n"))}
	if len(snapshot) != len(expectedOffsets) {
		t.Fatalf("expected snapshot to keep its original length %d, got %d", len(expectedOffsets), len(snapshot))
	}
	for index, want := range expectedOffsets {
		if snapshot[index] != want {
			t.Fatalf("offset %d: expected snapshot to stay stable at %d, got %d", index, want, snapshot[index])
		}
	}
}

func newFileBackedTestSession(t *testing.T, service *BlobViewService, content string) *blobViewSession {
	t.Helper()

	tempFile, err := os.CreateTemp("", "blob-view-lines-*.tmp")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	t.Cleanup(func() {
		tempFile.Close()
		os.Remove(tempFile.Name())
	})

	if _, err := tempFile.WriteString(content); err != nil {
		t.Fatalf("failed to write temp file: %v", err)
	}

	return &blobViewSession{
		id:           fmt.Sprintf("session-%s", t.Name()),
		file:         tempFile,
		filePath:     tempFile.Name(),
		blobSize:     int64(len(content)),
		indexedBytes: int64(len(content)),
		lineStarts:   collectLineStarts(content),
		isComplete:   true,
		lastAccess:   service.now(),
	}
}

func TestBlobViewServiceFailSessionSanitizesErrorMessages(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	session := &blobViewSession{
		id:         "session-1",
		blobName:   "app.log",
		focus:      models.BlobViewFocusStart,
		lastAccess: service.now(),
	}

	service.failSession(session, fmt.Errorf("download failed for /tmp/blob-view/app.log"))
	status := service.statusForSession(session)

	if status.FailureReason != string(models.BlobFailureReasonDownloadFailed) {
		t.Fatalf("expected download_failed reason, got %q", status.FailureReason)
	}
	if strings.Contains(status.ErrorMessage, "/tmp/blob-view") {
		t.Fatalf("expected sanitized error message, got %q", status.ErrorMessage)
	}
	if status.ErrorMessage == "" {
		t.Fatal("expected sanitized error message to be set")
	}
}

func TestBlobViewServiceSetSessionModeReusesExistingSession(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	client := newMemoryBlobViewClient(buildLargeBlobContent("prefix line\n", defaultBlobChunkSizeBytes+4_096))
	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return client, client.Size(), "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "reused.log",
		Mode:          models.BlobViewModeSnapshot,
	})
	if err != nil {
		t.Fatalf("expected snapshot session to open successfully, got %v", err)
	}

	liveStatus, err := service.SetSessionMode(status.SessionID, models.BlobViewModeLive)
	if err != nil {
		t.Fatalf("expected mode switch to live to succeed, got %v", err)
	}
	if liveStatus.SessionID != status.SessionID {
		t.Fatalf("expected mode switch to reuse session %q, got %q", status.SessionID, liveStatus.SessionID)
	}
	if liveStatus.Mode != models.BlobViewModeLive {
		t.Fatalf("expected live mode after switch, got %q", liveStatus.Mode)
	}

	session, err := service.getSession(status.SessionID)
	if err != nil {
		t.Fatalf("expected reused session to exist, got %v", err)
	}
	if session.file == nil {
		t.Fatal("expected live mode to keep a temp file-backed session")
	}

	snapshotStatus, err := service.SetSessionMode(status.SessionID, models.BlobViewModeSnapshot)
	if err != nil {
		t.Fatalf("expected mode switch back to snapshot to succeed, got %v", err)
	}
	if snapshotStatus.SessionID != status.SessionID {
		t.Fatalf("expected snapshot switch to keep session %q, got %q", status.SessionID, snapshotStatus.SessionID)
	}
	if snapshotStatus.Mode != models.BlobViewModeSnapshot {
		t.Fatalf("expected snapshot mode after switch, got %q", snapshotStatus.Mode)
	}
}

func TestBlobViewServiceLiveSessionAppendsNewBytesWithoutReopen(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	initialContent := buildLargeBlobContent("line before tail\n", defaultBlobChunkSizeBytes+8_192) + "tail line\n"
	client := newMemoryBlobViewClient(initialContent)
	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return client, client.Size(), "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "live.log",
		Mode:          models.BlobViewModeLive,
	})
	if err != nil {
		t.Fatalf("expected live session to open successfully, got %v", err)
	}

	waitForBlobViewCondition(t, 2*time.Second, func() bool {
		nextStatus, statusErr := service.GetStatus(status.SessionID)
		return statusErr == nil && nextStatus.IsComplete && len(nextStatus.LivePreviewLines) == 0
	})

	settledStatus, err := service.GetStatus(status.SessionID)
	if err != nil {
		t.Fatalf("expected settled live status to load successfully, got %v", err)
	}

	client.SetContent(initialContent + "new tail line\n")

	updatedStatus, err := service.GetStatus(status.SessionID)
	if err != nil {
		t.Fatalf("expected appended live status to load successfully, got %v", err)
	}
	if updatedStatus.SessionID != status.SessionID {
		t.Fatalf("expected appended data to stay in session %q, got %q", status.SessionID, updatedStatus.SessionID)
	}
	if !updatedStatus.IsComplete {
		t.Fatal("expected live session to remain complete after syncing appended bytes")
	}
	if updatedStatus.IndexedLineCount != settledStatus.IndexedLineCount+1 {
		t.Fatalf(
			"expected one appended line to be indexed (from %d), got %d",
			settledStatus.IndexedLineCount,
			updatedStatus.IndexedLineCount,
		)
	}

	// Content ending in a line break indexes a trailing empty line, so the
	// appended text sits one line above the end.
	lines, err := service.GetLines(updatedStatus.SessionID, updatedStatus.IndexedLineCount-2, 2)
	if err != nil {
		t.Fatalf("expected appended lines to load successfully, got %v", err)
	}
	if len(lines.Lines) != 2 {
		t.Fatalf("expected the last two lines, got %+v", lines.Lines)
	}
	if lines.Lines[0].Content != "new tail line" {
		t.Fatalf("expected appended content, got %+v", lines.Lines)
	}
	if lines.Lines[1].Content != "" {
		t.Fatalf("expected a trailing empty line, got %q", lines.Lines[1].Content)
	}
}

func TestBlobViewServiceLiveIndexesEveryAppendedLine(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	initialContent := "line 1\nline 2\nline 3\n"
	client := newMemoryBlobViewClient(initialContent)
	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return client, client.Size(), "text/plain", nil
	}

	status, err := service.OpenSession(context.Background(), models.OpenBlobViewSessionRequest{
		AccountName:   "storage-a",
		ContainerName: "logs",
		BlobName:      "growing.log",
		Mode:          models.BlobViewModeLive,
	})
	if err != nil {
		t.Fatalf("expected live session to open, got %v", err)
	}

	waitForBlobViewCondition(t, 2*time.Second, func() bool {
		next, statusErr := service.GetStatus(status.SessionID)
		return statusErr == nil && next.IsComplete && len(next.LivePreviewLines) == 0
	})

	settled, err := service.GetStatus(status.SessionID)
	if err != nil {
		t.Fatalf("expected settled status, got %v", err)
	}
	linesBefore := settled.IndexedLineCount

	// Two appended lines must show up as two lines, not as extra bytes glued
	// onto the previous last line.
	client.SetContent(initialContent + "line 4\nline 5\n")

	grown, err := service.GetStatus(status.SessionID)
	if err != nil {
		t.Fatalf("expected status after growth, got %v", err)
	}
	if grown.IndexedLineCount != linesBefore+2 {
		t.Fatalf("expected line count to grow by 2 (from %d), got %d", linesBefore, grown.IndexedLineCount)
	}

	lines, err := service.GetLines(status.SessionID, 0, 10)
	if err != nil {
		t.Fatalf("expected lines to load, got %v", err)
	}
	expected := []string{"line 1", "line 2", "line 3", "line 4", "line 5"}
	if int64(len(lines.Lines)) < int64(len(expected)) {
		t.Fatalf("expected at least %d lines, got %d", len(expected), len(lines.Lines))
	}
	for index, want := range expected {
		if lines.Lines[index].Content != want {
			t.Fatalf("line %d: expected %q, got %q", index, want, lines.Lines[index].Content)
		}
	}
}

func TestBlobViewServiceLiveSkipsPreviewRefetchWhileBlobIsUnchanged(t *testing.T) {
	service := NewBlobViewService(nil)
	defer service.Shutdown()

	content := buildLargeBlobContent("polled line\n", defaultBlobChunkSizeBytes*2)
	client := newMemoryBlobViewClient(content)
	service.createBlobClient = func(context.Context, string, string, string) (blobViewBlobClient, int64, string, error) {
		return client, client.Size(), "text/plain", nil
	}

	// A session parked in the preview phase: the background download has not
	// filled the file yet, which is exactly when polling used to refetch the
	// preview window on every tick.
	tempFile, err := os.CreateTemp("", "blob-view-preview-*.tmp")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	t.Cleanup(func() {
		tempFile.Close()
		os.Remove(tempFile.Name())
	})

	session := &blobViewSession{
		id:               "preview-session",
		accountName:      "storage-a",
		containerName:    "logs",
		blobName:         "idle.log",
		mode:             models.BlobViewModeLive,
		focus:            models.BlobViewFocusEnd,
		file:             tempFile,
		filePath:         tempFile.Name(),
		reservedBytes:    client.Size(),
		blobSize:         client.Size(),
		lineStarts:       makeInitialLineStarts(client.Size()),
		livePreviewLines: []string{"polled line", "polled line"},
		livePreviewStart: client.Size() - defaultBlobChunkSizeBytes,
		downloadCtx:      context.Background(),
		downloadRunning:  true, // keep startDownload from racing the assertion
		lastAccess:       service.now(),
	}
	service.sessions[session.id] = session

	downloadsBefore := client.DownloadCount()
	for index := 0; index < 5; index++ {
		if err := service.refreshLiveSession(session); err != nil {
			t.Fatalf("poll %d failed: %v", index, err)
		}
	}

	if extra := client.DownloadCount() - downloadsBefore; extra != 0 {
		t.Fatalf("expected polling an unchanged blob to download nothing, got %d downloads", extra)
	}

	// Growth must still be picked up.
	client.SetContent(content + "appended line\n")
	if err := service.refreshLiveSession(session); err != nil {
		t.Fatalf("expected growth refresh to succeed, got %v", err)
	}
	if client.DownloadCount() == downloadsBefore {
		t.Fatal("expected a grown blob to refetch the preview window")
	}
}

type fakeBlobViewClient struct{}

func (fakeBlobViewClient) DownloadRange(context.Context, string, string, int64, int64) ([]byte, error) {
	return []byte("tail line\n"), nil
}

func collectLineStarts(content string) []int64 {
	lineStarts := []int64{0}
	for index, char := range []byte(content) {
		if char == '\n' {
			lineStarts = append(lineStarts, int64(index)+1)
		}
	}
	return lineStarts
}

type memoryBlobViewClient struct {
	mu             sync.RWMutex
	content        []byte
	downloadedRuns int
}

func newMemoryBlobViewClient(content string) *memoryBlobViewClient {
	return &memoryBlobViewClient{content: []byte(content)}
}

func (c *memoryBlobViewClient) DownloadRange(
	_ context.Context,
	_ string,
	_ string,
	offset int64,
	count int64,
) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.downloadedRuns++
	startOffset := maxInt64(0, minInt64(int64(len(c.content)), offset))
	endOffset := minInt64(int64(len(c.content)), startOffset+count)
	return append([]byte(nil), c.content[startOffset:endOffset]...), nil
}

func (c *memoryBlobViewClient) DownloadCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.downloadedRuns
}

func (c *memoryBlobViewClient) Size() int64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return int64(len(c.content))
}

func (c *memoryBlobViewClient) SetContent(content string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.content = []byte(content)
}

func buildLargeBlobContent(line string, targetBytes int64) string {
	repetitions := int(targetBytes/int64(len(line))) + 1
	return strings.Repeat(line, repetitions)
}

func waitForBlobViewCondition(t *testing.T, timeout time.Duration, condition func() bool) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}

	t.Fatal("timed out waiting for blob view condition")
}
