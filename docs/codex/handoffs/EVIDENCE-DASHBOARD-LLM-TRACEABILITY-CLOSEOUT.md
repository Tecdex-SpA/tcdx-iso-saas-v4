# Handoff - Evidence Dashboard LLM Traceability Closeout

Date: 2026-09-15

Status: `EVIDENCE_DASHBOARD_LLM_TRACEABILITY_READY_FOR_REVIEW`.

Branch/HEAD: `main` at `49c01d3396d765ae95d8247b226c97cd383de740`.

Codex did not commit, push, merge, deploy, edit `.env`, change gateway URL/API keys/model aliases, create migrations, create tables, alter production schema, or write to QA/production DB.

## Scope Closed Locally

- LLM traceability: backend builds canonical `llm_trace` from authenticated context; frontend identity spoofing is overwritten; `actor`, `system=tcdx-iso` and canonical tenant company reach AI Engine and the OpenAI-compatible client.
- Semantic evidence: existing `POST /semantic-evidence/analyze` in `ai-engine/main.py` now performs deterministic base analysis plus optional central `call_llm_json` enrichment, trace propagation, strict candidate whitelist, structured summary/facts/inferences/chunks/suggestions/scoring/limitations, controlled fallback and `human_review_required=true`.
- Evidence backend: semantic profile, chunks and suggestions persist to canonical tenant evidence tables; accepting a suggestion creates an active `tenant_document_object_links` association only after human review for `control`, `nonconformity` or `finding`; unauthorized/cross-tenant LLM targets are discarded.
- Evidence UI contract: frontend calls `/api/evidence-library/semantic/analyze`, exposes loading/error states and keeps analysis/association user-driven.
- Company Profile AI: UI contract calls `/api/company-profile/analyze/start` and scoped polling; no frontend tenant spoofing; no double submit; error/loading/result render states asserted.
- Applicable universe rebuild: existing applicability engine rebuilds generated rows idempotently from tenant profile plus active tenant standards, excludes inactive transition standards, avoids duplicates and preserves tenant isolation.
- Dashboard: summary backend and dashboard UI preserve missing universe/risk/Health as `NULL/sin_datos`; no absence-as-zero; operational legends describe universe/measurement/interpretation.

## Canonical Data Model

| capability | canonical object |
|---|---|
| manual document persistence | `document_index` with `provider='manual_upload'`, `source_id=NULL`, `integration_id=NULL` |
| semantic profile | `tenant_evidence_semantic_profiles` |
| evidence chunks | `tenant_evidence_chunks` |
| evidence suggestions | `tenant_evidence_applicability_suggestions` |
| evidence associations | `tenant_document_object_links` |
| controls universe | `tenant_applicable_controls` + `tenant_controls` |
| NC targets | `tenant_nonconformities` |
| finding targets | `findings` |
| company profile | `tenant_company_profiles` |
| applicability rebuild | `tenant_applicability_profiles`, `tenant_applicable_controls`, tenant applicability generated tables |

## Do Not Rediscover

- Do not recreate or depend on `tenant_document_sources`.
- Do not create a parallel semantic evidence endpoint; use `ai-engine/main.py` `POST /semantic-evidence/analyze`.
- Do not trust LLM targets unless backend recognizes them in the tenant-scoped candidate set.
- Do not let accepted evidence mutate compliance, Health, controls, NCs or findings.
- Do not convert missing Health/risk/applicability universe to zero.
- Do not change OpenAI gateway URL/API key/model aliases.

## Files Changed / New

- `ai-engine/main.py`
- `ai-engine/app/services/llm_client.py`
- `ai-engine/app/routes/ai.py`
- `ai-engine/app/scripts/test_dgx_litellm_hardening.py`
- `ai-engine/app/scripts/test_semantic_evidence_endpoint.py`
- `backend/src/services/llmTraceContext.service.js`
- `backend/src/services/llmTraceContext.service.test.js`
- `backend/src/services/aiEngineClient.service.js`
- `backend/src/services/companyProfile.service.js`
- `backend/src/services/companyProfileApplicabilityEngine.service.js`
- `backend/src/services/evidenceLibrary.service.js`
- `backend/src/routes/evidence-library.routes.js`
- `backend/src/routes/dashboard.routes.js`
- `backend/src/middleware/rbac.middleware.test.js`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/scripts/check-evidence-profile-dashboard-contracts.mjs`
- `scripts/normalization/canonical-document-index-dashboard.postgres.test.js`
- `scripts/normalization/company-profile-applicability-dashboard.postgres.test.js`
- continuity docs for this package

## Validation Executed

- `node scripts/normalization/canonical-document-index-dashboard.postgres.test.js` -> PASS with isolated PostgreSQL; sandbox initdb needed approved local execution because shm is blocked in sandbox.
- `PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_semantic_evidence_endpoint.py` -> PASS.
- `node scripts/normalization/company-profile-applicability-dashboard.postgres.test.js` -> PASS with isolated PostgreSQL; same sandbox shm note.
- `node frontend/scripts/check-evidence-profile-dashboard-contracts.mjs` -> PASS.
- `node backend/src/services/llmTraceContext.service.test.js` -> `LLM_TRACE_CONTEXT_TESTS=PASS`.
- `node backend/src/middleware/rbac.middleware.test.js` -> RBAC imports verified.
- `PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py` -> 12 tests OK.
- `npm --prefix frontend run typecheck` -> PASS.
- Node syntax for touched backend/services/routes/scripts -> PASS.
- `PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache python3 -m py_compile ...` for touched AI files -> PASS.
- `git diff --check` -> PASS before doc closeout; rerun after docs required.

## Gates

PASS: no schema changes, no migrations added, no legacy document table dependency, no legacy control fallback, no product hardcodes, manual upload canonical document index, semantic evidence productive contract, target whitelist, human governance, control/NC/finding association, bidirectional associations, tenant B read denial, cross-tenant target denial, company-profile AI UI contract, company-profile actor traceability, applicability rebuild canonical/idempotent/no-legacy/multitenant/dashboard propagation, dashboard existing-universe-only, no absence-as-zero, Health optional, honest risk empty state, optional standard excluded, operational legends, LLM actor human/process propagation, anti-spoofing, system/company trace, multi-tenant company isolation, RBAC preserved, `git diff --check`.

## Backlog Residual Real

No known implementation debt remains in the local package scope. Runtime/browser validation remains postdeploy because Codex did not deploy or operate authenticated production sessions.

## Postdeploy Pending

- `POSTDEPLOY_UI_EVIDENCE_ANALYSIS`
- `POSTDEPLOY_UI_ASSOCIATIONS`
- `POSTDEPLOY_UI_COMPANY_PROFILE_AI`
- `POSTDEPLOY_UI_APPLICABILITY_REBUILD`
- `POSTDEPLOY_UI_DASHBOARD`
- `POSTDEPLOY_LLM_TRACE_USERS`
- `POSTDEPLOY_RUNTIME_5XX_SQL_LOG_CHECK`
- `POSTDEPLOY_RUNTIME_VALIDATION_REQUIRED`

## Next Exact Action

Human review of the uncommitted diff, then owner-managed commit/push/CI/deploy and authorized runtime UI/trace validation.
