package app

import (
	"context"
	"fmt"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/services"
)

type App struct {
	ctx       context.Context
	logs      *services.LogsService
	azureAuth *services.AzureAuthService
	azureRes  *services.AzureResourceService
}

func New() *App {
	authSvc := services.NewAzureAuthService()
	return &App{
		logs:      services.NewLogsService(),
		azureAuth: authSvc,
		azureRes:  services.NewAzureResourceService(authSvc),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.azureAuth.SetContext(ctx)
}

func (a *App) GetVersion() string {
	return "0.1.0"
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

func (a *App) DownloadBlobContent(accountName, containerName, blobName string) (string, error) {
	if accountName == "" {
		return "", fmt.Errorf("account name is required")
	}
	if containerName == "" {
		return "", fmt.Errorf("container name is required")
	}
	if blobName == "" {
		return "", fmt.Errorf("blob name is required")
	}
	return a.azureRes.DownloadBlobContent(a.ctx, accountName, containerName, blobName)
}
