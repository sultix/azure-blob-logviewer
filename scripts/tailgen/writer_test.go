package main

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeBlob struct {
	blocks  [][]byte
	content strings.Builder
	resets  int
}

func (f *fakeBlob) appendBlock(_ context.Context, data []byte) error {
	f.blocks = append(f.blocks, append([]byte(nil), data...))
	f.content.Write(data)
	return nil
}

func (f *fakeBlob) reset(context.Context) (int64, error) {
	f.resets++
	f.content.Reset()
	return 0, nil
}

func newFakeWriter() (*blobWriter, *fakeBlob) {
	blob := &fakeBlob{}
	return &blobWriter{appendBlock: blob.appendBlock, resetBlob: blob.reset}, blob
}

func TestSeedFillsBlobToTargetWithinAppendBlockLimit(t *testing.T) {
	writer, blob := newFakeWriter()
	gen := newGenerator(1, defaultRates(), fixedClock())

	const target = 8 * 1024 * 1024
	if err := writer.seed(t.Context(), gen, target); err != nil {
		t.Fatalf("seed returned error: %v", err)
	}

	if writer.size < target {
		t.Errorf("seeded %d bytes, want at least %d", writer.size, target)
	}
	if len(blob.blocks) < 2 {
		t.Errorf("expected the seed to be split across blocks, got %d", len(blob.blocks))
	}
	for i, block := range blob.blocks {
		if len(block) > maxAppendBlockBytes {
			t.Errorf("block %d is %d bytes, exceeding the %d byte limit", i, len(block), maxAppendBlockBytes)
		}
	}
	if got := int64(blob.content.Len()); got != writer.size {
		t.Errorf("tracked size %d but wrote %d bytes", writer.size, got)
	}
}

func TestSeedSkipsWhenBlobIsAlreadyLargeEnough(t *testing.T) {
	writer, blob := newFakeWriter()
	writer.size = 4096

	if err := writer.seed(t.Context(), newGenerator(1, defaultRates(), fixedClock()), 1024); err != nil {
		t.Fatalf("seed returned error: %v", err)
	}
	if len(blob.blocks) != 0 {
		t.Errorf("expected no writes, got %d blocks", len(blob.blocks))
	}
}

func TestStreamAppendsUntilContextIsDone(t *testing.T) {
	writer, blob := newFakeWriter()
	ctx, cancel := context.WithTimeout(t.Context(), 120*time.Millisecond)
	defer cancel()

	opts := &options{lines: 2, interval: 20 * time.Millisecond}
	if err := writer.stream(ctx, newGenerator(2, defaultRates(), fixedClock()), opts); err != nil {
		t.Fatalf("stream returned error: %v", err)
	}

	if len(blob.blocks) < 2 {
		t.Errorf("expected several batches, got %d", len(blob.blocks))
	}
	// Every batch has to grow the blob: the viewer only notices new data when
	// Content-Length changes.
	for i, block := range blob.blocks {
		if len(block) == 0 {
			t.Errorf("batch %d appended no bytes", i)
		}
	}
}

func TestStreamResetsBlobAfterTruncateAfterBatches(t *testing.T) {
	writer, blob := newFakeWriter()
	ctx, cancel := context.WithTimeout(t.Context(), 150*time.Millisecond)
	defer cancel()

	opts := &options{lines: 1, interval: 20 * time.Millisecond, truncateAfter: 2}
	if err := writer.stream(ctx, newGenerator(4, defaultRates(), fixedClock()), opts); err != nil {
		t.Fatalf("stream returned error: %v", err)
	}

	if blob.resets == 0 {
		t.Fatal("expected at least one reset")
	}
	if want := len(blob.blocks) / 2; blob.resets != want {
		t.Errorf("got %d resets for %d batches, want %d", blob.resets, len(blob.blocks), want)
	}
}

func TestAppendRejectsOversizedBlocks(t *testing.T) {
	writer, blob := newFakeWriter()

	err := writer.append(t.Context(), make([]byte, maxAppendBlockBytes+1))
	if err == nil {
		t.Fatal("expected an error for an oversized block")
	}
	if len(blob.blocks) != 0 {
		t.Error("expected no write attempt for an oversized block")
	}
}

func TestAppendPropagatesFailures(t *testing.T) {
	failure := errors.New("append failed")
	writer := &blobWriter{
		appendBlock: func(context.Context, []byte) error { return failure },
		resetBlob:   func(context.Context) (int64, error) { return 0, nil },
	}

	if err := writer.append(t.Context(), []byte("line\n")); !errors.Is(err, failure) {
		t.Errorf("got %v, want %v", err, failure)
	}
	if writer.size != 0 {
		t.Errorf("expected size to stay 0 after a failed append, got %d", writer.size)
	}
}
