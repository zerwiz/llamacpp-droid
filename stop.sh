#!/usr/bin/env bash
# Stop the Electron llamacpp droid UI (if running).
# Folder-agnostic: resolves this repo's path at runtime so the root folder can have any name.
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/systems/llamacpp-log-viewer"
pkill -f "electron.*$APP_DIR" 2>/dev/null || true
pkill -f "Electron.*$APP_DIR" 2>/dev/null || true
# Fallbacks if process shows different path format
pkill -f "electron.*llamacpp-log-viewer" 2>/dev/null || true
pkill -f "electron.*llamacpp-droid" 2>/dev/null || true
echo "Stopped."
