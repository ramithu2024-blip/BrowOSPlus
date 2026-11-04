// Start

renderAppsPanel();

renderDesktop();

renderPins();

// Optional PWA service worker

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js").catch(function () {});
}

document.addEventListener("keydown", function (event) {
	if (event.ctrlKey && event.code === "Space") {
		event.preventDefault();
		const sm = document.getElementById("startMenu");
		if (sm) sm.classList.toggle("show");
	}
});
