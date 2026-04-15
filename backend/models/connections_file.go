package models

type ConnectionsImportResult struct {
	Cancelled bool   `json:"cancelled"`
	Content   string `json:"content,omitempty"`
}

type ConnectionsExportResult struct {
	Cancelled bool `json:"cancelled"`
}
