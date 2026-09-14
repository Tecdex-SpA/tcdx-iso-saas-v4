# Handoff — DGX Integration Hardening

Fecha: 2026-09-14
Owner funcional: CODEX B — AI / Knowledge / RAG / Regulatory
Branch: `main`
Base SHA: `b0d01993e136f8a41a01443b7e9452778fabf918`
Head/commit SHA: `UNCOMMITTED_WORKTREE`
Validation mode: `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`
Status: `DGX_INTEGRATION_HARDENING_REVIEW_READY`

## Scope

Correccion focal del `ai-engine` para completar la migracion operativa hacia LiteLLM/OpenAI-compatible en DGX Spark sin revalidar DNS, tuneles, credenciales ni disponibilidad DGX ya probadas externamente.

No se hizo commit, push, merge, deploy, cambio de secretos, lectura de `.env`, escritura a DB real ni llamada obligatoria a DGX real.

## Root Causes

1. `call_llm_json()` usaba OpenAI-compatible con JSON mode, pero no enviaba defaults requeridos por DGX (`reasoning_effort` y `max_tokens`) ni documentaba el minimo efectivo.
2. `/api/ai/intelligence/narrative` dependia principalmente de instrucciones de prompt y el normalizador podia dejar pasar afirmaciones del LLM no soportadas por el contexto autorizado.
3. `/api/ai/suggest/finding-analysis` y `/api/ai/suggest/action-plan` podian devolver 500 cuando `enrich_ai_response_with_scenario()` detectaba escenario y recibia `confidence="alta"` de los contratos legacy/guided; `float("alta")` levantaba `ValueError`.
4. Observabilidad aun emitia `OLLAMA REQUEST ...` en rutas AI y senior auditor aunque el proveedor actual fuera `openai_compatible`.
5. Review correction: el primer hardening usaba un blacklist lexico (`spark/cpu/gpu/...`) para grounding y elevaba `confidence="media"`/`"baja"` a `"alta"`; ambos comportamientos fueron retirados.

## Implementation

- `ai-engine/app/services/llm_client.py`
  - `openai_compatible` envia `reasoning_effort` por `LLM_REASONING_EFFORT`, default `low`.
  - `openai_compatible` envia `max_tokens` con minimo efectivo `2000` por `LLM_MIN_MAX_TOKENS`.
  - Mantiene `response_format={"type":"json_object"}`.
  - Parseo funcional sigue usando solo `message.content`; `reasoning_content` no se consume.
  - Filtra overrides OpenAI-like y no propaga `num_predict`/`num_ctx` a OpenAI-compatible.
  - Ollama conserva `/api/generate`, `format=json` y `options`.

- `ai-engine/app/routes/ai.py`
  - Prompt de narrative endurecido contra invencion de pruebas, metricas, cumplimiento, certificacion, controles o evidencias no entregadas.
  - Normalizador deterministico agrega contrato de grounding: si el contexto solo trae hechos/proposito y no trae evidencia operacional, devuelve `grounding_status="insufficient_evidence"`, `unsupported_claims_removed=true`, `confidence="baja"` y revision humana.
  - Para contexto con evidencia operacional, grounding se valida por contrato generico `grounding_claims`/`claims` con `source_refs` autorizadas por el contexto. Sin claims validables, se degrada confianza y exige revision humana.
  - No usa blacklist de terminos especificos del ejemplo DGX.
  - Logs de enrichment guiado pasan a `LLM REQUEST START|OK|ERROR` con `provider`, `selected_model`, `model_mode`, `request_id`, `tenant_id`, `duration_ms` y `error_type/error_message` controlado.

- `ai-engine/app/services/scenario_response_enricher.py`
  - `confidence` textual `alta/media/baja` y `high/medium/low` se normaliza sin excepcion y sin elevar `media`/`baja` a `alta`; el floor aplica solo a valores numericos.

- `ai-engine/app/services/senior_auditor_orchestrator.py`
  - Logs legacy `OLLAMA REQUEST ...` reemplazados por `LLM REQUEST ...`, preservando provider/model/request/tenant/duration/error metadata.

- `ai-engine/app/services/language_service.py`
  - `from __future__ import annotations` para que el test focal pueda correr en el Python 3.9 local disponible; el ai-engine productivo sigue requiriendo Python >=3.10.

- `ai-engine/.env.example`
  - Documenta `openai_compatible`, `azure_openai`, `LLM_REASONING_EFFORT` y `LLM_MIN_MAX_TOKENS` sin secretos.

- `ai-engine/app/scripts/test_dgx_litellm_hardening.py`
  - Regresion focal con mocks: metadata/payload OpenAI-compatible, token minimo DGX, JSON mode, parseo solo de content, no regresion Ollama, narrative grounding, `/suggest/finding-analysis` y `/suggest/action-plan` sin 500.

