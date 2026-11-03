// Security helpers for BrowOS+ backend

import dns from "node:dns/promises";

const PRIVATE_HOSTS = new Set([
	"localhost",
	"metadata",
	"metadata.google.internal",
	"instance-data",
]);

function isPrivateIPv4(ip) {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return false;
	const [a, b, c] = parts;
	if (a === 0) return true;
	if (a === 10) return true;
	if (a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 192 && b === 0 && c === 0) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a >= 224) return true;
	return false;
}

function isPrivateIPv6(ip) {
	const lower = ip.toLowerCase();
	if (lower === "::" || lower === "::1") return true;
	if (lower.startsWith("fe80")) return true;
	if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
	if (lower.startsWith("::ffff:")) {
		return isPrivateIPv4(lower.slice(7));
	}
	// IPv4-compatible etc.
	return false;
}

export function isPrivateIP(ip) {
	if (!ip) return true;
	if (ip.includes(":")) return isPrivateIPv6(ip);
	return isPrivateIPv4(ip);
}

export function isBlockedHostname(hostname) {
	hostname = (hostname || "").toLowerCase();
	if (!hostname) return true;
	if (PRIVATE_HOSTS.has(hostname)) return true;
	if (hostname.endsWith(".localhost")) return true;
	if (hostname.endsWith(".local")) return true;
	if (hostname === "0.0.0.0") return true;
	// cloud metadata common
	if (hostname === "169.254.169.254") return true;
	return false;
}

export async function validateTarget(urlString) {
	let parsed;
	try {
		parsed = new URL(urlString);
	} catch (e) {
		throw new Error("Invalid URL");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Unsupported protocol");
	}
	const hostname = parsed.hostname;
	if (!hostname) throw new Error("Missing hostname");
	if (isBlockedHostname(hostname)) throw new Error("Blocked host");
	// path traversal check
	if (parsed.pathname.includes("..")) throw new Error("Path traversal not allowed");

	// If IP literal
	if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
		if (isPrivateIP(hostname)) throw new Error("Private address blocked");
		return parsed;
	}

	// DNS resolve
	let addresses;
	try {
		addresses = await dns.lookup(hostname, { all: true });
	} catch (e) {
		throw new Error("DNS resolution failed");
	}
	if (!addresses || addresses.length === 0) throw new Error("DNS resolution failed");
	for (const a of addresses) {
		if (isPrivateIP(a.address)) {
			throw new Error("Resolved to private address");
		}
	}
	return parsed;
}

export function isLoopbackIP(ip) {
	if (!ip) return false;
	if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return true;
	if (ip.startsWith("127.")) return true;
	return false;
}