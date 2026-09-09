# DB-N01..DB-N05 Final Review Change Inventory

Generated: 2026-09-09

## Precheck

- Branch: `codex/db-n01-control-identity-normalization`
- HEAD: `11003dd92385dcca1caf5365fa437be3aee1f648`
- Staging: not modified by this review package
- SHA/Patch scope: DB-N01..DB-N05 working tree files, excluding `artifacts/db-integral/final-review/` and final tarball to avoid self-reference

## git status --short

```text
 M .gitignore
 M backend/src/app.js
 M backend/src/config/db.js
 M backend/src/controllers/kpi.controller.js
 M backend/src/controllers/search.controller.js
 M backend/src/middleware/auth.js
 M backend/src/reports/services/reportCoverage.service.js
 M backend/src/reports/services/reportData.service.js
 M backend/src/routes/action-plans.routes.js
 M backend/src/routes/admin-saas.routes.js
 M backend/src/routes/ai-auditor.routes.js
 M backend/src/routes/ai-compliance.routes.js
 M backend/src/routes/controls.routes.js
 M backend/src/routes/dashboard-controls.routes.js
 M backend/src/routes/diagnostic.routes.js
 M backend/src/routes/document-integrations.routes.js
 M backend/src/routes/evidences.routes.js
 M backend/src/routes/findings.routes.js
 M backend/src/routes/health.js
 M backend/src/routes/lifecycle.routes.js
 M backend/src/routes/report.routes.js
 M backend/src/routes/reports.routes.js
 M backend/src/routes/soa.routes.js
 M backend/src/services/companyProfileApplicabilityEngine.service.js
 M backend/src/services/diagnostic.service.js
 M backend/src/services/diagnosticAcceptance.service.js
 M backend/src/services/evidence-ai.service.js
 M backend/src/services/grc/grc.service.js
 M backend/src/services/grc/grc.service.test.js
 M backend/src/services/grc/grcSchedulerRunner.js
 M backend/src/services/grc/phase2SchedulerRunner.js
 M backend/src/services/indicators/indicatorGovernance.service.js
 M backend/src/services/isoExpressDiagnostic.service.js
 M backend/src/services/isoKnowledge.service.js
 M backend/src/services/isoOperationalExecution.service.js
 M backend/src/services/isoRecommendedActions.service.js
 M backend/src/services/isoRiskMatrix.service.js
 M backend/src/services/math-governance/canonicalHealthProjection.service.js
 M backend/src/services/math-governance/canonicalHealthProjection.service.test.js
 M backend/src/services/math-governance/formulaRegistry.service.js
 M backend/src/services/math-governance/grcDecisionCenter.test.js
 M backend/src/services/math-governance/grcHealthCalculation.service.test.js
 M backend/src/services/math-governance/officialCalculationOrchestrator.service.js
 M backend/src/services/math-governance/phase5Package4.test.js
 M backend/src/services/math-governance/phase5Package4Jobs.service.js
 M backend/src/services/math-governance/sourceContracts.service.js
 M backend/src/services/math-governance/sourceResolver.service.js
 M backend/src/services/soaIntelligence.service.js
 M backend/src/services/soaIntelligence.service.test.js
 M backend/src/utils/soaControlResolver.js
 M docs/codex/ARCHITECTURE_MAP.md
 M docs/codex/CONTRACTS_REGISTRY.md
 M docs/codex/CURRENT_STATE.md
 M docs/codex/DECISIONS.md
 M docs/codex/WORK_QUEUE.md
 M frontend/src/app/administrar-kpis/page.tsx
 M frontend/src/app/dashboard/page.tsx
 M frontend/src/app/hallazgos/page.tsx
 M frontend/src/app/soa/page.tsx
 M frontend/src/i18n/dictionaries/en.json
 M frontend/src/i18n/dictionaries/es.json
?? artifacts/db-integral/
?? artifacts/db-n02/
?? artifacts/db-n03/
?? artifacts/db-n04/
?? artifacts/db-n05/
?? backend/src/routes/controlIdentityRoutes.test.js
?? backend/src/utils/dbTenantContext.js
?? backend/src/utils/dbTenantContext.test.js
?? backend/src/utils/tenantControlIdentity.js
?? backend/src/utils/tenantControlIdentity.test.js
?? database/baseline/
?? database/migrations/20260904_dbn01_control_identity_normalization.sql
?? database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql
?? database/migrations/20260907_dbn03_multitenant_integrity_rls.sql
?? database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql
?? database/reference/
?? docs/codex/handoffs/DB-N05.md
?? docs/handoffs/
?? docs/runbooks/PRODUCTION_DATABASE_CREATION.md
?? scripts/normalization/apply-db-n01-control-identity-migration.test.js
?? scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js
?? scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js
?? scripts/normalization/apply-db-n04-runtime-tenant-cleanup-migration.test.js
?? scripts/normalization/apply-db-n05-production-baseline.test.js
?? scripts/normalization/db-integral-formula-lineage.postgres.test.js
?? scripts/normalization/db-integral-zero-legacy.postgres.test.js
?? scripts/normalization/db-integral-zero-legacy.test.js
?? scripts/normalization/db-n01-control-identity.postgres.test.js
?? scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js
?? scripts/normalization/db-n03-multitenant-integrity.postgres.test.js
?? scripts/normalization/db-n04-runtime-tenant-cleanup.postgres.test.js
?? scripts/normalization/db-n05-export-qa-reference-catalogs.sql
?? scripts/normalization/db-n05-fresh-production.postgres.test.js
?? scripts/normalization/db-n05-isolated-postgres.js
?? scripts/normalization/db-n05-materialize-qa-reference-catalogs.py
?? scripts/normalization/db-n05-production-role-privileges.postgres.test.js
?? scripts/normalization/db-n05-qa-reference-export-contract.test.js
?? scripts/normalization/db-n05-readonly-qa-preflight.sql
?? scripts/normalization/db-n05-reference-catalogs.test.js
?? scripts/normalization/db-n05-reference-loader-gating.test.js
?? scripts/normalization/db-n05-runtime-schema-contract.test.js
?? scripts/normalization/fixtures/
?? scripts/normalization/load-production-reference-catalogs.js
```

