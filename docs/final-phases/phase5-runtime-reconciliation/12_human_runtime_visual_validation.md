# Phase 5 human runtime visual validation - LOSSES source binding fix

Date: 2026-08-10
Environment: https://tcdx-iso.tecdex.net
Scope executed: Tenant 1 visual flow and focused LOSSES chain diagnosis.
Production database manual changes: none.
Deploy from Codex: none.

## Tenant 1

Tenant: tcdx.local / Empresa Demo TCDX Compliance
User role used: tenant administrator
Permitted data creation: yes, through UI only.

## Screenshots

Evidence is stored under:

`artifacts/phase5-human-runtime/tenant-1/`

Relevant captures:

- `03_dashboard_baseline.png`
- `04_metricas_baseline.png`
- `05_bi_baseline.png`
- `10_losses_before_input.png`
- `11_losses_form_100000_25000.png`
- `12_losses_after_ejecutar.png`
- `18_metricas_losses_after_ui.png`
- `21_losses_before_calcular_fuentes.png`
- `22_losses_after_calcular_fuentes.png`
- `23_losses_detalle_tecnico.png`

Network and API evidence:

- `losses_network_events.json`
- `losses_api_diagnostics_authorized.json`

The credential-filled login capture was intentionally not copied.

## Baseline visual result

Dashboard baseline showed legacy operational summary values, including:

- Cumplimiento global: 57%.
- Controles saludables: 285 / 500.
- Riesgos criticos: 2.
- Planes de accion: 0.

The official metrics/BI surfaces showed no official measurements:

- `/metricas`: official cards in `Sin medicion`.
- `/bi`: 18 indicators in `Sin medicion`, 0 measured.
- Dashboard decision center: 9 `Sin medicion`, 0 measured.

Result: cross-view divergence confirmed before the LOSSES input test.

## LOSSES input test

Input entered through `/eventos-perdida`:

- Code: `F5RT-20260810-LOSS-UI-01`
- Name: `Perdida operacional por indisponibilidad F5RT`
- Official result: `loss.net`
- Source contract: `official_source_contract`
- Unit: `CLP`
- Dimension: `general`
- Gross loss: `100000`
- Recoveries: `25000`
- Expected net loss: `75000`

Actions executed visually:

- Validar.
- Preview oficial.
- Guardar draft.
- Publicar / aprobar.
- Ejecutar.
- Actualizar historial.

The UI persisted and confirmed the loss event through `/api/loss-events`.

## Runtime evidence

Authenticated API diagnostics confirmed that `loss_events` contains UI-created events for the tenant:

- `gross_loss = 100000.00`
- `recoveries = 25000.00`
- `net_loss = 75000.00`
- `currency = CLP`
- `status = confirmed`

The analytical result endpoint returned the correct value:

- Endpoint: `/api/grc/official/analytics/loss.net`
- Value: `75000`
- Unit: `currency`
- Formula: `F5_5_NET_LOSS`
- Source status: `available`
- Trust status: `trusted`
- Calculation run: `749c15e3-e3c9-412f-9569-71cbc169584f`

The functional indicator still failed:

- Route: `/metricas/LOSSES`
- Result: `Sin medicion`
- Sufficiency: `source_unavailable`
- Latest snapshot: none
- History: empty

Clicking `Calcular desde fuentes` returned HTTP 200, but the page remained `source_unavailable`.

## Failure

Status: failed before code fix.

Broken chain:

`/eventos-perdida UI -> /api/loss-events -> loss_events -> analytics loss.net OK -> metricas LOSSES source_unavailable`

The value entered by the user was persisted and usable by the analytics service, but was not consumed by the official functional indicator pipeline.

## Root cause

Two inconsistencies were identified.

### 1. Source contract did not match the real table written by UI

The contract `loss_events_operational` declared historical/canonical fields:

- `event_date`
- `gross_loss_amount`
- `recovery_amount`
- `net_loss_amount`

The real UI/backend path writes:

- `occurred_at`
- `gross_loss`
- `recoveries`
- `net_loss`
- `currency`
- `status`

The source resolver `mapFormulaInput(F5_5_NET_LOSS)` only read:

- `gross_loss_amount`
- `recovery_amount`

Therefore the official indicator received missing inputs and remained not measured.

### 2. The builder generated future `occurred_at`

The operational builder used `periodEnd` as `occurred_at` for loss events. During the test, that produced `2026-08-31T23:59:59.999Z`, while the test date was 2026-08-10. The dataset validator rejects future event dates. That could exclude otherwise valid rows from official calculation.

## Fix implemented

Files changed:

- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `frontend/src/components/math-governance/OperationalBuilder.tsx`
- `scripts/phase5/check-phase5-functional-closure.js`

Backend:

- Added a dedicated `loss_events_operational` adapter.
- Normalized real table fields to official formula inputs:
  - `gross_loss` -> `gross_loss_amount`
  - `recoveries` -> `recovery_amount`
  - `net_loss` -> `net_loss_amount`
  - `occurred_at`/`event_date` -> `event_date`
- Preserved raw future occurrence timestamps as `raw_event_date`.
- Used `created_at` as effective calculation timestamp when the UI-generated `occurred_at` is future, with an explicit warning.
- Updated `F5_5_NET_LOSS`, `F5_5_LOSS_SEVERITY`, `F5_5_PARAMETRIC_VAR`, `F5_5_MONTE_CARLO` and expected loss mapping to accept both canonical and real production column names.

Contracts:

- Updated `loss_events_operational` to version 2.
- Declared real columns and variable aliases.
- Documented the future `occurred_at` fallback behavior.

Frontend:

- Updated the loss builder so new events use a non-future effective `occurred_at` instead of blindly using `periodEnd`.

Tests:

- Added regression for UI-shaped `loss_events` rows:
  - `gross_loss = 100000`
  - `recoveries = 25000`
  - `net_loss = 75000`
  - expected `F5_5_NET_LOSS = 75000`
- Added source resolver test for future `raw_event_date` normalized to effective `event_date`.
- Added phase5 functional closure assertion that UI production columns feed `F5_5_NET_LOSS`.

## Validation executed locally

Passed:

- `node backend/src/services/math-governance/sourceResolver.test.js`
- `npm run phase5:functional-closure`
- `npm run phase5-5:source-binding-check`
- `npm --prefix backend test`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `git diff --check`

## Runtime retest status

Not rerun on production after code fix because no deploy was performed from Codex.

Expected post-deploy validation:

1. Open `/eventos-perdida`.
2. Create a new loss event with gross loss and recoveries.
3. Confirm it.
4. Open `/metricas/LOSSES`.
5. Click `Calcular desde fuentes`.
6. Confirm that the official result becomes calculated and equals `gross_loss - recoveries`.
7. Confirm Dashboard, BI, Report and Export consume the same official snapshot.

## Tenant 2 and Credex

Tenant 2 and Credex were not executed in this pass because Tenant 1 exposed a P0 broken chain. The next runtime audit should continue only after this fix is merged and deployed.

## Residual risk

Runtime result remains pending until deployment because the production instance still runs the old source binding code.

No production DB was manually modified.
No merge was performed.
No deploy was performed.
