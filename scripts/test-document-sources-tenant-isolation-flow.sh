#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL_A="${TCDX_EMAIL:-}"
PASSWORD_A="${TCDX_PASSWORD:-}"
EMAIL_B="${TCDX_TENANT_B_EMAIL:-}"
PASSWORD_B="${TCDX_TENANT_B_PASSWORD:-}"
OUT_DIR="${TCDX_QA_OUT_DIR:-qa-results/document-sources-tenant-isolation/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

log() { printf '%s\n' "$*" | tee -a "$OUT_DIR/summary.txt"; }

json_value() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path))
except Exception:
    print("")
    sys.exit(0)
cur = data
for part in key.split('.'):
    if isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
print("" if cur is None else cur)
PY
}

request() {
  local method="$1"; shift
  local path="$1"; shift
  local out="$1"; shift
  local token="${1:-}"; shift || true
  local body="${1:-}"; shift || true
  local args=(-sS -k -X "$method" "$BASE_URL$path" -H "Accept: application/json" -o "$out" -w "%{http_code}")
  if [[ -n "$token" ]]; then args+=(-H "Authorization: Bearer $token"); fi
  if [[ -n "$body" ]]; then args+=(-H "Content-Type: application/json" --data "$body"); fi
  curl "${args[@]}"
}

login() {
  local email="$1" password="$2" out="$3"
  local code
  code="$(request POST "/api/auth/login" "$out" "" "{\"email\":\"$email\",\"password\":\"$password\"}")"
  if [[ "$code" != 2* ]]; then
    log "FAIL login $email HTTP $code"
    cat "$out" >> "$OUT_DIR/summary.txt" || true
    exit 1
  fi
  json_value "$out" token
}

assert_json_no_secret() {
  local file="$1"
  if grep -Eiq 'access_token|refresh_token|client_secret|password' "$file"; then
    log "FAIL secret leaked in $file"
    exit 1
  fi
}

TOKEN_A="$(login "$EMAIL_A" "$PASSWORD_A" "$OUT_DIR/login-a.json")"
log "PASS login tenant A"

code="$(request GET "/api/document-integrations/sources" "$OUT_DIR/sources-no-token.json")"
if [[ "$code" == 2* ]]; then
  log "FAIL sources without token returned $code"
  exit 1
fi
log "PASS sources require token HTTP $code"

create_body='{"provider":"local_agent","source_name":"QA local agent pending"}'
code="$(request POST "/api/document-integrations/sources" "$OUT_DIR/source-a-create.json" "$TOKEN_A" "$create_body")"
if [[ "$code" != 2* ]]; then
  log "FAIL create local_agent source HTTP $code"
  cat "$OUT_DIR/source-a-create.json" >> "$OUT_DIR/summary.txt" || true
  exit 1
fi
SOURCE_A="$(json_value "$OUT_DIR/source-a-create.json" source.id)"
log "PASS tenant A created local_agent source $SOURCE_A"
assert_json_no_secret "$OUT_DIR/source-a-create.json"

bad_body='{"provider":"mounted_share","source_name":"bad","folder_path":"../../etc"}'
code="$(request POST "/api/document-integrations/sources" "$OUT_DIR/mounted-bad-traversal.json" "$TOKEN_A" "$bad_body")"
if [[ "$code" != "400" && "$code" != "503" ]]; then
  log "FAIL mounted_share traversal expected 400/503 got $code"
  exit 1
fi
log "PASS mounted_share traversal blocked HTTP $code"

abs_body='{"provider":"mounted_share","source_name":"bad","folder_path":"/etc"}'
code="$(request POST "/api/document-integrations/sources" "$OUT_DIR/mounted-bad-absolute.json" "$TOKEN_A" "$abs_body")"
if [[ "$code" != "400" && "$code" != "503" ]]; then
  log "FAIL mounted_share absolute expected 400/503 got $code"
  exit 1
fi
log "PASS mounted_share absolute path blocked HTTP $code"

code="$(request GET "/api/document-integrations/zoho/oauth/start" "$OUT_DIR/zoho-start.json" "$TOKEN_A")"
if [[ "$code" == "503" ]]; then
  if [[ "$(json_value "$OUT_DIR/zoho-start.json" code)" != "ZOHO_CONNECTOR_NOT_CONFIGURED" ]]; then
    log "FAIL Zoho 503 without ZOHO_CONNECTOR_NOT_CONFIGURED"
    exit 1
  fi
  log "PASS Zoho not configured is controlled"
elif [[ "$code" == 2* ]]; then
  if grep -Eiq 'client_secret' "$OUT_DIR/zoho-start.json"; then
    log "FAIL Zoho response leaked client_secret"
    exit 1
  fi
  log "PASS Zoho configured returns authorization metadata"
else
  log "FAIL Zoho start unexpected HTTP $code"
  exit 1
fi

