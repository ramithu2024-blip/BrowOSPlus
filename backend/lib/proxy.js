// Proxy logic

import { validateTarget } from "./security.js";

const MAX_RESPONSE = Number(process.env.MAX_RESPONSE_SIZE || 10 * 1024 * 1024);
const TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 15000);
const PUBLIC_BASE = () => (process.env.PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/$/, "");

export { MAX_RESPONSE, TIMEOUT };

function buildForwardHeaders(request) {
	const headers = {};
	const allow = ["cookie", "accept", "accept-language", "user-agent", "content-type", "authorization", "origin", "referer"];
	for (const name of allow) {
		const v = request.headers[name];
		if (v) headers[name] = v;
	}
	if (!headers["user-agent"]) {
		headers["user-agent"] = "Mozilla/5.0 (BrowOS+ Proxy) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
	}
	if (!headers["accept-language"]) {
		headers["accept-language"] = "en-US,en;q=0.9";
	}
	// set referer to target origin later by caller? We'll set in fetch
	return headers;
}

function charsetFromContentType(ct) {
	const m = (ct || "").match(/charset=([^;]+)/i);
	return m ? m[1].trim() : "utf-8";
}

function wrapUrl(u, baseUrl) {
	try {
		const abs = new URL(u, baseUrl).href;
		if (!/^https?:/i.test(abs)) return u;
		return `${PUBLIC_BASE()}/proxy?url=${encodeURIComponent(abs)}`;
	} catch (e) {
		return u;
	}
}

function rewriteCss(css, baseUrl) {
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
		u = u.trim();
		if (/^data:|^blob:|^#/i.test(u)) return m;
		return `url(${q}${wrapUrl(u, baseUrl)}${q})`;
	});
}

