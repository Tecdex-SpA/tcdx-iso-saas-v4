#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEMO_VISUAL_COMPLETION_CHECK=1 bash "$SCRIPT_DIR/check-demo-tenant-postgres.sh"
