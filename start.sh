#!/usr/bin/env bash
# Start the app in the background so no terminal window stays visible.
# Only the Electron window is shown.
ROOT="$(cd "$(dirname "$0")" && pwd)"
[ -f "$ROOT/banner.txt" ] && cat "$ROOT/banner.txt" && echo
cd "$ROOT/systems/llamacpp-log-viewer" || exit 1
nohup npm start </dev/null >/dev/null 2>&1 &
disown
echo "App starting..."
echo ""
[ -t 0 ] && read -r -p "Press Enter to close..."
exit 0
