package services

import (
	"context"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

type LogsService struct{}

func NewLogsService() *LogsService {
	return &LogsService{}
}

func (s *LogsService) List(ctx context.Context) ([]models.LogEntry, error) {
	return []models.LogEntry{}, nil
}

func (s *LogsService) Get(ctx context.Context, id string) (*models.LogEntry, error) {
	return nil, nil
}
