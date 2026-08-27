# RBAC-01 Role Migration Matrix

Status: `COMPLETE_LOCAL`
Migration: `database/migrations/20260827_rbac01_canonical_roles_brand01.sql`
Production execution: `NOT_DONE`

## Migration Strategy

The migration is additive and idempotent:

- inserts missing canonical `app_roles` with `ON CONFLICT DO NOTHING`;
- inserts `operativo` as deprecated legacy compatibility because real users already carry that role value;
- ensures `auditor -> dashboards.read`;
- grants `area_owner` and `executive` explicitly bounded permissions copied from audited legacy behavior;
- does not update users, tenants, subscriptions, entitlements, module settings or dealer assignments.

## Matrix

| Source role/value | Target semantic family | Data migration | Permission treatment |
|---|---|---|---|
| `platform_admin` | `platform_admin` | none | existing permissions preserved |
| `tenant_admin` | `tenant_admin` | none | existing permissions preserved |
| `auditor` | `auditor` | none | `dashboards.read` ensured |
| `area_owner` | `area_owner` | create role if missing | bounded operational permissions only |
| `executive` | `executive` | create role if missing | read-only permissions only |
| `dealer` | `dealer` | none | dealer assignment tables remain authority |
| `admin` | `tenant_admin` | none | raw role and audited permission differences preserved |
| `superadmin` | `platform_admin` | none | raw role and `settings.manage` difference preserved |
| `operativo` | `area_owner` | create deprecated role if missing; users unchanged | compatibility permissions for operational work |
| `viewer` | `executive` | none | raw role preserved |
| `control_owner` | `area_owner` | none | raw role preserved |
| `compliance_manager` | `tenant_admin` | none | raw role preserved |

## Post-Deploy Gate

The user must review, apply and validate the migration manually. Codex did not execute it against production.

