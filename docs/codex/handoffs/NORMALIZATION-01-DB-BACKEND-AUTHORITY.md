# NORMALIZATION-01 — DB + Backend Authority

Fecha: 2026-09-01
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
Base HEAD: `84fc1799e497e0af2abe6089eb6e3c2b800905e9`
Status: `READY_FOR_HUMAN_REVIEW`
Modo: `CODEX_VALIDATION_MODE=FOCUSED_MINIMAL`

## Objetivo

Normalizacion forward-only de autoridades efectivas confirmadas por `POSTDEPLOY_LEGACY_CANONICAL_DB_AUDIT_COMPLETE` sin reauditoria global y sin validacion integral.

## Canonical Authorities

```text
AI_COMMERCIAL_AUTHORITY=tenant_subscription_addons.addon_key='ai'
AI_READ_PERMISSION_CANONICAL=ai.view
ACTIONS_READ_PERMISSION_CANONICAL=actions.view
PLAN_AUTHORITY=commercial_plans -> commercial_plan_versions -> plan_version_modules -> commercial_technical_capabilities
ADDON_AUTHORITY=tenant_subscription_addons -> plan_version_addons -> commercial_addons.metadata.capability_keys
GRC_READ_AUTHORITY=latest persisted official calculation/snapshot projection; GET /api/grc/overview does not recalculate
```

## Cambios

- `ai.compliance.required_permission` normalizado a `ai.view`.
- `iso.actions.required_permission` normalizado a `actions.view`.
- Migracion forward-only `database/migrations/20260901_normalization01_db_backend_authority.sql`.
- Runner `scripts/normalization/apply-normalization-01-migration.js` con SHA256, `schema_migrations`, `applied_by=current_user`, advisory lock, `--preflight`, `--apply`, idempotencia, fail-fast de checksum y postconditions.
- `scripts/deploy-vms.sh` registra `NORMALIZATION-01` despues de Commercial Plan Matrix y AI Add-on.
- APIs de acciones agregan `requireCommercialCapability('iso.actions')` con `actions.view`, `actions.manage`, `actions.approve` o `actions.delete` segun operacion.
- APIs IA agregan add-on/capability/RBAC gate explicito con `ai.view`; Auditor IA conserva `audit.review`.
- `GET /api/grc/overview` lee ultimos calculos oficiales persistidos y snapshots; el recalculate queda en rutas POST existentes.

## Migracion

```text
MIGRATION_ID=20260901_normalization01_db_backend_authority
MIGRATION_FILE=database/migrations/20260901_normalization01_db_backend_authority.sql
RUNNER=scripts/normalization/apply-normalization-01-migration.js
CHECKSUM=9dd53235b8f2b54afd9f09e047b5a3be44293b23b0969e66f442ed01a3761a78
HISTORICAL_MIGRATIONS_MODIFIED=NO
PRODUCTION_APPLY=NO
```

Postconditions del runner:

```text
AI_COMPLIANCE_PERMISSION_CANONICAL=true
ISO_ACTIONS_PERMISSION_CANONICAL=true
AI_COMPLIANCE_ORPHAN_PERMISSION_REFERENCE=0
ISO_ACTIONS_ORPHAN_PERMISSION_REFERENCE=0
ORPHAN_REQUIRED_PERMISSION_REFERENCES=0
STANDARD_PLAN_AI_CAPABILITY_COUNT=0
DUPLICATE_EFFECTIVE_AI_ADDONS=0
AI_ADDON_CAPABILITIES_OK=true
AI_ADDON_REQUIRED_FOR_AI=true
NO_USER_MUTATION=true
NO_ROLE_MUTATION=true
NO_SCOPE_MUTATION=true
```

## Validacion Minimal

PASS:

- `git diff --check`
- `node --check scripts/normalization/apply-normalization-01-migration.js`
- `bash -n scripts/deploy-vms.sh`
- `node scripts/normalization/apply-normalization-01-migration.js --checksum`
- `node --check backend/src/app.js`
- `node --check backend/src/routes/ai.routes.js`
- `node --check backend/src/routes/action-plans.routes.js`
- `node --check backend/src/routes/iso-operational-execution.routes.js`
- `node --check backend/src/routes/iso-recommended-actions.routes.js`
- `node --check backend/src/services/phase5/phase5.service.js`
- `node backend/src/services/commercial/normalization01Authority.contract.test.js`
- `node scripts/normalization/apply-normalization-01-migration.test.js`
- `node backend/src/services/commercial/aiAddonCommercial.contract.test.js`
- `node backend/src/services/commercial/commercialPlanMatrix.contract.test.js`

NOT_RUN:

- `--apply` productivo.
- Full CI, build, lint global, typecheck global, Playwright, E2E, route matrix completa.
- Productive preflight: `MIGRATION_DATABASE_URL` no estaba definido en el entorno local.

## Do Not Rediscover

- POSTDEPLOY-02 ya confirmo que Credex tiene tenant activo, subscription activa, add-on IA activo, runtime AI flags activos y `ai.compliance` source=`addon`.
- No reauditar 97 rutas, KPI/Health ni inventario DB en NORMALIZATION-01.
- Health/KPI, `EVIDENCE-COVERAGE`, dashboard symptoms y `/encuestas` nested layout quedan fuera de scope hasta NORMALIZATION-02/RELEASE-CLOSEOUT.

## Gates

```text
MISSING_CANONICAL_PERMISSIONS=0_POSTCONDITION
ORPHAN_REQUIRED_PERMISSION_REFERENCES=0_POSTCONDITION
DUPLICATE_EFFECTIVE_AI_ADDONS=0_POSTCONDITION
STANDARD_PLAN_EFFECTIVE_AI=0_POSTCONDITION
AI_PLAN_RUNTIME_DECISIONS=0
GRC_GET_RUNTIME_WRITES=0
ACTION_API_COMMERCIAL_GATE_GAPS=0
```

## Siguiente accion

Human review, then NORMALIZATION-02. El usuario ejecuta commit/push/PR/CI/merge/deploy/migracion/runtime validation.
