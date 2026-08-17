# HANDOFF PUI-03-HF2

Owner: CODEX A
Account: codex
Status: DONE
Branch: hotfix/pui-03-formula-version-governance
Base SHA: ff186999640af48ddd307b6eaceff2787c0d03a5
Head/Commit SHA: FINAL_COMMIT_REPORTED_IN_CODEX_RESPONSE

Incident:

Deploy of `main` at `ff18699` stopped during Phase 5-C3 with `Published formula checksum mismatch: F5_5_CONTROL_EFFECTIVENESS@1`.

Root cause:

`checksumFor()` excludes only `execute`, `tests` and `checksum`; formula methodology is governed. PUI-01 changed the `F5_5_CONTROL_EFFECTIVENESS` methodology text to explicitly prohibit expanding aggregate assurance score into D/I/O/E while the formula remained at version 1.

Affected formulas:

| Formula | Current Version Before HF2 | Governed Payload Changed Since `033236f` | Reason | Action |
|---|---:|---|---|---|
| `F5_5_CONTROL_EFFECTIVENESS` | 1 | YES | methodology changed from generic weighted control dimensions to explicit D/I/O/E anti-fabrication contract | bump to 2 |

Formulas reviewed that do not require bump:

| Formula | Version | Reason |
|---|---:|---|
| `F5_5_INHERENT_RISK` | 2 | Already versioned before baseline `033236f`; no governed payload diff in `033236f..HEAD`. |
| All other formulas in `formulaRegistry.service.js` | unchanged | No governed payload diff in the focal historical diff. |

Version changes:

- `F5_5_CONTROL_EFFECTIVENESS`: `1 -> 2`.

Protection preserved:

- `syncOfficialFormulaRegistry()` still checks `(formula_definition_id, version_number)` and throws `Published formula checksum mismatch` if a published version has a different checksum.
- Historical formula rows are not updated, deleted, retired or overwritten by this hotfix.
- Source-contract version and formula version remain independent.

Files changed:

- `backend/src/services/math-governance/formulaRegistry.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/handoffs/PUI-03-HF2.md`

Validation:

- Historical focal diff reviewed:
  - `git diff 033236f..HEAD -- backend/src/services/math-governance/formulaRegistry.service.js`
  - `git diff 033236f..57e8264 -- backend/src/services/math-governance/formulaRegistry.service.js`
  - `git diff 57e8264..d9800d9 -- backend/src/services/math-governance/formulaRegistry.service.js`
  - `git diff d9800d9..7f9e79d -- backend/src/services/math-governance/formulaRegistry.service.js`
- Syntax checks:
  - `node -c backend/src/services/math-governance/formulaRegistry.service.js`
  - `node -c backend/src/services/math-governance/sourceResolver.test.js`
- Focal test:
  - `cd backend && node src/services/math-governance/sourceResolver.test.js`
  - PASS: `{"status":"PHASE5_5_SOURCE_RESOLVER_TESTS_OK","formulas":53,"contracts":20,"unresolved_internal":0,"fallback_assertions":3,"equivalence_assertions":9,"formula_execution_assertions":8}`

FOCAL_TEST:
PASS

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

## Do not rediscover

- `formulaBootstrap.service.js` protects published formula immutability by formula definition + `version_number` + checksum.
- `checksumFor()` excludes only `execute`, `tests` and `checksum`; methodology and other serializable formula fields are governed.
- Changing governed formula payload requires a new formula version.
- Do not modify historical formula rows or disable checksum protection.
- Source-contract version and formula version are independent.
- PUI-01/PUI-02/PUI-03 remain closed.
- This hotfix only corrects formula-version governance.

Next exact action:

Cherry-pick/push/deploy this hotfix through the manual release path, then rerun the deploy/bootstrap that failed on `F5_5_CONTROL_EFFECTIVENESS@1`.
