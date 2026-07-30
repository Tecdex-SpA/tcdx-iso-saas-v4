# Phase 5.5 Risk Methodologies

Status: package_3_completed

This document records the official risk methodology implemented before Package 4 and kept as the operational contract for later BI, reporting, and UX work.

## Official Scope

- Inherent risk uses `Ri = P * I` with the configured matrix or quantitative method.
- Residual risk uses `Rr = Ri * (1 - Ec)` where `Ec` is the official control effectiveness output.
- Expected loss uses `EL = frequency * severity` only when quantified loss inputs are available.
- Matrix methods support 3x3, 4x4, and 5x5 scales with explicit normalization before comparison.
- Monte Carlo methods reuse the official seeded simulation engine and never mix unnormalized matrix scores with monetary values.

## Controls

- Thresholds are versioned.
- Method used is recorded in the calculation output.
- Missing source data returns `unmeasured` or `source_unavailable`, never fabricated zero.
- Tenant-specific thresholds may override catalog defaults when a valid policy exists.

## Package 4 Integration

Package 4 supplier, asset, assurance, loss, and continuity services feed risk calculations through official calculation outputs and lineage. They do not introduce a second risk formula.
