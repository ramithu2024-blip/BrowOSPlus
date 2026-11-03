// Browser (BrowOS+)

// ---- Settings helpers ----

function browserSetting(key, fallback) {
	const value = localStorage.getItem(key);
	return value === null ? fallback : value;
}

function setBrowserSetting(key, value) {
	localStorage.setItem(key, value);
}

const BROWSER_KEYS = {
	backendUrl: "browos-browser-backend-url",
	proxyEnabled: "browos-browser-proxy-enabled",
	compatMode: "browos-browser-compat-mode",
	searchEngine: "browos-search-engine",
	homepage: "browos-browser-homepage",
	newTabMode: "browos-browser-newtab-mode",
	newTabUrl: "browos-browser-newtab-url",
	externalFallback: "browos-browser-external-fallback",
	adBlocker: "browos-browser-adblocker",
	bookmarks: "browos-browser-bookmarks",
	history: "browos-browser-history",
	tabs: "browos-browser-tabs",
};

const searchEngines = {
	// Google allows iframe embedding when igu=1 is present
	google: "https://www.google.com/search?igu=1&q=",
	duckduckgo: "https://duckduckgo.com/?q=",
	bing: "https://www.bing.com/search?q=",
	brave: "https://search.brave.com/search?q=",
};

let searchEngine = browserSetting(BROWSER_KEYS.searchEngine, "google");
if (!searchEngines[searchEngine]) searchEngine = "google";

let backendUrl = browserSetting(BROWSER_KEYS.backendUrl, "http://localhost:8787");
let proxyEnabled = browserSetting(BROWSER_KEYS.proxyEnabled, "on") !== "off";
let compatMode = browserSetting(BROWSER_KEYS.compatMode, "auto");
let homepage = browserSetting(BROWSER_KEYS.homepage, "");
let newTabMode = browserSetting(BROWSER_KEYS.newTabMode, "browos");
let newTabUrl = browserSetting(BROWSER_KEYS.newTabUrl, "");
let externalFallback = browserSetting(BROWSER_KEYS.externalFallback, "auto");
let adBlocker = browserSetting(BROWSER_KEYS.adBlocker, "on") !== "off";

let backendAvailable = false;

function normalizeBackendUrl(url) {
	url = (url || "").trim();
	if (!url) url = "http://localhost:8787";
	return url.replace(/\/+$/, "");
}

backendUrl = normalizeBackendUrl(backendUrl);

async function checkBackend() {
	const base = normalizeBackendUrl(backendUrl);
	try {
		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), 3000);
		const res = await fetch(base + "/health", { signal: controller.signal, cache: "no-store" });
		clearTimeout(t);
		if (!res.ok) throw new Error("bad status");
		const data = await res.json();
		backendAvailable = !!(data && data.status === "ok");
	} catch (e) {
		backendAvailable = false;
	}
	updateBackendStatusUI();
	return backendAvailable;
}

function shouldUseProxy() {
	if (!proxyEnabled) return false;
	if (compatMode === "direct") return false;
	if (compatMode === "proxy") return true;
	// auto
	return backendAvailable;
}

function extractOriginalUrl(u) {
	try {
		const parsed = new URL(u, window.location.href);
		const proxied = parsed.searchParams.get("url");
		if (proxied) return proxied;
		return u;
	} catch (e) {
		return u;
	}
}

function proxify(url) {
	if (!shouldUseProxy()) return url;
	const base = normalizeBackendUrl(backendUrl);
	let u = base + "/proxy?url=" + encodeURIComponent(url);
	if (adBlocker) u += "&adblock=1";
	return u;
}

// ---- URL helpers ----

function webAddress(text) {
	if (/\s/.test(text)) return null;
	let value = text.trim();
	if (!value) return null;
	if (!/^https?:\/\//i.test(value)) {
		if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(value)) {
			return null;
		}
		value = "https://" + value;
	}
	try {
		const url = new URL(value);
		if (url.protocol === "http:" || url.protocol === "https:") return url.href;
	} catch (e) {}
	return null;
}

