#!/usr/bin/env bash
# Update the app: pull latest code (if git repo) and refresh dependencies.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

[ -f "$ROOT/banner.txt" ] && cat "$ROOT/banner.txt" && echo

progress() { echo "[ $1% ] $2"; }

progress 0 "Starting update..."

if [ -d "$ROOT/.git" ]; then
  progress 10 "Pulling latest changes..."
  git -C "$ROOT" pull --rebase 2>/dev/null || git -C "$ROOT" pull 2>/dev/null || true
  progress 25 "Git pull done."
fi

progress 30 "Updating app dependencies..."
cd "$ROOT/systems/llamacpp-log-viewer"
if [[ "$ROOT" == /opt/* ]]; then
  sudo npm install
else
  npm install
fi
progress 60 "Dependencies updated."

# Refresh desktop entry and ldroid symlink (system-wide when installed under /opt)
if [[ "$ROOT" == /opt/* ]]; then
  progress 70 "Refreshing app icon and desktop entry..."
  APPS="/usr/share/applications"
  BIN="/usr/local/bin"
  ICON_SRC="$ROOT/systems/llamacpp-log-viewer/icon.png"
  ICON_NAME="llamacpp-droid"
  # Always reinstall icon so any future icon.png updates are applied to the menu
  sudo mkdir -p /usr/share/icons/hicolor/256x256/apps
  if [ -f "$ICON_SRC" ]; then
    sudo cp "$ICON_SRC" "/usr/share/icons/hicolor/256x256/apps/${ICON_NAME}.png"
    sudo chmod 644 "/usr/share/icons/hicolor/256x256/apps/${ICON_NAME}.png"
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
  fi
  DESKTOP="$APPS/llamacpp-droid.desktop"
  sudo tee "$DESKTOP" >/dev/null << EOF
[Desktop Entry]
Type=Application
Name=llamacpp droid
Comment=Run llama.cpp Docker containers and stream logs
Exec=$ROOT/start.sh
Icon=$ICON_NAME
Categories=Development;Utility;
Terminal=false
EOF
  sudo chmod 644 "$DESKTOP"
  progress 85 "Refreshing ldroid command..."
  sudo ln -sf "$ROOT/ldroid" "$BIN/ldroid"
  if command -v update-desktop-database >/dev/null 2>&1; then
    sudo update-desktop-database "$APPS" 2>/dev/null || true
  fi
else
  progress 70 "Refreshing desktop entry and ldroid..."
  # Running from a clone (not /opt): update user-local .desktop and ldroid
  ICON_SRC="$ROOT/systems/llamacpp-log-viewer/icon.png"
  if [ -f "$ICON_SRC" ]; then
    APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$APPS"
    DESKTOP="$APPS/llamacpp-droid.desktop"
    EXEC_QUOTED="\"$ROOT/start.sh\""
    ICON_QUOTED="\"$ICON_SRC\""
    cat > "$DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=llamacpp droid
Comment=Run llama.cpp Docker containers and stream logs
Exec=$EXEC_QUOTED
Icon=$ICON_QUOTED
Categories=Development;Utility;
Terminal=false
EOF
    chmod 644 "$DESKTOP"
    if command -v update-desktop-database >/dev/null 2>&1; then
      update-desktop-database "$APPS" 2>/dev/null || true
    fi
  fi
  BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"
  if [ -f "$ROOT/ldroid" ] && [ -d "$BIN" ]; then
    ln -sf "$ROOT/ldroid" "$BIN/ldroid"
  fi
fi

progress 100 "Update complete."
echo "Run ldroid start (or ./start.sh) to launch."
echo ""
[ -t 0 ] && read -r -p "Press Enter to close..."
