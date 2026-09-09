# DB-N05 Effective Production Role Privileges

Local result: `PRODUCTION_ROLE_PRIVILEGES EFFECTIVE PASS` on disposable PostgreSQL 16.15 with pgvector. No credentials or grants applied outside the isolated cluster.

| Role / gate | Effective operation | Result |
| --- | --- | --- |
| Migration admin | SET ROLE, baseline + system seed, baseline rerun | PASS |
| R00 | Explicit table grants and explicit app-function grants; no ON ALL TABLES or ON ALL FUNCTIONS | PASS static; effective allowlist below |
| Backend R01 | INSERT/SELECT/UPDATE/DELETE tenant probe, rolled back | PASS |
| Backend R02 | INSERT/UPDATE/DELETE schema_migrations, app_roles, permissions, role_permissions | Permission denied, PASS |
| Support R03/R04 | SELECT tenants; INSERT/UPDATE/DELETE denied | PASS |
| ai_reader R05 | SELECT tenants/chunks/ai_core view denied; pg_class ACL scan finds zero SELECT relations in public/ai_core | SAFE_DEFER PASS |
| Function execute allowlist | Backend can execute only security + DB-N02 Health helpers; platform only security helpers; support/ai_reader none | PASS |
| Platform R06 | app_roles catalog UPDATE permitted; tenant INSERT/UPDATE/DELETE denied; Health helper execution absent | PASS |
| Runtime R07 | pg_roles super/BYPASSRLS/CREATEROLE/CREATEDB absent | PASS |
| Runtime R08 | CREATE TABLE denied for backend/platform/support/ai_reader | PASS |

The test now really creates PostgreSQL and SET ROLE, rather than relying only on SQL regexes. It checks permission-denied errors rather than accepting constraint or missing-column failures. Each DML probe rolls back.

Canonical names: app_roles (governance/GRC readers) and plan_version_capabilities (commercial schema/seed). Explicit tcdx_async_jobs and calculation_outputs grants follow asyncJob.service.js and official calculation persistence/read consumers. Broad `EXECUTE ON ALL FUNCTIONS` grants were removed and replaced by explicit function allowlists plus default privilege revokes for future functions. Backend startup in the fresh harness connects through a NO-SUPERUSER login member of tcdx_backend_runtime.

Migration provisioning design: a privileged infrastructure owner preinstalls pgcrypto/pg_trgm/vector and creates NOLOGIN role identities, then grants CREATE on the empty database/public schema to tcdx_migration_admin. The baseline is created/owned under SET ROLE tcdx_migration_admin, and its rerun succeeds. This one-time provisioning is not a runtime role privilege.

Broad RLS remains deferred. These tests establish the requested allow/deny matrix, not exhaustive coverage of every backend route or a tenant-safe support application. Runtime functions currently use invoker rights and no future app-owned function should become executable by runtime roles without an explicit grant/test update. No direct AI SELECT is granted.

## Versioned reference ACL — 2026-09-08

Effective PASS for all four ISO reference tables: backend/platform/support SELECT succeeds; INSERT/UPDATE/DELETE denied; ai_reader SELECT denied. Migration admin bootstrap/rerun PASS. No runtime reference DML grants.
