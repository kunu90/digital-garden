#!/usr/bin/env bash
# Vendor Pajamas CSS design tokens from @gitlab/ui without adding it as a dependency.
set -euo pipefail

VERSION="${1:-135.1.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/styles/pajamas"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Packing @gitlab/ui@${VERSION}…"
cd "$TMP"
npm pack "@gitlab/ui@${VERSION}" --silent
TGZ=(gitlab-ui-*.tgz)
tar -xzf "$TGZ" package/src/tokens/build/css/tokens.css package/src/tokens/build/css/tokens.dark.css

mkdir -p "$OUT"
cp package/src/tokens/build/css/tokens.css "$OUT/tokens.css"
cp package/src/tokens/build/css/tokens.dark.css "$OUT/tokens.dark.css"

# next-themes uses class="dark" on <html>, not gl-dark
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' 's/:root\.gl-dark, \.gl-dark-scope/.dark, .dark .gl-dark-scope/g' "$OUT/tokens.dark.css"
else
  sed -i 's/:root\.gl-dark, \.gl-dark-scope/.dark, .dark .gl-dark-scope/g' "$OUT/tokens.dark.css"
fi

echo "Vendored tokens → $OUT (version $VERSION)"
echo "Update frontend/styles/pajamas/README.md pinned version if you changed it."
