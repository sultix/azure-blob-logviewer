package main

import "testing"

func TestParseBuildInfo(t *testing.T) {
	t.Run("reads the version from wails metadata", func(t *testing.T) {
		info, err := parseBuildInfo([]byte(`{
			"name": "Azure Blob Logviewer",
			"info": {
				"companyName": "Aleksandr Sultanov",
				"productName": "Azure Blob Logviewer",
				"productVersion": "1.2.3"
			}
		}`))
		if err != nil {
			t.Fatalf("parseBuildInfo() error = %v", err)
		}

		if info.ProductName != "Azure Blob Logviewer" {
			t.Fatalf("ProductName = %q, want %q", info.ProductName, "Azure Blob Logviewer")
		}
		if info.ProductVersion != "1.2.3" {
			t.Fatalf("ProductVersion = %q, want %q", info.ProductVersion, "1.2.3")
		}
		if info.CompanyName != "Aleksandr Sultanov" {
			t.Fatalf("CompanyName = %q, want %q", info.CompanyName, "Aleksandr Sultanov")
		}
	})

	t.Run("rejects missing company name", func(t *testing.T) {
		_, err := parseBuildInfo([]byte(`{
			"name": "Azure Blob Logviewer",
			"info": {
				"productName": "Azure Blob Logviewer",
				"productVersion": "1.2.3"
			}
		}`))
		if err == nil {
			t.Fatal("parseBuildInfo() error = nil, want error")
		}
	})
}
