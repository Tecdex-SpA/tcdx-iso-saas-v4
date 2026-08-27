# RBAC-01 Canonical Roles

Status: `COMPLETE_LOCAL`

Canonical roles for new customers:

| Role | Functional meaning | Boundary |
|---|---|---|
| `platform_admin` | SaaS platform administration: tenants, commercial catalog, plans and entitlements. | Does not automatically become tenant admin for every tenant. |
| `tenant_admin` | Full administration inside its own tenant and only for contracted/active capabilities. | No platform/dealer authority. |
| `auditor` | Dashboard/read access plus audit, findings and review operations according to existing contracts. | No tenant/user/global administration. |
| `area_owner` | Operates risks, controls, evidences and actions within assigned scope. | No tenant administration. |
| `executive` | Broad read-only visibility over contracted GRC scope. | No administrative mutations. |
| `dealer` | Channel/MSP role limited to assigned tenants. | Not equivalent to platform admin. |

Repository audit notes:

- Backend currently authorizes by direct legacy role lists in `backend/src/middleware/rbac.middleware.js`.
- Frontend groups roles in `frontend/src/utils/mvpPermissions.ts` as `platform`, `dealer`, `admin`, `auditor`, `area_owner`, `executive`.
- Multiple backend files repeat role normalization instead of using one canonical resolver.
- DB audit CSVs were consumed from `artifacts/rbac01-db-audit/`.
- Implemented backend resolver: `backend/src/services/auth/roleCompatibility.service.js`.
- Implemented frontend mirror: `frontend/src/utils/mvpPermissions.ts`.
- Legacy effective role is preserved; canonical family is not a privilege alias.
