# AI Final Value Layer Map

Alcance: pasada final de valor IA sin deploy, enfocada en Ollama local, RAG útil, documentos indexados y endpoints operativos mínimos. El ai-engine sigue siendo el cerebro de razonamiento; backend arma contexto y valida tenant; frontend queda pendiente salvo módulos ya integrados.

| area | current_status | file_or_table | value_gap | action_required | implemented | blocker | validation |
|---|---|---|---|---|---|---|---|
| LLM provider | Cliente LLM v2 existente | `ai-engine/app/services/llm_client.py` | Defaults orientados a OpenAI y Ollama menos explícito | Priorizar Ollama local y fallback determinístico | Sí | Ninguno | `py_compile llm_client.py` |
| Ollama local provider | Soporte parcial | `llm_client.py`, `senior_auditor_orchestrator.py`, `.env.example` | Modelo/host/timeout no estaban alineados a baseline local | Default `qwen2.5:7b`, host local, timeout 90s, error trazable por modelo | Sí | Ollama debe instalarse en VM ai-engine | `py_compile` |
| RAG knowledge | Wrapper RAG existente | `rag_context_service.py`, `ai-engine/knowledge/iso_baseline_knowledge.json` | Conocimiento cargado no garantizaba guidance ISO práctico | Baseline ISO9001/27001/42001 con evidencia, brechas, preguntas y cierre | Sí | DB/vector RAG avanzado queda futuro | `py_compile rag_context_service.py` |
| Simple RAG baseline canónico | Implementado en esta pasada | `ai-engine/app/knowledge/iso_baseline_knowledge.json`, `rag_context_service.py` | RAG debía operar sin vector DB y con búsqueda determinística clara | JSON versionado + búsqueda por norma, dominio, tópico, keyword y módulo | Sí | Sin embeddings por diseño | `json.tool`, `py_compile` |
| local_compact Ollama | Implementado en esta pasada | `senior_auditor_orchestrator.py`, `llm_client.py`, `iso_senior_auditor_compact.md` | Latencia alta por prompt/contexto grande | Auto-enable para Ollama, contexto compacto, prompt corto, num_predict por profundidad | Sí | Performance exacta depende de VM/modelo | `py_compile`, prueba local fallback |
| document_index / Drive | Backend ya consulta `document_index` si existe | `backend/src/services/aiContextBuilder.service.js`, `drive_context_service.py`, `document_index` | Valor depende de documentos indexados | Mantener búsqueda por tenant/norma/cláusula/keywords y documentar readiness | Sí | OAuth no se reconstruye aquí | `node -c aiContextBuilder`, `py_compile drive_context_service.py` |
| controls AI actions | No había endpoint operativo específico | `backend/src/routes/controls.routes.js` | Valor IA visible solo en IA Auditor/Compliance | `POST /api/controls/:tenant_control_id/ai-analyze` | Sí | UI operativa pendiente | `node -c controls.routes.js` |
| evidences AI actions | IA batch/validación existente, no contrato v2 canónico | `backend/src/routes/evidences.routes.js` | Review IA no exponía structured_result universal | `POST /api/evidences/:evidence_id/ai-review` | Sí | UI operativa pendiente | `node -c evidences.routes.js` |
| action plans AI actions | No había review IA v2 | `backend/src/routes/action-plans.routes.js` | Planes no podían evaluarse con auditor senior | `POST /api/action-plans/:action_plan_id/ai-review` | Sí | UI operativa pendiente | `node -c action-plans.routes.js` |
| findings AI actions | No había review IA v2 | `backend/src/routes/findings.routes.js` | Hallazgos sin priorización IA canónica | `POST /api/findings/:finding_id/ai-review` | Sí | UI operativa pendiente | `node -c findings.routes.js` |
| nonconformities AI actions | No había review IA v2 | `backend/src/routes/nonconformities.routes.js` | NC sin análisis IA de cierre/riesgo | `POST /api/nonconformities/:nonconformity_id/ai-review` | Sí | UI operativa pendiente | `node -c nonconformities.routes.js` |
| IA Auditor | Integrado en v2 | `backend/src/routes/ai-auditor.routes.js`, `frontend/src/app/ia-auditor` | Mantener estable | Sin cambios funcionales en esta pasada | Sí | Ninguno | `node -c ai-auditor.routes.js` |
| IA Compliance | Integrado/documentado en v2 | `backend/src/routes/ai-compliance.routes.js`, `frontend/src/app/ia-compliance` | Mantener estable | Sin cambios funcionales en esta pasada | Sí | Ninguno | `node -c ai-compliance.routes.js` |
| frontend rendering | IA Auditor/Compliance renderizan structured_result | `frontend/src/app/*` | Botones IA operativos por módulo aún no añadidos | Documentar rollout siguiente para evitar riesgo visual | Parcial | UI por módulo requiere diseño/QA dedicado | `npm run build` no requerido si no se toca frontend |

