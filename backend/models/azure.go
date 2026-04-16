package models

// DeviceCodeInfo holds the device code details shown to the user during login.
type DeviceCodeInfo struct {
	UserCode        string `json:"userCode"`
	VerificationURL string `json:"verificationUrl"`
	Message         string `json:"message"`
}

// AzureAuthState represents the current authentication state.
type AzureAuthState struct {
	Authenticated bool   `json:"authenticated"`
	UserName      string `json:"userName,omitempty"`
	ErrorMessage  string `json:"errorMessage,omitempty"`
	FailureReason string `json:"failureReason,omitempty"`
}

type BlobFailureReason string

const (
	BlobFailureReasonNone           BlobFailureReason = ""
	BlobFailureReasonNotFound       BlobFailureReason = "not_found"
	BlobFailureReasonAccessDenied   BlobFailureReason = "access_denied"
	BlobFailureReasonTooLarge       BlobFailureReason = "too_large"
	BlobFailureReasonLimitExceeded  BlobFailureReason = "limit_exceeded"
	BlobFailureReasonDownloadFailed BlobFailureReason = "download_failed"
)

// AzureSubscription represents an Azure subscription visible to the authenticated user.
type AzureSubscription struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	TenantID    string `json:"tenantId"`
	State       string `json:"state"`
}

// AzureStorageAccount represents a storage account within a subscription.
type AzureStorageAccount struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Location       string `json:"location"`
	Kind           string `json:"kind"`
	ResourceGroup  string `json:"resourceGroup"`
	SubscriptionID string `json:"subscriptionId"`
}

// AzureContainer represents a blob container within a storage account.
type AzureContainer struct {
	Name         string `json:"name"`
	LastModified string `json:"lastModified"`
	LeaseState   string `json:"leaseState"`
}

// AzureBlobItem represents a single blob inside a container.
type AzureBlobItem struct {
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	ContentType  string `json:"contentType"`
	CreatedAt    string `json:"createdAt"`
	LastModified string `json:"lastModified"`
	BlobType     string `json:"blobType"`
}

// AzureBlobTextChunkRequest describes a chunked text read against a blob.
type AzureBlobTextChunkRequest struct {
	AccountName   string `json:"accountName"`
	ContainerName string `json:"containerName"`
	BlobName      string `json:"blobName"`
	StartOffset   *int64 `json:"startOffset,omitempty"`
	Count         *int64 `json:"count,omitempty"`
}

// AzureBlobTextChunk contains a text preview window plus blob metadata.
type AzureBlobTextChunk struct {
	Content            string `json:"content"`
	BlobSize           int64  `json:"blobSize"`
	ContentType        string `json:"contentType"`
	ETag               string `json:"etag"`
	LastModified       string `json:"lastModified"`
	StartOffset        int64  `json:"startOffset"`
	EndOffsetExclusive int64  `json:"endOffsetExclusive"`
	TruncatedStart     bool   `json:"truncatedStart"`
	TruncatedEnd       bool   `json:"truncatedEnd"`
	IsLargeBlob        bool   `json:"isLargeBlob"`
	ErrorMessage       string `json:"errorMessage,omitempty"`
	FailureReason      string `json:"failureReason,omitempty"`
}
