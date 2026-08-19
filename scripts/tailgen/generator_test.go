package main

import (
	"regexp"
	"strings"
	"testing"
	"time"
)

// frontendLevelPattern is the regex the viewer uses to highlight log levels
// (LOG_LEVEL_TOKEN_PATTERN in
// frontend/src/app/features/logs/components/logs-detail-panel/logs-detail-panel.component.ts).
// Generated records are worthless for testing the viewer if they do not match
// it, so the tests assert against the real pattern.
var frontendLevelPattern = regexp.MustCompile(`(?i)\[(info|(error|eror)|warn)\]`)

func fixedClock() func() time.Time {
	now := time.Date(2026, time.August, 15, 13, 42, 1, 123_000_000, time.UTC)
	return func() time.Time {
		now = now.Add(250 * time.Millisecond)
		return now
	}
}

func generate(t *testing.T, seed uint64, r rates, records int) string {
	t.Helper()

	gen := newGenerator(seed, r, fixedClock())
	var builder strings.Builder
	for range records {
		gen.appendRecord(&builder)
	}
	return builder.String()
}

func defaultRates() rates {
	return rates{errorRate: 0.1, warnRate: 0.2, erorRate: 0.05, stacktraceRate: 0.3}
}

func TestAppendRecordEmitsHighlightableLevels(t *testing.T) {
	output := generate(t, 42, defaultRates(), 200)

	matches := frontendLevelPattern.FindAllString(output, -1)
	if len(matches) == 0 {
		t.Fatal("expected generated records to contain highlightable level tokens")
	}

	seen := map[string]bool{}
	for _, match := range matches {
		seen[match] = true
	}
	for _, level := range []string{levelInfo, levelWarn, levelError} {
		if !seen[level] {
			t.Errorf("expected %s to appear in 200 records, got levels %v", level, seen)
		}
	}
}

func TestAppendRecordKeepsLevelTokenUnpadded(t *testing.T) {
	output := generate(t, 7, defaultRates(), 200)

	// "[INFO ]" would line the columns up but stops the frontend regex from
	// matching, so the padding has to sit outside the brackets.
	for _, padded := range []string{"[INFO ]", "[WARN ]", "[EROR ]", "[ ERROR]"} {
		if strings.Contains(output, padded) {
			t.Errorf("generated output contains padded level token %q", padded)
		}
	}
}

func TestAppendRecordLeavesDebugUnhighlighted(t *testing.T) {
	if frontendLevelPattern.MatchString(levelDebug) {
		t.Fatalf("%s must stay unhighlighted to serve as the counter-check", levelDebug)
	}

	output := generate(t, 3, defaultRates(), 300)
	if !strings.Contains(output, levelDebug) {
		t.Error("expected at least one [DEBUG] record in 300 records")
	}
}

func TestAppendRecordTerminatesEveryLine(t *testing.T) {
	output := generate(t, 11, defaultRates(), 50)

	if !strings.HasSuffix(output, "\n") {
		t.Error("expected generated output to end with a newline")
	}
	if strings.Contains(output, "\r") {
		t.Error("expected LF-only line endings")
	}
}

func TestAppendRecordReportsLineCount(t *testing.T) {
	gen := newGenerator(23, defaultRates(), fixedClock())

	var builder strings.Builder
	total := 0
	for range 100 {
		total += gen.appendRecord(&builder)
	}

	if got := strings.Count(builder.String(), "\n"); got != total {
		t.Errorf("reported %d lines but wrote %d", total, got)
	}
}

func TestAppendRecordIsDeterministicForAGivenSeed(t *testing.T) {
	first := generate(t, 99, defaultRates(), 100)
	second := generate(t, 99, defaultRates(), 100)

	if first != second {
		t.Error("expected the same seed and clock to produce identical output")
	}
	if third := generate(t, 100, defaultRates(), 100); third == first {
		t.Error("expected different seeds to produce different output")
	}
}

func TestAppendRecordEmitsStackTracesForErrors(t *testing.T) {
	r := defaultRates()
	r.errorRate = 1
	r.stacktraceRate = 1

	output := generate(t, 5, r, 5)
	if strings.Count(output, "java.io.IOException") != 5 {
		t.Errorf("expected one stack trace per error record, got:\n%s", output)
	}
}

func TestAppendRecordRespectsExclusiveRates(t *testing.T) {
	r := defaultRates()
	r.errorRate = 0
	r.warnRate = 0

	output := generate(t, 17, r, 100)
	if strings.Contains(output, levelError) || strings.Contains(output, levelEror) {
		t.Error("expected no error records when -error-rate is 0")
	}
	if strings.Contains(output, levelWarn) {
		t.Error("expected no warn records when -warn-rate is 0")
	}
}
