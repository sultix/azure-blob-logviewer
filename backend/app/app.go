package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/services"
)

type App struct {
	ctx              context.Context
	version          string
	logDirectory     string
	openLogDirectory func(string) error
	logs             *services.LogsService
	azureAuth        *services.AzureAuthService
	azureRes         *services.AzureResourceService
	blobView         *services.BlobViewService
	files            *services.ConnectionsFileService
}

func New(version, logDirectory string) *App {
	authSvc := services.NewAzureAuthService()
	return &App{
		version:          version,
		logDirectory:     logDirectory,
		openLogDirectory: openDirectory,
		logs:             services.NewLogsService(),
		azureAuth:        authSvc,
		azureRes:         services.NewAzureResourceService(authSvc),
		blobView:         services.NewBlobViewService(authSvc),
		files:            services.NewConnectionsFileService(),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.azureAuth.SetContext(ctx)
	log.Printf("wails application startup complete")
}

func (a *App) Shutdown(ctx context.Context) {
	log.Printf("wails application shutdown requested")
	a.blobView.Shutdown()
}

func (a *App) GetVersion() string {
	return a.version
}

func (a *App) OpenLogsDirectory() error {
	if a.logDirectory == "" {
		return fmt.Errorf("application log directory is unavailable")
	}

	directory, err := filepath.Abs(a.logDirectory)
	if err != nil {
		return fmt.Errorf("resolve application log directory: %w", err)
	}
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return fmt.Errorf("create application log directory: %w", err)
	}

	log.Printf("open application log directory requested")
	if a.openLogDirectory == nil {
		return fmt.Errorf("application log directory opener is unavailable")
	}
	if err := a.openLogDirectory(directory); err != nil {
		log.Printf("open application log directory failed: %v", err)
		return fmt.Errorf("failed to open application log directory")
	}
	log.Printf("open application log directory completed")
	return nil
}

// --- Log entries ---------------------------------------------------------

func (a *App) ListLogEntries() ([]models.LogEntry, error) {
	return a.logs.List(a.ctx)
}

func (a *App) GetLogEntry(id string) (*models.LogEntry, error) {
	if id == "" {
		return nil, fmt.Errorf("log entry id is required")
	}
	return a.logs.Get(a.ctx, id)
}

// --- Azure authentication ------------------------------------------------

func (a *App) StartAzureLogin() (*models.AzureAuthState, error) {
	return a.azureAuth.Login(a.ctx)
}

func (a *App) RestoreAzureSession() *models.AzureAuthState {
	return a.azureAuth.RestoreSession(a.ctx)
}

func (a *App) AzureLogout() error {
	a.blobView.CloseAllSessions()
	a.azureAuth.Logout()
	return nil
}

func (a *App) GetAzureAuthState() *models.AzureAuthState {
	return a.azureAuth.GetAuthState()
}

// --- Azure resources -----------------------------------------------------

func (a *App) ListSubscriptions() ([]models.AzureSubscription, error) {
	return a.azureRes.ListSubscriptions(a.ctx)
}

func (a *App) ListStorageAccounts(subscriptionID string) ([]models.AzureStorageAccount, error) {
	if subscriptionID == "" {
		return nil, fmt.Errorf("subscription ID is required")
	}
	return a.azureRes.ListStorageAccounts(a.ctx, subscriptionID)
}

func (a *App) ListContainers(subscriptionID, resourceGroup, accountName string) ([]models.AzureContainer, error) {
	if subscriptionID == "" {
		return nil, fmt.Errorf("subscription ID is required")
	}
	if resourceGroup == "" {
		return nil, fmt.Errorf("resource group is required")
	}
	if accountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	return a.azureRes.ListContainers(a.ctx, subscriptionID, resourceGroup, accountName)
}

func (a *App) ListBlobs(accountName, containerName, prefix string, includeDeleted bool) ([]models.AzureBlobItem, error) {
	if accountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	if containerName == "" {
		return nil, fmt.Errorf("container name is required")
	}
	return a.azureRes.ListBlobs(a.ctx, accountName, containerName, prefix, includeDeleted)
}

func (a *App) ResolveDeletedBlobVersion(request models.AzureBlobIdentityRequest) (*models.AzureBlobItem, error) {
	if request.AccountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	if request.ContainerName == "" {
		return nil, fmt.Errorf("container name is required")
	}
	if request.BlobName == "" {
		return nil, fmt.Errorf("blob name is required")
	}
	return a.azureRes.ResolveDeletedBlobVersion(a.ctx, request)
}

func (a *App) ReadBlobTextChunk(request models.AzureBlobTextChunkRequest) (*models.AzureBlobTextChunk, error) {
	if request.AccountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	if request.ContainerName == "" {
		return nil, fmt.Errorf("container name is required")
	}
	if request.BlobName == "" {
		return nil, fmt.Errorf("blob name is required")
	}
	if err := validateVersionID(request.VersionID); err != nil {
		return nil, err
	}
	return a.azureRes.ReadBlobTextChunk(a.ctx, request)
}

