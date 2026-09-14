# Handoff — AI Guided Canonical Knowledge Migration

Fecha: 2026-09-14
Owner funcional: CODEX B — AI / Knowledge / RAG / Regulatory
Branch: `main`
Base SHA: `f3918f13a5e2e605aa32a58db4d1452d9db279d9`
Head/commit SHA: `UNCOMMITTED_WORKTREE`
Validation mode: `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`
Status: `AI_GUIDED_CANONICAL_KNOWLEDGE_REVIEW_READY`

## Causa raíz

Después del cierre de vistas/grants canónicos, `/api/ai/suggest/finding-analysis` y `/api/ai/suggest/action-plan` aún atravesaban dependencias profundas al modelo experto legacy de `ai_core.*`. La falla observada en QA era:

- `relation "ai_core.problem_types" does not exist`
- `relation "ai_core.domain_problem_type_map" does not exist`

La causa no era falta de tablas, sino que Guided AI conservaba el modelo viejo como source of truth operacional.

## Inventario legacy y mapping

| Runtime anterior | Archivo | Decisión | Reemplazo |
|---|---|---|---|
| `ai_core.problem_types` | `context_builder.py`, `ai_core_db.py` | reemplazar | `public.knowledge_items`, `knowledge_mappings`, deterministic classifier |
| `ai_core.solution_playbooks` | `context_builder.py` | reemplazar | `public.knowledge_recommended_actions` |
| `ai_core.evidence_expectations` | `context_builder.py` | reemplazar | `public.knowledge_evidence_expectations`, `public.iso_evidence_expectations`, tenant evidence requirements |
| `ai_core.closure_criteria` | `context_builder.py` | eliminar/reemplazar parcial | `knowledge_audit_questions`, `knowledge_rules`; sin inventar cierre |
| `ai_core.priority_rules`, `invalid_evidence_patterns`, `response_templates` | `context_builder.get_ai_core_summary()` | eliminar | summary de contratos canónicos |
| `ai_core.domain_problem_type_map` | `domain_knowledge.py` | reemplazar | deterministic mapping + `knowledge_mappings`/`knowledge_items.domain` |
| `ai_core.domains_catalog` | `domain_knowledge.py` | reemplazar | domain string canónico de `knowledge_items`/`knowledge_mappings` |
| `ai_core.standard_domain_map` | `domain_knowledge.py` | reemplazar | `knowledge_mappings.standard_code/domain` |
| `ai_core.domain_solution_playbooks` | `domain_knowledge.py` | reemplazar | `knowledge_recommended_actions` |
| `ai_core.domain_evidence_expectations` | `domain_knowledge.py` | reemplazar | `knowledge_evidence_expectations` |
| `ai_core.domain_closure_criteria` | `domain_knowledge.py` | eliminar/reemplazar parcial | `knowledge_audit_questions`, `knowledge_rules` |
| `ai_core.standard_specific_overrides` | `domain_knowledge.py` | eliminar | no override paralelo; canonical knowledge/provenance |
| `ai_core.v_finding_scenarios_active` | `finding_scenario_detector.py` | reemplazar/eliminar hot path legacy | scenario-compatible assembly from canonical gaps/actions/evidence |
| `ai_core.v_ai_useful_feedback_cases` | `supervised_feedback_cases.py` | reemplazar/degradar opcional | `recommendation_decision_ledger` when available; zero cases with availability when absent |
| `ai_core.trusted_external_sources` | `external_lookup_service.py` | reemplazar | `public.knowledge_sources` metadata/use_in_system |

Runtime legacy remaining in hot path: `0`.

Conservado porque sí existe en schema canónico:

- `ai_core.v_tenant_health_context`
- `ai_core.v_control_context`
- `ai_core.v_finding_context`
- `ai_core.v_kpi_context`
- `ai_core.external_lookup_quotas`
- `ai_core.external_lookup_logs`
- `ai_core.external_lookup_quota_audit`
- `ai_core.external_lookup_extra_charges`
- `ai_core.v_external_lookup_usage_monthly`

## Decisiones de arquitectura

