# RBAC-01 Legacy Compatibility Map

Status: `COMPLETE_LOCAL`

Real DB evidence is in `artifacts/rbac01-db-audit/`. Compatibility maps semantic family only; effective privileges remain tied to the raw/effective role and permission set.

| Role value | Canonical family | Effective role preserved | Classification |
|---|---|---|---|
| `platform_admin` | `platform_admin` | `platform_admin` | `CANONICAL_ROLE` |
| `tenant_admin` | `tenant_admin` | `tenant_admin` | `CANONICAL_ROLE` |
| `auditor` | `auditor` | `auditor` | `CANONICAL_ROLE` |
| `area_owner` | `area_owner` | `area_owner` | `CANONICAL_ROLE` |
| `executive` | `executive` | `executive` | `CANONICAL_ROLE` |
| `dealer` | `dealer` | `dealer` | `CANONICAL_ROLE` |
| `super_admin` | `platform_admin` | `super_admin` | `EXACT_ALIAS` |
| `admin_global` | `platform_admin` | `admin_global` | `EXACT_ALIAS` |
| `global_admin` | `platform_admin` | `global_admin` | `EXACT_ALIAS` |
| `superadmin` | `platform_admin` | `superadmin` | `DEPRECATED_LEGACY_ROLE` |
| `owner` | `platform_admin` | `owner` | `DEPRECATED_LEGACY_ROLE` |
| `admin` | `tenant_admin` | `admin` | `DEPRECATED_LEGACY_ROLE` |
| `admin_cumplimiento` | `tenant_admin` | `admin_cumplimiento` | `COMPATIBILITY_MAPPING` |
| `compliance_admin` | `tenant_admin` | `compliance_admin` | `COMPATIBILITY_MAPPING` |
| `compliance_manager` | `tenant_admin` | `compliance_manager` | `DEPRECATED_LEGACY_ROLE` |
| `operativo` | `area_owner` | `operativo` | `DEPRECATED_LEGACY_ROLE` |
| `responsable_area` | `area_owner` | `responsable_area` | `COMPATIBILITY_MAPPING` |
| `control_owner` | `area_owner` | `control_owner` | `DEPRECATED_LEGACY_ROLE` |
| `viewer` | `executive` | `viewer` | `DEPRECATED_LEGACY_ROLE` |
| `cliente` | `executive` | `cliente` | `COMPATIBILITY_MAPPING` |
| `client` | `executive` | `client` | `COMPATIBILITY_MAPPING` |
| `read_only` | `executive` | `read_only` | `COMPATIBILITY_MAPPING` |
| `readonly` | `executive` | `readonly` | `COMPATIBILITY_MAPPING` |
| `solo_lectura` | `executive` | `solo_lectura` | `COMPATIBILITY_MAPPING` |
| `ejecutivo` | `executive` | `ejecutivo` | `COMPATIBILITY_MAPPING` |

## Guardrails

- `admin` is not an alias for `tenant_admin`; DB audit showed different effective permissions.
- `superadmin` is not an alias for `platform_admin`; DB audit showed an additional `settings.manage` permission.
- `operativo` remains a deprecated compatibility role because real users already carry it.
- Unknown roles remain `UNKNOWN_REQUIRES_DECISION` and fail closed.
