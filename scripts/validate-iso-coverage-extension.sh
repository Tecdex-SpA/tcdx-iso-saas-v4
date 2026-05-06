#!/usr/bin/env bash
set -Eeuo pipefail

DB_URL="${DATABASE_URL:-}"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL no está definido."
  exit 1
fi

echo "========================================"
echo "Validación P1.C - Extensión cobertura ISO"
echo "========================================"

echo ""
echo "1) Conteos críticos que NO deben cambiar"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT 'standards' AS table_name, COUNT(*) FROM standards
UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL SELECT 'evidences', COUNT(*) FROM evidences
ORDER BY table_name;
"

echo ""
echo "2) Cobertura normativa-operativa"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT *
FROM v_iso_control_catalog_coverage
WHERE
  (standard_code = 'ISO9001' AND version_code IN ('2015', '2026_FDIS'))
  OR (standard_code = 'ISO27001' AND version_code = '2022')
  OR (standard_code = 'ISO42001' AND version_code = '2023')
ORDER BY standard_code, version_code;
"

echo ""
echo "3) Controles aún sin link"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  ic.standard_code,
  ic.version_code,
  ic.control_code,
  ic.title
FROM iso_controls ic
LEFT JOIN iso_control_catalog_links l
  ON l.iso_control_id = ic.id
 AND l.is_active IS TRUE
WHERE ic.is_active IS TRUE
  AND l.id IS NULL
  AND (
    (ic.standard_code = 'ISO9001' AND ic.version_code = '2015')
    OR (ic.standard_code = 'ISO27001' AND ic.version_code = '2022')
    OR (ic.standard_code = 'ISO42001' AND ic.version_code = '2023')
  )
ORDER BY ic.standard_code, ic.version_code, ic.control_code;
"

echo ""
echo "4) Estado sync controls_catalog"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  standard_code,
  version_code,
  sync_target,
  sync_status,
  linked_controls_count,
  total_iso_controls_count,
  last_checked_at,
  notes
FROM iso_catalog_sync_status
WHERE sync_target = 'controls_catalog'
  AND (
    (standard_code = 'ISO9001' AND version_code IN ('2015', '2026_FDIS'))
    OR (standard_code = 'ISO27001' AND version_code = '2022')
    OR (standard_code = 'ISO42001' AND version_code = '2023')
  )
ORDER BY standard_code, version_code;
"

echo ""
echo "5) Controles globales ISO42001 creados"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  iso,
  clause,
  category,
  LEFT(description, 90) AS description_sample,
  source_type,
  tenant_id,
  is_active
FROM controls_catalog
WHERE iso = 'ISO42001'
  AND tenant_id IS NULL
  AND source_type = 'generic'
ORDER BY clause;
"

echo ""
echo "6) Verificación anti-tenant"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  'tenant_controls' AS table_name,
  COUNT(*) AS count
FROM tenant_controls
UNION ALL
SELECT
  'evidences',
  COUNT(*)
FROM evidences
UNION ALL
SELECT
  'tenant_standards',
  COUNT(*)
FROM tenant_standards;
"

echo ""
echo "OK: Validación P1.C ejecutada."
