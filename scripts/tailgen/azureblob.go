package main

import (
	"bytes"
	"context"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/appendblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
)

// azureAppendBlob wires the append blob SDK client into the func fields
// blobWriter expects.
type azureAppendBlob struct {
	client *appendblob.Client
}

func newAzureAppendBlob(blobURL string, useSAS bool) (*azureAppendBlob, error) {
	if useSAS {
		client, err := appendblob.NewClientWithNoCredential(blobURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create client from SAS URL: %w", err)
		}
		return &azureAppendBlob{client: client}, nil
	}

	cred, err := newAzureCLICredential()
	if err != nil {
		return nil, err
	}
	client, err := appendblob.NewClient(blobURL, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create append blob client: %w", err)
	}
	return &azureAppendBlob{client: client}, nil
}

// open makes sure the blob exists and reports the size to continue from. With
// reset the blob is dropped first; otherwise an existing blob is kept and
// appended to, which is what makes a second run continue the same file.
func (b *azureAppendBlob) open(ctx context.Context, reset bool) (int64, error) {
	if reset {
		if _, err := b.client.Delete(ctx, nil); err != nil && !bloberror.HasCode(err, bloberror.BlobNotFound) {
			return 0, fmt.Errorf("failed to delete blob: %w", err)
		}
	}

	if _, err := b.client.Create(ctx, nil); err != nil {
		if !bloberror.HasCode(err, bloberror.BlobAlreadyExists) {
			return 0, fmt.Errorf("failed to create append blob: %w", err)
		}
		return b.currentSize(ctx)
	}

	return 0, nil
}

func (b *azureAppendBlob) reset(ctx context.Context) (int64, error) {
	return b.open(ctx, true)
}

func (b *azureAppendBlob) appendBlock(ctx context.Context, data []byte) error {
	if _, err := b.client.AppendBlock(ctx, streaming.NopCloser(bytes.NewReader(data)), nil); err != nil {
		return fmt.Errorf("failed to append block: %w", err)
	}
	return nil
}

func (b *azureAppendBlob) currentSize(ctx context.Context) (int64, error) {
	props, err := b.client.GetProperties(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to read blob properties: %w", err)
	}
	if props.ContentLength == nil {
		return 0, nil
	}
	return *props.ContentLength, nil
}
