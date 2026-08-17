package main

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

// azureCLICredential mirrors the credential the app itself uses
// (backend/services/azure_cli_credential.go) so this tool authenticates the
// same way the viewer does: whatever `az login` session is active. That type is
// unexported and lives in package services; it is not exported just for a dev
// tool, so the token shelling is repeated here.
type azureCLICredential struct{}

func newAzureCLICredential() (azcore.TokenCredential, error) {
	if _, err := exec.LookPath("az"); err != nil {
		return nil, fmt.Errorf("azure CLI not found in PATH: %w", err)
	}
	return &azureCLICredential{}, nil
}

func (c *azureCLICredential) GetToken(
	ctx context.Context,
	opts policy.TokenRequestOptions,
) (azcore.AccessToken, error) {
	if len(opts.Scopes) != 1 {
		return azcore.AccessToken{}, fmt.Errorf("expected exactly one scope, got %d", len(opts.Scopes))
	}

	args := []string{
		"account",
		"get-access-token",
		"-o",
		"json",
		"--resource",
		strings.TrimSuffix(opts.Scopes[0], "/.default"),
	}
	if tenantID := strings.TrimSpace(opts.TenantID); tenantID != "" {
		args = append(args, "--tenant", tenantID)
	}

	output, err := exec.CommandContext(ctx, "az", args...).CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return azcore.AccessToken{}, fmt.Errorf("az account get-access-token failed: %s", message)
	}

	return parseAccessToken(output)
}

func parseAccessToken(output []byte) (azcore.AccessToken, error) {
	var token struct {
		AccessToken string `json:"accessToken"`
		ExpiresOn   string `json:"expiresOn"`
		ExpiresUnix int64  `json:"expires_on"`
	}
	if err := json.Unmarshal(output, &token); err != nil {
		return azcore.AccessToken{}, fmt.Errorf("failed to parse Azure CLI token response: %w", err)
	}

	expiresOn := time.Unix(token.ExpiresUnix, 0)
	if token.ExpiresUnix == 0 {
		parsed, err := time.ParseInLocation("2006-01-02 15:04:05.999999", token.ExpiresOn, time.Local)
		if err != nil {
			return azcore.AccessToken{}, fmt.Errorf(
				"failed to parse Azure CLI token expiration %q: %w",
				token.ExpiresOn,
				err,
			)
		}
		expiresOn = parsed
	}

	return azcore.AccessToken{Token: token.AccessToken, ExpiresOn: expiresOn.UTC()}, nil
}
