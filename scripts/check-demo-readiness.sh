#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-192.168.100.110}"
DB_NAME="${DB_NAME:-tecdex_saas}"
TENANT_ID="${TENANT_ID:-697eefa4-3b56-4c8a-a7d4-6d512c40233e}"

echo "======================================"
echo " TCDX DEMO READINESS CHECK"
echo "======================================"
echo "DB_HOST  : $DB_HOST"
echo "DB_NAME  : $DB_NAME"
echo "TENANT_ID: $TENANT_ID"
echo ""

ssh -t tecdex@"$DB_HOST" "sudo -u postgres psql -d $DB_NAME -v tenant_id='$TENANT_ID' <<'SQL'
\\pset border 2

SELECT
  'tenant' AS item,
  t.name,
  t.logo,
  t.logo_url
FROM tenants t
WHERE t.id = :'tenant_id'::uuid;

SELECT
  'users_by_role' AS item,
  role,
  COUNT(*) AS total
FROM users
WHERE tenant_id = :'tenant_id'::uuid
GROUP BY role
ORDER BY role;

SELECT
  'standards' AS item,
  standard_code,
  COUNT(*) AS total
FROM tenant_standards
WHERE tenant_id = :'tenant_id'::uuid
GROUP BY standard_code
ORDER BY standard_code;

SELECT
  'controls' AS item,
  COUNT(*) AS total
FROM tenant_controls
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'evidences' AS item,
  COUNT(*) AS total
FROM evidences
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'findings' AS item,
  COUNT(*) AS total
FROM findings
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'action_plans' AS item,
  COUNT(*) AS total
FROM action_plans
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'audits' AS item,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE normalize_status_for_audits(status) = 'pendiente') AS pendientes,
  COUNT(*) FILTER (WHERE normalize_status_for_audits(status) = 'en_ejecucion') AS en_ejecucion,
  COUNT(*) FILTER (WHERE normalize_status_for_audits(status) = 'completada') AS completadas
FROM audits
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'report_exports' AS item,
  COUNT(*) AS total
FROM report_exports
WHERE tenant_id = :'tenant_id'::uuid;

SELECT
  'kpi_snapshots' AS item,
  COUNT(*) AS total
FROM kpi_snapshots
WHERE tenant_id = :'tenant_id'::uuid;

SQL"
