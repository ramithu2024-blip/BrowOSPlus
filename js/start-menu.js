const startButton = document.getElementById("startButton");

const startMenu = document.getElementById("startMenu");

const powerButton = document.getElementById("powerButton");

startButton.addEventListener("click", function () {
	startMenu.classList.toggle("show");

	const taskbar = document.querySelector(".taskbar");

	if (taskbar && startMenu.classList.contains("show")) {
		taskbar.classList.remove("hidden");
	}
});

powerButton.addEventListener("click", async function () {
	if (!await showConfirm("Close this window and all its tabs?")) {
		return;
	}

	if (typeof chrome === "undefined" || !chrome.windows) {
		showAlert("Close the browser tab manually to exit BrowOS+.");
		return;
	}

	const currentWindow = await chrome.windows.getCurrent();

	await chrome.windows.remove(currentWindow.id);
});
