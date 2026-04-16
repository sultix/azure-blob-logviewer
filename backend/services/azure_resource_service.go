package services

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/storage/armstorage"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/subscription/armsubscription"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

// AzureResourceService provides methods to enumerate Azure resources.
type AzureResourceService struct {
	auth *AzureAuthService
}

const (
	largeBlobThresholdBytes   int64 = 20 * 1024 * 1024
	defaultBlobChunkSizeBytes int64 = 512 * 1024
	maxBlobTextChunkBytes     int64 = 20 * 1024 * 1024
)

func NewAzureResourceService(auth *AzureAuthService) *AzureResourceService {
	return &AzureResourceService{auth: auth}
}

// ListSubscriptions returns all subscriptions visible to the authenticated user.
func (s *AzureResourceService) ListSubscriptions(ctx context.Context) ([]models.AzureSubscription, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, sanitizeAuthError(err)
	}

	client, err := armsubscription.NewSubscriptionsClient(cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create subscriptions client: %w", err)
	}

	var result []models.AzureSubscription
	pager := client.NewListPager(nil)
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			logDetailedError("list subscriptions failed", err)
			return nil, fmt.Errorf("failed to list subscriptions")
		}
		for _, sub := range page.Value {
			if sub == nil {
				continue
			}
			item := models.AzureSubscription{
				ID:          derefStr(sub.SubscriptionID),
				DisplayName: derefStr(sub.DisplayName),
			}
			if sub.State != nil {
				item.State = string(*sub.State)
			}
			result = append(result, item)
		}
	}
	return result, nil
}

// ListStorageAccounts returns all storage accounts in the given subscription.
func (s *AzureResourceService) ListStorageAccounts(ctx context.Context, subscriptionID string) ([]models.AzureStorageAccount, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, sanitizeAuthError(err)
	}

	client, err := armstorage.NewAccountsClient(subscriptionID, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create storage accounts client: %w", err)
	}

	var result []models.AzureStorageAccount
	pager := client.NewListPager(nil)
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			logDetailedError("list storage accounts failed", err)
			return nil, fmt.Errorf("failed to list storage accounts")
		}
		for _, acc := range page.Value {
			if acc == nil {
				continue
			}
			rg := extractResourceGroup(derefStr(acc.ID))
			item := models.AzureStorageAccount{
				ID:             derefStr(acc.ID),
				Name:           derefStr(acc.Name),
				Location:       derefStr(acc.Location),
				ResourceGroup:  rg,
				SubscriptionID: subscriptionID,
			}
			if acc.Kind != nil {
				item.Kind = string(*acc.Kind)
			}
			result = append(result, item)
		}
	}
	return result, nil
}

// ListContainers returns all blob containers in the given storage account (ARM control plane).
func (s *AzureResourceService) ListContainers(ctx context.Context, subscriptionID, resourceGroup, accountName string) ([]models.AzureContainer, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, sanitizeAuthError(err)
	}

	client, err := armstorage.NewBlobContainersClient(subscriptionID, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create blob containers client: %w", err)
	}

	var result []models.AzureContainer
	pager := client.NewListPager(resourceGroup, accountName, nil)
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			logDetailedError("list blob containers failed", err)
			return nil, fmt.Errorf("failed to list containers")
		}
		for _, c := range page.Value {
			if c == nil || c.Name == nil {
				continue
			}
			item := models.AzureContainer{
				Name: *c.Name,
			}
			if c.Properties != nil {
				if c.Properties.LastModifiedTime != nil {
					item.LastModified = c.Properties.LastModifiedTime.UTC().Format("2006-01-02T15:04:05Z")
				}
				if c.Properties.LeaseState != nil {
					item.LeaseState = string(*c.Properties.LeaseState)
				}
			}
			result = append(result, item)
		}
	}
	return result, nil
}

// ListBlobs returns blobs in the given container (data plane via azblob).
func (s *AzureResourceService) ListBlobs(ctx context.Context, accountName, containerName, prefix string) ([]models.AzureBlobItem, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, sanitizeAuthError(err)
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", accountName)
	client, err := azblob.NewClient(serviceURL, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create blob client: %w", err)
	}

	var opts *azblob.ListBlobsFlatOptions
	if prefix != "" {
		opts = &azblob.ListBlobsFlatOptions{Prefix: &prefix}
	}

	var result []models.AzureBlobItem
	pager := client.NewListBlobsFlatPager(containerName, opts)
	for pager.More() {
		page, err := pager.NextPage(ctx)
		if err != nil {
			logDetailedError("list blobs failed", err)
			return nil, fmt.Errorf("failed to list blobs")
		}
		for _, blob := range page.Segment.BlobItems {
			if blob == nil || blob.Name == nil {
				continue
			}
			item := models.AzureBlobItem{
				Name: *blob.Name,
			}
			if blob.Properties != nil {
				if blob.Properties.ContentLength != nil {
					item.Size = *blob.Properties.ContentLength
				}
				if blob.Properties.ContentType != nil {
					item.ContentType = *blob.Properties.ContentType
				}
				item.CreatedAt = formatTimePtr(blob.Properties.CreationTime)
				if blob.Properties.LastModified != nil {
					item.LastModified = blob.Properties.LastModified.UTC().Format("2006-01-02T15:04:05Z")
				}
				if blob.Properties.BlobType != nil {
					item.BlobType = string(*blob.Properties.BlobType)
				}
			}
			result = append(result, item)
		}
	}
	return result, nil
}

