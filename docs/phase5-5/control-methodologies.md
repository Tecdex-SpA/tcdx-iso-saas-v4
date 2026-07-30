# Phase 5.5 Control Methodologies

Status: package_3_completed

This document records the official control methodology used by Package 3 and reused by Package 4 domains.

## Official Scope

- Individual effectiveness uses `Ec = wd*D + wi*I + wo*O + we*E`.
- Combined effectiveness uses `Ecombined = 1 - product(1 - Ej)`.
- Dependency-adjusted effectiveness uses `Eadjusted = Ecombined * Dfactor`.
- Coverage, frequency compliance, failure rate, and expired evidence indicators are calculated as separate official outputs.

## Rules

- Weights are visible and versioned.
- Effectiveness cannot exceed 100%.
- `inconclusive` is not treated as positive evidence.
- `not_applicable` is excluded from denominators.
- Evidence quality is adapted from the existing evidence score instead of creating a conflicting score.

## Package 4 Integration

Assurance, supplier, asset, loss, and continuity calculations consume control outputs through the official math-governance services and source contracts.
