#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# TCDX ISO SaaS - Master System QA Script
# Non-destructive end-to-end validation from local machine.
#
# Default target:
#   https://181.212.166.187:8443
#
# Usage:
#   cd ~/repos/tcdx-iso-saas
#   mkdir -p scripts
#   cp ~/Downloads/test-tcdx-system-master.sh scripts/test-tcdx-system-master.sh
#   chmod +x scripts/test-tcdx-system-master.sh
#   ./scripts/test-tcdx-system-master.sh
#
# Optional:
#   BASE_URL="https://181.212.166.187:8443" \
#   TCDX_QA_EMAIL="admin@rieltec.com" \
#   TCDX_QA_PASSWORD="123456" \
#   AI_INTERNAL_TOKEN="<token-from-env>" \
#   RUN_SSH_CHECKS=true \
#   ./scripts/test-tcdx-system-master.sh
# ============================================================

BASE_URL="${BASE_URL:-https://181.212.166.187:8443}"
TEST_EMAIL="${TEST_EMAIL:-${TCDX_QA_EMAIL:-admin@rieltec.com}}"
TEST_PASSWORD="${TEST_PASSWORD:-${TCDX_QA_PASSWORD:-123456}}"
AI_INTERNAL_TOKEN="${AI_INTERNAL_TOKEN:-${TCDX_AI_INTERNAL_TOKEN:-}}"
AI_ENGINE_PUBLIC_DOCS_EXPECTED="${AI_ENGINE_PUBLIC_DOCS_EXPECTED:-lab}"

RUN_SSH_CHECKS="${RUN_SSH_CHECKS:-false}"
RUN_REPO_SCAN="${RUN_REPO_SCAN:-true}"
RUN_DEEP_AI="${RUN_DEEP_AI:-true}"

SSH_USER="${SSH_USER:-tecdex}"
BACKEND_HOST="${BACKEND_HOST:-bk.tcdx.int}"
AI_HOST="${AI_HOST:-ai.tcdx.int}"
FRONTEND_HOST="${FRONTEND_HOST:-www.tcdx.int}"
DB_HOST="${DB_HOST:-db.tcdx.int}"

OUT_DIR="${OUT_DIR:-./qa-results/tcdx-master-$(date +%Y%m%d_%H%M%S)}"
CURL_MAX_TIME="${CURL_MAX_TIME:-360}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-20}"

mkdir -p "$OUT_DIR"

LOG_FILE="$OUT_DIR/run.log"
SUMMARY_FILE="$OUT_DIR/summary.txt"
RESULTS_JSONL="$OUT_DIR/results.jsonl"
LOGIN_JSON="$OUT_DIR/01-login.json"
TOKEN_FILE="$OUT_DIR/token.txt"
ENV_SNAPSHOT="$OUT_DIR/test-env.txt"

: > "$LOG_FILE"
: > "$SUMMARY_FILE"
: > "$RESULTS_JSONL"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERROR: $*"
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

json_get() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path, "r", encoding="utf-8"))
    cur = data
    for part in expr.split("."):
        if not part:
            continue
        if isinstance(cur, dict):
            cur = cur.get(part, "")
        else:
            cur = ""
    print(cur or "")
except Exception:
    print("")
PY
}

http_code() {
  local method="$1"
  local url="$2"
  local output="$3"
  shift 3

  curl -k -sS \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    -X "$method" "$url" \
    -o "$output" \
    -w "%{http_code}" \
    "$@"
}

first_http_code_from_headers() {
  local file="$1"
  awk 'toupper($1) ~ /^HTTP/ {code=$2} END {if (code) print code; else print "000"}' "$file" 2>/dev/null || echo "000"
}

