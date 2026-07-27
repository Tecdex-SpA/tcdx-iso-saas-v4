#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_HOST="${PHASE2_QA_HOST:-tecdex@bk-v4.tcdx.int}"
REMOTE_REPO="${PHASE2_QA_REMOTE_REPO:-/home/tecdex/tcdx-iso-saas-v4}"
MODE="${1:---vm}"

if [[ "$MODE" == "--remote" ]]; then
  expected_sha="${DEPLOYED_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
  run_id="${PHASE2_QA_RUN_ID:-phase2-${expected_sha:0:12}-$(date -u +%Y%m%dT%H%M%SZ)}"
  remote_evidence="${PHASE2_REMOTE_EVIDENCE_DIR:-/tmp/tcdx-phase2-evidence/$run_id}"
  local_evidence="${PHASE2_LOCAL_EVIDENCE_DIR:-/tmp/tcdx-phase2-evidence/$run_id}"
  remote_status=0
  if ssh "$REMOTE_HOST" "cd '$REMOTE_REPO' && DEPLOYED_SHA='$expected_sha' PHASE2_QA_RUN_ID='$run_id' PHASE2_EVIDENCE_DIR='$remote_evidence' bash scripts/phase2/run-phase2-closeout.sh --vm"; then
    remote_status=0
  else
    remote_status=$?
  fi
  mkdir -p "$(dirname "$local_evidence")"
  if [[ -e "$local_evidence" ]]; then
    echo "Local Phase 2 evidence path already exists: $local_evidence" >&2
    exit 1
  fi
  scp -r "$REMOTE_HOST:$remote_evidence" "$local_evidence"
  echo "Phase 2 evidence copied to: $local_evidence"
  exit "$remote_status"
fi

if [[ "$MODE" != "--vm" ]]; then
  echo "Usage: $0 [--vm|--remote]" >&2
  exit 2
fi

