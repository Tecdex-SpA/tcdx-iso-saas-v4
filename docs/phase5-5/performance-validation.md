# Performance Validation - Phase 5.5

Status: completed for package scope.

## Guardrails

- BI and reports consume stored official results and snapshots.
- Missing calculation runs return `source_unavailable` instead of recalculating in the request path.
- Frontend builder surfaces are declarative and do not run statistical or Monte Carlo work.
- PostgreSQL integration validates indexed persistence tables and calculation snapshots.
- Browser E2E uses one PostgreSQL container, one backend process and one frontend process per run. `full-e2e` and `cross-view-consistency` reuse the evidence from the browser run through explicit JSON validation to avoid triplicate container/browser execution.

## Command

`npm run phase5-5:performance-check`
