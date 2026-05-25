#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-123456}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/ai-ui-entitlements/$(date +%Y%m%d-%H%M%S)}"

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

assert_json_expr() {
  python3 - "$1" "$2" <<'PY'
import json, sys
d=json.load(open(sys.argv[1]))
expr=sys.argv[2]
if not eval(expr, {"__builtins__": {}}, {"d": d}):
    raise SystemExit(f"ASSERT_FAILED {expr}")
PY
}

fetch_page() {
  local path="$1"
  local out_name="$2"
  curl -sk -L "$BASE_URL$path" \
    -H "Authorization: Bearer $TOKEN" \
    -o "$OUT_DIR/$out_name.html" \
    -w "%{http_code}" > "$OUT_DIR/$out_name.status"
}

echo "[1/7] Login"
curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$OUT_DIR/login.json"

TOKEN="$(json_get "$OUT_DIR/login.json" token)"
[ -n "$TOKEN" ] || { echo "ERROR: login no devolvió token" >&2; exit 1; }

echo "[2/7] Entitlements del tenant autenticado"
curl -sk "$BASE_URL/api/me/entitlements" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/entitlements.json"
assert_json_expr "$OUT_DIR/entitlements.json" "d.get('ok') is True"
assert_json_expr "$OUT_DIR/entitlements.json" "d.get('ai',{}).get('enabled') is False"
assert_json_expr "$OUT_DIR/entitlements.json" "d.get('ai',{}).get('plan') == 'none'"

echo "[3/7] Endpoints IA sensibles bloquean sin HTML"
curl -sk -X POST "$BASE_URL/api/company-profile/analyze/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"model_mode":"balanced"}' \
  -o "$OUT_DIR/company-profile-analyze-start.json"
assert_json_expr "$OUT_DIR/company-profile-analyze-start.json" "d.get('ok') is False and d.get('ai_disabled_by_plan') is True"
if grep -qi '<html' "$OUT_DIR/company-profile-analyze-start.json"; then
  echo "ERROR: endpoint IA devolvió HTML" >&2
  exit 1
fi

curl -sk -X POST "$BASE_URL/api/reports/generate/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"report_type_code":"executive_iso_status","period":"QA AI disabled UI","model_mode":"balanced","use_llm":true,"use_rag":true,"use_web":true,"quality":"premium"}' \
  -o "$OUT_DIR/report-generate-start.json"
if grep -qi '<html' "$OUT_DIR/report-generate-start.json"; then
  echo "ERROR: report endpoint devolvió HTML" >&2
  exit 1
fi

echo "[4/7] Páginas operativas siguen respondiendo"
for route in /dashboard /health /controles /administrar-kpis /auditorias /perfil-empresa; do
  name="$(echo "$route" | tr '/?' '__' | sed 's/^_//')"
  fetch_page "$route" "$name"
  status="$(cat "$OUT_DIR/$name.status")"
  case "$status" in
    2*|3*) ;;
    *) echo "ERROR: $route devolvió HTTP $status" >&2; exit 1 ;;
  esac
done

echo "[5/7] Rutas IA directas no exponen API HTML ni rompen navegación"
for route in /ia-compliance /ia-compliance/sugerencias '/auditorias?view=ia'; do
  name="$(echo "$route" | tr '/?' '__' | sed 's/^_//')"
  fetch_page "$route" "$name"
  status="$(cat "$OUT_DIR/$name.status")"
  case "$status" in
    2*|3*) ;;
    *) echo "ERROR: $route devolvió HTTP $status" >&2; exit 1 ;;
  esac
done

echo "[6/7] Tenant con IA habilitada opcional"
if [ -n "${TCDX_AI_EMAIL:-}" ] && [ -n "${TCDX_AI_PASSWORD:-}" ]; then
  curl -sk -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TCDX_AI_EMAIL\",\"password\":\"$TCDX_AI_PASSWORD\"}" \
    -o "$OUT_DIR/login-ai.json"
  AI_TOKEN="$(json_get "$OUT_DIR/login-ai.json" token)"
  [ -n "$AI_TOKEN" ] || { echo "ERROR: login tenant IA sin token" >&2; exit 1; }
  curl -sk "$BASE_URL/api/me/entitlements" \
    -H "Authorization: Bearer $AI_TOKEN" \
    -o "$OUT_DIR/entitlements-ai.json"
  assert_json_expr "$OUT_DIR/entitlements-ai.json" "d.get('ok') is True and d.get('ai',{}).get('enabled') is True"
else
  echo "SKIP: define TCDX_AI_EMAIL y TCDX_AI_PASSWORD para validar tenant con IA habilitada."
fi

cat > "$OUT_DIR/summary.txt" <<EOF
OK ai ui entitlements flow
base_url=$BASE_URL
email=$EMAIL
ai_enabled=$(json_get "$OUT_DIR/entitlements.json" ai.enabled)
ai_plan=$(json_get "$OUT_DIR/entitlements.json" ai.plan)
artifacts=$OUT_DIR
EOF

echo "[7/7] OK"
cat "$OUT_DIR/summary.txt"
