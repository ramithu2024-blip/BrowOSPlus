package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var (
	port         int
	host         string
	allowRemote  bool
	maxResp      int64
	timeout      time.Duration
	rateMax      int
	rateWindow   time.Duration
	publicURL    string
	staticDir    string
)

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func main() {
	flag.IntVar(&port, "port", envInt("PORT", 8787), "port")
	flag.StringVar(&host, "host", envOrDefault("HOST", "127.0.0.1"), "host")
	flag.BoolVar(&allowRemote, "allow-remote", os.Getenv("ALLOW_REMOTE") == "1", "allow remote access")
	flag.Int64Var(&maxResp, "max-response", int64(envInt("MAX_RESPONSE_SIZE", 10*1024*1024)), "max response size")
	flag.DurationVar(&timeout, "timeout", parseDuration(envOrDefault("REQUEST_TIMEOUT", "15s")), "request timeout")
	flag.IntVar(&rateMax, "rate-max", envInt("RATE_LIMIT_MAX", 120), "rate limit max")
	flag.DurationVar(&rateWindow, "rate-window", parseDuration(envOrDefault("RATE_LIMIT_WINDOW", "60s")), "rate limit window")
	flag.StringVar(&publicURL, "public-url", envOrDefault("PUBLIC_URL", ""), "public base url")
	flag.StringVar(&staticDir, "static-dir", envOrDefault("STATIC_DIR", "."), "static files directory")
	flag.Parse()

	if publicURL == "" {
		publicURL = fmt.Sprintf("http://127.0.0.1:%d", port)
	}
	// ensure env for rewrite package-level? rewrite uses envOrDefault/publicBase? We'll set via global
	setPublicBase(publicURL)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/proxy", proxyHandler)

	// Serve BrowOS+ static files (including Craft apps) when available
	fs := http.FileServer(http.Dir(staticDir))
	mux.Handle("/", fs)

	// rate limiter + loopback middleware
	handler := middleware(mux)

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", host, port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("BrowOS+ backend listening on http://%s:%d", host, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen error: %v", err)
		}
	}()

	// graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down backend...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func parseDuration(s string) time.Duration {
	// support seconds number
	if d, err := time.ParseDuration(s); err == nil {
		return d
	}
	if n, err := strconv.Atoi(s); err == nil {
		return time.Duration(n) * time.Second
	}
	// if milliseconds? try
	if n, err := strconv.Atoi(strings.TrimSuffix(s, "ms")); err == nil && strings.HasSuffix(s, "ms") {
		return time.Duration(n) * time.Millisecond
	}
	return 15 * time.Second
}

// global public base for rewrite
var publicBaseURL string

func setPublicBase(u string) { publicBaseURL = strings.TrimRight(u, "/") }

func envOrDefaultPublic() string {
	if publicBaseURL != "" {
		return publicBaseURL
	}
	return publicBase()
}
