// Updates

// BrowOS installed by hand (from the zip) can't update itself, so once a day it reads
// a small file on the BrowOS website. When a newer version exists, an Update button
// stays in the taskbar and a popup keeps coming back until BrowOS is updated.
// Store installs update automatically and never run this.

const updateFileUrl = "https://browos.pages.dev/version.json";

const oneHour = 60 * 60 * 1000;

const oneDay = 24 * oneHour;

// after "Later" or "Download", the popup comes back after this long

const remindEvery = 6 * oneHour;

const updatePopup = document.getElementById("updatePopup");

const taskbarUpdate = document.getElementById("taskbarUpdate");

// "1.10.0" is newer than "1.9.2"

function isNewerVersion(latest, current) {
	const a = String(latest).split(".").map(Number);
	const b = String(current).split(".").map(Number);

	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const x = a[i] || 0;
		const y = b[i] || 0;

		if (x !== y) {
			return x > y;
		}
	}

	return false;
}

function currentVersion() {
	try {
		return chrome.runtime.getManifest().version;
	} catch (error) {
		return "1.0.2";
	}
}

// the update BrowOS knows about, if it's still newer than this BrowOS

function waitingUpdate() {
	let info = null;

	try {
		info = JSON.parse(localStorage.getItem("browos-update-info"));
	} catch (error) {
		info = null;
	}

	if (info && isNewerVersion(info.version, currentVersion())) {
		return info;
	}

	// updated (or nothing known): stop reminding

	localStorage.removeItem("browos-update-info");
	localStorage.removeItem("browos-update-later");

	return null;
}

function showUpdatePopup(info) {
	document.getElementById("updateTitle").textContent = "BrowOS " + info.version + " is available";

	document.getElementById("updateNotes").textContent = info.notes || "";

	updatePopup.hidden = false;
}

function remindLater() {
	localStorage.setItem("browos-update-later", Date.now() + remindEvery);

	updatePopup.hidden = true;
}

// shows the taskbar button, and the popup unless it was put off recently

function remindAboutUpdate() {
	const info = waitingUpdate();

	taskbarUpdate.hidden = !info;

	if (!info) {
		updatePopup.hidden = true;

		return;
	}

	const later = Number(localStorage.getItem("browos-update-later")) || 0;

	if (Date.now() >= later) {
		showUpdatePopup(info);
	}
}

document.getElementById("updateDownload").addEventListener("click", function () {
	const info = waitingUpdate();

	if (info) {
		window.open(info.download, "_blank", "noopener");
	}

	// the button stays until BrowOS is really updated

	remindLater();
});

document.getElementById("updateLater").addEventListener("click", remindLater);

taskbarUpdate.addEventListener("click", function () {
	const info = waitingUpdate();

	if (info) {
		showUpdatePopup(info);
	}
});

// asks the website once a day

async function checkForUpdate() {
	const lastCheck = Number(localStorage.getItem("browos-update-checked")) || 0;

	if (Date.now() - lastCheck < oneDay) {
		return;
	}

	// if the website can't be reached, try again in an hour (not on every new tab)

	localStorage.setItem("browos-update-checked", Date.now() - oneDay + oneHour);

	try {
		const response = await fetch(updateFileUrl, { cache: "no-store", credentials: "omit" });

		if (!response.ok) {
			return;
		}

		const info = await response.json();

		localStorage.setItem("browos-update-checked", Date.now());

		// only real versions and safe links

		if (
			typeof info.version !== "string" ||
			!/^\d+(\.\d+)*$/.test(info.version) ||
			!/^https:\/\//i.test(info.download || "")
		) {
			return;
		}

		if (isNewerVersion(info.version, currentVersion())) {
			localStorage.setItem(
				"browos-update-info",
				JSON.stringify({
					version: info.version,
					notes: typeof info.notes === "string" ? info.notes : "",
					download: info.download,
				})
			);
		} else {
			// the website doesn't offer a newer version anymore (or it was taken back)
			localStorage.removeItem("browos-update-info");
			localStorage.removeItem("browos-update-later");
		}
	} catch (error) {
		// offline or the website can't be reached: try again later
	}
}

async function startUpdateReminders() {
	// store installs update by themselves

	try {
		const self = await chrome.management.getSelf();

		if (self.installType === "normal") {
			return;
		}
	} catch (error) {
		// can't tell: carry on
	}

	// an update already known keeps reminding, even offline

	remindAboutUpdate();

	await checkForUpdate();

	remindAboutUpdate();
}

// the old "skip this version" choice no longer exists

localStorage.removeItem("browos-update-skip");

// a few seconds after BrowOS starts, so it never slows down opening a tab

setTimeout(startUpdateReminders, 4000);