## git diff --stat

```text
 .gitignore                                         |   6 +
 backend/src/app.js                                 |   2 +
 backend/src/config/db.js                           |   3 +-
 backend/src/controllers/kpi.controller.js          |  20 +-
 backend/src/controllers/search.controller.js       |   9 +-
 backend/src/middleware/auth.js                     |  35 ++-
 .../src/reports/services/reportCoverage.service.js |   7 +-
 backend/src/reports/services/reportData.service.js |   5 -
 backend/src/routes/action-plans.routes.js          | 131 +++++++--
 backend/src/routes/admin-saas.routes.js            |  21 +-
 backend/src/routes/ai-auditor.routes.js            |  10 +-
 backend/src/routes/ai-compliance.routes.js         |  43 +--
 backend/src/routes/controls.routes.js              | 110 +++----
 backend/src/routes/dashboard-controls.routes.js    |  23 +-
 backend/src/routes/diagnostic.routes.js            |  10 +-
 backend/src/routes/document-integrations.routes.js |   6 +-
 backend/src/routes/evidences.routes.js             | 165 ++++++-----
 backend/src/routes/findings.routes.js              | 223 +++-----------
 backend/src/routes/health.js                       | 106 +++----
 backend/src/routes/lifecycle.routes.js             |  19 +-
 backend/src/routes/report.routes.js                |  32 +-
 backend/src/routes/reports.routes.js               |   2 +-
 backend/src/routes/soa.routes.js                   | 215 ++++----------
 .../companyProfileApplicabilityEngine.service.js   |   9 +-
 backend/src/services/diagnostic.service.js         |  12 +-
 .../src/services/diagnosticAcceptance.service.js   |  20 +-
 backend/src/services/evidence-ai.service.js        | 321 +++++++++++----------
 backend/src/services/grc/grc.service.js            |  13 +-
 backend/src/services/grc/grc.service.test.js       |  14 +
 backend/src/services/grc/grcSchedulerRunner.js     |  36 ++-
 backend/src/services/grc/phase2SchedulerRunner.js  |  62 ++--
 .../indicators/indicatorGovernance.service.js      |   6 +-
 .../src/services/isoExpressDiagnostic.service.js   |  18 +-
 backend/src/services/isoKnowledge.service.js       |  32 +-
 .../services/isoOperationalExecution.service.js    |  56 ++--
 .../src/services/isoRecommendedActions.service.js  |  14 +-
 backend/src/services/isoRiskMatrix.service.js      |  18 +-
 .../canonicalHealthProjection.service.js           | 167 +++++++++--
 .../canonicalHealthProjection.service.test.js      | 101 ++++++-
 .../math-governance/formulaRegistry.service.js     |   2 +-
 .../math-governance/grcDecisionCenter.test.js      |   7 +-
 .../grcHealthCalculation.service.test.js           |   4 +-
 .../officialCalculationOrchestrator.service.js     |   7 +-
 .../math-governance/phase5Package4.test.js         |  11 +-
 .../math-governance/phase5Package4Jobs.service.js  |  17 +-
 .../math-governance/sourceContracts.service.js     |   4 +-
 .../math-governance/sourceResolver.service.js      |  39 ++-
 backend/src/services/soaIntelligence.service.js    | 172 +++++------
 .../src/services/soaIntelligence.service.test.js   |  26 +-
 backend/src/utils/soaControlResolver.js            |  68 ++---
 docs/codex/ARCHITECTURE_MAP.md                     |  42 +++
 docs/codex/CONTRACTS_REGISTRY.md                   |  97 +++++++
 docs/codex/CURRENT_STATE.md                        | 108 +++++++
 docs/codex/DECISIONS.md                            |  58 ++++
 docs/codex/WORK_QUEUE.md                           |  12 +
 frontend/src/app/administrar-kpis/page.tsx         |  76 +----
 frontend/src/app/dashboard/page.tsx                |   5 +-
 frontend/src/app/hallazgos/page.tsx                |   1 -
 frontend/src/app/soa/page.tsx                      |   1 -
 frontend/src/i18n/dictionaries/en.json             |  16 -
 frontend/src/i18n/dictionaries/es.json             |  16 -
 61 files changed, 1566 insertions(+), 1325 deletions(-)
```

