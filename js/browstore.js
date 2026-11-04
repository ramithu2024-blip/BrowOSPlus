// BrowStore

const store = document.getElementById("store");

const storeSearch = document.getElementById("storeSearch");

const storePage = document.getElementById("storePage");

const storeHeading = document.getElementById("storeHeading");

const storeGrid = document.getElementById("storeGrid");

const storeMessage = document.getElementById("storeMessage");

const storeDetails = document.getElementById("storeDetails");

const storeNavButtons = document.querySelectorAll(".store-nav");

const storeToast = document.getElementById("storeToast");

let storeTab = "discover";
let detailsAppId = null;

const tabTitles = {
	discover: "Discover",
	browos: "BrowOS Apps",
	library: "Library",
};

// Discover

// Curated websites, empty for now. Add one per line, for example:
// { url: "https://example.com" },
// { url: "https://example.com", sponsored: true },
// Names and icons come from the website itself.
// Any paid placement must have sponsored: true, it shows a "Sponsored" label.

const discoverList = [];

function discoverApps() {
	return discoverList
		.map(function (entry, index) {
			const url = normalizeUrl(entry.url || "");

			if (!url) {
				return null;
			}

			const host = new URL(url).hostname.replace(/^www\./, "");

			return {
				id: "discover-" + index,
				name: host,
				icon: siteIcon(host),
				url: url,
				website: url,
				sponsored: Boolean(entry.sponsored),
				discover: true,
			};
		})
		.filter(Boolean);
}

// the library id of an app: Discover websites live in the library as normal websites

function libraryId(app) {
	if (app.discover) {
		const site = customSites.find(function (item) {
			return item.url === app.url;
		});

		return site ? site.id : null;
	}

	return isInstalled(app.id) ? app.id : null;
}

function findStoreApp(id) {
	return (
		getApp(id) ||
		discoverApps().find(function (app) {
			return app.id === id;
		}) ||
		null
	);
}

// CARD COLORS: a dark shade of the icon's main color, dark purple when there is no icon

const fallbackCardColor = "#231a36";

let iconColors = {};

try {
	iconColors = JSON.parse(localStorage.getItem("browstore-icon-colors")) || {};
} catch (error) {
	iconColors = {};
}

function darkShade(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const light = (max + min) / 2;

	let hue = 0;
	let saturation = 0;

	if (max !== min) {
		const difference = max - min;

		saturation = light > 0.5 ? difference / (2 - max - min) : difference / (max + min);

		if (max === r) {
			hue = (g - b) / difference + (g < b ? 6 : 0);
		} else if (max === g) {
			hue = (b - r) / difference + 2;
		} else {
			hue = (r - g) / difference + 4;
		}

		hue *= 60;
	}

	return (
		"hsl(" + Math.round(hue) + ", " + Math.round(Math.min(saturation, 0.55) * 100) + "%, 16%)"
	);
}

function mainColor(image) {
	try {
		const canvas = document.createElement("canvas");

		canvas.width = 24;
		canvas.height = 24;

		const context = canvas.getContext("2d");

		context.drawImage(image, 0, 0, 24, 24);

		const pixels = context.getImageData(0, 0, 24, 24).data;

		let red = 0;
		let green = 0;
		let blue = 0;
		let total = 0;

		for (let i = 0; i < pixels.length; i += 4) {
			// skip see-through pixels

			if (pixels[i + 3] < 128) {
				continue;
			}

			// colorful pixels count more than gray ones

			const weight =
				Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
				Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) +
				10;

			red += pixels[i] * weight;
			green += pixels[i + 1] * weight;
			blue += pixels[i + 2] * weight;
			total += weight;
		}

		if (total === 0) {
			return null;
		}

		return darkShade(red / total, green / total, blue / total);
	} catch (error) {
		// the icon's website doesn't allow reading its colors

		return null;
	}
}

