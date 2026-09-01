# HOTFIX-POSTDEPLOY-01 — ISO Health + IA Compliance + GRC

Fecha: 2026-09-01
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
Base HEAD: `ab63c0c4d7f37a88275b030d7ce5920c75504365`
Commit Codex: `NO_COMMIT`
Push/Deploy: `NO`
Status: `READY_FOR_HUMAN_REVIEW`
Modo: `CODEX_VALIDATION_MODE=FOCUSED_MINIMAL`

## Scope

Hotfix focal postdeploy para tres defects productivos:

- `/iso-health`: `column cr.source_as_of does not exist`.
- `/ia-compliance`: `Acceso restringido` con add-on IA activo.
- `/grc`: `Error procesando información GRC`, request_id `web-1788294251198-ff1293a847d9b`.

No se reabrió NORMALIZATION-01/02, AI Reconciliation, modelo comercial, autoridad de add-on, planes, tenants, usuarios, fórmulas ni arquitectura GRC.

## Preflight

```text
BRANCH=main
HEAD=ab63c0c4d7f37a88275b030d7ce5920c75504365
WORKTREE_CLEAN_BEFORE_HOTFIX=YES
git diff --check=PASS
```

## Root Causes

### ISO Health

```text
ISO_HEALTH_ROOT_CAUSE=canonicalHealthProjection.service.js assumed calculation_runs had cr.source_as_of and cr.created_at.
ISO_HEALTH_BAD_QUERY=loadLatestRuns SELECT/ORDER BY cr.source_as_of and cr.created_at from calculation_runs cr.
ISO_HEALTH_CANONICAL_SOURCE=calculation_runs period_start, period_end, started_at, completed_at plus calculation_outputs output_value/metadata; metric_snapshots effective_at/published_at/created_at for snapshots.
ISO_HEALTH_FIX=loadLatestRuns now orders by COALESCE(cr.period_end, cr.completed_at, cr.started_at, cr.period_start) and projects as_of/updated_at only from real calculation_runs columns.
SCHEMA_COMPATIBLE=YES
```

Productive read-only schema evidence:

```text
transaction_read_only=on
calculation_runs columns include id, tenant_id, formula_code, run_status, period_start, period_end, started_at, completed_at, metadata.
calculation_runs columns do not include source_as_of or created_at.
latest focal runs have period_start, period_end, started_at and completed_at present.
```

### IA Compliance

```text
AI_COMPLIANCE_FIRST_FAILED_GATE=RBAC canonical permission ai.view for tenant roles.
AI_ADDON_EFFECTIVE=YES
AI_COMPLIANCE_CAPABILITY=enabled=true source=addon required_permission=ai.view module_key=ai_compliance
AI_VIEW_PERMISSION=false for observed tenant admin/auditor roles before hotfix migration
AI_SUGGESTIONS_FLAG=true
AI_AUDITOR_CONTROL_POSITIVE=YES, audit.review=true and ai.auditor enabled=true source=addon
AI_COMPLIANCE_ROOT_CAUSE=NORMALIZATION-01 canonicalized ai.compliance to ai.view, but tenant IA roles were not reconciled to receive ai.view; Auditor Senior IA uses audit.review, which those roles already had.
AI_COMPLIANCE_FIX=new forward-only RBAC migration grants ai.view only to active tenant roles admin, tenant_admin and auditor; platform roles remain allowed; unauthorized active roles are postcondition-guarded to remain without ai.view.
```

Productive read-only DB evidence:

```text
transaction_read_only=on
AI_ADDON ai active true
AI_CAP ai.compliance ai.view true addon ai_compliance
AI_CAP ai.auditor audit.review true addon ai_compliance
RUNTIME ai_enabled=true suggestions=true auditor_flag=true auditor_feature=true
ROLE_PERMISSION admin ai.view=false
ROLE_PERMISSION auditor ai.view=false
ROLE_PERMISSION admin/auditor audit.review=true
HOTFIX_RBAC_STATE ai_permission_active=true ai_compliance_canonical=true tenant_expected_role_count=3 tenant_expected_ai_view_count=0 unauthorized_ai_view_role_count=0
```

### GRC

```text
GRC_REQUEST_ID_FOUND=YES
GRC_RUNTIME_EXCEPTION=column cr.source_as_of does not exist
GRC_SQLSTATE=42703
GRC_ROOT_CAUSE=/api/grc/overview consumes canonicalHealthProjection.getCanonicalHealthProjection; the shared Health projection failed before returning the GRC overview payload.
GRC_GET_WRITES=NO
GRC_FIX=same schema-compatible canonicalHealthProjection loadLatestRuns fix as ISO Health.
```

Log evidence:

```text
Sep 01 20:24:11 bk-v4.tcdx.int tecdex-backend: {"event":"PHASE5_ERROR","request_id":"web-1788294251198-ff1293a847d9b","route":"GET /api/grc/overview","status":500,"code":"42703","message":"column cr.source_as_of does not exist"}
Sep 01 20:24:11 bk-v4.tcdx.int tecdex-backend: {"event":"HTTP_REQUEST","request_id":"web-1788294251198-ff1293a847d9b","method":"GET","route":"/overview","status":500,"error_code":"42703"}
```

### I18N

```text
RAW_KEY_FIXED=YES
ROOT_CAUSE=navigation.destinations.aiAuditor was referenced by enterpriseNavigation but missing under navigation.destinations in es/en dictionaries.
FIX=added navigation.destinations.aiAuditor to es.json and en.json.
```