record_result() {
  local group="$1"
  local name="$2"
  local method="$3"
  local path="$4"
  local code="$5"
  local seconds="$6"
  local file="$7"
  local expected="${8:-2xx}"
  local severity="${9:-critical}"

  python3 - "$RESULTS_JSONL" "$group" "$name" "$method" "$path" "$code" "$seconds" "$file" "$expected" "$severity" <<'PY'
import json, sys, pathlib, datetime
out, group, name, method, path, code, seconds, file, expected, severity = sys.argv[1:]

try:
    code_value = int(code)
except Exception:
    code_value = code

text = ""
try:
    text = pathlib.Path(file).read_text(encoding="utf-8", errors="replace")
except Exception:
    pass

preview = " ".join(text.split())[:1200]
lower = preview.lower()

def expected_ok(code_value, expected):
    if expected == "any":
        return True
    if not isinstance(code_value, int):
        return False
    if expected == "2xx":
        return 200 <= code_value < 300
    if expected == "2xx_ai_disabled":
        if 200 <= code_value < 300:
            return True
        return code_value == 403 and (
            '"code":"AI_DISABLED_BY_PLAN"' in text
            or '"code": "AI_DISABLED_BY_PLAN"' in text
            or '"ai_disabled_by_plan":true' in text
            or '"ai_disabled_by_plan": true' in text
        )
    if expected == "2xx3xx":
        return 200 <= code_value < 400
    if expected == "401403":
        return code_value in (401, 403)
    if expected == "403404":
        return code_value in (403, 404)
    if expected == "400403404":
        return code_value in (400, 403, 404)
    if expected == "401":
        return code_value == 401
    if expected == "403":
        return code_value == 403
    if expected == "200":
        return code_value == 200
    if expected == "200401":
        return code_value in (200, 401)
    if expected == "200401404":
        return code_value in (200, 401, 404)
    if expected == "not5xx":
        return isinstance(code_value, int) and code_value < 500
    return 200 <= code_value < 300

flags = []
if "<!doctype html" in lower or "<html" in lower:
    flags.append("HTML_RESPONSE")
if "gateway time-out" in lower or "504 gateway" in lower:
    flags.append("GATEWAY_TIMEOUT_HTML")
if "unexpected token" in lower:
    flags.append("RAW_PARSE_ERROR_TEXT")
if "sin token" in lower and expected not in ("401403", "401", "200401", "200401404"):
    flags.append("UNEXPECTED_NO_TOKEN")
if "no fue posible ejecutar ia auditor senior" in lower:
    flags.append("IA_AUDITOR_GENERIC_ERROR")
if isinstance(code_value, int) and code_value >= 500:
    flags.append("SERVER_5XX")
if isinstance(code_value, int) and code_value == 504:
    flags.append("HTTP_504")
if isinstance(code_value, int) and code_value == 429:
    flags.append("RATE_LIMITED")
if "cannot get" in lower or "cannot post" in lower:
    flags.append("EXPRESS_ROUTE_NOT_FOUND")
if "legacy_error" in lower:
    flags.append("LEGACY_ERROR_PRESENT")
legacy_octets = ".".join(["192", "168", "100"])
if f"{legacy_octets}." in lower:
    flags.append("LEGACY_PRIVATE_NET_REFERENCE")
if "connection to server at" in lower and legacy_octets in lower:
    flags.append("LEGACY_DB_CONNECTION_ATTEMPT")

ok = expected_ok(code_value, expected)
status = "PASS" if ok and not flags else ("WARN" if ok and flags else "FAIL")

if severity == "warning" and status == "FAIL":
    status = "WARN"
if severity == "info":
    status = "INFO"

row = {
    "ts": datetime.datetime.utcnow().isoformat() + "Z",
    "group": group,
    "name": name,
    "method": method,
    "path": path,
    "http_code": code_value,
    "seconds": float(seconds),
    "expected": expected,
    "severity": severity,
    "status": status,
    "flags": flags,
    "file": file,
    "preview": preview,
}
with open(out, "a", encoding="utf-8") as f:
    f.write(json.dumps(row, ensure_ascii=False) + "\n")
PY
}

timed_call_user_jwt() {
  local group="$1"; local name="$2"; local method="$3"; local path="$4"; local outfile="$5"
  local body="${6:-}"; local expected="${7:-2xx}"; local severity="${8:-critical}"
  local start end elapsed code

  start="$(python3 - <<'PY'
import time
print(time.time())
PY
)"

  if [[ -n "$body" ]]; then
    code="$(http_code "$method" "$BASE_URL$path" "$outfile" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "x-tcdx-locale: es" \
      -d "$body" || true)"
  else
    code="$(http_code "$method" "$BASE_URL$path" "$outfile" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-tcdx-locale: es" || true)"
  fi

  end="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  elapsed="$(python3 - "$start" "$end" <<'PY'
import sys
print(round(float(sys.argv[2]) - float(sys.argv[1]), 3))
PY
)"
  log "$group | $name | $method $path | HTTP $code | ${elapsed}s"
  record_result "$group" "$name" "$method" "$path" "$code" "$elapsed" "$outfile" "$expected" "$severity"
}

timed_call_ai_token() {
  local group="$1"; local name="$2"; local method="$3"; local path="$4"; local outfile="$5"
  local body="${6:-}"; local expected="${7:-2xx}"; local severity="${8:-critical}"
  local start end elapsed code

  if [[ -z "${AI_INTERNAL_TOKEN:-}" ]]; then
    echo "Skipped: AI_INTERNAL_TOKEN/TCDX_AI_INTERNAL_TOKEN not set." > "$outfile"
    log "$group | $name | $method $path | SKIP missing AI token"
    record_result "$group" "$name" "$method" "$path" "200" "0" "$outfile" "200" "info"
    return
  fi

  start="$(python3 - <<'PY'
import time
print(time.time())
PY
)"

  if [[ -n "$body" ]]; then
    code="$(http_code "$method" "$BASE_URL$path" "$outfile" \
      -H "x-ai-token: $AI_INTERNAL_TOKEN" \
      -H "x-internal-token: $AI_INTERNAL_TOKEN" \
      -H "Content-Type: application/json" \
      -H "x-tcdx-locale: es" \
      -d "$body" || true)"
  else
    code="$(http_code "$method" "$BASE_URL$path" "$outfile" \
      -H "x-ai-token: $AI_INTERNAL_TOKEN" \
      -H "x-internal-token: $AI_INTERNAL_TOKEN" \
      -H "x-tcdx-locale: es" || true)"
  fi

  end="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  elapsed="$(python3 - "$start" "$end" <<'PY'
import sys
print(round(float(sys.argv[2]) - float(sys.argv[1]), 3))
PY
)"
  log "$group | $name | $method $path | HTTP $code | ${elapsed}s"
  record_result "$group" "$name" "$method" "$path" "$code" "$elapsed" "$outfile" "$expected" "$severity"
}

