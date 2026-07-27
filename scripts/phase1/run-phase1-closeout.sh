#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_HOST="${PHASE1_QA_HOST:-tecdex@bk-v4.tcdx.int}"
REMOTE_REPO="${PHASE1_QA_REMOTE_REPO:-/home/tecdex/tcdx-iso-saas-v4}"
ENV_FILE="${PHASE1_QA_ENV_FILE:-$HOME/.config/tcdx/phase1-runtime-qa.env}"
REMOTE_ENV_FILE="${PHASE1_QA_REMOTE_ENV_FILE:-/home/tecdex/.config/tcdx/phase1-runtime-qa.env}"
MODE="${1:---vm}"

if [[ "$MODE" == "--remote" ]]; then
  expected_sha="${DEPLOYED_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
  run_id="${PHASE1_QA_RUN_ID:-phase1-${expected_sha:0:12}-$(date -u +%Y%m%dT%H%M%SZ)}"
  remote_evidence="${PHASE1_REMOTE_EVIDENCE_DIR:-/tmp/tcdx-phase1-evidence/$run_id}"
  local_evidence="${PHASE1_LOCAL_EVIDENCE_DIR:-/tmp/tcdx-phase1-evidence/$run_id}"
  remote_status=0
  if ssh "$REMOTE_HOST" "cd '$REMOTE_REPO' && DEPLOYED_SHA='$expected_sha' PHASE1_QA_RUN_ID='$run_id' PHASE1_QA_ENV_FILE='$REMOTE_ENV_FILE' PHASE1_EVIDENCE_DIR='$remote_evidence' bash scripts/phase1/run-phase1-closeout.sh --vm"; then
    remote_status=0
  else
    remote_status=$?
  fi
  mkdir -p "$(dirname "$local_evidence")"
  rm -rf "$local_evidence"
  scp -r "$REMOTE_HOST:$remote_evidence" "$local_evidence"
  echo "Phase 1 evidence copied to: $local_evidence"
  exit "$remote_status"
fi
if [[ "$MODE" != "--vm" ]]; then
  echo "Usage: PHASE1_QA_ENV_FILE=/protected/file $0 [--vm|--remote]" >&2
  exit 2
fi
if [[ ! -r "$ENV_FILE" ]]; then
  echo "Phase 1 closeout requires readable protected environment file: $ENV_FILE" >&2
  exit 1
fi
permissions="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE")"
if [[ "$permissions" != "600" ]]; then
  echo "Phase 1 closeout environment file must have mode 600 (actual: $permissions)" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a
cd "$ROOT_DIR"

