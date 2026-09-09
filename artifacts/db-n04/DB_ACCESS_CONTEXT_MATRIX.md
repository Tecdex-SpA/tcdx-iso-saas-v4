# DB-N04 DB Access Context Matrix

Date: 2026-09-07
Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Inventory commands:

```bash
rg -l "pool\.query|pool\.connect|client\.query|BEGIN|COMMIT|ROLLBACK" backend/src/routes backend/src/services backend/src/middleware backend/src/utils ai-engine scripts database | wc -l
rg -l "FROM controls|JOIN controls|controls\.id|catalog_control_id" backend frontend ai-engine scripts database | wc -l
```

Inventory counts:

| scope | count |
|---|---:|
| Files with DB access patterns across runtime/scripts/database | 233 |
| Files with controls legacy identity references | 81 |
| Matrix rows reviewed for DB-N04 runtime decision | 34 |
| `TENANT_CONTEXT_REQUIRED` | 16 |
| `PLATFORM_CONTEXT_REQUIRED` | 5 |
| `GLOBAL_SAFE` | 5 |
| `MIGRATION_ONLY` | 5 |
| `LEGACY` | 3 |

## Matrix

| file | function | scope | tenant source | transaction | helper | RLS-safe | decision |
|---|---|---|---|---|---|---|---|
| `backend/src/config/db.js` | exported `pool` | `TENANT_CONTEXT_REQUIRED` | AsyncLocalStorage request/job context | auto per direct query or manual `BEGIN` | `createTenantAwarePool` | YES for wrapped runtime | Canonical runtime pool wrapper. |
| `backend/src/app.js` | `/api` middleware chain | `TENANT_CONTEXT_REQUIRED` | authenticated user / `resolvedTenantId` | downstream | `tenantContextMiddleware` | YES for tenant routes | API requests enter tenant context after tenant scope enforcement. |
| `backend/src/middleware/auth.js` | `validateTenantServiceStatus` | `TENANT_CONTEXT_REQUIRED` | JWT/effective tenant | explicit | `withTenantTransaction` | YES | Auth-time tenant status read is transaction-local before generic middleware. |
| `backend/src/routes/findings.routes.js` | findings reads/writes | `TENANT_CONTEXT_REQUIRED` | request tenant/auth | route/service DB calls | pool wrapper + DB-N01 identity resolver | READY for pilot | DB-N03 pilot table; keep tenant filters until RLS rollout. |
| `backend/src/routes/evidences.routes.js` | evidence reads/writes | `TENANT_CONTEXT_REQUIRED` | request tenant/auth | route/service DB calls | pool wrapper + DB-N01 identity resolver | READY for pilot | DB-N03 pilot table; legacy route remains separate risk. |
| `backend/src/routes/action-plans.routes.js` | action plan CRUD | `TENANT_CONTEXT_REQUIRED` | request tenant/auth | route/service DB calls | pool wrapper + DB-N01 identity resolver | READY for pilot | DB-N03 pilot table. |
| `backend/src/routes/controls.routes.js` | tenant controls/readiness | `TENANT_CONTEXT_REQUIRED` | request tenant/auth | route/service DB calls | pool wrapper | PARTIAL | `controls` compatibility reads remain; no drop readiness. |
| `backend/src/services/grc/grc.service.js` | workflow/read-model DB use | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | mixed | pool wrapper | PARTIAL | Covered by request context; still needs runtime RLS pilot validation. |
| `backend/src/services/isoOperationalExecution.service.js` | operational action execution | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | mixed | pool wrapper | PARTIAL | DB-N01 writes use tenant control identity; keep focal tests. |
| `backend/src/services/isoRecommendedActions.service.js` | recommendation/action conversions | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | mixed | pool wrapper | PARTIAL | Tenant filters remain required until RLS enabled. |
| `backend/src/services/math-governance/canonicalHealthProjection.service.js` | Health projection reads | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | direct reads | pool wrapper | PARTIAL | DB-N02 authority preserved; no formula recompute. |
| `backend/src/services/soaIntelligence.service.js` | SoA/Health joins | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | direct reads | pool wrapper | PARTIAL | `controls` compatibility still present; no drop readiness. |
| `backend/src/services/evidence-ai.service.js` | background job processing | `TENANT_CONTEXT_REQUIRED` | job `tenant_id` after platform claim | explicit/manual | `runWithDbTenantContext` + pool wrapper | READY for tenant work | Job claim is platform; job body runs tenant-scoped. |
| `backend/src/services/grc/grcSchedulerRunner.js` | enabled tenant loop | `TENANT_CONTEXT_REQUIRED` | enumerated tenant id | per tenant | `runWithDbTenantContext` | READY | Global controller -> tenant-scoped service execution. |
| `backend/src/services/grc/phase2SchedulerRunner.js` | connector loop | `TENANT_CONTEXT_REQUIRED` | connector `tenant_id` | per connector | `runWithDbTenantContext` | READY | Connector run/scheduleNext are tenant-scoped. |
| `backend/src/services/tenantAiSettings.service.js` | tenant AI settings | `TENANT_CONTEXT_REQUIRED` | tenant argument/request | direct reads/writes | pool wrapper | PARTIAL | Backend covered when invoked under API context; AI engine separate. |
| `backend/src/services/grc/grcSchedulerRunner.js` | enabled tenant discovery | `PLATFORM_CONTEXT_REQUIRED` | none; global controller | direct query | `runWithPlatformDbContext` | YES for read scope | Explicit platform scheduler role; tenant cannot request it. |
| `backend/src/services/grc/phase2SchedulerRunner.js` | due connector discovery | `PLATFORM_CONTEXT_REQUIRED` | none; scheduler controller | direct query | `runWithPlatformDbContext` | YES for read scope | Enumerates due connectors before tenant run. |
| `backend/src/services/evidence-ai.service.js` | `claimNextJobWithPlatformContext` | `PLATFORM_CONTEXT_REQUIRED` | none; worker claim | explicit transaction | `withPlatformTransaction` | YES for claim | Platform worker claims next job; processing switches to tenant. |
| `backend/src/routes/admin-saas.routes.js` | platform admin operations | `PLATFORM_CONTEXT_REQUIRED` | server-side admin role | route/service DB calls | platform route RBAC + future admin connection/policy | PARTIAL | Not broadened in DB-N04; no tenant input can request platform DB context. |
| `scripts/*/apply-*.js` | migration runners | `PLATFORM_CONTEXT_REQUIRED` | environment/operator | explicit | runner-owned | NOT_RUNTIME | Requires authorized operator context; not used for tenant API traffic. |
| `backend/src/services/commercial/*` | commercial catalog/config | `GLOBAL_SAFE` | global/catalog plus tenant entitlement filters | mixed | existing RBAC/commercial guards | NOT_PILOT | Not part of DB-N03 pilot RLS; preserve existing gates. |
| `backend/src/services/knowledge-base/*` | KB global/regulatory/tenant docs | `GLOBAL_SAFE` | explicit scope and tenant args | mixed | existing service guards | NOT_PILOT | Separate model; no DB-N04 RLS policy change. |
| `backend/src/services/intelligence/*` | derived intelligence | `GLOBAL_SAFE` | service-provided tenant context | mixed | existing service guards | NOT_PILOT | No direct DB-N04 schema change. |
| `backend/src/routes/ai-traces.routes.js` | AI traces | `GLOBAL_SAFE` | route/RBAC scoped | direct | existing route guards | NOT_PILOT | Not widened; no DB-N04 cleanup. |
| `backend/src/services/reportBuilder.service.js` | report definition/content | `GLOBAL_SAFE` | tenant/report args | mixed | existing route/service guards | NOT_PILOT | No new report truth; no cleanup. |
| `database/migrations/20260904_dbn01_control_identity_normalization.sql` | DB-N01 migration | `MIGRATION_ONLY` | operator/migration | migration transaction | migration runner | NOT_RUNTIME | Not applied by DB-N04. |
| `database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql` | DB-N02 migration | `MIGRATION_ONLY` | operator/migration | migration transaction | migration runner | NOT_RUNTIME | Not applied by DB-N04. |
| `database/migrations/20260907_dbn03_multitenant_integrity_rls.sql` | DB-N03 migration | `MIGRATION_ONLY` | operator/migration | migration transaction | migration runner | NOT_RUNTIME | Not applied by DB-N04. |
| `database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql` | DB-N04 migration | `MIGRATION_ONLY` | operator/migration | migration transaction | advisory lock | READY_NON_DESTRUCTIVE | Not applied by Codex; no `ENABLE RLS`, no `DROP`. |
| `scripts/normalization/db-n04-readonly-preflight.sql` | read-only preflight | `MIGRATION_ONLY` | authorized read-only operator | `BEGIN READ ONLY` intended by operator | psql | READ_ONLY | Codex did not run against `db-v4`. |
| `ai-engine/app/services/ai_core_db.py` | AI core PostgreSQL reads | `LEGACY` | Python service/env; query parameters | psycopg2 connection | none in DB-N04 | NO | `AI_READER_RLS_DEFERRED`; no tenant GUC wiring proven. |
| `backend/src/routes/_legacy/2evidences.routes.js` | legacy evidence route | `LEGACY` | request tenant/auth | route DB calls | existing tenant filters | PARTIAL | Legacy compatibility route; keep out of safe drop set. |
| `public.controls` consumers across backend/frontend/ai-engine | legacy control identity reads | `LEGACY` | mixed tenant/catalog context | mixed | DB-N01 resolver where touched | NO DROP | 81 files reference controls/catalog identity; `controls` remains compatibility-required. |

## Decisions

- Runtime tenant context is transaction-local through `set_config(..., true)` after `BEGIN`.
- Direct `pool.query` inside tenant/platform AsyncLocalStorage context is wrapped in a short transaction, so `app.tenant_id` and `app.platform_scope` do not persist on pooled connections.
- Manual `pool.connect` clients are patched to set transaction-local context immediately after `BEGIN` when called under a tenant/platform context.
- Platform scope is explicit and role-gated in server code; normal tenant runtime cannot pass `platformScope: true` through `assertTenantContext`.
- `ai_reader` is not expanded. RLS for AI remains deferred until AI Engine either sets tenant context in psycopg2 transactions or consumes proven tenant-safe/security-invoker views.
