# Digital Garden — macOS Launcher

## Quick start

```bash
# One-time: make scripts executable and create the .app
chmod +x scripts/*.sh
./scripts/create-macos-app.sh
```

Then **double-click `Digital Garden.app`** in the project folder, on the Desktop, or in the Dock.

The `.app` is a real macOS launcher (not an AppleScript). It starts the servers and opens the app in your browser. Do not open it with Script Editor.

If you move only the `.app` to the Desktop, rebuild with `./scripts/create-macos-app.sh` so the shortcut still points at this repo.

## What the launcher does

1. Installs `uv` if missing (Python package manager)
2. Runs `uv sync` to create/repair `backend/.venv` automatically
3. Starts backend (port 8000) and frontend (port 3000, **webpack** — avoids Turbopack permission errors from `.app`) in the background
4. Opens http://localhost:3000 in your browser

Logs: `.run/backend.log`, `.run/frontend.log`, and `.run/launcher.log`

## Stop the app

```bash
./scripts/stop-digital-garden.sh
```

## Manual launch (without .app)

```bash
./scripts/launch-digital-garden.sh
```

## Requirements

- macOS
- Node.js (`npm` on PATH)
- `backend/.env` with `ANTHROPIC_API_KEY` set
- Python 3.12+ (installed automatically by `uv` on first run, or via `brew install python@3.12`)

## macOS: "cannot verify … is free of malware"

npm native binaries (Tailwind, lightningcss, Next.js SWC) are **not malware** — macOS blocks them because they are unsigned and marked with a **quarantine** flag after download.

**Fix (run once after `npm install`):**

```bash
./scripts/fix-macos-native-binaries.sh
```

The launcher runs this automatically. If macOS still blocks, go to **System Settings → Privacy & Security** and click **Allow Anyway** for the blocked binary, then relaunch.

## Does this fix the broken venv?

**Yes — on every launch** the script runs `uv sync`, which recreates `.venv` if it's broken or missing. You don't need to fix the venv manually anymore.
