# Handoff — AI Core Runtime Grants

Fecha: 2026-09-14
Owner funcional: CODEX A+B — Data/Backend + AI
Branch: `main`
Head/commit SHA: `UNCOMMITTED_WORKTREE`
Validation mode: `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`
Status: `AI_CORE_RUNTIME_GRANTS_ALLOWLIST_REVIEW_READY`

## Scope

Correccion forward-only del contrato de privilegios runtime para que `tcdx_backend_runtime` pueda leer las cuatro vistas canonicas de `ai_core` que consume AI Engine:

- `ai_core.v_tenant_health_context`
- `ai_core.v_control_context`
- `ai_core.v_finding_context`
- `ai_core.v_kpi_context`

No se hizo commit, push, merge, deploy, cambio de secretos, lectura de `.env`, escritura a QA/produccion ni `GRANT` manual directo.

## Root Cause

El codigo desplegado de `context_builder.py` ya consume las vistas canonicas correctas, pero el contrato de grants fresh/runtime no otorgaba `SELECT` explicito sobre esas vistas a `tcdx_backend_runtime`. Como `tcdx_backend_app` hereda de `tcdx_backend_runtime`, la ausencia de grants en el rol runtime se manifestaba como:

`permission denied for view v_tenant_health_context`

en `/api/ai/suggest/finding-analysis` y `/api/ai/suggest/action-plan`.

Revision post-deploy attempt: el primer apply QA sobre commit `42cc832` fallo correctamente en fail-closed con `unexpected_runtime_ai_core_select_count=4`. El runner hizo rollback; la migracion no quedo registrada en `public.schema_migrations` y los cuatro grants nuevos quedaron revertidos. La causa del bloqueo no fue un privilegio residual anomalico, sino que el runner solo permitia `ai_core.v_external_lookup_usage_monthly` como contrato runtime previo, omitiendo cuatro objetos External Lookup versionados:

- `ai_core.external_lookup_extra_charges`
- `ai_core.external_lookup_logs`
- `ai_core.external_lookup_quota_audit`
- `ai_core.external_lookup_quotas`

El origen versionado de esos privilegios es `database/migrations/20260910_tcdx_saasv2_fresh_runtime_contract_closeout.sql`, que otorga `SELECT, INSERT, UPDATE` sobre esas cuatro tablas External Lookup a `tcdx_backend_runtime` y `SELECT` sobre `ai_core.v_external_lookup_usage_monthly`.

## Decision

No se modifican migraciones ya aplicadas ni se ejecuta SQL manual. Se agrega una migracion forward-only nueva y un runner idempotente registrado en fresh deploy.

La migracion valida rol runtime, rol app, schema `ai_core`, vistas requeridas y membresia app -> runtime. Luego ejecuta solo:

```sql
GRANT SELECT ON ai_core.v_tenant_health_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_control_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_finding_context TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_kpi_context TO tcdx_backend_runtime;
```

No otorga `GRANT ALL`, no usa `ON ALL TABLES`, no concede a `tcdx_backend_app`, no concede a `ai_reader`, no cambia ownership, no otorga DML y no duplica `USAGE ON SCHEMA ai_core`.

Allowlist del runner: `PREEXISTING_AI_CORE_RUNTIME_SELECT_RELATIONS` contiene los cinco objetos External Lookup previos; `AI_CORE_CONTEXT_VIEWS` contiene las cuatro vistas nuevas; `AUTHORIZED_AI_CORE_RUNTIME_SELECT_RELATIONS` es la union explicita. Cualquier otro objeto `ai_core` con `SELECT` para `tcdx_backend_runtime` sigue fallando el gate.

## Files Changed

- `database/migrations/20260914_ai_core_runtime_context_view_grants.sql`
- `scripts/normalization/apply-ai-core-runtime-context-grants.js`
- `scripts/normalization/apply-ai-core-runtime-context-grants.test.js`
- `scripts/deploy-vms.sh`
- `scripts/deploy-vms-strategy.test.js`
- Continuity docs for this handoff/work queue/state/contract/architecture/ADR/regression command.

## Tests

PASS:

```bash
node --check scripts/normalization/apply-ai-core-runtime-context-grants.js
node --check scripts/normalization/apply-ai-core-runtime-context-grants.test.js
bash -n scripts/deploy-vms.sh
node scripts/normalization/apply-ai-core-runtime-context-grants.js --checksum
node scripts/normalization/apply-ai-core-runtime-context-grants.test.js
PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py
node scripts/deploy-vms-strategy.test.js
node scripts/normalization/db-n05-production-role-privileges.postgres.test.js
python3 -m py_compile ai-engine/app/services/llm_client.py ai-engine/app/routes/ai.py ai-engine/app/services/scenario_response_enricher.py ai-engine/app/services/senior_auditor_orchestrator.py ai-engine/app/services/language_service.py ai-engine/app/services/context_builder.py ai-engine/app/services/solution_engine.py ai-engine/app/services/problem_classifier.py ai-engine/app/scripts/test_dgx_litellm_hardening.py
git diff --check
```

Key isolated PostgreSQL evidence:

- previous fresh runtime External Lookup contract setup: PASS
- pre-existing External Lookup runtime SELECT: `t`
- initial runtime SELECT over the four views: `0`
- after apply runtime SELECT over four views: `t`
- app inherited SELECT over four views: `t`
- `tcdx_backend_runtime` NOLOGIN: `f` for `rolcanlogin`
- `tcdx_backend_app` INHERIT/member of runtime: `t`/`t`
- `ai_reader` SELECT over four views: `0`
- runtime DML over four views: `0`
- unexpected runtime `ai_core` SELECT count: `0`
- negative probe with extra `ai_core` SELECT grant rejected: PASS
- already-applied preflight PASS
- reapply idempotent PASS
- checksum mismatch rejected PASS
- script output did not leak connection strings/passwords

## Manual Postdeploy Commands

Authorized environment only; do not print secrets.

```bash
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-core-runtime-context-grants.js --preflight
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-core-runtime-context-grants.js --apply
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-core-runtime-context-grants.js --preflight
```

Read-only verification:

```sql
SELECT
  has_schema_privilege('tcdx_backend_runtime','ai_core','USAGE') AS runtime_ai_core_usage,
  has_table_privilege('tcdx_backend_runtime','ai_core.v_tenant_health_context','SELECT') AS tenant_health_select,
  has_table_privilege('tcdx_backend_runtime','ai_core.v_control_context','SELECT') AS control_context_select,
  has_table_privilege('tcdx_backend_runtime','ai_core.v_finding_context','SELECT') AS finding_context_select,
  has_table_privilege('tcdx_backend_runtime','ai_core.v_kpi_context','SELECT') AS kpi_context_select,
  (SELECT rolcanlogin FROM pg_roles WHERE rolname='tcdx_backend_runtime') AS runtime_can_login,
  pg_has_role('tcdx_backend_app','tcdx_backend_runtime','member') AS app_member_runtime;
```

Then retry:

- `POST /api/ai/suggest/finding-analysis`
- `POST /api/ai/suggest/action-plan`

Expected: no 500 from `permission denied for view v_tenant_health_context`.

## Do Not Rediscover

- Do not grant directly to `tcdx_backend_app`; access comes by role inheritance.
- Do not grant anything to `ai_reader`.
- Do not use global grants or schema-wide table grants.
- Do not replay historical migrations on `tcdx_saasv2`.
- Do not re-open DGX connectivity unless objective new evidence appears.
