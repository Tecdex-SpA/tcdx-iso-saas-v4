# AI-ADDON MIGRATION ORDER RECONCILIATION

Fecha: 2026-09-01
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
Base HEAD: `279ec9a68a87bb1da8751d2df426b498a4c1286e`
Commit Codex: `NO_COMMIT`
Push/Deploy: `NO`
Status: `READY_FOR_HUMAN_REVIEW`
Modo: `CODEX_VALIDATION_MODE=FOCUSED_MINIMAL`

## Objetivo

Hotfix forward-only para corregir la inconsistencia de orden/ledger entre `20260828_commercial_standard_plan_matrix` y `20260831_ai_addon_commercial_visibility`, sin modificar migraciones historicas ni aplicar migraciones desde Codex.

## Root Cause

```text
COMMERCIAL_20260828_REAPPLY_ROOT_CAUSE=schema_migrations did not contain an applied row for migration_id=20260828_commercial_standard_plan_matrix at the moment the official deploy runner evaluated it, so migrationState returned pending by the runner's exact lookup; checksum/status/details drift did not cause pending. The subsequent reapply of historical SQL restored ai.compliance/ai.auditor as GRC_ADVANCED plan-level catalog entries and reintroduced ai_compliance in the enterprise base plan, while 20260831 already had an applied ledger row. Effective catalog state therefore contradicted the 20260831 ledger.
```

## Cambios

- `scripts/commercial-plan/apply-commercial-plan-matrix-migration.js`: ledger state is evaluated before catalog drift; `applied + checksum` always reports `already_applied`, while checksum mismatch still fails fast. Approved permission/classification evolution remains postcondition compatibility only and cannot make a historical migration pending.
- `scripts/ai-addon/apply-ai-addon-migration.js`: when `20260831` ledger is already applied, recognizes only the known historical-reapply state and returns `already_applied_with_reconciliation_required=true` if the reconciliation migration is pending.
- `database/migrations/20260901_reconcile_ai_addon_after_historical_reapply.sql`: new idempotent forward-only repair. Restores AI Add-on catalog invariants and removes AI from base standard plans without touching tenants, subscriptions, tenant add-ons, users, roles, role permissions or contracts.
- `scripts/normalization/apply-ai-addon-reconciliation-migration.js`: checksum, preflight, apply path, ledger handling, advisory lock and postconditions for the new repair migration.
- `scripts/deploy-vms.sh`: ordered as Commercial Plan Matrix -> AI Add-on -> AI Add-on Reconciliation -> NORMALIZATION-01 -> NORMALIZATION-02 -> services.

## Reconciliation

```text
RECONCILIATION_MIGRATION=database/migrations/20260901_reconcile_ai_addon_after_historical_reapply.sql
RECONCILIATION_RUNNER=scripts/normalization/apply-ai-addon-reconciliation-migration.js
RECONCILIATION_CHECKSUM=4238404c3f0c464547e02ae51d3a267fdf17b3494292ee16a1bd982e752d45aa
IDEMPOTENT=YES
FORWARD_ONLY=YES
TENANT_AGNOSTIC=YES
```

## Productive Preflight

READ-ONLY tunnel validation:

```text
DB_CONNECTION=PASS
DB_READ_ONLY=YES
DATABASE=tecdex_saas
DB_USER=postgres
POSTGRESQL_VERSION=16.15
```

Preflight results:

```text
COMMERCIAL_PLAN_PREFLIGHT=PASS
COMMERCIAL_PLAN_MIGRATION_STATE=already_applied
COMMERCIAL_PLAN_PENDING=none
AI_ADDON_PREFLIGHT=PASS_OR_RECONCILIATION_REQUIRED
AI_ADDON_MIGRATION_STATE=already_applied
AI_ADDON_RECONCILIATION_REQUIRED=true
AI_RECONCILIATION_PREFLIGHT=PASS
AI_RECONCILIATION_MIGRATION_STATE=pending
AI_RECONCILIATION_REQUIRED=true
NORMALIZATION01_PREFLIGHT=PASS
NORMALIZATION02_PREFLIGHT=PASS
UNEXPECTED_BLOCKERS=0
```

Observed current DB state remains intentionally unrepaired because Codex did not apply migrations:

```text
AI_CAPABILITIES_READY=0_PRE_RECONCILIATION
BASE_PLANS_DO_NOT_INCLUDE_AI=false_PRE_RECONCILIATION
COMPATIBLE_STANDARD_PLAN_VERSIONS=3
```

Expected after the new reconciliation migration is applied by the official deploy:

```text
AI_CAPABILITIES_READY=2
BASE_PLANS_DO_NOT_INCLUDE_AI=true
COMPATIBLE_STANDARD_PLAN_VERSIONS=3
```

## Validation

PASS:

```text
git diff --check
node --check scripts/commercial-plan/apply-commercial-plan-matrix-migration.js
node scripts/commercial-plan/apply-commercial-plan-matrix-migration.js --checksum
node scripts/commercial-plan/apply-commercial-plan-matrix-migration.test.js
node --check scripts/ai-addon/apply-ai-addon-migration.js
node scripts/ai-addon/apply-ai-addon-migration.js --checksum
node --check scripts/normalization/apply-ai-addon-reconciliation-migration.js
node scripts/normalization/apply-ai-addon-reconciliation-migration.js --checksum
node scripts/normalization/apply-ai-addon-reconciliation-migration.test.js
node scripts/normalization/apply-normalization-01-migration.js --checksum
node scripts/normalization/apply-normalization-02-migration.js --checksum
bash -n scripts/deploy-vms.sh
```

Protected migration diffs:

```text
20260828_SQL_MODIFIED=NO
20260831_SQL_MODIFIED=NO
NORMALIZATION01_SQL_MODIFIED=NO
NORMALIZATION02_SQL_MODIFIED=NO
HISTORICAL_CHECKSUMS_PRESERVED=YES
```

## Safety

```text
PRODUCTION_WRITES=NO
MIGRATIONS_APPLIED=NO
USERS_MODIFIED=NO
ROLES_MODIFIED=NO
TENANT_SPECIFIC_LOGIC=NO
DEPLOY=NO
COMMIT=NO
PUSH=NO
BLOCKERS=NONE
```

## Do Not Rediscover

- Do not modify historical SQL migrations `20260828` or `20260831`.
- Do not reapply `20260831` opaquely; use the new reconciliation migration.
- Do not run deploy, push, commit or `--apply` from Codex.
- Do not reopen NORMALIZATION-01/02 without new objective failure.

## Next Gate

```text
HUMAN_COMMIT_PUSH_RERUN_OFFICIAL_DEPLOY
```
