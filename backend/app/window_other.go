//go:build !darwin

package app

func (a *App) ToggleMacFullscreen() {}

func (a *App) IsMacFullscreen() bool {
	return false
}
