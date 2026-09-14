# AI-GUIDED-CANONICAL-KNOWLEDGE-RUNTIME-GRANTS

Status: `AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_READY`

Owner: CODEX A+B / `codex`

Branch: `main`

Base HEAD: `f3918f13a5e2e605aa32a58db4d1452d9db279d9`

Commit: `UNCOMMITTED_WORKTREE`

Date: 2026-09-14

## Objective

Close the ACL gap introduced by `AI_GUIDED_CANONICAL_KNOWLEDGE_REVIEW_READY` without recreating legacy `ai_core` expert objects, without broad grants, and without direct grants to the backend login role.

## Root Cause

The new AI Guided canonical knowledge adapter reads KB v2/reference knowledge directly from `public.knowledge_*`, `public.iso_evidence_expectations`, tenant evidence requirements and the optional recommendation decision ledger. QA already had runtime `SELECT` for:

- `public.iso_evidence_expectations`
- `public.knowledge_items`
- `public.knowledge_sources`
- `public.recommendation_decision_ledger`
- `public.tenant_applicable_evidence_requirements`

QA did not have runtime `SELECT` for the seven child/reference tables needed by the new guided knowledge service:

- `public.knowledge_audit_questions`
- `public.knowledge_common_gaps`
- `public.knowledge_evidence_expectations`
- `public.knowledge_mappings`
- `public.knowledge_recommended_actions`
- `public.knowledge_rule_hints`
- `public.knowledge_rules`

## Implemented Files

- `database/migrations/20260914_ai_guided_canonical_knowledge_runtime_grants.sql`
- `scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js`
- `scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.test.js`
- `scripts/deploy-vms.sh`
- `scripts/deploy-vms-strategy.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/REGRESSION_COMMANDS.md`

## Final ACL Contract

The migration grants exactly these seven privileges:

```sql
GRANT SELECT ON public.knowledge_audit_questions TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_common_gaps TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_evidence_expectations TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_mappings TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_recommended_actions TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_rule_hints TO tcdx_backend_runtime;
GRANT SELECT ON public.knowledge_rules TO tcdx_backend_runtime;
```

Role contract:

- `tcdx_backend_runtime` remains `NOLOGIN`.
- `tcdx_backend_app` remains `LOGIN INHERIT`.
- `tcdx_backend_app` is a member of `tcdx_backend_runtime`.
- `tcdx_backend_app` receives no direct grants on these seven relations.
- `ai_reader` receives no grants on these seven relations.
- Runtime receives no DML (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) on these seven relations.
- No `GRANT ALL`, no `ON ALL TABLES IN SCHEMA`, no schema ownership or role changes, and no legacy `ai_core` objects.

## Allowlist And Gate Decision

The runner keeps a fail-closed unexpected `public` SELECT gate, but it is not a hand-maintained narrow list. It derives authorized runtime `public` SELECT relations from the versioned fresh-deploy contract files plus this migration:

- `database/baseline/production_schema_v1.sql`
- fresh forward runtime contract runners registered before this package
- `20260914_ai_core_runtime_context_view_grants.sql`
- `20260914_ai_guided_canonical_knowledge_runtime_grants.sql`

Review correction: the first parser version could scan across semicolon boundaries when a non-runtime grant was followed by a later runtime grant. That could omit legitimate relations such as `public.iso_evidence_expectations`. The parser now parses one SQL statement at a time and supports:

- `GRANT SELECT ON table TO ...`
- `GRANT SELECT ON table1, table2 TO ...`
- `GRANT SELECT, INSERT, UPDATE ON ...`
- schema-qualified and unqualified objects
- `TABLE`, `VIEW` and `MATERIALIZED VIEW`
- multiline object lists
- schema/function/sequence/type/database grants ignored for relation allowlisting

The PostgreSQL test proves the gate against the fresh runner sequence, and the negative probe creates an unauthorized `public` relation grant to verify fail-closed behavior.

## Idempotence Policy