function paintCover(cover, app) {
	const icon = app.icon || "";

	// uploaded icons are long, keep their color under the app id instead

	const key = icon.length > 300 ? app.id + ":custom" : icon;

	cover.style.backgroundColor = iconColors[key] || fallbackCardColor;

	if (iconColors[key] || icon === "" || icon.startsWith("data:image/svg")) {
		return;
	}

	// icons from other websites (like Google's icon service) don't allow reading
	// their colors, and trying only fills the error list: keep dark purple

	if (/^https?:\/\//i.test(icon) && !icon.startsWith(location.origin)) {
		return;
	}

	const image = new Image();

	image.crossOrigin = "anonymous";

	image.addEventListener("load", function () {
		const color = mainColor(image);

		if (!color) {
			return;
		}

		iconColors[key] = color;

		cover.style.backgroundColor = color;

		try {
			localStorage.setItem("browstore-icon-colors", JSON.stringify(iconColors));
		} catch (error) {
			// storage full, the color is just not kept
		}
	});

	image.src = icon;
}

// small helpers to build the interface safely (text is never read as HTML)

function makeElement(tag, className, text) {
	const element = document.createElement(tag);

	if (className) {
		element.className = className;
	}

	if (text) {
		element.textContent = text;
	}

	return element;
}

function makeLink(url, text) {
	const link = makeElement("a", "", text);

	// only real web links

	if (/^https?:\/\//i.test(url)) {
		link.href = url;
		link.target = "_blank";
		link.rel = "noopener";
	}

	return link;
}

// a cover: the app icon on a soft blurred copy of itself

function makeCover(app, className) {
	const cover = makeElement("div", className);

	const blur = makeElement("img", "store-cover-blur");

	const icon = makeElement("img", "store-cover-icon");

	setIcon(blur, app);
	setIcon(icon, app);

	blur.alt = "";
	icon.alt = app.name;

	cover.append(blur, icon);

	paintCover(cover, app);

	return cover;
}

// The app grid

function appsForTab() {
	const text = storeSearch.value.toLowerCase().trim();

	// search looks through everything, so a removed app can always be found again

	if (text) {
		const everything = appCatalog.concat(
			discoverApps(),
			installedApps.map(getApp).filter(function (app) {
				return app && app.custom;
			})
		);

		return everything.filter(function (app) {
			return app.name.toLowerCase().includes(text);
		});
	}

	if (storeTab === "browos") {
		return appCatalog.filter(function (app) {
			return app.builtIn;
		});
	}

	if (storeTab === "library") {
		return installedApps
			.map(getApp)
			.filter(function (app) {
				return app && !app.builtIn;
			})
			.sort(function (a, b) {
				return a.name.localeCompare(b.name);
			});
	}

	return discoverApps();
}

function renderStore() {
	const text = storeSearch.value.toLowerCase().trim();

	const apps = appsForTab();

	storeHeading.textContent = text ? "Results" : tabTitles[storeTab];

	storeGrid.innerHTML = "";

	apps.forEach(function (app) {
		storeGrid.appendChild(makeStoreCard(app));
	});

	// Discover is empty for now: 4 "Coming soon" cards

	if (apps.length === 0 && storeTab === "discover" && text === "") {
		for (let i = 0; i < 4; i++) {
			storeGrid.appendChild(makeComingSoonCard());
		}

		storeMessage.hidden = true;

		return;
	}

	if (apps.length === 0) {
		if (text !== "") {
			storeMessage.textContent = "No results.";
		} else if (storeTab === "library") {
			storeMessage.textContent = "Your library is empty.";
		} else if (storeTab === "discover") {
			storeMessage.textContent = "New discoveries coming soon.";
		} else {
			storeMessage.textContent = "Nothing here yet.";
		}

		storeMessage.hidden = false;
	} else {
		storeMessage.hidden = true;
	}
}

