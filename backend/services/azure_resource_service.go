package services

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/storage/armstorage"
	"github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/subscription/armsubscription"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

// AzureResourceService provides methods to enumerate Azure resources.
type AzureResourceService struct {
	auth *AzureAuthService
}

func NewAzureResourceService(auth *AzureAuthService) *AzureResourceService {
	return &AzureResourceService{auth: auth}
}

// ListSubscriptions returns all subscriptions visible to the authenticated user.
func (s *AzureResourceService) ListSubscriptions(ctx context.Context) ([]models.AzureSubscription, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return nil, err
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
			return nil, fmt.Errorf("failed to list subscriptions: %w", err)
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
		return nil, err
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
			return nil, fmt.Errorf("failed to list storage accounts: %w", err)
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
		return nil, err
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
			return nil, fmt.Errorf("failed to list containers: %w", err)
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
		return nil, err
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
			return nil, fmt.Errorf("failed to list blobs: %w", err)
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

// DownloadBlobContent downloads a blob and returns its content as a string.
// Intended for text-based log files. For large files consider streaming instead.
func (s *AzureResourceService) DownloadBlobContent(ctx context.Context, accountName, containerName, blobName string) (string, error) {
	cred, err := s.auth.GetCredential()
	if err != nil {
		return "", err
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net", accountName)
	client, err := azblob.NewClient(serviceURL, cred, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create blob client: %w", err)
	}

	resp, err := client.DownloadStream(ctx, containerName, blobName, nil)
	if err != nil {
		return "", fmt.Errorf("failed to download blob: %w", err)
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return "", fmt.Errorf("failed to read blob content: %w", err)
	}
	return buf.String(), nil
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
