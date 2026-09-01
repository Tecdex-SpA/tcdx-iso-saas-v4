# POSTDEPLOY-02 — Legacy/Canonical Data Audit

Fecha: 2026-09-01
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
HEAD auditado: `84fc1799e497e0af2abe6089eb6e3c2b800905e9`
Modo: `READ_ONLY_AUDIT`
Estado: `POSTDEPLOY_LEGACY_CANONICAL_DB_AUDIT_COMPLETE`

## Preflight

- `git branch --show-current`: `main`
- `git rev-parse HEAD`: `84fc1799e497e0af2abe6089eb6e3c2b800905e9`
- Estado inicial: dirty sólo en continuidad/artefactos de auditoría ya existentes del paquete.
- `DB_AUDIT_CONNECTION=OK`
- `DB_AUDIT_READ_ONLY=YES`
- `DB_NAME=tecdex_saas`
- `DB_USER=postgres`
- `DB_VERSION=16.15`
- `DB_WRITES_ALLOWED_BY_AUDIT=NO`

Todas las consultas SQL productivas se ejecutaron con `BEGIN; SET TRANSACTION READ ONLY; SHOW transaction_read_only; ... ROLLBACK;`. No se ejecutó `COMMIT`.

## Artefactos actualizados

- `artifacts/postdeploy-legacy-audit/schema_inventory.csv`
- `artifacts/postdeploy-legacy-audit/view_authority_map.csv`
- `artifacts/postdeploy-legacy-audit/migration_inventory.csv`
- `artifacts/postdeploy-legacy-audit/legacy_canonical_matrix.csv`
- `artifacts/postdeploy-legacy-audit/entitlement_trace.csv`
- `artifacts/postdeploy-legacy-audit/database_drift.csv`
- `artifacts/postdeploy-legacy-audit/capability_route_matrix.csv`
- `artifacts/postdeploy-legacy-audit/kpi_formula_inventory.csv`
- `artifacts/postdeploy-legacy-audit/health_metric_comparison.csv`

## Commercial / Views

FACT_DB:

- `schema_migrations` confirma aplicadas y con checksum local coincidente:
  - `20260729_phase4_commercial_product`
  - `20260827_rbac01_canonical_roles_brand01`
  - `20260827_rbac02_commercial_gating_normalization`
  - `20260828_commercial_standard_plan_matrix`
  - `20260831_ai_addon_commercial_visibility`
  - `20260807_phase5_c3_indicators_trust_snapshots`
- `v_commercial_tenant_modules` y `v_commercial_tenant_capabilities` productivas tienen rama `addon` sobre `tenant_subscription_addons`, `plan_version_addons` y `commercial_addons.metadata.capability_keys`.
- `v_tenant_commercial_entitlements` es proyección pura de `v_commercial_tenant_capabilities`.
- `v_commercial_tenant_health` es health comercial de suscripción/limits, no KPI oficial `GRC-HEALTH`.
- Planes estándar `pyme`, `empresa`, `enterprise` existen; `enterprise` tiene `ai_compliance=false` en `plan_version_modules`.
- Plan `legacy` todavía expone `ai.compliance`/`ai.auditor` plan-level. Clasificación: `LEGACY_RUNTIME_AUTHORITY` para tenants legacy, sin impacto en Credex `enterprise`.

## Credex Entitlement Trace

FACT_DB:

- Tenant Credex seleccionado por CTE focal: `service_status=active`.
- Contrato/admin surface: `enterprise`, `active`, 2026-05-01 a 2027-05-01.
- `v_commercial_tenant_subscription`: `enterprise` v1 `active`.
- `tenant_subscription_addons`: `ai` activo y efectivo; hay dos filas activas duplicadas para el add-on.
- `v_commercial_tenant_modules`: `ai_compliance` source=`addon`; core, data_governance, grc_core, health, iso, operations_grc, risk_manager source=`plan`.
- `v_commercial_tenant_capabilities`: `ai.compliance` source=`addon`; `ai.auditor` source=`addon`; `iso.actions`, `iso.health`, `data.governance`, `core.dashboard` source=`plan`.
- Runtime AI flags: `ai_enabled=true`, web/report/auditor true, `ai_features_json.suggestions=true`. `ai_plan=pro` existe como compatibilidad/config.
- Roles agregados Credex: `admin=3`, `auditor=1`; no se exportaron emails ni IDs de usuario.

## INC-01 — IA Compliance

FACT_DB:

- `AI_ADDON_ROW=active effective YES`
- `AI_ADDON_EFFECTIVE=YES`
- `AI_COMPLIANCE_EFFECTIVE_CAPABILITY=YES`
- `AI_COMPLIANCE_CAPABILITY_SOURCE=addon`
- `AI_COMPLIANCE_REQUIRED_PERMISSION=ai_compliance.read`
- `ADMIN_CREDEX_PERMISSION=NO`
- `AI_RUNTIME_ENABLED=YES`
- `AI_RUNTIME_SUGGESTIONS=YES`
- `LEGACY_AI_PLAN_VALUE=pro`

