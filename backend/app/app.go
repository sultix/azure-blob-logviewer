package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/services"
)

type App struct {
	ctx       context.Context
	logs      *services.LogsService
	azureAuth *services.AzureAuthService
	azureRes  *services.AzureResourceService
	blobView  *services.BlobViewService
	files     *services.ConnectionsFileService
}

func New() *App {
	authSvc := services.NewAzureAuthService()
	return &App{
		logs:      services.NewLogsService(),
		azureAuth: authSvc,
		azureRes:  services.NewAzureResourceService(authSvc),
		blobView:  services.NewBlobViewService(authSvc),
		files:     services.NewConnectionsFileService(),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.azureAuth.SetContext(ctx)
}

func (a *App) Shutdown(ctx context.Context) {
	a.blobView.Shutdown()
}

func (a *App) GetVersion() string {
	return "1.0.0"
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

func (a *App) ListBlobs(accountName, containerName, prefix string) ([]models.AzureBlobItem, error) {
	if accountName == "" {
		return nil, fmt.Errorf("account name is required")
	}
	if containerName == "" {
		return nil, fmt.Errorf("container name is required")
	}
	return a.azureRes.ListBlobs(a.ctx, accountName, containerName, prefix)
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
	return a.azureRes.ReadBlobTextChunk(a.ctx, request)
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
	if request.Mode == "" {
		request.Mode = models.BlobViewModeSnapshot
	}
	return a.blobView.OpenSession(a.ctx, request)
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
	return a.blobView.SetSessionMode(sessionID, mode)
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
