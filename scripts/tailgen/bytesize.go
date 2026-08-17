package main

import (
	"fmt"
	"strconv"
	"strings"
)

var byteUnits = []struct {
	suffix string
	factor int64
}{
	{"GB", 1024 * 1024 * 1024},
	{"MB", 1024 * 1024},
	{"KB", 1024},
	{"B", 1},
}

// parseByteSize accepts plain byte counts as well as "512KB", "25MB" or "1GB".
func parseByteSize(value string) (int64, error) {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if normalized == "" {
		return 0, nil
	}

	for _, unit := range byteUnits {
		if !strings.HasSuffix(normalized, unit.suffix) {
			continue
		}
		digits := strings.TrimSpace(strings.TrimSuffix(normalized, unit.suffix))
		amount, err := strconv.ParseFloat(digits, 64)
		if err != nil {
			return 0, fmt.Errorf("%q is not a valid size", value)
		}
		if amount < 0 {
			return 0, fmt.Errorf("%q must not be negative", value)
		}
		return int64(amount * float64(unit.factor)), nil
	}

	amount, err := strconv.ParseInt(normalized, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%q is not a valid size", value)
	}
	if amount < 0 {
		return 0, fmt.Errorf("%q must not be negative", value)
	}
	return amount, nil
}

func formatBytes(size int64) string {
	for _, unit := range byteUnits {
		if size >= unit.factor && unit.factor > 1 {
			return fmt.Sprintf("%.1f %s", float64(size)/float64(unit.factor), unit.suffix)
		}
	}
	return fmt.Sprintf("%d B", size)
}
