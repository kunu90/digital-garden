#!/usr/bin/env bash
# Launch Digital Garden (backend + frontend) and open the browser.
# Also repairs the Python venv via `uv sync` when needed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
RUN_DIR="$PROJECT_ROOT/.run"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:3000"
LOCK="$RUN_DIR/launcher.lock"

notify() {
  osascript -e "display notification \"$1\" with title \"Digital Garden\"" 2>/dev/null || true
}

alert() {
  osascript -e "display alert \"Digital Garden\" message \"$1\" as critical" 2>/dev/null || echo "ERROR: $1"
}

bootstrap_path() {
  # GUI-launched .app bundles get a minimal PATH; add common tool locations.
  local dir
  for dir in \
    "/opt/homebrew/bin" \
    "/opt/homebrew/sbin" \
    "/usr/local/bin" \
    "/usr/local/sbin" \
    "$HOME/.local/bin" \
    "$HOME/.cargo/bin" \
    "/opt/pmk/env/global/bin"
  do
    if [[ -d "$dir" ]]; then
      case ":$PATH:" in
        *":$dir:"*) ;;
        *) export PATH="$dir:$PATH" ;;
      esac
    fi
  done

  # nvm
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
  fi

  # fnm
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  fi
}

ensure_node() {
  bootstrap_path

  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  for candidate in \
    "/usr/local/bin/npm" \
    "/opt/homebrew/bin/npm" \
    "$HOME/.nvm/versions/node/"*/bin/npm
  do
    if [[ -x "$candidate" ]]; then
      export PATH="$(dirname "$candidate"):$PATH"
      return 0
    fi
  done

  alert "npm was not found in PATH.\n\nNode.js may be installed but not visible to GUI apps. Try:\n  brew install node\nor install from https://nodejs.org\n\nThen launch again."
  exit 1
}

ensure_uv() {
  bootstrap_path

  if command -v uv >/dev/null 2>&1; then
    return 0
  fi

  for candidate in "$HOME/.local/bin/uv" "$HOME/.cargo/bin/uv" "/opt/homebrew/bin/uv" "/usr/local/bin/uv"; do
    if [[ -x "$candidate" ]]; then
      export PATH="$(dirname "$candidate"):$PATH"
      return 0
    fi
  done

  notify "Installing uv (Python package manager)…"
  if ! curl -LsSf https://astral.sh/uv/install.sh | sh; then
    alert "Could not install uv automatically. Install it manually:\n\ncurl -LsSf https://astral.sh/uv/install.sh | sh\n\nThen run this launcher again."
    exit 1
  fi
  export PATH="$HOME/.local/bin:$PATH"

  if ! command -v uv >/dev/null 2>&1; then
    alert "uv was installed but is not on PATH. Add ~/.local/bin to your PATH and try again."
    exit 1
  fi
}

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

pid_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stop_if_running() {
  local pid_file="$1"
  local name="$2"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if pid_alive "$pid"; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      notify "Stopped existing $name"
    fi
    rm -f "$pid_file"
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local i=0
  while (( i < attempts )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    (( i++ )) || true
  done
  return 1
}

# Kill a listener on port if it looks like our stack (orphan from crashed launcher).
free_project_port() {
  local port="$1"
  local pid
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  [[ -z "$pid" ]] && return 0

  local cmd=""
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"

  local ours=0
  if [[ "$port" == "8000" ]]; then
    if [[ "$cmd" == *python* ]] || [[ "$cmd" == *uvicorn* ]] || [[ "$cmd" == *digital-garden* ]]; then
      ours=1
    elif curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
      ours=1
    fi
  elif [[ "$port" == "3000" ]]; then
    if [[ "$cmd" == *node* ]] || [[ "$cmd" == *next* ]] || [[ "$cmd" == *digital-garden* ]]; then
      ours=1
    fi
  fi

  if (( ours )); then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    notify "Freed port $port from previous run"
    rm -f "$BACKEND_PID" "$FRONTEND_PID"
  fi
}

recycle_ports() {
  if port_in_use 8000; then
    if [[ -f "$BACKEND_PID" ]] && pid_alive "$(cat "$BACKEND_PID")"; then
      stop_if_running "$BACKEND_PID" "backend"
    else
      free_project_port 8000
    fi
  fi

  if port_in_use 8000; then
    alert "Port 8000 is in use by another app (not Digital Garden).\n\nStop that app manually, then launch again."
    exit 1
  fi

  if port_in_use 3000; then
    if [[ -f "$FRONTEND_PID" ]] && pid_alive "$(cat "$FRONTEND_PID")"; then
      stop_if_running "$FRONTEND_PID" "frontend"
    else
      free_project_port 3000
    fi
  fi

  if port_in_use 3000; then
    alert "Port 3000 is in use by another app (not Digital Garden).\n\nStop that app manually, then launch again."
    exit 1
  fi
}

mkdir -p "$RUN_DIR"
export HOME="${HOME:-$(eval echo ~$(id -un))}"
export TMPDIR="$RUN_DIR/tmp"
mkdir -p "$TMPDIR"
echo $$ >"$LOCK"
trap 'rm -f "$LOCK"' EXIT

# Already running — open browser and exit.
if curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1 && curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
  open "$FRONTEND_URL"
  notify "Digital Garden is already running"
  exit 0
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  if [[ -f "$BACKEND_DIR/.env.example" ]]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    alert "Created backend/.env from .env.example.\n\nAdd your ANTHROPIC_API_KEY to:\n$BACKEND_DIR/.env\n\nThen launch again."
    exit 1
  fi
  alert "Missing backend/.env. Create it and add ANTHROPIC_API_KEY before launching."
  exit 1
fi

ensure_node
ensure_uv

bash "$SCRIPT_DIR/fix-macos-native-binaries.sh" 2>/dev/null || true

notify "Setting up Python environment (uv sync)…"
if ! (cd "$BACKEND_DIR" && uv sync); then
  alert "Failed to set up the backend environment.\n\nIf Python 3.12+ is missing, run:\n  brew install python@3.12\n\nThen launch again."
  exit 1
fi

# Reclaim ports from previous / crashed runs.
recycle_ports

notify "Starting backend…"
(
  cd "$BACKEND_DIR"
  exec uv run uvicorn main:app --host 127.0.0.1 --port 8000
) >>"$BACKEND_LOG" 2>&1 &
echo $! >"$BACKEND_PID"

notify "Starting frontend…"
(
  cd "$FRONTEND_DIR"
  # Webpack avoids Turbopack "Permission denied" when launched from a GUI .app
  exec npm run dev:webpack -- --hostname 127.0.0.1 --port 3000
) >>"$FRONTEND_LOG" 2>&1 &
echo $! >"$FRONTEND_PID"

if ! wait_for_url "$BACKEND_URL/health" "backend" 90; then
  alert "Backend failed to start. Check the log:\n$BACKEND_LOG"
  exit 1
fi

if ! wait_for_url "$FRONTEND_URL" "frontend" 120; then
  alert "Frontend failed to start. Check the log:\n$FRONTEND_LOG"
  exit 1
fi

open "$FRONTEND_URL"
notify "Digital Garden is running"
