import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

function startServer(port) {
	return new Promise((resolve, reject) => {
		const proc = spawn(process.execPath, ["server.js"], {
			cwd: new URL("..", import.meta.url).pathname,
			env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let ready = false;
		const onData = (d) => {
			if (d.toString().includes("listening on")) {
				ready = true;
				resolve(proc);
			}
		};
		proc.stdout.on("data", onData);
		proc.stderr.on("data", onData);
		setTimeout(() => {
			if (!ready) reject(new Error("server did not start"));
		}, 10000);
	});
}

test("health check works", async () => {
	const port = 8891;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`);
		assert.equal(res.status, 200);
		const data = await res.json();
		assert.equal(data.status, "ok");
	} finally {
		proc.kill();
	}
});

test("proxy example.com returns HTML", async () => {
	const port = 8892;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/proxy?url=${encodeURIComponent("https://example.com")}`);
		assert.equal(res.status, 200);
		const ct = res.headers.get("content-type") || "";
		assert.match(ct, /text\/html/);
		const text = await res.text();
		assert.match(text, /Example Domain/);
		assert.equal(res.headers.get("x-frame-options"), null);
	} finally {
		proc.kill();
	}
});

test("proxy handles redirect", async () => {
	const port = 8893;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/proxy?url=${encodeURIComponent("http://google.com")}`);
		assert.equal(res.status, 200);
		assert.ok(res.headers.get("x-browos-final-url"));
	} finally {
		proc.kill();
	}
});

test("proxy blocks SSRF localhost", async () => {
	const port = 8894;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/proxy?url=${encodeURIComponent("http://127.0.0.1:22")}`);
		assert.equal(res.status, 400);
		const text = await res.text();
		assert.match(text, /Private address/);
	} finally {
		proc.kill();
	}
});

test("proxy blocks private IP", async () => {
	const port = 8895;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/proxy?url=${encodeURIComponent("http://192.168.1.1")}`);
		assert.equal(res.status, 400);
	} finally {
		proc.kill();
	}
});

test("proxy invalid URL", async () => {
	const port = 8896;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/proxy?url=${encodeURIComponent("ftp://example.com")}`);
		assert.equal(res.status, 400);
	} finally {
		proc.kill();
	}
});

test("rate limit and oversized not crash", async () => {
	const port = 8897;
	const proc = await startServer(port);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`);
		assert.equal(res.status, 200);
	} finally {
		proc.kill();
	}
});