timed_head_public() {
  local group="$1"; local name="$2"; local path="$3"; local outfile="$4"
  local expected="${5:-2xx3xx}"; local severity="${6:-critical}"
  local start end elapsed code

  start="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  curl -k -sS -I \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    "$BASE_URL$path" > "$outfile" || true
  code="$(first_http_code_from_headers "$outfile")"
  end="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  elapsed="$(python3 - "$start" "$end" <<'PY'
import sys
print(round(float(sys.argv[2]) - float(sys.argv[1]), 3))
PY
)"
  log "$group | $name | HEAD $path | HTTP $code | ${elapsed}s"
  record_result "$group" "$name" "HEAD" "$path" "$code" "$elapsed" "$outfile" "$expected" "$severity"
}

ssh_check() {
  local group="$1"; local name="$2"; local host="$3"; local command="$4"; local outfile="$5"
  local expected="${6:-0}"; local severity="${7:-warning}"
  local start end elapsed rc

  start="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  set +e
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_USER@$host" "$command" > "$outfile" 2>&1
  rc="$?"
  set -e
  end="$(python3 - <<'PY'
import time
print(time.time())
PY
)"
  elapsed="$(python3 - "$start" "$end" <<'PY'
import sys
print(round(float(sys.argv[2]) - float(sys.argv[1]), 3))
PY
)"
  log "$group | $name | SSH $host | rc=$rc | ${elapsed}s"
  if [[ "$rc" = "$expected" ]]; then
    record_result "$group" "$name" "SSH" "$host" "200" "$elapsed" "$outfile" "200" "$severity"
  else
    record_result "$group" "$name" "SSH" "$host" "500" "$elapsed" "$outfile" "200" "$severity"
  fi
}

need_cmd curl
need_cmd python3

cat > "$ENV_SNAPSHOT" <<EOF
BASE_URL=$BASE_URL
TEST_EMAIL=$TEST_EMAIL
OUT_DIR=$OUT_DIR
RUN_SSH_CHECKS=$RUN_SSH_CHECKS
RUN_REPO_SCAN=$RUN_REPO_SCAN
RUN_DEEP_AI=$RUN_DEEP_AI
AI_ENGINE_PUBLIC_DOCS_EXPECTED=$AI_ENGINE_PUBLIC_DOCS_EXPECTED
BACKEND_HOST=$BACKEND_HOST
AI_HOST=$AI_HOST
FRONTEND_HOST=$FRONTEND_HOST
DB_HOST=$DB_HOST
CURL_MAX_TIME=$CURL_MAX_TIME
CURL_CONNECT_TIMEOUT=$CURL_CONNECT_TIMEOUT
EOF

log "============================================================"
log "TCDX ISO SaaS Master System QA"
log "BASE_URL=$BASE_URL"
log "OUT_DIR=$OUT_DIR"
log "============================================================"

# 1. Public frontend pages
log "1) Public frontend page checks"
PUBLIC_PAGES=(
  "/"
  "/login"
  "/health"
  "/dashboard"
  "/ia-compliance"
  "/ia-compliance/sugerencias"
  "/auditorias"
  "/auditorias?view=ia"
  "/evidencias"
  "/documentos"
  "/exportes"
  "/controles"
  "/plan-accion"
  "/matriz-riesgo"
)

idx=0
for page in "${PUBLIC_PAGES[@]}"; do
  idx=$((idx+1))
  safe="$(echo "$page" | sed 's#[/?=&]#_#g' | sed 's#^_##')"
  timed_head_public "frontend" "Public page $page" "$page" "$OUT_DIR/10-front-${idx}-${safe}.headers.txt" "2xx3xx" "critical"
done

# 2. Login
log "2) Login"
LOGIN_CODE="$(http_code POST "$BASE_URL/api/auth/login" "$LOGIN_JSON" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" || true)"
record_result "auth" "Login" "POST" "/api/auth/login" "$LOGIN_CODE" "0" "$LOGIN_JSON" "2xx" "critical"

TOKEN="$(json_get "$LOGIN_JSON" "token")"
TENANT_ID="$(json_get "$LOGIN_JSON" "user.tenant_id")"
USER_ID="$(json_get "$LOGIN_JSON" "user.id")"
USER_ROLE="$(json_get "$LOGIN_JSON" "user.role")"

if [[ -z "$TOKEN" ]]; then
  log "Login failed. Protected checks will be skipped."
else
  printf "%s" "$TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  log "Token obtained. tenant_id=${TENANT_ID:-not_detected} user_id=${USER_ID:-not_detected} role=${USER_ROLE:-not_detected}"
