# Future Sprint 5 KPI and Health Notes

Date: 2026-06-04

## Important boundary

Sprint 3 does not implement KPIs, Health by process, dashboard semaphores, KPI formulas, or KPI administration.

Sprint 3 only creates the relationship foundation that Sprint 5 can consume.

## Future Sprint 5 consumption

Sprint 5 may use `tenant_process_entity_links` to compute or display:

- controls by process;
- evidence status by process;
- risk exposure by process;
- open actions by process;
- process-level health summaries;
- process-level KPI context.

## Required future safeguards

- Define KPI formulas separately.
- Confirm process-level aggregation semantics with product.
- Avoid double counting controls linked to both process and operation.
- Keep tenant filtering mandatory.
- Keep source trace for all process-level health/KPI conclusions.

## Not implemented now

- No KPI tables.
- No health views.
- No dashboard cards.
- No semaphores.
- No reports by process.
- No AI operational scoring.
