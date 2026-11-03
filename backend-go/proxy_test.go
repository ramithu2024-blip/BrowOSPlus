package main

import (
	"net"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

func TestIsPrivateIP(t *testing.T) {
	cases := []struct {
		ip   string
		want bool
	}{
		{"127.0.0.1", true},
		{"10.0.0.1", true},
		{"192.168.1.1", true},
		{"172.16.0.1", true},
		{"169.254.1.1", true},
		{"8.8.8.8", false},
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		if got := isPrivateIP(ip); got != c.want {
			t.Fatalf("%s: got %v want %v", c.ip, got, c.want)
		}
	}
}

func TestValidateTarget(t *testing.T) {
	if _, err := validateTarget("ftp://example.com"); err == nil {
		t.Fatal("expected error")
	}
	if _, err := validateTarget("http://localhost/"); err == nil {
		t.Fatal("expected error")
	}
	if _, err := validateTarget("http://192.168.0.1/"); err == nil {
		t.Fatal("expected error")
	}
	if _, err := validateTarget("https://example.com/path"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()
	healthHandler(rr, req)
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
}

func TestProxyExample(t *testing.T) {
	if os.Getenv("SKIP_NETWORK") == "1" {
		t.Skip()
	}
	port = 8899
	host = "127.0.0.1"
	maxResp = 10 * 1024 * 1024
	timeout = 15 * time.Second
	rateMax = 1000
	rateWindow = time.Minute
	setPublicBase("http://127.0.0.1:8899")
	req := httptest.NewRequest("GET", "/proxy?url="+url.QueryEscape("https://example.com"), nil)
	rr := httptest.NewRecorder()
	proxyHandler(rr, req)
	if rr.Code != 200 {
		t.Fatalf("status %d body %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "Example Domain") {
		t.Fatal("expected Example Domain")
	}
}

func TestProxySSRF(t *testing.T) {
	req := httptest.NewRequest("GET", "/proxy?url="+url.QueryEscape("http://127.0.0.1:22"), nil)
	rr := httptest.NewRecorder()
	proxyHandler(rr, req)
	if rr.Code != 400 {
		t.Fatalf("status %d", rr.Code)
	}
}

func contains(s, sub string) bool { return strings.Contains(s, sub) }
