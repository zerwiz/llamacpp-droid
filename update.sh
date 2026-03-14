#!/usr/bin/env bash
# Update the app: pull latest code (if git repo) and refresh dependencies.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$ROOT/.git" ]; then
  echo "Pulling latest changes..."
  git -C "$ROOT" pull --rebase 2>/dev/null || git -C "$ROOT" pull 2>/dev/null || true
fi

echo "Updating app dependencies..."
cd "$ROOT/systems/llamacpp-log-viewer"
npm install

# Refresh desktop entry (in case paths changed)
ICON_SRC="$ROOT/systems/llamacpp-log-viewer/icon.png"
if [ -f "$ICON_SRC" ]; then
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
  echo "Updated desktop entry: $DESKTOP"
fi

echo "Update done. Run ./start.sh to launch."
