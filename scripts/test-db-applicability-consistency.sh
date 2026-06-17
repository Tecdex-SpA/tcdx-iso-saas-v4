#!/usr/bin/env bash
set -euo pipefail

: "${TCDX_BASE_URL:?TCDX_BASE_URL requerido, ej: http://localhost:3001}"
BASE_URL="$TCDX_BASE_URL"
EMAIL="${TCDX_EMAIL:-}"
PASSWORD="${TCDX_PASSWORD:-}"
OUT_DIR="${TCDX_OUT_DIR:-./qa-results/db-applicability-consistency/$(date +%Y%m%d-%H%M%S)}"
DATABASE_URL_VALUE="${DATABASE_URL:-${TCDX_DATABASE_URL:-}}"

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

login() {
  local login_file="$OUT_DIR/login.json"
  curl -k -sS -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    -o "$login_file"
  TOKEN="$(json_get "$login_file" token || json_get "$login_file" data.token || true)"
  [ -n "${TOKEN:-}" ] || fail "login sin token"
  pass "login OK"
}

api_get() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl -k -sS -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE_URL$path" -o "$out")"
  echo "$code" > "$out.status"
  [[ "$code" =~ ^2 ]] || fail "$path HTTP $code"
}

run_sql_checks() {
  if [ -z "$DATABASE_URL_VALUE" ]; then
    echo "[SKIP] DATABASE_URL/TCDX_DATABASE_URL no configurado; se omiten validaciones SQL directas." | tee "$OUT_DIR/sql-skip.txt"
    return 0
  fi

  local sql_file="$OUT_DIR/db-consistency.sql"
  cat > "$sql_file" <<'SQL'
\set ON_ERROR_STOP on
WITH duplicates AS (
  SELECT tenant_id, standard_code, tenant_control_id, control_catalog_id, control_code, lower(control_name) AS control_name, COUNT(*) AS count
  FROM tenant_applicable_controls
  WHERE active = true AND visible_to_tenant = true
  GROUP BY tenant_id, standard_code, tenant_control_id, control_catalog_id, control_code, lower(control_name)
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS controls_duplicates' ELSE 'FAIL controls_duplicates ' || COUNT(*) END FROM duplicates;

WITH duplicates AS (
  SELECT tenant_id, standard_code, kpi_definition_id, kpi_code, lower(kpi_name) AS kpi_name, COUNT(*) AS count
  FROM tenant_applicable_kpis
  WHERE active = true AND visible_to_tenant = true
  GROUP BY tenant_id, standard_code, kpi_definition_id, kpi_code, lower(kpi_name)
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS kpis_duplicates' ELSE 'FAIL kpis_duplicates ' || COUNT(*) END FROM duplicates;

WITH duplicates AS (
  SELECT tenant_id, standard_code, related_control_id, related_kpi_id, requirement_code, evidence_type, lower(evidence_name) AS evidence_name, COUNT(*) AS count
  FROM tenant_applicable_evidence_requirements
  WHERE active = true AND visible_to_tenant = true
  GROUP BY tenant_id, standard_code, related_control_id, related_kpi_id, requirement_code, evidence_type, lower(evidence_name)
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS evidence_duplicates' ELSE 'FAIL evidence_duplicates ' || COUNT(*) END FROM duplicates;

WITH duplicates AS (
  SELECT tenant_id, object_type, standard_code, object_id, object_code, lower(object_name) AS object_name, lower(exclusion_reason) AS reason, COUNT(*) AS count
  FROM tenant_applicability_exclusions
  WHERE active = true
  GROUP BY tenant_id, object_type, standard_code, object_id, object_code, lower(object_name), lower(exclusion_reason)
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS exclusions_duplicates' ELSE 'FAIL exclusions_duplicates ' || COUNT(*) END FROM duplicates;

WITH duplicates AS (
  SELECT tenant_id, tenant_control_id, standard_code, COUNT(*) AS count
  FROM v_control_health_risks_applicable
  GROUP BY tenant_id, tenant_control_id, standard_code
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS view_control_health_no_duplicates' ELSE 'FAIL view_control_health_no_duplicates ' || COUNT(*) END FROM duplicates;

WITH duplicates AS (
  SELECT tenant_id, kpi_code, standard_code, COUNT(*) AS count
  FROM v_latest_health_kpi_snapshots_applicable
  GROUP BY tenant_id, kpi_code, standard_code
  HAVING COUNT(*) > 1
)
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS view_kpi_no_duplicates' ELSE 'FAIL view_kpi_no_duplicates ' || COUNT(*) END FROM duplicates;

SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS ai_disabled_tenants_consistent' ELSE 'FAIL ai_disabled_tenants_consistent ' || COUNT(*) END
FROM tenants
WHERE ai_enabled = false
  AND (
    ai_plan <> 'none'
    OR ai_web_enabled <> false
    OR ai_report_enabled <> false
    OR ai_auditor_enabled <> false
    OR COALESCE((ai_features_json->>'company_profile_analysis')::boolean, true) <> false
    OR COALESCE((ai_features_json->>'report_enrichment')::boolean, true) <> false
    OR COALESCE((ai_features_json->>'auditor')::boolean, true) <> false
    OR COALESCE((ai_features_json->>'web_research')::boolean, true) <> false
    OR COALESCE((ai_features_json->>'document_generation')::boolean, true) <> false
    OR COALESCE((ai_features_json->>'suggestions')::boolean, true) <> false
  );
SQL

  psql "$DATABASE_URL_VALUE" -f "$sql_file" | tee "$OUT_DIR/db-consistency.txt"
  if grep -q '^FAIL' "$OUT_DIR/db-consistency.txt"; then
    fail "validaciones SQL de aplicabilidad fallaron"
  fi
  pass "validaciones SQL de aplicabilidad OK"
}

validate_api_metadata() {
  api_get "/health/dashboard" "$OUT_DIR/health-dashboard.json"
  api_get "/health/standards" "$OUT_DIR/health-standards.json"
  api_get "/api/company-profile/applicability/summary" "$OUT_DIR/applicability-summary.json"

  node - "$OUT_DIR/health-dashboard.json" "$OUT_DIR/health-standards.json" <<'NODE'
const fs = require('fs');
for (const file of process.argv.slice(2)) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const meta = json.scope || json.metadata || json.meta || {};
  if (meta.tenant_filter_enforced !== true && json.tenant_filter_enforced !== true) {
    throw new Error(`${file} no declara tenant_filter_enforced=true`);
  }
  if (!('applicability_universe_applied' in meta) && !('applicability_universe_applied' in json)) {
    throw new Error(`${file} no declara applicability_universe_applied`);
  }
}
NODE
  pass "metadata de endpoints health/applicability OK"
}

login
run_sql_checks
validate_api_metadata

echo "OK - resultados en $OUT_DIR"
