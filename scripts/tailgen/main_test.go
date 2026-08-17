package main

import "testing"

func TestBuildBlobURL(t *testing.T) {
	cases := []struct {
		account   string
		container string
		blob      string
		want      string
	}{
		{
			"logstore",
			"logs",
			"live.log",
			"https://logstore.blob.core.windows.net/logs/live.log",
		},
		{
			// Slashes are virtual folders and have to survive escaping.
			"logstore",
			"logs",
			"livetest/live.log",
			"https://logstore.blob.core.windows.net/logs/livetest/live.log",
		},
		{
			"logstore",
			"logs",
			"/leading-slash.log",
			"https://logstore.blob.core.windows.net/logs/leading-slash.log",
		},
		{
			"logstore",
			"logs",
			"live log.log",
			"https://logstore.blob.core.windows.net/logs/live%20log.log",
		},
	}

	for _, testCase := range cases {
		got := buildBlobURL(testCase.account, testCase.container, testCase.blob)
		if got != testCase.want {
			t.Errorf("buildBlobURL(%q, %q, %q) = %q, want %q",
				testCase.account, testCase.container, testCase.blob, got, testCase.want)
		}
	}
}

func TestRedactSASHidesTheToken(t *testing.T) {
	const secret = "sv=2024-01-01&sig=verysecret"
	got := redactSAS("https://logstore.blob.core.windows.net/logs/live.log?" + secret)

	if got != "https://logstore.blob.core.windows.net/logs/live.log?<sas>" {
		t.Errorf("unexpected redaction result %q", got)
	}
}

func TestRedactSASLeavesPlainURLsAlone(t *testing.T) {
	const plain = "https://logstore.blob.core.windows.net/logs/live.log"

	if got := redactSAS(plain); got != plain {
		t.Errorf("redactSAS(%q) = %q, want it unchanged", plain, got)
	}
}
