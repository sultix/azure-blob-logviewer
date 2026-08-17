// Command tailgen appends synthetic log lines to an Azure append blob so the
// viewer's live (tail) mode can be exercised against real data.
//
// The viewer polls the blob's Content-Length and range-downloads whatever grew
// since the last poll, so any writer that makes the blob larger is enough to
// drive it. An append blob is used because it can be extended without
// re-uploading the whole file.
//
//	go run ./scripts/tailgen -account <account> -container <container> -reset
//
// See the "Test the live mode" section in README.md.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		fmt.Fprintf(os.Stderr, "tailgen: %v\n", err)
		os.Exit(1)
	}
}

type options struct {
	account       string
	container     string
	blob          string
	sasURL        string
	interval      time.Duration
	duration      time.Duration
	lines         int
	reset         bool
	seedBytes     string
	truncateAfter int
	seed          uint64
	rates         rates
}

func parseOptions() (*options, error) {
	opts := &options{}
	flag.StringVar(&opts.account, "account", "", "storage account name (required unless -sas-url is set)")
	flag.StringVar(&opts.container, "container", "", "container name (required unless -sas-url is set)")
	flag.StringVar(&opts.blob, "blob", "livetest/live.log", "blob name")
	flag.StringVar(&opts.sasURL, "sas-url", "", "full blob SAS URL, used instead of account/container/blob and az login")
	flag.DurationVar(&opts.interval, "interval", time.Second, "pause between two batches")
	flag.DurationVar(&opts.duration, "duration", 0, "total runtime, 0 runs until interrupted")
	flag.IntVar(&opts.lines, "lines", 3, "log records appended per batch")
	flag.BoolVar(&opts.reset, "reset", false, "delete and recreate the blob before appending")
	flag.StringVar(&opts.seedBytes, "seed-bytes", "0", "pre-fill the blob to this size before going live, e.g. 25MB")
	flag.IntVar(&opts.truncateAfter, "truncate-after", 0, "recreate the blob after N batches to exercise the shrink path")
	flag.Uint64Var(&opts.seed, "seed", 0, "RNG seed, 0 picks a random one")
	flag.Float64Var(&opts.rates.errorRate, "error-rate", 0.1, "share of [ERROR] records")
	flag.Float64Var(&opts.rates.warnRate, "warn-rate", 0.2, "share of [WARN] records")
	flag.Float64Var(&opts.rates.erorRate, "eror-rate", 0.05, "share of error records using the [EROR] typo token")
	flag.Float64Var(&opts.rates.stacktraceRate, "stacktrace-rate", 0.3, "share of error records with a stack trace")
	flag.Parse()

	if opts.sasURL == "" && (opts.account == "" || opts.container == "") {
		return nil, errors.New("either -sas-url or both -account and -container are required")
	}
	if opts.lines < 1 {
		return nil, errors.New("-lines must be at least 1")
	}
	if opts.interval < 0 {
		return nil, errors.New("-interval must not be negative")
	}
	if opts.rates.errorRate+opts.rates.warnRate > 1 {
		return nil, errors.New("-error-rate plus -warn-rate must not exceed 1")
	}

	return opts, nil
}

func run() error {
	opts, err := parseOptions()
	if err != nil {
		flag.Usage()
		return err
	}

	seedTarget, err := parseByteSize(opts.seedBytes)
	if err != nil {
		return fmt.Errorf("invalid -seed-bytes: %w", err)
	}

	blobURL := opts.sasURL
	if blobURL == "" {
		blobURL = buildBlobURL(opts.account, opts.container, opts.blob)
	}

	blob, err := newAzureAppendBlob(blobURL, opts.sasURL != "")
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if opts.duration > 0 {
		timedCtx, cancel := context.WithTimeout(ctx, opts.duration)
		defer cancel()
		ctx = timedCtx
	}

	seed := opts.seed
	if seed == 0 {
		seed = uint64(time.Now().UnixNano())
	}
	gen := newGenerator(seed, opts.rates, time.Now)

	size, err := blob.open(ctx, opts.reset)
	if err != nil {
		return err
	}
	writer := &blobWriter{
		appendBlock: blob.appendBlock,
		resetBlob:   blob.reset,
		size:        size,
	}

	fmt.Printf(
		"tailgen: writing to %s (seed %d, starting at %s)\n",
		redactSAS(blobURL),
		seed,
		formatBytes(size),
	)

	if seedTarget > 0 {
		if err := writer.seed(ctx, gen, seedTarget); err != nil {
			return err
		}
	}

	return writer.stream(ctx, gen, opts)
}

// buildBlobURL keeps slashes inside the blob name intact so virtual folders
// such as "livetest/live.log" address the blob the viewer lists.
func buildBlobURL(account, container, blob string) string {
	target := url.URL{
		Scheme: "https",
		Host:   fmt.Sprintf("%s.blob.core.windows.net", account),
		Path:   fmt.Sprintf("/%s/%s", container, strings.TrimPrefix(blob, "/")),
	}
	return target.String()
}

// redactSAS strips the query string so a SAS token is never printed.
func redactSAS(blobURL string) string {
	if index := strings.IndexByte(blobURL, '?'); index >= 0 {
		return blobURL[:index] + "?<sas>"
	}
	return blobURL
}
