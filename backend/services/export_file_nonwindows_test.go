//go:build !windows

package services

import (
	"os"
	"testing"
)

func TestOpenExportFileUsesPrivatePermissions(t *testing.T) {
	tempDir := t.TempDir()
	path := tempDir + "/export.log"

	file, err := openExportFile(path)
	if err != nil {
		t.Fatalf("expected export file to be created, got %v", err)
	}
	file.Close()

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("expected export file to exist, got %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("expected export permissions 0600, got %o", info.Mode().Perm())
	}
}
