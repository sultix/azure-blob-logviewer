package services

import (
	"testing"

	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

func TestResolveBlobReadWindow(t *testing.T) {
	t.Run("returns full blob for small default reads", func(t *testing.T) {
		window, err := resolveBlobReadWindow(1024, nil, nil)
		if err != nil {
			t.Fatalf("resolveBlobReadWindow returned error: %v", err)
		}

		if window.startOffset != 0 {
			t.Fatalf("expected start offset 0, got %d", window.startOffset)
		}
		if window.count != 1024 {
			t.Fatalf("expected count 1024, got %d", window.count)
		}
	})

	t.Run("returns tail chunk for large default reads", func(t *testing.T) {
		window, err := resolveBlobReadWindow(largeBlobThresholdBytes+1024, nil, nil)
		if err != nil {
			t.Fatalf("resolveBlobReadWindow returned error: %v", err)
		}

		expectedStart := (largeBlobThresholdBytes + 1024) - defaultBlobChunkSizeBytes
		if window.startOffset != expectedStart {
			t.Fatalf("expected start offset %d, got %d", expectedStart, window.startOffset)
		}
		if window.count != defaultBlobChunkSizeBytes {
			t.Fatalf("expected count %d, got %d", defaultBlobChunkSizeBytes, window.count)
		}
	})

	t.Run("clamps requested range to blob size", func(t *testing.T) {
		startOffset := int64(900)
		count := int64(500)
		window, err := resolveBlobReadWindow(1024, &startOffset, &count)
		if err != nil {
			t.Fatalf("resolveBlobReadWindow returned error: %v", err)
		}

		if window.startOffset != 900 {
			t.Fatalf("expected start offset 900, got %d", window.startOffset)
		}
		if window.count != 124 {
			t.Fatalf("expected count 124, got %d", window.count)
		}
	})

	t.Run("rejects invalid start offset", func(t *testing.T) {
		startOffset := int64(1024)
		if _, err := resolveBlobReadWindow(1024, &startOffset, nil); err == nil {
			t.Fatal("expected error for out-of-range start offset")
		}
	})

	t.Run("rejects invalid count", func(t *testing.T) {
		count := int64(0)
		if _, err := resolveBlobReadWindow(1024, nil, &count); err == nil {
			t.Fatal("expected error for non-positive count")
		}
	})

	t.Run("rejects counts above the preview limit", func(t *testing.T) {
		count := maxBlobTextChunkBytes + 1
		if _, err := resolveBlobReadWindow(maxBlobTextChunkBytes, nil, &count); err == nil {
			t.Fatal("expected error for oversized preview count")
		}
	})
}

func TestValidateBlobPreviewSize(t *testing.T) {
	if reason := validateBlobPreviewSize(maxBlobTextChunkBytes); reason != models.BlobFailureReasonNone {
		t.Fatalf("expected blob at preview limit to be allowed, got %q", reason)
	}

	if reason := validateBlobPreviewSize(maxBlobTextChunkBytes + 1); reason != models.BlobFailureReasonTooLarge {
		t.Fatalf("expected oversized blob to be rejected as too_large, got %q", reason)
	}
}
