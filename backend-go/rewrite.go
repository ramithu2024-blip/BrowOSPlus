package main

import (
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var (
	attrRe   = regexp.MustCompile(`(?i)(\s)(src|href|action|formaction|poster|data-src|data-href|data-original|data-srcset)\s*=\s*("([^"]*)"|'([^']*)')`)
	srcsetRe = regexp.MustCompile(`(?i)srcset\s*=\s*("([^"]*)"|'([^']*)')`)
	cssUrlRe = regexp.MustCompile(`(?i)url\(\s*([^)]*)\s*\)`)
)

func publicBase() string {
	if publicBaseURL != "" {
		return publicBaseURL
	}
	return envOrDefault("PUBLIC_URL", "http://127.0.0.1:"+envOrDefault("PORT", "8787"))
}

func wrapURL(u, base string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return u
	}
	if strings.HasPrefix(strings.ToLower(u), "data:") || strings.HasPrefix(strings.ToLower(u), "blob:") ||
		strings.HasPrefix(strings.ToLower(u), "javascript:") || strings.HasPrefix(strings.ToLower(u), "mailto:") ||
		strings.HasPrefix(strings.ToLower(u), "tel:") || strings.HasPrefix(u, "#") {
		return u
	}
	abs, err := url.Parse(u)
	if err != nil {
		return u
	}
	if !abs.IsAbs() {
		bu, err := url.Parse(base)
		if err != nil {
			return u
		}
		abs = bu.ResolveReference(abs)
	}
	if abs.Scheme != "http" && abs.Scheme != "https" {
		return u
	}
	return publicBase() + "/proxy?url=" + url.QueryEscape(abs.String())
}

func rewriteCSS(css, base string) string {
	return cssUrlRe.ReplaceAllStringFunc(css, func(m string) string {
		sub := cssUrlRe.FindStringSubmatch(m)
		if len(sub) < 2 {
			return m
		}
		inner := strings.TrimSpace(sub[1])
		q := ""
		u := inner
		if len(inner) > 0 && (inner[0] == '"' || inner[0] == '\'') {
			q = string(inner[0])
			u = strings.TrimSpace(inner[1:])
			if len(u) > 0 && u[len(u)-1] == inner[0] {
				u = u[:len(u)-1]
				u = strings.TrimSpace(u)
			}
		}
		lu := strings.ToLower(u)
		if strings.HasPrefix(lu, "data:") || strings.HasPrefix(lu, "blob:") || strings.HasPrefix(lu, "#") {
			return m
		}
		return fmt.Sprintf("url(%s%s%s)", q, wrapURL(u, base), q)
	})
}

