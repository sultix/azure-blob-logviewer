package main

import (
	"embed"
	"io/fs"
	"log"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/app"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assetsFS embed.FS

func main() {
	dist, err := fs.Sub(assetsFS, "frontend/dist/browser")
	if err != nil {
		log.Fatalf("failed to locate frontend assets: %v", err)
	}

	application := app.New()

	err = wails.Run(&options.App{
		Title:  "Azure Blob Log Viewer",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: dist,
		},
		OnStartup: application.Startup,
		Bind: []interface{}{
			application,
		},
	})
	if err != nil {
		log.Fatalf("failed to run wails application: %v", err)
	}
}
