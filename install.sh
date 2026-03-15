#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/systems/llamacpp-log-viewer"

# Install dependencies
npm install

# Ensure app icon exists (use repo copy)
ICON_SRC="$ROOT/systems/llamacpp-log-viewer/icon.png"
if [ ! -f "$ICON_SRC" ]; then
  echo "Warning: icon not found at $ICON_SRC"
else
  # Install .desktop file so launcher/taskbar can show the icon
  APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$APPS"
  DESKTOP="$APPS/llamacpp-droid.desktop"
  cat > "$DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=llamacpp droid
Comment=Run llama.cpp Docker containers and stream logs
Exec=$ROOT/start.sh
Icon=$ICON_SRC
Categories=Development;Utility;
Terminal=false
EOF
  echo "Installed desktop entry: $DESKTOP"
fi

# Install ldroid CLI to PATH so "ldroid start" etc. work from anywhere
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"
if [ -f "$ROOT/ldroid" ]; then
  mkdir -p "$BIN"
  ln -sf "$ROOT/ldroid" "$BIN/ldroid"
  echo "Installed ldroid command: $BIN/ldroid (ensure $BIN is in your PATH)"
fi
