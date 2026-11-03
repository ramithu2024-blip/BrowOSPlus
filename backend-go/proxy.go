package main

import (
	"bytes"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type rateBucket struct {
	count int
	reset time.Time
}

var (
	rateMu      sync.Mutex
	rateBuckets = map[string]*rateBucket{}
)

func middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Cookie, Authorization, Accept, Accept-Language, User-Agent, Origin, Referer")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}

		// rate limit
		ip := clientIP(r)
		if !allowRate(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(429)
			fmt.Fprintf(w, `{"error":"Rate limit exceeded"}`)
			return
		}

		// loopback restriction
		if !allowRemote {
			if !isLoopbackIPStr(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(403)
				fmt.Fprintf(w, `{"error":"Proxy access restricted to local user"}`)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func allowRate(ip string) bool {
	rateMu.Lock()
	defer rateMu.Unlock()
	now := time.Now()
	b, ok := rateBuckets[ip]
	if !ok || now.After(b.reset) {
		rateBuckets[ip] = &rateBucket{count: 1, reset: now.Add(rateWindow)}
		return true
	}
	if b.count >= rateMax {
		return false
	}
	b.count++
	return true
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","version":"1.0.0","time":"%s","maxResponseSize":%d,"timeout":%d}`, time.Now().UTC().Format(time.RFC3339), maxResp, int(timeout.Seconds()))
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		w.WriteHeader(404)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"error":"Not found"}`)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"name":"BrowOS+ backend","endpoints":["/health","/proxy?url=<encoded-url>"]}`)
}

var adDomains = []string{
	"doubleclick.net",
	"googlesyndication.com",
	"googleadservices.com",
	"google-analytics.com",
	"googletagmanager.com",
	"googletagservices.com",
	"facebook.net",
	"connect.facebook.net",
	"adservice.google.com",
	"pagead2.googlesyndication.com",
}

func isAdDomain(host string) bool {
	host = strings.ToLower(host)
	for _, d := range adDomains {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	rawURL := r.URL.Query().Get("url")
	if rawURL == "" {
		writeErr(w, 400, "Missing url parameter")
		return
	}
	parsed, err := validateTarget(rawURL)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}

	adblock := r.URL.Query().Get("adblock") == "1" || r.URL.Query().Get("adblock") == "true"
	if adblock && isAdDomain(parsed.Hostname()) {
		w.Header().Set("X-BrowOS-AdBlocked", "1")
		w.WriteHeader(204)
		return
	}

	// read body
	var bodyBytes []byte
	if r.Body != nil {
		lr := io.LimitReader(r.Body, 2*1024*1024+1)
		b, err := io.ReadAll(lr)
		if err != nil {
			writeErr(w, 400, "Failed to read body")
			return
		}
		if len(b) > 2*1024*1024 {
			writeErr(w, 413, "Request body too large")
			return
		}
		bodyBytes = b
	}

	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	current := parsed.String()
	redirects := 0
	for {
		var body io.Reader
		if len(bodyBytes) > 0 && !isNoBodyMethod(r.Method) {
			body = bytes.NewReader(bodyBytes)
		}
		req, err := http.NewRequest(r.Method, current, body)
		if err != nil {
			writeErr(w, 502, "Bad request")
			return
		}
		// forward headers (allowlist)
		for _, h := range []string{"Cookie", "Accept", "Accept-Language", "User-Agent", "Content-Type", "Authorization", "Origin"} {
			if v := r.Header.Get(h); v != "" {
				req.Header.Set(h, v)
			}
		}
		if req.Header.Get("User-Agent") == "" {
			req.Header.Set("User-Agent", "Mozilla/5.0 (BrowOS+ Proxy) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		}
		if req.Header.Get("Accept-Language") == "" {
			req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		}
		// do not forward accept-encoding; let transport handle gzip
		req.Header.Del("Accept-Encoding")
		if r.Referer() != "" {
			req.Header.Set("Referer", r.Referer())
		}

		resp, err := client.Do(req)
		if err != nil {
			writeErr(w, 502, err.Error())
			return
		}

		// redirect?
		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			loc := resp.Header.Get("Location")
			resp.Body.Close()
			if loc == "" {
				writeErr(w, 502, "Redirect without location")
				return
			}
			nextURL, err := url.Parse(loc)
			if err != nil {
				writeErr(w, 502, "Bad redirect")
				return
			}
			resolved := currentURL(current, nextURL)
			if _, err := validateTarget(resolved); err != nil {
				writeErr(w, 400, err.Error())
				return
			}
			current = resolved
			redirects++
			if redirects > 10 {
				writeErr(w, 502, "Too many redirects")
				return
			}
			continue
		}

		// read body with limit
		lr := io.LimitReader(resp.Body, maxResp+1)
		buf, err := io.ReadAll(lr)
		resp.Body.Close()
		if err != nil {
			writeErr(w, 502, "Failed to read response")
			return
		}
		if int64(len(buf)) > maxResp {
			writeErr(w, 413, "Response too large")
			return
		}

		// forward headers (filtered)
		for k, vv := range resp.Header {
			lk := strings.ToLower(k)
			if lk == "x-frame-options" || lk == "transfer-encoding" || lk == "content-encoding" || lk == "content-security-policy-report-only" {
				continue
			}
			if lk == "content-security-policy" {
				cleaned := stripFrameAncestors(vv)
				if cleaned != "" {
					w.Header().Set(k, cleaned)
				}
				continue
			}
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.Header().Set("X-BrowOS-Final-URL", current)
		w.WriteHeader(resp.StatusCode)

		ct := resp.Header.Get("Content-Type")
		if strings.Contains(ct, "text/html") {
			charset := charsetFromCT(ct)
			text := decodeBytes(buf, charset)
			rewritten := rewriteHTML(text, current)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(rewritten))
			return
		}
		if strings.Contains(ct, "text/css") {
			charset := charsetFromCT(ct)
			text := decodeBytes(buf, charset)
			rewritten := rewriteCSS(text, current)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(rewritten))
			return
		}
		w.Write(buf)
		return
	}
}

func isNoBodyMethod(m string) bool {
	m = strings.ToUpper(m)
	return m == "GET" || m == "HEAD"
}

func currentURL(base string, ref *url.URL) string {
	bu, _ := url.Parse(base)
	return bu.ResolveReference(ref).String()
}

func stripFrameAncestors(vals []string) string {
	var out []string
	for _, v := range vals {
		for _, part := range strings.Split(v, ";") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if strings.HasPrefix(strings.ToLower(part), "frame-ancestors") {
				continue
			}
			out = append(out, part)
		}
	}
	return strings.Join(out, "; ")
}

