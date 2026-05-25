#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-}"
TENANT_ID="${TCDX_TENANT_ID:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/tenant-ai-entitlements/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD. El script no incluye credenciales por defecto." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

json_get() {
  python3 - "$1" "$2" <<'PY'
import json, sys
data=json.load(open(sys.argv[1]))
for part in sys.argv[2].split("."):
    if not part:
        continue
    data=data.get(part) if isinstance(data, dict) else None
print("" if data is None else data)
PY
}

curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$OUT_DIR/login.json"
TOKEN="$(json_get "$OUT_DIR/login.json" token)"
[ -n "$TOKEN" ] || { echo "ERROR: login sin token" >&2; exit 1; }

if [ -z "$TENANT_ID" ]; then
  curl -sk "$BASE_URL/api/admin-saas/tenants" \
    -H "Authorization: Bearer $TOKEN" \
    -o "$OUT_DIR/tenants.json"
  TENANT_ID="$(python3 - "$OUT_DIR/tenants.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
rows=d.get("data") or []
print(rows[0].get("tenant_id","") if rows else "")
PY
)"
fi
[ -n "$TENANT_ID" ] || { echo "ERROR: no se encontró tenant para probar" >&2; exit 1; }

disable_body='{"ai_enabled":false,"ai_plan":"none","ai_web_enabled":false,"ai_report_enabled":false,"ai_auditor_enabled":false,"ai_monthly_quota":0,"ai_features_json":{"company_profile_analysis":false,"report_enrichment":false,"auditor":false,"web_research":false,"document_generation":false,"suggestions":false}}'
enable_body='{"ai_enabled":true,"ai_plan":"standard","ai_web_enabled":true,"ai_report_enabled":true,"ai_auditor_enabled":true,"ai_monthly_quota":null,"ai_features_json":{"company_profile_analysis":true,"report_enrichment":true,"auditor":true,"web_research":true,"document_generation":true,"suggestions":true}}'

curl -sk -X PUT "$BASE_URL/api/admin-saas/tenants/$TENANT_ID/ai-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$disable_body" \
  -o "$OUT_DIR/ai-disabled.json"
python3 - "$OUT_DIR/ai-disabled.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
if d.get("ok") is not True or d.get("data",{}).get("ai_enabled") is not False:
    raise SystemExit("No se pudo deshabilitar IA del tenant")
PY

curl -sk -X POST "$BASE_URL/api/reports/generate/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"report_type_code":"executive_iso_status","period":"QA IA disabled","model_mode":"balanced","use_llm":true,"use_rag":true,"use_web":true,"quality":"premium"}' \
  -o "$OUT_DIR/report-start-ai-disabled.json"

curl -sk -X PUT "$BASE_URL/api/admin-saas/tenants/$TENANT_ID/ai-settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$enable_body" \
  -o "$OUT_DIR/ai-enabled.json"
python3 - "$OUT_DIR/ai-enabled.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
if d.get("ok") is not True or d.get("data",{}).get("ai_enabled") is not True:
    raise SystemExit("No se pudo rehabilitar IA del tenant")
PY

cat > "$OUT_DIR/summary.txt" <<EOF
OK tenant AI entitlements flow
base_url=$BASE_URL
tenant_id=$TENANT_ID
disabled_artifact=$OUT_DIR/ai-disabled.json
enabled_artifact=$OUT_DIR/ai-enabled.json
EOF

cat "$OUT_DIR/summary.txt"
