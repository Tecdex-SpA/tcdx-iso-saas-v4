# QA Checklist - Intelligence Layer

| criterio | estado | evidencia | riesgo residual | accion pendiente |
|---|---|---|---|---|
| Conversor MD a JSONL | OK | `node backend/scripts/convert-knowledge-md-to-jsonl.js` genera 1000 registros sin warnings | bajo | ejecutar cuando cambie la fuente |
| JSONL valido >= 950 | OK | dry-run reporta `valid_records: 1000` | bajo | mantener test |
| Summary JSON | OK | `knowledge_base_seed_v2.summary.json` existe | bajo | mantener versionado |
| Loader idempotente | OK unitario | `knowledge.service.test.js` prueba full-volume con DB falsa | medio | ejecutar contra DB configurada |
| Loader real DB | BLOQUEADO LOCAL | `DB_CONFIG_MISSING: DB_NAME, DB_USER` | medio | exportar env DB local/QA y reintentar |
| Sin duplicados item_key | OK unitario | loader usa upsert por `item_key` | bajo | verificar SQL post-load |
| license_class permitido | OK | conversor/loader validan `derived_summary` | bajo | mantener allowlist |
| HTML/script rechazado | OK unitario | guardrails parser | bajo | ampliar fuzz test |
| Datos tenant en KB | OK diseño | tablas KB no tienen `tenant_id` | bajo | revisar seeds nuevos |
| searchKnowledge | OK unitario | `knowledge.service tests OK` | bajo | smoke con DB |
| Matching tenant entity | OK unitario | control/riesgo simulado | bajo | smoke con tenant real |
| Tenant sin datos | OK unitario | `intelligence.service tests OK` | bajo | smoke con tenant real |
| Evidencia baja | OK unitario | readiness bajo/medio | bajo | smoke con tenant real |
| Accion vencida | OK unitario | finding + next action | bajo | smoke con tenant real |
| Hallazgo abierto | OK unitario | regla `open_finding_without_action_plan` | medio | agregar fixture DB real |
| NC antigua | OK codigo | regla `old_nonconformity` | medio | agregar fixture DB real |
| Riesgo critico sin plan | OK unitario | finding critico con KB | bajo | smoke con tenant real |
| Datos contradictorios | OK unitario | score alto + data quality bajo | bajo | ampliar casos |
| Estandar activo sin KB | OK codigo | regla `active_standard_without_kb` | medio | smoke con tenant real |
| KB no cargada | OK unitario | confidence baja/media | bajo | smoke con tablas vacias |
| IA desactivada | OK diseño | `ai_used=false`, fallback deterministico | bajo | conectar Fase 3 si aplica |
| LLM timeout | OK fallback externo | test operational AI timeout existente | medio | integrar con orquestador IA |
| JSON IA invalido | PENDIENTE IA | Fase 5 no agrega orquestador IA | medio | validar en Fase IA |
| IA sin knowledge_basis | OK regla | `ai_response_without_knowledge_basis` | bajo | smoke con traces reales |
| Sin token | OK unitario | auth devuelve 401 | bajo | QA runtime |
| Otro tenant | OK unitario | tenant scope devuelve 403 | bajo | QA runtime |
| Viewer lectura | OK unitario | RBAC permite GET intelligence | bajo | QA runtime |
| Dealer denegado | OK unitario | RBAC deniega intelligence | bajo | QA runtime |
| Platform permitido | OK unitario | RBAC permite role plataforma | bajo | QA runtime |
| Cache brief | OK unitario | miss/hit/bypass | bajo | monitorear TTL |
| Observabilidad | OK unitario | metadata + log estructurado | bajo | integrar log central |
| Prompt guardrails | OK doc | `prompting-and-guardrails.md` | medio | validar prompts Fase 3 |
| UI/reportes muestran fundamento | PARCIAL | API expone fundamento | medio | conectar UI/reportes consumidores |
