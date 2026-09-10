# TCDX Release RBAC / Roles / Capabilities / Runtime Closeout

Status: `TCDX_RELEASE_RBAC_CAPABILITY_FINAL_PREDEPLOY_READY_FOR_HUMAN_REVIEW`

Date: 2026-09-10
Branch: `main`
Base HEAD: `ba3fc889e916c5a4601c15f96373e24321cefd5d`

Codex did not commit, push, merge, deploy, edit `.env`, connect to `tcdx_saasv2`, or write to any real database. PostgreSQL validation used a disposable localhost-only isolated container and cleaned up.

## Final Pre-Deploy Residual Authority Closeout

Human-review residual role-authority findings were closed without redesigning RBAC or recreating the permission matrix. Executable decisions still involving role families now delegate to `backend/src/services/auth/roleCompatibility.service.js`, RBAC effective permissions, tenant scope, commercial entitlement/capability, dealer assignment, or frontend mirror helpers.

New/updated artifacts and gates:

- `artifacts/release-rbac/RESIDUAL_ROLE_AUTHORITY_CLASSIFICATION.md`
- `scripts/release-rbac/check-residual-role-authority.js`
- `scripts/release-rbac/check-role-alias-equivalence.js`
- `scripts/release-rbac/check-release-rbac-contract.js` now executes residual authority and alias equivalence gates.
- `scripts/release-rbac/check-frontend-backend-authorization-consistency.js` now emits final mirror/backend markers.
- `scripts/release-rbac/release-rbac-isolated-postgres.test.js` now emits final functional/orphan/cleanup markers.

Residual classification:

- `CENTRAL_AUTHORITY_CONSUMER=41`
- `PRESENTATION_ONLY=2`
- `BUSINESS_ROLE_SEMANTICS=6`
- `COMPATIBILITY_ONLY=8`
- `RESIDUAL_AUTHORIZATION_AUTHORITY=0`
- `UNCLASSIFIED_ROLE_CHECKS=0`

Alias equivalence PASS:

- `ROLE_ALIAS_PLATFORM_EQUIVALENCE=PASS`
- `ROLE_ALIAS_TENANT_ADMIN_EQUIVALENCE=PASS`
- `ROLE_ALIAS_AREA_OWNER_EQUIVALENCE=PASS`
- `ROLE_ALIAS_EXECUTIVE_EQUIVALENCE=PASS`
- `ROLE_ALIAS_VIEWER_EQUIVALENCE=PASS`
- `ROLE_AUDITOR_CANONICAL=PASS`
- `ROLE_DEALER_CANONICAL=PASS`
- `ROLE_FAMILY_EXCLUSIVITY=PASS`

Functional validation PASS:

- seven-role synthetic PostgreSQL suite
- tenant A/B isolation
- dealer assignment isolation
- entitlement positive and negative combinations
- frontend/backend authorization consistency
- backend full test suite

Focal fix performed during final closeout: `backend/src/services/isoRiskMatrix.service.js` restored private risk-matrix authorization helpers over `ROLE_GROUPS` and `roleMatchesAny` after `npm --prefix backend test` exposed an undefined `canManageRiskMatrix` export.

## Scope Closed

Systemic authorization contract:

```text
usuario -> rol canonico -> permiso RBAC -> tenant scope -> entitlement/capability -> acceso efectivo
```

Closed surfaces:

- canonical user-role normalization and alias compatibility
- RBAC permission catalog and deliberate seven-role matrix
- active runtime permission extraction and catalog gap
- commercial capability required-permission consistency
- tenant scope, platform scope and dealer assignment semantics
- executable legacy platform-role authority removal
- frontend/backend authorization consistency as mirror-only frontend gates
- isolated PostgreSQL migration/reapply/checksum/synthetic-role validation

## Role Normalization

Central backend authority: `backend/src/services/auth/roleCompatibility.service.js`.

Canonical roles:

- `platform_admin`
- `tenant_admin`
- `auditor`
- `area_owner`
- `executive`
- `dealer`
- `viewer`

