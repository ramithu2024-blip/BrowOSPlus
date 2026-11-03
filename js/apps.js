// Saved app state

function loadList(key, fallback) {
	try {
		const value = JSON.parse(localStorage.getItem(key));

		if (Array.isArray(value)) {
			return value;
		}
	} catch (error) {
		// broken data, use the default
	}

	return fallback;
}

let installedApps = loadList("browos-installed", null);

let desktopShortcuts = loadList("browos-desktop", []);

let taskbarPins = loadList("browos-pins", ["browstore"]);

let customSites = loadList("browos-sites", []);

// how each web app opens: "inside" BrowOS (default), as a floating "window", or in a browser "tab"

let openModes = {};

try {
	openModes = JSON.parse(localStorage.getItem("browos-open-modes")) || {};
} catch (error) {
	openModes = {};
}

// websites set to "Always open in tab" before this version

customSites.forEach(function (site) {
	if (site.openInTab) {
		openModes[site.id] = "tab";

		delete site.openInTab;
	}
});

function saveApps() {
	localStorage.setItem("browos-installed", JSON.stringify(installedApps));
	localStorage.setItem("browos-desktop", JSON.stringify(desktopShortcuts));
	localStorage.setItem("browos-pins", JSON.stringify(taskbarPins));
	localStorage.setItem("browos-sites", JSON.stringify(customSites));
	localStorage.setItem("browos-open-modes", JSON.stringify(openModes));
}

// FIRST RUN (and moving over the old desktop icon settings)

if (installedApps === null) {
	const oldIcons = [
		["browser", "heliumDesktopIcon", 32, 29, true],
		["notepad", "notepadDesktopIcon", 122, 29, false],
		["calculator", "calculatorDesktopIcon", 122, 119, false],
		["clock", "clockDesktopIcon", 122, 209, false],
		["paint", "paintDesktopIcon", 122, 299, false],
	];

	installedApps = [];
	desktopShortcuts = [];

	oldIcons.forEach(function (oldIcon) {
		const [appId, iconId, x, y, shownByDefault] = oldIcon;

		const hidden = localStorage.getItem(iconId + "-hidden");

		if (localStorage.getItem(iconId + "-deleted") !== "yes") {
			installedApps.push(appId);

			if (hidden === "no" || (hidden === null && shownByDefault)) {
				desktopShortcuts.push({
					id: appId,
					x: x,
					y: y,
					name: localStorage.getItem(iconId + "-name") || null,
				});
			}
		}

		localStorage.removeItem(iconId + "-hidden");
		localStorage.removeItem(iconId + "-name");
		localStorage.removeItem(iconId + "-deleted");
	});

	saveApps();
}

// HELIUM WAS REPLACED BY BROWSER: keep its place in Start, desktop and taskbar

function renameApp(oldId, newId) {
	let changed = false;

	installedApps = installedApps.map(function (id) {
		if (id === oldId) {
			changed = true;
			return newId;
		}

		return id;
	});

	taskbarPins = taskbarPins.map(function (id) {
		return id === oldId ? newId : id;
	});

	desktopShortcuts.forEach(function (shortcut) {
		if (shortcut.id === oldId) {
			shortcut.id = newId;

			// the old default name goes away, a name the user chose stays

			if (shortcut.name === "Helium") {
				shortcut.name = null;
			}
		}
	});

	if (openModes[oldId]) {
		openModes[newId] = openModes[oldId];

		delete openModes[oldId];
	}

	if (changed) {
		saveApps();
	}
}

renameApp("helium", "browser");

// Ensure the bundled Craft App Suite is visible in the Start menu

const craftAppIds = [
	"photocraft",
	"vectorcraft",
	"filmcraft",
	"lightcraft",
	"pdfcraft",
	"effectcraft",
	"designcraft",
	"figcraft",
	"wordcraft",
	"soundcraft",
	"deckcraft",
	"cadcraft",
	"gridcraft",
	"texturecraft",
	"craft-anything",
];

let craftAppsChanged = false;

