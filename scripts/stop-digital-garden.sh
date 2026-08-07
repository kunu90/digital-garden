#!/usr/bin/env bash
# Stop Digital Garden backend and frontend started by launch-digital-garden.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$PROJECT_ROOT/.run"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"

stop_pid_file() {
  local pid_file="$1"
  local name="$2"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    echo "Stopped $name (pid $pid)"
  fi
  rm -f "$pid_file"
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
    # Backend: uvicorn via uv/python on localhost:8000
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
    echo "Freed port $port (pid $pid)"
  fi
}

stop_pid_file "$FRONTEND_PID" "frontend"
stop_pid_file "$BACKEND_PID" "backend"
free_project_port 3000
free_project_port 8000

if [[ -f "$RUN_DIR/launcher.lock" ]]; then
  lock_pid="$(cat "$RUN_DIR/launcher.lock" 2>/dev/null || true)"
  if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
    kill "$lock_pid" 2>/dev/null || true
    echo "Stopped launcher (pid $lock_pid)"
  fi
fi
rm -f "$RUN_DIR/launcher.lock"

osascript -e 'display notification "Digital Garden stopped" with title "Digital Garden"' 2>/dev/null || true
