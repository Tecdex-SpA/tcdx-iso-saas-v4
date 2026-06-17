#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/controls-applicability/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD. El script no incluye credenciales por defecto." >&2
  exit 1
fi
mkdir -p "$OUT_DIR"

curl -sk -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" -o "$OUT_DIR/login.json"
TOKEN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token",""))' "$OUT_DIR/login.json")"
[ -n "$TOKEN" ] || { echo "ERROR: login sin token" >&2; exit 1; }

curl -sk "$BASE_URL/api/company-profile/applicability/controls" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/applicable-controls.json"
curl -sk "$BASE_URL/api/company-profile/applicability/exclusions" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/exclusions.json"
curl -sk "$BASE_URL/health/controls-risk" -H "Authorization: Bearer $TOKEN" -o "$OUT_DIR/health-controls-risk.json"

python3 - "$OUT_DIR/applicable-controls.json" "$OUT_DIR/health-controls-risk.json" <<'PY'
import json, sys
app = json.load(open(sys.argv[1]))
risk = json.load(open(sys.argv[2]))
if app.get("ok") is not True or risk.get("ok") is not True:
    raise SystemExit("respuesta controles no OK")
scope = risk.get("scope", {}).get("applicability_scope", {})
if scope.get("filtered_by_applicability_universe") is not True:
    raise SystemExit("health/controls-risk no declara filtro aplicable")
PY

echo "OK: artefactos en $OUT_DIR"
