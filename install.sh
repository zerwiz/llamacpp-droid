#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Show message on unexpected exit (set -e)
trap 'e=$?; [ $e -ne 0 ] && echo "" && echo "Installation failed (exit $e). Check errors above." && [ -t 0 ] && read -r -p "Press Enter to close..."' EXIT

[ -f "$ROOT/banner.txt" ] && cat "$ROOT/banner.txt" && echo

progress() { echo "[ $1% ] $2"; }

# ---- Detect environment so install adapts to this machine ----
progress 0 "Detecting system..."

OS_TYPE="$(uname -s 2>/dev/null || echo "Unknown")"
ARCH="$(uname -m 2>/dev/null || echo "Unknown")"
OS_NAME="$OS_TYPE"
OS_VERSION=""
if [ -f /etc/os-release ]; then
  # Parse without sourcing to avoid crashes on unusual os-release content
  OS_NAME="$(grep -E '^NAME=' /etc/os-release 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | head -c 80)" || true
  OS_VERSION="$(grep -E '^VERSION_ID=' /etc/os-release 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | head -c 20)" || true
  [ -z "$OS_NAME" ] && OS_NAME="$OS_TYPE"
fi

# Node/npm required
if ! command -v node >/dev/null 2>&1; then
  trap - EXIT
  echo "Error: Node.js is not installed or not in PATH."
  echo "Install Node.js 18+ (e.g. from https://nodejs.org or your package manager) and run this again."
  [ -t 0 ] && read -r -p "Press Enter to close..."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  trap - EXIT
  echo "Error: npm is not installed or not in PATH."
  echo "Install npm (with Node.js) and run this again."
  [ -t 0 ] && read -r -p "Press Enter to close..."
  exit 1
fi
NODE_VERSION="$(node -v 2>/dev/null || echo "?")"
NPM_VERSION="$(npm -v 2>/dev/null || echo "?")"
NODE_PATH="$(command -v node)"
NPM_PATH="$(command -v npm)"

# Docker or Podman (app uses one for containers)
if command -v docker >/dev/null 2>&1; then
  DOCKER_STATUS="docker: $(command -v docker)"
elif command -v podman >/dev/null 2>&1; then
  DOCKER_STATUS="podman: $(command -v podman)"
else
  DOCKER_STATUS="not found (install Docker or Podman for container features)"
fi

# Desktop entry path: standard on Linux (used only for system-wide install)
APPS="/usr/share/applications"
if [ "$OS_TYPE" != "Linux" ]; then
  echo "Note: This app is tested on Linux. You have: $OS_TYPE. Proceeding anyway."
fi

echo ""
echo "  OS:      $OS_NAME ${OS_VERSION:+ $OS_VERSION}"
echo "  Arch:    $ARCH"
echo "  Node:    $NODE_VERSION ($NODE_PATH)"
echo "  npm:     $NPM_VERSION ($NPM_PATH)"
echo "  Docker:  $DOCKER_STATUS"
echo ""

# Ask where to install (or use first arg: 1 = /opt, 2 or --local = this folder)
INSTALL_TO_OPT=true
if [ "$1" = "2" ] || [ "$1" = "--local" ] || [ "$1" = "local" ]; then
  INSTALL_TO_OPT=false
elif [ "$1" = "1" ] || [ "$1" = "--system" ]; then
  INSTALL_TO_OPT=true
elif [ -t 0 ]; then
  echo "Where do you want to install?"
  echo "  [1] /opt/llamacpp-droid (system-wide, requires sudo, app menu for all users)"
  echo "  [2] This folder ($ROOT) (user-only, no sudo, app menu for you only)"
  echo ""
  read -r -p "Choice [1]: " choice
  choice="${choice:-1}"
  if [ "$choice" = "2" ]; then
    INSTALL_TO_OPT=false
  fi
fi

if [ "$INSTALL_TO_OPT" = true ]; then
  INSTALL_DIR="/opt/llamacpp-droid"
  if ! command -v sudo >/dev/null 2>&1; then
    trap - EXIT
    echo "Error: sudo is required to install to $INSTALL_DIR. Install sudo or run as root."
    [ -t 0 ] && read -r -p "Press Enter to close..."
    exit 1
  fi
  if ! sudo -n true 2>/dev/null; then
    echo "This installer will use sudo to install to $INSTALL_DIR and /usr."
  fi
  echo "  Install: $INSTALL_DIR (system-wide)"
else
  INSTALL_DIR="$ROOT"
  echo "  Install: $INSTALL_DIR (this folder, user-only)"
fi
echo ""
progress 5 "Environment detected. Installing..."

# Install dependencies in source tree (for dev or for copy)
cd "$ROOT/systems/llamacpp-log-viewer"
npm install
progress 15 "Source dependencies installed."