function rewriteHtml(html, baseUrl) {
	// attributes
	html = html.replace(/(\s)(src|href|action|formaction|poster|data-src|data-href|data-original|data-srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi,
		(m, space, attr, quoted, dq, sq) => {
			const val = dq !== undefined ? dq : sq;
			const quote = dq !== undefined ? '"' : "'";
			let newVal = val;
			if (attr.toLowerCase().endsWith("srcset")) {
				// handled separately below? this catches data-srcset maybe; do srcset logic
			}
			if (!/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(val.trim())) {
				newVal = wrapUrl(val.trim(), baseUrl);
			}
			return `${space}${attr}=${quote}${newVal}${quote}`;
		});

	// srcset standard attribute
	html = html.replace(/srcset\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, quoted, dq, sq) => {
		const val = dq !== undefined ? dq : sq;
		const quote = dq !== undefined ? '"' : "'";
		const parts = val.split(",").map(part => {
			const trimmed = part.trim();
			const m2 = trimmed.match(/^(\S+)(.*)$/);
			if (!m2) return trimmed;
			const u = m2[1];
			const desc = m2[2] || "";
			if (/^(data:|blob:)/i.test(u)) return trimmed;
			return wrapUrl(u, baseUrl) + desc;
		});
		return `srcset=${quote}${parts.join(", ")}${quote}`;
	});

	// CSS url() anywhere (style tags/attributes)
	html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
		u = u.trim();
		if (/^data:|^blob:|^#/i.test(u)) return m;
		return `url(${q}${wrapUrl(u, baseUrl)}${q})`;
	});

	// inject base tag (original) to help missed relatives
	if (!/<base\b/i.test(html)) {
		html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="${baseUrl}">`);
	}
	// inject compatibility script for dynamic resources
	const script = `<script>(function(){var P=${JSON.stringify(PUBLIC_BASE() + "/proxy?url=")};function w(u){try{var a=new URL(u,location.href).href;if(!/^https?:/i.test(a))return u;return P+encodeURIComponent(a);}catch(e){return u;}}var obs=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;["src","href","action","poster","data-src"].forEach(function(a){if(n.hasAttribute&&n.hasAttribute(a)){var v=n.getAttribute(a);if(v&&!v.startsWith(P)&&!/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(v)){n.setAttribute(a,w(v));}}});if(n.querySelectorAll){n.querySelectorAll("[src],[href],[action],[poster],[data-src]").forEach(function(el){["src","href","action","poster","data-src"].forEach(function(a){if(el.hasAttribute(a)){var v=el.getAttribute(a);if(v&&!v.startsWith(P)&&!/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(v)){el.setAttribute(a,w(v));}}});});}});});});if(document.documentElement)obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true});})();<\/script>`;
	html = html.replace(/<\/head>/i, script + "</head>");

	const navScript = `<script>(function(){function send(t,u){try{window.parent.postMessage({type:t,url:u},"*");}catch(e){}}send("browos-navigate",location.href);document.addEventListener("mouseover",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a&&a.href)send("browos-hover",a.href);},true);document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a&&a.href)send("browos-navigate",a.href);},true);window.addEventListener("popstate",function(){send("browos-navigate",location.href);});})();<\/script>`;
	if (/<\/body>/i.test(html)) {
		html = html.replace(/<\/body>/i, navScript + "</body>");
	} else {
		html += navScript;
	}

	return html;
}

function stripFrameHeaders(headers) {
	const out = {};
	for (const [k, v] of headers.entries()) {
		const lower = k.toLowerCase();
		if (lower === "x-frame-options") continue;
		if (lower === "content-security-policy") {
			// remove frame-ancestors directive
			const cleaned = v.split(";").map(d => d.trim()).filter(d => !/^frame-ancestors\b/i.test(d)).join("; ");
			if (cleaned) out[k] = cleaned;
			continue;
		}
		if (lower === "content-security-policy-report-only") continue;
		if (lower === "transfer-encoding") continue;
		if (lower === "connection") continue;
		if (lower === "content-encoding") continue; // fetch decoded
		out[k] = v;
	}
	return out;
}

async function fetchWithRedirects(startUrl, request) {
	let current = startUrl;
	let redirects = 0;
	const headers = buildForwardHeaders(request);
	while (redirects < 10) {
		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), TIMEOUT);
		let res;
		try {
			res = await fetch(current, {
				method: request.method || "GET",
				headers,
				body: ["GET", "HEAD"].includes((request.method || "GET").toUpperCase()) ? undefined : request.bodyBuffer,
				redirect: "manual",
				signal: controller.signal,
			});
		} finally {
			clearTimeout(t);
		}
		if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
			const next = new URL(res.headers.get("location"), current).href;
			await validateTarget(next);
			current = next;
			redirects++;
			try { await res.arrayBuffer(); } catch (e) {}
			continue;
		}
		return { response: res, finalUrl: current };
	}
	throw new Error("Too many redirects");
}

const AD_DOMAINS = [
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
];

function isAdDomain(host) {
	host = (host || "").toLowerCase();
	return AD_DOMAINS.some(d => host === d || host.endsWith("." + d));
}

export async function proxyRequest(request, reply) {
	const url = request.query && request.query.url;
	const adblock = request.query && (request.query.adblock === "1" || request.query.adblock === "true");
	if (!url) {
		reply.code(400);
		reply.type("text/html; charset=utf-8");
		return errorPage("Missing url parameter", url);
	}
	let parsed;
	try {
		parsed = await validateTarget(url);
	} catch (e) {
		reply.code(400);
		reply.type("text/html; charset=utf-8");
		return errorPage(e.message, url);
	}

	if (adblock && isAdDomain(parsed.hostname)) {
		reply.code(204);
		reply.header("x-browos-adblocked", "1");
		return "";
	}

	// body buffer
	let bodyBuffer = request.body;
	if (bodyBuffer && !Buffer.isBuffer(bodyBuffer)) {
		try { bodyBuffer = Buffer.from(bodyBuffer); } catch (e) { bodyBuffer = undefined; }
	}

	let result;
	try {
		result = await fetchWithRedirects(parsed.href, {
			method: request.method,
			headers: request.headers,
			bodyBuffer,
		});
	} catch (e) {
		reply.code(502);
		reply.type("text/html; charset=utf-8");
		return errorPage(e.message || "Fetch failed", url);
	}

	const { response, finalUrl } = result;

	// size check via content-length
	const cl = response.headers.get("content-length");
	if (cl && Number(cl) > MAX_RESPONSE) {
		reply.code(413);
		reply.type("text/html; charset=utf-8");
		return errorPage("Response too large", url);
	}

	let buf;
	try {
		buf = Buffer.from(await response.arrayBuffer());
	} catch (e) {
		reply.code(502);
		return { error: "Failed to read response" };
	}
	if (buf.length > MAX_RESPONSE) {
		reply.code(413);
		reply.type("text/html; charset=utf-8");
		return errorPage("Response too large", url);
	}

	const ct = response.headers.get("content-type") || "application/octet-stream";
	const charset = charsetFromContentType(ct);

	// forward headers (filtered)
	const filtered = stripFrameHeaders(response.headers);
	for (const [k, v] of Object.entries(filtered)) {
		reply.header(k, v);
	}
	reply.header("x-browos-final-url", finalUrl);
	reply.code(response.status);

	const decode = (buf, cs) => {
		try { return new TextDecoder(cs).decode(buf); } catch (e) { return new TextDecoder("utf-8").decode(buf); }
	};

	if (ct.includes("text/html")) {
		const html = decode(buf, charset);
		const rewritten = rewriteHtml(html, finalUrl);
		const out = Buffer.from(rewritten, "utf-8");
		reply.type(ct.replace(/charset=[^;]+/i, "charset=utf-8"));
		return out;
	}
	if (ct.includes("text/css")) {
		const css = decode(buf, charset);
		const rewritten = rewriteCss(css, finalUrl);
		const out = Buffer.from(rewritten, "utf-8");
		reply.type(ct.replace(/charset=[^;]+/i, "charset=utf-8"));
		return out;
	}

	reply.type(ct);
	return buf;
}

function errorPage(message, url) {
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BrowOS+ Error</title><style>
	body{margin:0;font-family:system-ui,sans-serif;background:#1e1e24;color:#e8e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;}
	.card{max-width:520px;padding:32px;border-radius:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);text-align:center;}
	h1{margin:0 0 8px;font-size:22px;}
	p{color:rgba(255,255,255,0.7);line-height:1.5;}
	code{display:block;margin-top:12px;padding:8px;border-radius:8px;background:rgba(0,0,0,0.3);word-break:break-all;font-size:12px;}
	.accent{color:#2196F3;}
	</style></head><body><div class="card"><h1>Could not load page</h1><p class="accent">${escapeHtml(message)}</p><p>BrowOS+ could not display this website.</p><code>${escapeHtml(url || "")}</code></div></body></html>`;
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}