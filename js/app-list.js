// BrowOS apps

// Every app BrowOS knows about.
// Only real facts go here: name, where it runs, its official website and source.
// Descriptions and developer info are never written here, BrowStore loads them
// from the official page or the official GitHub API when the user opens the details.

function siteIcon(host) {
	return "https://www.google.com/s2/favicons?domain=" + host + "&sz=64";
}

const appCatalog = [
	{
		id: "settings",
		name: "Settings",
		category: "apps",
		builtIn: true,
		icon: "icons/settings-icon.png",
		window: "settingsWindow",
		credit: "BrowOS+",
	},
	// built into BrowOS

	{
		id: "notepad",
		name: "Notepad",
		category: "apps",
		builtIn: true,
		icon: "icons/notepad-icon.png",
		window: "notepadWindow",
		officialPage: "apps/notepad/index.html",
		github: "amitmerchant1990/notepad",
		website: "https://notepad.js.org",
		credit: "Notepad by Amit Merchant",
		license: "MIT License",
		dataKeys: [
			"note",
			"mode",
			"selectedFont",
			"dyslexicFont",
			"monospaced",
			"serifFont",
			"timerChime",
			"isUserPreferredTheme",
			"hasUserDismissedDonationPopup",
			"userChosenBreakReminders",
			"userChosenExplodingEffect",
			"userChosenFontSize",
			"userChosenFontWeight",
			"userChosenLineHeight",
			"userChosenOptimalLineLengthSelected",
			"userChosenSpellCheck",
			"userChosenTabIndentation",
			"userChosenTexture",
			"userChosenTransparentWordCountPillSelected",
			"userChosenTypewriterSound",
			"userChosenTypewriterVolume",
			"userChosenWordCountPillSelected",
			"userChosenWriteDirection",
			"recentUnicodeSymbols",
			"ambient-noise-presets",
			"breakReminderState",
		],
		dataDatabases: ["NotepadSnapshotsDB"],
	},

	{
		id: "calculator",
		name: "Calculator",
		category: "apps",
		builtIn: true,
		icon: "icons/calculator-icon.png",
		window: "calculatorWindow",
		officialPage: "apps/calculator/index.html",
		github: "nikh-tail/CodeAlpha_Task",
		credit: "NEO-CALC Pro by Nikhil Rathor (nikh-tail)",
		license: "MIT License",
		dataKeys: ["neocalc_history", "neocalc_theme"],
	},

	{
		id: "clock",
		name: "Clock",
		category: "apps",
		builtIn: true,
		icon: "icons/clock-icon.png",
		window: "clockWindow",
		credit: "Made for BrowOS",
	},

	{
		id: "paint",
		name: "Paint",
		category: "apps",
		builtIn: true,
		icon: "icons/paint-icon.png",
		window: "paintWindow",
		url: "https://viliusle.github.io/miniPaint/",
		github: "viliusle/miniPaint",
		website: "https://viliusle.github.io/miniPaint/",
		credit: "miniPaint by ViliusL",
		license: "MIT License",
	},

	{
		id: "browser",
		name: "Browser",
		category: "apps",
		builtIn: true,
		icon: "icons/browser-icon.png",
		window: "browserWindow",
		credit: "Made for BrowOS",
	},

	// web apps

	{
		id: "spotify",
		name: "Spotify",
		category: "apps",
		icon: siteIcon("spotify.com"),
		url: "https://open.spotify.com/",
		website: "https://open.spotify.com/",
		defaultMode: "window",
		requires: "Requires a Spotify account",
	},

	// games

	{
		id: "game2048",
		name: "2048",
		category: "games",
		icon: "https://play2048.co/favicon.ico",
		url: "https://play2048.co/",
		website: "https://play2048.co/",
		github: "gabrielecirulli/2048",
	},

	{
		id: "adarkroom",
		name: "A Dark Room",
		category: "games",
		icon: "https://doublespeakgames.github.io/adarkroom/favicon.ico",
		url: "https://doublespeakgames.github.io/adarkroom/",
		website: "https://adarkroom.doublespeakgames.com",
		github: "doublespeakgames/adarkroom",
	},

	{
		id: "clumsybird",
		name: "Clumsy Bird",
		category: "games",
		icon: "https://ellisonleao.github.io/clumsy-bird/data/img/favicon.ico",
		url: "https://ellisonleao.github.io/clumsy-bird/",
		website: "https://ellisonleao.github.io/clumsy-bird/",
		github: "ellisonleao/clumsy-bird",
	},

	{ id: "photocraft", name: "PhotoCraft", category: "apps", icon: "apps/photocraft/icon.png", url: "apps/photocraft/index.html", website: "https://getartcraft.com/apps/photocraft", github: "storytold/photocraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "vectorcraft", name: "VectorCraft", category: "apps", icon: "apps/vectorcraft/icon.png", url: "apps/vectorcraft/index.html", website: "https://getartcraft.com/apps/vectorcraft", github: "storytold/vectorcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "filmcraft", name: "FilmCraft", category: "apps", icon: "apps/filmcraft/icon.png", url: "apps/filmcraft/index.html", website: "https://getartcraft.com/apps/filmcraft", github: "storytold/filmcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "lightcraft", name: "LightCraft", category: "apps", icon: "apps/lightcraft/icon.png", url: "apps/lightcraft/index.html", website: "https://getartcraft.com/apps/lightcraft", github: "storytold/lightcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "pdfcraft", name: "PdfCraft", category: "apps", icon: "apps/pdfcraft/icon.png", url: "apps/pdfcraft/index.html", website: "https://getartcraft.com/apps/pdfcraft", github: "storytold/pdfcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "effectcraft", name: "EffectCraft", category: "apps", icon: "apps/effectcraft/icon.png", url: "apps/effectcraft/index.html", website: "https://getartcraft.com/apps/effectcraft", github: "storytold/effectcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "designcraft", name: "DesignCraft", category: "apps", icon: "apps/designcraft/icon.png", url: "apps/designcraft/index.html", website: "https://getartcraft.com/apps/designcraft", github: "storytold/designcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "figcraft", name: "FigCraft", category: "apps", icon: "apps/figcraft/icon.png", url: "apps/figcraft/index.html", website: "https://getartcraft.com/apps/figcraft", github: "storytold/figcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "wordcraft", name: "WordCraft", category: "apps", icon: "apps/wordcraft/icon.png", url: "apps/wordcraft/index.html", website: "https://getartcraft.com/apps/wordcraft", github: "storytold/wordcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "soundcraft", name: "SoundCraft", category: "apps", icon: "apps/soundcraft/icon.png", url: "apps/soundcraft/index.html", website: "https://getartcraft.com/apps/soundcraft", github: "storytold/soundcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "deckcraft", name: "DeckCraft", category: "apps", icon: "apps/deckcraft/icon.png", url: "apps/deckcraft/index.html", website: "https://getartcraft.com/apps/deckcraft", github: "storytold/deckcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "cadcraft", name: "CADCraft", category: "apps", icon: "apps/cadcraft/icon.png", url: "apps/cadcraft/index.html", website: "https://getartcraft.com/apps/cadcraft", github: "storytold/cadcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "gridcraft", name: "GridCraft", category: "apps", icon: "apps/gridcraft/icon.png", url: "apps/gridcraft/index.html", website: "https://getartcraft.com/apps/gridcraft", github: "storytold/gridcraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "texturecraft", name: "TextureCraft", category: "apps", icon: "apps/texturecraft/icon.png", url: "apps/texturecraft/index.html", website: "https://getartcraft.com/apps/texturecraft", github: "storytold/texturecraft", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
	{ id: "craft-anything", name: "Craft Anything", category: "apps", icon: "apps/craft-anything/icon.png", url: "apps/craft-anything/index.html", website: "https://getartcraft.com/apps/craft-anything", github: "storytold/craft-anything", credit: "ArtCraft Team", license: "MIT OR Apache-2.0" },
];

// BrowStore itself: always in the Start menu, can't be removed

const browStoreApp = {
	id: "browstore",
	name: "BrowStore",
	icon: "icons/browstore-icon.png",
	window: "browstoreWindow",
};
