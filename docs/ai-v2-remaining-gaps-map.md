# AI v2 Remaining Gaps Map

Fecha: 2026-05-13

| gap | current_file | current_status | required_change | implemented | blocker | validation |
|---|---|---|---|---|---|---|
| IA Compliance v2 | `backend/src/routes/ai-compliance.routes.js` | Tenía endpoints legacy con `/api/ai/suggest/*`, orquestador interno `/answer` y auditor senior legacy | Conectar análisis estándar a `aiContextBuilder` + `aiEngineClient.analyzeWithSeniorAuditor` y preservar campos legacy | Sí: nuevo `POST /api/ai-compliance/analyze`, `health-summary` y `executive-brief` enriquecidos con `answer`, `structured_result`, `source_trace`, `confidence`, `limitations`, `engine`, `suggestions` | Endpoints de aplicación directa se mantienen legacy para no arriesgar escrituras operativas | `node -c backend/src/routes/ai-compliance.routes.js` |
| IA Compliance frontend | `frontend/src/app/ia-compliance/page.tsx`, `frontend/src/app/ia-compliance/sugerencias/page.tsx` | Render legacy de health summary, executive brief y sugerencias | Render condicional de `structured_result` sin romper UI existente | Sí: panel AI v2 en la página principal y panel compacto en sugerencias guardadas | Ninguno | `cd frontend && npm run build` |
| Drive/document_index deep search | `backend/src/services/aiContextBuilder.service.js`, `ai-engine/app/services/drive_context_service.py` | Se enviaban documentos recientes de `document_index` si existían | Filtrar por tenant, norma, cláusula, keywords de control, tipo documental y devolver relación trazable | Sí: búsqueda determinística por términos, metadata, filename y tipo documental; ai-engine produce `drive_context_used` con relación y `matched_by` | No se implementa OAuth en ai-engine; se usa índice existente | `node -c backend/src/services/aiContextBuilder.service.js`, `py_compile drive_context_service.py` |
| LLM provider | `ai-engine/.env.example`, `ai-engine/app/services/llm_client.py`, `ai-engine/app/services/senior_auditor_orchestrator.py` | `.env.example` tenía `OPENAI_API_KEY`, `MODEL_PROVIDER`, `MODEL_NAME`, pero no cliente LLM v2 | Detectar proveedor real si existe y usarlo con JSON; fallback determinístico si falta/falla | Sí: cliente OpenAI-compatible/Ollama con `is_llm_available`, `get_llm_metadata`, `call_llm_json`; orquestador usa LLM si disponible | No se instalaron dependencias ni claves. Requiere `.env` real en runtime | `py_compile llm_client.py`, `py_compile senior_auditor_orchestrator.py` |
| RAG/Brave wrappers | `ai-engine/app/services/rag_context_service.py`, `ai-engine/app/services/web_context_service.py` | Existían wrapper RAG y Brave previos | Mantener integración y reportar limitaciones si config falta | Sí, sin cambios de contrato | Brave depende de `BRAVE_SEARCH_API_KEY`/config runtime | Validación Python existente |
| IA Auditor v2 regression | `backend/src/routes/ai-auditor.routes.js`, `ai-engine/app/routes/senior_auditor_v2.py` | Funcionando desde commit anterior | No romper | Sí: no se cambió la ruta backend IA Auditor; solo se mejoró orquestador común | Ninguno | `node -c backend/src/routes/ai-auditor.routes.js`, `py_compile senior_auditor_v2.py` |

## Endpoints IA Compliance clasificados

| endpoint | current purpose | should use v2? | task_type | context builder | status |
|---|---|---|---|---|---|
| `POST /api/ai-compliance/analyze` | Análisis libre/estándar IA Compliance | Sí | `standard_gap_analysis`, `control_analysis`, `evidence_review`, `free_question` | Tenant/standard/control/evidence según payload | Implementado |
| `GET /api/ai-compliance/health-summary` | Resumen ejecutivo inicial | Sí, como enriquecimiento | `standard_gap_analysis` | Tenant | Implementado |
| `GET /api/ai-compliance/executive-brief` | Brief ejecutivo | Sí, como enriquecimiento | `standard_gap_analysis` | Tenant | Implementado |
| `POST /api/ai-compliance/finding-analysis` | Analiza hallazgo y guarda log | Parcial futuro | `free_question`/`action_plan_review` | Finding específico | Pendiente para no tocar flujo de escritura |
| `POST /api/ai-compliance/action-plan-suggestion` | Genera plan desde hallazgo | Parcial futuro | `action_plan_review` | Finding/action plan | Pendiente para no tocar flujo de escritura |
| `POST /api/ai-compliance/nonconformity-draft` | Redacta NC | Parcial futuro | `standard_gap_analysis` | NC específica | Pendiente para no tocar flujo de escritura |

## LLM/provider current state

Se encontró configuración base en `ai-engine/.env.example`: `OPENAI_API_KEY`, `MODEL_PROVIDER`, `MODEL_NAME`. Se agregó soporte explícito para:

- `LLM_PROVIDER=openai|openai_compatible|ollama`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OLLAMA_HOST`
- `OLLAMA_MODEL`
- `AI_ENGINE_LLM_TIMEOUT_MS`

No se commitearon claves reales.
