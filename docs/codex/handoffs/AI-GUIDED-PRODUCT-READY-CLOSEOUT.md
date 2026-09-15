# AI Guided Product-Ready Closeout

Date: 2026-09-14  
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`  
Branch: `main`  
Initial HEAD: `01aed2cd2581`  
Status: `AI_GUIDED_PRODUCT_READY_REVIEW`

## Scope

Closed locally for:

- `POST /api/ai/suggest/finding-analysis`
- `POST /api/ai/suggest/action-plan`

No commit, push, merge, deploy, `.env` edit, QA/production DB write, manual grant, QA tenant data change or runtime validation was executed by Codex.

## Root Cause

The inherited runtime HTTP symptom was already recovered, but the guided output was not product-ready:

- The two endpoints still executed `_safe_legacy_call()` and could surface `legacy_error`, `legacy_source`, `legacy_knowledge_sources`, `legacy_knowledge_context` or `deterministic_legacy_guided`.
- Canonical KB lookup could return no useful problem knowledge for supported runtime problem types such as `access_review_missing` and `missing_evidence`.
- `domain_code + standard_code` absence of mapping was treated as non-applicability instead of unknown.
- Closed findings could remain inside `recent_findings` without clear separation from active gap signals.
- DGX/LiteLLM hardening existed, but the guided endpoint path did not use it for structured enrichment.

## Final Architecture

```text
Request
-> tenant authorization / tenant scope
-> problem classification
-> domain inference
-> canonical tenant context
-> canonical knowledge retrieval
-> canonical evidence / recommendations / constraints
-> structured deterministic solution facts
-> DGX/LiteLLM enrichment when available
-> structural validation / guardrails
-> response
```

Fallback:

```text
DGX unavailable, invalid JSON, timeout or exception
-> deterministic guided response
-> explicit fallback trace
```

The productive path does not call `ai-engine/knowledge_client.py` or backend internal-search legacy routes for these two endpoints.

## Legacy Removed From Active Endpoint Path

Files:

- `ai-engine/app/services/guided_endpoint_adapter.py`
- `ai-engine/app/routes/ai.py`

Changes:

- `generate_finding_analysis()` no longer calls `_safe_legacy_call()`.
- `generate_action_plan()` no longer calls `_safe_legacy_call()`.
- Response `source` is now `ai-engine-guided-canonical-v1`.
- Route defaults no longer use `deterministic_legacy_guided`.
- Endpoint contract tests patch `_safe_legacy_call` to raise; both endpoints still return valid responses.

`_safe_legacy_call()` remains only for other compatibility endpoints that were not in this scope.

## Canonical Knowledge Base

New forward-only migration:

- `database/migrations/20260914_ai_guided_product_ready_knowledge_catalog.sql`

New runner:

- `scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js`

The catalog uses existing `public.knowledge_*` tables only:

- `knowledge_sources`
- `knowledge_items`
- `knowledge_mappings`
- `knowledge_common_gaps`
- `knowledge_recommended_actions`
- `knowledge_evidence_expectations`
- `knowledge_audit_questions`
- `knowledge_rules`
- `knowledge_rule_hints`

Source:

- `source_key='tecdx_ai_guided_problem_catalog_v1'`
- `license_class='derived_summary'`
- `official_standard_text=false`
- `tenant_specific=false`

No official ISO text is embedded, no tenant IDs are used, no QA-specific data is inserted, and no closure criteria are invented.

## Runtime Problem Type Catalog

The runtime catalog covers the union observed in `PROBLEM_KEYWORDS`, `PROBLEM_DOMAIN_DEFAULTS`, forced intent/domain helpers and guided consumers:

| problem_type_code | default_domain | standard | KB coverage |
|---|---|---|---|
| `access_review_missing` | `access_management` | `ISO27001` | item, mapping, gap, action, evidence, question, rule, hint |
| `backup_restore_test_missing` | `backup_restore` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `kpi_deteriorated` | `kpi_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `kpi_without_source` | `kpi_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `risk_without_treatment` | `risk_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `high_residual_risk` | `risk_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `asset_without_owner` | `asset_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `supplier_without_evaluation` | `supplier_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `training_without_record` | `training_competence` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `management_review_gap` | `management_review` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `document_obsolete` | `document_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `procedure_missing` | `document_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `procedure_not_implemented` | `operational_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `control_not_executed` | `operational_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `finding_open` | `internal_audit` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `finding_recurrent` | `continuous_improvement` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `nonconformity_open` | `nonconformity_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `action_overdue` | `corrective_actions` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `action_without_evidence` | `corrective_actions` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `missing_evidence` | `evidence_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `weak_evidence` | `evidence_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `expired_evidence` | `evidence_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `invalid_evidence` | `evidence_management` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `control_without_owner` | `operational_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |
| `control_overdue_review` | `operational_control` | generic | item, mapping, gap, action, evidence, question, rule, hint |