function makeStoreCard(app) {
	const card = makeElement("div", "store-card");

	const name = makeElement("div", "store-card-name", app.name);

	const bottom = makeElement("div", "store-card-bottom");

	const price = makeElement("span", "store-price", libraryId(app) ? "In library" : "Free");

	bottom.append(price, makeActionButton(app, false));

	card.appendChild(makeCover(app, "store-cover"));

	// paid placements are always labeled

	if (app.sponsored) {
		card.appendChild(makeElement("div", "store-sponsored", "Sponsored"));
	}

	card.append(name, bottom);

	card.addEventListener("click", function () {
		showDetails(libraryId(app) || app.id);
	});

	return card;
}

function makeComingSoonCard() {
	const card = makeElement("div", "store-card coming-soon");

	const cover = makeElement("div", "store-cover");

	cover.style.backgroundColor = fallbackCardColor;

	cover.appendChild(makeElement("span", "coming-soon-text", "Coming soon"));

	card.appendChild(cover);

	return card;
}

// "Get" for new apps, "Open" for apps in the library

function makeActionButton(app, big) {
	const installed = libraryId(app) !== null;

	let className = big ? "store-big-button" : "store-button";

	if (!installed) {
		className += " primary";
	}

	const button = makeElement("button", className, installed ? "Open" : "Get");

	button.addEventListener("click", function (event) {
		event.stopPropagation();

		if (libraryId(app)) {
			launchApp(libraryId(app));
		} else if (app.discover) {
			addDiscoverSite(app);
		} else {
			addFromStore(app.id);
		}
	});

	return button;
}

function addFromStore(id) {
	installApp(id);

	showAddedToast(id);
}

function showAddedToast(id) {
	const app = getApp(id);

	showToast(app.name + " added to Start", [
		[
			"Add to desktop",
			function () {
				addShortcut(id);
			},
		],

		[
			"Pin to taskbar",
			function () {
				pinApp(id);
			},
		],
	]);
}

async function addDiscoverSite(app) {
	const id = await createWebsite(app.url, null, null);

	if (id) {
		showAddedToast(id);
	}
}

// Search and navigation

storeSearch.addEventListener("input", function () {
	closeDetails();

	renderStore();
});

storeNavButtons.forEach(function (button) {
	button.addEventListener("click", function () {
		storeNavButtons.forEach(function (item) {
			item.classList.remove("active");
		});

		button.classList.add("active");

		storeTab = button.dataset.tab;

		closeDetails();

		renderStore();
	});
});

// Small message at the bottom

let toastTimer = null;

function showToast(text, actions) {
	storeToast.innerHTML = "";

	storeToast.appendChild(makeElement("span", "", text));

	(actions || []).forEach(function (action) {
		const button = makeElement("button", "store-toast-button", action[0]);

		button.addEventListener("click", function () {
			action[1]();

			storeToast.hidden = true;
		});

		storeToast.appendChild(button);
	});

	storeToast.hidden = false;

	clearTimeout(toastTimer);

	toastTimer = setTimeout(function () {
		storeToast.hidden = true;
	}, 6000);
}

// Official app info

// Info only comes from the app's official page or its official GitHub repository.
// Nothing is written by BrowOS. Results are kept so details open fast.

function metadataKey(id) {
	return "browstore-meta-" + id;
}

function cachedMetadata(id) {
	try {
		return JSON.parse(localStorage.getItem(metadataKey(id)));
	} catch (error) {
		return null;
	}
}

async function fetchWithTimeout(url, options) {
	const controller = new AbortController();

	const timer = setTimeout(function () {
		controller.abort();
	}, 8000);

	try {
		return await fetch(
			url,
			Object.assign({ signal: controller.signal, credentials: "omit" }, options)
		);
	} finally {
		clearTimeout(timer);
	}
}

// reads the official page without running any of its scripts

