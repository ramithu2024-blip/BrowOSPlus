// Adding and removing apps

function appsChanged() {
	saveApps();

	renderAppsPanel();

	renderDesktop();

	document.dispatchEvent(new Event("apps-changed"));
}

function installApp(id) {
	if (!installedApps.includes(id)) {
		installedApps.push(id);

		appsChanged();
	}
}

function addShortcut(id) {
	if (hasShortcut(id)) {
		return;
	}

	const spot = freeDesktopSpot();

	desktopShortcuts.push({
		id: id,
		x: spot.x,
		y: spot.y,
		name: null,
	});

	appsChanged();
}

function removeShortcut(id) {
	desktopShortcuts = desktopShortcuts.filter(function (shortcut) {
		return shortcut.id !== id;
	});

	appsChanged();
}

function pinApp(id) {
	if (!isPinned(id)) {
		taskbarPins.push(id);

		saveApps();

		renderPins();

		document.dispatchEvent(new Event("apps-changed"));
	}
}

function unpinApp(id) {
	taskbarPins = taskbarPins.filter(function (item) {
		return item !== id;
	});

	saveApps();

	// the button stays only while the app is open

	const button = getTaskbarButton(id);

	const app = getApp(id);

	if (button && app) {
		const appWindow = getAppWindow(app);

		if (!appWindow.classList.contains("show")) {
			button.remove();
		}
	}

	document.dispatchEvent(new Event("apps-changed"));
}

// removes the app from the Start menu, desktop and taskbar.
// Its saved data stays, so adding it back brings everything back.

function removeApp(id) {
	if (id === "browstore") {
		return;
	}

	const app = getApp(id);

	if (app) {
		const appWindow = app.window
			? document.getElementById(app.window)
			: document.getElementById("appWindow-" + id);

		if (appWindow) {
			closeApp(appWindow);
		}
	}

	closeFloatingWindow(id);

	delete openModes[id];

	taskbarPins = taskbarPins.filter(function (item) {
		return item !== id;
	});

	const pinButton = getTaskbarButton(id);

	if (pinButton) {
		pinButton.remove();
	}

	desktopShortcuts = desktopShortcuts.filter(function (shortcut) {
		return shortcut.id !== id;
	});

	installedApps = installedApps.filter(function (item) {
		return item !== id;
	});

	// a website shortcut is just a link, removing it forgets it

	if (app && app.custom) {
		customSites = customSites.filter(function (site) {
			return site.id !== id;
		});

		const siteWindow = document.getElementById("appWindow-" + id);

		if (siteWindow) {
			siteWindow.remove();
		}
	}

	appsChanged();
}

// only for apps whose data lives inside BrowOS

function hasAppData(id) {
	const app = getApp(id);

	return Boolean(app && app.dataKeys);
}

async function deleteAppData(id) {
	const app = getApp(id);

	if (!app || !app.dataKeys) {
		return false;
	}

	if (!await showConfirm("Delete all saved " + app.name + " data? This can't be undone.")) {
		return false;
	}

	app.dataKeys.forEach(function (key) {
		localStorage.removeItem(key);
	});

	(app.dataDatabases || []).forEach(function (database) {
		indexedDB.deleteDatabase(database);
	});

	// reload the app if it is open so it starts clean

	const frame = document.querySelector("#" + app.window + " iframe");

	if (frame && frame.getAttribute("src")) {
		frame.src = frame.getAttribute("src");
	}

	return true;
}

// Right click menu

const contextMenu = document.getElementById("contextMenu");

const contextItems = contextMenu.querySelectorAll(".context-item");

let contextAppId = null;
let contextIcon = null;

function showAppMenu(event, id, icon) {
	event.preventDefault();

	contextAppId = id;
	contextIcon = icon;

	const actions = ["open"];

	if (id !== "browstore") {
		actions.push(hasShortcut(id) ? "remove-desktop" : "add-desktop");
	}

	actions.push(isPinned(id) ? "unpin" : "pin");

	if (icon) {
		actions.push("rename");
	}

	if (id !== "browstore") {
		actions.push("uninstall");
	}

	contextItems.forEach(function (item) {
		item.hidden = !actions.includes(item.dataset.action);
	});

	contextMenu.classList.add("show");

	// keep the menu inside the screen

	const x = Math.min(event.clientX, window.innerWidth - contextMenu.offsetWidth - 8);

	const y = Math.min(event.clientY, window.innerHeight - contextMenu.offsetHeight - 8);

	contextMenu.style.left = x + "px";
	contextMenu.style.top = y + "px";
}

function hideContextMenu() {
	contextMenu.classList.remove("show");
}

contextItems.forEach(function (item) {
	item.addEventListener("click", function () {
		const action = item.dataset.action;

		const id = contextAppId;

		hideContextMenu();

		if (action === "open") {
			closeStartMenu();

			launchApp(id);
		}

		if (action === "add-desktop") {
			closeStartMenu();

			addShortcut(id);
		}

		if (action === "remove-desktop") {
			removeShortcut(id);
		}

		if (action === "pin") {
			pinApp(id);
		}

		if (action === "unpin") {
			unpinApp(id);
		}

		if (action === "rename" && contextIcon) {
			startRename(contextIcon);
		}

		if (action === "uninstall") {
			closeStartMenu();

			removeApp(id);
		}
	});
});

document.addEventListener("pointerdown", function (event) {
	if (!contextMenu.contains(event.target)) {
		hideContextMenu();
	}
});

document.addEventListener("keydown", function (event) {
	if (event.key === "Escape") {
		hideContextMenu();
	}
});