// ReadBlobTextChunk downloads a bounded text window from a blob.
func (s *AzureResourceService) ReadBlobTextChunk(ctx context.Context, request models.AzureBlobTextChunkRequest) (*models.AzureBlobTextChunk, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, sanitizeAuthError(err)
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", request.AccountName)
	client, err := azblob.NewClient(serviceURL, cred, nil)
	if err != nil {
		logDetailedError("create blob client failed", err)
		return buildBlobTextChunkFailureResponse(0, "", models.BlobFailureReasonDownloadFailed), nil
	}

	blobClient := client.ServiceClient().NewContainerClient(request.ContainerName).NewBlobClient(request.BlobName)
	props, err := blobClient.GetProperties(ctx, nil)
	if err != nil {
		logDetailedError("get blob properties failed", err)
		return buildBlobTextChunkFailureResponse(0, "", blobFailureReasonFromError(err)), nil
	}

	blobSize := derefInt64(props.ContentLength)
	if failureReason := validateBlobPreviewSize(blobSize); failureReason != models.BlobFailureReasonNone {
		return buildBlobTextChunkFailureResponse(
			blobSize,
			derefStr(props.ContentType),
			failureReason,
		), nil
	}

	window, err := resolveBlobReadWindow(blobSize, request.StartOffset, request.Count)
	if err != nil {
		logDetailedError("resolve blob read window failed", err)
		return buildBlobTextChunkFailureResponse(
			blobSize,
			derefStr(props.ContentType),
			models.BlobFailureReasonLimitExceeded,
		), nil
	}

	resp, err := blobClient.DownloadStream(ctx, &azblob.DownloadStreamOptions{
		Range: azblob.HTTPRange{
			Offset: window.startOffset,
			Count:  window.count,
		},
	})
	if err != nil {
		logDetailedError("download blob chunk failed", err)
		return buildBlobTextChunkFailureResponse(
			blobSize,
			derefStr(props.ContentType),
			blobFailureReasonFromError(err),
		), nil
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		logDetailedError("read blob chunk failed", err)
		return buildBlobTextChunkFailureResponse(
			blobSize,
			derefStr(props.ContentType),
			models.BlobFailureReasonDownloadFailed,
		), nil
	}

	return &models.AzureBlobTextChunk{
		Content:            string(data),
		BlobSize:           blobSize,
		ContentType:        derefStr(props.ContentType),
		ETag:               formatETag(props.ETag),
		LastModified:       formatTimePtr(props.LastModified),
		StartOffset:        window.startOffset,
		EndOffsetExclusive: window.startOffset + window.count,
		TruncatedStart:     window.startOffset > 0,
		TruncatedEnd:       window.startOffset+window.count < blobSize,
		IsLargeBlob:        blobSize > largeBlobThresholdBytes,
	}, nil
}

func buildBlobTextChunkFailureResponse(
	blobSize int64,
	contentType string,
	reason models.BlobFailureReason,
) *models.AzureBlobTextChunk {
	return &models.AzureBlobTextChunk{
		BlobSize:      blobSize,
		ContentType:   contentType,
		ErrorMessage:  blobFailureMessage(reason),
		FailureReason: string(reason),
	}
}

func validateBlobPreviewSize(blobSize int64) models.BlobFailureReason {
	if blobSize > maxBlobTextChunkBytes {
		return models.BlobFailureReasonTooLarge
	}

	return models.BlobFailureReasonNone
}

// derefStr safely dereferences a string pointer.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// extractResourceGroup parses the resource group name from an Azure resource ID.
// Example: /subscriptions/.../resourceGroups/myRG/providers/... → myRG
func extractResourceGroup(resourceID string) string {
	parts := strings.Split(resourceID, "/")
	for i, p := range parts {
		if strings.EqualFold(p, "resourceGroups") && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

type blobReadWindow struct {
	startOffset int64
	count       int64
}

func resolveBlobReadWindow(blobSize int64, startOffset *int64, count *int64) (blobReadWindow, error) {
	if blobSize < 0 {
		return blobReadWindow{}, fmt.Errorf("blob size must not be negative")
	}

	if startOffset != nil && *startOffset < 0 {
		return blobReadWindow{}, fmt.Errorf("start offset must be greater than or equal to 0")
	}

	if count != nil && *count <= 0 {
		return blobReadWindow{}, fmt.Errorf("count must be greater than 0")
	}
	if count != nil && *count > maxBlobTextChunkBytes {
		return blobReadWindow{}, fmt.Errorf("count exceeds the supported preview limit")
	}

	if blobSize == 0 {
		return blobReadWindow{}, nil
	}

	isLargeBlob := blobSize > largeBlobThresholdBytes
	if !isLargeBlob && startOffset == nil && count == nil {
		return blobReadWindow{startOffset: 0, count: blobSize}, nil
	}

	windowSize := defaultBlobChunkSizeBytes
	if count != nil {
		windowSize = *count
	}
	if windowSize > blobSize {
		windowSize = blobSize
	}

	var start int64
	switch {
	case startOffset != nil:
		start = *startOffset
	case isLargeBlob:
		start = maxInt64(blobSize-windowSize, 0)
	default:
		start = maxInt64(blobSize-windowSize, 0)
	}

	if start >= blobSize {
		return blobReadWindow{}, fmt.Errorf("start offset must be smaller than blob size")
	}

	if start+windowSize > blobSize {
		windowSize = blobSize - start
	}

	return blobReadWindow{
		startOffset: start,
		count:       windowSize,
	}, nil
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func formatTimePtr(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.UTC().Format("2006-01-02T15:04:05Z")
}

func formatETag(value *azcore.ETag) string {
	if value == nil {
		return ""
	}
	return string(*value)
}