DEPLOYED_SHA="${DEPLOYED_SHA:-$(git rev-parse HEAD)}"
current_sha="$(git rev-parse HEAD)"
if [[ ! "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ || "$current_sha" != "$DEPLOYED_SHA" ]]; then
  echo "Deployed SHA mismatch: expected=$DEPLOYED_SHA current=$current_sha" >&2
  exit 1
fi

PHASE1_QA_RUN_ID="${PHASE1_QA_RUN_ID:-phase1-${DEPLOYED_SHA:0:12}-$(date -u +%Y%m%dT%H%M%SZ)}"
PHASE1_QA_MANIFEST="$ROOT_DIR/artifacts/fase-1/phase1-qa-manifest.json"
PHASE1_QA_CLEANUP_REPORT="$ROOT_DIR/artifacts/fase-1/phase1-cleanup-result.json"
PHASE1_API_BASE_URL="${PHASE1_API_BASE_URL:-${API_BASE_URL:-}}"
PHASE1_TENANT_ID="${PHASE1_TENANT_ID:-${E2E_TENANT_A_ID:-}}"
PHASE1_QA_ENV=qa
export DEPLOYED_SHA PHASE1_QA_RUN_ID PHASE1_QA_MANIFEST PHASE1_QA_CLEANUP_REPORT
export PHASE1_API_BASE_URL PHASE1_TENANT_ID PHASE1_QA_ENV

EVIDENCE_DIR="${PHASE1_EVIDENCE_DIR:-/tmp/tcdx-phase1-evidence/$PHASE1_QA_RUN_ID}"
mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"
stage=preflight
cleanup_completed=false

preserve_evidence() {
  mkdir -p "$EVIDENCE_DIR"
  for item in artifacts/fase-1/e2e-results.json artifacts/fase-1/phase1-targeted-results.json \
    artifacts/fase-1/phase1-runtime-summary.json artifacts/fase-1/phase1-closeout-evidence.md \
    artifacts/fase-1/phase1-cleanup-result.json artifacts/fase-1/phase1-qa-manifest.json; do
    [[ -e "$item" ]] && cp -R "$item" "$EVIDENCE_DIR/"
  done
  [[ -d artifacts/fase-1/phase1-targeted-playwright-report ]] && cp -R artifacts/fase-1/phase1-targeted-playwright-report "$EVIDENCE_DIR/"
  [[ -d artifacts/fase-1/phase1-playwright-report ]] && cp -R artifacts/fase-1/phase1-playwright-report "$EVIDENCE_DIR/"
  [[ -d frontend/test-results ]] && cp -R frontend/test-results "$EVIDENCE_DIR/"
}

cleanup_database() {
  if [[ ! -f "$PHASE1_QA_MANIFEST" ]]; then return 0; fi
  PHASE1_QA_CONFIRM="CLEAN_PHASE1_QA:$PHASE1_QA_RUN_ID" node scripts/phase1/cleanup-phase1-qa.js
  cleanup_completed=true
}

clean_worktree_artifacts() {
  mapfile -t tracked_artifacts < <(git ls-files artifacts/fase-1)
  if (( ${#tracked_artifacts[@]} > 0 )); then
    git restore --worktree -- "${tracked_artifacts[@]}"
  fi
  rm -rf artifacts/fase-1/phase1-targeted-results.json artifacts/fase-1/phase1-targeted-playwright-report \
    artifacts/fase-1/e2e-results.json artifacts/fase-1/phase1-playwright-report \
    artifacts/fase-1/phase1-runtime-summary.json artifacts/fase-1/phase1-api-results.json \
    artifacts/fase-1/phase1-export-validation.json artifacts/fase-1/phase1-tenant-isolation.json \
    artifacts/fase-1/phase1-scheduler-results.json artifacts/fase-1/phase1-observability.txt \
    artifacts/fase-1/phase1-closeout-evidence.md artifacts/fase-1/phase1-cleanup-result.json \
    artifacts/fase-1/phase1-qa-manifest.json frontend/test-results
}

on_error() {
  code=$?
  trap - ERR
  preserve_evidence
  if [[ -f "$PHASE1_QA_MANIFEST" && "$cleanup_completed" != true ]]; then
    if cleanup_database; then
      preserve_evidence
      clean_worktree_artifacts
      echo "Phase 1 cleanup completed after failure at stage: $stage" >&2
    else
      echo "Phase 1 cleanup also failed; manifest preserved at $PHASE1_QA_MANIFEST" >&2
      preserve_evidence
    fi
  fi
  printf '{"status":"FAILED","stage":"%s","exit_code":%d,"sha":"%s","run_id":"%s"}\n' \
    "$stage" "$code" "$DEPLOYED_SHA" "$PHASE1_QA_RUN_ID" > "$EVIDENCE_DIR/phase1-closeout-result.json"
  echo "Phase 1 closeout failed at stage: $stage" >&2
  exit "$code"
}
trap on_error ERR

if [[ -f "$PHASE1_QA_MANIFEST" ]]; then
  echo "An earlier manifest exists. Clean that run explicitly before starting a new closeout: $PHASE1_QA_MANIFEST" >&2
  exit 1
fi

stage=environment
node scripts/phase1/check-phase1-runtime-env.js --allow-missing-manifest

stage=prepare
PHASE1_QA_CONFIRM=PREPARE_PHASE1_QA node scripts/phase1/prepare-phase1-runtime-qa.js
stage=bootstrap
PHASE1_QA_CONFIRM=PREPARE_PHASE1_QA PHASE1_IDEMPOTENCY_KEY="phase1-$PHASE1_QA_RUN_ID" node scripts/phase1/bootstrap-tenant-grc.js
stage=seed
PHASE1_QA_CONFIRM=PREPARE_PHASE1_QA node scripts/phase1/seed-phase1-qa.js
node scripts/phase1/check-phase1-runtime-env.js

stage=fixture-preflight
node scripts/phase1/verify-phase1-runtime-fixtures.js

stage=targeted-e2e
export PHASE1_E2E_PASS=targeted
export PHASE1_E2E_RESULTS_FILE=../artifacts/fase-1/phase1-targeted-results.json
export PHASE1_PLAYWRIGHT_REPORT_DIR=../artifacts/fase-1/phase1-targeted-playwright-report
npm --prefix frontend run test:e2e:phase1 -- --grep 'administrador crea workflow válido|administrador publica versión|evidencia recurrente|instancia operada desde la web|workflow editado desde la web|evidencia operada desde la web|mapping operado desde la web|auditoría operada desde la web|vista consolidada carga sin errores'
node scripts/phase1/check-playwright-result.js artifacts/fase-1/phase1-targeted-results.json 13

stage=full-e2e
export PHASE1_E2E_PASS=full
export PHASE1_E2E_RESULTS_FILE=../artifacts/fase-1/e2e-results.json
export PHASE1_PLAYWRIGHT_REPORT_DIR=../artifacts/fase-1/phase1-playwright-report
npm run phase1:runtime-check
node scripts/phase1/check-playwright-result.js artifacts/fase-1/e2e-results.json 30

stage=evidence
node scripts/phase1/write-phase1-runtime-evidence.js
stage=cleanup
cleanup_database
preserve_evidence

stage=worktree-cleanup
clean_worktree_artifacts

status="$(git status --short)"
if [[ -n "$status" ]]; then
  echo "Phase 1 closeout left the VM worktree dirty:" >&2
  printf '%s\n' "$status" >&2
  exit 1
fi

printf '{"status":"VERIFIED_RUNTIME","sha":"%s","run_id":"%s","targeted":13,"full":30,"cleanup":"CLEANED","git":"clean"}\n' \
  "$DEPLOYED_SHA" "$PHASE1_QA_RUN_ID" > "$EVIDENCE_DIR/phase1-closeout-result.json"
cat > "$EVIDENCE_DIR/phase1-closeout-result.md" <<EOF
# Phase 1 closeout

- Status: VERIFIED_RUNTIME
- SHA: $DEPLOYED_SHA
- Run: $PHASE1_QA_RUN_ID
- Targeted E2E: 13/13
- Full E2E: 30/30
- Cleanup: completed
- Repository: clean
EOF
trap - ERR
echo "Phase 1 closeout verified. Evidence: $EVIDENCE_DIR"