## git diff --name-status

```text
M	.gitignore
M	backend/src/app.js
M	backend/src/config/db.js
M	backend/src/controllers/kpi.controller.js
M	backend/src/controllers/search.controller.js
M	backend/src/middleware/auth.js
M	backend/src/reports/services/reportCoverage.service.js
M	backend/src/reports/services/reportData.service.js
M	backend/src/routes/action-plans.routes.js
M	backend/src/routes/admin-saas.routes.js
M	backend/src/routes/ai-auditor.routes.js
M	backend/src/routes/ai-compliance.routes.js
M	backend/src/routes/controls.routes.js
M	backend/src/routes/dashboard-controls.routes.js
M	backend/src/routes/diagnostic.routes.js
M	backend/src/routes/document-integrations.routes.js
M	backend/src/routes/evidences.routes.js
M	backend/src/routes/findings.routes.js
M	backend/src/routes/health.js
M	backend/src/routes/lifecycle.routes.js
M	backend/src/routes/report.routes.js
M	backend/src/routes/reports.routes.js
M	backend/src/routes/soa.routes.js
M	backend/src/services/companyProfileApplicabilityEngine.service.js
M	backend/src/services/diagnostic.service.js
M	backend/src/services/diagnosticAcceptance.service.js
M	backend/src/services/evidence-ai.service.js
M	backend/src/services/grc/grc.service.js
M	backend/src/services/grc/grc.service.test.js
M	backend/src/services/grc/grcSchedulerRunner.js
M	backend/src/services/grc/phase2SchedulerRunner.js
M	backend/src/services/indicators/indicatorGovernance.service.js
M	backend/src/services/isoExpressDiagnostic.service.js
M	backend/src/services/isoKnowledge.service.js
M	backend/src/services/isoOperationalExecution.service.js
M	backend/src/services/isoRecommendedActions.service.js
M	backend/src/services/isoRiskMatrix.service.js
M	backend/src/services/math-governance/canonicalHealthProjection.service.js
M	backend/src/services/math-governance/canonicalHealthProjection.service.test.js
M	backend/src/services/math-governance/formulaRegistry.service.js
M	backend/src/services/math-governance/grcDecisionCenter.test.js
M	backend/src/services/math-governance/grcHealthCalculation.service.test.js
M	backend/src/services/math-governance/officialCalculationOrchestrator.service.js
M	backend/src/services/math-governance/phase5Package4.test.js
M	backend/src/services/math-governance/phase5Package4Jobs.service.js
M	backend/src/services/math-governance/sourceContracts.service.js
M	backend/src/services/math-governance/sourceResolver.service.js
M	backend/src/services/soaIntelligence.service.js
M	backend/src/services/soaIntelligence.service.test.js
M	backend/src/utils/soaControlResolver.js
M	docs/codex/ARCHITECTURE_MAP.md
M	docs/codex/CONTRACTS_REGISTRY.md
M	docs/codex/CURRENT_STATE.md
M	docs/codex/DECISIONS.md
M	docs/codex/WORK_QUEUE.md
M	frontend/src/app/administrar-kpis/page.tsx
M	frontend/src/app/dashboard/page.tsx
M	frontend/src/app/hallazgos/page.tsx
M	frontend/src/app/soa/page.tsx
M	frontend/src/i18n/dictionaries/en.json
M	frontend/src/i18n/dictionaries/es.json
```

