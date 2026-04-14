package services

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

const tokenRefreshBuffer = 5 * time.Minute

// cachedTokenCredential wraps another TokenCredential and keeps tokens in memory
// for the lifetime of the application session.
type cachedTokenCredential struct {
	base          azcore.TokenCredential
	now           func() time.Time
	refreshBuffer time.Duration

	mu     sync.Mutex
	tokens map[string]azcore.AccessToken
}

func newCachedTokenCredential(base azcore.TokenCredential) *cachedTokenCredential {
	return &cachedTokenCredential{
		base:          base,
		now:           time.Now,
		refreshBuffer: tokenRefreshBuffer,
		tokens:        make(map[string]azcore.AccessToken),
	}
}

func (c *cachedTokenCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	key := cacheKey(opts)

	c.mu.Lock()
	defer c.mu.Unlock()

	if token, ok := c.tokens[key]; ok && c.isUsable(token) {
		return token, nil
	}

	token, err := c.base.GetToken(ctx, opts)
	if err != nil {
		return azcore.AccessToken{}, err
	}

	c.tokens[key] = token
	return token, nil
}

func (c *cachedTokenCredential) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tokens = make(map[string]azcore.AccessToken)
}

func (c *cachedTokenCredential) isUsable(token azcore.AccessToken) bool {
	return token.Token != "" && token.ExpiresOn.After(c.now().Add(c.refreshBuffer))
}

func cacheKey(opts policy.TokenRequestOptions) string {
	var builder strings.Builder
	builder.WriteString(strings.Join(opts.Scopes, "|"))
	builder.WriteString("::")
	builder.WriteString(opts.TenantID)
	return builder.String()
}
