# PR Checklist: Operational Risk Monte Carlo

## Functional Summary

This PR adds an isolated "Simulacion Operativa" subflow inside the existing `/matriz-riesgo` page for operational risk quantification in hours.

Implemented scope:

- Monte Carlo simulation with Beta-PERT and lambda `4`.
- Minimum `10000` iterations and maximum `100000`.
- ISO 27001 model: `ISO27001_TTIA`.
- ISO 9001 models: `ISO9001_COP_SIMPLE` and `ISO9001_COP_AVANZADO`.
- Aggregated persistence only: mean, median, P90/P95/P99, standard deviation, min/max, critical-threshold probability, and histogram bins.
- Rule-based operational recommendations that require human validation.
- No financial metrics, no ROI, no fines, no monetary loss model.

## Modified Files

- `.gitignore`
- `backend/package.json`
- `backend/src/app.js`
- `backend/src/middleware/rbac.middleware.js`
- `backend/src/routes/operational-risks.routes.js`
- `backend/src/services/operationalRiskMonteCarlo.service.js`
- `backend/src/services/operationalRiskMonteCarlo.service.test.js`
- `database/migrations/20260616_operational_risk_montecarlo.sql`
- `frontend/src/app/matriz-riesgo/page.tsx`
- `docs/ADR-operational-risk-montecarlo.md`
- `docs/PR-operational-risk-montecarlo-checklist.md`
- `docs/LOCAL-VALIDATION-operational-risk-montecarlo.md`
- `.github/workflows/ci.yml`

## Validations Executed

- `git status --short --branch`: current branch `main...origin/main`, local changes present.
- `git diff --stat`: reviewed changed tracked files.
- `git diff --name-only`: reviewed tracked modified files.
- `git diff --check`: PASS.
- `cd backend && npm test`: PASS.
- `cd backend && npm run check`: PASS.
- `cd frontend && npm ci`: PASS; created ignored `node_modules`.
- `cd frontend && npm run lint`: PASS with existing warning baseline; `0 errors`, `629 warnings`.
- `cd frontend && npm run build`: PASS; Next build generated `42/42` pages.
- Static SQL migration sanity check: PASS.

No services were restarted. No migrations were applied to dev, QA, or production. No deployment was performed.

## Risks

- Multi-tenant: endpoint queries are tenant-filtered, but cross-tenant runtime validation still needs real local users/tokens.
- RBAC: central middleware blocks `viewer/read_only` writes; manual role validation is still required with real sessions.
- Migration: non-destructive SQL is present but not applied in shared environments.
- UI: build passes, but browser validation needs a local backend, local DB, and authenticated user.
- AI: AI Engine is intentionally not called; recommendations are rule-based support text.

## Local Manual Tests

- Tenant admin creates ISO27001 simulation from `/matriz-riesgo`.
- Tenant admin creates ISO9001 simple simulation.
- Tenant admin creates ISO9001 advanced simulation.
- Tenant admin generates a rule-based recommendation.
- Auditor or read role lists and views simulations.
- Viewer/read-only can view results but cannot create a simulation.
- UI copy confirms calculations estimate operational hours, not financial impact.

## Pending Cross-Tenant Tests

- Tenant A cannot list Tenant B simulations.
- Tenant A cannot fetch Tenant B simulation by id.
- Tenant A cannot create a recommendation for Tenant B simulation.
- Platform/superadmin can query an explicit `tenant_id` only in local validation with approved test data.

## Decision

Do not deploy yet.

This branch is prepared for local validation and CI only. Wait for explicit approval and environment readiness before applying migrations or deploying to dev, QA, or production.
