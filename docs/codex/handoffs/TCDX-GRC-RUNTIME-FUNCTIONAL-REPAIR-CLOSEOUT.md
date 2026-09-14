# TCDX GRC runtime functional repair closeout

Date: 2026-09-11
Branch: `main`
Initial HEAD: `09b155a65a8120c7a62f990523a4a3527dbd125c`
Status: `TCDX_GRC_RUNTIME_FINAL_DIRECTED_CORRECTION_READY_FOR_HUMAN_REVIEW`

## Scope

Focused runtime repair of the current working tree for GRC diagnostic, ISO Express, action plans, Control workbench Health and post-mutation publication. No reset, stash, clean, destructive checkout, commit, push, merge, deploy, `.env` edit, production write or `tcdx_saasv2` write was performed.

## Root causes and repairs

- Final directed correction: `actionPlanPersistence` previously accepted unknown absent fields by skipping them; it now allows metadata fallback only for explicitly governed optional fields and throws contract errors for unknown or missing structural fields.
- Final directed correction: ISO Express previously used norm-number hardcodes in backend identity matching and frontend display formatting; it now resolves eligibility through generic normalization plus `iso_standard_versions`, while compact visual labels are generated generically.
- Final directed correction: Control workbench Health previously allowed contradictory local/canonical combinations; it now normalizes `effective_health_status` and `effective_health_score` as one pair from `v_iso_control_effective_health`, forcing null score to `sin_datos` and using the same state for summary, badges and filters.
- Diagnostic `s.target_label` failed because `tenant_evidence_applicability_suggestions` in the clean runtime does not physically expose the optional legacy fields selected by `loadSemanticSuggestions`. The consumer now detects optional columns and projects nullable/fallback values without adding `target_label`.
- Diagnostic status update failed because the SoA post-mutation call used `control.iso` from an update row that did not return `iso`. It now resolves `tenantId` from `tenant_controls.tenant_id`, `tenantControlId` from `tenant_controls.id`, and `isoCode` from active tenant standard code with catalog ISO fallback.
- ISO Express options missed active `ISO_27001_2022` because readiness eligibility joined active tenant standards to canonical ISO versions by raw code equality. The service now canonicalizes versioned/product identity and merges active tenant-standard fallback options; UI display renders compact `ISO27001` style without changing payload values.
- `action_plans.description` failed because multiple runtime writers/readers assumed legacy physical columns that are absent in the clean schema. `backend/src/utils/actionPlanPersistence.js` inserts/updates only real columns and moves absent optional fields into `metadata`; readers project from real row JSON or metadata.
- Action creation from controls and findings now uses real `tenant_controls.id`, source/origin relations already present, and schema-aware action persistence.
- NC AI assistance from Control workbench reuses `/api/ai-compliance/nonconformity-draft` after creating/opening the NC. The AI output is displayed as an assistive draft only and does not approve, certify or mutate compliance.
- Risk creation from Control workbench was not found as an existing implemented product flow; status remains `NOT_IMPLEMENTED_EXISTING_PRODUCT_FLOW`. Existing risk matrix mutations still publish risk recalculation.
- Control workbench Health contradiction came from mixing declared/local scores with canonical Health labels. Workbench now preserves `sin_datos`/N/A when no canonical per-control Health measurement exists; summary, badges and filters use the same effective health status.

## Orchestration

Relevant GRC mutations publish after commit or after autocommitted quick statements via `publishAffectedOfficialIndicators`:

- diagnostic/SoA/control compliance: compliance, coverage, Data Trust and GRC Health metrics where formulas permit.
- evidence: Evidence Fresh, Data Trust and GRC Health.
- finding: severity/remediation-related official metrics.
- action plan: weighted progress/remediation, Data Trust and GRC Health.
- risk matrix: inherent and residual risk.
- nonconformity: adapter call is preserved, but direct metrics remain empty until a governed NC formula exists.

Post-commit recalculation failure remains observable as `completed_with_failures`; a committed mutation is not returned as failed solely because publication failed.

## Validation

- `git diff --check`: PASS.
- `node -c backend/src/utils/actionPlanPersistence.js`: PASS.
- `node -c backend/src/services/isoExpressDiagnostic.service.js`: PASS.
- `node -c backend/src/routes/controls.routes.js`: PASS.
- Required `node -c` checks for GRC orchestration, diagnostic, action plan, findings, NC, evidence and controls routes: PASS.
- Additional `node -c` checks for touched AI/search/report/action-plan services: PASS.
- `node backend/src/utils/actionPlanPersistence.test.js`: PASS.
- `node backend/src/routes/grcRuntimeRepair.contract.test.js`: PASS.
- `node backend/src/services/grcCalculationOrchestration.service.test.js`: PASS.
- `node backend/src/services/math-governance/sourceResolver.test.js`: PASS.
- `node backend/src/services/math-governance/officialIndicatorMatrix.test.js`: PASS.
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`: PASS.
- `node backend/src/services/math-governance/canonicalHealthProjection.service.test.js`: PASS.
- `node backend/src/services/isoRiskMatrix.service.test.js`: PASS.
- `node scripts/normalization/db-integral-formula-lineage.postgres.test.js`: PASS on isolated local PostgreSQL; Tenant A uses `ISO_27001_2022`, Tenant B uses `ISO_9001_2015`, runs 18, outputs 18, source snapshots 18, metric snapshots 6, cross-tenant leakage 0, cross-standard leakage 0.
- `npm --prefix backend test`: PASS.
- `npm --prefix frontend run typecheck`: PASS.
- `node scripts/deploy-vms-strategy.test.js`: PASS.
- Release RBAC contract, residual role authority, role alias equivalence and frontend/backend authorization consistency: PASS.
- Final hardcode/legacy greps: ISO Express/frontend standard hardcode grep PASS; `action_plans.description`/legacy Health authority grep PASS for prohibited runtime references in scoped files.

## Residuals

- No production/runtime HTTP smoke was executed in this Codex turn.
- Risk creation directly from Control workbench remains not implemented in the existing product flow.
- Nonconformity has no direct official metric formula in the current adapter map; it still publishes an observable orchestration result.

## Prohibitions confirmed

`NO commit`, `NO push`, `NO merge`, `NO deploy`, `NO .env`, `NO escritura productiva`, `NO schema legacy añadido`, `NO score inventado`, `NO mapping inventado`.
