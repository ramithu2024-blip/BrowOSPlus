import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { validateTarget, isLoopbackIP } from "./lib/security.js";
import { proxyRequest, MAX_RESPONSE, TIMEOUT } from "./lib/proxy.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ALLOW_REMOTE = process.env.ALLOW_REMOTE === "1";

const fastify = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

// content type parser: keep raw body as buffer
fastify.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: 2 * 1024 * 1024 }, (req, body, done) => {
	done(null, body);
});

await fastify.register(cors, {
	origin: true,
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
});

await fastify.register(rateLimit, {
	max: Number(process.env.RATE_LIMIT_MAX || 120),
	timeWindow: Number(process.env.RATE_LIMIT_WINDOW || 60000),
});

// restrict to local user
fastify.addHook("onRequest", async (request, reply) => {
	if (ALLOW_REMOTE) return;
	const ip = request.ip;
	if (!isLoopbackIP(ip)) {
		reply.code(403);
		return reply.send({ error: "Proxy access restricted to local user" });
	}
});

fastify.get("/health", async () => {
	return { status: "ok", version: "1.0.0", time: new Date().toISOString(), maxResponseSize: MAX_RESPONSE, timeout: TIMEOUT };
});

fastify.get("/", async () => {
	return {
		name: "BrowOS+ backend",
		endpoints: ["/health", "/proxy?url=<encoded-url>"],
		docs: "See README.md",
	};
});

fastify.all("/proxy", async (request, reply) => {
	return proxyRequest(request, reply);
});

// 404
fastify.setNotFoundHandler(async (request, reply) => {
	reply.code(404);
	return { error: "Not found" };
});

// error handler
fastify.setErrorHandler(async (err, request, reply) => {
	request.log.error(err);
	reply.code(500);
	return { error: err.message || "Internal error" };
});

try {
	await fastify.listen({ port: PORT, host: HOST });
	console.log(`BrowOS+ backend listening on http://${HOST}:${PORT}`);
} catch (err) {
	fastify.log.error(err);
	process.exit(1);
}