// Window manager

let highestWindowZ = 100;

function bringToFront(windowElement) {
	highestWindowZ++;

	windowElement.style.zIndex = highestWindowZ;

	if (typeof window.setActiveTaskbarApp === "function" && windowElement && windowElement.dataset && windowElement.dataset.appId) {
		window.setActiveTaskbarApp(windowElement.dataset.appId);
	}
}

function setupWindow(appWindow) {
	const header = appWindow.querySelector(".window-header");

	const closeButton = appWindow.querySelector(".window-close");

	const minimizeButton = appWindow.querySelector(".window-minimize");

	let dragging = false;

	let offsetX = 0;

	let offsetY = 0;

	appWindow.addEventListener("pointerdown", function () {
		bringToFront(appWindow);
	});

	closeButton.addEventListener("click", function () {
		closeApp(appWindow);
	});

	minimizeButton.addEventListener("click", function () {
		minimizeApp(appWindow);
	});

	header.addEventListener("pointerdown", function (event) {
		if (event.target.closest(".window-controls, .window-tools")) {
			return;
		}

		dragging = true;

		bringToFront(appWindow);

		const rect = appWindow.getBoundingClientRect();

		offsetX = event.clientX - rect.left;

		offsetY = event.clientY - rect.top;

		appWindow.style.transform = "none";

		appWindow.style.left = rect.left + "px";

		appWindow.style.top = rect.top + "px";

		header.setPointerCapture(event.pointerId);
	});

	header.addEventListener("pointermove", function (event) {
		if (!dragging) {
			return;
		}

		appWindow.style.left = event.clientX - offsetX + "px";

		appWindow.style.top = Math.max(0, event.clientY - offsetY) + "px";
	});

	header.addEventListener("pointerup", function (event) {
		dragging = false;

		header.releasePointerCapture(event.pointerId);
	});
}

document.querySelectorAll(".app-window").forEach(setupWindow);

// Resizable windows

function makeResizable(windowElement) {
	const directions = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

	directions.forEach(function (direction) {
		const handle = document.createElement("div");

		handle.className = "resize-handle " + direction;

		windowElement.appendChild(handle);

		handle.addEventListener("pointerdown", function (event) {
			event.preventDefault();
			event.stopPropagation();

			const rect = windowElement.getBoundingClientRect();

			// Remove initial centering transform

			windowElement.style.transform = "none";

			windowElement.style.left = rect.left + "px";

			windowElement.style.top = rect.top + "px";

			const startX = event.clientX;

			const startY = event.clientY;

			const startWidth = rect.width;

			const startHeight = rect.height;

			const startLeft = rect.left;

			const startTop = rect.top;

			const minWidth = 360;

			const minHeight = 240;

			handle.setPointerCapture(event.pointerId);

			function resize(event) {
				const deltaX = event.clientX - startX;

				const deltaY = event.clientY - startY;

				let newWidth = startWidth;

				let newHeight = startHeight;

				let newLeft = startLeft;

				let newTop = startTop;

				// Right

				if (direction.includes("e")) {
					newWidth = Math.max(minWidth, startWidth + deltaX);
				}

				// Left

				if (direction.includes("w")) {
					newWidth = Math.max(minWidth, startWidth - deltaX);

					newLeft = startLeft + (startWidth - newWidth);
				}

				// Bottom

				if (direction.includes("s")) {
					newHeight = Math.max(minHeight, startHeight + deltaY);
				}

				// Top

				if (direction.includes("n")) {
					newHeight = Math.max(minHeight, startHeight - deltaY);

					newTop = startTop + (startHeight - newHeight);
				}

				windowElement.style.width = newWidth + "px";

				windowElement.style.height = newHeight + "px";

				windowElement.style.left = newLeft + "px";

				windowElement.style.top = newTop + "px";
			}

			function stopResize() {
				handle.removeEventListener("pointermove", resize);

				handle.removeEventListener("pointerup", stopResize);
			}

			handle.addEventListener("pointermove", resize);

			handle.addEventListener("pointerup", stopResize);
		});
	});
}

document.querySelectorAll(".app-window, .explorer-window").forEach(function (windowElement) {
	makeResizable(windowElement);
});
