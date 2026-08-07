#!/usr/bin/env bash
# Entry point for Digital Garden.app — returns immediately (no hang).
# The real work runs in launch-digital-garden.sh via nohup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$PROJECT_ROOT/.run"
LAUNCHER="$SCRIPT_DIR/launch-digital-garden.sh"
LAUNCHER_LOG="$RUN_DIR/launcher.log"
BACKEND_URL="http://127.0.0.1:8000"

backend_graph_ok() {
  curl -fsS "$BACKEND_URL/graph" >/dev/null 2>&1
}

find_frontend_url() {
  local port
  for port in 3000 3003 3002; do
    if curl -fsS "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      echo "http://127.0.0.1:${port}"
      return 0
    fi
  done
  return 1
}

mkdir -p "$RUN_DIR"
export HOME="${HOME:-$(eval echo ~$(id -un))}"

FRONTEND_URL="$(find_frontend_url 2>/dev/null || echo "http://127.0.0.1:3000")"

# Backend healthy but graph broken (stale process) — full restart.
if curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1 && ! backend_graph_ok; then
  bash "$SCRIPT_DIR/stop-digital-garden.sh" >/dev/null 2>&1 || true
  sleep 1
fi

# If already running, just open the browser.
if curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1 && curl -fsS "$FRONTEND_URL" >/dev/null 2>&1 && backend_graph_ok; then
  open "$FRONTEND_URL"
  osascript -e 'display notification "Digital Garden is already running" with title "Digital Garden"' 2>/dev/null || true
  exit 0
fi

# If a previous launch is still in progress, don't stack another.
LOCK="$RUN_DIR/launcher.lock"
if [[ -f "$LOCK" ]]; then
  lock_pid="$(cat "$LOCK" 2>/dev/null || true)"
  if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
    osascript -e 'display notification "Digital Garden is already starting…" with title "Digital Garden"' 2>/dev/null || true
    exit 0
  fi
  rm -f "$LOCK"
fi

# Backend up but frontend down — allow a retry (e.g. after Turbopack crash).
if curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1 && ! curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
  rm -f "$LOCK"
fi

nohup bash "$LAUNCHER" >>"$LAUNCHER_LOG" 2>&1 &
disown

osascript -e 'display notification "Starting Digital Garden…" with title "Digital Garden"' 2>/dev/null || true