async function readOfficialPage(url) {
	const response = await fetchWithTimeout(url);

	if (!response.ok) {
		throw new Error("page");
	}

	const page = new DOMParser().parseFromString(await response.text(), "text/html");

	function meta(name) {
		const tag = page.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');

		return tag ? (tag.getAttribute("content") || "").trim() : "";
	}

	function link(rel) {
		const tag = page.querySelector('link[rel~="' + rel + '"]');

		if (!tag || !tag.getAttribute("href")) {
			return "";
		}

		return new URL(tag.getAttribute("href"), response.url).href;
	}

	const info = {
		description: meta("description") || meta("og:description"),
		name: meta("og:site_name") || meta("application-name") || (page.title || "").trim(),
		icon: link("icon"),
		screenshots: [],
	};

	// screenshots only if the site lists them in its own web app manifest

	const manifestUrl = link("manifest");

	if (manifestUrl) {
		try {
			const manifestResponse = await fetchWithTimeout(manifestUrl);

			const manifest = await manifestResponse.json();

			(manifest.screenshots || []).slice(0, 4).forEach(function (shot) {
				if (shot.src) {
					info.screenshots.push(new URL(shot.src, manifestUrl).href);
				}
			});
		} catch (error) {
			// no screenshots
		}
	}

	return info;
}

async function readGitHub(repo) {
	const response = await fetchWithTimeout("https://api.github.com/repos/" + repo, {
		headers: { Accept: "application/vnd.github+json" },
	});

	if (!response.ok) {
		throw new Error("github");
	}

	const data = await response.json();

	return {
		description: data.description || "",
		developer: data.owner ? data.owner.login : "",
		developerUrl: data.owner ? data.owner.html_url : "",
		license: data.license && data.license.spdx_id !== "NOASSERTION" ? data.license.name : "",
		sourceUrl: data.html_url || "",
	};
}

async function loadMetadata(app, refresh) {
	const cached = cachedMetadata(app.id);

	if (cached && !refresh) {
		return cached;
	}

	if (!navigator.onLine) {
		return cached || { offline: true };
	}

	const info = {
		description: "",
		descriptionSource: "",
		screenshots: [],
	};

	// the app's own page first: its own words

	const pageUrl = app.officialPage || (app.github ? "" : app.url);

	if (pageUrl) {
		try {
			const page = await readOfficialPage(pageUrl);

			if (page.description) {
				info.description = page.description;
				info.descriptionSource = app.website || pageUrl;
			}

			info.screenshots = page.screenshots;
		} catch (error) {
			// many sites don't allow other pages to read them, that's fine
		}
	}

	if (app.github) {
		try {
			const github = await readGitHub(app.github);

			if (!info.description && github.description) {
				info.description = github.description;
				info.descriptionSource = github.sourceUrl;
			}

			info.developer = github.developer;
			info.developerUrl = github.developerUrl;
			info.license = github.license;
			info.sourceUrl = github.sourceUrl;
		} catch (error) {
			// GitHub limits how often it can be asked, the cached info stays
		}
	}

	info.fetchedAt = Date.now();

	try {
		localStorage.setItem(metadataKey(app.id), JSON.stringify(info));
	} catch (error) {
		// storage full, just don't keep it
	}

	return info;
}

// APP DETAILS (big title, info on the left, a panel on the right)

function closeDetails() {
	detailsAppId = null;

	storeDetails.hidden = true;

	storePage.hidden = false;
}

