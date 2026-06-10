#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-${TCDX_QA_PASSWORD:-}}"
OUT_ROOT="${TCDX_OUT_DIR:-./qa-results/market-readiness/$(date +%Y%m%d-%H%M%S)}"
RUN_FUNCTIONAL="${TCDX_RUN_FUNCTIONAL_QA:-true}"

mkdir -p "$OUT_ROOT"

SUMMARY_TXT="$OUT_ROOT/summary.txt"
SUMMARY_JSON="$OUT_ROOT/summary.json"
SECURITY_TXT="$OUT_ROOT/security-summary.txt"
RESULTS_JSONL="$OUT_ROOT/results.jsonl"

: > "$SUMMARY_TXT"
: > "$SECURITY_TXT"
: > "$RESULTS_JSONL"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$SUMMARY_TXT"
}

record() {
  local name="$1"
  local status="$2"
  local severity="${3:-critical}"
  local detail="${4:-}"
  node - "$RESULTS_JSONL" "$name" "$status" "$severity" "$detail" <<'NODE'
const fs = require('fs');
const [file, name, status, severity, detail] = process.argv.slice(2);
fs.appendFileSync(file, JSON.stringify({
  ts: new Date().toISOString(),
  name,
  status,
  severity,
  detail
}) + '\n');
NODE
}

run_step() {
  local name="$1"
  local severity="$2"
  shift 2
  local dir="$OUT_ROOT/$(echo "$name" | tr ' /' '__' | tr -cd '[:alnum:]_-')"
  mkdir -p "$dir"
  log "RUN $name"
  if TCDX_BASE_URL="$BASE_URL" TCDX_EMAIL="$EMAIL" TCDX_PASSWORD="$PASSWORD" TCDX_OUT_DIR="$dir" "$@" > "$dir/stdout.log" 2> "$dir/stderr.log"; then
    record "$name" "PASS" "$severity" "$dir"
    log "PASS $name"
  else
    local code=$?
    local status="FAIL"
    if [[ "$severity" == "warning" ]]; then
      status="WARN"
    fi
    record "$name" "$status" "$severity" "$dir exit=$code"
    log "$status $name exit=$code"
  fi
}

json_get() {
  node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const p=process.argv[2].split('.'); let v=o; for (const k of p) v=v?.[k]; if (v===undefined||v===null) process.exit(2); if (typeof v==='object') console.log(JSON.stringify(v)); else console.log(String(v));" "$1" "$2"
}

api_security_smoke() {
  local dir="$OUT_ROOT/security-smoke"
  mkdir -p "$dir"
  local code

  code="$(curl -k -sS -w '%{http_code}' "$BASE_URL/health/dashboard" -o "$dir/no-token-health-dashboard.json" || true)"
  echo "$code" > "$dir/no-token-health-dashboard.status"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "CRITICAL: /health/dashboard sin token devolvió HTTP $code" | tee -a "$SECURITY_TXT"
    return 1
  fi
  if grep -qi '<html\|<!doctype' "$dir/no-token-health-dashboard.json"; then
    echo "CRITICAL: /health/dashboard sin token devolvió HTML" | tee -a "$SECURITY_TXT"
    return 1
  fi

  code="$(curl -k -sS -w '%{http_code}' "$BASE_URL/api/me/entitlements" -H 'Authorization: Bearer invalid-token' -o "$dir/invalid-token-entitlements.json" || true)"
  echo "$code" > "$dir/invalid-token-entitlements.status"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "CRITICAL: /api/me/entitlements con token inválido devolvió HTTP $code" | tee -a "$SECURITY_TXT"
    return 1
  fi
  if grep -qi '<html\|<!doctype' "$dir/invalid-token-entitlements.json"; then
    echo "CRITICAL: /api/me/entitlements con token inválido devolvió HTML" | tee -a "$SECURITY_TXT"
    return 1
  fi

  if [[ -n "$PASSWORD" ]]; then
    curl -k -sS -X POST "$BASE_URL/api/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
      -o "$dir/login.json"
    local token
    token="$(json_get "$dir/login.json" token || true)"
    if [[ -n "$token" ]]; then
      code="$(curl -k -sS -w '%{http_code}' "$BASE_URL/api/company-profile/analyze/jobs/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer $token" -o "$dir/missing-company-profile-job.json" || true)"
      echo "$code" > "$dir/missing-company-profile-job.status"
      if [[ "$code" =~ ^5 ]]; then
        echo "CRITICAL: job inexistente devolvió HTTP $code" | tee -a "$SECURITY_TXT"
        return 1
      fi
    fi
  fi

  echo "PASS security smoke: auth JSON, no HTML, no 5xx expected paths" | tee -a "$SECURITY_TXT"
}

if [[ "$RUN_FUNCTIONAL" != "true" ]]; then
  log "TCDX_RUN_FUNCTIONAL_QA=false: sólo se generó estructura de readiness."
else
  if [[ -z "$PASSWORD" ]]; then
    log "WARN: TCDX_PASSWORD/TCDX_QA_PASSWORD no definido; se omiten scripts funcionales autenticados."
    record "functional-authenticated-suite" "WARN" "warning" "missing password"
  else
    run_step "health applicability" "critical" bash scripts/test-health-applicability-flow.sh
    run_step "kpi applicability" "critical" bash scripts/test-kpi-applicability-flow.sh
    run_step "controls applicability" "critical" bash scripts/test-controls-applicability-flow.sh
    run_step "report applicability" "critical" bash scripts/test-report-applicability-flow.sh
    run_step "ai ui entitlements" "critical" bash scripts/test-ai-ui-entitlements-flow.sh
    run_step "ai entitlements hardening" "critical" bash scripts/test-ai-entitlements-hardening-flow.sh
    run_step "db applicability consistency" "critical" bash scripts/test-db-applicability-consistency.sh
    run_step "document suggestion evidence mapping" "critical" bash scripts/test-document-suggestion-evidence-mapping-flow.sh
    run_step "rbac health" "critical" bash scripts/test-rbac-health-flow.sh
    run_step "tcdx master" "critical" bash scripts/test-tcdx-system-master.sh
  fi

  if api_security_smoke; then
    record "security smoke" "PASS" "critical" "$OUT_ROOT/security-smoke"
  else
    record "security smoke" "FAIL" "critical" "$OUT_ROOT/security-smoke"
  fi
fi

node - "$RESULTS_JSONL" "$SUMMARY_JSON" <<'NODE'
const fs = require('fs');
const [resultsFile, summaryFile] = process.argv.slice(2);
const rows = fs.existsSync(resultsFile)
  ? fs.readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  : [];
const criticalFailures = rows.filter((row) => row.status === 'FAIL' && row.severity === 'critical');
const warnings = rows.filter((row) => row.status === 'WARN');
const summary = {
  overall_status: criticalFailures.length ? 'FAIL' : 'PASS',
  total: rows.length,
  pass: rows.filter((row) => row.status === 'PASS').length,
  warn: warnings.length,
  fail: rows.filter((row) => row.status === 'FAIL').length,
  critical_failures: criticalFailures,
  warnings,
  generated_at: new Date().toISOString()
};
fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
console.log(`OVERALL_STATUS=${summary.overall_status}`);
console.log(`PASS=${summary.pass} WARN=${summary.warn} FAIL=${summary.fail}`);
if (criticalFailures.length) process.exitCode = 1;
NODE

{
  echo ""
  echo "Artifacts: $OUT_ROOT"
  cat "$SUMMARY_JSON"
} | tee -a "$SUMMARY_TXT"
