package app

import (
	"path/filepath"
	"testing"
)

func TestOpenLogsDirectoryRejectsUnavailableDirectory(t *testing.T) {
	application := &App{}

	if err := application.OpenLogsDirectory(); err == nil {
		t.Fatal("OpenLogsDirectory() expected an unavailable-directory error")
	}
}

func TestOpenLogsDirectoryCreatesAndOpensConfiguredDirectory(t *testing.T) {
	logDirectory := filepath.Join(t.TempDir(), "nested", "logs")
	openedDirectory := ""
	application := &App{
		logDirectory: logDirectory,
		openLogDirectory: func(directory string) error {
			openedDirectory = directory
			return nil
		},
	}

	if err := application.OpenLogsDirectory(); err != nil {
		t.Fatalf("OpenLogsDirectory() error = %v", err)
	}
	wantDirectory, err := filepath.Abs(logDirectory)
	if err != nil {
		t.Fatalf("filepath.Abs() error = %v", err)
	}
	if openedDirectory != wantDirectory {
		t.Fatalf("opened directory = %q, want %q", openedDirectory, wantDirectory)
	}
}