## git diff --name-only

```text
.gitignore
backend/src/app.js
backend/src/config/db.js
backend/src/controllers/kpi.controller.js
backend/src/controllers/search.controller.js
backend/src/middleware/auth.js
backend/src/reports/services/reportCoverage.service.js
backend/src/reports/services/reportData.service.js
backend/src/routes/action-plans.routes.js
backend/src/routes/admin-saas.routes.js
backend/src/routes/ai-auditor.routes.js
backend/src/routes/ai-compliance.routes.js
backend/src/routes/controls.routes.js
backend/src/routes/dashboard-controls.routes.js
backend/src/routes/diagnostic.routes.js
backend/src/routes/document-integrations.routes.js
backend/src/routes/evidences.routes.js
backend/src/routes/findings.routes.js
backend/src/routes/health.js
backend/src/routes/lifecycle.routes.js
backend/src/routes/report.routes.js
backend/src/routes/reports.routes.js
backend/src/routes/soa.routes.js
backend/src/services/companyProfileApplicabilityEngine.service.js
backend/src/services/diagnostic.service.js
backend/src/services/diagnosticAcceptance.service.js
backend/src/services/evidence-ai.service.js
backend/src/services/grc/grc.service.js
backend/src/services/grc/grc.service.test.js
backend/src/services/grc/grcSchedulerRunner.js
backend/src/services/grc/phase2SchedulerRunner.js
backend/src/services/indicators/indicatorGovernance.service.js
backend/src/services/isoExpressDiagnostic.service.js
backend/src/services/isoKnowledge.service.js
backend/src/services/isoOperationalExecution.service.js
backend/src/services/isoRecommendedActions.service.js
backend/src/services/isoRiskMatrix.service.js
backend/src/services/math-governance/canonicalHealthProjection.service.js
backend/src/services/math-governance/canonicalHealthProjection.service.test.js
backend/src/services/math-governance/formulaRegistry.service.js
backend/src/services/math-governance/grcDecisionCenter.test.js
backend/src/services/math-governance/grcHealthCalculation.service.test.js
backend/src/services/math-governance/officialCalculationOrchestrator.service.js
backend/src/services/math-governance/phase5Package4.test.js
backend/src/services/math-governance/phase5Package4Jobs.service.js
backend/src/services/math-governance/sourceContracts.service.js
backend/src/services/math-governance/sourceResolver.service.js
backend/src/services/soaIntelligence.service.js
backend/src/services/soaIntelligence.service.test.js
backend/src/utils/soaControlResolver.js
docs/codex/ARCHITECTURE_MAP.md
docs/codex/CONTRACTS_REGISTRY.md
docs/codex/CURRENT_STATE.md
docs/codex/DECISIONS.md
docs/codex/WORK_QUEUE.md
frontend/src/app/administrar-kpis/page.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/app/hallazgos/page.tsx
frontend/src/app/soa/page.tsx
frontend/src/i18n/dictionaries/en.json
frontend/src/i18n/dictionaries/es.json
```

