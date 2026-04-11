package models

type LogEntry struct {
	ID        string `json:"id"`
	Container string `json:"container"`
	BlobName  string `json:"blobName"`
	Timestamp string `json:"timestamp"`
	Size      int64  `json:"size"`
}
