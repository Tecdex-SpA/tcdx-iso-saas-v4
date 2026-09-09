# Final Gate Results DB-N01..DB-N05

Status: `DB_INTEGRAL_HUMAN_REVIEW_PACKAGE_READY`.

Precheck:

- Branch: `codex/db-n01-control-identity-normalization`.
- HEAD: `11003dd92385dcca1caf5365fa437be3aee1f648`.
- Initial `git diff --check`: PASS.
- Staging: not used.

Executed gates:

| Gate | Command | Result |
| --- | --- | --- |
| Zero legacy static | `node scripts/normalization/db-integral-zero-legacy.test.js` | PASS: `ACTIVE_RUNTIME_LEGACY=0`, `ZERO_LEGACY_STATIC PASS` |
| Zero legacy PostgreSQL | `node scripts/normalization/db-integral-zero-legacy.postgres.test.js` | PASS: `LEGACY_OBJECT_COUNT=0`, `ZERO_LEGACY_POSTGRES PASS` |
| Formula lineage | `node scripts/normalization/db-integral-formula-lineage.postgres.test.js` | PASS: 53 formulas, mismatch 0, leakage 0, runtime E2E PASS |
| Baseline static | `node scripts/normalization/apply-db-n05-production-baseline.test.js` | PASS |
| Runtime schema | `node scripts/normalization/db-n05-runtime-schema-contract.test.js` | PASS: `ACTIVE_MISSING=0`, regulatory parity 15 tables |
| Reference catalogs | `node scripts/normalization/db-n05-reference-catalogs.test.js` | PASS: 61 controls, 54 evidence, 3 approved, FDIS transition-only |
| Privileges | `node scripts/normalization/db-n05-production-role-privileges.postgres.test.js` | PASS: effective ACL and function allowlist |
| Fresh DB | `node scripts/normalization/db-n05-fresh-production.postgres.test.js` | PASS: PostgreSQL 16.15, pgvector, loader double-run, backend startup |
| Backend suite | `cd backend && npm test` | PASS when run outside sandbox |
| Frontend lint | `npm --prefix frontend run lint` | PASS with 3 unused warnings only |
| Frontend build | `npm --prefix frontend run build` | PASS |

Environment/evidence:

- PostgreSQL isolated version: `16.15 (Debian 16.15-1.pgdg12+2)`.
- pgvector image digest: `sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`.
- Fresh object counts: `OBJECT_COUNTS 133|192|292`.
- QA reference export SHA-256: `5ebe8c04225bbe19a0f5b4a56b648af8fc43019f0195b8854384a4bbbf9c3ab0`.

Sandbox note:

- PostgreSQL isolated tests initially cannot run inside the managed sandbox because `initdb` fails on shared memory (`shmget Operation not permitted`). They passed outside the sandbox with localhost-only disposable clusters.
- `backend && npm test` initially failed in sandbox at `commercial.service.test.js` TCP bind. The same command passed outside the sandbox.

Discrepancies:

- No material contradiction found against the DB-N01..DB-N05 claims reproduced in this review.
- Frontend lint warnings remain exactly three unused helpers in `frontend/src/app/administrar-kpis/page.tsx`; build passes and these are classified as polish/non-functional.

Not executed:

- No `git add`, commit, push, merge or deploy.
- No writes to `db-v4`.
- No `CREATE DATABASE tcdx_saasv2`.
