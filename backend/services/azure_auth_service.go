package services

import (
	"context"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

// AzureAuthService manages Azure authentication via the Azure CLI credential.
// The user must have run `az login` at least once before using this app.
type AzureAuthService struct {
	mu            sync.RWMutex
	credential    azcore.TokenCredential
	authenticated bool
	wailsCtx      context.Context
	newCredential func() (azcore.TokenCredential, error)
}

func NewAzureAuthService() *AzureAuthService {
	return &AzureAuthService{
		newCredential: func() (azcore.TokenCredential, error) {
			return newAzureCLITokenCredential()
		},
	}
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
	return s.authenticate(ctx, false), nil
}

// RestoreSession silently restores an existing Azure CLI session for app startup.
// It returns a disconnected state on failure without a user-facing error message.
func (s *AzureAuthService) RestoreSession(ctx context.Context) *models.AzureAuthState {
	return s.authenticate(ctx, true)
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
		return nil, errNotAuthenticated
	}
	return s.credential, nil
}

type authFailureReason string

const (
	authFailureNone            authFailureReason = ""
	authFailureCLINotAvailable authFailureReason = "cli_not_available"
	authFailureNotLoggedIn     authFailureReason = "not_logged_in"
)

func (s *AzureAuthService) authenticate(ctx context.Context, silent bool) *models.AzureAuthState {
	switch s.tryAuthenticate(ctx) {
	case authFailureNone:
		return &models.AzureAuthState{
			Authenticated: true,
			FailureReason: string(authFailureNone),
		}
	case authFailureCLINotAvailable:
		if silent {
			return &models.AzureAuthState{
				Authenticated: false,
				FailureReason: string(authFailureCLINotAvailable),
			}
		}
		return &models.AzureAuthState{
			Authenticated: false,
			ErrorMessage:  "Azure CLI nicht gefunden. Bitte installieren Sie die Azure CLI und fuehren Sie 'az login' aus.",
			FailureReason: string(authFailureCLINotAvailable),
		}
	case authFailureNotLoggedIn:
		if silent {
			return &models.AzureAuthState{
				Authenticated: false,
				FailureReason: string(authFailureNotLoggedIn),
			}
		}
		return &models.AzureAuthState{
			Authenticated: false,
			ErrorMessage:  "Azure CLI ist nicht angemeldet. Bitte fuehren Sie 'az login' im Terminal aus und versuchen Sie es erneut.",
			FailureReason: string(authFailureNotLoggedIn),
		}
	default:
		return &models.AzureAuthState{Authenticated: false}
	}
}

func (s *AzureAuthService) tryAuthenticate(ctx context.Context) authFailureReason {
	baseCredential, err := s.newCredential()
	if err != nil {
		s.clearCredential()
		return authFailureCLINotAvailable
	}

	cred := newCachedTokenCredential(baseCredential)

	_, err = cred.GetToken(ctx, policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	})
	if err != nil {
		s.clearCredential()
		return authFailureNotLoggedIn
	}

	s.setCredential(cred)
	return authFailureNone
}

func (s *AzureAuthService) setCredential(credential azcore.TokenCredential) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.credential = credential
	s.authenticated = true
}

func (s *AzureAuthService) clearCredential() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cached, ok := s.credential.(*cachedTokenCredential); ok {
		cached.Reset()
	}
	s.credential = nil
	s.authenticated = false
}