function resolveInput(text) {
	text = (text || "").trim();
	if (!text) return null;
	const url = webAddress(text);
	if (url) return url;
	// search
	const engine = searchEngines[searchEngine] || searchEngines.google;
	return engine + encodeURIComponent(text);
}

// ---- Bookmarks / History ----

function loadList(key, fallback) {
	try {
		const v = JSON.parse(localStorage.getItem(key));
		if (Array.isArray(v)) return v;
	} catch (e) {}
	return fallback;
}

let bookmarks = loadList(BROWSER_KEYS.bookmarks, []);
let historyList = loadList(BROWSER_KEYS.history, []);

function saveBookmarks() {
	localStorage.setItem(BROWSER_KEYS.bookmarks, JSON.stringify(bookmarks));
}

function saveHistory() {
	localStorage.setItem(BROWSER_KEYS.history, JSON.stringify(historyList));
}

function addHistory(url, title) {
	if (!url || url.startsWith("about:")) return;
	// de-dupe consecutive
	const last = historyList[historyList.length - 1];
	if (last && last.url === url) return;
	historyList.push({ url, title: title || url, time: Date.now() });
	if (historyList.length > 500) historyList.splice(0, historyList.length - 500);
	saveHistory();
}

function isBookmarked(url) {
	return bookmarks.some(b => b.url === url);
}

function toggleBookmark(url, title) {
	if (isBookmarked(url)) {
		bookmarks = bookmarks.filter(b => b.url !== url);
	} else {
		bookmarks.push({ url, title: title || url, time: Date.now() });
	}
	saveBookmarks();
	renderBookmarkState();
}

// ---- Tabs ----

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

const browserFramesEl = document.getElementById("browserFrames");
const browserTabsEl = document.getElementById("browserTabs");
const browserAddressEl = document.getElementById("browserAddress");
const browserStartpageEl = document.getElementById("browserStartpage");
const browserErrorPageEl = document.getElementById("browserErrorPage");
const browserLoadingBarEl = document.getElementById("browserLoadingBar");
const browserStatusBarEl = document.getElementById("browserStatusBar");

function newTabId() { return "tab-" + (++tabCounter); }

function createTab(url) {
	const id = newTabId();
	const frame = document.createElement("iframe");
	frame.className = "browser-frame hidden";
	frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation");
	frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
	frame.dataset.tabId = id;
	browserFramesEl.appendChild(frame);

	const tab = {
		id,
		url: url || "",
		title: "New tab",
		history: [],
		index: -1,
		frame,
		loading: false,
		loaded: false,
		expectedUrl: url || "",
	};
	tabs.push(tab);

	if (url) {
		loadTabUrl(tab, url, true);
	} else {
		showStartpage(true);
	}

	setActiveTab(id);
	renderTabs();
	return tab;
}

function closeTab(id) {
	const idx = tabs.findIndex(t => t.id === id);
	if (idx === -1) return;
	const tab = tabs[idx];
	if (tab.frame && tab.frame.parentNode) tab.frame.parentNode.removeChild(tab.frame);
	tabs.splice(idx, 1);
	if (tabs.length === 0) {
		createTab("");
		return;
	}
	if (activeTabId === id) {
		const next = tabs[Math.min(idx, tabs.length - 1)];
		setActiveTab(next.id);
	}
	renderTabs();
	updateUI();
}

function setActiveTab(id) {
	activeTabId = id;
	tabs.forEach(t => {
		if (t.frame) t.frame.classList.toggle("hidden", t.id !== id || !t.loaded);
	});
	const tab = getActiveTab();
	if (tab) {
		if (!tab.url) {
			showStartpage(true);
			showErrorPage(false);
		} else {
			showStartpage(false);
		}
		browserAddressEl.value = tab.url;
	}
	renderTabs();
	updateUI();
}

function getActiveTab() {
	return tabs.find(t => t.id === activeTabId) || null;
}

