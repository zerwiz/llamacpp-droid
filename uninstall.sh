#!/usr/bin/env bash
# Uninstall llamacpp droid: remove /opt install, desktop entry, and ldroid command.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/llamacpp-droid"
APPS="/usr/share/applications"
DESKTOP="$APPS/llamacpp-droid.desktop"

[ -f "$ROOT/banner.txt" ] && cat "$ROOT/banner.txt" && echo

progress() { echo "[ $1% ] $2"; }

# Confirm unless -y/--yes
if [[ "${1:-}" != "-y" && "${1:-}" != "--yes" ]]; then
  echo "This will remove:"
  echo "  - $INSTALL_DIR"
  echo "  - $DESKTOP"
  echo "  - /usr/local/bin/ldroid"
  echo ""
  read -r -p "Uninstall? [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Cancelled."; exit 0 ;;
  esac
fi

progress 0 "Stopping app if running..."
pkill -f "electron.*$INSTALL_DIR" 2>/dev/null || true
pkill -f "Electron.*$INSTALL_DIR" 2>/dev/null || true
pkill -f "electron.*llamacpp-log-viewer" 2>/dev/null || true
pkill -f "electron.*llamacpp-droid" 2>/dev/null || true
progress 15 "Done."

progress 20 "Removing desktop entry..."
sudo rm -f "$DESKTOP"
progress 40 "Done."

progress 45 "Removing ldroid command..."
sudo rm -f /usr/local/bin/ldroid
progress 60 "Done."

progress 65 "Removing $INSTALL_DIR..."
sudo rm -rf "$INSTALL_DIR"
progress 90 "Done."

if command -v update-desktop-database >/dev/null 2>&1; then
  progress 95 "Refreshing app menu..."
  sudo update-desktop-database "$APPS" 2>/dev/null || true
fi

progress 100 "Uninstall complete."
echo "llamacpp droid has been removed. Your clone (if any) is unchanged."
echo ""
[ -t 0 ] && read -r -p "Press Enter to close..."
