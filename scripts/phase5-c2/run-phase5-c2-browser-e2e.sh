#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
mkdir -p "$REPO_ROOT/artifacts/phase5-c2"
PHASE5_5_PLAYWRIGHT_CONFIG="playwright.phase5-c2.config.ts" \
PHASE5_5_E2E_RESULTS_FILE="../artifacts/phase5-c2/browser-e2e-results.json" \
PHASE5_5_PLAYWRIGHT_REPORT_DIR="../artifacts/phase5-c2/playwright-report" \
PHASE5_5_EVIDENCE_FILE="$REPO_ROOT/docs/final-phases/semantic/12_browser_e2e_evidence.md" \
PHASE5_5_EVIDENCE_WRITER="$SCRIPT_DIR/write-phase5-c2-browser-evidence.js" \
bash "$REPO_ROOT/scripts/phase5-5/run-phase5-5-browser-e2e.sh"