FACT_CODE_ALREADY_AUDITED:

- `/api/me/entitlements` y frontend consumen entitlement backend + flags runtime.
- `tenantAiSettings` lee `ai_plan` como compatibilidad/config, no como autoridad comercial.

INFERENCE:

- `AI_COMPLIANCE_FIRST_FAILED_GATE=RBAC_PERMISSION_CATALOG`
- `LEGACY_FIELD_CONTROLS_DECISION=NO`
- `LEGACY_NEW_MODEL_CONFLICT=NO` para la autoridad comercial; `YES` para catálogo RBAC contradictorio.
- `ROOT_CAUSE=commercial_technical_capabilities.ai.compliance.required_permission apunta a ai_compliance.read, pero permissions no contiene ai_compliance.read; existen ai.view/ai.use.`

## INC-02 — Encuestas

Conservar conclusión confirmada:

- `INC-02=CONFIRMED`
- `ROOT_CAUSE=/encuestas/layout.tsx + /encuestas/page.tsx duplicate AppLayout`
- `SEVERITY=MAJOR`
- `LEGACY_NEW_MODEL_CONFLICT=NO`

No se reauditó porque la nueva evidencia DB no contradice este hallazgo.

## INC-03 — GRC

FACT_CODE_ALREADY_AUDITED:

- `/api/grc/overview` es GET y llama `officialCalculationOrchestrator.recalculateOfficialAnalytics(...)`, que persiste runs/inputs/outputs/snapshots.

FACT_DB:

- Latest Credex `F5_5_GRC_HEALTH`: `not_calculable`, `FORMULA_DEPENDENCY_PENDING`, output `null/unmeasured`.
- Input de GRC Health declara missing fields: `compliance`, `actions`, `dataTrust`, `risk`.
- Latest dependencies:
  - `F5_5_COMPLIANCE_WEIGHTED`: `SOURCE_DATA_INSUFFICIENT`
  - `F5_5_WEIGHTED_PROGRESS`: `FORMULA_ZERO_WEIGHTS`
  - `F5_C3_DATA_TRUST`: `FORMULA_VARIABLE_REQUIRED`
  - `F5_5_RESIDUAL_RISK`: `SOURCE_DATA_INSUFFICIENT`
  - `F5_5_FRESHNESS_CONTINUOUS`: calculated `14.25`
- No se encontró SQLSTATE persistido en `calculation_validations` focal; no se invocó el endpoint.

Conclusión:

- `GRC_MUTATING_GET_CONFIRMED=YES`
- `GRC_RUNTIME_ROOT_CAUSE=GET read path triggers official recalculation/persistence and returns a compatibility overview over not_calculable dependency states`
- `GRC_SQLSTATE=NOT_FOUND_IN_DB_EVIDENCE`
- `GRC_SCHEMA_DRIFT=NO_SQLSTATE_CONFIRMED; design drift confirmed by mutating GET`
- `GRC_DATA_DRIFT=YES: required dependencies missing/unmeasured`
- `GRC_LEGACY_CANONICAL_CONFLICT=YES`

## INC-04 — Acciones Recomendadas

FACT_DB:

- Credex `iso.actions` effective capability: `YES`, source=`plan`.
- `iso.actions.required_permission=actions.read`.
- `permissions` no contiene `actions.read`; existen `actions.view`, `actions.manage`, `actions.approve`, `actions.delete`.
- Credex `admin` no puede tener `actions.read` porque la key falta.

FACT_CODE_ALREADY_AUDITED:

- Frontend route usa `iso.actions`.
- APIs `/api/iso-operational-execution/*` y `/api/iso-recommended-actions/*` no replican `requireCommercialCapability('iso.actions')` en la revisión focal previa.

Conclusión:

- `RECOMMENDED_ACTIONS_EXPECTED_MODEL=ISO_BASE`
- `RECOMMENDED_ACTIONS_DB_ENTITLED=YES`
- `RECOMMENDED_ACTIONS_RBAC_ALLOWED=NO`
- `RECOMMENDED_ACTIONS_FIRST_FAILED_GATE=RBAC_PERMISSION_CATALOG_MISSING_ACTIONS_READ`

## INC-05 — Planes de Acción

FACT_DB:

- Igual que INC-04: `iso.actions` efectivo por plan para Credex, pero `actions.read` falta en catálogo RBAC.

FACT_CODE_ALREADY_AUDITED:

- Frontend espera `iso.actions`.
- API `/api/action-plans/*` usa auth/RBAC/tenant scope y no mostró gate comercial `iso.actions` en el audit estático.

Conclusión:

