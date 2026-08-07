#!/usr/bin/env bash
# Remove macOS quarantine flags from npm native binaries (.node files).
# Without this, Gatekeeper blocks tailwindcss-oxide, lightningcss, next-swc, etc.
# when launched from a .app or after downloading via browser/npm.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../frontend" && pwd)"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "No node_modules found. Run: cd frontend && npm install"
  exit 1
fi

count=0
while IFS= read -r -d '' file; do
  if xattr -l "$file" 2>/dev/null | grep -q com.apple.quarantine; then
    xattr -d com.apple.quarantine "$file" 2>/dev/null || xattr -cr "$file" 2>/dev/null || true
    (( count++ )) || true
  fi
done < <(find "$FRONTEND_DIR/node_modules" -name "*.node" -print0 2>/dev/null)

# Clear provenance on the whole native-modules tree (harmless, helps some Gatekeeper cases)
xattr -cr "$FRONTEND_DIR/node_modules/@tailwindcss" 2>/dev/null || true
xattr -cr "$FRONTEND_DIR/node_modules/lightningcss-darwin-arm64" 2>/dev/null || true
xattr -cr "$FRONTEND_DIR/node_modules/next" 2>/dev/null || true

echo "Cleared quarantine on $count native binary(ies)."
