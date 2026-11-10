// Taskbar apps

const taskbarApps = document.getElementById("taskbarApps");

function getTaskbarButton(appId) {
	return document.querySelector(`[data-taskbar-app="${appId}"]`);
}

function createTaskbarButton(appWindow) {
	const appId = appWindow.dataset.appId;

	const appName = appWindow.dataset.appName;

	const appIcon = appWindow.dataset.appIcon;

	let button = getTaskbarButton(appId);

	if (button) {
		return button;
	}

	button = document.createElement("button");

	button.className = "taskbar-app-button active";

	button.dataset.taskbarApp = appId;

	button.innerHTML = `

		<img
			src="${appIcon}"
			alt="${appName}"
		>

	`;

	button.addEventListener("click", function () {
		if (appWindow.classList.contains("show")) {
			appWindow.classList.remove("show");

			button.classList.remove("focused");
			button.classList.add("running");
		} else {
			launchApp(appWindow.dataset.appId);
		}
	});

	taskbarApps.appendChild(button);

	return button;
}

function openApp(appWindow) {
	// the Task Manager lists windows that are running (open or minimized)

	appWindow.dataset.running = "true";

	const frame = appWindow.querySelector("iframe[data-src]");

	if (frame && !frame.src) {
		frame.src = frame.dataset.src;
	}

	appWindow.classList.add("show");

	bringToFront(appWindow);

	const button = createTaskbarButton(appWindow);

	// Remove focus from other buttons, keep running state
	document.querySelectorAll(".taskbar-app-button").forEach(function (btn) {
		btn.classList.remove("focused");
	});

	button.classList.add("running", "focused");
}

function minimizeApp(appWindow) {
	appWindow.classList.remove("show");

	const button = getTaskbarButton(appWindow.dataset.appId);

	if (button) {
		button.classList.remove("focused");
		button.classList.add("running");
	}
}

function closeApp(appWindow) {
	delete appWindow.dataset.running;

	appWindow.classList.remove("show");

	const button = getTaskbarButton(appWindow.dataset.appId);

	// pinned apps keep their taskbar button

	if (button && isPinned(appWindow.dataset.appId)) {
		button.classList.remove("running", "focused");
	} else if (button) {
		button.remove();
	}

	// Files uses the explorer button instead of a taskbar button
	if (appWindow === document.getElementById("explorerWindow") || appWindow.dataset.appId === "files") {
		const explorerButton = document.getElementById("explorerButton");
		if (explorerButton) explorerButton.classList.remove("running", "focused");
	}
}

function applyTaskbarPosition() {
	const taskbar = document.querySelector(".taskbar");
	if (!taskbar) return;
	const pos = localStorage.getItem("browos-taskbar-position") || "bottom";
	taskbar.classList.remove("pos-bottom", "pos-top", "pos-left", "pos-right");
	taskbar.classList.add("pos-" + pos);

	const startMenu = document.getElementById("startMenu");
	if (startMenu) {
		startMenu.classList.remove("sm-bottom", "sm-top", "sm-left", "sm-right");
		startMenu.classList.add("sm-" + pos);
	}
}

function applyTaskbarStyle() {
	const taskbar = document.querySelector(".taskbar");
	if (!taskbar) return;
	const style = localStorage.getItem("browos-taskbar-style") || "original";
	taskbar.classList.remove("style-original", "style-windows", "style-mac");
	taskbar.classList.add("style-" + style);
}

function applyTaskbarAutoHide() {
	const taskbar = document.querySelector(".taskbar");
	if (!taskbar) return;
	if (localStorage.getItem("browos-taskbar-autohide") === "on") {
		taskbar.classList.add("autohide");
	} else {
		taskbar.classList.remove("autohide", "hidden");
	}
}

applyTaskbarPosition();
applyTaskbarStyle();
applyTaskbarAutoHide();

document.addEventListener("mousemove", function (e) {
	const taskbar = document.querySelector(".taskbar");
	if (!taskbar || !taskbar.classList.contains("autohide")) return;
	const startMenu = document.getElementById("startMenu");
	if (startMenu && startMenu.classList.contains("show")) {
		taskbar.classList.remove("hidden");
		return;
	}
	const rect = taskbar.getBoundingClientRect();
	let near = false;
	const pos = localStorage.getItem("browos-taskbar-position") || "bottom";
	if (pos === "bottom") near = e.clientY >= window.innerHeight - 80;
	else if (pos === "top") near = e.clientY <= 80;
	else if (pos === "left") near = e.clientX <= 80;
	else if (pos === "right") near = e.clientX >= window.innerWidth - 80;
	const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
	if (near || over) taskbar.classList.remove("hidden");
	else taskbar.classList.add("hidden");
});

document.addEventListener("mousemove", function (e) {
	const taskbar = document.querySelector(".taskbar");
	if (!taskbar || !taskbar.classList.contains("style-mac")) return;
	taskbar.querySelectorAll(".taskbar-app-button, .start-button, .explorer-button").forEach(btn => {
		const r = btn.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const cy = r.top + r.height / 2;
		const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
		const maxMag = parseFloat(localStorage.getItem("browos-dock-magnification") || "1.5");
		const scale = dist < 90 ? 1 + (90 - dist) / 90 * (maxMag - 1) : 1;
		btn.style.transform = "scale(" + scale + ")";
	});
});

window.setActiveTaskbarApp = function (appId) {
	document.querySelectorAll(".taskbar-app-button").forEach(function (btn) {
		btn.classList.remove("focused");
	});
	if (appId === "files") {
		const btn = document.querySelector(".explorer-button");
		if (btn) btn.classList.add("focused");
	} else {
		const btn = document.querySelector('[data-taskbar-app="' + appId + '"]');
		if (btn) btn.classList.add("focused");
	}
};