function showDetails(id, refresh) {
	const app = findStoreApp(id);

	if (!app) {
		closeDetails();

		return;
	}

	const sameApp = detailsAppId === id;

	detailsAppId = id;

	storePage.hidden = true;

	storeDetails.hidden = false;

	// a new app starts at the top

	if (!sameApp) {
		store.scrollTop = 0;

		storeDetails.scrollTop = 0;
	}

	storeDetails.innerHTML = "";

	const back = makeElement("button", "store-back", "← Back");

	back.addEventListener("click", closeDetails);

	const title = makeElement("h1", "store-title", app.name);

	const developer = makeElement("div", "store-developer");

	const layout = makeElement("div", "store-detail-layout");

	const main = makeElement("div", "store-detail-main");

	const side = makeElement("aside", "store-detail-side");

	layout.append(main, side);

	storeDetails.append(back, title, developer, layout);

	// right panel: cover, price, buttons, facts

	side.appendChild(makeCover(app, "store-side-cover"));

	const badges = makeElement("div", "store-badges");

	if (app.sponsored) {
		badges.appendChild(makeElement("span", "store-sponsored", "Sponsored"));
	}

	badges.appendChild(
		makeElement("span", "store-side-price", libraryId(app) ? "In library" : "Free")
	);

	side.appendChild(badges);

	// a third-party account needed before adding

	if (app.requires) {
		side.appendChild(makeElement("div", "store-note", app.requires));
	}

	side.appendChild(makeActionButton(app, true));

	if (!app.discover && isInstalled(id) && id !== "browstore") {
		const desktopButton = makeElement(
			"button",
			"store-big-button",
			hasShortcut(id) ? "Remove from desktop" : "Add to desktop"
		);

		desktopButton.addEventListener("click", function () {
			if (hasShortcut(id)) {
				removeShortcut(id);
			} else {
				addShortcut(id);
			}
		});

		side.appendChild(desktopButton);
	}

	if (!app.discover && isInstalled(id)) {
		const pinButton = makeElement(
			"button",
			"store-big-button",
			isPinned(id) ? "Unpin from taskbar" : "Pin to taskbar"
		);

		pinButton.addEventListener("click", function () {
			if (isPinned(id)) {
				unpinApp(id);
			} else {
				pinApp(id);
			}
		});

		side.appendChild(pinButton);
	}

	// remove from BrowOS: right under the other buttons

	if (!app.discover && isInstalled(id) && id !== "browstore") {
		const removeButton = makeElement("button", "store-big-button danger", "Remove from BrowOS");

		removeButton.addEventListener("click", function () {
			removeApp(id);

			showToast(app.name + " removed. Your data is kept.");

			if (app.custom) {
				closeDetails();
			}
		});

		side.appendChild(removeButton);
	}

	const facts = makeElement("div", "store-facts");

	side.appendChild(facts);

	side.appendChild(makeDetailsMenu(app));

	if (app.id === "browstore") {
		fillFacts(app, {}, facts);

		return;
	}

	// official info, loaded from the web

	main.appendChild(makeElement("div", "store-loading", "Loading info…"));

	loadMetadata(app, refresh).then(function (metadata) {
		// the user may have opened another app meanwhile

		if (detailsAppId !== id) {
			return;
		}

		if (metadata.developer) {
			developer.textContent = metadata.developer;
		}

		fillMain(app, metadata, main);

		fillFacts(app, metadata, facts);
	});
}

