package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

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
