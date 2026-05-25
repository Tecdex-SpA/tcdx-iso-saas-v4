#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/health-applicability/$(date +%Y%m%d-%H%M%S)}"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD en el entorno. El script no incluye credenciales por defecto." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

json_get() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path = sys.argv[2].split(".")
try:
    data = json.load(open(sys.argv[1]))
    for part in path:
        if not part:
            continue
        if isinstance(data, dict):
            data = data.get(part)
        else:
            data = None
            break
    if isinstance(data, (dict, list)):
        print(json.dumps(data, ensure_ascii=False))
    else:
        print("" if data is None else data)
except Exception:
    print("")
PY
}

assert_json() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
expr = sys.argv[2]
if not eval(expr, {"__builtins__": {}}, {"d": data}):
    raise SystemExit(f"ASSERT_FAILED: {expr}")
PY
}

count_rows() {
  python3 - "$1" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
    rows = data.get("data", [])
    print(len(rows) if isinstance(rows, list) else 0)
except Exception:
    print(0)
PY
}

echo "[1/5] Login"
curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$OUT_DIR/login.json"

TOKEN="$(json_get "$OUT_DIR/login.json" token)"
if [ -z "$TOKEN" ]; then
  echo "ERROR: login no devolvió token" >&2
  exit 1
fi

echo "[2/5] Consultar health dashboard"
curl -sk "$BASE_URL/health/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/health-dashboard.json"
assert_json "$OUT_DIR/health-dashboard.json" "d.get('ok') is True"

echo "[3/5] Consultar health standards"
curl -sk "$BASE_URL/health/standards" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/health-standards.json"
if grep -qi "standardCode is not defined" "$OUT_DIR/health-standards.json"; then
  echo "ERROR: /health/standards devolvió standardCode is not defined" >&2
  exit 1
fi
assert_json "$OUT_DIR/health-standards.json" "d.get('ok') is True"

echo "[4/7] Consultar health kpis, controls-risk, refresh y aplicabilidad"
curl -sk "$BASE_URL/health/kpis" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/health-kpis.json"
assert_json "$OUT_DIR/health-kpis.json" "d.get('ok') is True"

curl -sk "$BASE_URL/health/controls-risk" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/health-controls-risk.json"
assert_json "$OUT_DIR/health-controls-risk.json" "d.get('ok') is True"

curl -sk -X POST "$BASE_URL/health/refresh" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/health-refresh.json"
assert_json "$OUT_DIR/health-refresh.json" "d.get('ok') is True"

curl -sk "$BASE_URL/api/company-profile/applicability/summary" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/applicability-summary.json"
assert_json "$OUT_DIR/applicability-summary.json" "d.get('ok') is True"
for f in "$OUT_DIR/health-dashboard.json" "$OUT_DIR/health-standards.json" "$OUT_DIR/health-kpis.json" "$OUT_DIR/health-controls-risk.json"; do
  if grep -qi "RBAC_DENIED\|ReferenceError\|standardCode is not defined" "$f"; then
    echo "ERROR: respuesta inválida en $f" >&2
    exit 1
  fi
  assert_json "$f" "'applicability_universe_applied' in d.get('scope',{}).get('applicability_scope',{})"
  assert_json "$f" "'active_universe' in d.get('scope',{}).get('applicability_scope',{})"
  assert_json "$f" "d.get('scope',{}).get('applicability_scope',{}).get('tenant_filter_enforced') is True"
done
assert_json "$OUT_DIR/health-refresh.json" "'applicability_universe_applied' in d"
assert_json "$OUT_DIR/health-refresh.json" "'fallback_legacy_used' in d"

dashboard_rows="$(count_rows "$OUT_DIR/health-dashboard.json")"
standards_rows="$(count_rows "$OUT_DIR/health-standards.json")"
kpis_rows="$(count_rows "$OUT_DIR/health-kpis.json")"
controls_risk_rows="$(count_rows "$OUT_DIR/health-controls-risk.json")"
refresh_active_universe="$(json_get "$OUT_DIR/health-refresh.json" active_universe)"
active_universe="$(json_get "$OUT_DIR/applicability-summary.json" data.active_universe)"
applicable_controls_count="$(json_get "$OUT_DIR/applicability-summary.json" data.applicable_controls_count)"
exclusions_count="$(json_get "$OUT_DIR/applicability-summary.json" data.exclusions_count)"

cat > "$OUT_DIR/summary.txt" <<EOF
OK health applicability flow
base_url=$BASE_URL
dashboard_rows=$dashboard_rows
standards_rows=$standards_rows
kpis_rows=$kpis_rows
controls_risk_rows=$controls_risk_rows
refresh_active_universe=$refresh_active_universe
active_universe=$active_universe
applicable_controls_count=$applicable_controls_count
exclusions_count=$exclusions_count
EOF

echo "[5/7] OK metadata y errores"
echo "[6/7] Refresh OK"
echo "[7/7] OK"
cat "$OUT_DIR/summary.txt"