fi

AI_EXPECTED="2xx"
if [[ -n "${TOKEN:-}" ]]; then
  ENTITLEMENTS_JSON="$OUT_DIR/02-me-entitlements.json"
  ENTITLEMENTS_CODE="$(http_code GET "$BASE_URL/api/me/entitlements" "$ENTITLEMENTS_JSON" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-tcdx-locale: es" || true)"
  record_result "auth" "Tenant entitlements" "GET" "/api/me/entitlements" "$ENTITLEMENTS_CODE" "0" "$ENTITLEMENTS_JSON" "2xx" "warning"
  AI_ENABLED="$(json_get "$ENTITLEMENTS_JSON" "ai.enabled")"
  if [[ "$AI_ENABLED" != "true" ]]; then
    AI_EXPECTED="2xx_ai_disabled"
    log "Tenant sin IA habilitada; pruebas IA backend aceptarán AI_DISABLED_BY_PLAN controlado."
  fi
fi

# 3. Protected backend checks
if [[ -n "${TOKEN:-}" ]]; then
  log "3) Protected backend checks"
  timed_call_user_jwt "backend" "Backend API root candidate" "GET" "/api/" "$OUT_DIR/20-api-root.json" "" "any" "info"
  timed_call_user_jwt "backend" "ISO Health dashboard API" "GET" "/health/dashboard" "$OUT_DIR/21-health-dashboard.json" "" "2xx" "critical"
  timed_call_user_jwt "backend" "ISO Health standards API" "GET" "/health/standards" "$OUT_DIR/22-health-standards.json" "" "2xx" "warning"
  timed_call_user_jwt "backend" "ISO Health root causes API" "GET" "/health/root-causes" "$OUT_DIR/23-health-root-causes.json" "" "2xx" "warning"
  timed_call_user_jwt "backend" "IA Compliance suggestions backend" "GET" "/api/ai-compliance/suggestions" "$OUT_DIR/24-ai-compliance-suggestions.json" "" "$AI_EXPECTED" "critical"
  timed_call_user_jwt "backend-security" "AI feedback API protected" "GET" "/api/ai-feedback" "$OUT_DIR/24b-ai-feedback-api.json" "" "2xx" "critical"
  timed_call_user_jwt "backend-security" "AI external lookup API entitlement" "GET" "/api/ai-external-lookup" "$OUT_DIR/24c-ai-external-lookup-api.json" "" "$AI_EXPECTED" "critical"

  NO_TOKEN_FEEDBACK="$OUT_DIR/24d-ai-feedback-no-token.json"
  NO_TOKEN_FEEDBACK_CODE="$(http_code GET "$BASE_URL/ai-feedback" "$NO_TOKEN_FEEDBACK" || true)"
  record_result "backend-security" "AI feedback legacy without token blocked" "GET" "/ai-feedback" "$NO_TOKEN_FEEDBACK_CODE" "0" "$NO_TOKEN_FEEDBACK" "401403" "critical"

  NO_TOKEN_LOOKUP="$OUT_DIR/24e-ai-external-lookup-no-token.json"
  NO_TOKEN_LOOKUP_CODE="$(http_code GET "$BASE_URL/ai-external-lookup" "$NO_TOKEN_LOOKUP" || true)"
  record_result "backend-security" "AI external lookup legacy without token blocked" "GET" "/ai-external-lookup" "$NO_TOKEN_LOOKUP_CODE" "0" "$NO_TOKEN_LOOKUP" "401403" "critical"

  UPLOADS_TENANTS_TRAVERSAL="$OUT_DIR/24f-uploads-tenants-traversal.json"
  UPLOADS_TENANTS_TRAVERSAL_CODE="$(http_code GET "$BASE_URL/uploads/tenants/%2e%2e/app.js" "$UPLOADS_TENANTS_TRAVERSAL" || true)"
  record_result "backend-security" "Uploads tenants traversal not exposed" "GET" "/uploads/tenants/%2e%2e/app.js" "$UPLOADS_TENANTS_TRAVERSAL_CODE" "0" "$UPLOADS_TENANTS_TRAVERSAL" "400403404" "critical"

  if [[ -n "${TENANT_ID:-}" ]]; then
    TENANT_FILE_TRAVERSAL="$OUT_DIR/24g-tenant-file-traversal.json"
    TENANT_FILE_TRAVERSAL_CODE="$(http_code GET "$BASE_URL/api/files/tenant/$TENANT_ID/%2e%2e/app.js" "$TENANT_FILE_TRAVERSAL" \
      -H "Authorization: Bearer $TOKEN" || true)"
    record_result "backend-security" "Authenticated tenant file traversal blocked" "GET" "/api/files/tenant/<tenant>/../app.js" "$TENANT_FILE_TRAVERSAL_CODE" "0" "$TENANT_FILE_TRAVERSAL" "400403404" "critical"
  fi

  CANDIDATES=(
    "/api/tenant/${TENANT_ID:-}"
    "/api/user/${USER_ID:-}"
    "/api/notifications"
    "/api/evidences"
    "/api/controls"
    "/api/reports"
    "/api/audits"
    "/api/findings"
    "/api/action-plans"
    "/api/nonconformities"
  )
  cidx=0
  for endpoint in "${CANDIDATES[@]}"; do
    if [[ "$endpoint" == */ ]]; then
      continue
    fi
    cidx=$((cidx+1))
    safe="$(echo "$endpoint" | sed 's#[/:?=&]#_#g' | sed 's#^_##')"
    timed_call_user_jwt "backend-candidate" "Candidate $endpoint" "GET" "$endpoint" "$OUT_DIR/25-candidate-${cidx}-${safe}.json" "" "200401404" "info"
  done