cd "$ROOT_DIR"
DEPLOYED_SHA="${DEPLOYED_SHA:-$(git rev-parse HEAD)}"
current_sha="$(git rev-parse HEAD)"
if [[ ! "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ || "$current_sha" != "$DEPLOYED_SHA" ]]; then
  echo "Deployed SHA mismatch: expected=$DEPLOYED_SHA current=$current_sha" >&2
  exit 1
fi

BASE_RUN_ID="${PHASE2_QA_RUN_ID:-phase2-${DEPLOYED_SHA:0:12}-$(date -u +%Y%m%dT%H%M%SZ)}"
EVIDENCE_DIR="${PHASE2_EVIDENCE_DIR:-/tmp/tcdx-phase2-evidence/$BASE_RUN_ID}"
PROTECTED_DIR="/home/tecdex/.config/tcdx"
PHASE2_QA_ENV_FILE="$PROTECTED_DIR/phase2-runtime-qa.env"
PHASE2_QA_RESTORE_FILE="$PROTECTED_DIR/phase2-runtime-qa-restore.json"
mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

stage=credentials
credentials_created=false
credentials_restored=false

restore_credentials() {
  if [[ "$credentials_created" == true && "$credentials_restored" != true ]]; then
    PHASE2_QA_CONFIRM=RESTORE_PHASE2_QA_CREDENTIALS \
      PHASE2_QA_RUN_ID="$BASE_RUN_ID" \
      PHASE2_QA_ENV_FILE="$PHASE2_QA_ENV_FILE" \
      PHASE2_QA_RESTORE_FILE="$PHASE2_QA_RESTORE_FILE" \
      node scripts/phase2/restore-phase2-runtime-credentials.js
    credentials_restored=true
  fi
}

cleanup_phase2_manifest() {
  local manifest="$1"
  local run="$2"
  local report="$3"
  [[ -f "$manifest" ]] || return 0
  PHASE2_QA_ENV=qa PHASE2_TENANT_ID="$E2E_TENANT_A_ID" \
    PHASE2_QA_MANIFEST="$manifest" PHASE2_QA_CLEANUP_REPORT="$report" \
    PHASE2_QA_CONFIRM="CLEAN_PHASE2_QA:$run" node scripts/phase2/cleanup-phase2-qa.js
}

cleanup_phase1_manifest() {
  local manifest="$1"
  local run="$2"
  local report="$3"
  [[ -f "$manifest" ]] || return 0
  PHASE1_QA_ENV=qa PHASE1_TENANT_ID="$E2E_TENANT_A_ID" \
    PHASE1_QA_MANIFEST="$manifest" PHASE1_QA_CLEANUP_REPORT="$report" \
    PHASE1_QA_CONFIRM="CLEAN_PHASE1_QA:$run" node scripts/phase1/cleanup-phase1-qa.js
}

clean_generated() {
  rm -f artifacts/fase-2/phase2-qa-manifest.json \
    artifacts/fase-2/phase2-targeted-results.json artifacts/fase-2/phase2-full-results.json \
    artifacts/fase-2/phase2-cleanup-result.json artifacts/fase-2/phase2-cleanup-second.json \
    artifacts/fase-1/phase1-qa-manifest.json artifacts/fase-1/phase1-prerequisite-results.json \
    artifacts/fase-1/phase1-cleanup-result.json \
    artifacts/fase-1/phase1-cleanup-second.json
  rm -rf artifacts/fase-2/phase2-targeted-playwright-report \
    artifacts/fase-2/phase2-full-playwright-report \
    artifacts/fase-1/phase1-prerequisite-playwright-report frontend/test-results
}

on_error() {
  local code="${1:-$?}"
  trap - ERR
  set +e
  if [[ -n "${PHASE2_QA_MANIFEST:-}" && -f "${PHASE2_QA_MANIFEST:-}" ]]; then
    cleanup_phase2_manifest "$PHASE2_QA_MANIFEST" "$PHASE2_QA_RUN_ID" "$EVIDENCE_DIR/failure-phase2-cleanup.json"
  fi
  if [[ -n "${PHASE1_QA_MANIFEST:-}" && -f "${PHASE1_QA_MANIFEST:-}" ]]; then
    cleanup_phase1_manifest "$PHASE1_QA_MANIFEST" "$PHASE1_QA_RUN_ID" "$EVIDENCE_DIR/failure-phase1-cleanup.json"
  fi
  restore_credentials
  clean_generated
  printf '{"status":"FAILED","stage":"%s","exit_code":%d,"sha":"%s","run_id":"%s"}\n' \
    "$stage" "$code" "$DEPLOYED_SHA" "$BASE_RUN_ID" > "$EVIDENCE_DIR/phase2-closeout-result.json"
  set -e
  echo "Phase 2 closeout failed at stage: $stage" >&2
  exit "$code"
}
trap 'on_error $?' ERR

PHASE2_QA_CONFIRM=CREATE_PHASE2_QA_CREDENTIALS \
  PHASE2_QA_RUN_ID="$BASE_RUN_ID" \
  PHASE2_QA_ENV_FILE="$PHASE2_QA_ENV_FILE" \
  PHASE2_QA_RESTORE_FILE="$PHASE2_QA_RESTORE_FILE" \
  node scripts/phase2/create-phase2-runtime-credentials.js
credentials_created=true
set -a
source "$PHASE2_QA_ENV_FILE"
set +a

export PHASE2_QA_ENV=qa PHASE2_TENANT_ID="$E2E_TENANT_A_ID"
export WEB_BASE_URL API_BASE_URL

stage=targeted-manifest
PHASE2_QA_RUN_ID="${BASE_RUN_ID}-targeted"
PHASE2_QA_MANIFEST="$ROOT_DIR/artifacts/fase-2/phase2-qa-manifest.json"
export PHASE2_QA_RUN_ID PHASE2_QA_MANIFEST
node scripts/phase2/create-phase2-qa-manifests.js
node scripts/phase2/check-phase2-runtime-env.js

stage=targeted-e2e
PHASE2_E2E_RESULTS_FILE=../artifacts/fase-2/phase2-targeted-results.json \
PHASE2_PLAYWRIGHT_REPORT_DIR=../artifacts/fase-2/phase2-targeted-playwright-report \
  npm --prefix frontend run test:e2e:phase2
node scripts/phase2/check-playwright-result.js artifacts/fase-2/phase2-targeted-results.json 16
cp artifacts/fase-2/phase2-targeted-results.json "$EVIDENCE_DIR/"
cp artifacts/fase-2/phase2-qa-manifest.json "$EVIDENCE_DIR/phase2-targeted-manifest.json"

stage=targeted-cleanup
cleanup_phase2_manifest "$PHASE2_QA_MANIFEST" "$PHASE2_QA_RUN_ID" artifacts/fase-2/phase2-cleanup-result.json
cp artifacts/fase-2/phase2-cleanup-result.json "$EVIDENCE_DIR/phase2-targeted-cleanup-first.json"
cleanup_phase2_manifest "$PHASE2_QA_MANIFEST" "$PHASE2_QA_RUN_ID" artifacts/fase-2/phase2-cleanup-second.json
cp artifacts/fase-2/phase2-cleanup-second.json "$EVIDENCE_DIR/phase2-targeted-cleanup-second.json"
rm -f "$PHASE2_QA_MANIFEST"

stage=full-manifests
PHASE2_QA_RUN_ID="${BASE_RUN_ID}-full"
PHASE1_QA_RUN_ID="phase1-${BASE_RUN_ID}-full"
PHASE1_QA_ENV=qa
PHASE1_TENANT_ID="$E2E_TENANT_A_ID"
PHASE1_QA_MANIFEST="$ROOT_DIR/artifacts/fase-1/phase1-qa-manifest.json"
PHASE1_E2E_PASS=targeted
export PHASE2_QA_RUN_ID PHASE1_QA_RUN_ID PHASE1_QA_ENV PHASE1_TENANT_ID
export PHASE1_QA_MANIFEST PHASE1_E2E_PASS
node scripts/phase2/create-phase2-qa-manifests.js

stage=phase1-prerequisite-e2e
PHASE1_E2E_RESULTS_FILE=../artifacts/fase-1/phase1-prerequisite-results.json \
PHASE1_PLAYWRIGHT_REPORT_DIR=../artifacts/fase-1/phase1-prerequisite-playwright-report \
  npm --prefix frontend run test:e2e:phase1 -- --grep \
  'administrador crea workflow válido|administrador publica versión|evidencia recurrente|instancia operada desde la web|workflow editado desde la web|evidencia operada desde la web|mapping operado desde la web|auditoría operada desde la web|vista consolidada carga sin errores'
node scripts/phase2/check-playwright-result.js artifacts/fase-1/phase1-prerequisite-results.json 13
cp artifacts/fase-1/phase1-prerequisite-results.json "$EVIDENCE_DIR/"

stage=full-e2e
PHASE1_E2E_PASS=full
export PHASE1_E2E_PASS
PHASE2_INCLUDE_PHASE1=1 \
PHASE2_E2E_RESULTS_FILE=../artifacts/fase-2/phase2-full-results.json \
PHASE2_PLAYWRIGHT_REPORT_DIR=../artifacts/fase-2/phase2-full-playwright-report \
  npm --prefix frontend run test:e2e:phase2
node scripts/phase2/check-playwright-result.js artifacts/fase-2/phase2-full-results.json 46
cp artifacts/fase-2/phase2-full-results.json "$EVIDENCE_DIR/"
cp "$PHASE2_QA_MANIFEST" "$EVIDENCE_DIR/phase2-full-manifest.json"
cp "$PHASE1_QA_MANIFEST" "$EVIDENCE_DIR/phase1-full-manifest.json"

stage=full-cleanup
cleanup_phase2_manifest "$PHASE2_QA_MANIFEST" "$PHASE2_QA_RUN_ID" artifacts/fase-2/phase2-cleanup-result.json
cp artifacts/fase-2/phase2-cleanup-result.json "$EVIDENCE_DIR/phase2-full-cleanup-first.json"
cleanup_phase2_manifest "$PHASE2_QA_MANIFEST" "$PHASE2_QA_RUN_ID" artifacts/fase-2/phase2-cleanup-second.json
cp artifacts/fase-2/phase2-cleanup-second.json "$EVIDENCE_DIR/phase2-full-cleanup-second.json"
cleanup_phase1_manifest "$PHASE1_QA_MANIFEST" "$PHASE1_QA_RUN_ID" artifacts/fase-1/phase1-cleanup-result.json
cp artifacts/fase-1/phase1-cleanup-result.json "$EVIDENCE_DIR/phase1-full-cleanup-first.json"
cleanup_phase1_manifest "$PHASE1_QA_MANIFEST" "$PHASE1_QA_RUN_ID" artifacts/fase-1/phase1-cleanup-second.json
cp artifacts/fase-1/phase1-cleanup-second.json "$EVIDENCE_DIR/phase1-full-cleanup-second.json"

stage=credential-restore
restore_credentials

stage=worktree-cleanup
clean_generated
status="$(git status --short)"
if [[ -n "$status" ]]; then
  echo "Phase 2 closeout left backend VM worktree dirty:" >&2
  printf '%s\n' "$status" >&2
  exit 1
fi

printf '{"status":"VERIFIED_RUNTIME","sha":"%s","run_id":"%s","targeted":16,"phase1_prerequisite":13,"full":46,"retries":0,"cleanup":"CLEANED_AND_IDEMPOTENT","credentials":"RESTORED","git":"clean"}\n' \
  "$DEPLOYED_SHA" "$BASE_RUN_ID" > "$EVIDENCE_DIR/phase2-closeout-result.json"
cat > "$EVIDENCE_DIR/phase2-closeout-result.md" <<EOF
# Phase 2 closeout

- Status: VERIFIED_RUNTIME
- SHA: $DEPLOYED_SHA
- Run: $BASE_RUN_ID
- Targeted E2E: 16/16
- Phase 1 idempotency prerequisite: 13/13
- Full E2E: 46/46
- Retries/skips/fixme: 0
- Phase 2 cleanup: CLEANED, then ALREADY_CLEAN
- Phase 1 cleanup: CLEANED, then ALREADY_CLEAN
- Temporary credentials: restored
- Backend repository: clean
EOF
trap - ERR
echo "Phase 2 closeout verified. Evidence: $EVIDENCE_DIR"
