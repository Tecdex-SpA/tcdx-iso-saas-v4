#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
AI_EMAIL="${TCDX_AI_EMAIL:-}"
AI_PASSWORD="${TCDX_AI_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/ai-entitlements-hardening/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

pass() {
  echo "[PASS] $*"
}

json_get() {
  node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const p=process.argv[2].split('.'); let v=o; for (const k of p) v=v?.[k]; if (v===undefined||v===null) process.exit(2); if (typeof v==='object') console.log(JSON.stringify(v)); else console.log(String(v));" "$1" "$2"
}

login_as() {
  local email="$1"
  local password="$2"
  local out="$3"
  curl -k -sS -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    -o "$out"
  json_get "$out" token || json_get "$out" data.token
}

call_json() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="${4:-}"
  local out="$5"
  local code
  if [ -n "$body" ]; then
    code="$(curl -k -sS -w '%{http_code}' -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body" \
      -o "$out")"
  else
    code="$(curl -k -sS -w '%{http_code}' -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -o "$out")"
  fi
  echo "$code" > "$out.status"
}

assert_disabled_trace() {
  local file="$1"
  node - "$file" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const trace = json.trace || json.engine || json.metrics || json.data?.trace || json.data?.engine || {};
const disabled =
  json.ai_disabled_by_plan === true ||
  json.disabled_by_plan === true ||
  trace.ai_disabled_by_plan === true ||
  json.code === 'AI_DISABLED_BY_PLAN';
if (!disabled) {
  throw new Error(`${file} no declara ai_disabled_by_plan`);
}
if (trace.ai_engine_used === true || trace.llm_used === true || trace.used_llm === true) {
  throw new Error(`${file} indica consumo IA aunque el plan está deshabilitado`);
}
NODE
}

TOKEN="$(login_as "$EMAIL" "$PASSWORD" "$OUT_DIR/login-disabled.json")"
[ -n "$TOKEN" ] || fail "login tenant sin IA no entregó token"

call_json GET "/api/me/entitlements" "$TOKEN" "" "$OUT_DIR/entitlements-disabled.json"
node - "$OUT_DIR/entitlements-disabled.json" <<'NODE'
const fs = require('fs');
const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (json.ai?.enabled !== false) throw new Error('ai.enabled debe ser false para tenant QA sin IA');
for (const [key, value] of Object.entries(json.ai?.features || {})) {
  if (value !== false) throw new Error(`feature ${key} debe ser false`);
}
NODE
pass "/api/me/entitlements sin IA OK"

call_json POST "/api/company-profile/analyze/start" "$TOKEN" '{"model_mode":"balanced"}' "$OUT_DIR/company-profile-analyze-disabled.json"
assert_disabled_trace "$OUT_DIR/company-profile-analyze-disabled.json"
pass "company-profile/analyze/start bloquea IA sin plan"

call_json POST "/api/ai-compliance/analyze" "$TOKEN" '{"question":"resumen de prueba QA"}' "$OUT_DIR/ai-compliance-disabled.json"
assert_disabled_trace "$OUT_DIR/ai-compliance-disabled.json"
pass "ai-compliance bloquea IA sin plan"

call_json POST "/api/reports/generate/start" "$TOKEN" '{"report_type_code":"executive_iso_status","period":"QA","model_mode":"balanced","use_llm":true,"use_rag":true,"use_web":true}' "$OUT_DIR/report-start-disabled.json"
node - "$OUT_DIR/report-start-disabled.json" <<'NODE'
const fs = require('fs');
const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (typeof json !== 'object' || json === null) throw new Error('report-start no devolvió JSON');
if (String(JSON.stringify(json)).includes('<html')) throw new Error('report-start devolvió HTML');
NODE
pass "reportes responden JSON sin IA habilitada"

REPORT_JOB_ID="$(json_get "$OUT_DIR/report-start-disabled.json" job_id || json_get "$OUT_DIR/report-start-disabled.json" data.job_id || true)"
if [ -n "$REPORT_JOB_ID" ]; then
  for _ in $(seq 1 24); do
    call_json GET "/api/reports/jobs/$REPORT_JOB_ID" "$TOKEN" "" "$OUT_DIR/report-job-disabled.json"
    REPORT_STATUS="$(json_get "$OUT_DIR/report-job-disabled.json" status || true)"
    [ "$REPORT_STATUS" = "completed" ] && break
    [ "$REPORT_STATUS" = "failed" ] && break
    sleep 5
  done
  node - "$OUT_DIR/report-job-disabled.json" <<'NODE'
const fs = require('fs');
const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (json.status !== 'completed') {
  throw new Error(`reporte sin IA no completó: ${json.status}`);
}
const blob = JSON.stringify(json.result_json || {}).toLowerCase();
if (blob.includes('"ai_engine_used":true') || blob.includes('"ai_engine_used": true')) {
  throw new Error('reporte sin IA declara ai_engine_used=true');
}
if (blob.includes('qwen')) {
  throw new Error('reporte sin IA expone modelo qwen');
}
if (!blob.includes('ai_disabled_by_plan')) {
  throw new Error('reporte sin IA no declara ai_disabled_by_plan');
}
NODE
  pass "reporte sin IA completa con metadata coherente"
fi

if [ -n "$AI_EMAIL" ] && [ -n "$AI_PASSWORD" ]; then
  AI_TOKEN="$(login_as "$AI_EMAIL" "$AI_PASSWORD" "$OUT_DIR/login-ai-enabled.json")"
  call_json GET "/api/me/entitlements" "$AI_TOKEN" "" "$OUT_DIR/entitlements-enabled.json"
  node - "$OUT_DIR/entitlements-enabled.json" <<'NODE'
const fs = require('fs');
const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (json.ai?.enabled !== true) throw new Error('tenant con IA no declara ai.enabled=true');
NODE
  pass "tenant con IA habilitada OK"
else
  echo "[SKIP] TCDX_AI_EMAIL/TCDX_AI_PASSWORD no configurados; se omite prueba de tenant con IA habilitada." | tee "$OUT_DIR/ai-enabled-skip.txt"
fi

cat > "$OUT_DIR/summary.txt" <<SUMMARY
base_url=$BASE_URL
disabled_email=$EMAIL
checked_at=$(date -Iseconds)
result=OK
SUMMARY

echo "OK - resultados en $OUT_DIR"
