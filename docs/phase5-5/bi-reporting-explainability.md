# Phase 5.5 BI, Reporting and Explainability

Status: package_5_completed

Package 5 centralizes BI and reporting consumption on official calculation outputs. BI widgets, dashboards, report generations and export artifacts must consume `calculation_runs`, `calculation_outputs`, `calculation_snapshots`, `calculation_consumers`, explanations and lineage. They must not execute independent formulas.

## Analytical Catalog

`backend/src/services/math-governance/analyticsCatalog.service.js` declares official analytical results for compliance, readiness, risk, controls, actions, health, surveys, assurance, losses, continuity, assets, suppliers, data quality and Operational Excellence.

Each analytical result includes result code, domain, entity type, formula code, formula version, unit, aggregation, dimensions, supported periods, filters, tenant scope, source code, source status and publication status.

## BI Consumption Contract

The official BI response contains value, unit, period, comparison, trend, formula, coverage, trust, source status, warnings, calculation run, snapshot, explanation URL and lineage URL.

If no official `calculation_run` exists, the response is `source_unavailable`. No fallback calculation is performed inside BI or reporting.

## Dashboards

Dashboard rendering resolves each widget through the analytical catalog. Widgets can reference an official result code in `data_source_ref` or `config.result_code`. Rendering registers a `calculation_consumers` row with `consumer_type='dashboard'`.

## Report Studio

Report generation collects official result codes from request body or report sections, snapshots the official result payload and writes PDF/DOCX/XLSX artifacts containing formula, version, run, trust and source status. Report generation registers `consumer_type='report'`.

## Explainability and Lineage

Every official result links to `/api/grc/official/calculations/:runId/explanation` and `/api/grc/official/calculations/:runId/lineage` when a persisted run exists. Missing runs remain explicit and auditable.

## Pending Later Packages

Package 6 owns final UX builders and advanced user operations. Package 7 owns integral runtime closure.