Contract cases:

- `access_review_missing + access_management + ISO27001`: covered by real canonical catalog rows.
- `missing_evidence`: covered by real canonical catalog rows.

## Semantic Corrections

Domain applicability:

- New `canonical_domain_standard_applicability()` returns `state='true'` only with explicit canonical mapping.
- Missing domain/standard mapping returns `state='unknown'` and `applies_to_standard=null`, never `false`.
- Domain scoring no longer penalizes unknown as if it were known false.

Finding lifecycle:

- `get_finding_context()` annotates each row with `finding_lifecycle` and `active_gap_signal`.
- `build_context_pack()` exposes `open_findings`, `closed_findings` and `recent_findings`.
- `classify_problem()` uses open findings for active gap signal. Closed findings remain historical context only.

Knowledge behavior:

- Missing knowledge remains insufficiency, not zero/compliance/effectiveness.
- Ledger `accepted`/`modified`/`executed` is not usefulness or effectiveness proof.
- No closure criteria are synthesized when canonical closure data is absent.

## DGX/LiteLLM

New module:

- `ai-engine/app/services/guided_llm_enrichment.py`

It uses:

- `app.services.llm_client.get_llm_metadata()`
- `app.services.llm_client.is_llm_available()`
- `app.services.llm_client.call_llm_json()`

The LLM receives structured facts:

- `problem`
- `domain`
- `context`
- `knowledge`
- `constraints`
- `deterministic_solution`

Prompt guardrails:

- Spanish JSON only.
- Use only supplied facts.
- Do not invent evidence, compliance, closure, Health, KPI, effectiveness, human decision, severity, dates, owners, standards or cross-tenant data.
- Do not auto-close.
- Output is recommendation, not operational fact.

Structural validation rejects `can_auto_close=true` and falls back on invalid/unavailable/exception paths.

## Trace Contract

The final response trace/engine exposes:

- `ai_engine_used`
- `canonical_context_used`
- `canonical_knowledge_used`
- `canonical_knowledge_match_count`
- `canonical_knowledge_sources`
- `llm_available`
- `llm_used`
- `llm_provider`
- `selected_model`
- `model_mode`
- `fallback_used`
- `fallback_reason`
- `tenant_filter_enforced`
- `used_web`
- `used_rag`
- `used_company_profile`

No legacy trace fields are part of the two endpoint contracts.

## RBAC / ACL

No new runtime grants were added. The closeout relies on the existing explicit `tcdx_backend_runtime` SELECT grants for canonical context views and `public.knowledge_*` relations. `tcdx_backend_app` continues to inherit through role membership. No direct app grant, `ai_reader` grant, DML grant, schema-wide grant or `GRANT ALL` was introduced.

## Deploy Integration

`scripts/deploy-vms.sh` fresh-baseline registry now includes:

```text
AI Guided product-ready knowledge catalog|scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js
```

The registry test requires this runner in `FRESH_PRODUCTION_MIGRATION_RUNNERS`. Historical migration strategy remains separate.

## Local Validation

## Final Four-FAIL Closure — 2026-09-15

Focal review closed the remaining local FAILs:

- `RUNNER PREFLIGHT READ-ONLY`: `scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js` now has strict `--checksum`, `--preflight`, `--apply` interface. `--checksum` validates SQL and prints checksum without DB connection. `--preflight` connects read-only to inspect canonical table presence, ledger state, checksum and business counts; it does not create `schema_migrations`, insert/update ledger rows, mutate catalog data or execute migration SQL. `--apply` is the only write path and preserves advisory lock/checksum/idempotent ledger behavior.
- `LLM FACTUAL FAIL-CLOSED`: `guided_llm_enrichment.py` now treats DGX/LiteLLM as narrative-only enrichment. It preserves deterministic facts for priority, problem, classification, domain, standard applicability, tenant scope, Health/KPI, evidence, closure, owner roles, target days, success/effectiveness/human-decision state and action-plan structure. Attempts to invent or mutate governed facts return explicit deterministic fallback.
- `MATCH COUNT TRACEABILITY`: `canonical_knowledge_service.py` loads real `knowledge_mappings` and emits `trace_counts`; `solution_engine.py` deduplicates base/domain bundle results; `guided_endpoint_adapter.py` publishes `canonical_knowledge_match_count` as unique matched `knowledge_items` and separate mapping/action/evidence/gap/audit-question/rule counts.
- `LEGACY PUBLIC RESPONSE CLEANUP`: `finding-analysis` and `action-plan` now carry `public_contract=ai_guided_product_ready_v1`, recursively strip scoped legacy public fields, never use the old deterministic model name, and keep legacy compatibility only for old endpoint sources outside this contract.

Final isolated PostgreSQL validation now covers runner `--checksum`, preflight no-write snapshot, first apply, idempotent reapply, checksum mismatch fail-closed, 25 problem types, `access_review_missing`, `missing_evidence`, no legacy AI Core expert objects, Tenant A/B isolation, closed finding history semantics and unknown applicability semantics.

