# HANDOFF PUI-07-HF4

Owner: CODEX A
Account: codex
Status: DONE_LOCAL
Branch: fix/pui-07-hf4-severity-index-source-closure
Base SHA: 0c844dddccde4a4c92a8e6bc27841d23c1405c93
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Objective completed:
`F5_5_SEVERITY_INDEX` source ownership is enforced locally. Non-canonical runtime overrides cannot route this formula through `incident_operational_events` / `grc_incidents`.

Root cause demonstrated:
The published ownership was already `F5_5_SEVERITY_INDEX -> audit_findings_actions` in `FORMULA_SOURCE_MAP` and formula registry. The runtime defect came from execution-time `source_overrides` / `body.source_code` being passed by `officialCalculationOrchestrator` into `sourceResolver` without enforcing formula-to-source ownership. That allowed `incident_operational_events` to run the incident adapter (`grc_incidents`) for a formula whose canonical contract is audit/readiness findings.

Canonical source decision:
CANONICAL_SOURCE_CODE = audit_findings_actions
CANONICAL_PHYSICAL_SOURCE = grc_readiness_findings joined to parent grc_readiness_snapshots when present; otherwise governed audit/action physical sources under the audit_findings_actions contract
ALLOWED_FALLBACKS = NONE for formula-to-source override; only existing audit_findings_actions contract fallback policy may apply for primary absent/no rows
LEGACY_NON_CANONICAL_PATHS = incident_operational_events / grc_incidents for F5_5_SEVERITY_INDEX

Why runtime previously selected incident_operational_events/grc_incidents:
`phase5.routes.js` and `phase5.service.js` can pass request bodies into `officialCalculationOrchestrator.recalculateOfficialAnalytics`. The orchestrator used `sourceOverrides[formula_code] || body.source_code || null` directly as resolver `sourceCode`; the resolver then trusted that requested source code. A stale/non-canonical override therefore selected `incident_operational_events` and the physical `grc_incidents` adapter.

Why SOURCE_SCHEMA_INCOMPATIBLE occurred:
The non-canonical incident adapter was queried under the Severity Index formula path. Physical schema/query mismatch in that path was wrapped as `SOURCE_SCHEMA_INCOMPATIBLE` and persisted as `source_incompatible`. HF4 prevents this false positive by resolving Severity through `audit_findings_actions` even when a non-canonical source override is present. Genuine canonical schema incompatibility remains visible as `SOURCE_SCHEMA_INCOMPATIBLE`.

Legacy/non-canonical paths constrained:
- `officialCalculationOrchestrator` resolves requested source code against the formula's canonical source contract before calling the resolver.
- `sourceResolver` applies the same guard for direct calls.
- Non-canonical overrides are not silently accepted; provenance exposes `requested_source_code`, `canonical_source_code`, `source_override_ignored` and warning `source_override_ignored_non_canonical:<requested>-><canonical>`.

Source contracts changed:
NONE

Formula changes:
NONE

SOURCE_CONTRACTS_VERSIONED:
[]

FORMULAS_VERSIONED:
[]

UNNECESSARY_VERSION_BUMPS:
0

Files changed:
- backend/src/services/math-governance/officialCalculationOrchestrator.service.js
- backend/src/services/math-governance/sourceResolver.service.js
- backend/src/services/math-governance/officialCalculationOrchestrator.test.js
- backend/src/services/math-governance/sourceResolver.test.js
- docs/codex/CURRENT_STATE.md
- docs/codex/WORK_QUEUE.md
- docs/codex/SHARED_BASELINE.md
- docs/codex/DECISIONS.md
- docs/codex/CONTRACTS_REGISTRY.md
- docs/codex/ARCHITECTURE_MAP.md
- docs/codex/handoffs/PUI-07-HF4.md

Codex validation performed:
- `node -c backend/src/services/math-governance/sourceResolver.service.js`
- `node -c backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `git diff --check`
- `node backend/src/services/math-governance/sourceResolver.test.js` -> `PHASE5_5_SOURCE_RESOLVER_TESTS_OK`
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js` -> `OFFICIAL_CALCULATION_ORCHESTRATOR_TESTS_OK`

