package services

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestConnectionsFileServiceImportReadsSelectedFile(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "connections.json")
	if err := os.WriteFile(filePath, []byte("[{\"id\":\"conn-1\"}]"), 0o600); err != nil {
		t.Fatalf("expected test file to be written, got %v", err)
	}

	service := NewConnectionsFileService()
	service.openFileDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) {
		return filePath, nil
	}

	result, err := service.Import(context.Background())
	if err != nil {
		t.Fatalf("expected import to succeed, got %v", err)
	}
	if result.Cancelled {
		t.Fatal("expected import result to not be cancelled")
	}
	if result.Content != "[{\"id\":\"conn-1\"}]" {
		t.Fatalf("expected file content to be returned, got %q", result.Content)
	}
}

func TestConnectionsFileServiceImportReturnsCancelledWhenDialogIsClosed(t *testing.T) {
	service := NewConnectionsFileService()
	service.openFileDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) {
		return "", nil
	}

	result, err := service.Import(context.Background())
	if err != nil {
		t.Fatalf("expected cancelled import to succeed, got %v", err)
	}
	if !result.Cancelled {
		t.Fatal("expected cancelled import result")
	}
	if result.Content != "" {
		t.Fatalf("expected cancelled import to return empty content, got %q", result.Content)
	}
}

func TestConnectionsFileServiceImportReturnsSafeErrorOnReadFailure(t *testing.T) {
	service := NewConnectionsFileService()
	service.openFileDialog = func(context.Context, runtime.OpenDialogOptions) (string, error) {
		return "/missing/connections.json", nil
	}
	service.readFile = func(string) ([]byte, error) {
		return nil, errors.New("permission denied")
	}

	_, err := service.Import(context.Background())
	if !errors.Is(err, ErrConnectionsImportFailed) {
		t.Fatalf("expected safe import error, got %v", err)
	}
}

func TestConnectionsFileServiceExportWritesSelectedFile(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "connections.json")

	service := NewConnectionsFileService()
	service.saveFileDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) {
		return filePath, nil
	}

	result, err := service.Export(context.Background(), "[\n  {}\n]")
	if err != nil {
		t.Fatalf("expected export to succeed, got %v", err)
	}
	if result.Cancelled {
		t.Fatal("expected export result to not be cancelled")
	}

	data, readErr := os.ReadFile(filePath)
	if readErr != nil {
		t.Fatalf("expected exported file to be readable, got %v", readErr)
	}
	if string(data) != "[\n  {}\n]" {
		t.Fatalf("expected exported content to match, got %q", string(data))
	}
}

func TestConnectionsFileServiceExportReturnsCancelledWhenDialogIsClosed(t *testing.T) {
	service := NewConnectionsFileService()
	service.saveFileDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) {
		return "", nil
	}

	result, err := service.Export(context.Background(), "[]")
	if err != nil {
		t.Fatalf("expected cancelled export to succeed, got %v", err)
	}
	if !result.Cancelled {
		t.Fatal("expected cancelled export result")
	}
}

func TestConnectionsFileServiceExportReturnsSafeErrorOnWriteFailure(t *testing.T) {
	service := NewConnectionsFileService()
	service.saveFileDialog = func(context.Context, runtime.SaveDialogOptions) (string, error) {
		return "/missing/connections.json", nil
	}
	service.writeFile = func(string, []byte, os.FileMode) error {
		return errors.New("disk full")
	}

	_, err := service.Export(context.Background(), "[]")
	if !errors.Is(err, ErrConnectionsExportFailed) {
		t.Fatalf("expected safe export error, got %v", err)
	}
}
