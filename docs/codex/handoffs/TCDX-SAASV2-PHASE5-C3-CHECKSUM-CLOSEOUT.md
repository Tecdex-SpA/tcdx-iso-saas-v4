# TCDX SaaSv2 Phase 5-C3 Checksum Closeout

Date: 2026-09-10

Status: `TCDX_SAASV2_PHASE5_C3_CHECKSUM_ROOT_CAUSE_FIXED_READY_FOR_PRODUCTION_REDEPLOY`

Branch: `main`

Verified base HEAD: `49a7c61aafc9db159d62f6aafceff456196887eb`

## Scope

Close the Phase 5-C3 deploy blocker:

`Published source contract checksum mismatch: risk_register_controls@7`

No production DB write, deploy, commit, push, merge, service restart or `.env` edit was performed.

## Root Cause

The current Phase 5-C3 runner reaches the source contract comparison through:

`scripts/phase5-c3/apply-phase5-c3-migration.js -> syncMathGovernanceCatalog -> syncOfficialSourceContracts`

The throwing condition is in `backend/src/services/math-governance/formulaBootstrap.service.js`:

`existing published row checksum !== code contract checksum`.

Local and remote backend checkout both compute:

```text
risk_register_controls
version=7
code_checksum=b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80
```

Given the externally confirmed production row:

```text
source_code=risk_register_controls
version_number=7
status=published
database_checksum=b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80
```

the current code cannot satisfy the mismatch condition. The only different checksum reproduced locally is a deep structural diagnostic hash:

```text
DEEP_STRUCTURAL_DIAGNOSTIC_CHECKSUM=3730882daa3b15aca62ce62568fc0efa580373a4c5a8ac730cd802bc042b0103
```

That value is not the published v7 checksum and does not justify v8.

## Fix

Implemented:

- `sourceContracts.service.js` exports `publishedSourceContractChecksum`, the existing published checksum authority.
- `formulaBootstrap.service.js` now reads the full persisted source contract row before comparing and reports `db_checksum`, `code_checksum` and differing persisted fields on a real mismatch.
- `sourceContractChecksum.test.js` covers v7 parity, nested metadata preservation, stable diagnostic serialization, semantic-change checksum change, identical published-row idempotence and mismatch diagnostics.
- `scripts/phase5-c3/check-phase5-c3-postgres.sh` now runs explicit Phase 5-C3 `--preflight` before `--apply`.

No source contract payload, formula expression, formula version or source contract version was changed.

## Contract Authority

```text
risk_register_controls
version=7
code_checksum=b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80
database_checksum=b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80
semantic_drift=false
new_version_required=false
```

## Safe Replay Evidence

Executed only on disposable local PostgreSQL/Docker test DB:

```text
Phase 5-C3 migration preflight OK: pending=20260807_phase5_c3_indicators_trust_snapshots
Phase 5-C3 migration applied: 20260807_phase5_c3_indicators_trust_snapshots
Phase 5-C3 migration applied: already_applied
```

Isolated replay summary:

```json
{"status":"VERIFIED_PHASE5_C3_POSTGRES","catalog":22,"bindings":22,"trust_dimensions":8,"tenant_isolation":"verified","real_zero":"preserved","official_null_states":"verified","legacy_null":"rejected","coverage_boundaries":"verified","invalid_period":"rejected","metric_comparison_fk":"verified","target_comparison":"verified","concurrency":"single_logical_snapshot","failed_retry":"verified","idempotent":"verified","published_immutable":"verified","null_to_zero":"rejected","applied_checksum_mismatch":"rejected"}
```

## Tests

PASS:

- `node --check backend/src/services/math-governance/sourceContracts.service.js`
- `node --check backend/src/services/math-governance/formulaBootstrap.service.js`
- `node --check backend/src/services/math-governance/sourceContractChecksum.test.js`
- `node backend/src/services/math-governance/sourceContractChecksum.test.js`
- `node backend/src/services/math-governance/sourceResolver.test.js`
- `node backend/src/services/math-governance/officialFormulas.test.js`
- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `node backend/src/services/math-governance/officialIndicatorMatrix.test.js`
- `node scripts/phase5/check-phase5-contracts.js`
- `node scripts/phase5-c2/check-phase5-c2-contracts.js`
- `node scripts/phase5-c3/check-phase5-c3-contracts.js`
- `node scripts/phase5-5/check-phase5-5-source-contracts.js`
- `bash scripts/phase5-c3/check-phase5-c3-postgres.sh`

## What Was Not Done

- No SQL was executed against `tcdx_saasv2`.
- No production deploy was executed.
- No backend, AI Engine or frontend service was restarted.
- No `.env` or protected migration env file was read or modified.
- No commit, push or merge was performed.

## Production Redeploy Runbook

After human review:

```bash
git status --short
git add backend/src/services/math-governance/sourceContracts.service.js \
  backend/src/services/math-governance/formulaBootstrap.service.js \
  backend/src/services/math-governance/sourceContractChecksum.test.js \
  scripts/phase5-c3/check-phase5-c3-postgres.sh \
  docs/codex/CURRENT_STATE.md \
  docs/codex/WORK_QUEUE.md \
  docs/codex/DECISIONS.md \
  docs/codex/REGRESSION_COMMANDS.md \
  docs/codex/handoffs/TCDX-SAASV2-PHASE5-C3-CHECKSUM-CLOSEOUT.md
git commit -m "fix(math): harden phase5 c3 source contract checksum diagnostics"
git push origin main
./scripts/deploy-vms.sh
```

Expected deploy migration evidence:

```text
Phase 5-C3 migration preflight OK
Phase 5-C3 migration applied
```

or:

```text
Phase 5-C3 migration applied: already_applied
```

Post-deploy health checks:

```bash
ssh tecdex@bk-v4.tcdx.int 'systemctl is-active tecdex-backend && curl -fsS http://localhost:3000/health'
ssh tecdex@ai-v4.tcdx.int 'systemctl is-active ai-engine.service && curl -fsS http://localhost:8001/health'
ssh tecdex@www-v4.tcdx.int 'systemctl is-active tcdx-frontend.service && curl -fsS http://localhost:3001'
```

DB validation after deploy, in the protected migration context only:

```sql
SELECT source_code, version_number, status, checksum
FROM official_formula_source_contracts
WHERE tenant_id IS NULL
  AND source_code = 'risk_register_controls'
  AND version_number = 7;
```

Expected checksum:

```text
b335b8d8f1c516153b45c53821930fb5c1251fb3bd1b4e112f1c5b3bec00fa80
```

Rollback if redeploy fails before service restart:

```bash
git revert <commit_sha>
git push origin main
```

Then rerun `./scripts/deploy-vms.sh` only after confirming the failure is not a production DB state conflict.
