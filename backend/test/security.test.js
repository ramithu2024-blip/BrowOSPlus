import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateIP, isBlockedHostname, validateTarget } from "../lib/security.js";

test("isPrivateIP blocks loopback and private ranges", () => {
	assert.equal(isPrivateIP("127.0.0.1"), true);
	assert.equal(isPrivateIP("10.0.0.1"), true);
	assert.equal(isPrivateIP("192.168.1.1"), true);
	assert.equal(isPrivateIP("172.16.0.1"), true);
	assert.equal(isPrivateIP("169.254.1.1"), true);
	assert.equal(isPrivateIP("8.8.8.8"), false);
});

test("isBlockedHostname blocks localhost and metadata", () => {
	assert.equal(isBlockedHostname("localhost"), true);
	assert.equal(isBlockedHostname("metadata.google.internal"), true);
	assert.equal(isBlockedHostname("example.com"), false);
});

test("validateTarget rejects unsupported protocols", async () => {
	await assert.rejects(() => validateTarget("ftp://example.com"), /Unsupported protocol/);
});

test("validateTarget rejects localhost", async () => {
	await assert.rejects(() => validateTarget("http://localhost/"), /Blocked host/);
});

test("validateTarget rejects private IP", async () => {
	await assert.rejects(() => validateTarget("http://192.168.0.1/"), /Private address/);
});

test("validateTarget accepts public URL", async () => {
	const u = await validateTarget("https://example.com/path");
	assert.equal(u.hostname, "example.com");
});