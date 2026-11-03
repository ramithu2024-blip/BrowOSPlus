#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/backend"

if [ ! -d node_modules ]; then
  echo "Installing backend dependencies..."
  npm install
fi

echo "Starting BrowOS+ backend on http://127.0.0.1:8787"
PORT="${PORT:-8787}" HOST="${HOST:-127.0.0.1}" npm start