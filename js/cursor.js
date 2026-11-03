// Cursor

const fakeCursor = document.getElementById("fakeCursor");

const cursorSelect = document.getElementById("cursorSelect");

const cursorUpload = document.getElementById("cursorUpload");

// things that show the hand

const clickableThings =
	"button, a, select, label, .desktop-icon, .menu-item, .apps-grid-item, .context-item, .settings-nav, .folder-nav, .wallpaper-option, .accent-option, .taskbar-app-button, .start-button, .explorer-button, .file-item";

// things that keep the normal text cursor

const textThings =
	'input[type="text"], input:not([type]), textarea, [contenteditable="true"], .resize-handle';

function updateCursor() {
	const customImage = localStorage.getItem("browos-custom-cursor");

	fakeCursor.classList.remove("pixel", "custom");

	fakeCursor.style.backgroundImage = "";

	if (cursorSelect.value === "browos") {
		document.documentElement.classList.add("fake-cursor-on");

		fakeCursor.classList.add("custom");

		fakeCursor.style.backgroundImage = 'url("cursors/cursor.png")';
	} else if (cursorSelect.value === "custom" && customImage) {
		document.documentElement.classList.add("fake-cursor-on");

		fakeCursor.classList.add("custom");

		fakeCursor.style.backgroundImage = 'url("' + customImage + '")';
	} else {
		document.documentElement.classList.remove("fake-cursor-on");
	}
}

cursorSelect.value = localStorage.getItem("browos-cursor") || "browos";

updateCursor();

cursorSelect.addEventListener("change", function () {
	localStorage.setItem("browos-cursor", cursorSelect.value);

	// "My cursor" with nothing uploaded yet opens the file picker

	if (cursorSelect.value === "custom" && !localStorage.getItem("browos-custom-cursor")) {
		cursorUpload.click();
	}

	updateCursor();
});

cursorUpload.addEventListener("change", function () {
	const file = cursorUpload.files[0];

	if (!file) {
		return;
	}

	const reader = new FileReader();

	reader.onload = function () {
		try {
			localStorage.setItem("browos-custom-cursor", reader.result);
		} catch (error) {
			alert("This cursor image is too big, try a smaller one.");

			return;
		}

		cursorSelect.value = "custom";

		cursorSelect.dispatchEvent(new Event("change"));

		localStorage.setItem("browos-cursor", "custom");

		updateCursor();
	};

	reader.readAsDataURL(file);

	cursorUpload.value = "";
});

// Near website apps: the normal cursor takes over

// Websites (Photopea, added sites...) can't show the BrowOS cursor.
// The browser doesn't always say when the mouse goes into one,
// so BrowOS looks where the mouse is heading and switches a moment before.

let normalCursorNearApp = false;

function websiteAppAt(x, y) {
	const element = document.elementFromPoint(x, y);

	if (!element || element.tagName !== "IFRAME") {
		return false;
	}

	// BrowOS's own apps (Notepad, Calculator) can be reached and use the BrowOS cursor

	try {
		return !element.contentDocument;
	} catch (error) {
		return true;
	}
}

function nearWebsiteApp(event) {
	const x = event.clientX;
	const y = event.clientY;
	const dx = event.movementX;
	const dy = event.movementY;

	const points = [
		[x, y],
		[x + dx, y + dy],
		[x + dx * 2, y + dy * 2],
		[x + dx * 3, y + dy * 3],
		[x + 8, y],
		[x - 8, y],
		[x, y + 8],
		[x, y - 8],
	];

	return points.some(function (point) {
		return websiteAppAt(point[0], point[1]);
	});
}

function useNormalCursorNearApp(normal) {
	if (normal && !normalCursorNearApp) {
		normalCursorNearApp = true;

		document.documentElement.classList.remove("fake-cursor-on");

		fakeCursor.classList.add("hide");
	}

	if (!normal && normalCursorNearApp) {
		normalCursorNearApp = false;

		// back to the chosen cursor

		updateCursor();
	}
}

// Follow the mouse

document.addEventListener("pointermove", function (event) {
	fakeCursor.style.translate = event.clientX + "px " + event.clientY + "px";

	if (nearWebsiteApp(event)) {
		useNormalCursorNearApp(true);

		return;
	}

	useNormalCursorNearApp(false);

	if (event.target.closest(textThings)) {
		fakeCursor.classList.add("hide");

		return;
	}

	fakeCursor.classList.remove("hide");

	if (event.target.closest(clickableThings)) {
		fakeCursor.classList.add("hand");
	} else {
		fakeCursor.classList.remove("hand");
	}
});