- `ACTION_PLANS_EXPECTED_MODEL=ISO_BASE`
- `ACTION_PLANS_DB_ENTITLED=YES`
- `ACTION_PLANS_RBAC_ALLOWED=NO`
- `ACTION_PLANS_FIRST_FAILED_GATE=RBAC_PERMISSION_CATALOG_MISSING_ACTIONS_READ`

## INC-06 — KPI Global

FACT_DB:

- `GLOBAL_SCORE_FORMULA=F5_5_GRC_HEALTH`
- `GLOBAL_SCORE_VERSION=1`
- `GLOBAL_SCORE_COMPONENTS=risk,compliance,actions,evidence,dataTrust`
- Official expression: `100 weighted R,C,A,E,D`
- Null policy: `reject_required_nulls`
- Latest official result: output `{"value": null, "status": "unmeasured"}`, run `not_calculable`.
- Blocking dependencies:
  - `risk=UNAVAILABLE SOURCE_DATA_INSUFFICIENT`
  - `compliance=UNAVAILABLE SOURCE_DATA_INSUFFICIENT`
  - `actions=UNAVAILABLE FORMULA_ZERO_WEIGHTS`
  - `dataTrust=UNAVAILABLE FORMULA_VARIABLE_REQUIRED`
  - `evidence=AVAILABLE 14.25 LOW_CONFIDENCE`
- `F5_C3_DATA_TRUST` v1 methodology: `eight-dimension Data Trust without unknown renormalization`.
- `F5_C3_DATA_TRUST` missing required variable: `accuracy` / `Exactitud`.

INFERENCE:

- `GLOBAL_SCORE_BLOCKING_COMPONENT=risk,compliance,actions,dataTrust; dataTrust blocked by accuracy/Exactitud`
- `GLOBAL_SCORE_BLOCK_REASON=FORMULA_DEPENDENCY_PENDING caused by unavailable required components`
- `GLOBAL_SCORE_AVAILABLE_COMPONENTS=evidence=14.25`
- `GLOBAL_SCORE_UNAVAILABLE_COMPONENTS=risk,compliance,actions,dataTrust`
- `GLOBAL_SCORE_OFFICIAL_RESULT=null/unmeasured`
- `GLOBAL_SCORE_DYNAMIC_FEASIBLE=YES_AS_NEW_GOVERNED_FORMULA_VERSION_ONLY`
- `GLOBAL_SCORE_DYNAMIC_HYPOTHETICAL_RESULT=14.25`
- `GLOBAL_SCORE_DYNAMIC_SEMANTIC_RISK=HIGH: one evidence freshness component would become the whole health score`
- `GLOBAL_SCORE_MODEL_DEFECT=YES_FOR_PRODUCT_OPERABILITY; NO for null-to-zero governance`
- `GLOBAL_SCORE_LEGACY_CONFLICT=YES: legacy KPI-HLT-001 publishes 83.64 while official GRC-HEALTH is unmeasured`

## INC-07 — Health / KPI

FACT_DB:

- Official metric definitions present: `GRC-HEALTH`, `DATA-TRUST`, `EVIDENCE-FRESH`, `COVERAGE`.
- `EVIDENCE-COVERAGE` is absent from `metric_definition_versions`.
- Legacy `kpi_definitions` present: `KPI-HLT-001..004`.
- Credex latest legacy values:
  - `KPI-HLT-001=83.64`, yellow, `control_health_engine_v2_1`
  - `KPI-HLT-003=85.11`, green, `control_health_engine_v2_1`
- Operational health views:
  - `v_tenant_health_summary.healthy_percentage=85.11`, status `atencion`
  - `v_standard_health_summary.healthy_percentage=85.11`, status `atencion`
- Official values:
  - `GRC-HEALTH=null/unmeasured/dependency_pending`
  - `DATA-TRUST=null/unmeasured/insufficient_data`
  - `EVIDENCE-FRESH=14.25`, LOW_CONFIDENCE
  - `COVERAGE=null/unmeasured/insufficient_data`

Conclusión:

- `EVIDENCE_COVERAGE_EXISTS=NO`
- `EVIDENCE_FRESH_EXISTS=YES`
- `EVIDENCE_KEYS_EQUIVALENT=NO`
- `HEALTH_GENERATIONS_COEXIST=YES`
- `HEALTH_SOURCE_DIVERGENCE=official metric_snapshots vs legacy KPI-HLT snapshots vs operational health views`
- `HEALTH_SNAPSHOT_DIVERGENCE=YES`
- `HEALTH_BINDING_DRIFT=YES for consumer/key mapping, not for official bindings`
- `HEALTH_ROOT_CAUSE=parallel Health generations and unmapped evidence coverage/freshness keys`

## Legacy / Canonical Classification