func charsetFromCT(ct string) string {
	// simple
	lower := strings.ToLower(ct)
	idx := strings.Index(lower, "charset=")
	if idx < 0 {
		return "utf-8"
	}
	cs := ct[idx+len("charset="):]
	cs = strings.TrimSpace(cs)
	if i := strings.IndexAny(cs, "; "); i >= 0 {
		cs = cs[:i]
	}
	if cs == "" {
		return "utf-8"
	}
	return cs
}

func decodeBytes(buf []byte, charset string) string {
	// use encoding? Go doesn't have built-in charset conversion except utf-8.
	// For common charsets, handle latin1/iso-8859-1 manually.
	if strings.EqualFold(charset, "iso-8859-1") || strings.EqualFold(charset, "latin1") {
		r := make([]rune, len(buf))
		for i, b := range buf {
			r[i] = rune(b)
		}
		return string(r)
	}
	return string(buf)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(code)
	fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BrowOS+ Error</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#1e1e24;color:#e8e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;}.card{max-width:520px;padding:32px;border-radius:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);text-align:center;}h1{margin:0 0 8px;font-size:22px;}p{color:rgba(255,255,255,0.7);line-height:1.5;}code{display:block;margin-top:12px;padding:8px;border-radius:8px;background:rgba(0,0,0,0.3);word-break:break-all;font-size:12px;}.accent{color:#2196F3;}</style></head><body><div class="card"><h1>Could not load page</h1><p class="accent">%s</p><p>BrowOS+ could not display this website.</p></div></body></html>`, html.EscapeString(msg))
}