func (a *App) RestoreBlob(request models.RestoreAzureBlobRequest) error {
	if request.AccountName == "" {
		return fmt.Errorf("account name is required")
	}
	if request.ContainerName == "" {
		return fmt.Errorf("container name is required")
	}
	if request.BlobName == "" {
		return fmt.Errorf("blob name is required")
	}
	return a.azureRes.RestoreBlob(a.ctx, request)
}

func (a *App) OpenBlobViewSession(request models.OpenBlobViewSessionRequest) (*models.BlobViewSessionStatus, error) {
	if request.AccountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	if request.ContainerName == "" {
		return nil, fmt.Errorf("container name is required")
	}
	if request.BlobName == "" {
		return nil, fmt.Errorf("blob name is required")
	}
	if err := validateVersionID(request.VersionID); err != nil {
		return nil, err
	}
	if request.Mode == "" {
		request.Mode = models.BlobViewModeSnapshot
	}
	if request.Mode == models.BlobViewModeLive {
		log.Printf(
			"blob viewer live session open requested has_version=%t",
			request.VersionID != "",
		)
	}

	status, err := a.blobView.OpenSession(a.ctx, request)
	if err != nil {
		log.Printf("blob viewer session open failed requested_mode=%s error=%v", request.Mode, err)
		return nil, err
	}
	if request.Mode == models.BlobViewModeLive || status.Mode == models.BlobViewModeLive {
		log.Printf(
			"blob viewer session opened session_id=%s requested_mode=%s actual_mode=%s blob_size=%d indexed_lines=%d complete=%t failure_reason=%q",
			status.SessionID,
			request.Mode,
			status.Mode,
			status.BlobSize,
			status.IndexedLineCount,
			status.IsComplete,
			status.FailureReason,
		)
	}
	return status, nil
}

func validateVersionID(versionID string) error {
	if len(versionID) > 256 {
		return fmt.Errorf("version id exceeds the supported length")
	}
	if strings.ContainsAny(versionID, "\r\n") {
		return fmt.Errorf("version id contains invalid characters")
	}
	return nil
}

func (a *App) GetBlobViewStatus(sessionID string) (*models.BlobViewSessionStatus, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("session id is required")
	}
	return a.blobView.GetStatus(sessionID)
}

func (a *App) SetBlobViewSessionMode(
	sessionID string,
	mode models.BlobViewMode,
) (*models.BlobViewSessionStatus, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("session id is required")
	}
	if mode == "" {
		mode = models.BlobViewModeSnapshot
	}
	log.Printf(
		"blob viewer mode change requested session_id=%s requested_mode=%s",
		sessionID,
		mode,
	)

	status, err := a.blobView.SetSessionMode(sessionID, mode)
	if err != nil {
		log.Printf(
			"blob viewer mode change failed session_id=%s requested_mode=%s error=%v",
			sessionID,
			mode,
			err,
		)
		return nil, err
	}
	log.Printf(
		"blob viewer mode change completed session_id=%s requested_mode=%s actual_mode=%s blob_size=%d bytes_downloaded=%d indexed_lines=%d complete=%t failure_reason=%q",
		status.SessionID,
		mode,
		status.Mode,
		status.BlobSize,
		status.BytesDownloaded,
		status.IndexedLineCount,
		status.IsComplete,
		status.FailureReason,
	)
	return status, nil
}

func (a *App) GetBlobViewLines(sessionID string, startLine, lineCount int64) (*models.BlobViewLinesResponse, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("session id is required")
	}
	return a.blobView.GetLines(sessionID, startLine, lineCount)
}

func (a *App) SearchBlobView(request models.BlobViewSearchRequest) (*models.BlobViewSearchResponse, error) {
	if request.SessionID == "" {
		return nil, fmt.Errorf("session id is required")
	}
	return a.blobView.Search(request)
}

func (a *App) ExportBlobViewSession(sessionID string) (*models.BlobViewExportResult, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("session id is required")
	}
	return a.blobView.Export(a.ctx, sessionID)
}

func (a *App) CloseBlobViewSession(sessionID string) error {
	if sessionID == "" {
		return fmt.Errorf("session id is required")
	}
	log.Printf("blob viewer session close requested session_id=%s", sessionID)
	return a.blobView.CloseSession(sessionID)
}

func (a *App) ImportConnectionsFile() (*models.ConnectionsImportResult, error) {
	return a.files.Import(a.ctx)
}

func (a *App) ExportConnectionsFile(content string) (*models.ConnectionsExportResult, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("connections content is required")
	}
	return a.files.Export(a.ctx, content)
}