function renderTabs() {
	// remove existing tab elements (keep new tab button)
	const newBtn = document.getElementById("browserNewTab");
	browserTabsEl.querySelectorAll(".browser-tab").forEach(e => e.remove());
	tabs.forEach(tab => {
		const btn = document.createElement("button");
		btn.className = "browser-tab" + (tab.id === activeTabId ? " active" : "");
		btn.dataset.tabId = tab.id;
		const title = document.createElement("span");
		title.textContent = (tab.title || "New tab").slice(0, 24);
		const close = document.createElement("button");
		close.className = "browser-tab-close";
		close.textContent = "×";
		close.addEventListener("click", (e) => { e.stopPropagation(); closeTab(tab.id); });
		btn.append(title, close);
		btn.addEventListener("click", () => setActiveTab(tab.id));
		browserTabsEl.insertBefore(btn, newBtn);
	});
}

function loadTabUrl(tab, url, pushHistory) {
	if (!tab) return;
	tab.loading = true;
	tab.loaded = false;
	setLoading(true);
	showErrorPage(false);
	if (!url) {
		showStartpage(true);
		tab.loading = false;
		setLoading(false);
		return;
	}
	showStartpage(false);
	if (pushHistory) {
		// trim forward
		if (tab.index < tab.history.length - 1) {
			tab.history = tab.history.slice(0, tab.index + 1);
		}
		tab.history.push(url);
		tab.index = tab.history.length - 1;
	}
	tab.url = url;
	tab.expectedUrl = url;
	if (tab.id === activeTabId) browserAddressEl.value = url;

	const src = proxify(url);
	tab.frame.onload = () => {
		clearTimeout(tab._loadTimer);
		tab.loading = false;
		if (tab.id === activeTabId) setLoading(false);
		// detect browser-native error pages (e.g. blocked embedding) where possible
		let nativeError = false;
		try {
			if (!tab.frame.contentWindow) nativeError = true;
			const href = tab.frame.contentWindow && tab.frame.contentWindow.location ? tab.frame.contentWindow.location.href : "";
			if (href && /^about:(neterror|certerror|blocked|srcdoc)/i.test(href)) nativeError = true;
		} catch (e) {
			// cross-origin access denied; cannot inspect, assume page rendered
		}
		if (nativeError) {
			tab.frame.classList.add("hidden");
			showError(url);
			return;
		}

		// Determine the URL currently shown in the iframe (handles link clicks/redirects)
		let current = url;
		try {
			// Same-origin navigations can expose their location
			const loc = tab.frame.contentWindow && tab.frame.contentWindow.location ? tab.frame.contentWindow.location.href : "";
			if (loc && !loc.startsWith("about:")) current = loc;
		} catch (e) {}
		try {
			const src = tab.frame.getAttribute("src") || tab.frame.src || "";
			const u = new URL(src, window.location.href);
			const proxied = u.searchParams.get("url");
			if (proxied) current = proxied;
			else if (src && !src.startsWith("about:") && current === url) current = src;
		} catch (e) {}

		// Update history for navigations that were not explicitly requested
		if (current && current !== tab.url) {
			if (current === tab.expectedUrl) {
				if (tab.index >= 0 && tab.history[tab.index] !== current) tab.history[tab.index] = current;
				tab.url = current;
			} else {
				if (tab.index < tab.history.length - 1) {
					tab.history = tab.history.slice(0, tab.index + 1);
				}
				tab.history.push(current);
				tab.index = tab.history.length - 1;
				tab.url = current;
			}
		} else {
			tab.url = current || tab.url;
			if (tab.index >= 0 && tab.history[tab.index] !== tab.url) tab.history[tab.index] = tab.url;
		}
		tab.expectedUrl = current || tab.expectedUrl;

		// Resolve final URL after server-side redirects when using the proxy
		if (shouldUseProxy() && current) {
			fetch(proxify(current), { method: "HEAD", credentials: "include" })
				.then(function (res) {
					const finalUrl = res.headers.get("X-BrowOS-Final-URL") || res.headers.get("x-browos-final-url");
					if (finalUrl && finalUrl !== tab.url) {
						tab.url = finalUrl;
						if (tab.index >= 0) tab.history[tab.index] = finalUrl;
						if (tab.id === activeTabId) browserAddressEl.value = finalUrl;
						renderTabs();
						updateUI();
					}
				})
				.catch(function () {});
		}

		// reveal only after a (likely) successful load
		tab.loaded = true;
		if (tab.id === activeTabId) {
			tab.frame.classList.remove("hidden");
			browserAddressEl.value = tab.url;
		}
		// try to get title (same-origin only)
		try {
			const doc = tab.frame.contentDocument;
			if (doc && doc.title) tab.title = doc.title;
		} catch (e) {}
		if (!tab.title || tab.title === "New tab") {
			try { tab.title = new URL(tab.url).hostname; } catch (e) {}
		}
		addHistory(tab.url, tab.title);
		renderTabs();
		updateUI();
	};
	tab.frame.onerror = () => {
		clearTimeout(tab._loadTimer);
		tab.loading = false;
		if (tab.id === activeTabId) setLoading(false);
		showError(url);
	};
	// hide until we know the page loaded (avoids flashing native browser errors)
	tab.frame.classList.add("hidden");

	// timeout fallback for blocked/hung loads
	clearTimeout(tab._loadTimer);
	tab._loadTimer = setTimeout(() => {
		if (tab.loading && tab.url === url) {
			tab.loading = false;
			if (tab.id === activeTabId) setLoading(false);
			showError(url);
		}
	}, 15000);
	// timeout fallback
	const thisUrl = url;
	setTimeout(() => {
		if (tab.loading && tab.url === thisUrl) {
			// still loading after 20s -> show error
			// but don't interrupt; just leave
		}
	}, 20000);
	tab.frame.src = src;
}

