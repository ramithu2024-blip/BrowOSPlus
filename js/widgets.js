// Desktop widgets (basic)
console.log("widgets.js loaded");

const widgetContainer = document.createElement("div");
widgetContainer.className = "desktop-widgets";
const desktopAreaEl = (typeof desktopArea !== "undefined" ? desktopArea : document.querySelector(".desktop-area"));
if (desktopAreaEl) desktopAreaEl.appendChild(widgetContainer);

function applyWidgetVisibilityState() {
	const enabled = localStorage.getItem("browos-widgets-enabled") !== "off";
	widgetContainer.style.display = enabled ? "flex" : "none";
	clockWidget.style.display = (localStorage.getItem("browos-widget-clock-enabled") !== "off") ? "" : "none";
	weatherWidget.style.display = (localStorage.getItem("browos-widget-weather-enabled") !== "off") ? "" : "none";
	tzWidget.style.display = (localStorage.getItem("browos-widget-tz-enabled") !== "off") ? "" : "none";
}

window.applyWidgetsVisibility = applyWidgetVisibilityState;

// Wire settings toggles (settings.js may have already run)
function wireWidgetToggles() {
	const pairs = [
		["widgetsEnabledToggle", "browos-widgets-enabled", null],
		["widgetClockToggle", "browos-widget-clock-enabled", clockWidget],
		["widgetWeatherToggle", "browos-widget-weather-enabled", weatherWidget],
		["widgetTzToggle", "browos-widget-tz-enabled", tzWidget],
	];
	pairs.forEach(([id, key, widget]) => {
		const el = document.getElementById(id);
		if (!el) { console.log("widget toggle not found:", id); return; }
		el.checked = localStorage.getItem(key) !== "off";
		console.log("wired toggle", id, el.checked);
		el.addEventListener("change", () => {
			console.log("toggle changed", id, el.checked);
			localStorage.setItem(key, el.checked ? "on" : "off");
			if (widget) widget.style.display = el.checked ? "" : "none";
			applyWidgetVisibilityState();
		});
	});
}

// Defer wiring until settings page exists
setTimeout(wireWidgetToggles, 0);

widgetContainer.style.position = "absolute";
widgetContainer.style.top = "20px";
widgetContainer.style.right = "20px";
widgetContainer.style.display = "flex";
widgetContainer.style.flexDirection = "column";
widgetContainer.style.gap = "10px";
widgetContainer.style.zIndex = "5";

function makeWidget(title) {
	const w = document.createElement("div");
	w.className = "desktop-widget";
	w.style.position = "relative";

	// no close button; removal via settings only

	// drag support
	let dragging = false, offX = 0, offY = 0;
	w.addEventListener("mousedown", (e) => {
		if (e.target === remove) return;
		dragging = true;
		const rect = w.getBoundingClientRect();
		const parent = widgetContainer.getBoundingClientRect();
		offX = e.clientX - rect.left;
		offY = e.clientY - rect.top;
		w.style.cursor = "grabbing";
	});
	document.addEventListener("mousemove", (e) => {
		if (!dragging) return;
		const parent = widgetContainer.getBoundingClientRect();
		let x = e.clientX - parent.left - offX;
		let y = e.clientY - parent.top - offY;
		w.style.left = x + "px";
		w.style.top = y + "px";
		w.style.right = "auto";
	});
	document.addEventListener("mouseup", () => {
		if (dragging) {
			dragging = false;
			w.style.cursor = "grab";
			saveWidgetState();
		}
	});

	// context menu
	w.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		showWidgetMenu(w, e.clientX, e.clientY);
	});

	return w;
}

function showWidgetMenu(w, x, y) {
	const existing = document.querySelector(".widget-context-menu");
	if (existing) existing.remove();
	const menu = document.createElement("div");
	menu.className = "widget-context-menu";
	menu.style.left = x + "px";
	menu.style.top = y + "px";
	menu.innerHTML = `
		<div class="wcm-item" data-action="move">Move</div>
		<div class="wcm-item" data-action="remove">Remove</div>
		<div class="wcm-item" data-action="customize">Customize</div>
	`;
	document.body.appendChild(menu);
	menu.querySelectorAll(".wcm-item").forEach(item => {
		item.addEventListener("click", () => {
			const action = item.dataset.action;
			menu.remove();
			if (action === "remove") w.remove();
			if (action === "customize") {
				const sw = document.getElementById("settingsWindow");
				if (sw) {
					sw.classList.add("show");
					if (typeof bringToFront === "function") bringToFront(sw);
				}
			}
		});
	});
	setTimeout(() => {
		const close = (e) => {
			if (!menu.contains(e.target)) {
				menu.remove();
				document.removeEventListener("click", close);
			}
		};
		document.addEventListener("click", close);
	}, 0);
}