## Pasada 2026-05-14 — hardening contexto + fast mode

| area | current_status | file_or_table | value_gap | action_required | implemented | blocker | validation |
|---|---|---|---|---|---|---|---|
| Schema-safe AI context | Endurecido | `backend/src/services/aiContextBuilder.service.js` | Limitaciones podían mostrar códigos SQL como `42703` y asumir tablas/columnas opcionales | Validar tablas/columnas con `information_schema`, usar fuentes reales (`iso_risk_matrix_items`, `asset_risks`, `kpi_snapshots`) y mensajes limpios | Sí | Requiere datos reales para validar volumen | `node -c aiContextBuilder.service.js` |
| Fast deterministic mode | Implementado | `ai-engine/app/services/senior_auditor_orchestrator.py` | Executive local_compact esperaba Ollama y podía tardar 40+ segundos | `fast_mode` devuelve structured_result con salud efectiva + RAG sin LLM | Sí | Profundidad estándar/deep sigue dependiendo de Ollama | `py_compile senior_auditor_orchestrator.py` |
| IA Compliance health/brief | Ajustado | `backend/src/routes/ai-compliance.routes.js` | Refresh/brief podía activar análisis pesado legacy | Se usa v2 executive fast y se evita llamada legacy senior auditor en esos flujos | Sí | `callAiEngine('/api/ai/suggest/*')` legacy queda por revisar en otra pasada si genera LLM | `node -c ai-compliance.routes.js` |

## Pasada 2026-05-14 — cierre legacy suggest + runtime metrics

| area | current_status | file_or_table | value_gap | action_required | implemented | blocker | validation |
|---|---|---|---|---|---|---|---|
| Legacy suggest health-summary | Cerrado para IA Compliance | `ai-engine/app/routes/ai.py`, `backend/src/routes/ai-compliance.routes.js` | Endpoint interno no exponía métricas y el frontend visible lo llamaba en paralelo | Métricas en ai-engine y vista backend v2 fast compatible | Sí | Reportes aún lo usan como fallback opcional | `py_compile ai.py`, `node -c ai-compliance.routes.js` |
| Legacy suggest executive-brief | Cerrado para IA Compliance | `ai-engine/app/routes/ai.py`, `backend/src/routes/ai-compliance.routes.js` | Endpoint interno no exponía métricas y el frontend visible lo llamaba en paralelo | Métricas en ai-engine y vista backend v2 fast compatible | Sí | Reportes aún lo usan como fallback opcional | `py_compile ai.py`, `node -c ai-compliance.routes.js` |
| Runtime metrics | Implementado | `backend/src/services/aiRuntimeMetrics.service.js`, `ai-engine/app/services/senior_auditor_orchestrator.py` | No había duración visible por modo | `duration_ms`, `mode`, `used_llm`, `used_rag`, `used_drive`, `used_web` | Sí | No hay persistencia histórica aún | `node -c`, `py_compile` |

## Pasada 2026-05-14 — report AI fallback migration

| area | current_status | file_or_table | value_gap | action_required | implemented | blocker | validation |
|---|---|---|---|---|---|---|---|
| Report AI enrichment | Migrado a v2 fast | `backend/src/services/reportAiEnrichment.service.js` | Reportes dependían de `/api/ai/suggest/health-summary` y `/api/ai/suggest/executive-brief` | Servicio backend v2 fast con contexto efectivo, RAG y métricas | Sí | Ninguno | `node -c reportAiEnrichment.service.js` |
| Report data AI fallback | Migrado | `backend/src/reports/services/reportData.service.js` | `getAiEnhancements()` llamaba suggest legacy | Usa `buildReportAiEnrichment()` y conserva campos existentes | Sí | Finding-analysis legacy queda fuera de alcance | `node -c reportData.service.js` |
| Report route addendum | Migrado | `backend/src/routes/reports.routes.js` | Addendum llamaba suggest executive-brief directo | Usa `buildReportAiEnrichment()` | Sí | Ninguno | `node -c reports.routes.js` |
