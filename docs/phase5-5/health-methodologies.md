# Phase 5.5 Health Methodologies

Status: package_4_completed

This document records the official health score methodology for Packages 3 and 4.

## Package 3 Health Definitions

- GRC Health.
- ISO Health.
- Risk Health.
- Control Health.
- Evidence Health.
- Action Health.
- Data Health.
- Operational Excellence Health.

Each health output includes formula code, formula version, weights, components, coverage, trust score, warnings, explanation, lineage, and snapshot metadata.

## Package 4 Health Definitions

- Survey Health.
- Assurance Health.
- Loss Health.
- Continuity Health.
- Asset Health.
- Supplier Health.

These definitions are only declared where a real operational consumer exists or is directly prepared by Package 4 services. Unknown components remain explicit instead of being filled with zero.

## Rules

- No health score is calculated in the frontend.
- No hidden weights are allowed.
- No missing component is silently treated as positive.
- Data Trust is reported alongside the health score.
