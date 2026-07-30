# Package 6 - Operability and UX

Status: completed with real browser E2E.

## Implemented UX surfaces

- Sidebar groups client navigation into General, Integrated GRC, Analytics and Reports, Evaluation and Assurance, and System.
- Portal GRC displays official calculation cards with value, unit, status, formula, version, coverage, trust, warnings, explanation, lineage and calculation run.
- `Phase5Workspace` displays official analytics metadata for shared operational tables.
- BI, Report Studio, report generations, metrics, surveys, assurance tests and loss events expose operational builders backed by real Phase 5 APIs.
- Constructor components were added for formula catalog, formula editor, source binding, variables, thresholds, preview, run history, explanation, statistical methods, sample size, risk methodology, control effectiveness, survey scoring, assurance scoring, loss analytics, operational excellence, health breakdown, metric builder, dashboard builder and report studio.

## UX rules

- No frontend formula execution.
- No parallel calculations in BI or reports.
- Empty states direct users to publish formulas, source contracts and calculation snapshots.
- Formula version, coverage, trust, warnings, explanation and lineage are visible in the operational shell.
- Form validation, preview, draft persistence, publication/approval, execution, history, explanation and lineage are exercised through backend APIs.
- `npm run phase5-5:browser-e2e` passed 9/9 scenarios with Chromium, local Next.js, local Express and PostgreSQL Docker fixture.
- `phase5-5:full-e2e` and `phase5-5:cross-view-consistency` validate the current Playwright evidence instead of repeating the same Docker/browser suite.
