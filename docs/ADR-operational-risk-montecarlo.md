# ADR: Operational Risk Monte Carlo Simulation

## Status

Accepted for v4 MVP.

## Decision

Add an isolated operational-risk simulation subflow inside the existing risk matrix experience. The feature uses Monte Carlo simulation with Beta-PERT inputs to estimate annual operational exposure for ISO 27001 and ISO 9001 risks.

The implementation is additive:

- new backend service: `backend/src/services/operationalRiskMonteCarlo.service.js`
- new backend route: `backend/src/routes/operational-risks.routes.js`
- new database tables: `operational_risk_simulations` and `operational_risk_recommendations`
- new UI section inside `frontend/src/app/matriz-riesgo/page.tsx`

No existing risk matrix model is replaced.

## Why Beta-PERT

Operational users can usually estimate three values more reliably than a full probability distribution:

- minimum
- most likely value
- maximum

Beta-PERT converts those three estimates into a bounded distribution. The MVP uses lambda `4`, which keeps the simulation centered around the most likely value while still preserving plausible tails.

## Metric Scope

This version measures operational hours only:

- annual downtime hours
- annual rework hours
- loss of operational capacity
- service continuity exposure
- process efficiency degradation

It intentionally does not estimate money, ROI, penalties, fines, ALE, CRO, or other financial metrics.

## Supported Models

### ISO27001_TTIA

`TTIA = Frecuencia * Tiempo_Recuperacion`

Frequency and recovery time are simulated with Beta-PERT. Output is annual downtime hours.

### ISO9001_COP_SIMPLE

`COP = Frecuencia * Impacto_Operativo`

Frequency and rework hours per event are simulated with Beta-PERT. Output is annual lost human-hours.

### ISO9001_COP_AVANZADO

`COP = (Volumen_Operativo_Anual * Tasa_Error) * Tiempo_Subsanacion`

Error rate and remediation time are simulated with Beta-PERT. Annual operating volume is constant. Output is annual rework hours.

## Database

Migration: `database/migrations/20260616_operational_risk_montecarlo.sql`

Tables:

- `operational_risk_simulations`
- `operational_risk_recommendations`

The migration is non-destructive and does not modify existing ISO risk matrix tables. Simulations persist aggregate metrics and histogram bins, not raw 10,000+ sample arrays.

## Endpoints

- `POST /api/operational-risks/simulations`
- `GET /api/operational-risks/simulations`
- `GET /api/operational-risks/simulations/:id`
- `POST /api/operational-risks/simulations/:id/recommendations`

Recommendations are rule-based in this MVP. The AI Engine is not invoked until a strict internal JSON contract is implemented and validated.

## RBAC And Multi-Tenant

The route is registered under `/api/operational-risks` and protected by the central API RBAC middleware.

Read access follows the existing tenant read roles. Create access follows the existing risk-area write roles. Viewer/read-only roles can read but cannot create. Dealer access remains hidden through the existing RBAC pattern.

Tenant users cannot supply an arbitrary `tenant_id` in the body. The backend resolves tenant scope from `req.user` for tenant users. Platform roles may pass an explicit `tenant_id`, matching the existing multi-tenant administrative pattern.

Every persistence query filters by `tenant_id`.

## Limitations

- No production migration is executed by this change.
- The UI uses compact summary cards and a list, not advanced charting.
- Recommendations are operational and rule-based.
- No raw simulation samples are retained.
- Results require human validation before use in audit or operational decisions.

## Post-MVP

- Structured AI Engine recommendation contract with strict JSON parsing.
- Advanced histograms and sensitivity charts.
- Before/after control comparison.
- Linkage to accepted `iso_risk_matrix_items` treatment workflows.
- Enterprise financial ALE/CRO model as a separate governed capability.
