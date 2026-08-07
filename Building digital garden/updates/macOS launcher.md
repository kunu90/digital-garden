# macOS launcher

*06-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

Shipped **double-click launch** on macOS so Digital Garden opens like a normal app—not two terminal windows.

## Problem

Requiring `uvicorn` + `npm run dev` every session is engineer-only UX. The launcher *is* the product for a local-first tool.

## What shipped

- `Digital Garden.app` + `scripts/launch-digital-garden.sh`, `open-digital-garden.sh`, `stop-digital-garden.sh`
- `fix-macos-native-binaries.sh` (Gatekeeper / quarantine on npm `.node` files)
- Frontend dev via **webpack** (fewer GUI permission errors than Turbopack)

## Why this way

| Decision | Intention |
|----------|-----------|
| Non-blocking `.app` wrapper | Finder must not hang while servers boot |
| Port recycling in scripts | Crashed runs shouldn’t block the next launch |
| `bootstrap_path()` for GUI | `npm`/`uv` visible when opened from Finder, not only Terminal |

## What I learned

On macOS, **Terminal launch ≠ Finder launch**. Test the way you’ll actually open the app.

## Test notes

- [ ] Double-click app → browser opens → vault onboarding works
- [ ] Stop script frees ports 3000 and 8000