fi

# 4. AI Engine proxy checks
log "4) AI Engine proxy checks"
timed_call_ai_token "ai-engine" "AI Engine health" "GET" "/ai-engine/health" "$OUT_DIR/30-ai-health.json" "" "2xx" "critical"
timed_call_ai_token "ai-engine" "AI Engine deep health" "GET" "/ai-engine/health/deep" "$OUT_DIR/31-ai-health-deep.json" "" "2xx" "critical"
timed_call_ai_token "ai-engine" "AI knowledge status" "GET" "/ai-engine/api/ai/knowledge/status" "$OUT_DIR/32-ai-knowledge-status.json" "" "2xx" "critical"
timed_call_ai_token "ai-engine" "AI knowledge bootstrap status" "GET" "/ai-engine/api/ai/knowledge/bootstrap/status" "$OUT_DIR/33-ai-bootstrap-status.json" "" "2xx" "critical"
if [[ "$AI_ENGINE_PUBLIC_DOCS_EXPECTED" = "false" ]]; then
  timed_head_public "ai-engine" "AI docs disabled in production" "/ai-engine/docs" "$OUT_DIR/34-ai-docs.headers.txt" "403404" "critical"
  timed_head_public "ai-engine" "AI OpenAPI disabled in production" "/ai-engine/openapi.json" "$OUT_DIR/35-ai-openapi.headers.txt" "403404" "critical"
elif [[ "$AI_ENGINE_PUBLIC_DOCS_EXPECTED" = "true" ]]; then
  timed_head_public "ai-engine" "Public AI docs exposure intentionally enabled" "/ai-engine/docs" "$OUT_DIR/34-ai-docs.headers.txt" "2xx3xx" "info"
  timed_head_public "ai-engine" "Public AI OpenAPI intentionally enabled" "/ai-engine/openapi.json" "$OUT_DIR/35-ai-openapi.headers.txt" "2xx3xx" "info"
else
  timed_head_public "ai-engine" "Public AI docs exposure lab classification" "/ai-engine/docs" "$OUT_DIR/34-ai-docs.headers.txt" "any" "info"
  timed_head_public "ai-engine" "Public AI OpenAPI lab classification" "/ai-engine/openapi.json" "$OUT_DIR/35-ai-openapi.headers.txt" "any" "info"
fi

# 5. IA Compliance / AI suggestions
if [[ "$RUN_DEEP_AI" = "true" ]]; then
  log "5) IA Compliance and AI suggestion checks"

  HEALTH_BODY="$(cat <<JSON
{
  "tenant_id": "${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}",
  "tenant_name": "Rieltec",
  "standards": ["ISO9001"],
  "controls_total": 10,
  "controls_warning": 2,
  "controls_critical": 1,
  "evidences_pending": 3,
  "findings_critical": 1
}
JSON
)"
  FINDING_BODY="$(cat <<JSON
{
  "tenant_id": "${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}",
  "iso_code": "ISO9001",
  "title": "QA maestro: evidencia insuficiente",
  "description": "Prueba no destructiva para validar análisis IA sobre evidencia insuficiente.",
  "severity": "media",
  "status": "open"
}
JSON
)"
  ACTION_BODY="$(cat <<JSON
{
  "tenant_id": "${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}",
  "iso_code": "ISO9001",
  "title": "QA maestro: regularizar evidencia",
  "description": "Prueba no destructiva para generar sugerencia de plan de acción.",
  "severity": "media",
  "status": "open"
}
JSON
)"
  EXEC_BODY="$(cat <<JSON
{
  "tenant_id": "${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}",
  "tenant_name": "Rieltec",
  "period": "QA maestro",
  "standards": ["ISO9001"],
  "controls_total": 10,
  "controls_warning": 2,
  "controls_critical": 1,
  "evidences_pending": 3,
  "findings_critical": 1,
  "weakest_standards": ["ISO9001"]
}
JSON
)"
  DOC_BODY="$(cat <<JSON
{
  "tenant_id": "${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}",
  "document_id": "qa-master-document-$(date +%s)",
  "file_name": "qa-politica-calidad.txt",
  "mime_type": "text/plain",
  "text": "Política de calidad de prueba. La organización declara compromiso con mejora continua, satisfacción del cliente, control documental, gestión de riesgos y revisión por la dirección.",
  "metadata": {"source": "master_qa_script", "non_destructive": true},
  "active_standards": ["ISO9001"],
  "available_controls": [
    {"standard_code": "ISO9001", "clause": "5.2", "control_name": "Política de calidad"}
  ],
  "instructions": {"language": "es", "mode": "qa_non_destructive"}
}
JSON
)"

  timed_call_ai_token "ai-suggest" "AI suggest health summary" "POST" "/ai-engine/api/ai/suggest/health-summary" "$OUT_DIR/40-suggest-health-summary.json" "$HEALTH_BODY" "2xx" "critical"
  timed_call_ai_token "ai-suggest" "AI suggest finding analysis" "POST" "/ai-engine/api/ai/suggest/finding-analysis" "$OUT_DIR/41-suggest-finding-analysis.json" "$FINDING_BODY" "2xx" "critical"
  timed_call_ai_token "ai-suggest" "AI suggest action plan" "POST" "/ai-engine/api/ai/suggest/action-plan" "$OUT_DIR/42-suggest-action-plan.json" "$ACTION_BODY" "2xx" "critical"
  timed_call_ai_token "ai-suggest" "AI suggest executive brief" "POST" "/ai-engine/api/ai/suggest/executive-brief" "$OUT_DIR/43-suggest-executive-brief.json" "$EXEC_BODY" "2xx" "critical"
  timed_call_ai_token "ai-compliance" "IA Compliance analyze document via AI Engine" "POST" "/ai-engine/api/ai-compliance/analyze-document" "$OUT_DIR/44-ai-compliance-analyze-document.json" "$DOC_BODY" "2xx" "critical"
