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
  # Always reinstall icon in 48x48 and 256x256 so launchers show it (some DEs use 48x48)
  if [ ! -f "$ICON_SRC" ]; then
    echo "Warning: $ICON_SRC not found; app menu may show generic icon."
  fi
  for SIZE in 48x48 256x256; do
    sudo mkdir -p "/usr/share/icons/hicolor/$SIZE/apps"
    if [ -f "$ICON_SRC" ]; then
      sudo cp "$ICON_SRC" "/usr/share/icons/hicolor/$SIZE/apps/${ICON_NAME}.png"
      sudo chmod 644 "/usr/share/icons/hicolor/$SIZE/apps/${ICON_NAME}.png"
    fi
  done
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
  progress 85 "Refreshing ldroid command and install path..."
  sudo mkdir -p /etc/llamacpp-droid
  printf '%s' "$ROOT" | sudo tee /etc/llamacpp-droid/install-dir >/dev/null
  if [ -f "$ROOT/ldroid-wrapper" ]; then
    sudo cp "$ROOT/ldroid-wrapper" "$BIN/ldroid"
    sudo chmod 755 "$BIN/ldroid"
  else
    sudo ln -sf "$ROOT/ldroid" "$BIN/ldroid"
  fi
  if command -v update-desktop-database >/dev/null 2>&1; then
    sudo update-desktop-database "$APPS" 2>/dev/null || true
  fi
else
  progress 70 "Refreshing desktop entry and ldroid..."
  # Running from a clone (not /opt): install icon into user theme and use theme name so launcher shows it
  ICON_SRC="$ROOT/systems/llamacpp-log-viewer/icon.png"
  ICON_NAME="llamacpp-droid"
  ICONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
  APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  if [ -f "$ICON_SRC" ]; then
    for SIZE in 48x48 256x256; do
      mkdir -p "$ICONS_DIR/$SIZE/apps"
      cp "$ICON_SRC" "$ICONS_DIR/$SIZE/apps/${ICON_NAME}.png"
      chmod 644 "$ICONS_DIR/$SIZE/apps/${ICON_NAME}.png"
    done
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
      gtk-update-icon-cache -f "$ICONS_DIR" 2>/dev/null || true
    fi
    mkdir -p "$APPS"
    DESKTOP="$APPS/llamacpp-droid.desktop"
    EXEC_QUOTED="\"$ROOT/start.sh\""
    cat > "$DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=llamacpp droid
Comment=Run llama.cpp Docker containers and stream logs
Exec=$EXEC_QUOTED
Icon=$ICON_NAME
Categories=Development;Utility;
Terminal=false
EOF
    chmod 644 "$DESKTOP"
    if command -v update-desktop-database >/dev/null 2>&1; then
      update-desktop-database "$APPS" 2>/dev/null || true
    fi
  fi
  CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid"
  mkdir -p "$CONFIG_DIR"
  printf '%s' "$ROOT" > "$CONFIG_DIR/install-dir"
  BIN="${XDG_BIN_HOME:-$HOME/.local/bin}"
  if [ -d "$BIN" ]; then
    if [ -f "$ROOT/ldroid-wrapper" ]; then
      cp "$ROOT/ldroid-wrapper" "$BIN/ldroid"
      chmod 755 "$BIN/ldroid"
    elif [ -f "$ROOT/ldroid" ]; then
      ln -sf "$ROOT/ldroid" "$BIN/ldroid"
    fi
  fi
fi

progress 100 "Update complete."
echo "Run ldroid start (or ./start.sh) to launch."
echo ""
[ -t 0 ] && read -r -p "Press Enter to close..."
