package main

import "testing"

func TestParseByteSize(t *testing.T) {
	cases := []struct {
		input string
		want  int64
	}{
		{"", 0},
		{"0", 0},
		{"1024", 1024},
		{"512KB", 512 * 1024},
		{"25MB", 25 * 1024 * 1024},
		{"1.5MB", 1024 * 1024 * 3 / 2},
		{" 1gb ", 1024 * 1024 * 1024},
		{"4096B", 4096},
	}

	for _, testCase := range cases {
		got, err := parseByteSize(testCase.input)
		if err != nil {
			t.Errorf("parseByteSize(%q) returned error: %v", testCase.input, err)
			continue
		}
		if got != testCase.want {
			t.Errorf("parseByteSize(%q) = %d, want %d", testCase.input, got, testCase.want)
		}
	}
}

func TestParseByteSizeRejectsInvalidInput(t *testing.T) {
	for _, input := range []string{"abc", "-5", "-1MB", "12XB"} {
		if _, err := parseByteSize(input); err == nil {
			t.Errorf("expected parseByteSize(%q) to fail", input)
		}
	}
}

func TestFormatBytes(t *testing.T) {
	cases := []struct {
		input int64
		want  string
	}{
		{0, "0 B"},
		{512, "512 B"},
		{1024, "1.0 KB"},
		{25 * 1024 * 1024, "25.0 MB"},
	}

	for _, testCase := range cases {
		if got := formatBytes(testCase.input); got != testCase.want {
			t.Errorf("formatBytes(%d) = %q, want %q", testCase.input, got, testCase.want)
		}
	}
}
