# BrowOS+

BrowOS+ is an enhanced fork of BrowOS with an integrated browser, a local backend proxy for website compatibility, browser settings, and optional PWA installation.

## Zero-install (recommended)

Download a release package for your platform. It contains the frontend and a prebuilt backend binary. No Node.js, Go, npm, or other developer tools are required.

### Run

Linux/macOS:
```bash
./start-browos.sh
```

Windows:
```bat
start-browos.bat
```

The launcher starts the backend on http://127.0.0.1:8787, opens BrowOS+ in your browser, and stops the backend when you exit.

### Release binaries

Prebuilt backend binaries are provided for:
- Windows x64
- Linux x64
- Linux ARM64
- macOS x64
- macOS ARM64

## Static-only mode

You can open `index.html` directly without any backend. The browser works with reduced compatibility (sites that block iframe embedding may not load).

## Development fallback (Node.js)

The original Fastify backend remains in `backend/` for development and testing:

```bash
cd backend
npm install
npm start
```

## Backend API

- `GET /health`
- `GET /proxy?url=<encoded-url>` (also POST/PUT/etc.)

## Security

SSRF protection, DNS validation, redirect validation, rate limiting, response size limits, timeouts, and loopback-only access are implemented in both backends.

## Limitations

- Some websites remain incompatible (authentication, anti-bot, DRM, WebSockets).
- Cookies are scoped to the backend origin.
- WebSocket proxying is not supported.