if [ "$INSTALL_TO_OPT" = true ]; then
  # Install to /opt (requires sudo)
  progress 20 "Installing to $INSTALL_DIR (requires sudo)..."
  sudo mkdir -p "$INSTALL_DIR"
  if command -v rsync >/dev/null 2>&1; then
    sudo rsync -a --exclude='node_modules' "$ROOT/" "$INSTALL_DIR/"
  else
    for f in "$ROOT"/*; do [ -e "$f" ] && sudo cp -r "$f" "$INSTALL_DIR/"; done
    [ -d "$ROOT/.git" ] && sudo cp -r "$ROOT/.git" "$INSTALL_DIR/"
    sudo rm -rf "$INSTALL_DIR/systems/llamacpp-log-viewer/node_modules" 2>/dev/null || true
  fi
  progress 45 "Files copied to $INSTALL_DIR."

  cd "$INSTALL_DIR/systems/llamacpp-log-viewer"
  sudo env PATH="$PATH" npm install
  progress 75 "App dependencies installed in /opt."

  # System-wide icon and .desktop entry
  progress 80 "Installing app icon..."
  ICON_SRC="$INSTALL_DIR/systems/llamacpp-log-viewer/icon.png"
  ICON_NAME="llamacpp-droid"
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
  progress 85 "Registering app menu entry..."
  DESKTOP="$APPS/llamacpp-droid.desktop"
  sudo tee "$DESKTOP" >/dev/null << EOF
[Desktop Entry]
Type=Application
Name=llamacpp droid
Comment=Run llama.cpp Docker containers and stream logs
Exec=$INSTALL_DIR/start.sh
Icon=$ICON_NAME
Categories=Development;Utility;
Terminal=false
EOF
  sudo chmod 644 "$DESKTOP"
  progress 90 "Desktop entry installed."
  sudo mkdir -p /etc/llamacpp-droid
  printf '%s' "$INSTALL_DIR" | sudo tee /etc/llamacpp-droid/install-dir >/dev/null
  if [ -f "$ROOT/ldroid-wrapper" ]; then
    sudo cp "$ROOT/ldroid-wrapper" /usr/local/bin/ldroid
    sudo chmod 755 /usr/local/bin/ldroid
  else
    sudo ln -sf "$INSTALL_DIR/ldroid" /usr/local/bin/ldroid
  fi
  progress 95 "ldroid command installed (remembers install path)."
  if command -v update-desktop-database >/dev/null 2>&1; then
    sudo update-desktop-database "$APPS" 2>/dev/null || true
  fi
else
  # User-only: this folder — icon, .desktop, ldroid in user dirs (no sudo)
  progress 20 "Setting up app menu and ldroid for this folder..."
  ICON_SRC="$INSTALL_DIR/systems/llamacpp-log-viewer/icon.png"
  ICON_NAME="llamacpp-droid"
  ICONS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
  APPS_USER="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  BIN_USER="${XDG_BIN_HOME:-$HOME/.local/bin}"
  if [ ! -f "$ICON_SRC" ]; then
    echo "Warning: $ICON_SRC not found; app menu may show generic icon."
  fi
  for SIZE in 48x48 256x256; do
    mkdir -p "$ICONS_DIR/$SIZE/apps"
    if [ -f "$ICON_SRC" ]; then
      cp "$ICON_SRC" "$ICONS_DIR/$SIZE/apps/${ICON_NAME}.png"
      chmod 644 "$ICONS_DIR/$SIZE/apps/${ICON_NAME}.png"
    fi
  done
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f "$ICONS_DIR" 2>/dev/null || true
  fi
  progress 75 "Registering app menu entry (user)..."
  mkdir -p "$APPS_USER"
  DESKTOP="$APPS_USER/llamacpp-droid.desktop"
  EXEC_QUOTED="\"$INSTALL_DIR/start.sh\""
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
    update-desktop-database "$APPS_USER" 2>/dev/null || true
  fi
  progress 90 "Installing ldroid command and remembering path..."
  CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid"
  mkdir -p "$CONFIG_DIR"
  printf '%s' "$INSTALL_DIR" > "$CONFIG_DIR/install-dir"
  if [ -d "$BIN_USER" ]; then
    if [ -f "$ROOT/ldroid-wrapper" ]; then
      cp "$ROOT/ldroid-wrapper" "$BIN_USER/ldroid"
      chmod 755 "$BIN_USER/ldroid"
      progress 95 "ldroid installed to $BIN_USER (remembers install path; if you move the folder, ldroid will try to find it)."
    else
      ln -sf "$INSTALL_DIR/ldroid" "$BIN_USER/ldroid"
      progress 95 "ldroid linked to $BIN_USER/ldroid"
    fi
  else
    echo "Note: $BIN_USER not found; create it and run install again, or use $INSTALL_DIR/ldroid directly."
  fi
fi

progress 100 "Installation complete."
if [ "$INSTALL_TO_OPT" = true ]; then
  echo "Run 'ldroid start' or launch 'llamacpp droid' from your app menu."
else
  echo "Run '$INSTALL_DIR/ldroid start' or 'ldroid start' (if in PATH), or launch 'llamacpp droid' from your app menu."
fi
echo ""
trap - EXIT
[ -t 0 ] && read -r -p "Press Enter to close..."