function fillMain(app, metadata, main) {
	main.innerHTML = "";

	if (metadata.offline) {
		main.appendChild(makeElement("div", "store-loading", "You're offline."));
	}

	// official screenshots only

	if (metadata.screenshots && metadata.screenshots.length > 0) {
		const shots = makeElement("div", "store-shots");

		metadata.screenshots.forEach(function (url) {
			if (/^https?:\/\//i.test(url)) {
				const shot = makeElement("img");

				shot.src = url;
				shot.loading = "lazy";

				shot.addEventListener("error", function () {
					shot.remove();
				});

				shots.appendChild(shot);
			}
		});

		main.appendChild(shots);
	}

	// official description, word for word

	if (metadata.description) {
		const description = makeElement("p", "store-description", metadata.description);

		const more = makeElement("button", "store-more", "Read more");

		more.addEventListener("click", function () {
			description.classList.toggle("expanded");

			more.textContent = description.classList.contains("expanded")
				? "Show less"
				: "Read more";
		});

		main.append(description, more);

		// only show "Read more" when the text is actually cut

		requestAnimationFrame(function () {
			more.hidden = description.scrollHeight <= description.clientHeight + 2;
		});
	}

	if (metadata.descriptionSource) {
		const source = makeElement("div", "store-source", "Description from ");

		source.appendChild(
			makeLink(
				metadata.descriptionSource,
				metadata.descriptionSource.replace(/^https?:\/\//, "").split("/")[0] || "the app"
			)
		);

		main.appendChild(source);
	}
}

// facts: only the ones that exist

function fillFacts(app, metadata, facts) {
	facts.innerHTML = "";

	function addFact(label, value, url) {
		if (!value) {
			return;
		}

		const row = makeElement("div", "store-fact");

		row.appendChild(makeElement("span", "store-fact-label", label));

		row.appendChild(url ? makeLink(url, value) : makeElement("span", "", value));

		facts.appendChild(row);
	}

	addFact("Developer", metadata.developer, metadata.developerUrl);

	addFact("Credits", app.credit);

	addFact("License", metadata.license || app.license);

	addFact(
		"Website",
		app.website ? app.website.replace(/^https?:\/\//, "").replace(/\/$/, "") : "",
		app.website
	);

	addFact(
		"Source code",
		metadata.sourceUrl ? metadata.sourceUrl.replace(/^https:\/\//, "") : "",
		metadata.sourceUrl
	);

	if (app.custom && app.officialName && app.officialName !== app.name) {
		addFact("Website name", app.officialName);
	}
}

// the "More" menu in the details

function makeDetailsMenu(app) {
	const wrapper = makeElement("div", "store-details-more");

	const button = makeElement("button", "store-more-button", "More");

	const menu = makeElement("div", "store-menu");

	function addItem(text, action, danger) {
		const item = makeElement(
			"div",
			danger ? "store-menu-item danger" : "store-menu-item",
			text
		);

		item.addEventListener("click", function () {
			menu.classList.remove("show");

			action();
		});

		menu.appendChild(item);
	}

	// how a web app opens

	if (app.url && !app.discover && app.id !== "browstore") {
		const mode = getOpenMode(app.id);

		[
			["inside", "Open inside BrowOS"],
			["window", "Open in a window"],
			["tab", "Open in browser tab"],
		].forEach(function (option) {
			addItem((mode === option[0] ? "✓ " : "") + option[1], function () {
				setOpenMode(app.id, option[0]);
			});
		});

		menu.appendChild(makeElement("div", "store-menu-line"));
	}

	if (app.id !== "browstore") {
		addItem("Refresh info", function () {
			showDetails(app.id, true);
		});
	}

	if (!app.discover && isInstalled(app.id) && hasAppData(app.id)) {
		addItem(
			"Delete app data",
			async function () {
				if (await deleteAppData(app.id)) {
					showToast(app.name + " data deleted");
				}
			},
			true
		);
	}

	if (menu.children.length === 0) {
		return wrapper;
	}

	button.addEventListener("click", function (event) {
		event.stopPropagation();

		menu.classList.toggle("show");
	});

	wrapper.append(button, menu);

	return wrapper;
}

// close store menus when clicking elsewhere

document.addEventListener("pointerdown", function (event) {
	if (!event.target.closest(".store-menu, .store-more-button")) {
		store.querySelectorAll(".store-menu.show").forEach(function (menu) {
			menu.classList.remove("show");
		});
	}
});

// The small ⋯ menu at the bottom of the sidebar

const storeMoreButton = document.getElementById("storeMoreButton");

const storeMoreMenu = document.getElementById("storeMoreMenu");

storeMoreButton.addEventListener("click", function (event) {
	event.stopPropagation();

	storeMoreMenu.classList.toggle("show");
});

document.getElementById("refreshInfoButton").addEventListener("click", function () {
	storeMoreMenu.classList.remove("show");

	Object.keys(localStorage).forEach(function (key) {
		if (key.startsWith("browstore-meta-")) {
			localStorage.removeItem(key);
		}
	});

	// if an app is open, reload its info right now

	if (detailsAppId) {
		showDetails(detailsAppId, true);
	}

	showToast("Info updated");
});

// Add a website

const websiteSheet = document.getElementById("websiteSheet");

const websiteUrl = document.getElementById("websiteUrl");

const websiteName = document.getElementById("websiteName");

const websiteIcon = document.getElementById("websiteIcon");

const websiteIconLabel = document.getElementById("websiteIconLabel");

const websiteError = document.getElementById("websiteError");

const websiteAdd = document.getElementById("websiteAdd");

const websiteCancel = document.getElementById("websiteCancel");

let websiteIconData = null;

function openWebsiteSheet() {
	websiteUrl.value = "";
	websiteName.value = "";
	websiteIconData = null;
	websiteIconLabel.textContent = "Icon (optional)";
	websiteError.hidden = true;
	websiteAdd.disabled = false;
	websiteAdd.textContent = "Add";

	websiteSheet.hidden = false;

	websiteUrl.focus();
}

function closeWebsiteSheet() {
	websiteSheet.hidden = true;
}

document.getElementById("addWebsiteButton").addEventListener("click", openWebsiteSheet);

websiteCancel.addEventListener("click", closeWebsiteSheet);

websiteSheet.addEventListener("pointerdown", function (event) {
	if (event.target === websiteSheet) {
		closeWebsiteSheet();
	}
});

// accepts "example.com" or "https://example.com/page"

function normalizeUrl(text) {
	let value = text.trim();

	if (value === "") {
		return null;
	}

	if (!/^[a-z]+:\/\//i.test(value)) {
		value = "https://" + value;
	}

	try {
		const url = new URL(value);

		if (url.protocol !== "https:" && url.protocol !== "http:") {
			return null;
		}

		if (!url.hostname.includes(".") && url.hostname !== "localhost") {
			return null;
		}

		return url.href;
	} catch (error) {
		return null;
	}
}

websiteIcon.addEventListener("change", function () {
	const file = websiteIcon.files[0];

	if (!file) {
		return;
	}

	const reader = new FileReader();

	reader.onload = function () {
		websiteIconData = reader.result;

		websiteIconLabel.textContent = file.name;
	};

	reader.readAsDataURL(file);

	websiteIcon.value = "";
});

// creates a website in the library, returns its id (or null if it could not be saved)

async function createWebsite(url, customName, customIcon) {
	// try to get the site's own name and icon, it's fine if the site doesn't allow it

	let officialName = null;
	let officialIcon = null;

	try {
		const page = await readOfficialPage(url);

		officialName = page.name || null;

		if (/^https?:\/\//i.test(page.icon)) {
			officialIcon = page.icon;
		}
	} catch (error) {
		// the hostname and a neutral icon are used instead
	}

	const site = {
		id: "site-" + Date.now(),
		url: url,
		name: officialName,
		iconUrl: officialIcon,
		customName: customName,
		customIcon: customIcon,
	};

	customSites.push(site);

	try {
		installApp(site.id);
	} catch (error) {
		// usually an icon that is too big to save

		customSites.pop();

		installedApps = installedApps.filter(function (id) {
			return id !== site.id;
		});

		return null;
	}

	return site.id;
}

async function addWebsite() {
	const url = normalizeUrl(websiteUrl.value);

	if (!url) {
		websiteError.textContent = "Enter a valid website address.";
		websiteError.hidden = false;

		return;
	}

	websiteAdd.disabled = true;
	websiteAdd.textContent = "Adding…";

	const id = await createWebsite(url, websiteName.value.trim() || null, websiteIconData);

	if (!id) {
		websiteError.textContent = "That icon is too big, try a smaller one.";
		websiteError.hidden = false;

		websiteAdd.disabled = false;
		websiteAdd.textContent = "Add";

		return;
	}

	closeWebsiteSheet();

	showAddedToast(id);
}

websiteAdd.addEventListener("click", addWebsite);

websiteUrl.addEventListener("keydown", function (event) {
	if (event.key === "Enter") {
		addWebsite();
	}
});

// Keep everything up to date

document.addEventListener("apps-changed", function () {
	renderStore();

	if (detailsAppId) {
		showDetails(detailsAppId);
	}
});

renderStore();