function showError(url) {
	document.getElementById("browserErrorTitle").textContent = "Could not load page";
	if (shouldUseProxy()) {
		document.getElementById("browserErrorMessage").textContent = "BrowOS+ could not display this website. It may block embedding or require the local compatibility layer.";
	} else {
		document.getElementById("browserErrorMessage").textContent = "This site could not be displayed inside BrowOS+. It has been opened in a new tab if possible.";
	}
	const urlEl = document.getElementById("browserErrorUrl");
	if (urlEl) urlEl.textContent = url || "";
	browserErrorPageEl.classList.remove("hidden");
	if (externalFallback === "auto") {
		let external = url;
		// Google-specific fallback if igu compatibility stops working
		if (external.includes("google.com/search") && external.includes("igu=1")) {
			external = external.replace("search?igu=1&q=", "search?q=").replace("search?igu=1", "search");
		}
		openExternal(external);
	}
}

function showErrorPage(show) {
	browserErrorPageEl.classList.toggle("hidden", !show);
}

function applyStartpageWallpaper() {
	const ds = document.querySelector(".desktop-shell");
	if (ds && ds.style.backgroundImage) {
		browserStartpageEl.style.backgroundImage = ds.style.backgroundImage;
		browserStartpageEl.style.backgroundSize = "cover";
		browserStartpageEl.style.backgroundPosition = "center";
	}
}

function showStartpage(show) {
	browserStartpageEl.classList.toggle("hidden", !show);
	if (show) {
		browserFramesEl.querySelectorAll("iframe").forEach(f => f.classList.add("hidden"));
		browserStartpageEl.style.backgroundImage = "none";
	} else {
		const tab = getActiveTab();
		browserFramesEl.querySelectorAll("iframe").forEach(f => {
			f.classList.toggle("hidden", !tab || f.dataset.tabId !== tab.id);
		});
	}
}

function setLoading(loading) {
	browserLoadingBarEl.hidden = !loading;
	browserLoadingBarEl.classList.toggle("active", loading);
}

