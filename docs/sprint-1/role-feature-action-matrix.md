# Sprint 1 Role, Feature and Action Matrix

Date: 2026-06-03

## Role Groups

| Group | Current role aliases |
|---|---|
| Platform | `superadmin`, `super_admin`, `platform_admin`, `admin_global`, `global_admin`, `owner` |
| Partner/Dealer | `dealer` |
| Compliance Admin | `admin`, `tenant_admin` |
| Auditor | `auditor` |
| Area Owner | `operativo`, `responsable_area`, `area_owner` |
| Executive Client | `viewer`, `cliente`, `client`, `read_only`, `readonly`, `solo_lectura`, `ejecutivo` |

## MVP View Access

| View | Executive | Compliance Admin | Auditor | Area Owner | Platform | Dealer |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard | Yes | Yes | No | Yes | Internal only | No |
| Compliance and Audit | Summary shell | Yes | Yes | Assigned/read scope where supported | Internal only | No |
| Evidences | No | Yes | Yes | Assigned scope where supported | Internal only | No |
| Risks | Yes | Yes | Yes | Assigned scope where supported | Internal only | No |
| Action Plans | Yes | Yes | Yes | Assigned scope where supported | Internal only | No |
| Reports | Yes | Yes | Yes | No | Internal only | No |
| AI Compliance | No | Yes | Yes | No | Internal only | No |
| Configuration | No | Yes | No | No | Internal console | Channel console |

## Feature and Action Keys

| Feature/action | Allowed role groups |
|---|---|
| `dashboard.read` | Compliance Admin, Area Owner, Executive |
| `compliance.read` | Compliance Admin, Auditor, Area Owner, Executive shell |
| `compliance.write` | Compliance Admin |
| `compliance.lifecycle.read` | Compliance Admin, Auditor, Area Owner, Executive shell |
| `compliance.lifecycle.request_progress` | Compliance Admin |
| `compliance.lifecycle.approve` | Auditor |
| `evidences.read` | Compliance Admin, Auditor, Area Owner |
| `evidences.upload` | Compliance Admin, Area Owner |
| `risks.read` | Executive, Compliance Admin, Auditor, Area Owner |
| `risks.write` | Compliance Admin, Area Owner |
| `action_plans.read` | Executive, Compliance Admin, Auditor, Area Owner |
| `action_plans.write` | Compliance Admin, Area Owner |
| `reports.read` | Executive, Compliance Admin, Auditor |
| `reports.export` | Executive, Compliance Admin, Auditor |
| `ai_compliance.read` | Compliance Admin, Auditor |
| `ai_compliance.suggest` | Compliance Admin, Auditor |
| `configuration.users.manage` | Compliance Admin |
| `configuration.company_profile.manage` | Compliance Admin |
| `admin_saas.internal` | Platform |
| `dealer.console` | Dealer |

## Deferred Gaps

- Area Owner assigned-scope filtering depends on existing endpoint support. Sprint 1 preserves current backend filters and documents assigned-scope as a mandatory follow-up where not implemented.
- Dealer assigned-tenant validation is route-specific today; global middleware does not infer dealer tenant assignments from JWT.
- No DB-backed permission table was introduced in Sprint 1.
