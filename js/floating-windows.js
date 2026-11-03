// Floating windows

// Websites that refuse to run inside BrowOS open as real Chrome windows,
// placed on the BrowOS desktop and kept inside it.

const floatingWindows = {};
const minimizedWithBrowOS = [];

let mainWindowId = null;
let lastMainBounds = null;

function floatingAppId(windowId) {
	return Object.keys(floatingWindows).find(function (appId) {
		return floatingWindows[appId] === windowId;
	});
}

// the BrowOS desktop on the screen (the page, minus the taskbar)

async function browosArea() {
	const main = await chrome.windows.getCurrent();

	const border = Math.max(0, Math.round((window.outerWidth - window.innerWidth) / 2));

	return {
		left: main.left + border,
		top: main.top + (window.outerHeight - window.innerHeight) - border,
		width: window.innerWidth,
		height: window.innerHeight - 90,
	};
}

function fitInArea(bounds, area) {
	const width = Math.min(bounds.width, area.width);

	const height = Math.min(bounds.height, area.height);

	return {
		left: Math.round(
			Math.min(Math.max(bounds.left, area.left), area.left + area.width - width)
		),
		top: Math.round(Math.min(Math.max(bounds.top, area.top), area.top + area.height - height)),
		width: Math.round(width),
		height: Math.round(height),
	};
}

function setFloatingButton(appId, open) {
	const app = getApp(appId);

	if (!app) {
		return;
	}

	let button = getTaskbarButton(appId);

	if (open) {
		button = button || createTaskbarButton(getAppWindow(app));

		button.classList.add("active");
	} else if (button && isPinned(appId)) {
		button.classList.remove("active");
	} else if (button) {
		button.remove();
	}
}

async function openFloatingWindow(app) {
	// already open: bring it to the front

	if (floatingWindows[app.id]) {
		try {
			await chrome.windows.update(floatingWindows[app.id], {
				state: "normal",
				focused: true,
			});

			return;
		} catch (error) {
			delete floatingWindows[app.id];
		}
	}

	const area = await browosArea();

	const width = Math.min(1200, area.width - 60);

	const height = Math.min(800, area.height - 40);

	const created = await chrome.windows.create({
		url: app.url,
		type: "popup",
		left: Math.round(area.left + (area.width - width) / 2),
		top: Math.round(area.top + 20),
		width: Math.round(width),
		height: Math.round(height),
		focused: true,
	});

	floatingWindows[app.id] = created.id;
	setFloatingButton(app.id, true);
}

function closeFloatingWindow(appId) {
	if (floatingWindows[appId]) {
		chrome.windows.remove(floatingWindows[appId]).catch(function () {});
	}
}

// keep floating windows inside BrowOS, and move them when BrowOS moves

// Windows reports every small move while dragging and adds an invisible border,
// so BrowOS waits until the drag is over, only moves the window back
// (never resizes it unless it's bigger than BrowOS), and ignores its own corrections.

const snapTimers = {};
const ignoreBoundsUntil = {};

const snapTolerance = 16;

async function keepInside(windowId) {
	let floating;

	try {
		floating = await chrome.windows.get(windowId);
	} catch (error) {
		return;
	}

	// minimized, maximized or full screen: the user chose that, leave the window alone
	// (only normal-sized windows are kept inside the BrowOS desktop)

	if (floating.state !== "normal") {
		return;
	}

	const area = await browosArea();

	const fitted = fitInArea(floating, area);

	const outside =
		Math.abs(fitted.left - floating.left) > snapTolerance ||
		Math.abs(fitted.top - floating.top) > snapTolerance;

	const tooBig =
		floating.width > area.width + snapTolerance ||
		floating.height > area.height + snapTolerance;

	if (!outside && !tooBig) {
		return;
	}

	const update = {
		left: fitted.left,
		top: fitted.top,
	};

	if (tooBig) {
		update.width = fitted.width;
		update.height = fitted.height;
	}

	ignoreBoundsUntil[windowId] = Date.now() + 800;

	chrome.windows.update(windowId, update).catch(function () {});
}

