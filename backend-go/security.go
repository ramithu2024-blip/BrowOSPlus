package main

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}
	// IPv4 extra ranges
	if v4 := ip.To4(); v4 != nil {
		a, b, c := int(v4[0]), int(v4[1]), int(v4[2])
		if a == 0 || a == 10 || a == 127 {
			return true
		}
		if a == 169 && b == 254 {
			return true
		}
		if a == 172 && b >= 16 && b <= 31 {
			return true
		}
		if a == 192 && b == 168 {
			return true
		}
		if a == 100 && b >= 64 && b <= 127 {
			return true
		}
		if a == 192 && b == 0 && c == 0 {
			return true
		}
		if a == 198 && (b == 18 || b == 19) {
			return true
		}
		if a >= 224 {
			return true
		}
	}
	// IPv6 ULA / metadata
	s := ip.String()
	if strings.HasPrefix(s, "fe80") || strings.HasPrefix(s, "fc") || strings.HasPrefix(s, "fd") {
		return true
	}
	return false
}

func isBlockedHostname(hostname string) bool {
	h := strings.ToLower(strings.TrimSpace(hostname))
	if h == "" {
		return true
	}
	blocked := map[string]bool{
		"localhost":                 true,
		"metadata":                  true,
		"metadata.google.internal":  true,
		"instance-data":             true,
		"169.254.169.254":          true,
	}
	if blocked[h] {
		return true
	}
	if strings.HasSuffix(h, ".localhost") || strings.HasSuffix(h, ".local") {
		return true
	}
	if h == "0.0.0.0" {
		return true
	}
	return false
}

func validateTarget(raw string) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("Invalid URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("Unsupported protocol")
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("Missing host")
	}
	hostname := parsed.Hostname()
	if isBlockedHostname(hostname) {
		return nil, fmt.Errorf("Blocked host")
	}
	if strings.Contains(parsed.Path, "..") {
		return nil, fmt.Errorf("Path traversal not allowed")
	}
	// IP literal
	if ip := net.ParseIP(hostname); ip != nil {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("Private address blocked")
		}
		return parsed, nil
	}
	ips, err := net.LookupIP(hostname)
	if err != nil || len(ips) == 0 {
		return nil, fmt.Errorf("DNS resolution failed")
	}
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return nil, fmt.Errorf("Resolved to private address")
		}
	}
	return parsed, nil
}

func isLoopbackIPStr(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	return parsed.IsLoopback()
}