// Custom dialog system (no browser prompts)

function ensureDialogStyles() {
	if (document.getElementById("browos-dialog-style")) return;
	const style = document.createElement("style");
	style.id = "browos-dialog-style";
	style.textContent = `
	.browos-dialog-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); z-index: 10000; }
	.browos-dialog-box { background: rgba(30,30,36,0.98); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 20px; max-width: 360px; width: 90%; text-align: center; }
	.browos-dialog-box p { margin: 0 0 16px; }
	.browos-dialog-box input { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #fff; margin-bottom: 16px; box-sizing: border-box; }
	.browos-dialog-actions { display: flex; gap: 8px; justify-content: center; }
	.browos-dialog-actions button { padding: 8px 14px; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; }
	.browos-dialog-actions .primary { background: var(--accent); }
	.browos-dialog-actions .danger { background: #c42b1c; }
	`;
	document.head.appendChild(style);
}

function showDialog(message, type, defaultValue) {
	ensureDialogStyles();
	return new Promise(resolve => {
		const overlay = document.createElement("div");
		overlay.className = "browos-dialog-overlay";
		let inputHtml = "";
		if (type === "prompt") {
			inputHtml = `<input type="text" value="${(defaultValue || "").replace(/"/g, "&quot;")}">`;
		}
		const okLabel = type === "confirm" || type === "prompt" ? "OK" : "OK";
		const cancelLabel = type === "alert" ? "" : "Cancel";
		overlay.innerHTML = `<div class="browos-dialog-box"><p>${message}</p>${inputHtml}<div class="browos-dialog-actions">${cancelLabel ? '<button class="cancel">' + cancelLabel + '</button>' : ""}<button class="ok primary">${okLabel}</button></div></div>`;
		document.body.appendChild(overlay);
		const input = overlay.querySelector("input");
		const okBtn = overlay.querySelector(".ok");
		const cancelBtn = overlay.querySelector(".cancel");
		if (input) input.focus();
		okBtn.addEventListener("click", () => {
			overlay.remove();
			if (type === "prompt") resolve(input.value);
			else resolve(true);
		});
		if (cancelBtn) {
			cancelBtn.addEventListener("click", () => {
				overlay.remove();
				if (type === "prompt") resolve(null);
				else resolve(false);
			});
		}
	});
}

window.showAlert = (msg) => showDialog(msg, "alert");
window.showConfirm = (msg) => showDialog(msg, "confirm");
window.showPrompt = (msg, def) => showDialog(msg, "prompt", def);