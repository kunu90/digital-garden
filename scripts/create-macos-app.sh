#!/usr/bin/env bash
# Build a double-clickable Digital Garden.app on macOS.
# This is a real application bundle (bash executable), not an AppleScript
# applet — AppleScript .app files often open in Script Editor instead of launching.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="Digital Garden"
APP_PATH="$PROJECT_ROOT/$APP_NAME.app"
DESKTOP_APP="$HOME/Desktop/$APP_NAME.app"

chmod +x "$SCRIPT_DIR/launch-digital-garden.sh"
chmod +x "$SCRIPT_DIR/open-digital-garden.sh"
chmod +x "$SCRIPT_DIR/stop-digital-garden.sh"

ICON_TMP=""
if [[ -f "$APP_PATH/Contents/Resources/applet.icns" ]]; then
  ICON_TMP="$(mktemp /tmp/digital-garden-icon.XXXXXX.icns)"
  cp "$APP_PATH/Contents/Resources/applet.icns" "$ICON_TMP"
elif [[ -f "$APP_PATH/Contents/Resources/AppIcon.icns" ]]; then
  ICON_TMP="$(mktemp /tmp/digital-garden-icon.XXXXXX.icns)"
  cp "$APP_PATH/Contents/Resources/AppIcon.icns" "$ICON_TMP"
fi

rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"

if [[ -n "$ICON_TMP" && -f "$ICON_TMP" ]]; then
  cp "$ICON_TMP" "$APP_PATH/Contents/Resources/AppIcon.icns"
  rm -f "$ICON_TMP"
fi

cat >"$APP_PATH/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>Digital Garden</string>
	<key>CFBundleExecutable</key>
	<string>DigitalGarden</string>
	<key>CFBundleIconFile</key>
	<string>AppIcon</string>
	<key>CFBundleIdentifier</key>
	<string>com.digitalgarden.launcher</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>Digital Garden</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSMinimumSystemVersion</key>
	<string>12.0</string>
	<key>LSUIElement</key>
	<true/>
	<key>NSHighResolutionCapable</key>
	<true/>
</dict>
</plist>
PLIST

printf 'APPL????' >"$APP_PATH/Contents/PkgInfo"

LAUNCHER_C="$(mktemp /tmp/digital-garden-launcher.XXXXXX.c)"
# C string escape for the baked project path
BAKED_C="${PROJECT_ROOT//\\/\\\\}"
BAKED_C="${BAKED_C//\"/\\\"}"

cat >"$LAUNCHER_C" <<EOF
#include <limits.h>
#include <mach-o/dyld.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

static int exists(const char *path) {
  struct stat st;
  return path && path[0] && stat(path, &st) == 0;
}

int main(void) {
  char exe[PATH_MAX];
  uint32_t size = sizeof(exe);
  char relative[PATH_MAX];
  const char *baked = "${BAKED_C}/scripts/open-digital-garden.sh";
  const char *script = baked;

  if (_NSGetExecutablePath(exe, &size) == 0) {
    snprintf(relative, sizeof(relative), "%s/../../../scripts/open-digital-garden.sh", exe);
    if (exists(relative)) {
      script = relative;
    }
  }

  if (!exists(script)) {
    return 127;
  }

  execl("/bin/bash", "bash", script, (char *)0);
  return 127;
}
EOF

clang -Os -o "$APP_PATH/Contents/MacOS/DigitalGarden" "$LAUNCHER_C"
rm -f "$LAUNCHER_C"
chmod +x "$APP_PATH/Contents/MacOS/DigitalGarden"
codesign --force --sign - "$APP_PATH" >/dev/null 2>&1 || true

xattr -cr "$APP_PATH" 2>/dev/null || true

if [[ -d "$HOME/Desktop" ]]; then
  if rm -rf "$DESKTOP_APP" && ditto "$APP_PATH" "$DESKTOP_APP"; then
    xattr -cr "$DESKTOP_APP" 2>/dev/null || true
  else
    echo "Note: could not install a Desktop shortcut (permission denied)."
  fi
fi

echo "Created: $APP_PATH"
if [[ -d "$DESKTOP_APP" ]]; then
  echo "Installed Desktop shortcut: $DESKTOP_APP"
fi
echo ""
echo "Double-click '$APP_NAME.app' to start Digital Garden in your browser."
echo "To stop: run scripts/stop-digital-garden.sh"
echo ""
echo "Do not open the app with Script Editor — it is a launcher, not a script."
