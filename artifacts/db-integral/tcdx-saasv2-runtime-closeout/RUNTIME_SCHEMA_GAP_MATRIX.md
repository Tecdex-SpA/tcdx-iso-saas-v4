# TCDX SaaSv2 Runtime Schema Gap Matrix

Date: 2026-09-09
Branch: `fix/tcdx-saasv2-runtime-schema-closeout`
Database target: `tcdx_saasv2`
Runtime principal: `tcdx_backend_app` member of `tcdx_backend_runtime`

## Guards Read Before Matrix

- Direct identity guard: `tcdx_saasv2|tcdx_backend_app|t`.
- Backend pool identity guard: `BACKEND_POOL_IDENTITY|tcdx_saasv2|tcdx_backend_app|tcdx_backend_app|true`.
- Existing cutover evidence consumed from `artifacts/db-integral/tcdx-saasv2-backend-cutover-review/`.
- No DB writes were executed while preparing this matrix.

## Classification Summary

| Gap | Classification | Remediation |
| --- | --- | --- |
| `tenants.suspended_at`, `tenants.suspension_reason`, `tenants.deleted_at`, `tenants.deletion_reason` | `CANONICAL_ACTIVE` | Add lifecycle columns to fresh baseline and closeout migration. |
| `tenant_standard_operations` | `CANONICAL_ACTIVE` | Add tenant standard-operation scope table to fresh baseline and closeout migration. |
| `v_commercial_tenant_subscription`, `v_commercial_tenant_modules`, `v_commercial_tenant_capabilities` | `CANONICAL_ACTIVE` | Add views over current baseline commercial tables, not historical Phase 4 tables. |
| `v_iso_effective_kpi_summary` | `CANONICAL_ACTIVE` | Add view over `v_iso_control_effective_health`, grouped by tenant, standard and operation. |
| `v_iso_risk_matrix_summary` | `CANONICAL_ACTIVE` | Add ISO risk matrix runtime tables and views from canonical matrix service dependency. |
| `assets.iso`, `assets.type`, `assets.owner` | `LEGACY_COMPATIBILITY_ACTIVE` | Add compatibility columns because active `/api/assets` writes/reads them directly; longer-term adapter should normalize to `asset_standards`/metadata. |
| `audits.iso`, `audits.start_date`, `audits.end_date`, `audits.requester_name`, `audits.auditor_type`, `audits.auditor_name`, `audits.report_file` | `LEGACY_COMPATIBILITY_ACTIVE` | Add compatibility columns because active audit routes write/read them directly; canonical alias remains `standard_code`/`starts_at`/`ends_at`. |
| `tenant_operations.is_default`, `tenant_operations.sort_order` | `CANONICAL_ACTIVE` | Add operational-scope ordering/default columns used by selectors and fallback ordering. |
| `public.assets`, `public.risks`, `public.risk_control_relations`, `public.tenant_operations` privileges | `CANONICAL_ACTIVE` | Add explicit least-privilege grants to `tcdx_backend_runtime`; no schema-wide grants. |

## Gap Details

### Tenant Lifecycle Columns

- Consumer: auth and commercial entitlement runtime.
- Route/service: `backend/src/middleware/auth.js`, `backend/src/routes/me-modules.routes.js`, `backend/src/services/commercial/entitlementResolver.service.js`, `backend/src/routes/admin-saas.routes.js`.
- Query exacta:

```sql
SELECT id, name, COALESCE(service_status, 'active') AS service_status,
       suspended_at, suspension_reason, deleted_at, deletion_reason
FROM tenants
WHERE id = $1::uuid
LIMIT 1
```

- Object/column requerido: `tenants.suspended_at`, `tenants.suspension_reason`, `tenants.deleted_at`, `tenants.deletion_reason`.
- Baseline actual: `tenants` has `id,name,slug,service_status,ai_plan,settings,created_at,updated_at`.
- Source historica: lifecycle columns appear in commercial/admin runtime and historical tenant demo reset, but not DB-N05 baseline.
- Canonical authority: active tenant service lifecycle contract in auth middleware and Admin SaaS suspension/deletion routes.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: add nullable timestamp/reason columns; widen `service_status` to include `suspended_non_payment` because auth treats it as a first-class suspended state.
- Test: static + isolated PostgreSQL closeout test validates columns and active/suspended/deleted auth query shape.
- Zero-legacy impact: none; no tenant rows are inserted and no legacy authority is introduced.

### Tenant Standard Operations

- Consumer: standards, controls, evidences, findings, nonconformities, audits, assets, lifecycle, reports, search and diagnostics.
- Route/service: `backend/src/routes/tenant-standards.routes.js`, `assets.routes.js`, `audits.routes.js`, `findings.routes.js`, `evidences.routes.js`, `soa.routes.js`.
- Query exacta representative:

```sql
SELECT 1
FROM tenant_standard_operations tso
JOIN tenant_operations op
  ON op.id = tso.operation_id
 AND op.tenant_id = tso.tenant_id
 AND op.is_active = TRUE
WHERE tso.tenant_id = ts.tenant_id
  AND tso.standard_code = ts.standard_code
  AND tso.is_active = TRUE
```

- Object/column requerido: `tenant_standard_operations(tenant_id, standard_code, operation_id, is_active, notes, created_at, updated_at)`.
- Baseline actual: absent.
- Source historica: visual/demo migration materialized this table; active runtime relies on it as scope, not demo data.
- Canonical authority: operational standard scope is defined by `tenant_standards` + `tenant_operations` + `tenant_standard_operations`.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: add table with same-tenant FK to `tenant_standards(tenant_id, standard_code)` and `tenant_operations(tenant_id, id)`, unique `(tenant_id, standard_code, operation_id)`.
- Test: isolated PostgreSQL inserts two tenants and verifies cross-tenant operation mapping is rejected.
- Zero-legacy impact: no demo rows; table is tenant-scoped and empty by default.

### Commercial Tenant Views

- Consumer: entitlement resolver, Admin SaaS, `/api/me/entitlements`, Phase 5 compatibility.
- Route/service: `backend/src/services/commercial/entitlementResolver.service.js`, `backend/src/services/commercial/commercialAdmin.service.js`, `backend/src/routes/admin-saas.routes.js`.
- Query exacta:

```sql
SELECT * FROM v_commercial_tenant_subscription WHERE tenant_id = $1::uuid LIMIT 1;
SELECT * FROM v_commercial_tenant_modules WHERE tenant_id = $1::uuid ORDER BY sort_order, module_key;
SELECT * FROM v_commercial_tenant_capabilities WHERE tenant_id = $1::uuid ORDER BY capability_key;
```

- Object/column requerido: `v_commercial_tenant_subscription`, `v_commercial_tenant_modules`, `v_commercial_tenant_capabilities`.
- Baseline actual: tables exist in DB-N05 simplified commercial model, but views are absent.
- Source historica: Phase 4/AI add-on migrations define the same view family over older commercial tables.
- Canonical authority: ADR-043 through ADR-048 require commercial entitlement authority via these views and AI add-on binary contract.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: create baseline-compatible views over `commercial_plans`, `commercial_plan_versions`, `plan_version_capabilities`, `commercial_technical_capabilities`, `saas_modules`, `tenant_subscriptions`, `tenant_subscription_addons` and `tenant_module_settings`.
- Test: static + isolated PostgreSQL validates view existence and selected columns expected by runtime.
- Zero-legacy impact: no tenant data inserted; view projects current canonical commercial tables, not historical plan-version modules.

### Effective KPI Summary View

- Consumer: KPI controller, AI auditor, report data, AI context builder, audit preparation.
- Route/service: `backend/src/controllers/kpi.controller.js`, `backend/src/reports/services/reportData.service.js`, `backend/src/services/aiContextBuilder.service.js`, `backend/src/services/auditPreparationContext.service.js`.
- Query exacta representative:

```sql
SELECT *
FROM public.v_iso_effective_kpi_summary
WHERE tenant_id = $1::uuid
  AND ($2::text IS NULL OR standard_code = $2 OR iso = $2)
  AND ($3::uuid IS NULL OR operation_id = $3::uuid)
```

- Object/column requerido: `v_iso_effective_kpi_summary` with tenant, ISO, operation and aggregate health/evidence/finding/action columns.
- Baseline actual: `v_iso_control_effective_health` exists, but the aggregate summary view is absent and lacks `operation_id`.
- Source historica: hardening/applicability migrations wrap `v_iso_effective_kpi_summary`; DB-N02 declares per-control health authority in `v_iso_control_effective_health`.
- Canonical authority: derive summary from DB-N02 per-control canonical view; do not use `KPI-HLT` or `control_health_scores`.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: expose aggregate view grouped from `v_iso_control_effective_health`; add `operation_id`/operation fields to the per-control view by projecting `tenant_controls.operation_id`.
- Test: isolated PostgreSQL checks that no legacy Health objects are referenced and `operation_id` exists.
- Zero-legacy impact: no legacy KPI authority; counts can be zero only as counts, not as fabricated metric score.

### ISO Risk Matrix Runtime Objects

- Consumer: ISO risk matrix service/routes and AI/report risk context.
- Route/service: `backend/src/services/isoRiskMatrix.service.js`.
- Query exacta:

```sql
SELECT *
FROM v_iso_risk_matrix_summary
WHERE tenant_id = $1::uuid
ORDER BY created_at DESC
LIMIT 80
```