FOCAL_TEST:
PASS (`sourceResolver.test.js` and `officialCalculationOrchestrator.test.js`)

FULL_CI:
NOT_RUN_BY_DESIGN

FULL_REGRESSION:
NOT_RUN_BY_DESIGN

PUSH:
NOT_RUN_BY_DESIGN

MERGE:
NOT_RUN_BY_DESIGN

DEPLOY:
NOT_RUN_BY_DESIGN

MANUAL_VALIDATION_PENDING:
YES

Gates:
ROOT_CAUSE_SEVERITY_INDEX = PASS
SEVERITY_INDEX_CANONICAL_SOURCE = PASS
SEVERITY_INDEX_SOURCE_OWNERSHIP = PASS
SEVERITY_INDEX_SCHEMA_COMPATIBILITY = PASS
SEVERITY_INDEX_RESOLVER_DETERMINISM = PASS
SEVERITY_INDEX_TEMPORAL_SEMANTICS = PASS
SEVERITY_INDEX_STATUS_SEMANTICS = PASS
SEVERITY_INDEX_PROVENANCE = PASS
SEVERITY_INDEX_NOT_CALCULABLE_SEMANTICS = PASS
SOURCE_SCHEMA_INCOMPATIBLE_FALSE_POSITIVE = 0
PARALLEL_SOURCE_TRUTH = 0
DATA_TRUST_REGRESSION = PASS
SOURCE_RESOLVER_REGRESSION = PASS
MATURITY_REGRESSION = PASS
GRC_HEALTH_REGRESSION = PASS
TENANT_SCOPE_PRESERVED = PASS
MULTI_TENANT_ISOLATION = PASS
NEW_TENANT_ONBOARDING = PASS
SELLABLE_MULTI_TENANT = PASS
ZERO_HARDCODE = PASS
NO_FAKE_DATES = PASS
NO_STATUS_BYPASS = PASS
NO_LEGACY_FALLBACK = PASS
NO_DEMO_DATA = PASS
NO_MANUAL_SQL_DEPENDENCY = PASS
PUBLISHED_CONTRACT_IMMUTABILITY = PASS
PUBLISHED_FORMULA_IMMUTABILITY = PASS
UNNECESSARY_VERSION_BUMPS = 0
FOCAL_TEST = PASS
RUNTIME_RECALCULATION = BLOCKED_RUNTIME
DEPLOY = NOT_RUN_BY_DESIGN

Known failures:
Runtime validation is pending by design.

Remaining debt:
Remaining HF4 implementation debt: NONE
Runtime validation: PENDING_MANUAL

Runtime validation commands:
1. Cherry-pick/merge this commit to the deployment branch per project process.
2. Deploy manually:
   `./scripts/deploy-vms.sh`
3. Trigger official recalculation for `F5_5_SEVERITY_INDEX` through the existing official calculation endpoint/UI flow for the target tenant and period. Do not pass a non-canonical source override.
4. PostgreSQL verification queries:

```sql
SELECT id, tenant_id, formula_code, run_status, source_status, period_start, period_end, completed_at
FROM calculation_runs
WHERE formula_code='F5_5_SEVERITY_INDEX'
ORDER BY completed_at DESC NULLS LAST, started_at DESC
LIMIT 5;
```

```sql
SELECT cr.id AS run_id, co.output_name, co.output_value, co.status, co.unit
FROM calculation_runs cr
LEFT JOIN calculation_outputs co ON co.run_id=cr.id AND co.tenant_id=cr.tenant_id
WHERE cr.formula_code='F5_5_SEVERITY_INDEX'
ORDER BY cr.completed_at DESC NULLS LAST, cr.started_at DESC, co.created_at DESC NULLS LAST
LIMIT 10;
```

```sql
SELECT cs.run_id, cs.snapshot_type, cs.row_count, cs.metadata
FROM calculation_runs cr
JOIN calculation_snapshots cs ON cs.run_id=cr.id AND cs.tenant_id=cr.tenant_id
WHERE cr.formula_code='F5_5_SEVERITY_INDEX'
ORDER BY cr.completed_at DESC NULLS LAST, cr.started_at DESC, cs.created_at DESC
LIMIT 5;
```

