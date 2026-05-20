#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-123456}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${TCDX_QA_OUT_DIR:-./qa-results/company-profile-flow/$STAMP}"

mkdir -p "$OUT_DIR"

TOKEN="$(curl -skS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')"

if [[ -z "$TOKEN" ]]; then
  echo "Login failed; token not returned" >&2
  exit 2
fi

auth_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local out="$4"
  if [[ -n "$payload" ]]; then
    curl -skS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      -o "$out"
  else
    curl -skS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -o "$out"
  fi
  python3 - "$out" <<'PY'
import json, sys
raw = open(sys.argv[1], "r", encoding="utf-8", errors="replace").read()
if raw.lstrip().startswith("<"):
    raise SystemExit("Expected JSON, received HTML")
json.loads(raw or "{}")
PY
}

PROFILE_PAYLOAD='{
  "profile_json": {
    "company_name": "QA Perfil Empresa",
    "industry": "servicios tecnológicos",
    "business_model": "Servicios gestionados y cumplimiento ISO",
    "audit_scope": "Procesos de soporte, operación y seguridad",
    "critical_processes": ["soporte", "operaciones", "seguridad"],
    "known_weaknesses": ["evidencia dispersa", "planes vencidos"]
  },
  "industry": "servicios tecnológicos",
  "subindustry": "SaaS",
  "company_size": "pyme",
  "allow_web_research": false,
  "allow_document_context": true,
  "allow_ai_recommendations": true
}'

auth_json PUT "/api/company-profile" "$PROFILE_PAYLOAD" "$OUT_DIR/save-profile.json"
auth_json POST "/api/company-profile/analyze" '{"model_mode":"balanced"}' "$OUT_DIR/analyze-profile.json"
auth_json POST "/api/company-profile/export-context-document" "" "$OUT_DIR/export-context.json"

DOWNLOAD_URL="$(python3 - "$OUT_DIR/export-context.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
print((data.get("data") or {}).get("download_url") or "/api/company-profile/context-document/download")
PY
)"

curl -skS -D "$OUT_DIR/context-document.headers.txt" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL$DOWNLOAD_URL" \
  -o "$OUT_DIR/contexto-de-la-organizacion.pdf"

python3 - "$OUT_DIR/context-document.headers.txt" "$OUT_DIR/contexto-de-la-organizacion.pdf" <<'PY'
import os, sys
headers = open(sys.argv[1], "r", encoding="utf-8", errors="replace").read().lower()
size = os.path.getsize(sys.argv[2])
if "content-type: application/pdf" not in headers:
    raise SystemExit("Download did not return application/pdf")
if size < 20 * 1024:
    raise SystemExit(f"PDF too small: {size} bytes")
print(f"PDF OK: {size} bytes")
PY

echo "Company profile flow QA artifacts: $OUT_DIR"
