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

	async write(path, data) {
		const parent = dirname(path);
		await idbPut("entries", {
			path,
			name: basename(path),
			type: "file",
			parent,
			content: data,
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

// ---------- Files UI State ----------
let currentDrive = osdAdapter;
let currentPath = "/";
let selectedEntry = null;

async function initFiles() {
	await osdAdapter.init();
	await computerAdapter.init();
	renderSidebar();
	await navigateTo(currentDrive, "/");
}

function renderSidebar() {
	if (!explorerSidebar) return;
	explorerSidebar.innerHTML = "";
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
				alert("Mount failed: " + e.message);
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
					alert("Permission not granted");
				}
			} catch (e) {
				alert("Permission request failed: " + e.message);
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
		if (path === "/") {
			await drive.cdRoot();
		} else {
			// navigate step by step
			const parts = path.split("/").filter(Boolean);
			await drive.cdRoot();
			for (const part of parts) {
				await drive.navigateInto(part);
			}
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
		row.addEventListener("click", () => {
			selectedEntry = entry;
			document.querySelectorAll(".file-row").forEach(r => r.classList.remove("selected"));
			row.classList.add("selected");
		});
		list.appendChild(row);
	});
	explorerFiles.appendChild(list);
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
	const name = prompt("Folder name:");
	if (!name) return;
	const path = currentPath === "/" ? "/" + name : currentPath + "/" + name;
	try {
		if (currentDrive === computerAdapter) {
			await currentDrive.mkdir(name);
		} else {
			await currentDrive.mkdir(path);
		}
		await renderFiles();
	} catch (e) {
		alert("Failed: " + e.message);
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
				if (currentDrive === computerAdapter) {
					await currentDrive.write(path, buf, file.name);
				} else {
					await currentDrive.write(path, buf);
				}
			} catch (e) {
				alert("Upload failed: " + e.message);
			}
		}
		await renderFiles();
	});
	input.click();
}

async function downloadSelected() {
	if (!selectedEntry || selectedEntry.type !== "file") {
		alert("Select a file first");
		return;
	}
	try {
		let buf;
		if (currentDrive === computerAdapter) {
			buf = await currentDrive.readFileByName(selectedEntry.name);
		} else {
			buf = await currentDrive.read(selectedEntry.path);
		}
		const blob = new Blob([buf]);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = selectedEntry.name;
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		alert("Download failed: " + e.message);
	}
}

async function renameSelected() {
	if (!selectedEntry) {
		alert("Select an item first");
		return;
	}
	const newName = prompt("New name:", selectedEntry.name);
	if (!newName || newName === selectedEntry.name) return;
	try {
		if (currentDrive === computerAdapter) {
			await currentDrive.rename(selectedEntry.name, newName);
		} else {
			const newPath = (currentPath === "/" ? "/" : currentPath + "/") + newName;
			// remove if exists
			await currentDrive.rename(selectedEntry.path, newPath);
		}
		selectedEntry = null;
		await renderFiles();
	} catch (e) {
		alert("Rename failed: " + e.message);
	}
}

async function deleteSelected() {
	if (!selectedEntry) {
		alert("Select an item first");
		return;
	}
	if (!confirm("Delete " + selectedEntry.name + "?")) return;
	try {
		if (currentDrive === computerAdapter) {
			await currentDrive.remove(selectedEntry.name);
		} else {
			await currentDrive.remove(selectedEntry.path);
		}
		selectedEntry = null;
		await renderFiles();
	} catch (e) {
		alert("Delete failed: " + e.message);
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
		alert("Open failed: " + e.message);
	}
}

// Window manager integration
const explorerButton = document.getElementById("explorerButton");
const closeExplorer = document.getElementById("closeExplorer");
const explorerHeader = document.querySelector(".explorer-header");

if (explorerButton) {
	explorerButton.addEventListener("click", function () {
		explorerWindow.classList.toggle("show");
		if (explorerWindow.classList.contains("show")) {
			if (typeof bringToFront === "function") bringToFront(explorerWindow);
			initFiles();
		}
	});
}

if (closeExplorer) {
	closeExplorer.addEventListener("click", function () {
		explorerWindow.classList.remove("show");
	});
}

if (explorerWindow) {
	explorerWindow.addEventListener("pointerdown", function () {
		if (typeof bringToFront === "function") bringToFront(explorerWindow);
	});
}

// Dragging
let isDraggingExplorer = false;
let offX = 0;
let offY = 0;

if (explorerHeader) {
	explorerHeader.addEventListener("pointerdown", function (event) {
		if (event.target.closest(".close-explorer")) return;
		isDraggingExplorer = true;
		const rect = explorerWindow.getBoundingClientRect();
		offX = event.clientX - rect.left;
		offY = event.clientY - rect.top;
		explorerWindow.style.transform = "none";
		explorerWindow.style.left = rect.left + "px";
		explorerWindow.style.top = rect.top + "px";
		explorerHeader.setPointerCapture(event.pointerId);
	});

	explorerHeader.addEventListener("pointermove", function (event) {
		if (!isDraggingExplorer) return;
		explorerWindow.style.left = event.clientX - offX + "px";
		explorerWindow.style.top = Math.max(0, event.clientY - offY) + "px";
	});

	explorerHeader.addEventListener("pointerup", function (event) {
		isDraggingExplorer = false;
		try { explorerHeader.releasePointerCapture(event.pointerId); } catch (e) {}
	});
}

// Auto-init on load
setTimeout(initFiles, 0);