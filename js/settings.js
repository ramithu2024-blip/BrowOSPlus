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
			alert("This image is too big, try a smaller one.");

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

// Reset settings

const resetSettingsButton = document.getElementById("resetSettingsButton");

resetSettingsButton.addEventListener("click", function () {
	if (!confirm("Reset all settings?")) {
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
	document.getElementById("aboutVersion").textContent = "Version " + (chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "1.0.2");
} catch (error) {
	document.getElementById("aboutVersion").textContent = "Version 1.0.2";
}
