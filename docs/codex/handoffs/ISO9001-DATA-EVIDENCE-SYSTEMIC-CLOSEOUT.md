# ISO9001 Data Evidence Systemic Closeout

Date: 2026-09-15

Status: `BLOCKED_GOVERNED_ISO9001_REFERENCE_AND_RUNTIME_EVIDENCE`

Continuation note: backend canonical dataflow was later closed locally in
`docs/codex/handoffs/CANONICAL-DOCUMENT-INDEX-DASHBOARD-CLOSEOUT.md`.
That continuation supersedes this file for manual evidence-library upload,
`PUT /api/controls/:id`, dashboard Health optionality, and isolated PostgreSQL
evidence. The governed ISO9001 source backlog in this file remains valid.

Repository: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`

Branch: `main`

Base HEAD: `8ba51fec476fd7bb99c81d16d8a9e54a34a37a62`

Commit/push/merge/deploy by Codex: `NO`

Production/QA DB writes by Codex: `NO`

## Scope

Focused local investigation and repair for ISO9001 versioning, control-to-dashboard propagation, tenant data coherence, and manual evidence upload. Codex preserved the existing clean worktree, did not edit `.env`, did not change LLM model configuration, and did not run full CI/deploy.

## Inherited State Found

- Governed ISO reference authority: `database/reference/iso/manifest.json`.
- `ISO9001:2015`: `approved_for_loader`, `published`, `certifiable=true`, `product_standard_code=ISO_9001_2015`, 16 controls, 13 evidence expectations.
- `ISO9001:2026_FDIS`: `transition_only`, `transition_prep`, `certifiable=false`, `product_standard_code=null`, 8 controls, 8 evidence expectations.
- Loader `scripts/normalization/load-production-reference-catalogs.js` validates every manifest file and projects only `approved_for_loader` sources into `standards` and `controls_catalog`; transition-only sources load into versioned `iso_*` reference tables only.

## Root Cause

- The requested ~50-control ISO9001:2015 catalog is not present in the governed repository reference source. Codex cannot invent those controls.
- `/api/dashboard-controls/:tenant_id` used `v_iso_control_effective_health` as the row universe. Controls without a published Health snapshot disappeared from the dashboard even when active/applicable.
- Legacy `PUT /api/controls/:id` updated legacy `controls` only and bypassed canonical `tenant_controls`, SoA assessment history, and GRC post-mutation orchestration when hit by older consumers.
- `POST /api/evidences/upload` used the existing local disk storage correctly, but a validation/auth/DB failure after Multer wrote the file could leave an orphan physical file.

## Corrections Made

- `backend/src/routes/dashboard-controls.routes.js`: control rows now come from tenant-scoped `tenant_controls + tenant_applicable_controls`; `v_iso_control_effective_health` is a left join; displayed status comes from `tenant_controls.status`, not stale Health.
- `backend/src/routes/controls.routes.js`: compatibility `PUT /api/controls/:id` now first updates canonical `tenant_controls`, records `control_soa_assessments`, and publishes official recalculation metadata; legacy `controls` update remains fallback and is explicitly marked as compatibility.
- `backend/src/routes/evidences.routes.js`: uploaded disk file is unlinked on early validation/auth failures and transaction rollback.
- `backend/src/routes/grcRuntimeRepair.contract.test.js`: static/contract coverage added for the three repaired paths.

## Traceability Matrix

| Hecho | Fuente canónica | Escritura | Derivados | Endpoints | Pantallas | Recalculo |
|---|---|---|---|---|---|---|
| Control status | `tenant_controls.status` | `PUT /api/controls/workbench/:tenant_control_id`, compatibility `PUT /api/controls/:id` | `control_soa_assessments`, official metric snapshots when recalculation succeeds | `/api/controls/workbench`, `/api/dashboard`, `/api/dashboard-controls` | `/controles`, `/dashboard` | `publishAffectedOfficialIndicators(factType='compliance')` |
| Control universe | `tenant_controls` + `tenant_applicable_controls` | initialize/backfill/profile applicability | `v_iso_control_effective_health` measurement optional | `/api/dashboard-controls`, `/api/controls/workbench` | `/dashboard`, `/controles` | no score invented; Health optional |
| Evidence upload | `evidences` metadata + local file under `backend/uploads/evidences` | `POST /api/evidences/upload` | Evidence AI queue, official evidence metrics | `/api/evidences/upload`, `/api/evidences/file/:id`, `/api/evidences/:tenant_id` | `/evidencias`, `/controles` | `publishAffectedOfficialIndicators(factType='evidence')` |
| ISO9001 versions | `iso_standard_versions`, `iso_controls`, `iso_evidence_expectations` | reference loader only | approved versions project to `standards`/`controls_catalog`; transition-only does not | `/api/iso-knowledge/*`, lifecycle consumers | ISO Express/readiness/catalog views | none unless a product-projected standard is active |
| Health/readiness/dashboard | `metric_snapshots` + `v_iso_control_effective_health` + tenant applicable controls | official orchestrator/publication | dashboard/readiness projections | `/api/health/*`, `/api/metrics/official/dashboard`, `/api/dashboard-controls` | `/dashboard`, `/iso-health`, `/metricas` | official calculation pipeline only |

## Validation

PASS:

- `node -c backend/src/routes/dashboard-controls.routes.js`
- `node -c backend/src/routes/controls.routes.js`
- `node -c backend/src/routes/evidences.routes.js`
- `node backend/src/routes/grcRuntimeRepair.contract.test.js`

Pending/not run by design:

- isolated PostgreSQL for this exact package;
- runtime upload through VM/reverse proxy;
- VM filesystem ownership/mount/backup verification;
- full backend/frontend suites;
- deploy strategy/full CI.

## VM Checks Required

Do not chmod `777`.

Run read-only checks on backend VM:

```bash
BACKEND_DIR=/path/to/backend
stat -c '%U:%G %a %n' "$BACKEND_DIR/uploads" "$BACKEND_DIR/uploads/evidences" "$BACKEND_DIR/uploads/evidence-library"
df -h "$BACKEND_DIR/uploads"
mount | grep -E 'uploads|backend|tcdx' || true
```

If the service user cannot write, owner should adjust to the actual service user/group, for example:

```bash
sudo chown -R <backend_service_user>:<backend_service_group> "$BACKEND_DIR/uploads"
sudo chmod -R u+rwX,g+rwX,o-rwx "$BACKEND_DIR/uploads"
```

Rollback:

```bash
sudo chown -R <previous_user>:<previous_group> "$BACKEND_DIR/uploads"
sudo chmod -R <previous_mode> "$BACKEND_DIR/uploads"
```

Validation after any authorized VM change:

```bash
sudo -u <backend_service_user> test -w "$BACKEND_DIR/uploads/evidences"
sudo -u <backend_service_user> test -w "$BACKEND_DIR/uploads/evidence-library"
```

Also verify reverse proxy upload limits if large files fail:

```bash
sudo nginx -T | grep -n 'client_max_body_size' || true
```

## Blockers

- Governed ISO9001:2015 ~50-control source is absent. Current real count is 16, not ~50.
- ISO9001:2026 final/certifiable catalog is absent; current FDIS is transition-only and intentionally excluded from product metrics.
- No runtime/VM evidence was available in this Codex execution for multipart upload through deployed proxy/storage.

## Do Not Rediscover

- Do not invent ISO9001 controls to meet a target count.
- Do not project `ISO9001:2026_FDIS` into product metrics unless a governed tenant-scoped activation/product transition contract is added and reviewed.
- Do not make Health snapshots the control universe; they are measurements.
- Do not use full page reloads or cache-only changes as propagation fixes.
- Do not add S3/object storage parallel to the existing local-disk contract without a product storage decision.