- Se agregó `ai-engine/app/services/canonical_knowledge_service.py` como capa semántica explícita sobre `public.knowledge_*`, `public.iso_evidence_expectations`, `public.tenant_applicable_evidence_requirements`, `public.knowledge_sources` y `public.recommendation_decision_ledger`.
- No se recrearon tablas, vistas de compatibilidad, aliases SQL ni estructuras legacy.
- `get_problem_knowledge()` y `get_domain_knowledge()` preservan shape compatible para consumidores, pero sus datos/provenance salen de canonical knowledge.
- Finding scenarios no re-materializa el modelo legacy; se ensambla opcionalmente desde `knowledge_common_gaps`, `knowledge_recommended_actions`, `knowledge_evidence_expectations` y `knowledge_audit_questions`.
- Feedback supervisado es opcional: si no hay ledger o tenant_id, retorna cero casos con `availability`, no 500.
- Ausencia de knowledge exacto retorna listas vacías/provenance y el Guided AI mantiene `can_auto_close=false`.

## Revisión independiente de continuidad

La cuenta de continuidad revisó el diff heredado antes de mantener el estado READY y aplicó correcciones adicionales:

- `recommendation_decision_ledger` se trata como evidencia de decisión, no de utilidad ni efectividad. `accepted` y `modified` quedan como unknown para `was_useful`/`was_applied`/`was_corrected` salvo metadata explícita; `executed` sólo marca aplicación, no utilidad. La efectividad sigue perteneciendo a `recommendation_effectiveness_evaluations`.
- Domain knowledge ya no convierte `match_count` o presencia de items en `relevance_level='alta'`; el campo queda conservador (`None`) con `relevance_basis`.
- Finding scenario canonical no agrega `confidence_boost` artificial.
- External lookup ya no trata una fuente como trusted sólo por estar activa, aparecer en knowledge o tener `use_in_system`; requiere trust metadata explícita y `allowed_domains`.
- La consulta opcional al ledger inspecciona columnas del schema para degradar seguro entre baseline fresco (`decided_at`) y migración histórica (`decision_at`) sin 500.
- External lookup quota usage elimina el sentinel UUID cero cuando falta tenant; la consulta usa condición explícita de tenant presente y conserva degradación a uso 0 sin hardcodear tenant/UUID.

## Archivos modificados

- `ai-engine/app/services/canonical_knowledge_service.py`
- `ai-engine/app/services/context_builder.py`
- `ai-engine/app/services/domain_knowledge.py`
- `ai-engine/app/services/finding_scenario_detector.py`
- `ai-engine/app/services/supervised_feedback_cases.py`
- `ai-engine/app/services/external_lookup_service.py`
- `ai-engine/app/services/ai_core_db.py`
- `ai-engine/app/scripts/qa/check_ai_core_coverage.py`
- `ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py`
- `scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/REGRESSION_COMMANDS.md`
- `docs/codex/handoffs/AI-GUIDED-CANONICAL-KNOWLEDGE-MIGRATION.md`

## Diff stat

Pre-doc code stat for tracked files:

```text
7 files changed, 453 insertions(+), 617 deletions(-)
```

New files:

```text
636 ai-engine/app/services/canonical_knowledge_service.py
293 ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py
227 scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js
```

## Tests

