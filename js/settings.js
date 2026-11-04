// Startup sound

const startupSound = document.getElementById("startup-sound");

startupSound.volume = (localStorage.getItem("volume") || 70) / 100;

if (localStorage.getItem("startupSound") !== "off") {
	startupSound.play().catch(() => {});
}

// Settings

const settingsWindow = document.getElementById("settingsWindow");

// Settings pages

const settingsNavButtons = document.querySelectorAll(".settings-nav");

const settingsPages = document.querySelectorAll(".settings-page");

settingsNavButtons.forEach(function (button) {
	button.addEventListener("click", function () {
		settingsNavButtons.forEach(function (item) {
			item.classList.remove("active");
		});

		settingsPages.forEach(function (page) {
			page.classList.remove("show");
		});

		button.classList.add("active");

		document.getElementById(button.dataset.page).classList.add("show");
	});
});

// Wallpaper

const desktopShell = document.querySelector(".desktop-shell");

const wallpaperOptions = document.querySelectorAll(".wallpaper-option");

function setWallpaper(image) {
	desktopShell.style.backgroundImage = 'url("' + image + '")';

	wallpaperOptions.forEach(function (option) {
		option.classList.remove("selected");

		if (option.dataset.wallpaper === image) {
			option.classList.add("selected");
		}
	});

	if (typeof autoAccentFromWallpaper === "function") {
		autoAccentFromWallpaper(image);
	}
}

const savedWallpaper = localStorage.getItem("wallpaper") || "wallpapers/wallpaper.jpg";

if (savedWallpaper === "custom") {
	setWallpaper(localStorage.getItem("customWallpaper"));
} else {
	setWallpaper(savedWallpaper);
}

wallpaperOptions.forEach(function (option) {
	option.addEventListener("click", function () {
		setWallpaper(option.dataset.wallpaper);

		localStorage.setItem("wallpaper", option.dataset.wallpaper);
	});
});

// Upload wallpaper

const wallpaperUpload = document.getElementById("wallpaperUpload");

wallpaperUpload.addEventListener("change", function () {
	const file = wallpaperUpload.files[0];

	if (!file) {
		return;
	}

	const reader = new FileReader();

	reader.onload = function () {
		try {
			localStorage.setItem("customWallpaper", reader.result);

			localStorage.setItem("wallpaper", "custom");
		} catch (error) {
			showAlert("This image is too big, try a smaller one.");

			return;
		}

		setWallpaper(reader.result);

		showCustomTile();
	};

	reader.readAsDataURL(file);
});

// Boot animation

const bootToggle = document.getElementById("bootToggle");

bootToggle.checked = localStorage.getItem("bootAnimation") !== "off";

if (!bootToggle.checked) {
	document.querySelector(".boot-screen").style.display = "none";

	document.querySelector(".boot-input-shield").style.display = "none";

	desktopShell.style.animation = "none";

	desktopShell.style.maskImage = "none";
}

bootToggle.addEventListener("change", function () {
	localStorage.setItem("bootAnimation", bootToggle.checked ? "on" : "off");
});

// Startup sound settings

const soundToggle = document.getElementById("soundToggle");

const volumeSlider = document.getElementById("volumeSlider");

const volumeText = document.getElementById("volumeText");

const testSoundButton = document.getElementById("testSoundButton");

soundToggle.checked = localStorage.getItem("startupSound") !== "off";

volumeSlider.value = localStorage.getItem("volume") || 70;

volumeText.textContent = volumeSlider.value + "%";

soundToggle.addEventListener("change", function () {
	localStorage.setItem("startupSound", soundToggle.checked ? "on" : "off");
});

volumeSlider.addEventListener("input", function () {
	volumeText.textContent = volumeSlider.value + "%";

	startupSound.volume = volumeSlider.value / 100;

	localStorage.setItem("volume", volumeSlider.value);
});

testSoundButton.addEventListener("click", function () {
	startupSound.currentTime = 0;

	startupSound.play();
});

// Clock setting

const clockToggle = document.getElementById("clockToggle");

function updateClockVisibility() {
	let display = "none";

	if (clockToggle.checked) {
		display = "block";
	}

	document.getElementById("clock").style.display = display;

	document.getElementById("date").style.display = display;
}

clockToggle.checked = localStorage.getItem("showClock") === "on";

updateClockVisibility();

clockToggle.addEventListener("change", function () {
	localStorage.setItem("showClock", clockToggle.checked ? "on" : "off");

	updateClockVisibility();
});

// Start logo upload

const startLogoUpload = document.getElementById("startLogoUpload");

if (startLogoUpload) {
	startLogoUpload.addEventListener("change", function () {
		const file = startLogoUpload.files[0];

		if (!file) return;

		const reader = new FileReader();

		reader.onload = function () {
			try {
				localStorage.setItem("browos-start-logo", reader.result);
			} catch (e) {
				showAlert("This image is too big, try a smaller one.");

				return;
			}

			const startButtonImg = document.querySelector("#startButton img");

			if (startButtonImg) startButtonImg.src = reader.result;
		};

		reader.readAsDataURL(file);
	});
}

const savedStartLogo = localStorage.getItem("browos-start-logo");

if (savedStartLogo) {
	const startButtonImg = document.querySelector("#startButton img");

	if (startButtonImg) startButtonImg.src = savedStartLogo;
}

// Reset settings

const clearAllDataButton = document.getElementById("clearAllDataButton");

