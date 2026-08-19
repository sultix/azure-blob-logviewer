package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const applicationLogDirectoryName = "Azure Blob Logviewer"

type dailyLogWriter struct {
	mu           sync.Mutex
	logDirectory string
	logPath      string
	currentDate  string
	file         *os.File
	now          func() time.Time
}

func configureApplicationLogging() (*dailyLogWriter, string, error) {
	configDirectory, err := os.UserConfigDir()
	if err != nil {
		return nil, "", fmt.Errorf("resolve user config directory: %w", err)
	}

	logWriter, logPath, err := openApplicationLog(configDirectory, time.Now)
	if err != nil {
		return nil, "", err
	}

	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)
	// Windows GUI applications do not necessarily have a valid stderr handle.
	log.SetOutput(logWriter)
	return logWriter, logPath, nil
}

func openApplicationLog(
	configDirectory string,
	now func() time.Time,
) (*dailyLogWriter, string, error) {
	logDirectory := filepath.Join(configDirectory, applicationLogDirectoryName, "logs")
	if err := os.MkdirAll(logDirectory, 0o700); err != nil {
		return nil, "", fmt.Errorf("create application log directory: %w", err)
	}

	logPath := filepath.Join(logDirectory, "application.log")
	writer := &dailyLogWriter{
		logDirectory: logDirectory,
		logPath:      logPath,
		now:          now,
	}
	if err := writer.openCurrentFile(); err != nil {
		return nil, "", err
	}

	return writer, logPath, nil
}

func (w *dailyLogWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	today := w.date(w.now())
	if today != w.currentDate {
		if err := w.rotate(w.currentDate); err != nil {
			return 0, err
		}
		if err := w.openFile(today); err != nil {
			return 0, err
		}
	}

	return w.file.Write(data)
}

func (w *dailyLogWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

func (w *dailyLogWriter) openCurrentFile() error {
	now := w.now()
	today := w.date(now)

	if info, err := os.Stat(w.logPath); err == nil {
		fileDate := w.date(info.ModTime())
		if info.Size() > 0 && fileDate != today {
			if err := w.rotate(fileDate); err != nil {
				return err
			}
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect application log: %w", err)
	}

	return w.openFile(today)
}

func (w *dailyLogWriter) openFile(date string) error {
	logFile, err := os.OpenFile(w.logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open application log: %w", err)
	}

	w.file = logFile
	w.currentDate = date
	return nil
}

func (w *dailyLogWriter) rotate(date string) error {
	if w.file != nil {
		if err := w.file.Close(); err != nil {
			return fmt.Errorf("close application log for rotation: %w", err)
		}
		w.file = nil
	}

	info, err := os.Stat(w.logPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect application log for rotation: %w", err)
	}
	if info.Size() == 0 {
		return os.Remove(w.logPath)
	}

	archivePath := filepath.Join(w.logDirectory, fmt.Sprintf("application-%s.log", date))
	if _, err := os.Stat(archivePath); os.IsNotExist(err) {
		if err := os.Rename(w.logPath, archivePath); err != nil {
			return fmt.Errorf("rotate application log: %w", err)
		}
		return nil
	} else if err != nil {
		return fmt.Errorf("inspect archived application log: %w", err)
	}

	if err := appendFile(w.logPath, archivePath); err != nil {
		return err
	}
	if err := os.Remove(w.logPath); err != nil {
		return fmt.Errorf("remove rotated application log: %w", err)
	}
	return nil
}

func (w *dailyLogWriter) date(value time.Time) string {
	return value.In(w.now().Location()).Format("2006-01-02")
}

func appendFile(sourcePath, targetPath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open application log for rotation: %w", err)
	}
	defer func() {
		_ = source.Close()
	}()

	target, err := os.OpenFile(targetPath, os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open archived application log: %w", err)
	}
	defer func() {
		_ = target.Close()
	}()

	if _, err := io.Copy(target, source); err != nil {
		return fmt.Errorf("append archived application log: %w", err)
	}
	return nil
}