## Tests

PASS:

```bash
python3 -m py_compile ai-engine/app/services/llm_client.py ai-engine/app/routes/ai.py ai-engine/app/services/scenario_response_enricher.py ai-engine/app/services/senior_auditor_orchestrator.py ai-engine/app/services/language_service.py ai-engine/app/scripts/test_dgx_litellm_hardening.py
PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py
git diff --check
rg -n "OLLAMA REQUEST" ai-engine/app
rg -n "unsupported_terms|spark|cpu|gpu|latencia|memoria|pol[ií]ticas internas|desviaciones|auditor[ií]a aprobada" ai-engine/app/routes/ai.py ai-engine/app/scripts/test_dgx_litellm_hardening.py ai-engine/app/services/scenario_response_enricher.py
```

Notes:

- `PYTHONPATH=/private/tmp/tcdx-ai-engine-test-deps-reqonly python3 ai-engine/app/scripts/test_dgx_litellm_hardening.py` ran 7 tests OK.
- `rg -n "OLLAMA REQUEST" ai-engine/app` returned no matches.
- The grounding blacklist/search command above returned no matches.
- The test dependencies were installed only under `/private/tmp/tcdx-ai-engine-test-deps-reqonly`; repo dependencies were not modified.
- The test emitted existing Pydantic v2 `class Config` deprecation warnings from route models; no test failed.

## DGX Evidence

Automated tests do not call real DGX. They prove:

- `OPENAI_BASE_URL` is used as the base for `/chat/completions`.
- `OPENAI_MODEL=general` is sent as `model`.
- `reasoning_effort=low` is sent by default for `openai_compatible`.
- `max_tokens >= 2000` is enforced for `openai_compatible`.
- JSON mode is preserved.
- `message.content` is parsed and `reasoning_content` is ignored for application output.

External already-validated runtime evidence remains the authority for actual DGX connectivity:

- `http://ia2.tcdx.int:8000/v1`
- models `general`, `codigo`, `razonamiento`, `multimodal`, `embeddings`
- `POST /v1/chat/completions` with `general` returned `TCDX_DGX_OK`
- `POST /api/ai/intelligence/narrative` used `llm_provider=openai_compatible`, `model=general`, `fallback_used=false`.

## Ollama Regression

Covered by `test_ollama_generation_options_regression`:

- provider `ollama` still calls `/api/generate`;
- keeps `format=json`;
- preserves `generation_options_override` under `options`;
- does not send `reasoning_effort` or `max_tokens` as OpenAI-compatible fields.

## Manual ai-v4 Instructions

No production change was executed by Codex.

Recommended manual steps after human review/merge/deploy:

1. Ensure `/home/tecdex/ai-engine/.env` contains:
   - `LLM_PROVIDER=openai_compatible`
   - `OPENAI_BASE_URL=http://ia2.tcdx.int:8000/v1`
   - `OPENAI_API_KEY=<secret>`
   - `OPENAI_MODEL=general`
   - `LLM_REASONING_EFFORT=low`
   - `LLM_MIN_MAX_TOKENS=2000`
   - `AI_MAX_CONCURRENT_LLM_JOBS=1`
2. Reconcile the deployed systemd unit if it still contains:
   - `After=network-online.target ollama.service`
   - `Wants=network-online.target ollama.service`
3. The versioned template `deploy/templates/systemd/ai-engine.service` already only depends on `network-online.target`; use it as the proposed patch source.
4. Run:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl restart ai-engine.service`
   - `sudo systemctl status ai-engine.service --no-pager -l`
   - `curl -fsS http://localhost:8001/health`
5. Optional smoke, only if local secret env is already present and authorized: repeat `/api/ai/intelligence/narrative` and confirm `llm_provider=openai_compatible`, `selected_model=general`, `fallback_used=false`.

## Backlog / Risks

- Model alias routing was not implemented to avoid unnecessary regression. Future mapping should be configurable and tested:
  - `fast -> general`
  - `reports -> general`
  - `auditor -> general`
  - `deep -> razonamiento`
  - `code -> codigo`
  - `multimodal -> multimodal`
  - `embeddings -> embeddings`
- Automated tests do not contact DGX real by design; real smoke remains manual/authorized.
- Current grounding contract is conservative for narrative. It validates explicit claims against authorized source refs when present, but it is not a general natural-language theorem prover.

## Do Not Rediscover

- Do not re-investigate DGX DNS, tunnel, credentials or availability without concrete new regression evidence.
- Do not convert LLM output into compliance, legal, operational, control, metric or evidence authority.
- Do not let `reasoning_content` drive application output.
- Do not send API keys, prompts with sensitive tenant content, or secrets to logs.
- Do not turn guided endpoints into LLM-only flows; they remain deterministic + enrichment.
