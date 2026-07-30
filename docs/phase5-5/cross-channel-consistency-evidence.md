# Cross-channel Consistency Evidence

Status: completed with browser evidence.

## Contract

The same official analytical result contract is used by Portal GRC, BI widgets, Report Studio, report generations and shared Phase 5 workspaces.

## Verified fields

- result_code
- formula code and version
- unit
- period
- comparison and trend
- coverage
- trust
- source status
- warnings
- calculation_run_id
- snapshot_id
- explanation_url
- lineage_url

## Command

1. `npm run phase5-5:browser-e2e` executes Chromium against local frontend/backend/PostgreSQL and validates the cross-channel scenario.
2. `npm run phase5-5:cross-view-consistency` verifies that the specific Playwright scenario passed in the current evidence file produced by the browser run.
