package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

func TestAzureAuthServiceRestoreSessionSuccess(t *testing.T) {
	service := NewAzureAuthService()
	service.newCredential = func() (azcore.TokenCredential, error) {
		return fakeTokenCredential{}, nil
	}

	state := service.RestoreSession(context.Background())

	if !state.Authenticated {
		t.Fatalf("expected authenticated restore state, got %#v", state)
	}
	if state.ErrorMessage != "" {
		t.Fatalf("expected silent restore without error message, got %q", state.ErrorMessage)
	}
	if state.FailureReason != "" {
		t.Fatalf("expected no failure reason for successful restore, got %q", state.FailureReason)
	}
	if !service.IsAuthenticated() {
		t.Fatal("expected service to be marked authenticated after restore")
	}
	credential, err := service.GetCredential()
	if err != nil {
		t.Fatalf("expected stored credential after restore, got error: %v", err)
	}
	if _, ok := credential.(*cachedTokenCredential); !ok {
		t.Fatalf("expected cached credential wrapper after restore, got %T", credential)
	}
}

func TestAzureAuthServiceRestoreSessionFailureIsSilent(t *testing.T) {
	t.Run("cli missing", func(t *testing.T) {
		service := NewAzureAuthService()
		service.newCredential = func() (azcore.TokenCredential, error) {
			return nil, errors.New("missing az")
		}

		state := service.RestoreSession(context.Background())

		if state.Authenticated {
			t.Fatalf("expected disconnected restore state, got %#v", state)
		}
		if state.ErrorMessage != "" {
			t.Fatalf("expected no user-facing restore error, got %q", state.ErrorMessage)
		}
		if state.FailureReason != string(authFailureCLINotAvailable) {
			t.Fatalf("expected CLI missing failure reason, got %q", state.FailureReason)
		}
		if service.IsAuthenticated() {
			t.Fatal("expected service to stay disconnected after failed restore")
		}
		if _, err := service.GetCredential(); !errors.Is(err, errNotAuthenticated) {
			t.Fatalf("expected not authenticated error after failed restore, got %v", err)
		}
	})

	t.Run("not logged in", func(t *testing.T) {
		service := NewAzureAuthService()
		service.newCredential = func() (azcore.TokenCredential, error) {
			return fakeTokenCredential{tokenErr: errors.New("no session")}, nil
		}

		state := service.RestoreSession(context.Background())

		if state.Authenticated {
			t.Fatalf("expected disconnected restore state, got %#v", state)
		}
		if state.ErrorMessage != "" {
			t.Fatalf("expected no user-facing restore error, got %q", state.ErrorMessage)
		}
		if state.FailureReason != string(authFailureNotLoggedIn) {
			t.Fatalf("expected not-logged-in failure reason, got %q", state.FailureReason)
		}
		if service.IsAuthenticated() {
			t.Fatal("expected service to stay disconnected after failed restore")
		}
		if _, err := service.GetCredential(); !errors.Is(err, errNotAuthenticated) {
			t.Fatalf("expected not authenticated error after failed restore, got %v", err)
		}
	})
}

func TestAzureAuthServiceLoginReturnsHelpfulErrors(t *testing.T) {
	t.Run("cli missing", func(t *testing.T) {
		service := NewAzureAuthService()
		service.newCredential = func() (azcore.TokenCredential, error) {
			return nil, errors.New("missing az")
		}

		state, err := service.Login(context.Background())
		if err != nil {
			t.Fatalf("expected no Go error, got %v", err)
		}
		if state.Authenticated {
			t.Fatalf("expected disconnected login state, got %#v", state)
		}
		expected := "Azure CLI nicht gefunden. Bitte installieren Sie die Azure CLI und fuehren Sie 'az login' aus."
		if state.ErrorMessage != expected {
			t.Fatalf("expected CLI help message %q, got %q", expected, state.ErrorMessage)
		}
		if state.FailureReason != string(authFailureCLINotAvailable) {
			t.Fatalf("expected CLI missing failure reason, got %q", state.FailureReason)
		}
	})

	t.Run("not logged in", func(t *testing.T) {
		service := NewAzureAuthService()
		service.newCredential = func() (azcore.TokenCredential, error) {
			return fakeTokenCredential{tokenErr: errors.New("login required")}, nil
		}

		state, err := service.Login(context.Background())
		if err != nil {
			t.Fatalf("expected no Go error, got %v", err)
		}
		if state.Authenticated {
			t.Fatalf("expected disconnected login state, got %#v", state)
		}
		expected := "Azure CLI ist nicht angemeldet. Bitte fuehren Sie 'az login' im Terminal aus und versuchen Sie es erneut."
		if state.ErrorMessage != expected {
			t.Fatalf("expected login help message %q, got %q", expected, state.ErrorMessage)
		}
		if state.FailureReason != string(authFailureNotLoggedIn) {
			t.Fatalf("expected not-logged-in failure reason, got %q", state.FailureReason)
		}
	})

	t.Run("token request failed", func(t *testing.T) {
		service := NewAzureAuthService()
		service.newCredential = func() (azcore.TokenCredential, error) {
			return fakeTokenCredential{tokenErr: errors.New("unexpected tenant mismatch")}, nil
		}

		state, err := service.Login(context.Background())
		if err != nil {
			t.Fatalf("expected no Go error, got %v", err)
		}
		if state.Authenticated {
			t.Fatalf("expected disconnected login state, got %#v", state)
		}
		if state.FailureReason != string(authFailureTokenRequestFailed) {
			t.Fatalf("expected token-request failure reason, got %q", state.FailureReason)
		}
		if state.ErrorMessage != "" {
			t.Fatalf("expected sanitized token-request failure without raw error message, got %q", state.ErrorMessage)
		}
	})
}

func TestAzureAuthServiceLoginStoresCachedCredential(t *testing.T) {
	service := NewAzureAuthService()
	service.newCredential = func() (azcore.TokenCredential, error) {
		return fakeTokenCredential{}, nil
	}

	state, err := service.Login(context.Background())
	if err != nil {
		t.Fatalf("expected no Go error, got %v", err)
	}
	if !state.Authenticated {
		t.Fatalf("expected authenticated login state, got %#v", state)
	}
	if state.FailureReason != "" {
		t.Fatalf("expected no failure reason for successful login, got %q", state.FailureReason)
	}

	credential, err := service.GetCredential()
	if err != nil {
		t.Fatalf("expected stored credential after login, got error: %v", err)
	}
	if _, ok := credential.(*cachedTokenCredential); !ok {
		t.Fatalf("expected cached credential wrapper after login, got %T", credential)
	}
}

type fakeTokenCredential struct {
	tokenErr error
}

func (f fakeTokenCredential) GetToken(context.Context, policy.TokenRequestOptions) (azcore.AccessToken, error) {
	if f.tokenErr != nil {
		return azcore.AccessToken{}, f.tokenErr
	}
	return azcore.AccessToken{
		Token:     "token",
		ExpiresOn: time.Now().Add(time.Hour),
	}, nil
}