Pre-apply is convergent/idempotent for the target seven `SELECT` grants. A partially applied or manually converged safe environment is allowed when:

- role/membership/INHERIT/NOLOGIN contract is intact;
- `ai_reader` has zero target SELECT;
- runtime has zero target DML;
- `tcdx_backend_app` has zero direct target SELECT;
- unexpected runtime `public` SELECT count is zero.

Apply then runs the exact migration and validates full postconditions. Reapply returns `AI_GUIDED_CANONICAL_KNOWLEDGE_RUNTIME_GRANTS_ALREADY_APPLIED`. A checksum mismatch in `schema_migrations` fails closed.

## Deploy Registry

`scripts/deploy-vms.sh` fresh strategy now includes:

```text
AI Guided canonical knowledge runtime grants|scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js
```

It runs after `AI Core runtime context grants`. `scripts/deploy-vms-strategy.test.js` asserts the runner remains registered.

## Validation

Executed locally:

- `node --check scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js` PASS
- `node --check scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.test.js` PASS
- `bash -n scripts/deploy-vms.sh` PASS
- `node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --checksum` PASS: `3a30ef77a13f77dca2366542d1209f1e873280ac1222667b4316d9b8a6a70206`
- `node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.test.js` PASS
- `node scripts/deploy-vms-strategy.test.js` PASS
- `node scripts/normalization/db-n05-production-role-privileges.postgres.test.js` PASS
- `PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py` PASS, 6 tests
- `PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py` PASS, 11 tests with existing Pydantic deprecation warnings
- `node scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js` PASS
- legacy AI Core runtime grep PASS, zero matches
- semantic no-invention grep PASS, zero matches
- unsafe ACL grep reviewed PASS: matches were `ai_reader` validation/assertion strings and test membership setup only
- `git diff --check` PASS

PostgreSQL isolated evidence:

- ACL test used local isolated PostgreSQL Docker image `sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`.
- Fresh setup runners included fresh runtime closeout, Release RBAC, commercial runtime, fresh dependency, control lifecycle, post-lifecycle, and AI Core runtime context grants.
- Partial pregrant convergence PASS with `runtime_select_count=1` before apply.
- `tcdx_backend_app` inherited SELECT execution PASS under `SET ROLE`.
- DML count remained `0`.
- `ai_reader` SELECT count remained `0`.
- Direct app SELECT count remained `0`.
- Negative unexpected public SELECT probe rejected PASS.
- Reapply idempotence PASS.
- Checksum mismatch rejected PASS.

## Manual Postdeploy Commands

Run only after human review, commit/push/CI/deploy authorization, and with an authorized DB URL on the intended environment:

```bash
MIGRATION_DATABASE_URL="$DATABASE_URL" \
node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --preflight

MIGRATION_DATABASE_URL="$DATABASE_URL" \
node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --apply

MIGRATION_DATABASE_URL="$DATABASE_URL" \
node scripts/normalization/apply-ai-guided-canonical-knowledge-runtime-grants.js --preflight
```

Optional endpoint validation remains manual/authorized with the AI Guided Canonical Knowledge handoff.

## Risks And Backlog

- This is local/isolated validation, not production runtime validation.
- Real QA/production apply was not executed by Codex.
- The unexpected `public` SELECT gate depends on fresh-deploy versioned SQL; if a future fresh runner adds a legitimate public runtime SELECT, it must be included in `RUNTIME_PUBLIC_SELECT_CONTRACT_FILES` or this gate will fail closed.
- Full CI, push, PR, merge and deploy remain owner/manual by project rule.

## Do Not Rediscover

- Do not recreate removed legacy `ai_core` expert tables/views.
- Do not grant `ai_reader`.
- Do not grant directly to `tcdx_backend_app`.
- Do not replace inherited runtime access with login-role access.
- Do not convert no-data/insufficient/missing knowledge into zero/compliance/closure.
- Do not rerun broad CI or production deploy from Codex.
