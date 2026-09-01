# RELEASE-CLOSEOUT — NORMALIZATION-01 + NORMALIZATION-02

Fecha: 2026-09-01
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Branch: `main`
Base HEAD verificado: `4642ff103735c79581441e61b65591112283d1b8`
Commit Codex: `NO_COMMIT`
Push/Deploy: `NO`
Status: `RELEASE_CLOSEOUT_NO_GO`
Modo: `CODEX_VALIDATION_MODE=FOCUSED_MINIMAL`

## Objetivo

Cierre integrado de NORMALIZATION-01 + NORMALIZATION-02 con regresion focal consolidada, sin reabrir autoridad comercial, RBAC, Health/KPI, precios, tenants, roles ni UI polish.

## Git / Precheck

```text
BRANCH=main
COMMIT=4642ff103735c79581441e61b65591112283d1b8
git diff --check=PASS
HISTORICAL_MIGRATIONS_UNCHANGED=true
20260828_commercial_standard_plan_matrix.sql_DIFF=EMPTY
20260831_ai_addon_commercial_visibility.sql_DIFF=EMPTY
```

Working tree permanece dirty por el paquete local de NORMALIZATION-01/02 y por este handoff/spec de cierre. No hubo commit porque el preflight PostgreSQL no pudo ejecutarse en este entorno.

## Canonical Authorities

```text
AI_COMMERCIAL_AUTHORITY=tenant_subscription_addons.addon_key='ai'
AI_READ_PERMISSION=ai.view
ACTIONS_READ_PERMISSION=actions.view
PLAN_AUTHORITY=commercial_plans -> commercial_plan_versions -> plan_version_modules -> commercial_technical_capabilities
ADDON_AUTHORITY=tenant_subscription_addons -> plan_version_addons -> commercial_addons.metadata.capability_keys
GRC_READ_AUTHORITY=latest persisted official calculation/snapshot projection
GLOBAL_HEALTH_AUTHORITY=official_formula_versions+calculation_runs+calculation_outputs+metric_snapshots+metric_source_bindings
GLOBAL_SCORE_FORMULA=F5_5_GRC_HEALTH
GLOBAL_SCORE_VERSION=2
```

## Migrations

```text
NORMALIZATION01=READY_LOCAL_NOT_APPLIED
NORMALIZATION01_CHECKSUM=9dd53235b8f2b54afd9f09e047b5a3be44293b23b0969e66f442ed01a3761a78
NORMALIZATION02=READY_LOCAL_NOT_APPLIED
NORMALIZATION02_CHECKSUM=b1daafdac3eda56dafd3cc47b655512bb34a88435a3954a5fd8de94c89f87da6
COMMERCIAL_PLAN_MATRIX_CHECKSUM=d968b7aad261d3dc259ff0e86d34ca7d991fdc96b1a1e6add0daad668435e020
AI_ADDON_CHECKSUM=9ef26317def63374887de4fe9147ab5c69f7c729c19ac42490cb72a5635865ad
MIGRATION_LEDGER=NOT_CHECKED_NO_MIGRATION_DATABASE_URL
```

Preflight PostgreSQL no ejecutado: `MIGRATION_DATABASE_URL_SET=NO`. No se leyeron ni imprimieron secretos. Por regla de release-closeout, esto bloquea commit, deploy oficial y postdeploy.

## Gate A — Contratos Focales

PASS:

```text
NORMALIZATION01_AUTHORITY_CONTRACT_PASS
AI_ADDON_COMMERCIAL_CONTRACT_PASS
COMMERCIAL_PLAN_MATRIX_CONTRACT_PASS
NORMALIZATION01_MIGRATION_CONTRACT_PASS
NORMALIZATION02_GLOBAL_SCORE_SEMANTICS_PASS
NORMALIZATION02_CANONICAL_HEALTH_PROJECTION_PASS
NESTED_ENCUESTAS_LAYOUT=0
NORMALIZATION02_RUNNER_CONTRACT_PASS
RBAC02_COMMERCIAL_GATING_CONTRACT_PASS
COMMERCIAL_VISIBILITY_ENTITLEMENT_CONTRACT_PASS
CONTRACT_SUBSCRIPTION_SYNC_TEST_PASS
PHASE6_COMMERCIAL_MULTITENANT_CONTRACT_PASS
Imports explicit RBAC: VERIFIED routes=10 definitions=33 operational=10 blocked=23
```

## Gate B — Calidad / Build

PASS:

```text
frontend npm run lint
frontend npm run typecheck
frontend npm run build
backend npm run check
node --check touched backend services and normalization runners
bash -n scripts/deploy-vms.sh
```

Next modifico automaticamente `frontend/tsconfig.json` para agregar `.next/dev/types/**/*.ts`; el cambio generado fue restaurado puntualmente.

## Gate C — Regresion Critica Dirigida

PASS local con un spec focal nuevo:

```text
frontend/playwright.release-closeout.config.ts
frontend/tests/e2e/release-closeout-normalization.spec.ts
WEB_BASE_URL=http://localhost:3001 npx playwright test --config=playwright.release-closeout.config.ts
11 passed
```

Cobertura del spec:

```text
/dashboard
/dashboard?view=kpi
/ia-compliance
/ia-auditor
/acciones-recomendadas
/planes-accion
/encuestas
/grc
/health
/iso-health
health canonical authority fixture across dashboard/health/iso-health
```

El spec usa token sintetico y fixtures API locales; no usa tenants reales, credenciales, datos demo productivos ni runtime DB. RBAC/comercial/multi-tenant quedan cubiertos por contratos focales locales; validacion runtime real queda pendiente.

## Deploy / Runtime

```text
DEPLOY=NOT_RUN_PRECHECK_BLOCKED
POSTDEPLOY=NOT_RUN
BACKEND_SHA=NOT_CHECKED_RUNTIME
AI_ENGINE_SHA=NOT_CHECKED_RUNTIME
FRONTEND_SHA=NOT_CHECKED_RUNTIME
```

No se ejecuto `./scripts/deploy-vms.sh` porque falta preflight PASS de migraciones.

## Warnings

Warning no bloqueante observado durante Playwright local: Next/browser reporta que `tecdex.png` tiene width o height modificado sin preservar explicitamente el otro eje. No fue introducido ni corregido en este cierre.

## Verdict

```text
VERDICT=RELEASE_CLOSEOUT_NO_GO
RELEASE_DECISION=NO_GO
BLOCKERS=MIGRATION_DATABASE_URL unavailable; NORMALIZATION01/02 preflight not executed; official deploy not executed; postdeploy runtime not executed
NEXT_ACTION=Run official migration preflight in authorized DB/deploy context, then continue from this handoff without reauditing
```

## Do Not Rediscover

- No reabrir NORMALIZATION-01/02 autoridades aprobadas salvo fallo objetivo nuevo.
- No reejecutar Gate A/B local completo salvo cambio de codigo relevante.
- No repetir discovery repo-wide ni demo visual.
- Continuar desde este handoff con preflight PostgreSQL oficial como primer paso.
