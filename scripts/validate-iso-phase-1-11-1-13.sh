#!/usr/bin/env bash
set -euo pipefail

echo "Validando Fase 1.11-1.13: Consolidacion Operativa ISO"

bash scripts/validate-iso-unified-command-center.sh
bash scripts/validate-iso-auditor.sh
bash scripts/validate-iso-action-workflow.sh

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -c "
  SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
  UNION ALL SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
  UNION ALL SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
  UNION ALL SELECT 'evidences', COUNT(*) FROM evidences
  ORDER BY table_name;
  "
fi

echo "OK: Fase 1.11-1.13 validada correctamente."