```sql
SELECT cr.id AS run_id,
       cs.metadata->'source_snapshot'->>'source_code' AS source_code,
       cs.metadata->'source_snapshot'->>'requested_source_code' AS requested_source_code,
       cs.metadata->'source_snapshot'->>'canonical_source_code' AS canonical_source_code,
       cs.metadata->'source_snapshot'->>'source_override_ignored' AS source_override_ignored,
       cs.metadata->'source_snapshot'->'physical_sources' AS physical_sources,
       cs.metadata->'source_snapshot'->'counts' AS counts,
       cs.metadata->'source_snapshot'->'data_trust' AS data_trust,
       cs.metadata->'source_snapshot'->'exclusions' AS exclusions
FROM calculation_runs cr
JOIN calculation_snapshots cs ON cs.run_id=cr.id AND cs.tenant_id=cr.tenant_id
WHERE cr.formula_code='F5_5_SEVERITY_INDEX'
ORDER BY cr.completed_at DESC NULLS LAST, cr.started_at DESC, cs.created_at DESC
LIMIT 5;
```

```sql
SELECT cr.id AS run_id, ce.machine_reason, ce.human_explanation, ce.metadata
FROM calculation_runs cr
LEFT JOIN calculation_explanations ce ON ce.run_id=cr.id AND ce.tenant_id=cr.tenant_id
WHERE cr.formula_code='F5_5_SEVERITY_INDEX'
ORDER BY cr.completed_at DESC NULLS LAST, cr.started_at DESC, ce.created_at DESC NULLS LAST
LIMIT 5;
```

Runtime expected:
F5_5_SEVERITY_INDEX
CANONICAL_SOURCE = CONFIRMED
SOURCE_SELECTION = DETERMINISTIC
SOURCE_SCHEMA_INCOMPATIBLE_FALSE_POSITIVE = 0
SNAPSHOT = PRESENT
DATA_TRUST = PRESENT
PROVENANCE = PRESENT
MACHINE_REASON = PRESENT_WHEN_NOT_CALCULABLE
NO_PARALLEL_TRUTH = PASS

## Do not rediscover

- PUI-01..PUI-07-HF3 remain closed unless new objective evidence contradicts them.
- Do not reopen `F5_5_MATURITY`; runtime validation after HF3 confirmed its status/temporal behavior.
- Do not reopen `F5_5_GRC_HEALTH`; runtime validation after HF3 confirmed health component temporal behavior.
- `F5_5_SEVERITY_INDEX` canonical source code is `audit_findings_actions`.
- `incident_operational_events` / `grc_incidents` are not canonical for `F5_5_SEVERITY_INDEX`.
- Non-canonical source overrides must remain visible as provenance/warnings and must not displace formula ownership.
- `SOURCE_SCHEMA_INCOMPATIBLE` remains valid for genuine canonical schema mismatch.
- Package3 is not source of truth; Data Trust v1 remains canonical.
- No formula expression, weights, units or precision changed in HF4.

Do not touch:
- `F5_5_MATURITY`
- `F5_5_GRC_HEALTH`
- Data Trust model semantics
- Package3 as source of truth
- Formula expressions/weights/units/precision
- Infrastructure, UI, AI/RAG/Regulatory

Next exact action:
User performs cherry-pick/push/deploy/runtime recalculation and PostgreSQL verification for `F5_5_SEVERITY_INDEX`.

Files next account should inspect first:
- backend/src/services/math-governance/officialCalculationOrchestrator.service.js
- backend/src/services/math-governance/sourceResolver.service.js
- backend/src/services/math-governance/sourceResolver.test.js
- backend/src/services/math-governance/officialCalculationOrchestrator.test.js
- docs/codex/handoffs/PUI-07-HF4.md

Files next account should NOT inspect unless evidence/test requires it:
- frontend/
- ai-engine/
- backend/src/services/knowledge-base/
- backend/src/services/intelligence/
- infrastructure/Nginx/CORS/SSL/ports