Aliases:

- `superadmin`, `super_admin`, `admin_global`, `global_admin`, `owner` -> `platform_admin`
- `admin`, `admin_cumplimiento`, `compliance_admin`, `compliance_manager` -> `tenant_admin`
- `operativo`, `responsable_area`, `control_owner` -> `area_owner`
- `ejecutivo` -> `executive`
- `cliente`, `client`, `read_only`, `readonly`, `solo_lectura` -> `viewer`

No destructive user rewrite was performed.

## Permission Counts

- Deliberate matrix permissions: 175.
- Active authorization permission keys detected by extractor: 121.
- Catalog permissions from baseline/migrations/candidate: 203.
- `RUNTIME_MISSING_IN_CATALOG=0`.
- `UNEXPECTED_RUNTIME_KEYS=0`.
- `CONTRACT_KEYS_NOT_SEEN=54`.
- Contract permission `UNCLASSIFIED=0`.

Role grant counts in the deliberate matrix:

- `platform_admin`: 175
- `tenant_admin`: 162
- `auditor`: 48
- `area_owner`: 31
- `executive`: 24
- `dealer`: 4
- `viewer`: 11

The 54 contract keys not seen by the active extractor are classified in `artifacts/release-rbac/CONTRACT_PERMISSION_CLASSIFICATION.md`:

- `EXTRACTION_GAP`: 12
- `DORMANT_FEATURE`: 9
- `MIGRATION_COMPATIBILITY`: 18
- `CAPABILITY_ONLY`: 15

## Dealer Decision

Decision: `SPECIAL_SCOPE_WITH_MINIMAL_PORTAL_PERMISSIONS`.

Dealer has no general tenant read/mutation access by role alone. Effective dealer access requires explicit dealer-tenant assignment plus minimal portal/commercial permissions:

- `dealer.billing.read`
- `dealer.clients.view`
- `dealer.quotes.manage`
- `commercial.subscription.read`

The isolated suite validates assigned tenant A allow for dealer surface, tenant B deny, and internal tenant administration deny.

## Migration

Candidate migration:

- `database/migrations/20260910_release_rbac_capability_systemic_closeout.sql`
- checksum: `8265da4cbf70aa9b2222456e7cc23f9ff5f38cb4268b4a42f7feea836243091b`

Runner:

- `scripts/release-rbac/apply-release-rbac-capability-closeout.js`

Properties:

- forward-only
- idempotent
- ledger/checksum guarded
- mismatch fail-closed
- no tenant/user/email/date-specific data
- no `GRANT ... ALL`
- no invented commercial catalog data

## Artifacts

- `artifacts/release-rbac/RUNTIME_AUTHORIZATION_INVENTORY.md`
- `artifacts/release-rbac/PERMISSION_CATALOG_GAP.md`
- `artifacts/release-rbac/CANONICAL_ROLE_PERMISSION_MATRIX.md`
- `artifacts/release-rbac/ROLE_CAPABILITY_ENTITLEMENT_MATRIX.md`
- `artifacts/release-rbac/LEGACY_AUTHORITY_CLASSIFICATION.md`
- `artifacts/release-rbac/CONTRACT_PERMISSION_CLASSIFICATION.md`

Legacy authority:

- Initial failing static gate: `RELEASE_RBAC_UNSAFE_LEGACY_PLATFORM_CHECKS=212`.
- Current unsafe executable legacy platform checks: `0`.
- Classified removed/centralized executable rows in artifact: 342 rows from diff evidence, including `EXECUTABLE_AUTHORITY_LEGACY` and `EXECUTABLE_PLATFORM_HELPER_DUPLICATE`.

## Validation Evidence

PASS:

- `node scripts/release-rbac/build-release-rbac-artifacts.js`
- `node scripts/release-rbac/check-release-rbac-contract.js`
- `node scripts/release-rbac/check-frontend-backend-authorization-consistency.js`
- `node scripts/release-rbac/apply-release-rbac-capability-closeout.js --checksum`
- `node scripts/release-rbac/release-rbac-isolated-postgres.test.js`
- `npm --prefix frontend run typecheck`
- Node syntax check for 72 modified JS files
- `git diff --check`