## Migration

```text
MIGRATION_REQUIRED=YES
MIGRATION_ID=20260901_hotfix_postdeploy01_ai_view_rbac
MIGRATION_FILE=database/migrations/20260901_hotfix_postdeploy01_ai_view_rbac.sql
RUNNER=scripts/normalization/apply-hotfix-postdeploy-01-migration.js
CHECKSUM=9892f290d30310b22d9f86ce1bf65a329d3fe77c6b57ddcad546d839635e1d6d
FORWARD_ONLY=YES
IDEMPOTENT=YES
MULTI_TENANT=YES
FAIL_CLOSED=YES
PRODUCTION_APPLY=NO
```

RBAC migration scope:

```text
GRANTED_ROLE_PERMISSIONS=admin,tenant_admin,auditor -> ai.view
PLATFORM_AI_VIEW_ROLES_ALLOWED=platform_admin,superadmin,super_admin,global_admin,admin_global,owner
UNAUTHORIZED_ROLES_GUARDED_WITHOUT_AI_VIEW=YES
USERS_MODIFIED=NO
APP_ROLES_MODIFIED=NO
PERMISSIONS_MODIFIED=NO
COMMERCIAL_PLANS_MODIFIED=NO
TENANT_SUBSCRIPTIONS_MODIFIED=NO
TENANT_ADDONS_MODIFIED=NO
AI_PLAN_USED=NO
```

Runner postconditions:

```text
AI_PERMISSION_ACTIVE=true
AI_COMPLIANCE_PERMISSION_CANONICAL=true
TENANT_EXPECTED_ROLE_COUNT=3
TENANT_EXPECTED_AI_VIEW_COUNT=3 after apply
UNAUTHORIZED_AI_VIEW_ROLE_COUNT=0
USER_MUTATION_COUNT=0
COMMERCIAL_MUTATION_COUNT=0
```

## Files Modified

- `backend/src/services/math-governance/canonicalHealthProjection.service.js`
- `backend/src/services/math-governance/canonicalHealthProjection.service.test.js`
- `database/migrations/20260901_hotfix_postdeploy01_ai_view_rbac.sql`
- `scripts/normalization/apply-hotfix-postdeploy-01-migration.js`
- `scripts/normalization/apply-hotfix-postdeploy-01-migration.test.js`
- `scripts/deploy-vms.sh`
- `frontend/src/i18n/dictionaries/es.json`
- `frontend/src/i18n/dictionaries/en.json`
- `docs/codex/handoffs/HOTFIX-POSTDEPLOY-01-ISOHEALTH-AI-GRC.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/DECISIONS.md`

## Validation

PASS:

```text
git diff --check
node --check backend/src/services/math-governance/canonicalHealthProjection.service.js
node --check backend/src/services/math-governance/canonicalHealthProjection.service.test.js
node --check scripts/normalization/apply-hotfix-postdeploy-01-migration.js
node --check scripts/normalization/apply-hotfix-postdeploy-01-migration.test.js
bash -n scripts/deploy-vms.sh
node scripts/normalization/apply-hotfix-postdeploy-01-migration.js --checksum
node scripts/normalization/apply-hotfix-postdeploy-01-migration.test.js
node backend/src/services/math-governance/canonicalHealthProjection.service.test.js
node backend/src/services/math-governance/grcHealthCalculation.service.test.js
node backend/src/services/commercial/aiAddonCommercial.contract.test.js
node backend/src/services/commercial/normalization01Authority.contract.test.js
npm --prefix frontend run test:phase6-sidebar-rbac
npm --prefix frontend run test:phase6-commercial-multitenant
```

NOT_RUN:

```text
full CI
full regression
frontend build
backend npm run check
Playwright/E2E
production migration apply
deploy
commit
push
```

## Safety

```text
HISTORICAL_MIGRATIONS_MODIFIED=NO
NORMALIZATION01_MODIFIED=NO
NORMALIZATION02_MODIFIED=NO
AI_RECONCILIATION_MODIFIED=NO
TENANT_SPECIFIC_LOGIC=NO
PRODUCTION_WRITES=NO
DEPLOY=NO
COMMIT=NO
PUSH=NO
```

## Regression Risk

```text
ISO_HEALTH_RISK=LOW, removes invalid columns and uses real temporal fields already used by adjacent GRC/sourceResolver queries.
GRC_RISK=LOW, shared projection fix only; GET remains read-only and no recalculation path added.
AI_RBAC_RISK=LOW_TO_MEDIUM, role_permissions grant is global by role but limited to product-authorized tenant IA roles; fail-closed postcondition blocks unexpected ai.view roles.
I18N_RISK=LOW, dictionary key only.
```

## Remaining Debt

```text
BLOCKER=NONE
MAJOR=NONE_WITHIN_HOTFIX_SCOPE
DEBT_WITHIN_HOTFIX_SCOPE=NONE
```

## Next Gate

```text
HUMAN_REVIEW -> COMMIT -> PUSH -> OFFICIAL_DEPLOY -> POSTDEPLOY_RUNTIME_VALIDATION
```

## Do Not Rediscover

- Do not re-open NORMALIZATION-01/02 or AI Reconciliation.
- Do not introduce `ai_plan` into access decisions.
- Do not broaden IA Compliance beyond `admin`, `tenant_admin`, `auditor` plus existing platform roles.
- Do not re-query `source_as_of` from `calculation_runs`; schema-compatible temporal source is `period_end/completed_at/started_at/period_start`.
