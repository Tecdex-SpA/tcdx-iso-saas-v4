# NORMALIZATION-02 — KPI / Health / UI

Status: `READY_FOR_HUMAN_REVIEW`

Fecha: 2026-09-01
Branch local: `main`
Base verificada: `4642ff103735c79581441e61b65591112283d1b8`
Commit Codex: `NO_COMMIT`
Push/Deploy: `NO`

## Scope

Continuación focal de NORMALIZATION-01 para Health/KPI/UI. No se reabrió RBAC, modelo comercial, planes, add-on IA, tenants, roles, scopes ni precios.

## Health Authority

```text
GLOBAL_HEALTH_AUTHORITY=official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings
GLOBAL_SCORE_FORMULA=F5_5_GRC_HEALTH
GLOBAL_SCORE_VERSION=2
GLOBAL_SCORE_COVERAGE_POLICY=available_weight/applicable_weight; publish only when coverage >= minimum_coverage
DATA_TRUST_ACCURACY_POLICY=accuracy remains NOT_CONFIGURED until a real measurable source or canonical binding exists
EVIDENCE_COVERAGE_MAPPING=EVIDENCE-FRESH=freshness; COVERAGE=compliance_coverage; EVIDENCE-COVERAGE=compatibility_alias_only
LEGACY_KPI_HLT_ROLE=COMPATIBILITY_SOURCE_COMPONENT
```

## Implemented

- `backend/src/services/math-governance/grcHealthCalculation.service.js` publica semántica v2 para `F5_5_GRC_HEALTH`: componentes `AVAILABLE/MISSING/NOT_APPLICABLE/NOT_CONFIGURED/STALE/INVALID/UNKNOWN`, denominador dinámico sólo para `AVAILABLE`, exclusión legítima de `NOT_APPLICABLE`, cobertura/confianza y score no publicable si cobertura < threshold.
- `backend/src/services/math-governance/canonicalHealthProjection.service.js` centraliza la lectura canónica para Health: score, estado, cobertura, confianza, componentes, faltantes, source, periodo y compatibilidad `KPI-HLT-*`.
- `backend/src/services/health.service.js` hace que `/api/health/summary`, `/api/health/dashboard` y `/api/health/kpis` usen la proyección canónica para el score global y conserven norma/proceso operativo como detalle.
- `backend/src/services/phase5/phase5.service.js` agrega `canonical_health` y `health` al read path de `/api/grc/overview` sin recalcular.
- `backend/src/services/indicators/indicatorGovernance.service.js` elimina la expectativa Health de `EVIDENCE-COVERAGE` y marca Health KPI canónicos: `GRC-HEALTH`, `EVIDENCE-FRESH`, `COVERAGE`, `DATA-TRUST`.
- `frontend/src/app/encuestas/page.tsx` elimina el `AppLayout` duplicado; `frontend/src/app/encuestas/layout.tsx` queda como shell único de ruta.
- `frontend/src/app/dashboard/page.tsx` y `frontend/src/components/health/IsoHealthPageClient.tsx` muestran Health canónico con cobertura/confianza/faltantes y rebajan `KPI-HLT-*` a compatibilidad operativa.

## Migration

```text
MIGRATION_REQUIRED=YES
MIGRATION_FILE=database/migrations/20260901_normalization02_kpi_health_ui.sql
RUNNER=scripts/normalization/apply-normalization-02-migration.js
CHECKSUM=b1daafdac3eda56dafd3cc47b655512bb34a88435a3954a5fd8de94c89f87da6
HISTORICAL_MIGRATIONS_MODIFIED=NO
PRODUCTION_WRITES=NO
```

La migración es forward-only: conserva `F5_5_GRC_HEALTH` v1, agrega v2, agrega variables/dependencias no estrictas, versiona `GRC-HEALTH` en `metric_definition_versions`, `metric_source_bindings` y `metric_calculation_policies`, y no crea una métrica oficial `EVIDENCE-COVERAGE`.

## Incidents

```text
INC02_NESTED_LAYOUT=FIXED_LOCAL
INC06_GLOBAL_SCORE=FIXED_LOCAL_WITH_GOVERNED_V2_AND_COVERAGE_POLICY
INC07_HEALTH_DIVERGENCE=FIXED_LOCAL_BY_CANONICAL_PROJECTION_AND_COMPATIBILITY_ROLE
```

## Postconditions

```text
NESTED_ENCUESTAS_LAYOUT=0
GLOBAL_HEALTH_AUTHORITIES=1
GLOBAL_SCORE_FORMULA_AUTHORITIES=1
EVIDENCE_COVERAGE_UNMAPPED_EXPECTATIONS=0
HEALTH_UI_PARALLEL_GLOBAL_SCORES=0
GLOBAL_SCORE_SUPPORTS_PARTIAL_AVAILABILITY=true
GLOBAL_SCORE_REPORTS_COVERAGE=true
GLOBAL_SCORE_REPORTS_CONFIDENCE=true
DATA_TRUST_UNKNOWN_BLOCKS_ENTIRE_GLOBAL_SCORE=false
GRC_OVERVIEW_READS_CANONICAL_HEALTH=true
DASHBOARD_READS_CANONICAL_HEALTH=true
HEALTH_PAGE_READS_CANONICAL_HEALTH=true
ISO_HEALTH_PAGE_READS_CANONICAL_HEALTH=true
DATA_TRUST_FORMULA_BLOCKER_UNRESOLVED=0
```

## Minimal Validation

Ejecutado localmente:

```text
git diff --check
node --check backend/src/services/math-governance/grcHealthCalculation.service.js
node --check backend/src/services/math-governance/formulaRegistry.service.js
node --check backend/src/services/math-governance/canonicalHealthProjection.service.js
node --check backend/src/services/health.service.js
node --check backend/src/services/indicators/indicatorGovernance.service.js
node --check backend/src/services/phase5/phase5.service.js
node --check scripts/normalization/apply-normalization-02-migration.js
node backend/src/services/math-governance/grcHealthCalculation.service.test.js
node backend/src/services/math-governance/canonicalHealthProjection.service.test.js
node frontend/scripts/check-normalization02-encuestas-layout.mjs
node scripts/normalization/apply-normalization-02-migration.test.js
node scripts/normalization/apply-normalization-02-migration.js --checksum
bash -n scripts/deploy-vms.sh
```

No ejecutado por alcance:

```text
full regression
lint/typecheck/build
Playwright/E2E
runtime tenant matrix
deploy validation
GO/NO-GO
```

## Remaining Debt

```text
NONE_WITHIN_NORMALIZATION02_SCOPE
```

## Next Gate

```text
HUMAN_REVIEW_THEN_RELEASE_CLOSEOUT
```
