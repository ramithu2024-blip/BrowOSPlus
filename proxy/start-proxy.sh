#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in Linux) OSNAME=linux;; Darwin) OSNAME=darwin;; *) echo "Unsupported OS"; exit 1;; esac
case "$ARCH" in x86_64|amd64) ARCHNAME=amd64;; aarch64|arm64) ARCHNAME=arm64;; *) echo "Unsupported arch"; exit 1;; esac
BIN="$ROOT/bin/browos-backend-${OSNAME}-${ARCHNAME}"
PORT="${PORT:-8787}"
"$BIN" &
echo "Proxy running on http://127.0.0.1:${PORT} (PID $!)"
wait
