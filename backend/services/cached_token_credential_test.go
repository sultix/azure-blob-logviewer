package services

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

func TestCachedTokenCredentialCachesByScopeAndTenant(t *testing.T) {
	var calls atomic.Int32
	credential := newCachedTokenCredential(countingTokenCredential{
		calls: &calls,
		token: azcore.AccessToken{
			Token:     "token",
			ExpiresOn: time.Now().Add(time.Hour),
		},
	})
	opts := policy.TokenRequestOptions{
		Scopes:   []string{"https://management.azure.com/.default"},
		TenantID: "tenant-a",
	}

	first, err := credential.GetToken(context.Background(), opts)
	if err != nil {
		t.Fatalf("expected first token request to succeed, got %v", err)
	}

	second, err := credential.GetToken(context.Background(), opts)
	if err != nil {
		t.Fatalf("expected cached token request to succeed, got %v", err)
	}

	if calls.Load() != 1 {
		t.Fatalf("expected one underlying credential call, got %d", calls.Load())
	}
	if first.Token != second.Token {
		t.Fatalf("expected cached token to match first token, got %q and %q", first.Token, second.Token)
	}
}

func TestCachedTokenCredentialSeparatesCacheEntriesByScope(t *testing.T) {
	var calls atomic.Int32
	credential := newCachedTokenCredential(countingTokenCredential{
		calls: &calls,
		token: azcore.AccessToken{
			Token:     "token",
			ExpiresOn: time.Now().Add(time.Hour),
		},
	})

	_, err := credential.GetToken(context.Background(), policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	})
	if err != nil {
		t.Fatalf("expected first scope request to succeed, got %v", err)
	}

	_, err = credential.GetToken(context.Background(), policy.TokenRequestOptions{
		Scopes: []string{"https://storage.azure.com/.default"},
	})
	if err != nil {
		t.Fatalf("expected second scope request to succeed, got %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("expected two underlying credential calls for separate scopes, got %d", calls.Load())
	}
}

func TestCachedTokenCredentialRefreshesExpiringTokens(t *testing.T) {
	var calls atomic.Int32
	now := time.Now()
	var sequence atomic.Int32
	credential := newCachedTokenCredential(countingTokenCredential{
		calls: &calls,
		nextToken: func() azcore.AccessToken {
			if sequence.Add(1) == 1 {
				return azcore.AccessToken{
					Token:     "expiring",
					ExpiresOn: now.Add(2 * time.Minute),
				}
			}
			return azcore.AccessToken{
				Token:     "fresh",
				ExpiresOn: now.Add(time.Hour),
			}
		},
	})
	credential.now = func() time.Time { return now }

	first, err := credential.GetToken(context.Background(), policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	})
	if err != nil {
		t.Fatalf("expected first token request to succeed, got %v", err)
	}

	second, err := credential.GetToken(context.Background(), policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	})
	if err != nil {
		t.Fatalf("expected refreshed token request to succeed, got %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("expected two underlying calls when token is near expiry, got %d", calls.Load())
	}
	if first.Token == second.Token {
		t.Fatalf("expected second token request to refresh the token, both returned %q", first.Token)
	}
}

func TestCachedTokenCredentialDeduplicatesConcurrentRequests(t *testing.T) {
	var calls atomic.Int32
	credential := newCachedTokenCredential(countingTokenCredential{
		calls: &calls,
		nextToken: func() azcore.AccessToken {
			time.Sleep(20 * time.Millisecond)
			return azcore.AccessToken{
				Token:     "shared",
				ExpiresOn: time.Now().Add(time.Hour),
			}
		},
	})

	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := credential.GetToken(context.Background(), policy.TokenRequestOptions{
				Scopes: []string{"https://management.azure.com/.default"},
			})
			if err != nil {
				t.Errorf("expected concurrent request to succeed, got %v", err)
			}
		}()
	}
	wg.Wait()

	if calls.Load() != 1 {
		t.Fatalf("expected one underlying call for concurrent requests, got %d", calls.Load())
	}
}

func TestCachedTokenCredentialResetClearsCachedTokens(t *testing.T) {
	var calls atomic.Int32
	credential := newCachedTokenCredential(countingTokenCredential{
		calls: &calls,
		token: azcore.AccessToken{
			Token:     "token",
			ExpiresOn: time.Now().Add(time.Hour),
		},
	})
	opts := policy.TokenRequestOptions{
		Scopes: []string{"https://management.azure.com/.default"},
	}

	_, err := credential.GetToken(context.Background(), opts)
	if err != nil {
		t.Fatalf("expected first token request to succeed, got %v", err)
	}

	credential.Reset()

	_, err = credential.GetToken(context.Background(), opts)
	if err != nil {
		t.Fatalf("expected token request after reset to succeed, got %v", err)
	}

	if calls.Load() != 2 {
		t.Fatalf("expected reset to force a new underlying credential call, got %d", calls.Load())
	}
}

type countingTokenCredential struct {
	calls     *atomic.Int32
	token     azcore.AccessToken
	nextToken func() azcore.AccessToken
}

func (c countingTokenCredential) GetToken(context.Context, policy.TokenRequestOptions) (azcore.AccessToken, error) {
	c.calls.Add(1)
	if c.nextToken != nil {
		return c.nextToken(), nil
	}
	return c.token, nil
}