- Object/column requerido: `iso_risk_matrix_runs`, `iso_risk_matrix_items`, `iso_risk_matrix_actions`, `iso_risk_matrix_audit_log`, `v_iso_risk_matrix_latest_runs`, `v_iso_risk_matrix_summary`.
- Baseline actual: absent.
- Source historica: `database/migrations/20260506_iso_risk_matrix.sql`.
- Canonical authority: active `isoRiskMatrix.service.js` uses these objects for risk matrix read/write; model remains tenant-scoped and independent of `public.controls`.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: add the object family to baseline/closeout with FKs adapted to fresh canonical tables.
- Test: static + isolated PostgreSQL validates objects and SELECT grant; runtime smoke retest required before READY.
- Zero-legacy impact: no demo rows and no `public.controls` dependency.

### Asset Runtime Shape

- Consumer: `/api/assets`, ISO risk matrix asset enrichment, AI context, scope recommendation.
- Route/service: `backend/src/routes/assets.routes.js`, `backend/src/services/isoRiskMatrix.service.js`.
- Query exacta:

```sql
INSERT INTO assets (tenant_id, name, type, iso, criticality, owner) VALUES (...);
SELECT a.id, a.name, a.type, a.criticality, a.owner, a.iso FROM assets a ...
```

- Object/column requerido: `assets.type`, `assets.iso`, `assets.owner`.
- Baseline actual: `assets(id, tenant_id, asset_key, name, criticality, owner_user_id, metadata, created_at)`.
- Source historica: historical demo/product routes used direct columns; `asset_standards` exists only as runtime expectation, not baseline.
- Canonical authority: DB-N05 baseline chose structured `assets` but active runtime still uses direct asset metadata columns.
- Classification: `LEGACY_COMPATIBILITY_ACTIVE`.
- Remediation: add nullable compatibility columns and `asset_standards` mapping table; keep `asset_key` canonical and no data seed.
- Test: isolated PostgreSQL can insert asset through active column shape and map standards.
- Zero-legacy impact: no legacy prohibited object; columns are tenant-scoped metadata.

### Audit Runtime Shape

- Consumer: `/api/audits`, reports, findings/action enrichment, notifications/search.
- Route/service: `backend/src/routes/audits.routes.js`, `backend/src/routes/findings.routes.js`, `backend/src/routes/action-plans.routes.js`.
- Query exacta:

```sql
INSERT INTO audits (tenant_id, iso, start_date, end_date, requester_name, auditor_type, auditor_name, status) VALUES (...);
SELECT a.iso, a.start_date, a.end_date, a.requester_name, a.auditor_type, a.auditor_name, a.report_file FROM audits a ...
```

- Object/column requerido: audit compatibility columns above.
- Baseline actual: `audits(id, tenant_id, audit_key, standard_code, status, starts_at, ends_at, metadata, created_at)`.
- Source historica: active audit route uses legacy direct columns.
- Canonical authority: `standard_code`/`starts_at`/`ends_at` remain canonical; compatibility columns are required by current active runtime until routes are normalized.
- Classification: `LEGACY_COMPATIBILITY_ACTIVE`.
- Remediation: add nullable compatibility columns with no artificial backfill in empty `tcdx_saasv2`; future runtime should normalize writes to canonical names.
- Test: isolated PostgreSQL validates both canonical and compatibility shapes can coexist.
- Zero-legacy impact: no legacy banned authority and no fabricated audit rows.

### Runtime Privileges

- Consumer: active backend runtime as `tcdx_backend_app` inheriting `tcdx_backend_runtime`.
- Route/service: assets, risk, Health summary, tenant context and official calculation consumers.
- Query exacta:

```sql
SELECT count(*) FROM public.assets;
SELECT count(*) FROM public.risks;
SELECT count(*) FROM public.risk_control_relations;
SELECT count(*) FROM public.tenant_operations;
```

- Object/column requerido: explicit runtime privileges on these tenant-scoped canonical tables plus new runtime views/tables.
- Baseline actual: no effective privileges on `assets`, `risks`, `risk_control_relations`, `tenant_operations`; prior artifacts show permission denied.
- Source historica: DB-N05 role test intentionally omitted these while DB-N05 fresh test inserts through migration/platform context.
- Canonical authority: active backend runtime reads and mutates these objects through user APIs; no superuser or BYPASSRLS allowed.
- Classification: `CANONICAL_ACTIVE`.
- Remediation: explicit table/view grants to `tcdx_backend_runtime`; no `GRANT ALL`, no schema-wide grants.
- Test: isolated PostgreSQL effective ACL with login/member equivalent; real DB retest after migration apply.
- Zero-legacy impact: preserves least privilege; no access to prohibited legacy objects.
