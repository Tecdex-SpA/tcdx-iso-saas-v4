# Phase 5.5 Legacy Calculation Migration

Status: packages_0_to_4_completed

This document tracks the migration rule for legacy calculations.

## Rule

Same concept means same official calculation output.

Legacy consumers must either:

- call the official math-governance service directly;
- use a compatibility adapter that delegates to the official service;
- remain explicitly pending for a later package when their domain is outside the active package scope.

## Completed Through Package 4

- Compliance, readiness, risk, control, action, health, and operational excellence backend calculations were centralized in Package 3.
- Survey, assurance, loss, continuity, asset, and supplier calculations were centralized in Package 4.
- Package 4 jobs route through official calculation services and persist official outputs.

## Pending Later Packages

- Package 5: completed for backend BI/reporting consumption, analytics catalog, explanation URLs, lineage URLs and calculation consumers.
- Package 6: final UX migration and frontend operational controls.
- Package 7: full-system validation and final closure.

No frontend calculation is authorized as the final source of truth.
