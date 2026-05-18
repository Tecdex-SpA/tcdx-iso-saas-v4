#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-db.tcdx.int}"
DB_NAME="${DB_NAME:-tecdex_saas}"
SSH_USER="${SSH_USER:-tecdex}"

echo "DB_HOST=${DB_HOST}"
echo "DB_NAME=${DB_NAME}"

ssh "${SSH_USER}@${DB_HOST}" "sudo -u postgres psql -d '${DB_NAME}' -v ON_ERROR_STOP=1 <<'SQL'
\\pset border 2

WITH expected(relname, relkind) AS (
  VALUES
    ('audit_control_reviews', 'table'),
    ('ai_auditor_runs', 'table'),
    ('tenant_billing_settings', 'table'),
    ('tenant_monthly_preinvoices', 'table'),
    ('dealer_tenant_access', 'table'),
    ('dealer_tenants', 'table'),
    ('v_tenant_modules', 'view'),
    ('v_admin_saas_summary', 'view'),
    ('v_tenant_contract_overview', 'view')
)
SELECT
  expected.relname,
  CASE
    WHEN c.oid IS NULL THEN 'MISSING'
    WHEN c.relkind IN ('r', 'p') THEN 'table'
    WHEN c.relkind = 'v' THEN 'view'
    WHEN c.relkind = 'm' THEN 'materialized_view'
    ELSE c.relkind::text
  END AS status
FROM expected
LEFT JOIN pg_class c
  ON c.oid = to_regclass('public.' || expected.relname)
ORDER BY expected.relname;

WITH expected(proname) AS (
  VALUES
    ('refresh_tenant_control_health'),
    ('refresh_control_health_scores_v2_1'),
    ('refresh_kpi_health_snapshots'),
    ('user_has_permission'),
    ('log_admin_audit_event')
)
SELECT
  expected.proname,
  CASE WHEN p.oid IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected
LEFT JOIN pg_proc p
  ON p.proname = expected.proname
ORDER BY expected.proname;
SQL"
