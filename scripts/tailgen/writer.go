package main

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// maxAppendBlockBytes is the Azure append blob limit for a single block.
const maxAppendBlockBytes = 4 * 1024 * 1024

// seedBlockTargetBytes keeps seed blocks below the hard limit so a record that
// straddles the boundary can never push a block over it.
const seedBlockTargetBytes = 3 * 1024 * 1024

// blobWriter owns the append loop and stays independent of Azure: the two func
// fields are supplied by the caller, the same seam BlobViewService uses for its
// blob client so the logic can be tested without a storage account.
type blobWriter struct {
	appendBlock func(ctx context.Context, data []byte) error
	// resetBlob deletes and recreates the blob and reports the size to
	// continue from, which is 0 for a fresh blob.
	resetBlob func(ctx context.Context) (int64, error)
	size      int64
}

// seed pre-fills the blob so the viewer opens in a state worth testing. Above
// largeBlobThresholdBytes (20 MB) a tail session starts in its preview phase
// instead of being indexed right away.
func (w *blobWriter) seed(ctx context.Context, gen *generator, target int64) error {
	if w.size >= target {
		fmt.Printf("tailgen: blob already at %s, skipping seed\n", formatBytes(w.size))
		return nil
	}

	fmt.Printf("tailgen: seeding from %s to %s\n", formatBytes(w.size), formatBytes(target))
	for w.size < target {
		var block strings.Builder
		for block.Len() < seedBlockTargetBytes && w.size+int64(block.Len()) < target {
			gen.appendRecord(&block)
		}
		if err := w.append(ctx, []byte(block.String())); err != nil {
			return err
		}
		fmt.Printf("tailgen: seeded %s / %s\n", formatBytes(w.size), formatBytes(target))
	}
	return nil
}

func (w *blobWriter) stream(ctx context.Context, gen *generator, opts *options) error {
	batches := 0
	for {
		var batch strings.Builder
		lines := 0
		for range opts.lines {
			lines += gen.appendRecord(&batch)
		}

		if err := w.append(ctx, []byte(batch.String())); err != nil {
			return err
		}
		batches++
		fmt.Printf("tailgen: appended %d lines, blob size %s\n", lines, formatBytes(w.size))

		if opts.truncateAfter > 0 && batches%opts.truncateAfter == 0 {
			size, err := w.resetBlob(ctx)
			if err != nil {
				return err
			}
			w.size = size
			fmt.Printf("tailgen: recreated blob, size back to %s\n", formatBytes(w.size))
		}

		if err := sleep(ctx, opts.interval); err != nil {
			fmt.Printf("tailgen: stopped, final blob size %s\n", formatBytes(w.size))
			return nil
		}
	}
}

func (w *blobWriter) append(ctx context.Context, data []byte) error {
	if len(data) == 0 {
		return nil
	}
	if len(data) > maxAppendBlockBytes {
		return fmt.Errorf("append block of %d bytes exceeds the %d byte limit", len(data), maxAppendBlockBytes)
	}

	if err := w.appendBlock(ctx, data); err != nil {
		return err
	}
	w.size += int64(len(data))
	return nil
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}

	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