func rewriteHTML(html, base string) string {
	// attributes
	html = attrRe.ReplaceAllStringFunc(html, func(m string) string {
		sub := attrRe.FindStringSubmatch(m)
		if len(sub) < 6 {
			return m
		}
		space := sub[1]
		attr := sub[2]
		quoted := sub[3]
		dq := sub[4]
		sq := sub[5]
		var val string
		var quote string
		if dq != "" || (quoted != "" && strings.HasPrefix(quoted, `"`)) {
			// determine
		}
		if strings.HasPrefix(quoted, `"`) {
			val = dq
			quote = `"`
		} else {
			val = sq
			quote = "'"
		}
		newVal := val
		lv := strings.ToLower(strings.TrimSpace(val))
		if !(strings.HasPrefix(lv, "data:") || strings.HasPrefix(lv, "blob:") || strings.HasPrefix(lv, "javascript:") ||
			strings.HasPrefix(lv, "mailto:") || strings.HasPrefix(lv, "tel:") || strings.HasPrefix(strings.TrimSpace(val), "#")) {
			newVal = wrapURL(val, base)
		}
		_ = attr
		return space + attr + "=" + quote + newVal + quote
	})

	// srcset
	html = srcsetRe.ReplaceAllStringFunc(html, func(m string) string {
		sub := srcsetRe.FindStringSubmatch(m)
		if len(sub) < 4 {
			return m
		}
		quoted := sub[1]
		val := sub[2]
		if val == "" {
			val = sub[3]
		}
		quote := `"`
		if strings.HasPrefix(quoted, "'") {
			quote = "'"
		}
		parts := strings.Split(val, ",")
		out := make([]string, 0, len(parts))
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			fields := strings.Fields(part)
			if len(fields) == 0 {
				continue
			}
			u := fields[0]
			desc := ""
			if len(fields) > 1 {
				desc = " " + strings.Join(fields[1:], " ")
			}
			if !strings.HasPrefix(strings.ToLower(u), "data:") && !strings.HasPrefix(strings.ToLower(u), "blob:") {
				u = wrapURL(u, base)
			}
			out = append(out, u+desc)
		}
		return "srcset=" + quote + strings.Join(out, ", ") + quote
	})

	// css url()
	html = cssUrlRe.ReplaceAllStringFunc(html, func(m string) string {
		sub := cssUrlRe.FindStringSubmatch(m)
		if len(sub) < 2 {
			return m
		}
		inner := strings.TrimSpace(sub[1])
		q := ""
		u := inner
		if len(inner) > 0 && (inner[0] == '"' || inner[0] == '\'') {
			q = string(inner[0])
			u = strings.TrimSpace(inner[1:])
			if len(u) > 0 && u[len(u)-1] == inner[0] {
				u = u[:len(u)-1]
				u = strings.TrimSpace(u)
			}
		}
		lu := strings.ToLower(u)
		if strings.HasPrefix(lu, "data:") || strings.HasPrefix(lu, "blob:") || strings.HasPrefix(lu, "#") {
			return m
		}
		return fmt.Sprintf("url(%s%s%s)", q, wrapURL(u, base), q)
	})

	// base tag
	if !regexp.MustCompile(`(?i)<base\b`).MatchString(html) {
		html = regexp.MustCompile(`(?i)<head(\s[^>]*)?>`).ReplaceAllString(html, `$0<base href="`+base+`">`)
	}

	// inject compat script
	q := strconv.Quote(publicBase() + "/proxy?url=")
	script := `<script>(function(){var P=` + q + `;function w(u){try{var a=new URL(u,location.href).href;if(!/^https?:/i.test(a))return u;return P+encodeURIComponent(a);}catch(e){return u;}}var obs=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;["src","href","action","poster","data-src"].forEach(function(a){if(n.hasAttribute&&n.hasAttribute(a)){var v=n.getAttribute(a);if(v&&!v.startsWith(P)&&!/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(v)){n.setAttribute(a,w(v));}}});if(n.querySelectorAll){n.querySelectorAll("[src],[href],[action],[poster],[data-src]").forEach(function(el){["src","href","action","poster","data-src"].forEach(function(a){if(el.hasAttribute(a)){var v=el.getAttribute(a);if(v&&!v.startsWith(P)&&!/^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(v)){el.setAttribute(a,w(v));}}});});}});});});if(document.documentElement)obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true});})();<\/script>`
	html = regexp.MustCompile(`(?i)</head>`).ReplaceAllString(html, script+"</head>")

	navScript := `<script>(function(){function send(t,u){try{window.parent.postMessage({type:t,url:u},"*");}catch(e){}}send("browos-navigate",location.href);document.addEventListener("mouseover",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a&&a.href)send("browos-hover",a.href);},true);document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a&&a.href)send("browos-navigate",a.href);},true);window.addEventListener("popstate",function(){send("browos-navigate",location.href);});})();<\/script>`
	if regexp.MustCompile(`(?i)</body>`).MatchString(html) {
		html = regexp.MustCompile(`(?i)</body>`).ReplaceAllString(html, navScript+"</body>")
	} else {
		html += navScript
	}

	return html
}