pair_body="{\"source_id\":\"$SOURCE_A\"}"
code="$(request POST "/api/document-integrations/agents/pairing-codes" "$OUT_DIR/pairing-code.json" "$TOKEN_A" "$pair_body")"
if [[ "$code" != 2* ]]; then
  log "FAIL create pairing code HTTP $code"
  exit 1
fi
PAIRING_CODE="$(json_value "$OUT_DIR/pairing-code.json" pairing_code)"
log "PASS pairing code created"

register_body="{\"pairing_code\":\"$PAIRING_CODE\",\"device_name\":\"qa-agent\",\"agent_version\":\"qa\"}"
code="$(request POST "/api/agent/register" "$OUT_DIR/agent-register.json" "" "$register_body")"
if [[ "$code" != 2* ]]; then
  log "FAIL agent register HTTP $code"
  exit 1
fi
AGENT_TOKEN="$(json_value "$OUT_DIR/agent-register.json" agent_token)"
log "PASS agent registered"

code="$(request POST "/api/agent/register" "$OUT_DIR/agent-register-reuse.json" "" "$register_body")"
if [[ "$code" == 2* ]]; then
  log "FAIL reused pairing code succeeded"
  exit 1
fi
log "PASS reused pairing code blocked HTTP $code"

code="$(request POST "/api/agent/heartbeat" "$OUT_DIR/agent-heartbeat.json" "$AGENT_TOKEN" '{"version":"qa"}')"
if [[ "$code" != 2* ]]; then
  log "FAIL agent heartbeat HTTP $code"
  exit 1
fi
log "PASS agent heartbeat"

manifest='{"tenant_id":"malicious","files":[{"file_name":"politica.pdf","relative_path":"politica.pdf","size_bytes":10,"modified_at":"2026-01-01T00:00:00Z","hash":"abc","mime_type":"application/pdf"}]}'
code="$(request POST "/api/agent/documents/index" "$OUT_DIR/agent-index.json" "$AGENT_TOKEN" "$manifest")"
if [[ "$code" != 2* ]]; then
  log "FAIL agent document index HTTP $code"
  exit 1
fi
log "PASS agent index ignores body tenant_id"

code="$(request POST "/api/agent/documents/index" "$OUT_DIR/agent-index-repeat.json" "$AGENT_TOKEN" "$manifest")"
if [[ "$code" != 2* ]]; then
  log "FAIL repeated agent document index HTTP $code"
  exit 1
fi
log "PASS repeated agent index is idempotent"

code="$(request POST "/api/agent/heartbeat" "$OUT_DIR/agent-heartbeat-invalid.json" "invalid-token" '{"version":"qa"}')"
if [[ "$code" == 2* ]]; then
  log "FAIL invalid agent token accepted"
  exit 1
fi
log "PASS invalid agent token blocked HTTP $code"

code="$(request DELETE "/api/document-integrations/sources/$SOURCE_A" "$OUT_DIR/source-a-disconnect.json" "$TOKEN_A")"
if [[ "$code" != 2* ]]; then
  log "FAIL disconnect source HTTP $code"
  exit 1
fi
log "PASS source disconnected without deleting history"

code="$(request POST "/api/document-integrations/sources/$SOURCE_A/sync" "$OUT_DIR/source-a-sync-after-disconnect.json" "$TOKEN_A" '{}')"
if [[ "$code" == 2* ]]; then
  log "FAIL disconnected source accepted sync"
  exit 1
fi
log "PASS disconnected source cannot sync HTTP $code"

if [[ -n "$EMAIL_B" && -n "$PASSWORD_B" ]]; then
  TOKEN_B="$(login "$EMAIL_B" "$PASSWORD_B" "$OUT_DIR/login-b.json")"
  code="$(request GET "/api/document-integrations/sources/$SOURCE_A" "$OUT_DIR/source-a-from-b.json" "$TOKEN_B")"
  if [[ "$code" == 2* ]]; then
    log "FAIL tenant B read tenant A source"
    exit 1
  fi
  log "PASS tenant B cannot read tenant A source HTTP $code"
else
  log "SKIP tenant B isolation checks; TCDX_TENANT_B_EMAIL/PASSWORD not provided"
fi

assert_json_no_secret "$OUT_DIR/agent-heartbeat.json"
assert_json_no_secret "$OUT_DIR/agent-index.json"
log "OVERALL_STATUS=PASS"

cat > "$OUT_DIR/sql-validation-notes.sql" <<'SQL'
-- Suggested DB checks after deploy:
-- SELECT tenant_id, provider, COUNT(*) FROM tenant_document_sources GROUP BY tenant_id, provider;
-- SELECT tenant_id, provider, COUNT(*) FROM document_index GROUP BY tenant_id, provider;
-- SELECT tenant_id, source_id, status, last_seen_at FROM tenant_sync_agents ORDER BY created_at DESC LIMIT 20;
SQL