- `KEEP_CANONICAL`: `tenant_subscriptions`, `commercial_plan_versions`, `plan_version_modules`, `tenant_subscription_addons`, `commercial_addons.metadata.capability_keys`, `v_commercial_tenant_capabilities`, `metric_definition_versions`, `metric_source_bindings`, `official_formula_versions`, `calculation_runs`, `calculation_outputs`, `metric_snapshots`.
- `KEEP_COMPATIBILITY`: `tenants.ai_plan`, legacy plan keys `pyme/empresa/enterprise`, `v_tenant_commercial_entitlements`, legacy `KPI-HLT-*` while explicitly mapped/labeled.
- `LEGACY_RUNTIME_AUTHORITY`: legacy commercial plan still grants `ai.compliance`/`ai.auditor` plan-level.
- `DUPLICATE_AUTHORITY`: official `GRC-HEALTH` vs legacy `KPI-HLT-001`; official `EVIDENCE-FRESH`/`COVERAGE` vs legacy `KPI-HLT-003`.
- `CONTRADICTORY_DATA`: capability required permissions `ai_compliance.read` and `actions.read` do not exist in `permissions`.
- `STALE_OR_ORPHANED_DATA`: duplicate active Credex `tenant_subscription_addons.ai` rows.

## Normalization Proposal — No Implementar

KEEP_CANONICAL:

- Comercial: `subscription -> plan_version -> plan_version_modules -> v_commercial_*`.
- IA: `tenant_subscription_addons.ai -> commercial_addons.metadata.capability_keys`.
- RBAC: `permissions` + `role_permissions` as final permission catalog after aligning key names.
- KPI: `official_formula_versions`, `calculation_*`, `metric_definition_versions`, `metric_snapshots`.

KEEP_COMPATIBILITY:

- `tenants.ai_plan` as display/config history only.
- `pyme/empresa/enterprise` plan keys behind service aliases.
- `v_tenant_commercial_entitlements` as pure projection.
- `KPI-HLT-*` only if visibly labeled/mapped to non-official operational health.

MIGRATE_AND_DEPRECATE:

- Missing required permissions: decide whether to add/grant `ai_compliance.read` and `actions.read` or remap capabilities to existing `ai.view`/`actions.view`.
- Duplicate active `tenant_subscription_addons.ai` rows.
- Legacy plan-level AI in `legacy` plan.
- Health key mapping from `KPI-HLT-*`/`EVIDENCE-COVERAGE` to official keys.

REMOVE_RUNTIME_DEPENDENCY:

- GET `/api/grc/overview` dependency on recalculation/persistence.
- Direct action APIs serving without backend commercial gate.
- Frontend route gates depending on missing permission keys.
- Runtime decisions from `tenants.ai_plan`.

REMOVE_FUTURE:

- Physical legacy plan AI authority after migration/compatibility period.
- Unmapped `KPI-HLT-*` if official Health becomes sole product authority.
- `EVIDENCE-COVERAGE` frontend expectation unless an official metric is introduced.

Verification strategy:

- Forward-only catalog migration reviewed by human.
- Read-only pre/post SQL for permissions, effective capabilities and Health mappings.
- Focused backend route tests after implementation.
- Runtime validation by user after deploy; Codex must not deploy.

## Correction Order

1. Normalize RBAC/capability catalog first: resolve `ai_compliance.read` and `actions.read`, then validate Credex `/api/me/entitlements`.
2. Normalize duplicate/addon and legacy AI authority: de-duplicate active AI add-on rows and remove/deprecate legacy plan-level AI runtime authority.
3. Split `/api/grc/overview` read projection from recalculation/persistence.
4. Add backend commercial gates to recommended-actions/action-plans APIs to match frontend route authority.
5. Decide Health authority/mapping: official snapshots vs operational health, including `KPI-HLT-*`, `EVIDENCE-FRESH`, `COVERAGE`, and absent `EVIDENCE-COVERAGE`.
6. Decide KPI global formula governance: keep strict v1 as-is or introduce a new dynamic-denominator version with explicit semantic limits.
7. Fix frontend/UI symptoms after authorities and data are normalized: `/encuestas` duplicate AppLayout, route visibility, labels.

## Do Not Rediscover

- INC-02 root cause is already confirmed by code and was not contradicted by DB.
- AI commercial authority for standard plans is addon-first and DB-confirmed.
- `ai_plan` is not a commercial entitlement gate.
- `v_commercial_tenant_capabilities` is the canonical commercial capability view and is addon-aware in production.
- `/api/grc/overview` must not be called during audit because its GET mutates through recalculation.
- Official KPI null/unmeasured is not zero and must not be coerced.

## Gates

- `code_modified=NO`
- `migrations_modified=NO`
- `tests_modified=NO`
- `production_writes=NO`
- `audit_artifacts_only=YES`
- `NEXT_GATE=HUMAN_REVIEW_BEFORE_NORMALIZATION_OR_FIX`
