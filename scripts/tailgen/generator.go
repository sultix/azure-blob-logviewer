package main

import (
	"fmt"
	"math/rand/v2"
	"strings"
	"time"
)

// Level tokens the viewer knows about. The frontend highlights them with
// /\[(info|(error|eror)|warn)\]/gi, so the brackets must hug the level name.
// "[EROR]" is a real typo variant the viewer deliberately supports, "[DEBUG]"
// is deliberately not highlighted and serves as the counter-check.
const (
	levelInfo  = "[INFO]"
	levelDebug = "[DEBUG]"
	levelWarn  = "[WARN]"
	levelError = "[ERROR]"
	levelEror  = "[EROR]"
)

// levelColumnWidth pads the level column so messages line up. The padding has
// to sit outside the brackets: "[INFO ]" would no longer match the highlight
// regex.
const levelColumnWidth = 7

const timestampLayout = "2006-01-02 15:04:05.000"

type rates struct {
	errorRate      float64
	warnRate       float64
	erorRate       float64
	stacktraceRate float64
}

type generator struct {
	rnd   *rand.Rand
	rates rates
	now   func() time.Time
	seq   int64
}

func newGenerator(seed uint64, r rates, now func() time.Time) *generator {
	return &generator{
		rnd:   rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15)),
		rates: r,
		now:   now,
	}
}

var (
	threads = []string{
		"main",
		"worker-1",
		"worker-3",
		"worker-7",
		"scheduler-1",
		"http-nio-8080-exec-2",
		"http-nio-8080-exec-9",
		"blob-sync-pool-4",
	}
	upstreams = []string{
		"inventory-api",
		"pricing-api",
		"identity-api",
		"warehouse-api",
	}
	containers = []string{"logs-prod", "logs-staging", "audit-archive"}

	infoMessages = []messageTemplate{
		{"com.example.OrderProcessor", "Processed order %[1]d in %[2]dms"},
		{"com.example.BlobSyncJob", "Uploaded blob logs/run-%[1]d.log (%[2]d bytes)"},
		{"com.example.InventoryClient", "Health check passed for upstream %[3]s"},
		{"com.example.BlobSyncJob", "Flushed %[2]d events to container %[4]s"},
	}
	debugMessages = []messageTemplate{
		{"com.example.cache.LookupCache", "Cache hit ratio 0.%[2]d over %[1]d lookups"},
		{"com.example.InventoryClient", "Acquired connection %[2]d from pool %[3]s"},
		{"com.example.OrderProcessor", "Payload for order %[1]d is %[2]d bytes after compression"},
	}
	warnMessages = []messageTemplate{
		{"com.example.RetryPolicy", "Retry %[5]d/5 for upstream %[3]s"},
		{"com.example.OrderProcessor", "Queue depth %[2]d exceeds soft limit 500"},
		{"com.example.InventoryClient", "Slow request: %[2]dms for GET /api/orders/%[1]d"},
		{"com.example.auth.TokenRefresher", "Token for %[3]s expires in %[2]d seconds"},
	}
	errorMessages = []messageTemplate{
		{"com.example.OrderProcessor", "Failed to process order %[1]d: connection reset by peer"},
		{"com.example.BlobSyncJob", "Sync failed for container %[4]s after %[5]d attempts"},
		{"com.example.BlobSyncJob", "Unhandled exception in job blob-sync-%[1]d"},
		{"com.example.InventoryClient", "Upstream %[3]s returned 503 after %[2]dms"},
	}
)

// messageTemplate keeps a message and the logger that would realistically emit
// it together, so generated lines read like a real application log.
type messageTemplate struct {
	logger string
	text   string
}

// appendRecord writes one log record to b. A record is usually a single line
// but may carry a multi-line stack trace. It reports how many lines it wrote.
func (g *generator) appendRecord(b *strings.Builder) int {
	g.seq++

	level := g.pickLevel()
	logger, message := g.buildMessage(level)

	b.WriteString(g.now().Format(timestampLayout))
	b.WriteByte(' ')
	b.WriteString(level)
	for i := len(level); i < levelColumnWidth; i++ {
		b.WriteByte(' ')
	}
	fmt.Fprintf(
		b,
		" [%s] %s - %s\n",
		threads[g.rnd.IntN(len(threads))],
		logger,
		message,
	)

	lines := 1
	if isErrorLevel(level) && g.rnd.Float64() < g.rates.stacktraceRate {
		lines += g.appendStackTrace(b, logger)
	}
	return lines
}

func (g *generator) pickLevel() string {
	roll := g.rnd.Float64()
	switch {
	case roll < g.rates.errorRate:
		if g.rnd.Float64() < g.rates.erorRate {
			return levelEror
		}
		return levelError
	case roll < g.rates.errorRate+g.rates.warnRate:
		return levelWarn
	case g.rnd.Float64() < 0.25:
		return levelDebug
	default:
		return levelInfo
	}
}

func (g *generator) buildMessage(level string) (logger string, message string) {
	var templates []messageTemplate
	switch level {
	case levelError, levelEror:
		templates = errorMessages
	case levelWarn:
		templates = warnMessages
	case levelDebug:
		templates = debugMessages
	default:
		templates = infoMessages
	}

	template := templates[g.rnd.IntN(len(templates))]
	return template.logger, fmt.Sprintf(
		template.text,
		4000+g.seq,
		g.rnd.IntN(900)+10,
		upstreams[g.rnd.IntN(len(upstreams))],
		containers[g.rnd.IntN(len(containers))],
		g.rnd.IntN(5)+1,
	)
}

func (g *generator) appendStackTrace(b *strings.Builder, logger string) int {
	class := simpleClassName(logger)
	fmt.Fprintf(
		b,
		"    java.io.IOException: connection reset by peer\n"+
			"        at %s.run(%s.java:%d)\n"+
			"        at java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1136)\n"+
			"        ... %d more\n",
		logger,
		class,
		g.rnd.IntN(400)+40,
		g.rnd.IntN(20)+3,
	)
	return 4
}

func simpleClassName(logger string) string {
	if index := strings.LastIndexByte(logger, '.'); index >= 0 {
		return logger[index+1:]
	}
	return logger
}

func isErrorLevel(level string) bool {
	return level == levelError || level == levelEror
}
