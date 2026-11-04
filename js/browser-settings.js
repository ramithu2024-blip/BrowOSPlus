// Browser settings wiring

setTimeout(function () {
	const B = window.BrowOSBrowser;
	if (!B) return;

	const urlInput = document.getElementById("browserBackendUrl");
	const statusEl = document.getElementById("browserBackendStatus");
	const testBtn = document.getElementById("browserBackendTest");
	const proxyToggle = document.getElementById("browserProxyEnabled");
	const compatSelect = document.getElementById("browserCompatMode");
	const searchSelect = document.getElementById("browserSearchEngine");
	const homepageInput = document.getElementById("browserHomepage");
	const newTabModeSelect = document.getElementById("browserNewTabMode");
	const newTabUrlInput = document.getElementById("browserNewTabUrl");
	const fallbackSelect = document.getElementById("browserExternalFallback");
	const adBlockerToggle = document.getElementById("browserAdBlocker");

	if (urlInput) {
		urlInput.value = B.backendUrl;
		urlInput.addEventListener("change", () => {
			B.backendUrl = urlInput.value;
			statusEl.textContent = B.backendAvailable ? "Connected" : "Unavailable";
		});
	}

	function setProxyUIVisible(visible) {
		["browserBackendUrl", "browserBackendStatus", "browserBackendTest", "browserProxyEnabled", "browserCompatMode"].forEach(function (id) {
			const el = document.getElementById(id);
			if (!el) return;
			const row = el.closest(".setting-row");
			if (row) row.style.display = visible ? "" : "none";
		});
	}

	function refreshStatus() {
		B.checkBackend().then(() => {
			const available = B.backendAvailable;
			setProxyUIVisible(available);
			if (statusEl) {
				statusEl.textContent = available ? "Connected" : "";
				statusEl.style.color = available ? "#4caf50" : "";
			}
		});
	}

	if (testBtn) testBtn.addEventListener("click", refreshStatus);

	if (proxyToggle) {
		proxyToggle.checked = B.proxyEnabled;
		proxyToggle.addEventListener("change", () => { B.proxyEnabled = proxyToggle.checked; });
	}
	if (compatSelect) {
		compatSelect.value = B.compatMode;
		compatSelect.addEventListener("change", () => { B.compatMode = compatSelect.value; });
	}
	if (searchSelect) {
		searchSelect.value = B.searchEngine;
		searchSelect.addEventListener("change", () => { B.searchEngine = searchSelect.value; });
	}
	if (homepageInput) {
		homepageInput.value = B.homepage;
		homepageInput.addEventListener("change", () => { B.homepage = homepageInput.value; });
	}
	if (newTabModeSelect) {
		newTabModeSelect.value = B.newTabMode;
		newTabModeSelect.addEventListener("change", () => { B.newTabMode = newTabModeSelect.value; });
	}
	if (newTabUrlInput) {
		newTabUrlInput.value = B.newTabUrl;
		newTabUrlInput.addEventListener("change", () => { B.newTabUrl = newTabUrlInput.value; });
	}
	if (fallbackSelect) {
		fallbackSelect.value = B.externalFallback;
		fallbackSelect.addEventListener("change", () => { B.externalFallback = fallbackSelect.value; });
	}
	if (adBlockerToggle) {
		adBlockerToggle.checked = B.adBlocker;
		adBlockerToggle.addEventListener("change", () => { B.adBlocker = adBlockerToggle.checked; });
	}

	const clearHistoryBtn = document.getElementById("browserClearHistory");
	const clearBookmarksBtn = document.getElementById("browserClearBookmarks");
	const clearDataBtn = document.getElementById("browserClearData");

	if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", () => { B.clearHistory(); showAlert("History cleared."); });
	if (clearBookmarksBtn) clearBookmarksBtn.addEventListener("click", () => { B.clearBookmarks(); showAlert("Bookmarks cleared."); });
	if (clearDataBtn) clearDataBtn.addEventListener("click", async () => {
		if (await showConfirm("Clear all browser data?")) { B.clearAll(); showAlert("Browser data cleared."); }
	});

	refreshStatus();
}, 0);