Isolated PostgreSQL PASS details:

- fresh baseline + official fresh migrations + candidate migration
- candidate reapply
- checksum verification
- checksum mismatch fail-closed
- catalog integrity
- capability permission orphan count 0
- role orphan count 0
- permission orphan count 0
- seven synthetic roles over tenant A and tenant B
- `ROLE_PLATFORM_ADMIN_NOT_SUPERADMIN_ALIAS_DEPENDENT=PASS`
- `ROLE_TENANT_ADMIN_TENANT_B_DENY=PASS`
- `ROLE_AUDITOR_AUDIT_REVIEW=PASS`
- `ROLE_AREA_OWNER_SCOPE_DENY=PASS`
- `ROLE_EXECUTIVE_MUTATION_DENY=PASS`
- `ROLE_VIEWER_MUTATION_DENY=PASS`
- `ROLE_DEALER_TENANT_A_ASSIGNED=PASS`
- `ROLE_DEALER_TENANT_B_DENY=PASS`
- `TENANT_A_TO_TENANT_B_LEAKAGE=PASS`
- entitlement combinations PASS:
  - RBAC allow + scope allow + entitlement allow -> allow
  - RBAC deny + entitlement allow -> deny
  - RBAC allow + scope deny -> deny
  - RBAC allow + entitlement deny -> deny
  - dealer assigned false -> deny

Frontend/backend consistency PASS:

- unsafe frontend legacy platform authority 0
- viewer distinct from executive
- frontend route gates consume backend `/api/me/permissions`, `/api/me/modules` and capability decisions
- dealer denied from internal tenant mutation helper
- frontend remains mirror-only; backend remains authority

## Files Added

- `artifacts/release-rbac/*`
- `database/migrations/20260910_release_rbac_capability_systemic_closeout.sql`
- `docs/codex/handoffs/TCDX-RELEASE-RBAC-CAPABILITY-SYSTEMIC-CLOSEOUT.md`
- `scripts/release-rbac/apply-release-rbac-capability-closeout.js`
- `scripts/release-rbac/build-release-rbac-artifacts.js`
- `scripts/release-rbac/centralize-platform-role-helpers.js`
- `scripts/release-rbac/check-frontend-backend-authorization-consistency.js`
- `scripts/release-rbac/check-release-rbac-contract.js`
- `scripts/release-rbac/release-rbac-contract.js`
- `scripts/release-rbac/release-rbac-isolated-postgres.test.js`

## Files Modified

Backend role authority, middleware, tenant scope, Admin SaaS, SOA, quotes, users, KPI/health, audit/compliance, integrations, reports, actions/evidence/findings/assets and service paths were aligned to central role normalization. Frontend role/capability gates were aligned to the frontend mirror helpers in:

- `frontend/src/utils/mvpPermissions.ts`
- `frontend/src/utils/auth.ts`
- `frontend/src/utils/apiClient.ts`
- `frontend/src/components/AppLayout.tsx`
- selected dashboard, BI, cotizador, prefacturacion, usuarios, controles, evidencias, matriz-riesgo, health, indicators, semantic and report components.

Continuity docs updated:

- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/REGRESSION_COMMANDS.md`

## Residual Risks

- This is local human-review readiness only, not production readiness.
- Full CI, deployed runtime QA, browser E2E and commercial manual screen-by-screen QA were not executed by Codex.
- The 54 contract keys not seen by the active extractor are classified and non-blocking locally, but should be reviewed by humans for product roadmap/catalog hygiene before deploy.
- Existing uncommitted closeout work remains in the shared worktree and was preserved.

## Next Exact Action

Human review the diff and artifacts, then owner decides commit/push/CI/deploy. After deploy, run commercial QA/runtime validation against authorized environments; do not infer production readiness from this local closeout.