if (clearAllDataButton) {
	clearAllDataButton.addEventListener("click", async function () {
		if (!await showConfirm("Clear ALL BrowOS+ data? This cannot be undone.")) return;

		try {
			localStorage.clear();
		} catch (e) {}

		try {
			const dbs = await indexedDB.databases();
			for (const db of dbs) {
				if (db.name) indexedDB.deleteDatabase(db.name);
			}
		} catch (e) {}

		showAlert("All data cleared. Reloading.");
		location.reload();
	});
}

const resetSettingsButton = document.getElementById("resetSettingsButton");

resetSettingsButton.addEventListener("click", async function () {
	if (!await showConfirm("Reset all settings?")) {
		return;
	}

	localStorage.removeItem("wallpaper");
	localStorage.removeItem("customWallpaper");
	localStorage.removeItem("bootAnimation");
	localStorage.removeItem("startupSound");
	localStorage.removeItem("volume");
	localStorage.removeItem("showClock");
	localStorage.removeItem("browos-accent");
	localStorage.removeItem("browos-theme");
	localStorage.removeItem("browos-corners");
	localStorage.removeItem("browos-buttons");
	localStorage.removeItem("browos-transparency");
	localStorage.removeItem("browos-desktop-text-show");
	localStorage.removeItem("browos-desktop-text");
	localStorage.removeItem("browos-taskbar-auto");
	localStorage.removeItem("browos-taskbar-width");
	localStorage.removeItem("browos-cursor");
	localStorage.removeItem("browos-custom-cursor");
	localStorage.removeItem("browos-cursor-size");

	location.reload();
});

// About: the real version, so users can see if they're up to date

try {
	const userNameInput = document.getElementById("userNameInput");
if (userNameInput) {
	userNameInput.value = localStorage.getItem("browos-username") || "User";
	userNameInput.addEventListener("change", function () {
		localStorage.setItem("browos-username", userNameInput.value.trim() || "User");
	});
}

const widgetsEnabledToggle = document.getElementById("widgetsEnabledToggle");
const widgetClockColor = document.getElementById("widgetClockColor");
const widgetWeatherColor = document.getElementById("widgetWeatherColor");
const widgetTzColor = document.getElementById("widgetTzColor");
const resetWidgetsButton = document.getElementById("resetWidgetsButton");

if (widgetsEnabledToggle) {
	widgetsEnabledToggle.checked = localStorage.getItem("browos-widgets-enabled") !== "off";
	widgetsEnabledToggle.addEventListener("change", function () {
		localStorage.setItem("browos-widgets-enabled", widgetsEnabledToggle.checked ? "on" : "off");
		if (typeof applyWidgetsVisibility === "function") applyWidgetsVisibility();
	});
}

function widgetToggle(id, key, el, selector) {
	if (!el) return;
	el.checked = localStorage.getItem(key) !== "off";
	el.addEventListener("change", function () {
		localStorage.setItem(key, el.checked ? "on" : "off");
		const w = document.querySelector(selector);
		if (w) w.style.display = el.checked ? "" : "none";
		if (typeof applyWidgetsVisibility === "function") applyWidgetsVisibility();
	});
}
widgetToggle("clock", "browos-widget-clock-enabled", document.getElementById("widgetClockToggle"), ".clock-widget");
widgetToggle("weather", "browos-widget-weather-enabled", document.getElementById("widgetWeatherToggle"), ".weather-widget");
widgetToggle("tz", "browos-widget-tz-enabled", document.getElementById("widgetTzToggle"), ".tz-widget");
widgetToggle("clock", "browos-widget-clock-enabled", document.getElementById("widgetClockToggle"));
widgetToggle("weather", "browos-widget-weather-enabled", document.getElementById("widgetWeatherToggle"));
widgetToggle("tz", "browos-widget-tz-enabled", document.getElementById("widgetTzToggle"));
if (widgetClockColor) {
	widgetClockColor.value = localStorage.getItem("browos-widget-clock-color") || "#ffffff";
	widgetClockColor.addEventListener("change", function () {
		localStorage.setItem("browos-widget-clock-color", widgetClockColor.value);
	});
}
if (widgetWeatherColor) {
	widgetWeatherColor.value = localStorage.getItem("browos-widget-weather-color") || "#ffffff";
	widgetWeatherColor.addEventListener("change", function () {
		localStorage.setItem("browos-widget-weather-color", widgetWeatherColor.value);
	});
}
if (widgetTzColor) {
	widgetTzColor.value = localStorage.getItem("browos-widget-tz-color") || "#ffffff";
	widgetTzColor.addEventListener("change", function () {
		localStorage.setItem("browos-widget-tz-color", widgetTzColor.value);
	});
}
if (resetWidgetsButton) {
	resetWidgetsButton.addEventListener("click", function () {
		localStorage.removeItem("browos-widget-clock-color");
		localStorage.removeItem("browos-widget-weather-color");
		localStorage.removeItem("browos-widget-tz-color");
		if (widgetClockColor) widgetClockColor.value = "#ffffff";
		if (widgetWeatherColor) widgetWeatherColor.value = "#ffffff";
		if (widgetTzColor) widgetTzColor.value = "#ffffff";
	});
}

try {
	document.getElementById("aboutVersion").textContent = "Version " + (chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "1.0.2");
} catch (error) {
	document.getElementById("aboutVersion").textContent = "Version 1.0.2";
}
} catch (error) {
	document.getElementById("aboutVersion").textContent = "Version 1.0.2";
}
