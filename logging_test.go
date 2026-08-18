package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestOpenApplicationLogCreatesPrivateLogFile(t *testing.T) {
	configDirectory := t.TempDir()
	now := fixedTime("2026-08-17T10:00:00Z")

	logWriter, logPath, err := openApplicationLog(configDirectory, func() time.Time {
		return now
	})
	if err != nil {
		t.Fatalf("openApplicationLog() error = %v", err)
	}
	t.Cleanup(func() {
		_ = logWriter.Close()
	})

	wantPath := filepath.Join(
		configDirectory,
		applicationLogDirectoryName,
		"logs",
		"application.log",
	)
	if logPath != wantPath {
		t.Fatalf("openApplicationLog() path = %q, want %q", logPath, wantPath)
	}
	if _, err := logWriter.Write([]byte("live diagnostic\n")); err != nil {
		t.Fatalf("write application log: %v", err)
	}
	if err := logWriter.Close(); err != nil {
		t.Fatalf("close application log: %v", err)
	}

	assertFileContent(t, logPath, "live diagnostic\n")
}

func TestApplicationLogRotatesAtDateChange(t *testing.T) {
	configDirectory := t.TempDir()
	now := fixedTime("2026-08-17T23:59:00Z")
	logWriter, logPath, err := openApplicationLog(configDirectory, func() time.Time {
		return now
	})
	if err != nil {
		t.Fatalf("openApplicationLog() error = %v", err)
	}
	t.Cleanup(func() {
		_ = logWriter.Close()
	})

	if _, err := logWriter.Write([]byte("day one\n")); err != nil {
		t.Fatalf("write first application log: %v", err)
	}
	now = fixedTime("2026-08-18T00:01:00Z")
	if _, err := logWriter.Write([]byte("day two\n")); err != nil {
		t.Fatalf("write second application log: %v", err)
	}
	if err := logWriter.Close(); err != nil {
		t.Fatalf("close application log: %v", err)
	}

	archivePath := filepath.Join(filepath.Dir(logPath), "application-2026-08-17.log")
	assertFileContent(t, archivePath, "day one\n")
	assertFileContent(t, logPath, "day two\n")
}

func TestOpenApplicationLogRotatesPreviousDayAfterRestart(t *testing.T) {
	configDirectory := t.TempDir()
	logDirectory := filepath.Join(configDirectory, applicationLogDirectoryName, "logs")
	if err := os.MkdirAll(logDirectory, 0o700); err != nil {
		t.Fatalf("create log directory: %v", err)
	}
	logPath := filepath.Join(logDirectory, "application.log")
	if err := os.WriteFile(logPath, []byte("previous run\n"), 0o600); err != nil {
		t.Fatalf("write previous application log: %v", err)
	}
	previousDay := fixedTime("2026-08-17T20:00:00Z")
	if err := os.Chtimes(logPath, previousDay, previousDay); err != nil {
		t.Fatalf("set previous application log time: %v", err)
	}

	now := fixedTime("2026-08-18T08:00:00Z")
	logWriter, _, err := openApplicationLog(configDirectory, func() time.Time {
		return now
	})
	if err != nil {
		t.Fatalf("openApplicationLog() error = %v", err)
	}
	if err := logWriter.Close(); err != nil {
		t.Fatalf("close application log: %v", err)
	}

	archivePath := filepath.Join(logDirectory, "application-2026-08-17.log")
	assertFileContent(t, archivePath, "previous run\n")
}

func assertFileContent(t *testing.T, path, want string) {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if string(content) != want {
		t.Fatalf("%s content = %q, want %q", path, content, want)
	}
}

func fixedTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return parsed
}
