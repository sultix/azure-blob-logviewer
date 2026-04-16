//go:build windows

package services

import "os"

func openExportFile(path string) (*os.File, error) {
	return os.Create(path)
}