PASS rerun by continuity account:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache python3 -m py_compile ai-engine/app/services/canonical_knowledge_service.py ai-engine/app/services/context_builder.py ai-engine/app/services/domain_knowledge.py ai-engine/app/services/finding_scenario_detector.py ai-engine/app/services/supervised_feedback_cases.py ai-engine/app/services/external_lookup_service.py ai-engine/app/services/ai_core_db.py ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py ai-engine/app/routes/ai.py
PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_ai_guided_canonical_knowledge.py
PYTHONPYCACHEPREFIX=/private/tmp/tcdx-ai-pycache PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py
node scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js
grep -RniE 'ai_core\.(closure_criteria|domain_closure_criteria|domain_evidence_expectations|domain_problem_type_map|domain_solution_playbooks|domains_catalog|evidence_expectations|invalid_evidence_patterns|priority_rules|problem_types|response_templates|solution_playbooks|standard_domain_map|standard_specific_overrides|standards_catalog|trusted_external_sources|v_ai_useful_feedback_cases|v_finding_scenarios_active)' ai-engine/app/services ai-engine/app/routes --exclude-dir='__pycache__' || true
git diff --check
```

Notes:

- `test_ai_guided_canonical_knowledge.py`: 6 tests OK, including no false usefulness/effectiveness from ledger and explicit external source trust guard.
- DGX hardening regression: 11 tests OK; only existing Pydantic v2 deprecation warnings.
- PostgreSQL isolated test first failed in sandbox due `shmget Operation not permitted`; rerun with approved prefix `node scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js` passed using Docker localhost-only.

## Evidencia PostgreSQL

`scripts/normalization/ai-guided-canonical-knowledge.postgres.test.js`:

- starts isolated PostgreSQL from baseline `database/baseline/production_schema_v1.sql`;
- loads `production_seed_v1.sql`;
- applies forward migration `20260910_tcdx_commercial_runtime_integral_closeout.sql` for tenant evidence requirements;
- inserts canonical knowledge fixtures only;
- asserts legacy AI Core objects present = 0;
- runs Python `generate_guided_solution()` against the isolated DB;
- verifies `AI_GUIDED_CANONICAL_KNOWLEDGE_POSTGRES PASS`.

Output markers:

```text
AI_GUIDED_CANONICAL_KNOWLEDGE_POSTGRES PASS
MULTITENANT_ISOLATION PASS tenant_b_not_serialized=1
EMPTY_KNOWLEDGE_DEGRADATION PASS
LEGACY_AI_CORE_OBJECTS_PRESENT=0
```

## Evidencia multi-tenant

- Tenant A and Tenant B fixtures are inserted.
- Python engine runs for Tenant A.
- Test fails if Tenant B UUID, finding title, or control title appears in Tenant A serialized response.
- `tenant_applicable_evidence_requirements` fixture is filtered by Tenant A only.

## Evidencia knowledge vacío

- Python unit and isolated PostgreSQL tests run a problem type without exact knowledge.
- Result remains `ok=true`.
- `solution.can_auto_close=false`.
- No zero-as-compliance, no closure, no cross-tenant fallback.

## Gate legacy

Exact runtime grep returned zero lines:

```bash
grep -RniE 'ai_core\.(closure_criteria|domain_closure_criteria|domain_evidence_expectations|domain_problem_type_map|domain_solution_playbooks|domains_catalog|evidence_expectations|invalid_evidence_patterns|priority_rules|problem_types|response_templates|solution_playbooks|standard_domain_map|standard_specific_overrides|standards_catalog|trusted_external_sources|v_ai_useful_feedback_cases|v_finding_scenarios_active)' ai-engine/app/services ai-engine/app/routes --exclude-dir='__pycache__' || true
```

## Permisos

No se agregaron grants ni migraciones de permisos. Baseline already grants runtime read access to `knowledge_sources`, `knowledge_items` and reference ISO tables. The commercial runtime migration covers `tenant_applicable_evidence_requirements`.

If postdeploy reports privilege failure on a specific canonical child table (`knowledge_common_gaps`, `knowledge_recommended_actions`, `knowledge_evidence_expectations`, `knowledge_rules`, `knowledge_rule_hints`, `knowledge_audit_questions`, `knowledge_mappings`), add only exact `SELECT` on that object to the runtime role through a forward migration. Do not grant `ALL`, `ON ALL TABLES`, or direct login grants.

## Riesgos / backlog

- Postdeploy must exercise real `/api/ai/suggest/finding-analysis` and `/api/ai/suggest/action-plan` through backend auth/RBAC/commercial gates.
- `recommendation_decision_ledger` metadata may not yet contain old feedback dimensions; supervised feedback remains optional/unknown unless explicit metadata or future effectiveness evaluation mapping is present.
- External lookup source filtering now requires `knowledge_sources.metadata` explicit trust plus `allowed_domains`; product curation may need to add those fields to sources intended for external lookup.
- Runtime privilege failures on canonical child KB tables must be solved only by exact forward grants after human review; no broad grants.

## Comandos manuales posteriores

Human-authorized runtime only:

```bash
POST /api/ai/suggest/finding-analysis
POST /api/ai/suggest/action-plan
```

Verify no 500 from missing legacy relations and no tenant leakage in serialized response.

## Do not rediscover

- Do not recreate legacy AI Core expert tables or compatibility views.
- Do not convert missing knowledge/feedback/scenario into zero, closure, compliance, effectiveness or absence of evidence.
- Do not infer high domain relevance from canonical match counts.
- Do not infer usefulness/effectiveness from accepted/modified/executed ledger decisions.
- Do not treat active/use_in_system knowledge sources as trusted without explicit trust metadata and allowed domains.
- Do not reopen canonical AI context view work unless new objective evidence appears.
- Do not call real DGX for this work package unless explicitly requested.

## Estado final

`AI_GUIDED_CANONICAL_KNOWLEDGE_REVIEW_READY`