document.addEventListener("pointerdown", function () {
	fakeCursor.classList.add("clicking");
});

document.addEventListener("pointerup", function () {
	fakeCursor.classList.remove("clicking");
});

// apps (Photopea, websites...) show their own cursor,
// so the BrowOS cursor hides as soon as the mouse goes over one

function hideFakeCursor() {
	fakeCursor.classList.add("hide");
}

document.addEventListener("pointerover", function (event) {
	if (event.target.tagName === "IFRAME") {
		hideFakeCursor();
	}
});

// leaving BrowOS's own page (into an app) gives no "other element"

document.addEventListener("pointerout", function (event) {
	if (!event.relatedTarget || event.relatedTarget.tagName === "IFRAME") {
		hideFakeCursor();
	}
});

// clicking inside an app takes the focus away from BrowOS

window.addEventListener("blur", hideFakeCursor);

document.documentElement.addEventListener("mouseleave", function () {
	fakeCursor.classList.add("hide");
});

// Cursor size

const cursorSizeSlider = document.getElementById("cursorSizeSlider");

function updateCursorSize() {
	document.documentElement.style.setProperty("--cursor-size", cursorSizeSlider.value + "px");
}

cursorSizeSlider.value = localStorage.getItem("browos-cursor-size") || 32;

updateCursorSize();

cursorSizeSlider.addEventListener("input", function () {
	localStorage.setItem("browos-cursor-size", cursorSizeSlider.value);

	updateCursorSize();
});

// CURSOR INSIDE BROWOS'S OWN APPS (Notepad, Calculator)

// Websites always show their own cursor, browsers don't allow changing it.
// Apps that live inside the extension can use the BrowOS cursor too.

let appCursorImage = null;

function cursorImageUrl() {
	if (cursorSelect.value === "browos") {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
			return chrome.runtime.getURL("cursors/cursor.png");
		}
		return "cursors/cursor.png";
	}

	if (cursorSelect.value === "custom") {
		return localStorage.getItem("browos-custom-cursor");
	}

	return null;
}

// a normal cursor image can't be resized, so a copy is drawn at the chosen size

function prepareAppCursor() {
	const url = cursorImageUrl();

	if (!url) {
		appCursorImage = null;

		applyCursorToApps();

		return;
	}

	const image = new Image();

	image.addEventListener("load", function () {
		try {
			// browsers ignore cursor images bigger than 128px

			const size = Math.min(Number(cursorSizeSlider.value) || 32, 128);

			const scale = size / Math.max(image.width, image.height);

			const canvas = document.createElement("canvas");

			canvas.width = Math.max(1, Math.round(image.width * scale));
			canvas.height = Math.max(1, Math.round(image.height * scale));

			canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

			appCursorImage = canvas.toDataURL("image/png");
		} catch (error) {
			appCursorImage = null;
		}

		applyCursorToApps();
	});

	image.addEventListener("error", function () {
		appCursorImage = null;

		applyCursorToApps();
	});

	image.src = url;
}

function applyCursorToApps() {
	document.querySelectorAll(".web-app-frame").forEach(function (frame) {
		let page = null;

		// only pages from the extension itself can be reached

		try {
			page = frame.contentDocument;
		} catch (error) {
			return;
		}

		if (!page || !page.head) {
			return;
		}

		let style = page.getElementById("browos-cursor");

		if (!appCursorImage) {
			if (style) {
				style.remove();
			}

			return;
		}

		if (!style) {
			style = page.createElement("style");

			style.id = "browos-cursor";

			page.head.appendChild(style);
		}

		style.textContent =
			'* { cursor: url("' +
			appCursorImage +
			'") 0 0, auto !important; }' +
			'input, textarea, [contenteditable="true"] { cursor: text !important; }';
	});
}

// apply again every time an app finishes loading

document.querySelectorAll(".web-app-frame").forEach(function (frame) {
	frame.addEventListener("load", applyCursorToApps);
});

cursorSelect.addEventListener("change", prepareAppCursor);

cursorSizeSlider.addEventListener("input", prepareAppCursor);

cursorUpload.addEventListener("change", function () {
	// the upload is read a moment later

	setTimeout(prepareAppCursor, 300);
});

prepareAppCursor();
