//go:build windows

package app

import "os/exec"

func openDirectory(directory string) error {
	command := exec.Command("explorer.exe", directory)
	if err := command.Start(); err != nil {
		return err
	}
	return command.Process.Release()
}