## Untracked Files

```text
artifacts/db-integral/CLEAN_TENANT_BOOTSTRAP.md
artifacts/db-integral/FORMULA_AUTHORITY_MATRIX.md
artifacts/db-integral/FORMULA_VALIDATION_RESULTS.md
artifacts/db-integral/HUMAN_REVIEW_DB_N01_N05.md
artifacts/db-integral/PRODUCTION_BASELINE_FINAL_OBJECTS.md
artifacts/db-integral/ZERO_LEGACY_INVENTORY.md
artifacts/db-integral/final-review/BASELINE_OBJECT_REVIEW.md
artifacts/db-integral/final-review/CHANGE_INVENTORY.md
artifacts/db-integral/final-review/COMMIT_AND_CREATION_PLAN.md
artifacts/db-integral/final-review/FINAL_GATE_RESULTS.md
artifacts/db-integral/final-review/FORMULA_REVIEW.md
artifacts/db-integral/final-review/MULTITENANT_REVIEW.md
artifacts/db-integral/final-review/PRIVILEGE_REVIEW.md
artifacts/db-integral/final-review/REFERENCE_CATALOG_REVIEW.md
artifacts/db-integral/final-review/SHA256SUMS.txt
artifacts/db-integral/final-review/ZERO_LEGACY_REVIEW.md
artifacts/db-integral/final-review/db-n01-n05-working-tree.patch
artifacts/db-n02/DB-N02_FILES.txt
artifacts/db-n02/HEALTH_LINEAGE_MATRIX.md
artifacts/db-n02/initial-git-state.txt
artifacts/db-n03/DB-N03_FILES.txt
artifacts/db-n03/TENANT_TABLE_MATRIX.md
artifacts/db-n03/initial-git-state.txt
artifacts/db-n04/DB-N04_FILES.txt
artifacts/db-n04/DB_ACCESS_CONTEXT_MATRIX.md
artifacts/db-n04/LEGACY_OBJECT_MATRIX.md
artifacts/db-n04/initial-git-state.txt
artifacts/db-n05/ACTIVE_MISSING_CLOSEOUT.md
artifacts/db-n05/CONTROLS_CATALOG_DUPLICATE_ANALYSIS.md
artifacts/db-n05/DB-N05_FILES.txt
artifacts/db-n05/DBN01_N04_BASELINE_PARITY.md
artifacts/db-n05/MIGRATION_CHAIN.md
artifacts/db-n05/PRODUCTION_DATA_MIGRATION_MATRIX.md
artifacts/db-n05/PRODUCTION_DB_READINESS.md
artifacts/db-n05/PRODUCTION_OBJECT_ALLOWLIST.md
artifacts/db-n05/PRODUCTION_ROLE_PRIVILEGE_MATRIX.md
artifacts/db-n05/PRODUCTION_SEED_MATRIX.md
artifacts/db-n05/PRODUCT_STANDARD_REFERENCE_STATUS.md
artifacts/db-n05/QA_CATALOG_AUTHORITY_MATRIX.md
artifacts/db-n05/QA_REFERENCE_EXPORT_PLAN.md
artifacts/db-n05/QA_TO_FRESH_CATALOG_DIFF.md
artifacts/db-n05/QA_TO_FRESH_DIFF.md
artifacts/db-n05/REFERENCE_CATALOG_COVERAGE.md
artifacts/db-n05/RUNTIME_TO_BASELINE_COVERAGE.md
artifacts/db-n05/VALIDATION_RESULTS.md
artifacts/db-n05/initial-git-state.txt
artifacts/db-n05/qa-catalog-audit/DB-N05_CATALOG_AUDIT_RESULT.txt
artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt
artifacts/db-n05/rowlevel-validation/regressions.json
backend/src/routes/controlIdentityRoutes.test.js
backend/src/utils/dbTenantContext.js
backend/src/utils/dbTenantContext.test.js
backend/src/utils/tenantControlIdentity.js
backend/src/utils/tenantControlIdentity.test.js
database/baseline/production_schema_v1.sql
database/baseline/production_seed_v1.sql
database/migrations/20260904_dbn01_control_identity_normalization.sql
database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql
database/migrations/20260907_dbn03_multitenant_integrity_rls.sql
database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql
database/reference/iso/ISO-27001-2022/controls.jsonl
database/reference/iso/ISO-27001-2022/evidence_expectations.jsonl
database/reference/iso/ISO-27001-2022/metadata.json
database/reference/iso/ISO-42001-2023/controls.jsonl
database/reference/iso/ISO-42001-2023/evidence_expectations.jsonl
database/reference/iso/ISO-42001-2023/metadata.json
database/reference/iso/ISO-9001-2015/controls.jsonl
database/reference/iso/ISO-9001-2015/evidence_expectations.jsonl
database/reference/iso/ISO-9001-2015/metadata.json
database/reference/iso/ISO-9001-2026-FDIS/controls.jsonl
database/reference/iso/ISO-9001-2026-FDIS/evidence_expectations.jsonl
database/reference/iso/ISO-9001-2026-FDIS/metadata.json
database/reference/iso/manifest.json
docs/codex/handoffs/DB-N05.md
docs/handoffs/DB-N01_CONTROL_IDENTITY_NORMALIZATION.md
docs/handoffs/DB-N02_HEALTH_METRICS_LINEAGE_NORMALIZATION.md
docs/handoffs/DB-N03_MULTITENANT_INTEGRITY_RLS.md
docs/handoffs/DB-N04_RUNTIME_TENANT_AND_LEGACY_CLEANUP.md
docs/handoffs/DB-N05_FRESH_PRODUCTION_DATABASE.md
docs/runbooks/PRODUCTION_DATABASE_CREATION.md
scripts/normalization/apply-db-n01-control-identity-migration.test.js
scripts/normalization/apply-db-n02-health-metrics-lineage-migration.test.js
scripts/normalization/apply-db-n03-multitenant-integrity-migration.test.js
scripts/normalization/apply-db-n04-runtime-tenant-cleanup-migration.test.js
scripts/normalization/apply-db-n05-production-baseline.test.js
scripts/normalization/db-integral-formula-lineage.postgres.test.js
scripts/normalization/db-integral-zero-legacy.postgres.test.js
scripts/normalization/db-integral-zero-legacy.test.js
scripts/normalization/db-n01-control-identity.postgres.test.js
scripts/normalization/db-n02-health-metrics-lineage.postgres.test.js
scripts/normalization/db-n03-multitenant-integrity.postgres.test.js
scripts/normalization/db-n04-runtime-tenant-cleanup.postgres.test.js
scripts/normalization/db-n05-export-qa-reference-catalogs.sql
scripts/normalization/db-n05-fresh-production.postgres.test.js
scripts/normalization/db-n05-isolated-postgres.js
scripts/normalization/db-n05-materialize-qa-reference-catalogs.py
scripts/normalization/db-n05-production-role-privileges.postgres.test.js
scripts/normalization/db-n05-qa-reference-export-contract.test.js
scripts/normalization/db-n05-readonly-qa-preflight.sql
scripts/normalization/db-n05-reference-catalogs.test.js
scripts/normalization/db-n05-reference-loader-gating.test.js
scripts/normalization/db-n05-runtime-schema-contract.test.js
scripts/normalization/fixtures/db-integral-formula-golden.json
scripts/normalization/load-production-reference-catalogs.js
```
