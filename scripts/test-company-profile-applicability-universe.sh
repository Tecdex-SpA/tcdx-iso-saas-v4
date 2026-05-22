#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TCDX_BASE_URL:-https://181.212.166.187:8443}"
EMAIL="${TCDX_EMAIL:-admin@rieltec.com}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/company-profile-applicability/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$OUT_DIR"

if [ -z "$PASSWORD" ]; then
  echo "ERROR: define TCDX_PASSWORD en el entorno. El script no incluye credenciales por defecto." >&2
  exit 1
fi

json_get() {
  python3 - "$1" "$2" <<'PY'
import json, sys
path = sys.argv[2].split(".")
try:
    data = json.load(open(sys.argv[1]))
    for part in path:
        if part == "":
            continue
        data = data.get(part, {}) if isinstance(data, dict) else {}
    if isinstance(data, (dict, list)):
        print(json.dumps(data, ensure_ascii=False))
    else:
        print("" if data is None else data)
except Exception:
    print("")
PY
}

assert_json_bool() {
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

echo "[1/8] Login"
curl -sk -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$OUT_DIR/login.json"

TOKEN="$(json_get "$OUT_DIR/login.json" token)"
if [ -z "$TOKEN" ]; then
  echo "ERROR: login no devolvió token" >&2
  exit 1
fi

echo "[2/8] Guardar perfil empresa de prueba"
curl -sk -X PUT "$BASE_URL/api/company-profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "company_name":"Tenant QA Aplicabilidad",
    "industry":"Servicios TI",
    "subindustry":"SaaS y soporte gestionado",
    "company_size":"pyme",
    "current_maturity_level":"inicial",
    "risk_appetite":"bajo",
    "active_standards":["ISO9001","ISO27001"],
    "audit_scope":"Servicios tecnológicos, soporte, continuidad, seguridad, gestión de cambios y satisfacción cliente",
    "excluded_scope":["manufactura física","inocuidad alimentaria","calibración metrológica"],
    "critical_processes":["soporte al cliente","gestión de cambios","seguridad de accesos","continuidad y respaldos"],
    "main_products_services":["SaaS","soporte TI","servicios gestionados"],
    "allow_web_research":true,
    "allow_document_context":true,
    "allow_ai_recommendations":true
  }' \
  -o "$OUT_DIR/profile-save.json"
assert_json_bool "$OUT_DIR/profile-save.json" "d.get('ok') is True"

echo "[3/8] Reconstruir universo aplicable"
curl -sk -X POST "$BASE_URL/api/company-profile/applicability/rebuild" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"force_rebuild":true}' \
  -o "$OUT_DIR/rebuild.json"
assert_json_bool "$OUT_DIR/rebuild.json" "d.get('ok') is True and d.get('tenant_filter_enforced') is True and d.get('filtered_by_tenant_id') is True"

echo "[4/8] Consultar summary"
curl -sk "$BASE_URL/api/company-profile/applicability/summary" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUT_DIR/summary.json"
assert_json_bool "$OUT_DIR/summary.json" "d.get('ok') is True and d.get('data',{}).get('tenant_filter_enforced') is True and d.get('data',{}).get('filtered_by_tenant_id') is True"

echo "[5/8] Consultar controles, KPIs, evidencias y exclusiones"
for endpoint in controls kpis evidence-requirements exclusions; do
  curl -sk "$BASE_URL/api/company-profile/applicability/$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -o "$OUT_DIR/$endpoint.json"
  assert_json_bool "$OUT_DIR/$endpoint.json" "d.get('ok') is True and d.get('tenant_filter_enforced') is True and d.get('filtered_by_tenant_id') is True"
done

assert_json_bool "$OUT_DIR/controls.json" "d.get('total', 0) > 0"
assert_json_bool "$OUT_DIR/kpis.json" "d.get('total', 0) > 0"

echo "[6/8] Validar endpoints module/*"
for module in dashboard health controls kpis audits action-plans reports; do
  curl -sk "$BASE_URL/api/company-profile/impact/module/$module" \
    -H "Authorization: Bearer $TOKEN" \
    -o "$OUT_DIR/module-$module.json"
  assert_json_bool "$OUT_DIR/module-$module.json" "d.get('ok') is True and d.get('tenant_filter_enforced') is True and d.get('company_profile_used') is True"
done

echo "[7/8] Exportar Contexto de la organización"
curl -sk -X POST "$BASE_URL/api/company-profile/export-context-document" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -o "$OUT_DIR/export.json"
assert_json_bool "$OUT_DIR/export.json" "d.get('ok') is True"

echo "[8/8] Descargar PDF"
curl -sk -D "$OUT_DIR/headers.txt" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/company-profile/context-document/download" \
  -o "$OUT_DIR/contexto-organizacion.pdf"

if ! grep -qi 'content-type: application/pdf' "$OUT_DIR/headers.txt"; then
  echo "ERROR: descarga no devolvió application/pdf" >&2
  exit 1
fi

PDF_SIZE="$(wc -c < "$OUT_DIR/contexto-organizacion.pdf" | tr -d ' ')"
if [ "${PDF_SIZE:-0}" -lt 51200 ]; then
  echo "ERROR: PDF demasiado pequeño: $PDF_SIZE bytes" >&2
  exit 1
fi

cat > "$OUT_DIR/summary.txt" <<EOF
OK company profile applicability universe
base_url=$BASE_URL
out_dir=$OUT_DIR
pdf_size=$PDF_SIZE

SQL sugerido post-deploy:
select tenant_id, active, visible_to_tenant, count(*)
from tenant_applicable_controls
group by tenant_id, active, visible_to_tenant
order by count(*) desc;

select tenant_id, object_type, count(*)
from tenant_applicability_exclusions
where active = true
group by tenant_id, object_type
order by tenant_id, object_type;
EOF

echo "OK: artefactos en $OUT_DIR"