fi

# 6. IA Auditor through backend
if [[ -n "${TOKEN:-}" && "$RUN_DEEP_AI" = "true" ]]; then
  log "6) IA Auditor check through backend"
  AUDITOR_BODY="$(cat <<JSON
{
  "depth": "executive",
  "audit_focus": "general",
  "standard_code": "ISO9001",
  "use_rag": true,
  "use_drive": false,
  "use_web": false,
  "qa_mode": true,
  "non_destructive": true
}
JSON
)"
  timed_call_user_jwt "ia-auditor" "IA Auditor analyze executive" "POST" "/api/ai-auditor/analyze" "$OUT_DIR/50-ai-auditor-analyze.json" "$AUDITOR_BODY" "$AI_EXPECTED" "critical"

  AUDITOR_ASYNC_BODY="$(cat <<JSON
{
  "depth": "executive",
  "audit_focus": "general",
  "standard_code": "ISO9001",
  "model_mode": "fast",
  "use_llm": false,
  "use_rag": true,
  "use_drive": false,
  "use_web": false,
  "qa_mode": true,
  "non_destructive": true,
  "async_mode": true
}
JSON
)"
  timed_call_user_jwt "ia-auditor" "IA Auditor async start" "POST" "/api/ai-auditor/analyze/start" "$OUT_DIR/51-ai-auditor-async-start.json" "$AUDITOR_ASYNC_BODY" "$AI_EXPECTED" "critical"
  IA_JOB_ID="$(json_get "$OUT_DIR/51-ai-auditor-async-start.json" "job_id" || true)"
  if [[ -n "$IA_JOB_ID" ]]; then
    timed_call_user_jwt "ia-auditor" "IA Auditor async job status" "GET" "/api/ai-auditor/analyze/jobs/$IA_JOB_ID" "$OUT_DIR/52-ai-auditor-async-status.json" "" "2xx" "critical"
  elif [[ "$AI_EXPECTED" = "2xx_ai_disabled" ]] && grep -q "AI_DISABLED_BY_PLAN\\|ai_disabled_by_plan" "$OUT_DIR/51-ai-auditor-async-start.json"; then
    echo "IA Auditor async bloqueado por plan IA deshabilitado; resultado controlado esperado." > "$OUT_DIR/52-ai-auditor-async-status.json"
    record_result "ia-auditor" "IA Auditor async job status skipped by plan" "GET" "/api/ai-auditor/analyze/jobs/<job_id>" "403" "0" "$OUT_DIR/51-ai-auditor-async-start.json" "2xx_ai_disabled" "critical"
  else
    echo "No job_id returned by async start." > "$OUT_DIR/52-ai-auditor-async-status.json"
    record_result "ia-auditor" "IA Auditor async job status" "GET" "/api/ai-auditor/analyze/jobs/<job_id>" "500" "0" "$OUT_DIR/52-ai-auditor-async-status.json" "2xx" "critical"
  fi

  timed_call_user_jwt "reports" "Report async job endpoint protected" "GET" "/api/reports/jobs/00000000-0000-0000-0000-000000000000" "$OUT_DIR/53-report-job-status-missing.json" "" "200401404" "info"
fi

# 7. Uploads/logos
log "7) Static uploads/logos"
timed_head_public "uploads" "TCDX logo public asset" "/uploads/logos/tcdx-logo.png" "$OUT_DIR/60-logo.headers.txt" "2xx3xx" "warning"

