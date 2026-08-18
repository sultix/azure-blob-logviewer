package services

import (
	"context"
	"errors"
	"testing"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

type fakeBlobPagePager struct {
	pages []azblob.ListBlobsFlatResponse
	next  int
	errAt int
	calls int
}

func (p *fakeBlobPagePager) More() bool {
	return p.next < len(p.pages) || p.next == p.errAt
}

func (p *fakeBlobPagePager) NextPage(context.Context) (azblob.ListBlobsFlatResponse, error) {
	p.calls++
	if p.next == p.errAt {
		p.next++
		return azblob.ListBlobsFlatResponse{}, errors.New("next page failed")
	}
	page := p.pages[p.next]
	p.next++
	return page, nil
}

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

func TestBuildListBlobsFlatOptions(t *testing.T) {
	t.Run("omits options for the default listing", func(t *testing.T) {
		if options := buildListBlobsFlatOptions("", false); options != nil {
			t.Fatalf("expected nil options, got %#v", options)
		}
	})

	t.Run("includes soft-deleted blobs", func(t *testing.T) {
		options := buildListBlobsFlatOptions("", true)
		if options == nil || !options.Include.Deleted {
			t.Fatal("expected deleted blobs to be included")
		}
		if !options.Include.DeletedWithVersions {
			t.Fatal("expected deleted blobs with versions to be included")
		}
		if options.Include.Versions {
			t.Fatal("did not expect historical versions in the full metadata scan")
		}
	})

	t.Run("preserves the prefix while including deleted blobs", func(t *testing.T) {
		options := buildListBlobsFlatOptions("archive/", true)
		if options == nil || options.Prefix == nil || *options.Prefix != "archive/" {
			t.Fatalf("expected archive prefix, got %#v", options)
		}
		if !options.Include.Deleted {
			t.Fatal("expected deleted blobs to be included")
		}
		if !options.Include.DeletedWithVersions {
			t.Fatal("expected deleted blobs with versions to be included")
		}
	})
}

func TestCollectListedBlobItemsScansEveryPage(t *testing.T) {
	pager := &fakeBlobPagePager{
		pages: []azblob.ListBlobsFlatResponse{
			blobListPage("alpha.log", "beta.log"),
			blobListPage("omega.log"),
		},
		errAt: -1,
	}

	items, err := collectListedBlobItems(context.Background(), pager)
	if err != nil {
		t.Fatalf("collectListedBlobItems returned error: %v", err)
	}
	if pager.calls != 2 {
		t.Fatalf("expected both pages to be requested, got %d calls", pager.calls)
	}
	if len(items) != 3 || items[2].item.Name != "omega.log" {
		t.Fatalf("expected all page items, got %#v", items)
	}
}

func TestCollectListedBlobItemsReturnsFollowingPageError(t *testing.T) {
	pager := &fakeBlobPagePager{
		pages: []azblob.ListBlobsFlatResponse{blobListPage("alpha.log")},
		errAt: 1,
	}

	items, err := collectListedBlobItems(context.Background(), pager)
	if err == nil {
		t.Fatal("expected the following-page error")
	}
	if items != nil {
		t.Fatalf("expected no partial result, got %#v", items)
	}
	if pager.calls != 2 {
		t.Fatalf("expected the failing following page to be requested, got %d calls", pager.calls)
	}
}

func TestSelectNewestReadableVersion(t *testing.T) {
	items := []listedBlobItem{
		{item: models.AzureBlobItem{Name: "other.log", VersionID: "2026-08-18"}},
		{item: models.AzureBlobItem{Name: "app.log", VersionID: "2026-08-16"}},
		{item: models.AzureBlobItem{Name: "app.log", VersionID: "2026-08-18", Deleted: true}},
		{item: models.AzureBlobItem{Name: "app.log", VersionID: "2026-08-17", Size: 200}},
	}

	result := selectNewestReadableVersion(nil, items, "app.log")
	if result == nil || result.VersionID != "2026-08-17" || result.Size != 200 {
		t.Fatalf("unexpected resolved version: %#v", result)
	}
}

func TestCollapseListedBlobs(t *testing.T) {
	t.Run("clears the current version id in the regular blob listing", func(t *testing.T) {
		items := []listedBlobItem{{
			item: models.AzureBlobItem{
				Name:      "app.log",
				Size:      200,
				VersionID: "current-version-from-azure",
			},
		}}

		result := collapseListedBlobs(items, false)
		if len(result) != 1 {
			t.Fatalf("expected one active blob, got %d", len(result))
		}
		if result[0].VersionID != "" || result[0].Deleted {
			t.Fatalf("unexpected regular blob identity: %#v", result[0])
		}
	})

	t.Run("keeps the active blob and hides historical versions", func(t *testing.T) {
		items := []listedBlobItem{
			{
				item: models.AzureBlobItem{
					Name:         "app.log",
					Size:         200,
					VersionID:    "current-version",
					LastModified: "2026-08-17T10:00:00Z",
				},
				isCurrentVersion: true,
			},
			{
				item: models.AzureBlobItem{
					Name:         "app.log",
					Size:         100,
					VersionID:    "old-version",
					LastModified: "2026-08-16T10:00:00Z",
				},
			},
		}

		result := collapseListedBlobs(items, true)
		if len(result) != 1 {
			t.Fatalf("expected one active blob, got %d", len(result))
		}
		if result[0].Deleted || result[0].VersionID != "" || result[0].Size != 200 {
			t.Fatalf("unexpected active blob: %#v", result[0])
		}
	})

	t.Run("uses the latest readable version for a deleted versioned blob", func(t *testing.T) {
		items := []listedBlobItem{
			{
				item:            models.AzureBlobItem{Name: "app.log", Deleted: true},
				hasVersionsOnly: true,
			},
			{
				item: models.AzureBlobItem{
					Name:         "app.log",
					Size:         100,
					VersionID:    "version-1",
					LastModified: "2026-08-16T10:00:00Z",
				},
			},
			{
				item: models.AzureBlobItem{
					Name:         "app.log",
					Size:         200,
					VersionID:    "version-2",
					LastModified: "2026-08-17T10:00:00Z",
				},
			},
		}

		result := collapseListedBlobs(items, true)
		if len(result) != 1 {
			t.Fatalf("expected one deleted blob, got %d", len(result))
		}
		if !result[0].Deleted || result[0].VersionID != "version-2" || result[0].Size != 200 {
			t.Fatalf("unexpected deleted versioned blob: %#v", result[0])
		}
	})

	t.Run("keeps a version-only deletion marker for on-demand resolution", func(t *testing.T) {
		items := []listedBlobItem{{
			item: models.AzureBlobItem{
				Name:            "app.log",
				Deleted:         true,
				HasVersionsOnly: true,
			},
			hasVersionsOnly: true,
		}}

		result := collapseListedBlobs(items, true)
		if len(result) != 1 || !result[0].Deleted || !result[0].HasVersionsOnly {
			t.Fatalf("unexpected version-only marker: %#v", result)
		}
		if result[0].VersionID != "" {
			t.Fatalf("did not expect a historical version during the metadata scan")
		}
	})

	t.Run("keeps a classic soft-deleted blob for restoration", func(t *testing.T) {
		items := []listedBlobItem{{
			item: models.AzureBlobItem{
				Name:      "app.log",
				Deleted:   true,
				DeletedAt: "2026-08-17T10:00:00Z",
			},
		}}

		result := collapseListedBlobs(items, true)
		if len(result) != 1 || !result[0].Deleted || result[0].VersionID != "" {
			t.Fatalf("unexpected classic deleted blob: %#v", result)
		}
	})
}

func blobListPage(names ...string) azblob.ListBlobsFlatResponse {
	items := make([]*container.BlobItem, 0, len(names))
	for _, name := range names {
		blobName := name
		items = append(items, &container.BlobItem{Name: &blobName})
	}
	return azblob.ListBlobsFlatResponse{
		ListBlobsFlatSegmentResponse: container.ListBlobsFlatSegmentResponse{
			Segment: &container.BlobFlatListSegment{BlobItems: items},
		},
	}
}

func TestIsDeletedBlob(t *testing.T) {
	trueValue := true
	falseValue := false

	tests := []struct {
		name            string
		deleted         *bool
		hasVersionsOnly *bool
		want            bool
	}{
		{name: "active blob", deleted: &falseValue, hasVersionsOnly: &falseValue},
		{name: "soft-deleted blob", deleted: &trueValue, want: true},
		{name: "deleted versioned blob", hasVersionsOnly: &trueValue, want: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isDeletedBlob(test.deleted, test.hasVersionsOnly); got != test.want {
				t.Fatalf("isDeletedBlob() = %t, want %t", got, test.want)
			}
		})
	}
}
