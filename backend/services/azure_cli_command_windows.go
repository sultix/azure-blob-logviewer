//go:build windows

package services

import (
	"context"
	"os/exec"
	"syscall"
)

func newAzureCLICommand(ctx context.Context, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "az", args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}
	return cmd
}
