#!/usr/bin/env bash
# Stop the Electron llamacpp droid UI (if running)
pkill -f "electron.*llamacpp-log-viewer" 2>/dev/null || true
pkill -f "electron.*llamacpp-droid" 2>/dev/null || true
pkill -f "Electron.*llamacpp" 2>/dev/null || true
echo "Stopped."
