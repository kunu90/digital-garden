#!/usr/bin/env bash
# Build a double-clickable Digital Garden.app on macOS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAUNCHER="$SCRIPT_DIR/launch-digital-garden.sh"
WRAPPER="$SCRIPT_DIR/open-digital-garden.sh"
APP_NAME="Digital Garden"
APP_PATH="$PROJECT_ROOT/$APP_NAME.app"
APPLESCRIPT="/tmp/digital-garden-launcher.applescript"

chmod +x "$SCRIPT_DIR/launch-digital-garden.sh"
chmod +x "$SCRIPT_DIR/open-digital-garden.sh"
chmod +x "$SCRIPT_DIR/stop-digital-garden.sh"

cat >"$APPLESCRIPT" <<EOF
on run
  do shell script "bash " & quoted form of "$WRAPPER"
end run
EOF

rm -rf "$APP_PATH"
osacompile -o "$APP_PATH" "$APPLESCRIPT"
rm -f "$APPLESCRIPT"

echo "Created: $APP_PATH"
echo ""
echo "Double-click '$APP_NAME.app' in Finder to start Digital Garden."
echo "To stop: run scripts/stop-digital-garden.sh"
echo ""
echo "Tip: Drag the .app to your Dock for one-click launch."
