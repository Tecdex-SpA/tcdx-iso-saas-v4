# Sprint 0 - Revisión AI Engine

## Ubicación real
- Motor IA: `ai-engine/` con FastAPI en `ai-engine/main.py`.
- Rutas modulares: `ai-engine/app/routes/ai.py`, `senior_auditor_v2.py`, `audit_documents.py`.
- Servicios: context builder, RAG, guardrails, llm client, web/external lookup, senior auditor orchestrator, drive context, structured results.

## Endpoints AI Engine detectados
- Público básico: `GET /`, `HEAD /`, `GET /health`, `HEAD /health`.
- Profundo protegido: `GET /health/deep` con `x-ai-token` o `x-internal-token`.
- Main legacy/compat: `POST /api/evidences/process`, `POST /api/ai-compliance/analyze-document`.
- Router `/api/ai`: suggestions health/finding/NC/action/executive, report enrichment, company profile analyze, knowledge status/bootstrap/search, auditor analyze, internal diagnostic/external lookup.
- Router `/api/ai/senior-auditor`: `POST /analyze`.
- Router `/api/ai-compliance/audit-documents`: `POST /generate`.

## Integración backend -> IA
- `backend/src/services/aiEngineClient.service.js` llama AI Engine con `AI_ENGINE_URL` y token interno.
- `backend/src/routes/ai-compliance.routes.js`, `ai-auditor.routes.js`, `reports.routes.js`, `documentAiAnalysis.service.js`, `evidence-ai.service.js` integran IA.
- `ai-engine/knowledge_client.py` llama de vuelta al backend `/api/ai-compliance/knowledge/internal-search` con token interno.

## Variables requeridas, sin exponer secretos
- Backend: `AI_ENGINE_URL`, `AI_INTERNAL_TOKEN`/`AI_ENGINE_TOKEN`/`AI_TOKEN`, `JWT_SECRET`, DB vars.
- AI Engine: `AI_INTERNAL_TOKEN`, `BACKEND_API_URL`, `DB_*`, `OPENAI_API_KEY` opcional, `OLLAMA_*`, `BRAVE_SEARCH_API_KEY`, web context vars.
- No se documentan valores reales; solo nombres.

## Trazabilidad y gobernanza
- Backend registra `ai_prompt_logs`, `ai_suggestions`, `ai_feedback`, `ai_auditor_runs`, `ai_runtime_metrics` por código/migraciones.
- IA usa guardrails y source trace services, pero debe validarse cobertura real por endpoint.
- Riesgo: múltiples superficies IA (IA Compliance, IA Auditor, report enrichment, document analysis, external lookup) pueden mostrar capacidades no listas para MVP si no se agrupan.

## Contexto operacional futuro
Insertar procesos/operaciones en `aiContextBuilder.service.js`, `ai-engine/app/services/context_builder.py`, `rag_context_service.py` y prompts senior auditor para que toda respuesta IA pueda citar proceso, operación, control, evidencia, brecha, riesgo y acción.