function updateUI() {
	const tab = getActiveTab();
	const backBtn = document.getElementById("browserBack");
	const fwdBtn = document.getElementById("browserForward");
	if (tab) {
		backBtn.disabled = !(tab.index > 0);
		fwdBtn.disabled = !(tab.index < tab.history.length - 1);
	} else {
		backBtn.disabled = true;
		fwdBtn.disabled = true;
	}
	renderBookmarkState();
	updateStatusBar();
}

function renderBookmarkState() {
	const btn = document.getElementById("browserBookmark");
	const tab = getActiveTab();
	if (tab && tab.url && isBookmarked(tab.url)) {
		btn.textContent = "★";
	} else {
		btn.textContent = "☆";
	}
}

function updateStatusBar() {
	const tab = getActiveTab();
	if (tab && tab.url) {
		browserStatusBarEl.textContent = tab.url;
	} else {
		browserStatusBarEl.textContent = "";
	}
}

// Navigation actions

function navigate(text) {
	const url = resolveInput(text);
	if (!url) return;
	const tab = getActiveTab();
	if (!tab) return;
	loadTabUrl(tab, url, true);
}

function goBack() {
	const tab = getActiveTab();
	if (!tab || tab.index <= 0) return;
	tab.index--;
	const url = tab.history[tab.index];
	tab.url = url;
	browserAddressEl.value = url;
	loadTabUrl(tab, url, false);
}

function goForward() {
	const tab = getActiveTab();
	if (!tab || tab.index >= tab.history.length - 1) return;
	tab.index++;
	const url = tab.history[tab.index];
	tab.url = url;
	browserAddressEl.value = url;
	loadTabUrl(tab, url, false);
}

function reload() {
	const tab = getActiveTab();
	if (!tab || !tab.url) return;
	// force reload by resetting src
	const url = tab.url;
	loadTabUrl(tab, url, false);
}

const searchEngineHomes = {
	google: "https://www.google.com/search?igu=1",
	duckduckgo: "https://duckduckgo.com",
	bing: "https://www.bing.com",
	brave: "https://search.brave.com",
};

function createNewTab() {
	let url = "";
	if (newTabMode === "url" && newTabUrl) {
		url = newTabUrl;
	} else if (newTabMode === "search") {
		url = searchEngineHomes[searchEngine] || "";
	}
	createTab(url);
}

function goHome() {
	if (homepage) {
		navigate(homepage);
	} else {
		const tab = getActiveTab();
		if (tab) {
			tab.url = "";
			tab.history = [];
			tab.index = -1;
			showStartpage(true);
			showErrorPage(false);
			browserAddressEl.value = "";
			renderTabs();
			updateUI();
		}
	}
}

function openExternal(url) {
	url = url || (getActiveTab() && getActiveTab().url);
	if (!url) return;
	window.open(url, "_blank", "noopener");
}

// ---- Wire UI ----

document.getElementById("browserBack").addEventListener("click", goBack);
document.getElementById("browserForward").addEventListener("click", goForward);
document.getElementById("browserReload").addEventListener("click", reload);
document.getElementById("browserHome").addEventListener("click", goHome);
document.getElementById("browserGo").addEventListener("click", () => navigate(browserAddressEl.value));
browserAddressEl.addEventListener("keydown", (e) => {
	if (e.key === "Enter") navigate(browserAddressEl.value);
});
document.getElementById("browserNewTab").addEventListener("click", () => createNewTab());

const browserStartSearchInput = document.getElementById("browserStartSearchInput");
const browserStartSearchButton = document.getElementById("browserStartSearchButton");
if (browserStartSearchInput) {
	browserStartSearchInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") navigate(browserStartSearchInput.value);
	});
}
if (browserStartSearchButton) {
	browserStartSearchButton.addEventListener("click", () => navigate(browserStartSearchInput.value));
}
document.getElementById("browserBookmark").addEventListener("click", () => {
	const tab = getActiveTab();
	if (tab && tab.url) toggleBookmark(tab.url, tab.title);
});
document.getElementById("browserCopyUrl").addEventListener("click", () => {
	const tab = getActiveTab();
	if (tab && tab.url) {
		navigator.clipboard.writeText(tab.url).catch(() => {});
	}
});
document.getElementById("browserOpenExternal").addEventListener("click", () => openExternal());

