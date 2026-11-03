// Start

renderAppsPanel();

renderDesktop();

renderPins();

// Optional PWA service worker

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js").catch(function () {});
}