craftAppIds.forEach(function (id) {
	if (!installedApps.includes(id)) {
		installedApps.push(id);
		craftAppsChanged = true;
	}
});

if (craftAppsChanged) {
	saveApps();
}

// Finding apps

function siteToApp(site) {
	const host = new URL(site.url).hostname.replace(/^www\./, "");

	return {
		id: site.id,
		name: site.customName || site.name || host,
		officialName: site.name || null,
		category: "sites",
		custom: true,
		icon: site.customIcon || site.iconUrl || siteIcon(host),
		url: site.url,
		website: site.url,
	};
}

function getApp(id) {
	if (id === "browstore") {
		return browStoreApp;
	}

	const app = appCatalog.find(function (item) {
		return item.id === id;
	});

	if (app) {
		return app;
	}

	const site = customSites.find(function (item) {
		return item.id === id;
	});

	if (site) {
		return siteToApp(site);
	}

	return null;
}

function isInstalled(id) {
	return id === "browstore" || installedApps.includes(id);
}

function isPinned(id) {
	return taskbarPins.includes(id);
}

function hasShortcut(id) {
	return desktopShortcuts.some(function (shortcut) {
		return shortcut.id === id;
	});
}

// a neutral icon when a website has none

function placeholderIcon(label) {
	const letter = (label || "?").trim().charAt(0).toUpperCase() || "?";

	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
		'<rect width="64" height="64" rx="14" fill="#3a3a44"/>' +
		'<text x="32" y="42" font-family="Arial" font-size="30" fill="#d8d8e0" text-anchor="middle">' +
		letter.replace(/[<>&"]/g, "") +
		"</text></svg>";

	return "data:image/svg+xml," + encodeURIComponent(svg);
}

function setIcon(img, app) {
	img.src = app.icon;

	img.addEventListener(
		"error",
		function () {
			img.src = placeholderIcon(app.name);
		},
		{ once: true }
	);
}

// App windows

const appWindowsParent = document.getElementById("settingsWindow").parentNode;

function createAppWindow(app) {
	const appWindow = document.createElement("div");

	appWindow.className = "app-window web-app-window";

	appWindow.id = "appWindow-" + app.id;

	appWindow.dataset.appId = app.id;
	appWindow.dataset.appName = app.name;
	appWindow.dataset.appIcon = app.icon;

	const header = document.createElement("div");

	header.className = "window-header";

	const title = document.createElement("div");

	title.className = "window-title";

	const titleIcon = document.createElement("img");

	setIcon(titleIcon, app);

	const titleText = document.createElement("span");

	titleText.textContent = app.name;

	title.append(titleIcon, titleText);

	const controls = document.createElement("div");

	controls.className = "window-controls";

	const minimizeButton = document.createElement("button");

	minimizeButton.className = "window-minimize";
	minimizeButton.textContent = "—";

	const closeButton = document.createElement("button");

	closeButton.className = "window-close";
	closeButton.textContent = "×";

	controls.append(minimizeButton, closeButton);

	header.append(title, controls);

	const frame = document.createElement("iframe");

	frame.className = "web-app-frame";

	frame.dataset.src = app.url;

	frame.allow = "fullscreen; clipboard-write; autoplay";

	appWindow.append(header, frame);

	// many websites don't allow being shown inside another page

	if (app.custom && !hintHidden(app.id)) {
		appWindow.appendChild(makeTabHint(app));
	}

	appWindowsParent.appendChild(appWindow);

	// same behaviour as every other BrowOS window

	setupWindow(appWindow);
	makeResizable(appWindow);
	addMaximizeButton(appWindow);
	addOpenInTabButton(appWindow, app);

	return appWindow;
}

// the small ↗ next to the title: opens the website in a normal browser tab

function addOpenInTabButton(appWindow, app) {
	if (!app.url || appWindow.querySelector(".window-tab-button")) {
		return;
	}

	const button = document.createElement("button");

	button.className = "window-tab-button";

	button.textContent = "↗";

	button.title = "Open in browser tab";

	button.addEventListener("click", function () {
		openInBrowserTab(app.url);
	});

	appWindow.querySelector(".window-title").appendChild(button);
}

function openInBrowserTab(url) {
	window.open(url, "_blank", "noopener");
}

// How web apps open

// sites that refuse to run inside BrowOS open in their own window by default

function defaultOpenMode(id) {
	const app = getApp(id);

	return (app && app.defaultMode) || "inside";
}

function getOpenMode(id) {
	return openModes[id] || defaultOpenMode(id);
}

function setOpenMode(id, mode) {
	if (mode === defaultOpenMode(id)) {
		delete openModes[id];
	} else {
		openModes[id] = mode;
	}

	saveApps();

	document.dispatchEvent(new Event("apps-changed"));
}

// the small bar under website windows: many sites refuse to be shown inside another page

// sites where the user closed the "Page not showing?" bar (the page works there)
function hintHidden(id) {
	try {
		return (JSON.parse(localStorage.getItem("browos-hint-hidden")) || []).includes(id);
	} catch (error) {
		return false;
	}
}

function hideHint(id) {
	let hidden = [];

	try {
		hidden = JSON.parse(localStorage.getItem("browos-hint-hidden")) || [];
	} catch (error) {
		hidden = [];
	}

	if (!hidden.includes(id)) {
		hidden.push(id);
		localStorage.setItem("browos-hint-hidden", JSON.stringify(hidden));
	}
}

function makeTabHint(app) {
	const bar = document.createElement("div");

	bar.className = "tab-hint";

	const text = document.createElement("span");

	text.textContent = "Page not showing?";

	const openButton = document.createElement("button");

	openButton.textContent = "Open in a window";

	const alwaysButton = document.createElement("button");

	alwaysButton.textContent = "Always";

	openButton.addEventListener("click", function () {
		closeApp(bar.closest(".app-window"));

		openFloatingWindow(app);
	});

	alwaysButton.addEventListener("click", function () {
		setOpenMode(app.id, "window");

		closeApp(bar.closest(".app-window"));

		openFloatingWindow(app);
	});

	// the page works fine: hide the bar for this site for good
	const closeButton = document.createElement("button");

	closeButton.className = "tab-hint-close";
	closeButton.textContent = "×";
	closeButton.title = "The page works, don't show this again";

	closeButton.addEventListener("click", function () {
		hideHint(app.id);
		bar.remove();
	});

	bar.append(text, openButton, alwaysButton, closeButton);

	return bar;
}

function getAppWindow(app) {
	if (app.window) {
		return document.getElementById(app.window);
	}

	return document.getElementById("appWindow-" + app.id) || createAppWindow(app);
}

// web apps that already have a window in index.html also get the ↗ button

appCatalog.forEach(function (app) {
	if (app.window && app.url) {
		addOpenInTabButton(document.getElementById(app.window), app);
	}
});

// Opening apps

function launchApp(id) {
	const app = getApp(id);

	// windows that are not apps (like Settings)

	if (!app) {
		const otherWindow = document.querySelector('.app-window[data-app-id="' + id + '"]');

		if (otherWindow) {
			openApp(otherWindow);
		}

		return;
	}

	const mode = app.url ? getOpenMode(id) : "inside";

	if (app.url && app.url.startsWith("apps/") && location.protocol === "file:") {
		// Fall back to the hosted Creative Suite when running from file://
		const hosted = "https://ramithu2024-blip.github.io/BrowOS-Creative-Suite/" + app.url;

		app.url = hosted;
	}

	if (mode === "tab") {
		openInBrowserTab(app.url);

		return;
	}

	if (mode === "window") {
		openFloatingWindow(app);

		return;
	}

	openApp(getAppWindow(app));
}

// Start menu

const appsMenuItem = document.getElementById("appsMenuItem");

const appsPanel = document.getElementById("appsPanel");

const appsSearch = document.getElementById("appsSearch");

const appsNoResults = document.getElementById("appsNoResults");

const defaultAppsGrid = document.getElementById("defaultAppsGrid");

const installedAppsGrid = document.getElementById("installedAppsGrid");

function closeStartMenu() {
	startMenu.classList.remove("show");
	appsPanel.classList.remove("show");
	appsMenuItem.classList.remove("active");
}

function renderAppsPanel() {
	defaultAppsGrid.innerHTML = "";
	installedAppsGrid.innerHTML = "";

	// default apps keep their usual order, other apps in the order they were added

	const builtInIds = appCatalog
		.filter(function (app) {
			return app.builtIn && installedApps.includes(app.id);
		})
		.map(function (app) {
			return app.id;
		});

	const otherIds = installedApps.filter(function (id) {
		return !builtInIds.includes(id);
	});

	builtInIds.concat(otherIds).forEach(function (id) {
		const app = getApp(id);

		if (!app) {
			return;
		}

		const tile = document.createElement("div");

		tile.className = "apps-grid-item";

		tile.dataset.app = id;

		const icon = document.createElement("img");

		setIcon(icon, app);

		const name = document.createElement("span");

		name.textContent = app.name;

		tile.append(icon, name);

		tile.addEventListener("click", function () {
			closeStartMenu();

			launchApp(id);
		});

		tile.addEventListener("contextmenu", function (event) {
			showAppMenu(event, id, null);
		});

		if (app.builtIn) {
			defaultAppsGrid.appendChild(tile);
		} else {
			installedAppsGrid.appendChild(tile);
		}
	});

	searchApps();
}

// Files, Settings and BrowStore in the Start menu

document.querySelectorAll(".menu-item[data-window], .menu-item[data-app]").forEach(function (item) {
	item.addEventListener("click", function () {
		closeStartMenu();

		if (item.dataset.app) {
			launchApp(item.dataset.app);

			return;
		}

		const appWindow = document.getElementById(item.dataset.window);

		// the explorer is not a normal app window

		if (appWindow === explorerWindow) {
			explorerWindow.classList.add("show");

			bringToFront(explorerWindow);
		} else {
			openApp(appWindow);
		}
	});
});

// Apps panel

appsMenuItem.addEventListener("click", function () {
	appsPanel.classList.toggle("show");

	if (appsPanel.classList.contains("show")) {
		appsMenuItem.classList.add("active");

		appsSearch.value = "";

		searchApps();

		appsSearch.focus();
	} else {
		appsMenuItem.classList.remove("active");
	}
});

startButton.addEventListener("click", function () {
	if (!startMenu.classList.contains("show")) {
		appsPanel.classList.remove("show");
		appsMenuItem.classList.remove("active");
	}
});

function searchApps() {
	const text = appsSearch.value.toLowerCase().trim();

	const tiles = appsPanel.querySelectorAll(".apps-grid-item");

	let firstResult = null;

	tiles.forEach(function (tile) {
		tile.classList.remove("selected");

		tile.hidden = !tile.textContent.toLowerCase().includes(text);

		if (!tile.hidden && firstResult === null) {
			firstResult = tile;
		}
	});

	if (firstResult && text !== "") {
		firstResult.classList.add("selected");
	}

	// hide a section when none of its apps are shown

	appsPanel.querySelectorAll(".apps-section").forEach(function (section) {
		section.hidden = section.querySelectorAll(".apps-grid-item:not([hidden])").length === 0;
	});

	appsNoResults.hidden = firstResult !== null;
}

appsSearch.addEventListener("input", searchApps);

appsSearch.addEventListener("keydown", function (event) {
	if (event.key === "Enter") {
		const selected = appsPanel.querySelector(".apps-grid-item.selected");

		if (selected) {
			closeStartMenu();

			launchApp(selected.dataset.app);
		}
	}

	if (event.key === "Escape") {
		closeStartMenu();
	}
});

// Close start menu when clicking outside

document.addEventListener("pointerdown", function (event) {
	if (
		!startMenu.contains(event.target) &&
		!appsPanel.contains(event.target) &&
		!startButton.contains(event.target)
	) {
		closeStartMenu();
	}
});
