package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed wails.json
var rawWailsConfig []byte

type buildInfo struct {
	ProductName    string
	ProductVersion string
	CompanyName    string
}

type wailsConfig struct {
	Name string `json:"name"`
	Info struct {
		CompanyName    string `json:"companyName"`
		ProductName    string `json:"productName"`
		ProductVersion string `json:"productVersion"`
	} `json:"info"`
}

func loadBuildInfo() (buildInfo, error) {
	return parseBuildInfo(rawWailsConfig)
}

func parseBuildInfo(raw []byte) (buildInfo, error) {
	var config wailsConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return buildInfo{}, fmt.Errorf("parse wails.json: %w", err)
	}

	productName := strings.TrimSpace(config.Info.ProductName)
	if productName == "" {
		productName = strings.TrimSpace(config.Name)
	}
	if productName == "" {
		return buildInfo{}, fmt.Errorf("wails.json is missing info.productName and name")
	}

	productVersion := strings.TrimSpace(config.Info.ProductVersion)
	if productVersion == "" {
		return buildInfo{}, fmt.Errorf("wails.json is missing info.productVersion")
	}

	companyName := strings.TrimSpace(config.Info.CompanyName)
	if companyName == "" {
		return buildInfo{}, fmt.Errorf("wails.json is missing info.companyName")
	}

	return buildInfo{
		ProductName:    productName,
		ProductVersion: productVersion,
		CompanyName:    companyName,
	}, nil
}
