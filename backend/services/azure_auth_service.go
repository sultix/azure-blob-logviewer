package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

// AzureAuthService manages Azure authentication via the Azure CLI credential.
// The user must have run `az login` at least once before using this app.
type AzureAuthService struct {
	mu            sync.RWMutex
	credential    azcore.TokenCredential
	authenticated bool
	wailsCtx      context.Context
}

func NewAzureAuthService() *AzureAuthService {
	return &AzureAuthService{}
}

// SetContext stores the Wails application context.
func (s *AzureAuthService) SetContext(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.wailsCtx = ctx
}

// Login attempts to authenticate using the Azure CLI credential.
// It verifies the credential by requesting a token for Azure Resource Manager.
// If az CLI is not installed or the user is not logged in, it returns a
// helpful error message.
func (s *AzureAuthService) Login(ctx context.Context) (*models.AzureAuthState, error) {
	cred, err := azidentity.NewAzureCLICredential(nil)
	if err != nil {
		return &models.AzureAuthState{
			Authenticated: false,
			ErrorMessage:  "Azure CLI nicht gefunden. Bitte installieren Sie die Azure CLI und fuehren Sie 'az login' aus.",
		}, nil
	}

	// Verify the credential works by requesting a token.
	_, err = cred.GetToken(ctx, policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	})
	if err != nil {
		s.mu.Lock()
		s.credential = nil
		s.authenticated = false
		s.mu.Unlock()

		return &models.AzureAuthState{
			Authenticated: false,
			ErrorMessage:  "Azure CLI ist nicht angemeldet. Bitte fuehren Sie 'az login' im Terminal aus und versuchen Sie es erneut.",
		}, nil
	}

	s.mu.Lock()
	s.credential = cred
	s.authenticated = true
	s.mu.Unlock()

	return &models.AzureAuthState{
		Authenticated: true,
	}, nil
}

// Logout clears the stored credential.
func (s *AzureAuthService) Logout() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.credential = nil
	s.authenticated = false
}

// IsAuthenticated returns whether a valid credential is available.
func (s *AzureAuthService) IsAuthenticated() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.authenticated
}

// GetAuthState returns the current authentication state for the frontend.
func (s *AzureAuthService) GetAuthState() *models.AzureAuthState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return &models.AzureAuthState{
		Authenticated: s.authenticated,
	}
}

// GetCredential returns the current token credential for use by other services.
// Returns an error if not authenticated.
func (s *AzureAuthService) GetCredential() (azcore.TokenCredential, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.authenticated || s.credential == nil {
		return nil, fmt.Errorf("not authenticated — please log in first")
	}
	return s.credential, nil
}
