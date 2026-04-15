package services

import (
	"context"
	"errors"
	"os"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	ErrConnectionsImportFailed = errors.New("failed to import connections file")
	ErrConnectionsExportFailed = errors.New("failed to export connections file")
)

const connectionsExportFilename = "azure-blob-logviewer-connections.json"

type ConnectionsFileService struct {
	openFileDialog func(context.Context, runtime.OpenDialogOptions) (string, error)
	saveFileDialog func(context.Context, runtime.SaveDialogOptions) (string, error)
	readFile       func(string) ([]byte, error)
	writeFile      func(string, []byte, os.FileMode) error
}

func NewConnectionsFileService() *ConnectionsFileService {
	return &ConnectionsFileService{
		openFileDialog: runtime.OpenFileDialog,
		saveFileDialog: runtime.SaveFileDialog,
		readFile:       os.ReadFile,
		writeFile:      os.WriteFile,
	}
}

func (s *ConnectionsFileService) Import(ctx context.Context) (*models.ConnectionsImportResult, error) {
	selectedPath, err := s.openFileDialog(ctx, runtime.OpenDialogOptions{
		Title: "Import Connections JSON",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
		},
	})
	if err != nil {
		return nil, ErrConnectionsImportFailed
	}
	if selectedPath == "" {
		return &models.ConnectionsImportResult{Cancelled: true}, nil
	}

	content, err := s.readFile(selectedPath)
	if err != nil {
		return nil, ErrConnectionsImportFailed
	}

	return &models.ConnectionsImportResult{
		Cancelled: false,
		Content:   string(content),
	}, nil
}

func (s *ConnectionsFileService) Export(ctx context.Context, content string) (*models.ConnectionsExportResult, error) {
	selectedPath, err := s.saveFileDialog(ctx, runtime.SaveDialogOptions{
		Title:                "Export Connections JSON",
		DefaultFilename:      connectionsExportFilename,
		CanCreateDirectories: true,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files (*.json)",
				Pattern:     "*.json",
			},
		},
	})
	if err != nil {
		return nil, ErrConnectionsExportFailed
	}
	if selectedPath == "" {
		return &models.ConnectionsExportResult{Cancelled: true}, nil
	}

	if err := s.writeFile(selectedPath, []byte(content), 0o600); err != nil {
		return nil, ErrConnectionsExportFailed
	}

	return &models.ConnectionsExportResult{Cancelled: false}, nil
}