function saveWidgetState() {
	// minimal: store positions not implemented
}

// Digital clock widget
const clockWidget = makeWidget("clock");
clockWidget.classList.add("clock-widget");
clockWidget.innerHTML += '<div class="widget-time"></div><div class="widget-date"></div>';
widgetContainer.appendChild(clockWidget);

let clockColor = localStorage.getItem("browos-widget-clock-color") || "#ffffff";
clockWidget.style.color = clockColor;

clockWidget.addEventListener("dblclick", async () => {
	const c = await showPrompt("Clock color (hex):", clockColor);
	if (c) {
		clockColor = c;
		localStorage.setItem("browos-widget-clock-color", c);
		clockWidget.style.color = c;
	}
});

function updateClockWidget() {
	const now = new Date();
	clockWidget.querySelector(".widget-time").textContent = now.toLocaleTimeString();
	clockWidget.querySelector(".widget-date").textContent = now.toLocaleDateString();
}
setInterval(updateClockWidget, 1000);
updateClockWidget();

// Weather widget
const weatherWidget = makeWidget("weather");
weatherWidget.classList.add("weather-widget");
weatherWidget.innerHTML += '<div class="widget-weather">Loading weather…</div>';
widgetContainer.appendChild(weatherWidget);

let weatherCity = localStorage.getItem("browos-weather-city") || "";
let weatherColor = localStorage.getItem("browos-widget-weather-color") || "#ffffff";
weatherWidget.style.color = weatherColor;

weatherWidget.addEventListener("dblclick", async () => {
	const c = await showPrompt("Weather city (leave empty for auto):", weatherCity);
	weatherCity = c || "";
	localStorage.setItem("browos-weather-city", weatherCity);
	const col = await showPrompt("Weather color (hex):", weatherColor);
	if (col) {
		weatherColor = col;
		localStorage.setItem("browos-widget-weather-color", col);
		weatherWidget.style.color = col;
	}
	loadWeather();
});

async function loadWeather() {
	try {
		let lat, lon, city;
		if (weatherCity) {
			const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherCity)}&count=1`);
			const gj = await g.json();
			if (gj.results && gj.results[0]) {
				lat = gj.results[0].latitude;
				lon = gj.results[0].longitude;
				city = gj.results[0].name;
			}
		}
		if (!lat) {
			const locRes = await fetch("https://ipapi.co/json/");
			const loc = await locRes.json();
			lat = loc.latitude;
			lon = loc.longitude;
			city = loc.city;
		}
		if (!lat || !lon) throw new Error("no location");
		const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
		const w = await wRes.json();
		const temp = w.current_weather?.temperature;
		weatherWidget.querySelector(".widget-weather").textContent = `${city || "Weather"}: ${temp}°C`;
	} catch (e) {
		weatherWidget.querySelector(".widget-weather").textContent = "Weather unavailable";
	}
}
loadWeather();

// Two-timezone clock widget
const tzWidget = makeWidget("tz");
tzWidget.classList.add("tz-widget");
tzWidget.innerHTML += '<div class="widget-tz1"></div><div class="widget-tz2"></div>';
widgetContainer.appendChild(tzWidget);

let tzColor = localStorage.getItem("browos-widget-tz-color") || "#ffffff";
tzWidget.style.color = tzColor;

tzWidget.addEventListener("dblclick", async () => {
	const c = await showPrompt("Timezone clock color (hex):", tzColor);
	if (c) {
		tzColor = c;
		localStorage.setItem("browos-widget-tz-color", c);
		tzWidget.style.color = c;
	}
});

function updateTzWidget() {
	const now = new Date();
	tzWidget.querySelector(".widget-tz1").textContent = "Local: " + now.toLocaleTimeString();
	const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
	tzWidget.querySelector(".widget-tz2").textContent = "UTC: " + utc.toLocaleTimeString();
}
setInterval(updateTzWidget, 1000);
updateTzWidget();

applyWidgetVisibilityState();