if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.onBoundsChanged) {
chrome.windows.onBoundsChanged.addListener(async function (changed) {
	// BrowOS itself moved: the floating windows follow (position only)

	if (changed.id === mainWindowId) {
		const dx = lastMainBounds ? changed.left - lastMainBounds.left : 0;
		const dy = lastMainBounds ? changed.top - lastMainBounds.top : 0;

		lastMainBounds = {
			left: changed.left,
			top: changed.top,
		};

		if (dx === 0 && dy === 0) {
			return;
		}

		for (const windowId of Object.values(floatingWindows)) {
			try {
				const floating = await chrome.windows.get(windowId);

				if (floating.state !== "normal") {
					continue;
				}

				ignoreBoundsUntil[windowId] = Date.now() + 800;

				await chrome.windows.update(windowId, {
					left: floating.left + dx,
					top: floating.top + dy,
				});
			} catch (error) {
				// the window was closed
			}
		}

		return;
	}

	if (!floatingAppId(changed.id)) {
		return;
	}

	// a correction BrowOS just made itself

	if (Date.now() < (ignoreBoundsUntil[changed.id] || 0)) {
		return;
	}

	// wait until the user stops dragging

	clearTimeout(snapTimers[changed.id]);

	snapTimers[changed.id] = setTimeout(function () {
		keepInside(changed.id);
	}, 150);
});
}

// Double check, a few times per second

// Some browsers don't report every move or minimize,
// so BrowOS also checks its floating windows itself.
// A window is only moved back once it has stopped moving (the drag is over).

const lastSeenBounds = {};

setInterval(async function () {
	if (Object.keys(floatingWindows).length === 0 || mainWindowId === null) {
		return;
	}

	let main;

	try {
		main = await chrome.windows.get(mainWindowId);
	} catch (error) {
		return;
	}

	for (const windowId of Object.values(floatingWindows)) {
		let floating;

		try {
			floating = await chrome.windows.get(windowId);
		} catch (error) {
			continue;
		}

		// the BrowOS taskbar button shows if the window is open or minimized

		const floatingButton = getTaskbarButton(floatingAppId(windowId));

		if (floatingButton) {
			floatingButton.classList.toggle("active", floating.state !== "minimized");
		}

		// the browser was minimized: minimize with it

		if (main.state === "minimized") {
			if (floating.state !== "minimized") {
				minimizedWithBrowOS.push(windowId);

				chrome.windows.update(windowId, { state: "minimized" }).catch(function () {});
			}

			continue;
		}

		// the browser came back: so do the windows it minimized

		if (minimizedWithBrowOS.includes(windowId)) {
			minimizedWithBrowOS.splice(minimizedWithBrowOS.indexOf(windowId), 1);

			chrome.windows.update(windowId, { state: "normal" }).catch(function () {});

			continue;
		}

		// outside BrowOS and not moving anymore: put it back inside

		const bounds = [
			floating.left,
			floating.top,
			floating.width,
			floating.height,
			floating.state,
		].join(",");

		if (lastSeenBounds[windowId] === bounds) {
			keepInside(windowId);
		}

		lastSeenBounds[windowId] = bounds;
	}
}, 250);

if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.onRemoved) {
	chrome.windows.onRemoved.addListener(function (windowId) {
	const appId = floatingAppId(windowId);

	if (appId) {
		delete floatingWindows[appId];
		setFloatingButton(appId, false);
	}
	});
}

// floating windows minimize with BrowOS and come back with it

document.addEventListener("visibilitychange", function () {
	if (document.hidden) {
		Object.values(floatingWindows).forEach(function (windowId) {
			chrome.windows
				.get(windowId)
				.then(function (floating) {
					if (floating.state !== "minimized") {
						minimizedWithBrowOS.push(windowId);

						chrome.windows.update(windowId, { state: "minimized" });
					}
				})
				.catch(function () {});
		});
	} else {
		minimizedWithBrowOS.splice(0).forEach(function (windowId) {
			chrome.windows.update(windowId, { state: "normal" }).catch(function () {});
		});
	}
});

// closing BrowOS closes its windows

window.addEventListener("pagehide", function () {
	Object.values(floatingWindows).forEach(function (windowId) {
		chrome.windows.remove(windowId).catch(function () {});
	});
});

if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.getCurrent) {
	chrome.windows.getCurrent().then(function (main) {
		mainWindowId = main.id;

		lastMainBounds = {
			left: main.left,
			top: main.top,
		};
	}).catch(function () {});
}