const browserSettingsBtn = document.getElementById("browserSettings");
const browserSettingsPageEl = document.getElementById("browserSettingsPage");
const browserSettingsBackBtn = document.getElementById("browserSettingsBack");
if (browserSettingsBtn && browserSettingsPageEl) {
	browserSettingsBtn.addEventListener("click", () => {
		browserSettingsPageEl.classList.remove("hidden");
	});
}
if (browserSettingsBackBtn && browserSettingsPageEl) {
	browserSettingsBackBtn.addEventListener("click", () => {
		browserSettingsPageEl.classList.add("hidden");
	});
}

document.getElementById("browserErrorRetry").addEventListener("click", reload);
document.getElementById("browserErrorExternal").addEventListener("click", () => openExternal());

// search engines
const browserEnginesEl = document.getElementById("browserEngines");
browserEnginesEl.querySelectorAll("button").forEach(btn => {
	btn.classList.toggle("active", btn.dataset.engine === searchEngine);
	btn.addEventListener("click", () => {
		searchEngine = btn.dataset.engine;
		setBrowserSetting(BROWSER_KEYS.searchEngine, searchEngine);
		browserEnginesEl.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.engine === searchEngine));
		browserAddressEl.focus();
	});
});

// startpage engine sync (reuse same id? we have one browserEngines)
// (already)

// ---- Keyboard shortcuts ----
document.addEventListener("keydown", (e) => {
	const bw = document.getElementById("browserWindow");
	if (!bw || !bw.classList.contains("show")) return;
	// only when browser visible
	if (e.ctrlKey && !e.shiftKey && (e.key === "t" || e.key === "T")) {
		e.preventDefault(); createNewTab(); return;
	}
	if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
		e.preventDefault(); if (activeTabId) closeTab(activeTabId); return;
	}
	if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
		e.preventDefault(); browserAddressEl.focus(); browserAddressEl.select(); return;
	}
	if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
		e.preventDefault(); reload(); return;
	}
	if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); goBack(); return; }
	if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); goForward(); return; }
});

// ---- Backend status UI ----

function updateBackendStatusUI() {
	const statusEl = document.getElementById("browserBackendStatus");
	if (!statusEl) return;
	statusEl.textContent = backendAvailable ? "Connected" : "Unavailable";
	statusEl.style.color = backendAvailable ? "#4caf50" : "#f44336";
}

// ---- Init ----

// initial tab
createTab("");

// focus address on open
const browserWindowEl = document.getElementById("browserWindow");
new MutationObserver(() => {
	if (browserWindowEl.classList.contains("show")) {
		const tab = getActiveTab();
		if (!tab || !tab.url) browserAddressEl.focus();
	}
}).observe(browserWindowEl, { attributes: true, attributeFilter: ["class"] });

// backend check
checkBackend();
setInterval(checkBackend, 15000);

