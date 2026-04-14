//go:build !windows

package services

import (
	"context"
	"os/exec"
)

func newAzureCLICommand(ctx context.Context, args ...string) *exec.Cmd {
	return exec.CommandContext(ctx, "az", args...)
}
