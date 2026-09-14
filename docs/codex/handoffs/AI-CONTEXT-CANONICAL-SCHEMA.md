# Handoff — AI Context Canonical Schema

Fecha: 2026-09-14
Owner funcional: CODEX B — AI / Knowledge / RAG / Regulatory
Branch: `main`
Head/commit SHA: `UNCOMMITTED_WORKTREE`
Validation mode: `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`
Status: `AI_CONTEXT_CANONICAL_SCHEMA_READY`

## Scope

Correccion focal del `ai-engine` para que `app/services/context_builder.py` consuma las vistas canonicas actuales de `tcdx_saasv2`/fresh baseline sin reintroducir columnas, aliases, vistas ni fallbacks legacy.

No se hizo commit, push, merge, deploy, cambio de secretos, lectura de `.env`, escritura a DB real ni llamada obligatoria a DGX real.

## Root Cause

`context_builder.py` esperaba un contrato antiguo:

- `ai_core.v_tenant_health_context` con `tenant_name`, `standard_code`, agregados de controles/evidencia/hallazgos/acciones y `healthy_percentage`.
- `ai_core.v_control_context` con campos enriquecidos legacy como control description/category, score, Health, responsables, fechas, prioridad, aplicabilidad y conteos.
- `ai_core.v_finding_context` y `ai_core.v_kpi_context` tambien se consultaban con columnas mas amplias que el contrato canonico publicado.

La BD canonica actual expone vistas mas angostas:

- `ai_core.v_tenant_health_context`: `tenant_id`, `metric_code`, `numeric_value`, `publication_state`, `coverage`, `effective_at`.
- `ai_core.v_control_context`: `tenant_id`, `tenant_control_id`, `catalog_control_id`, `code`, `title`, `standard_code`, `implementation_status`.
- `ai_core.v_finding_context`: `tenant_id`, `finding_id`, `tenant_control_id`, `title`, `severity`, `status`, `created_at`.
- `ai_core.v_kpi_context`: metric snapshots publicados con `tenant_id`, `metric_code`, `numeric_value`, `publication_state`, `coverage`, `effective_at`.

El 500 en `/api/ai/suggest/finding-analysis` y `/api/ai/suggest/action-plan` venia de schema drift del consumidor: la query a `ai_core.v_tenant_health_context` fallaba en runtime con `column "tenant_name" does not exist` antes de construir el contexto guiado.

## Decision

La BD canonica es la autoridad. No se agrega `tenant_name`, no se recrean agregados legacy, no se crean vistas duplicadas y no hay migracion.

La aplicacion consume las columnas publicadas y hace transformaciones semanticas locales, explicitas y trazables:

- Health/KPI context se representa como metric snapshots publicados.
- Control context conserva identidad operacional/catalogo y deriva buckets de contexto desde `implementation_status`:
  - `implementation_gap`
  - `implementation_attention`
  - `implementation_context`
- La ausencia de conteos de evidencia/hallazgo no se convierte en cero ni en afirmacion operacional.
- `standard_code` se conserva en firmas internas por compatibilidad de caller, pero no se usa para filtrar vistas metric-based que no lo publican.
- `tenant_id` sigue siendo identidad autorizada primaria y no hay fallback cross-tenant.

## Files Changed

- `ai-engine/app/services/context_builder.py`
- `ai-engine/app/services/solution_engine.py`
- `ai-engine/app/services/problem_classifier.py`
- `ai-engine/app/scripts/test_dgx_litellm_hardening.py`
- Continuity docs for this handoff/work queue/state/contract/architecture/ADR/regression command.

## Tests

PASS:

```bash
python3 -m py_compile ai-engine/app/services/llm_client.py ai-engine/app/routes/ai.py ai-engine/app/services/scenario_response_enricher.py ai-engine/app/services/senior_auditor_orchestrator.py ai-engine/app/services/language_service.py ai-engine/app/services/context_builder.py ai-engine/app/services/solution_engine.py ai-engine/app/services/problem_classifier.py ai-engine/app/scripts/test_dgx_litellm_hardening.py
PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py
```

The focal script ran 11 tests OK. It covers:

- OpenAI-compatible hardening and Ollama regression.
- Generic narrative grounding review corrections from DGX hardening.
- Textual/numeric confidence handling.
- Canonical `context_builder` shapes for tenant health/control/finding/KPI context.
- Tenant filter/no cross-tenant fallback.
- Control tenant/control/standard filters.
- Guided finding/action adapters continuing without 500 with canonical context shape.

Additional PASS gates:

```bash
git diff --check
rg -n "OLLAMA REQUEST" ai-engine/app
rg -n "tenant_name|healthy_controls|deteriorated_controls|healthy_percentage|control_title|control_description|control_category|health_status|evidence_count|finding_count|action_plan_count|status_color|kpi_code|kpi_name|calculated_at|ORDER BY tenant_name" ai-engine/app/services/context_builder.py ai-engine/app/services/solution_engine.py ai-engine/app/services/problem_classifier.py
```

Both `rg` commands returned no matches.

## Manual Read-Only/Postdeploy Commands

Optional after human review/deploy, from an authorized read-only DB context only:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'ai_core'
  AND table_name IN ('v_tenant_health_context', 'v_control_context', 'v_finding_context', 'v_kpi_context')
ORDER BY table_name, ordinal_position;
```

Then exercise the backend path that calls AI Engine for:

- `POST /api/ai/suggest/finding-analysis`
- `POST /api/ai/suggest/action-plan`

Expected: no 500 from missing `tenant_name`/legacy context columns. Do not print secrets.

## Do Not Rediscover

- Do not add legacy columns or views to satisfy old Python consumers.
- Do not treat absent evidence/findings/action counts as zero.
- Do not let the LLM query PostgreSQL directly.
- Do not revalidate DGX DNS/tunnel/credentials unless new objective regression evidence appears.
- Do not convert AI context into operational/compliance authority; it remains authorized context for deterministic guidance/enrichment.
