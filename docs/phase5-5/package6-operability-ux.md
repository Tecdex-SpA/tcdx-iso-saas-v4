# Package 6 - Operability and UX

Status: completed.

## Implemented UX surfaces

- Sidebar groups client navigation into General, Integrated GRC, Analytics and Reports, Evaluation and Assurance, and System.
- Portal GRC displays official calculation cards with value, unit, status, formula, version, coverage, trust, warnings, explanation, lineage and calculation run.
- `Phase5Workspace` displays official analytics metadata for shared operational tables.
- BI, Report Studio, report generations, metrics, surveys, assurance tests and loss events expose official result panels or guided builder surfaces.
- Constructor components were added for formula catalog, formula editor, source binding, variables, thresholds, preview, run history, explanation, statistical methods, sample size, risk methodology, control effectiveness, survey scoring, assurance scoring, loss analytics, operational excellence, health breakdown, metric builder, dashboard builder and report studio.

## UX rules

- No frontend formula execution.
- No parallel calculations in BI or reports.
- Empty states direct users to publish formulas, source contracts and calculation snapshots.
- Formula version, coverage, trust, warnings, explanation and lineage are visible in the operational shell.
- Full visual builder persistence remains governed by existing backend APIs and does not bypass RBAC or tenant gates.
