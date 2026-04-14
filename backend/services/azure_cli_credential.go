package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

type azureCLITokenCredential struct {
	subscription string
	tenantID     string
}

func newAzureCLITokenCredential() (azcore.TokenCredential, error) {
	if _, err := exec.LookPath("az"); err != nil {
		return nil, err
	}

	return &azureCLITokenCredential{}, nil
}

func (c *azureCLITokenCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	if len(opts.Scopes) != 1 {
		return azcore.AccessToken{}, fmt.Errorf("azure CLI token credential requires exactly one scope")
	}

	resource := strings.TrimSuffix(opts.Scopes[0], "/.default")
	args := []string{
		"account",
		"get-access-token",
		"-o",
		"json",
		"--resource",
		resource,
	}

	tenantID := strings.TrimSpace(opts.TenantID)
	if tenantID == "" {
		tenantID = strings.TrimSpace(c.tenantID)
	}
	if tenantID != "" {
		args = append(args, "--tenant", tenantID)
	}

	if c.subscription != "" {
		args = append(args, "--subscription", c.subscription)
	}

	cmd := newAzureCLICommand(ctx, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return azcore.AccessToken{}, fmt.Errorf("azure CLI token request failed: %s", message)
	}

	return parseAzureCLIAccessToken(output)
}

func parseAzureCLIAccessToken(output []byte) (azcore.AccessToken, error) {
	type cliTokenResponse struct {
		AccessToken string `json:"accessToken"`
		ExpiresOn   string `json:"expiresOn"`
		ExpiresUnix int64  `json:"expires_on"`
	}

	var token cliTokenResponse
	if err := json.Unmarshal(output, &token); err != nil {
		return azcore.AccessToken{}, fmt.Errorf("failed to parse Azure CLI token response: %w", err)
	}

	expiresOn := time.Unix(token.ExpiresUnix, 0)
	if token.ExpiresUnix == 0 {
		parsed, err := time.ParseInLocation("2006-01-02 15:04:05.999999", token.ExpiresOn, time.Local)
		if err != nil {
			return azcore.AccessToken{}, fmt.Errorf("failed to parse Azure CLI token expiration %q: %w", token.ExpiresOn, err)
		}
		expiresOn = parsed
	}

	return azcore.AccessToken{
		Token:     token.AccessToken,
		ExpiresOn: expiresOn.UTC(),
	}, nil
}
