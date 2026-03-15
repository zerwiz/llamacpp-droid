#!/usr/bin/env bash
# Uninstall llamacpp droid: remove install (from remembered path), desktop entry, ldroid command, and config.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
APPS="/usr/share/applications"
DESKTOP_SYSTEM="$APPS/llamacpp-droid.desktop"

[ -f "$ROOT/banner.txt" ] && cat "$ROOT/banner.txt" && echo

progress() { echo "[ $1% ] $2"; }

# Discover where it was installed (system vs user)
INSTALL_DIR=""
INSTALL_TYPE=""
if [ -r /etc/llamacpp-droid/install-dir 2>/dev/null ]; then
  INSTALL_DIR="$(cat /etc/llamacpp-droid/install-dir 2>/dev/null | head -1 | tr -d '\n\r')"
  [ -n "$INSTALL_DIR" ] && INSTALL_TYPE="system"
fi
if [ -z "$INSTALL_TYPE" ] && [ -r "${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid/install-dir" 2>/dev/null ]; then
  INSTALL_DIR="$(cat "${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid/install-dir" 2>/dev/null | head -1 | tr -d '\n\r')"
  [ -n "$INSTALL_DIR" ] && INSTALL_TYPE="user"
fi
if [ -z "$INSTALL_TYPE" ]; then
  INSTALL_DIR="/opt/llamacpp-droid"
  INSTALL_TYPE="system"
fi

# Confirm unless -y/--yes
if [[ "${1:-}" != "-y" && "${1:-}" != "--yes" ]]; then
  echo "This will remove:"
  if [ "$INSTALL_TYPE" = "system" ]; then
    echo "  - $INSTALL_DIR"
    echo "  - $DESKTOP_SYSTEM"
    echo "  - /usr/local/bin/ldroid"
    echo "  - /etc/llamacpp-droid/"
  else
    echo "  - Desktop entry and ldroid command (user)"
    echo "  - ${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid/"
    echo "  (Your app folder $INSTALL_DIR is not deleted.)"
  fi
  echo ""
  read -r -p "Uninstall? [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Cancelled."; exit 0 ;;
  esac
fi

progress 0 "Stopping app if running..."
pkill -f "electron.*llamacpp-log-viewer" 2>/dev/null || true
pkill -f "electron.*llamacpp-droid" 2>/dev/null || true
[ -n "$INSTALL_DIR" ] && pkill -f "electron.*$INSTALL_DIR" 2>/dev/null || true
progress 15 "Done."

if [ "$INSTALL_TYPE" = "system" ]; then
  progress 20 "Removing desktop entry..."
  sudo rm -f "$DESKTOP_SYSTEM"
  progress 40 "Removing ldroid command..."
  sudo rm -f /usr/local/bin/ldroid
  progress 55 "Removing install path..."
  sudo rm -rf "$INSTALL_DIR"
  progress 75 "Removing config..."
  sudo rm -rf /etc/llamacpp-droid
  if command -v update-desktop-database >/dev/null 2>&1; then
    progress 90 "Refreshing app menu..."
    sudo update-desktop-database "$APPS" 2>/dev/null || true
  fi
else
  APPS_USER="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  BIN_USER="${XDG_BIN_HOME:-$HOME/.local/bin}"
  progress 20 "Removing desktop entry..."
  rm -f "$APPS_USER/llamacpp-droid.desktop"
  progress 45 "Removing ldroid command..."
  rm -f "$BIN_USER/ldroid"
  progress 70 "Removing config..."
  rm -rf "${XDG_CONFIG_HOME:-$HOME/.config}/llamacpp-droid"
  if command -v update-desktop-database >/dev/null 2>&1; then
    progress 85 "Refreshing app menu..."
    update-desktop-database "$APPS_USER" 2>/dev/null || true
  fi
fi

progress 100 "Uninstall complete."
if [ "$INSTALL_TYPE" = "system" ]; then
  echo "llamacpp droid has been removed. Your clone (if any) is unchanged."
else
  echo "ldroid command and app menu entry removed. Your app folder is unchanged; run it with $INSTALL_DIR/ldroid or re-run install."
fi
echo ""
[ -t 0 ] && read -r -p "Press Enter to close..."
