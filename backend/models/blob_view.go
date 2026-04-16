package models

type BlobViewFocus string

const (
	BlobViewFocusStart BlobViewFocus = "start"
	BlobViewFocusEnd   BlobViewFocus = "end"
)

// OpenBlobViewSessionRequest starts a progressive viewer session for a blob.
type OpenBlobViewSessionRequest struct {
	AccountName   string        `json:"accountName"`
	ContainerName string        `json:"containerName"`
	BlobName      string        `json:"blobName"`
	Focus         BlobViewFocus `json:"focus"`
}

// BlobViewSessionStatus describes the current session progress and available content.
type BlobViewSessionStatus struct {
	SessionID         string        `json:"sessionId"`
	BlobName          string        `json:"blobName"`
	BlobSize          int64         `json:"blobSize"`
	ContentType       string        `json:"contentType"`
	BytesDownloaded   int64         `json:"bytesDownloaded"`
	IndexedLineCount  int64         `json:"indexedLineCount"`
	IndexedThrough    int64         `json:"indexedThrough"`
	IsComplete        bool          `json:"isComplete"`
	CanEnableWordWrap bool          `json:"canEnableWordWrap"`
	HasPendingBefore  bool          `json:"hasPendingBefore"`
	HasPendingAfter   bool          `json:"hasPendingAfter"`
	ErrorMessage      string        `json:"errorMessage,omitempty"`
	FailureReason     string        `json:"failureReason,omitempty"`
	Focus             BlobViewFocus `json:"focus"`
	TailPreviewLines  []string      `json:"tailPreviewLines"`
}

// BlobViewLine is a single logical line from the progressive viewer.
type BlobViewLine struct {
	LineNumber int64  `json:"lineNumber"`
	Content    string `json:"content"`
}

// BlobViewLinesResponse contains the visible lines for a virtualized viewport.
type BlobViewLinesResponse struct {
	StartLine  int64          `json:"startLine"`
	TotalLines int64          `json:"totalLines"`
	IsComplete bool           `json:"isComplete"`
	Lines      []BlobViewLine `json:"lines"`
}

// BlobViewSearchRequest performs an incremental search on the viewer session.
type BlobViewSearchRequest struct {
	SessionID string `json:"sessionId"`
	Query     string `json:"query"`
	Cursor    int64  `json:"cursor"`
}

// BlobViewSearchMatch identifies a matching line.
type BlobViewSearchMatch struct {
	LineNumber int64  `json:"lineNumber"`
	Preview    string `json:"preview"`
}

// BlobViewSearchResponse returns a page of search results.
type BlobViewSearchResponse struct {
	Query      string                `json:"query"`
	Matches    []BlobViewSearchMatch `json:"matches"`
	NextCursor int64                 `json:"nextCursor"`
	IsComplete bool                  `json:"isComplete"`
}

// BlobViewExportResult reports whether exporting the cached blob was cancelled.
type BlobViewExportResult struct {
	Cancelled bool `json:"cancelled"`
}
