# RBAC-01 Canonical Role Model

Status: `COMPLETE_LOCAL`

## Canonical Roles for New Customers

| Canonical role | Meaning | Boundary |
|---|---|---|
| `platform_admin` | SaaS platform administration. | Does not inherit legacy `superadmin` extras unless those permissions are explicitly granted. |
| `tenant_admin` | Full tenant administration. | Limited to the authenticated/selected tenant and commercially entitled active capabilities. |
| `auditor` | Dashboard read, audit, evidence review, findings/nonconformities and report operations according to effective permissions. | No tenant/user/platform administration. |
| `area_owner` | Operates risks, controls, evidences and action plans in its responsibility scope. | No tenant administration; resource ownership remains enforced by domain services. |
| `executive` | Broad read-only executive visibility over contracted and active GRC capabilities. | No mutation by default. |
| `dealer` | Dealer/MSP access to assigned tenants and authorized capabilities. | No unrestricted cross-tenant access. |

## Compatibility Classifications

Implemented categories:

- `CANONICAL_ROLE`
- `EXACT_ALIAS`
- `COMPATIBILITY_MAPPING`
- `DEPRECATED_LEGACY_ROLE`
- `UNKNOWN_REQUIRES_DECISION`

Implementation:

- Backend: `backend/src/services/auth/roleCompatibility.service.js`
- Frontend mirror: `frontend/src/utils/mvpPermissions.ts`

## Privilege Preservation Rule

The resolver returns both `canonical_role` and `effective_role`. Authorization tests use effective permissions; the canonical family is for route grouping and product semantics only.

Examples:

| Raw role | Canonical family | Effective role preserved | Classification |
|---|---|---|---|
| `admin` | `tenant_admin` | `admin` | `DEPRECATED_LEGACY_ROLE` |
| `superadmin` | `platform_admin` | `superadmin` | `DEPRECATED_LEGACY_ROLE` |
| `operativo` | `area_owner` | `operativo` | `DEPRECATED_LEGACY_ROLE` |
| `viewer` | `executive` | `viewer` | `DEPRECATED_LEGACY_ROLE` |
| `control_owner` | `area_owner` | `control_owner` | `DEPRECATED_LEGACY_ROLE` |
| `compliance_manager` | `tenant_admin` | `compliance_manager` | `DEPRECATED_LEGACY_ROLE` |

Unknown roles fail closed as `UNKNOWN_REQUIRES_DECISION`.

