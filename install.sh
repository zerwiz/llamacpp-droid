#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/llamacpp-droid"

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

# Sudo required for /opt and /usr
if ! command -v sudo >/dev/null 2>&1; then
  trap - EXIT
  echo "Error: sudo is required to install to $INSTALL_DIR and /usr. Install sudo or run as root."
  [ -t 0 ] && read -r -p "Press Enter to close..."
  exit 1
fi
# Inform if sudo will prompt (do not exit on failure - we only need sudo later)
if ! sudo -n true 2>/dev/null; then
  echo "This installer will use sudo to install to $INSTALL_DIR and /usr/share/applications."
fi

# Desktop entry path: standard on Linux
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
echo "  Install: $INSTALL_DIR"
echo ""
progress 5 "Environment detected. Installing..."

# Install dependencies in source tree (for dev or for copy)
cd "$ROOT/systems/llamacpp-log-viewer"
npm install
progress 15 "Source dependencies installed."

# Install to /opt (requires sudo); keep user's PATH so same Node/npm are used under sudo
progress 20 "Installing to $INSTALL_DIR (requires sudo)..."
sudo mkdir -p "$INSTALL_DIR"
if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --exclude='node_modules' "$ROOT/" "$INSTALL_DIR/"
else
  sudo mkdir -p "$INSTALL_DIR"
  for f in "$ROOT"/*; do [ -e "$f" ] && sudo cp -r "$f" "$INSTALL_DIR/"; done
  [ -d "$ROOT/.git" ] && sudo cp -r "$ROOT/.git" "$INSTALL_DIR/"
  sudo rm -rf "$INSTALL_DIR/systems/llamacpp-log-viewer/node_modules" 2>/dev/null || true
fi
progress 45 "Files copied to $INSTALL_DIR."

cd "$INSTALL_DIR/systems/llamacpp-log-viewer"
# Use same PATH as current user so sudo uses the same Node/npm
sudo env PATH="$PATH" npm install
progress 75 "App dependencies installed in /opt."

# System-wide icon and .desktop entry (APPS set during detect)
# Always install/refresh icon so app menu shows it and any future icon.png changes are applied
progress 80 "Installing app icon..."
ICON_SRC="$INSTALL_DIR/systems/llamacpp-log-viewer/icon.png"
ICON_NAME="llamacpp-droid"
sudo mkdir -p /usr/share/icons/hicolor/256x256/apps
if [ -f "$ICON_SRC" ]; then
  sudo cp "$ICON_SRC" "/usr/share/icons/hicolor/256x256/apps/${ICON_NAME}.png"
  sudo chmod 644 "/usr/share/icons/hicolor/256x256/apps/${ICON_NAME}.png"
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
fi
progress 85 "Registering app menu entry..."
DESKTOP="$APPS/llamacpp-droid.desktop"
# Use icon name only so the system looks it up in the theme (path often not shown in menus)
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

# System-wide ldroid command
sudo ln -sf "$INSTALL_DIR/ldroid" /usr/local/bin/ldroid
progress 95 "ldroid command linked."

if command -v update-desktop-database >/dev/null 2>&1; then
  sudo update-desktop-database "$APPS" 2>/dev/null || true
fi

progress 100 "Installation complete."
echo "Run 'ldroid start' or launch 'llamacpp droid' from your app menu."
echo ""
trap - EXIT
[ -t 0 ] && read -r -p "Press Enter to close..."