# 8. Negative auth checks
log "8) Negative auth/security checks"
NEG1="$OUT_DIR/70-negative-health-dashboard-no-token.json"
NEG1_CODE="$(http_code GET "$BASE_URL/health/dashboard" "$NEG1" || true)"
record_result "negative" "No-token health dashboard should be 401" "GET" "/health/dashboard" "$NEG1_CODE" "0" "$NEG1" "401" "critical"

NEG2="$OUT_DIR/71-negative-bad-token-health-dashboard.json"
NEG2_CODE="$(http_code GET "$BASE_URL/health/dashboard" "$NEG2" -H "Authorization: Bearer invalid-token" || true)"
record_result "negative" "Bad-token health dashboard should be 401/403" "GET" "/health/dashboard" "$NEG2_CODE" "0" "$NEG2" "401403" "critical"

NEG3="$OUT_DIR/72-negative-ai-compliance-no-token.json"
NEG3_CODE="$(http_code GET "$BASE_URL/api/ai-compliance/health-summary" "$NEG3" || true)"
record_result "negative" "No-token IA Compliance backend should be 401/403" "GET" "/api/ai-compliance/health-summary" "$NEG3_CODE" "0" "$NEG3" "401403" "critical"

# 9. Optional SSH/systemd checks
if [[ "$RUN_SSH_CHECKS" = "true" ]]; then
  log "9) Optional SSH/systemd checks"
  ssh_check "ssh" "Backend service status" "$BACKEND_HOST" "systemctl is-active tecdex-backend && curl -sS http://localhost:3000 >/dev/null" "$OUT_DIR/80-ssh-backend.txt" "0" "critical"
  ssh_check "ssh" "AI Engine service status" "$AI_HOST" "systemctl is-active ai-engine && curl -sS http://localhost:8001/health >/dev/null" "$OUT_DIR/81-ssh-ai-engine.txt" "0" "critical"
  ssh_check "ssh" "Frontend service status" "$FRONTEND_HOST" "systemctl is-active tcdx-frontend && curl -sS http://localhost:8080 >/dev/null" "$OUT_DIR/82-ssh-frontend.txt" "0" "critical"
  ssh_check "ssh" "Nginx service status" "$FRONTEND_HOST" "systemctl is-active nginx && ss -tulpn | grep -q ':8443'" "$OUT_DIR/83-ssh-nginx.txt" "0" "critical"
  ssh_check "ssh" "DB port reachable from backend VM" "$BACKEND_HOST" "nc -vz $DB_HOST 5432" "$OUT_DIR/84-ssh-backend-db.txt" "0" "critical"
  ssh_check "ssh" "DB port reachable from AI VM" "$AI_HOST" "nc -vz $DB_HOST 5432" "$OUT_DIR/85-ssh-ai-db.txt" "0" "critical"
fi

# 10. Optional repo scan
if [[ "$RUN_REPO_SCAN" = "true" && -d ".git" ]]; then
  log "10) Optional repository scan"
  LEGACY_NET_PATTERN="$(printf '%s%s' '192\.168\.' '100')"
  LEGACY_NET_LABEL="$(printf '%s%s' '192.168.' '100')"
  REPO_LEGACY="$OUT_DIR/90-repo-legacy-private-net.txt"
  set +e
  git grep -n "$LEGACY_NET_PATTERN" > "$REPO_LEGACY" 2>&1
  GREP_RC="$?"
  set -e
  if [[ "$GREP_RC" = "0" ]]; then
    RUNTIME_LEGACY="$OUT_DIR/91-repo-runtime-legacy-private-net.txt"
    grep -vE '^(scripts/deploy-vms\.sh|scripts/test-tcdx-system-master\.sh|docs/|qa-results/)' "$REPO_LEGACY" > "$RUNTIME_LEGACY" || true
    if [[ -s "$RUNTIME_LEGACY" ]]; then
      record_result "repo-scan" "Runtime legacy private network references remain" "GREP" "$LEGACY_NET_LABEL" "200" "0" "$RUNTIME_LEGACY" "any" "warning"
    else
      record_result "repo-scan" "Legacy private network references are scanner/docs only" "GREP" "$LEGACY_NET_LABEL" "200" "0" "$REPO_LEGACY" "any" "info"
    fi
  else
    echo "No legacy private network references found." > "$REPO_LEGACY"
    record_result "repo-scan" "No legacy private network references found" "GREP" "$LEGACY_NET_LABEL" "200" "0" "$REPO_LEGACY" "200" "info"
  fi
fi

# 11. Summary
log "11) Building summary"
python3 - "$RESULTS_JSONL" "$SUMMARY_FILE" <<'PY'
import json, sys, pathlib
jsonl = pathlib.Path(sys.argv[1])
summary = pathlib.Path(sys.argv[2])

rows = []
for line in jsonl.read_text(encoding="utf-8", errors="replace").splitlines():
    if line.strip():
        rows.append(json.loads(line))

