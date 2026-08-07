#!/usr/bin/env bash
# Stop everything and relaunch Digital Garden (use when graph or backend seems stuck).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/stop-digital-garden.sh"
sleep 1
bash "$SCRIPT_DIR/open-digital-garden.sh"
