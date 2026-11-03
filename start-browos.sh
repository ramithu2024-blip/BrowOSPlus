#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
	Linux) OSNAME="linux" ;;
	Darwin) OSNAME="darwin" ;;
	*) echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
	x86_64|amd64) ARCHNAME="amd64" ;;
	aarch64|arm64) ARCHNAME="arm64" ;;
	*) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BIN="$ROOT/proxy/bin/browos-backend-${OSNAME}-${ARCHNAME}"
if [ ! -x "$BIN" ]; then
	echo "Backend binary not found: $BIN"
	echo "Build it with: cd backend-go && GOOS=$OSNAME GOARCH=$ARCHNAME go build -o bin/browos-backend-${OSNAME}-${ARCHNAME} ."
	exit 1
fi

PORT="${PORT:-8787}"
STATIC_DIR="$ROOT" "$BIN" &
BPID=$!

cleanup() {
	kill "$BPID" 2>/dev/null || true
	wait "$BPID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# wait for backend
for i in $(seq 1 50); do
	if curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
		break
	fi
	sleep 0.2
done

URL="http://127.0.0.1:${PORT}/"
case "$OS" in
	Linux) xdg-open "$URL" >/dev/null 2>&1 || true ;;
	Darwin) open "$URL" ;;
esac

echo "BrowOS+ is running. Backend PID $BPID. Press Ctrl+C to stop."
wait "$BPID"