failures = [r for r in rows if r.get("status") == "FAIL"]
warnings = [r for r in rows if r.get("status") == "WARN"]
passes = [r for r in rows if r.get("status") == "PASS"]
infos = [r for r in rows if r.get("status") == "INFO"]
critical_failures = [r for r in failures if r.get("severity") == "critical"]

groups = {}
for r in rows:
    groups.setdefault(r.get("group", "other"), []).append(r)

lines = []
lines.append("TCDX ISO SaaS Master QA Summary")
lines.append("=" * 80)
lines.append(f"Total probes: {len(rows)}")
lines.append(f"PASS: {len(passes)}")
lines.append(f"WARN: {len(warnings)}")
lines.append(f"FAIL: {len(failures)}")
lines.append(f"INFO: {len(infos)}")
lines.append(f"Critical failures: {len(critical_failures)}")
lines.append("")

lines.append("Results by group:")
for group, items in sorted(groups.items()):
    p = sum(1 for r in items if r.get("status") == "PASS")
    w = sum(1 for r in items if r.get("status") == "WARN")
    f = sum(1 for r in items if r.get("status") == "FAIL")
    i = sum(1 for r in items if r.get("status") == "INFO")
    lines.append(f"- {group}: PASS={p} WARN={w} FAIL={f} INFO={i}")
lines.append("")

lines.append("Detailed results:")
for r in rows:
    flags = ",".join(r.get("flags") or [])
    lines.append(
        f"- {r.get('status')} | {r.get('group')} | HTTP {r.get('http_code')} | "
        f"{r.get('seconds')}s | {r.get('name')} | {r.get('path')} | flags={flags}"
    )
lines.append("")

lines.append("Critical failures:")
if not critical_failures:
    lines.append("- None.")
else:
    for r in critical_failures:
        lines.append(f"- {r.get('name')} | {r.get('path')} | HTTP {r.get('http_code')} | flags={','.join(r.get('flags') or [])}")
        lines.append(f"  File: {r.get('file')}")
        lines.append(f"  Preview: {(r.get('preview') or '')[:500]}")
lines.append("")

lines.append("Warnings:")
if not warnings:
    lines.append("- None.")
else:
    for r in warnings:
        lines.append(f"- {r.get('name')} | {r.get('path')} | HTTP {r.get('http_code')} | flags={','.join(r.get('flags') or [])}")
        lines.append(f"  File: {r.get('file')}")
        preview = (r.get("preview") or "")[:300]
        if preview:
            lines.append(f"  Preview: {preview}")
lines.append("")

slow = sorted([r for r in rows if isinstance(r.get("seconds"), (int, float)) and r.get("seconds", 0) >= 10], key=lambda x: x.get("seconds", 0), reverse=True)
lines.append("Slow probes >= 10s:")
if not slow:
    lines.append("- None.")
else:
    for r in slow:
        lines.append(f"- {r.get('seconds')}s | {r.get('name')} | {r.get('path')}")
lines.append("")

auditor = [r for r in rows if "IA Auditor" in (r.get("name") or "")]
if auditor:
    lines.append("IA Auditor timing:")
    for r in auditor:
        sec = r.get("seconds")
        verdict = "OK"
        if isinstance(sec, (int, float)) and sec > 60:
            verdict = "SLOW — async/job/model optimization recommended"
        elif isinstance(sec, (int, float)) and sec > 30:
            verdict = "MODERATE — monitor"
        lines.append(f"- {sec}s | {verdict}")
    lines.append("")

lines.append("Operational interpretation:")
lines.append("- /health must be a frontend page.")
lines.append("- /health/dashboard without token must return 401 JSON.")
lines.append("- /ai-engine/health must return minimal JSON health.")
lines.append("- Any HTML_RESPONSE in API calls indicates route/proxy/upstream error.")
lines.append("- Any legacy_error or UNEXPECTED_NO_TOKEN in AI suggestion responses indicates internal AI -> backend auth problem.")
lines.append("- Any legacy private network reference in runtime output indicates old routing/config remains.")
lines.append("- Public /ai-engine/docs and /ai-engine/openapi.json returning 200 is acceptable only for lab, not production.")
lines.append("- IA Auditor above 30s should be optimized; above 60s should move to async/job flow.")
lines.append("")

overall = "PASS"
if critical_failures:
    overall = "FAIL"
elif warnings:
    overall = "PASS_WITH_WARNINGS"
lines.append(f"OVERALL_STATUS={overall}")

summary.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(summary.read_text(encoding="utf-8"))
PY

log "============================================================"
log "Done."
log "Summary: $SUMMARY_FILE"
log "Artifacts: $OUT_DIR"
log "============================================================"

CRITICAL_FAILURES="$(python3 - "$RESULTS_JSONL" <<'PY'
import json, sys
count = 0
for line in open(sys.argv[1], encoding="utf-8"):
    if not line.strip():
        continue
    r = json.loads(line)
    if r.get("status") == "FAIL" and r.get("severity") == "critical":
        count += 1
print(count)
PY
)"

if [[ "$CRITICAL_FAILURES" != "0" ]]; then
  exit 2
fi

exit 0