// expose globals for settings
window.BrowOSBrowser = {
	checkBackend,
	get backendAvailable() { return backendAvailable; },
	get backendUrl() { return backendUrl; },
	set backendUrl(v) { backendUrl = normalizeBackendUrl(v); setBrowserSetting(BROWSER_KEYS.backendUrl, backendUrl); checkBackend(); },
	get proxyEnabled() { return proxyEnabled; },
	set proxyEnabled(v) { proxyEnabled = !!v; setBrowserSetting(BROWSER_KEYS.proxyEnabled, proxyEnabled ? "on" : "off"); },
	get compatMode() { return compatMode; },
	set compatMode(v) { compatMode = v; setBrowserSetting(BROWSER_KEYS.compatMode, v); },
	get searchEngine() { return searchEngine; },
	set searchEngine(v) { searchEngine = v; setBrowserSetting(BROWSER_KEYS.searchEngine, v); },
	get homepage() { return homepage; },
	set homepage(v) { homepage = v; setBrowserSetting(BROWSER_KEYS.homepage, v); },
	get newTabMode() { return newTabMode; },
	set newTabMode(v) { newTabMode = v; setBrowserSetting(BROWSER_KEYS.newTabMode, v); },
	get newTabUrl() { return newTabUrl; },
	set newTabUrl(v) { newTabUrl = v; setBrowserSetting(BROWSER_KEYS.newTabUrl, v); },
	get externalFallback() { return externalFallback; },
	set externalFallback(v) { externalFallback = v; setBrowserSetting(BROWSER_KEYS.externalFallback, v); },
	get adBlocker() { return adBlocker; },
	set adBlocker(v) { adBlocker = !!v; setBrowserSetting(BROWSER_KEYS.adBlocker, adBlocker ? "on" : "off"); },
	clearHistory() { historyList = []; saveHistory(); },
	clearBookmarks() { bookmarks = []; saveBookmarks(); },
	clearAll() { historyList = []; bookmarks = []; saveHistory(); saveBookmarks(); try { localStorage.removeItem(BROWSER_KEYS.tabs); } catch(e){} },
	bookmarks, historyList,
};

window.addEventListener("message", function (event) {
	const tab = getActiveTab();
	if (!tab || !event.data || typeof event.data !== "object") return;
	if (event.data.type === "browos-hover") {
		const original = extractOriginalUrl(event.data.url);
		browserStatusBarEl.textContent = original || "";
		return;
	}
	if (event.data.type !== "browos-navigate") return;
	const original = extractOriginalUrl(event.data.url);
	if (!original || original === tab.url) return;

	if (original === tab.expectedUrl) {
		if (tab.index >= 0 && tab.history[tab.index] !== original) tab.history[tab.index] = original;
		tab.url = original;
	} else {
		if (tab.index < tab.history.length - 1) {
			tab.history = tab.history.slice(0, tab.index + 1);
		}
		tab.history.push(original);
		tab.index = tab.history.length - 1;
		tab.url = original;
	}
	tab.expectedUrl = original;
	if (tab.id === activeTabId) {
		browserAddressEl.value = original;
		browserStatusBarEl.textContent = original;
	}
	renderTabs();
	updateUI();

	if (shouldUseProxy()) {
		fetch(proxify(original), { method: "HEAD", credentials: "include" })
			.then(function (res) {
				const finalUrl = res.headers.get("X-BrowOS-Final-URL") || res.headers.get("x-browos-final-url");
				if (finalUrl && finalUrl !== tab.url) {
					tab.url = finalUrl;
					if (tab.index >= 0) tab.history[tab.index] = finalUrl;
					if (tab.id === activeTabId) browserAddressEl.value = finalUrl;
					renderTabs();
					updateUI();
				}
			})
			.catch(function () {});
	}
});

setTimeout(function () {
	const B = window.BrowOSBrowser;
	if (!B) return;
	const map = [
		["browserSelfSearchEngine", "searchEngine"],
		["browserSelfHomepage", "homepage"],
		["browserSelfNewTabMode", "newTabMode"],
		["browserSelfNewTabUrl", "newTabUrl"],
		["browserSelfExternalFallback", "externalFallback"],
	];
	map.forEach(function (pair) {
		const el = document.getElementById(pair[0]);
		if (!el) return;
		const key = pair[1];
		el.value = B[key];
		el.addEventListener("change", function () {
			B[key] = el.value;
		});
	});
	const adBlockerToggle = document.getElementById("browserSelfAdBlocker");
	if (adBlockerToggle) {
		adBlockerToggle.checked = B.adBlocker;
		adBlockerToggle.addEventListener("change", function () {
			B.adBlocker = adBlockerToggle.checked;
		});
	}

	const clearBtn = document.getElementById("browserSelfClearData");
	if (clearBtn) {
		clearBtn.addEventListener("click", function () {
			if (confirm("Clear all browser data?")) {
				B.clearAll();
				alert("Browser data cleared.");
			}
		});
	}
}, 0);
