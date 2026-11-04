// Files / Virtual Disk System

const explorerWindow = document.getElementById("explorerWindow");
const explorerSidebar = document.getElementById("explorerSidebar");
const explorerFiles = document.getElementById("explorerFiles");
const explorerToolbar = document.getElementById("explorerToolbar");
const explorerBreadcrumb = document.getElementById("explorerBreadcrumb");

// ---------- IndexedDB helpers ----------
function openFSDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open("browos-fs", 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("entries")) {
				const store = db.createObjectStore("entries", { keyPath: "path" });
				store.createIndex("parent", "parent", { unique: false });
			}
			if (!db.objectStoreNames.contains("handles")) {
				db.createObjectStore("handles", { keyPath: "id" });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGet(store, key) {
	const db = await openFSDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readonly");
		const req = tx.objectStore(store).get(key);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbPut(store, value) {
	const db = await openFSDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		const req = tx.objectStore(store).put(value);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbDelete(store, key) {
	const db = await openFSDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readwrite");
		const req = tx.objectStore(store).delete(key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

async function idbGetAll(store) {
	const db = await openFSDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, "readonly");
		const req = tx.objectStore(store).getAll();
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

function dirname(p) {
	if (p === "/") return null;
	const parts = p.split("/").filter(Boolean);
	parts.pop();
	return "/" + parts.join("/");
}

function basename(p) {
	const parts = p.split("/").filter(Boolean);
	return parts.length ? parts[parts.length - 1] : "";
}

// ---------- OSD Adapter (IndexedDB) ----------
class OSDAdapter {
	constructor() {
		this.id = "osd";
		this.name = "OSD (C:)";
		this.label = "OSD (C:)";
		this.icon = "💾";
		this.type = "osd";
		this.mounted = true;
		this.canRead = true;
		this.canWrite = true;
	}

	async init() {
		const root = await idbGet("entries", "/");
		if (!root) {
			await idbPut("entries", { path: "/", name: "", type: "dir", parent: null, size: 0, modified: Date.now() });
		}
		const username = (localStorage.getItem("browos-username") || "User").trim() || "User";
		// Windows-like structure
		const systemFolders = ["Users", "System", "Program Files", "ProgramData"];
		for (const name of systemFolders) {
			const path = "/" + name;
			const existing = await idbGet("entries", path);
			if (!existing) {
				await idbPut("entries", { path, name, type: "dir", parent: "/", size: 0, modified: Date.now() });
			}
		}
		const userRoot = "/Users/" + username;
		const userFolders = ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos", "Trash", ".userdata"];
		// ensure Users/<username>
		let userEntry = await idbGet("entries", userRoot);
		if (!userEntry) {
			await idbPut("entries", { path: userRoot, name: username, type: "dir", parent: "/Users", size: 0, modified: Date.now() });
		}
		for (const name of userFolders) {
			const path = userRoot + "/" + name;
			const existing = await idbGet("entries", path);
			if (!existing) {
				await idbPut("entries", { path, name, type: "dir", parent: userRoot, size: 0, modified: Date.now(), hidden: name.startsWith(".") });
			}
		}
	}

	async list(path) {
		const all = await idbGetAll("entries");
		return all.filter(e => e.parent === path && e.path !== path).map(e => ({
			name: e.name,
			path: e.path,
			type: e.type,
			size: e.size || 0,
			modified: e.modified || Date.now(),
		}));
	}

	async read(path) {
		const e = await idbGet("entries", path);
		if (!e || e.type !== "file") throw new Error("Not a file");
		return e.content;
	}

	async write(path, data, mimeType) {
		const parent = dirname(path);
		await idbPut("entries", {
			path,
			name: basename(path),
			type: "file",
			parent,
			content: data,
			mimeType: mimeType || "application/octet-stream",
			size: data && data.byteLength ? data.byteLength : (data && data.size ? data.size : 0),
			modified: Date.now(),
		});
	}

	async mkdir(path) {
		const parent = dirname(path);
		await idbPut("entries", {
			path,
			name: basename(path),
			type: "dir",
			parent,
			size: 0,
			modified: Date.now(),
		});
	}

	async remove(path) {
		const all = await idbGetAll("entries");
		const toDelete = all.filter(e => e.path === path || e.path.startsWith(path + "/"));
		for (const e of toDelete) {
			await idbDelete("entries", e.path);
		}
	}

	async rename(oldPath, newPath) {
		const entry = await idbGet("entries", oldPath);
		if (!entry) throw new Error("Not found");
		await this.remove(newPath).catch(() => {});
		const isDir = entry.type === "dir";
		entry.path = newPath;
		entry.name = basename(newPath);
		entry.parent = dirname(newPath);
		entry.modified = Date.now();
		await idbPut("entries", entry);
		if (isDir) {
			const all = await idbGetAll("entries");
			const children = all.filter(e => e.path.startsWith(oldPath + "/"));
			for (const c of children) {
				const newChildPath = newPath + c.path.slice(oldPath.length);
				await idbDelete("entries", c.path);
				c.path = newChildPath;
				c.parent = dirname(newChildPath);
				c.name = basename(newChildPath);
				await idbPut("entries", c);
			}
		}
		await idbDelete("entries", oldPath);
	}

	async copy(src, dest) {
		const entry = await idbGet("entries", src);
		if (!entry) throw new Error("Not found");
		if (entry.type === "file") {
			await this.write(dest, entry.content);
		} else {
			await this.mkdir(dest);
			const children = await this.list(src);
			for (const c of children) {
				await this.copy(c.path, dest + "/" + c.name);
			}
		}
	}

	async move(src, dest) {
		await this.copy(src, dest);
		await this.remove(src);
	}
}

// ---------- My Computer Adapter (File System Access API) ----------
class ComputerAdapter {
	constructor() {
		this.id = "computer";
		this.name = "My Computer";
		this.label = "My Computer";
		this.icon = "💻";
		this.type = "computer";
		this.mounted = false;
		this.canRead = false;
		this.canWrite = false;
		this.rootHandle = null;
		this.currentHandle = null;
		this.currentPath = "/";
		this.savedHandle = null;
	}

	supported() {
		return typeof window.showDirectoryPicker === "function";
	}

	async init() {
		try {
			const saved = await idbGet("handles", "computer");
			if (saved && saved.handle) {
				this.savedHandle = saved.handle;
				const perm = await this.savedHandle.queryPermission({ mode: "readwrite" });
				if (perm === "granted") {
					this.rootHandle = this.savedHandle;
					this.currentHandle = this.savedHandle;
					this.mounted = true;
					this.canRead = true;
					this.canWrite = true;
				} else {
					this.mounted = false;
				}
			}
		} catch (e) {
			this.mounted = false;
		}
	}

	async mount() {
		if (!this.supported()) {
			throw new Error("File System Access API not supported in this browser");
		}
		const handle = await window.showDirectoryPicker({ mode: "readwrite" });
		this.rootHandle = handle;
		this.currentHandle = handle;
		this.currentPath = "/";
		this.mounted = true;
		this.canRead = true;
		this.canWrite = true;
		await idbPut("handles", { id: "computer", handle });
		this.savedHandle = handle;
		return handle;
	}

	async unmount() {
		this.rootHandle = null;
		this.currentHandle = null;
		this.currentPath = "/";
		this.mounted = false;
		this.canRead = false;
		this.canWrite = false;
		await idbDelete("handles", "computer").catch(() => {});
	}

	async requestPermission() {
		if (!this.savedHandle) return "denied";
		const perm = await this.savedHandle.requestPermission({ mode: "readwrite" });
		if (perm === "granted") {
			this.rootHandle = this.savedHandle;
			this.currentHandle = this.savedHandle;
			this.currentPath = "/";
			this.mounted = true;
			this.canRead = true;
			this.canWrite = true;
		}
		return perm;
	}

	async list(path) {
		if (!this.mounted || !this.currentHandle) throw new Error("Not mounted");
		const entries = [];
		for await (const [name, handle] of this.currentHandle.entries()) {
			entries.push({
				name,
				path: (this.currentPath === "/" ? "/" : this.currentPath + "/") + name,
				type: handle.kind === "directory" ? "dir" : "file",
				size: 0,
				modified: Date.now(),
				handle,
			});
		}
		// fetch sizes for files
		for (const e of entries) {
			if (e.type === "file" && e.handle) {
				try {
					const f = await e.handle.getFile();
					e.size = f.size;
					e.modified = f.lastModified;
				} catch (err) {}
			}
		}
		return entries;
	}

	async read(path) {
		// path not used; current handle file by name
		throw new Error("Use readFileByName");
	}

	async readFileByName(name) {
		if (!this.currentHandle) throw new Error("Not mounted");
		const fh = await this.currentHandle.getFileHandle(name);
		const file = await fh.getFile();
		return await file.arrayBuffer();
	}

	async write(path, data, name) {
		if (!this.currentHandle) throw new Error("Not mounted");
		const fh = await this.currentHandle.getFileHandle(name || basename(path), { create: true });
		const w = await fh.createWritable();
		await w.write(data);
		await w.close();
	}

	async mkdir(name) {
		if (!this.currentHandle) throw new Error("Not mounted");
		await this.currentHandle.getDirectoryHandle(name, { create: true });
	}

	async remove(name) {
		if (!this.currentHandle) throw new Error("Not mounted");
		await this.currentHandle.removeEntry(name, { recursive: true });
	}

	async rename(oldName, newName) {
		if (!this.currentHandle) throw new Error("Not mounted");
		// copy + delete
		// Fallback: try move if supported
		let entryHandle;
		try {
			entryHandle = await this.currentHandle.getDirectoryHandle(oldName);
		} catch (e) {
			entryHandle = await this.currentHandle.getFileHandle(oldName);
		}
		if (entryHandle.move) {
			await entryHandle.move(newName);
			return;
		}
		// copy+delete
		if (entryHandle.kind === "file") {
			const file = await entryHandle.getFile();
			const buf = await file.arrayBuffer();
			await this.write(newName, buf, newName);
			await this.remove(oldName);
		} else {
			await this.mkdir(newName);
			const newDir = await this.currentHandle.getDirectoryHandle(newName);
			const oldDir = entryHandle;
			await copyDir(oldDir, newDir);
			await this.remove(oldName);
		}
	}

	async navigateInto(name) {
		if (!this.currentHandle) throw new Error("Not mounted");
		this.currentHandle = await this.currentHandle.getDirectoryHandle(name);
		this.currentPath = this.currentPath === "/" ? "/" + name : this.currentPath + "/" + name;
	}

	async navigateUp() {
		// Cannot get parent handle from FSA; track stack instead
	}

	async cdRoot() {
		if (!this.rootHandle) throw new Error("Not mounted");
		this.currentHandle = this.rootHandle;
		this.currentPath = "/";
	}

	async copy(srcName, destName) {
		if (!this.currentHandle) throw new Error("Not mounted");
		let srcHandle;
		try { srcHandle = await this.currentHandle.getDirectoryHandle(srcName); }
		catch (e) { srcHandle = await this.currentHandle.getFileHandle(srcName); }
		if (srcHandle.kind === "file") {
			const file = await srcHandle.getFile();
			const buf = await file.arrayBuffer();
			const fh = await this.currentHandle.getFileHandle(destName, { create: true });
			const w = await fh.createWritable();
			await w.write(buf);
			await w.close();
		} else {
			const destDir = await this.currentHandle.getDirectoryHandle(destName, { create: true });
			await copyDir(srcHandle, destDir);
		}
	}

	async move(srcName, destName) {
		await this.copy(srcName, destName);
		await this.remove(srcName);
	}
}

async function copyDir(srcDir, destDir) {
	for await (const [name, handle] of srcDir.entries()) {
		if (handle.kind === "directory") {
			const newDir = await destDir.getDirectoryHandle(name, { create: true });
			await copyDir(handle, newDir);
		} else {
			const file = await handle.getFile();
			const buf = await file.arrayBuffer();
			const fh = await destDir.getFileHandle(name, { create: true });
			const w = await fh.createWritable();
			await w.write(buf);
			await w.close();
		}
	}
}

// ---------- Disk Manager ----------
const osdAdapter = new OSDAdapter();
const computerAdapter = new ComputerAdapter();

const drives = [osdAdapter, computerAdapter];

const defaultDrivePresentation = {
	osd: { name: "OSD (C:)", icon: "💾", color: "" },
	computer: { name: "My Computer", icon: "💻", color: "" },
};

function applyDriveTheme() {
	let theme = {};
	try {
		theme = JSON.parse(localStorage.getItem("browos-drive-theme") || "{}");
	} catch (e) {
		theme = {};
	}
	drives.forEach(drive => {
		const t = (theme && theme[drive.id]) || {};
		const def = defaultDrivePresentation[drive.id] || {};
		drive.label = (typeof t.name === "string" && t.name.trim()) ? t.name.trim() : (def.name || drive.name);
		drive.icon = (typeof t.icon === "string" && t.icon.trim()) ? t.icon.trim() : (def.icon || drive.icon);
		drive.color = (typeof t.color === "string") ? t.color : (def.color || "");
	});
}

// ---------- Files UI State ----------
let currentDrive = osdAdapter;
let currentPath = "/";
let selectedEntries = [];
let currentEntries = [];
let showHiddenFiles = localStorage.getItem("browos-show-hidden") === "on";

async function initFiles() {
	await osdAdapter.init();
	await computerAdapter.init();
	applyDriveTheme();
	renderSidebar();
	await navigateTo(currentDrive, "/");
}

function renderSidebar() {
	if (!explorerSidebar) return;
	explorerSidebar.innerHTML = "";

	// Quick access (OSD folders) first
	if (currentDrive === osdAdapter) {
		const qaTitle = document.createElement("div");
		qaTitle.className = "sidebar-title";
		qaTitle.textContent = "Quick access";
		explorerSidebar.appendChild(qaTitle);

		const username = (localStorage.getItem("browos-username") || "User").trim() || "User";
		const home = "/Users/" + username;
		const quickFolders = [
			{ name: "Home", path: home, icon: "🏠" },
			{ name: "Desktop", path: home + "/Desktop", icon: "🖥️" },
			{ name: "Documents", path: home + "/Documents", icon: "📄" },
			{ name: "Downloads", path: home + "/Downloads", icon: "⬇️" },
			{ name: "Music", path: home + "/Music", icon: "🎵" },
			{ name: "Pictures", path: home + "/Pictures", icon: "🖼️" },
			{ name: "Videos", path: home + "/Videos", icon: "🎬" },
			{ name: "Trash", path: home + "/Trash", icon: "🗑️" },
		];
		quickFolders.forEach(qf => {
			const item = document.createElement("div");
			item.className = "explorer-drive";
			item.innerHTML = `<span class="drive-icon">${qf.icon}</span> <span class="drive-name">${qf.name}</span>`;
			item.addEventListener("click", () => {
				navigateTo(osdAdapter, qf.path);
			});
			explorerSidebar.appendChild(item);
		});
	}

	// Drives
	const drivesTitle = document.createElement("div");
	drivesTitle.className = "sidebar-title";
	drivesTitle.textContent = "Drives";
	explorerSidebar.appendChild(drivesTitle);

	drives.forEach(drive => {
		const item = document.createElement("div");
		item.className = "explorer-drive" + (drive === currentDrive ? " active" : "");
		item.innerHTML = `<span class="drive-icon">${drive.icon}</span> <span class="drive-name">${drive.label || drive.name}</span> ${drive.mounted ? "" : '<span class="drive-status">(unmounted)</span>'}`;
		item.addEventListener("click", () => {
			if (drive === computerAdapter && !drive.mounted) {
				showMountScreen();
			} else {
				navigateTo(drive, "/");
			}
		});
		explorerSidebar.appendChild(item);
	});
}

function showMountScreen() {
	if (!explorerFiles) return;
	explorerFiles.innerHTML = "";
	const div = document.createElement("div");
	div.className = "mount-screen";
	div.innerHTML = `
		<div class="mount-icon">💻</div>
		<h3>My Computer is not mounted</h3>
		<p>Select a folder on your computer to browse it here.</p>
		${computerAdapter.supported() ? '<button id="mountDriveBtn">Mount Drive</button>' : '<p>File System Access API is not supported in this browser.</p>'}
		${computerAdapter.savedHandle && !computerAdapter.mounted ? '<button id="requestPermBtn">Request Permission</button>' : ""}
		${!computerAdapter.supported() ? "" : '<button id="unmountDriveBtn" style="display:none">Unmount</button>'}
	`;
	explorerFiles.appendChild(div);
	const mountBtn = document.getElementById("mountDriveBtn");
	if (mountBtn) {
		mountBtn.addEventListener("click", async () => {
			try {
				await computerAdapter.mount();
				await navigateTo(computerAdapter, "/");
				renderSidebar();
			} catch (e) {
				await showAlert("Mount failed: " + e.message);
			}
		});
	}
	const permBtn = document.getElementById("requestPermBtn");
	if (permBtn) {
		permBtn.addEventListener("click", async () => {
			try {
				const perm = await computerAdapter.requestPermission();
				if (perm === "granted") {
					await navigateTo(computerAdapter, "/");
					renderSidebar();
				} else {
					await showAlert("Permission not granted");
				}
			} catch (e) {
				await showAlert("Permission request failed: " + e.message);
			}
		});
	}
}

async function navigateTo(drive, path) {
	currentDrive = drive;
	currentPath = path;
	if (drive === computerAdapter) {
		if (!drive.mounted) {
			showMountScreen();
			renderSidebar();
			return;
		}
		try {
			if (path === "/") {
				await drive.cdRoot();
			} else {
				const parts = path.split("/").filter(Boolean);
				await drive.cdRoot();
				for (const part of parts) {
					await drive.navigateInto(part);
				}
			}
		} catch (e) {
			explorerFiles.textContent = "Error: " + e.message;
			return;
		}
	}
	renderSidebar();
	renderToolbar();
	renderBreadcrumb();
	await renderFiles();
}

async function renderFiles() {
	if (!explorerFiles) return;
	explorerFiles.innerHTML = "";
	let entries = [];
	try {
		entries = await currentDrive.list(currentPath);
		if (currentDrive === osdAdapter && !showHiddenFiles) {
			entries = entries.filter(e => !e.name.startsWith("."));
		}
	} catch (e) {
		explorerFiles.textContent = "Error: " + e.message;
		return;
	}
	if (entries.length === 0) {
		explorerFiles.innerHTML = '<div class="empty-folder">This folder is empty.</div>';
		return;
	}
	entries.sort((a, b) => {
		if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	currentEntries = entries;
	const list = document.createElement("div");
	list.className = "file-list";
	entries.forEach(entry => {
		const row = document.createElement("div");
		row.className = "file-row";
		row.innerHTML = `<span class="file-icon">${entry.type === "dir" ? "📁" : "📄"}</span> <span class="file-name">${entry.name}</span> <span class="file-size">${entry.type === "file" ? formatSize(entry.size) : ""}</span>`;
		row.addEventListener("dblclick", () => {
			if (entry.type === "dir") {
				const newPath = currentPath === "/" ? "/" + entry.name : currentPath + "/" + entry.name;
				navigateTo(currentDrive, newPath);
			} else {
				openFile(entry);
			}
		});
		row.addEventListener("click", (e) => {
			if (e.ctrlKey || e.metaKey) {
				if (selectedEntries.includes(entry)) {
					selectedEntries = selectedEntries.filter(x => x !== entry);
					row.classList.remove("selected");
				} else {
					selectedEntries.push(entry);
					row.classList.add("selected");
				}
			} else {
				selectedEntries = [entry];
				document.querySelectorAll(".file-row").forEach(r => r.classList.remove("selected"));
				row.classList.add("selected");
			}
		});
		list.appendChild(row);
	});
	explorerFiles.appendChild(list);
}

function isProtectedPath(path) {
	const username = (localStorage.getItem("browos-username") || "User").trim() || "User";
	const protectedPaths = ["/", "/Users", "/System", "/Program Files", "/ProgramData", "/Users/" + username, "/Users/" + username + "/Trash"];
	return protectedPaths.includes(path);
}

function formatSize(bytes) {
	if (bytes < 1024) return bytes + " B";
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
	return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderToolbar() {
	if (!explorerToolbar) return;
	explorerToolbar.innerHTML = "";
	const buttons = [
		{ label: "New Folder", action: newFolder },
		{ label: "Upload", action: uploadFile },
		{ label: "Download", action: downloadSelected },
		{ label: "Duplicate", action: duplicateSelected },
		{ label: "Rename", action: renameSelected },
		{ label: "Delete", action: deleteSelected },
	];
	if (currentDrive === computerAdapter && currentDrive.mounted) {
		buttons.push({ label: "Unmount", action: unmountComputer });
	}
	buttons.forEach(b => {
		const btn = document.createElement("button");
		btn.className = "explorer-btn";
		btn.textContent = b.label;
		btn.addEventListener("click", b.action);
		explorerToolbar.appendChild(btn);
	});
}

function renderBreadcrumb() {
	if (!explorerBreadcrumb) return;
	explorerBreadcrumb.textContent = currentDrive.label + " " + currentPath;
}

async function newFolder() {
	const name = await showPrompt("Folder name:");
	if (!name) return;
	try {
		const existing = await currentDrive.list(currentPath);
		if (existing.some(e => e.name === name)) {
			await showAlert("An item with that name already exists.");
			return;
		}
		const path = currentPath === "/" ? "/" + name : currentPath + "/" + name;
		if (currentDrive === computerAdapter) {
			await currentDrive.mkdir(name);
		} else {
			await currentDrive.mkdir(path);
		}
		await renderFiles();
	} catch (e) {
		await showAlert("Failed: " + e.message);
	}
}

async function uploadFile() {
	const input = document.createElement("input");
	input.type = "file";
	input.multiple = true;
	input.addEventListener("change", async () => {
		for (const file of input.files) {
			const path = currentPath === "/" ? "/" + file.name : currentPath + "/" + file.name;
			const buf = await file.arrayBuffer();
			try {
				const existing = await currentDrive.list(currentPath);
				if (existing.some(e => e.name === file.name)) {
					if (!await showConfirm("Overwrite " + file.name + "?")) continue;
				}
				if (currentDrive === computerAdapter) {
					await currentDrive.write(path, buf, file.name);
				} else {
					await currentDrive.write(path, buf, file.type);
				}
			} catch (e) {
				await showAlert("Upload failed: " + e.message);
			}
		}
		await renderFiles();
	});
	input.click();
}

async function downloadSelected() {
	const entry = selectedEntries.find(e => e.type === "file");
	if (!entry) {
		await showAlert("Select a file first");
		return;
	}
	try {
		let buf;
		if (currentDrive === computerAdapter) {
			buf = await currentDrive.readFileByName(entry.name);
		} else {
			buf = await currentDrive.read(entry.path);
		}
		const blob = new Blob([buf]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = entry.name;
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		await showAlert("Download failed: " + e.message);
	}
}

async function renameSelected() {
	const entry = selectedEntries[0];
	if (!entry || selectedEntries.length !== 1) {
		await showAlert("Select a single item first");
		return;
	}
	const newName = await showPrompt("New name:", entry.name);
	if (!newName || newName === entry.name) return;
	if (isProtectedPath(entry.path)) {
		await showAlert("Operation not permitted");
		return;
	}
	try {
		if (currentDrive === computerAdapter) {
			await currentDrive.rename(entry.name, newName);
		} else {
			const newPath = (currentPath === "/" ? "/" : currentPath + "/") + newName;
			await currentDrive.rename(entry.path, newPath);
		}
		selectedEntries = [];
		await renderFiles();
	} catch (e) {
		await showAlert("Rename failed: " + e.message);
	}
}

async function duplicateSelected() {
	const entry = selectedEntries[0];
	if (!entry || selectedEntries.length !== 1) {
		await showAlert("Select a single item first");
		return;
	}
	try {
		let baseName = entry.name;
		let newName = baseName.includes(".") ? baseName.replace(/(\.[^.]+)$/, " (copy)$1") : baseName + " (copy)";
		// avoid conflict
		const existing = await currentDrive.list(currentPath);
		const names = new Set(existing.map(e => e.name));
		let counter = 2;
		while (names.has(newName)) {
			newName = baseName.includes(".") ? baseName.replace(/(\.[^.]+)$/, " (copy " + counter + ")$1") : baseName + " (copy " + counter + ")";
			counter++;
		}
		if (currentDrive === computerAdapter) {
			await currentDrive.copy(entry.name, newName);
		} else {
			const srcPath = entry.path;
			const destPath = (currentPath === "/" ? "/" : currentPath + "/") + newName;
			await currentDrive.copy(srcPath, destPath);
		}
		await renderFiles();
	} catch (e) {
		await showAlert("Duplicate failed: " + e.message);
	}
}

function confirmDialog(message) {
	return new Promise(resolve => {
		const overlay = document.createElement("div");
		overlay.className = "confirm-overlay";
		overlay.innerHTML = `<div class="confirm-box"><p>${message}</p><div class="confirm-actions"><button class="confirm-yes">Delete</button><button class="confirm-no">Cancel</button></div></div>`;
		explorerWindow.appendChild(overlay);
		overlay.querySelector(".confirm-yes").addEventListener("click", () => { overlay.remove(); resolve(true); });
		overlay.querySelector(".confirm-no").addEventListener("click", () => { overlay.remove(); resolve(false); });
	});
}

async function deleteSelected() {
	if (selectedEntries.length === 0) {
		await showAlert("Select an item first");
		return;
	}
	if (selectedEntries.some(e => isProtectedPath(e.path))) {
		await showAlert("Operation not permitted");
		return;
	}
	if (!await confirmDialog("Delete " + selectedEntries.length + " item(s)?")) return;
	try {
		for (const entry of selectedEntries) {
			if (currentDrive === computerAdapter) {
				await currentDrive.remove(entry.name);
			} else {
				// Move to Trash unless already in Trash
				const username = (localStorage.getItem("browos-username") || "User").trim() || "User";
				const trashRoot = "/Users/" + username + "/Trash";
				if (currentPath.startsWith(trashRoot)) {
					await currentDrive.remove(entry.path);
				} else {
					const username = (localStorage.getItem("browos-username") || "User").trim() || "User";
					const trashRoot = "/Users/" + username + "/Trash";
					const trashPath = trashRoot + "/" + entry.name;
					const existing = await currentDrive.list(trashRoot);
					const names = new Set(existing.map(e => e.name));
					let dest = trashPath;
					if (names.has(entry.name)) {
						const ext = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".")) : "";
						const base = ext ? entry.name.slice(0, -ext.length) : entry.name;
						dest = trashRoot + "/" + base + " (2)" + ext;
					}
					await currentDrive.move(entry.path, dest);
				}
			}
		}
		selectedEntries = [];
		await renderFiles();
	} catch (e) {
		await showAlert("Delete failed: " + e.message);
	}
}

async function unmountComputer() {
	await computerAdapter.unmount();
	await navigateTo(osdAdapter, "/");
}

async function openFile(entry) {
	if (entry.type === "dir") return;
	try {
		let buf;
		if (currentDrive === computerAdapter) {
			buf = await currentDrive.readFileByName(entry.name);
		} else {
			buf = await currentDrive.read(entry.path);
		}
		const blob = new Blob([buf]);
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank");
	} catch (e) {
		await showAlert("Open failed: " + e.message);
	}
}

// Window manager integration
const explorerButton = document.getElementById("explorerButton");

if (explorerButton) {
	explorerButton.addEventListener("click", function () {
		explorerWindow.classList.toggle("show");
		if (explorerWindow.classList.contains("show")) {
			if (typeof bringToFront === "function") bringToFront(explorerWindow);
			initFiles();
		}
	});
}

// Window manager handles open/close/drag for the app window.

// Ctrl+H toggles hidden files
document.addEventListener("keydown", function (e) {
	if (!explorerWindow || !explorerWindow.classList.contains("show")) return;
	if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
		e.preventDefault();
		showHiddenFiles = !showHiddenFiles;
		localStorage.setItem("browos-show-hidden", showHiddenFiles ? "on" : "off");
		renderFiles();
	}
	if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
		e.preventDefault();
		selectedEntries = [...currentEntries];
		document.querySelectorAll(".file-row").forEach(r => r.classList.add("selected"));
	}
});

// Auto-init on load
setTimeout(initFiles, 0);