Final mock validation now covers DGX success plus failures/unavailable/invalid contract, and adversarial model attempts for auto-close, priority mutation, invented owner role, invented target days, invented evidence, invented KPI, invented Health, invented standard applicability, extra action-plan step and compliance-achieved claims.

Passed locally:

```bash
python3 -m py_compile ai-engine/app/services/*.py ai-engine/app/routes/ai.py
PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py
PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py
node scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js --checksum
node scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js
node scripts/deploy-vms-strategy.test.js
bash -n scripts/deploy-vms.sh
git diff --check
```

Static gates passed:

```bash
grep -RniE 'ai_core\.(closure_criteria|domain_closure_criteria|domain_evidence_expectations|domain_problem_type_map|domain_solution_playbooks|domains_catalog|evidence_expectations|invalid_evidence_patterns|priority_rules|problem_types|response_templates|solution_playbooks|standard_domain_map|standard_specific_overrides|standards_catalog|trusted_external_sources|v_ai_useful_feedback_cases|v_finding_scenarios_active)' ai-engine/app/services ai-engine/app/routes --exclude-dir='__pycache__' || true
grep -RniE 'deterministic_legacy_guided' ai-engine/app/services/guided_endpoint_adapter.py ai-engine/app/routes/ai.py ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py ai-engine/app/scripts/test_dgx_litellm_hardening.py || true
grep -RniE 'was_useful.*True|was_corrected.*True|effectiveness\s*=\s*true|missing\s*=\s*0|can_auto_close.*True' ai-engine/app/services ai-engine/app/routes --exclude-dir='__pycache__' || true
```

Observed outputs: zero matches.

PostgreSQL isolated evidence:

- Fresh baseline + production seed loaded.
- Catalog migration applied.
- Catalog migration replay was idempotent.
- Tenant A generated useful canonical recommendations and evidence expectations.
- Tenant B sentinel did not serialize.
- `access_review_missing` coverage PASS.
- `missing_evidence` coverage PASS.
- Unknown problem degraded safely and did not auto-close.
- `LEGACY_AI_CORE_OBJECTS_PRESENT=0`.

## Manual Post-Review Commands

Apply catalog in an authorized DB context only:

```bash
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js --preflight
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js --apply
MIGRATION_DATABASE_URL="$DATABASE_URL" node scripts/normalization/apply-ai-guided-product-ready-knowledge-catalog.js --preflight
```

Then owner deploys through the official fresh strategy:

```bash
TCDX_DB_DEPLOY_STRATEGY=fresh-baseline ./scripts/deploy-vms.sh
```

Manual QA runtime validation should call both endpoints and verify:

- HTTP 200.
- No `legacy_*` fields.
- `canonical_context_used=true`.
- `canonical_knowledge_used=true` for seeded supported cases.
- `tenant_filter_enforced=true`.
- `llm_used=true` and `fallback_used=false` when DGX is available.
- `llm_used=false` and explicit `fallback_reason` when DGX is unavailable.
- `recommended_actions` and `expected_deliverables` non-empty for `access_review_missing` and `missing_evidence`.
- `can_auto_close=false`.

## Residual Backlog

- Runtime deploy and QA endpoint proof remain manual by owner.
- Full CI/full regression was not executed by Codex per `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`.
- Compatibility endpoints outside `finding-analysis` and `action-plan` still may use `_safe_legacy_call()` and were intentionally outside this closeout.

## Closeout Gate

Local status:

- `AI_GUIDED_CANONICAL_CONTEXT = PASS`
- `AI_GUIDED_CANONICAL_KNOWLEDGE_CODE = PASS`
- `AI_GUIDED_CANONICAL_KNOWLEDGE_DATA = PASS`
- `AI_GUIDED_LEGACY_RUNTIME_DEPENDENCY = REMOVED` for the two scoped endpoints
- `AI_GUIDED_DGX_ENRICHMENT = PASS` by mock + hardening regression
- `AI_GUIDED_DETERMINISTIC_FALLBACK = PASS`
- `AI_GUIDED_MULTI_TENANT = PASS` isolated
- `AI_GUIDED_NO_AUTO_CLOSE = PASS`
- `AI_GUIDED_NO_INVENTED_FACTS = PASS` by guardrail tests/static contract
- `AI_GUIDED_RBAC = PASS` no ACL expansion required
- `AI_GUIDED_FRESH_DEPLOY = PASS` registry/test
- `AI_GUIDED_TEST_SUITE = PASS`
- `AI_GUIDED_CONTINUITY_DOCS = PASS`

Not executed by Codex:

- `AI_GUIDED_HTTP` against deployed QA runtime.

Final marker:

```text
AI_GUIDED_PRODUCT_READY_FINAL_REVIEW
```
