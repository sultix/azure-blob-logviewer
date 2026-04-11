package app

import (
	"context"
	"fmt"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/services"
)

type App struct {
	ctx  context.Context
	logs *services.LogsService
}

func New() *App {
	return &App{
		logs: services.NewLogsService(),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetVersion() string {
	return "0.1.0"
}

func (a *App) ListLogEntries() ([]models.LogEntry, error) {
	return a.logs.List(a.ctx)
}

func (a *App) GetLogEntry(id string) (*models.LogEntry, error) {
	if id == "" {
		return nil, fmt.Errorf("log entry id is required")
	}
	return a.logs.Get(a.ctx, id)
}
