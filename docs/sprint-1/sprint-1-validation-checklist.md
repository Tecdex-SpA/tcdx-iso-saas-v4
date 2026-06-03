# Sprint 1 Validation Checklist

Date: 2026-06-03

## Automated Checks

- Backend syntax/test: `cd backend && npm test`
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Git review: `git diff --stat && git diff`

## Manual Navigation by Role

Validate with real or seeded users:

- Executive Client sees Dashboard, Compliance and Audit shell, Risks, Action Plans, Reports.
- Executive Client does not see Evidences, AI Compliance or Configuration.
- Executive Client redirected away from legacy operational Compliance/Audit routes.
- Compliance Admin sees 8-view client MVP navigation according to contracted modules.
- Auditor starts at Compliance and Audit and does not see Dashboard or Configuration.
- Auditor sees AI Compliance when AI entitlement is enabled.
- Area Owner sees Dashboard, Compliance and Audit, Evidences, Risks and Action Plans according to existing scope.
- TCDX Superadmin sees internal platform navigation, not client demo navigation.
- Dealer sees dealer/channel navigation, not client internal operations.

## Cross-Tenant Negative Cases

Use Tenant A token against Tenant B identifiers:

- Tenant A cannot call `/api/tenant-standards/scope/:tenantB`.
- Tenant A cannot call `/api/lifecycle/board/:tenantB`.
- Tenant A cannot POST `/api/lifecycle/request-move` with `tenant_id` of Tenant B.
- Tenant A cannot use `/api/reports` with Tenant B in query/body.
- Tenant A cannot use `/api/ai-compliance/*` with Tenant B in query/body.
- Tenant A cannot use evidence, risks or action-plan endpoints with Tenant B in query/body.

## Action Permission Cases

- Auditor cannot request lifecycle progress.
- Compliance Admin can request lifecycle progress.
- Auditor can confirm, reject or return lifecycle requests with observations.
- Executive/read-only cannot mutate data.
- AI knowledge, traces, external lookup and benchmark endpoints are not available to tenant client roles.

## AI Governance

- IA Compliance copy says the AI does not certify compliance or replace human review.
- AI suggestions require human review before evidence approval, lifecycle movement or executive reporting.
- Source/context/confidence are shown when the endpoint provides them.
