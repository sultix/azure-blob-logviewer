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
	info, err := loadBuildInfo()
	if err != nil {
		log.Fatalf("failed to load build metadata: %v", err)
	}

	dist, err := fs.Sub(assetsFS, "frontend/dist/browser")
	if err != nil {
		log.Fatalf("failed to locate frontend assets: %v", err)
	}

	application := app.New(info.ProductVersion)

	err = wails.Run(&options.App{
		Title:     info.ProductName,
		Width:     1280,
		Height:    800,
		MinWidth:  1280,
		MinHeight: 600,
		Frameless: true,
		BackgroundColour: &options.RGBA{
			R: 0x0b,
			G: 0x13,
			B: 0x26,
			A: 0xff,
		},
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
