# ai-engine Senior ISO Auditor Architecture

Fecha: 2026-05-13

## 1. Architecture overview

El cerebro de IA queda concentrado en `ai-engine`. Backend arma contexto interno seguro, aplica autenticación/RBAC/multi-tenant y llama al motor. Frontend solo renderiza `structured_result` cuando existe y conserva la salida legacy.

Flujo principal:

1. `frontend/src/app/ia-auditor/page.tsx` ejecuta IA Auditor.
2. `backend/src/routes/ai-auditor.routes.js` valida usuario, tenant y permisos.
3. `backend/src/services/aiContextBuilder.service.js` arma contexto canónico con salud ISO efectiva.
4. `backend/src/services/aiEngineClient.service.js` llama `POST /api/ai/senior-auditor/analyze`.
5. `ai-engine/app/services/senior_auditor_orchestrator.py` consulta RAG, Drive, Brave y genera `structured_result`.
6. Frontend muestra diagnóstico, brechas, evidencia faltante, acciones, fuentes, confianza y limitaciones.

## 2. Data contracts

Backend → ai-engine:

```json
{
  "task_type": "audit_analysis|control_analysis|evidence_review|standard_gap_analysis|action_plan_review|free_question",
  "tenant_id": "uuid",
  "module_origin": "ia-auditor",
  "question": "",
  "locale": "es",
  "context": {
    "tenant": {},
    "scope": {},
    "effective_health_summary": [],
    "priority_controls": [],
    "recent_evidences": [],
    "recent_findings": [],
    "recent_nonconformities": [],
    "recent_action_plans": [],
    "risks": [],
    "assets": [],
    "audits": [],
    "documents": [],
    "kpis": [],
    "source_trace": [],
    "limitations": []
  },
  "options": {
    "use_rag": true,
    "use_drive": true,
    "use_web": true,
    "depth": "standard",
    "return_structured_result": true
  }
}
```

ai-engine → backend:

```json
{
  "ok": true,
  "answer": "respuesta en español",
  "structured_result": {},
  "source_trace": [],
  "confidence": 0.0,
  "limitations": [],
  "engine": {
    "prompt_version": "1.0.0",
    "context_version": "ai_context_v2.0.0",
    "model": "deterministic_senior_auditor_v2",
    "used_internal_context": true,
    "used_rag": false,
    "used_drive": false,
    "used_web": false
  }
}
```

## 3. Context builder

Archivo: `backend/src/services/aiContextBuilder.service.js`.

Funciones implementadas:

- `buildAiTenantContext`
- `buildAiStandardContext`
- `buildAiControlContext`

Stubs seguros con TODO:

- `buildAiEvidenceContext`
- `buildAiFindingContext`
- `buildAiActionPlanContext`
- `buildAiAuditContext`

Todas las consultas de datos operativos usan `tenant_id`. Las fuentes principales son:

- `public.v_iso_control_effective_health`
- `public.v_iso_effective_kpi_summary`
- `evidences`
- `findings`
- `tenant_nonconformities`
- `action_plans`
- `audits`
- `risks`, `assets`, `kpis` si existen
- `tenant_standards`
- `tenant_operations`

## 4. Master prompt

Archivo: `ai-engine/prompts/iso_senior_auditor.md`.

Incluye rol, secuencia de razonamiento, prioridad de fuentes, guardrails, fórmula de confianza, formato de salida y ejemplos de calidad GOOD/BAD.

## 5. structured_result module

Archivo: `ai-engine/app/services/structured_result_service.py`.

Funciones:

- `build_empty_structured_result`
- `normalize_ai_structured_result`
- `build_fallback_structured_result`

Garantiza campos completos, sin `null`, con `confidence`, `limitations` y `source_trace` siempre presentes.

## 6. Guardrails

Archivo: `ai-engine/app/services/guardrails_service.py`.

Guardrails incluidos:

- No hay datos suficientes.
- Control fuera de alcance.
- Evidencia no oficial.
- Internet no reemplaza evidencia interna.
- Documento Drive requiere validación formal.
- Sistema no reemplaza certificación acreditada.
- Aislamiento estricto por tenant.

## 7. Source trace

Archivo: `ai-engine/app/services/source_trace_service.py`.

Formato uniforme:

```json
{
  "source": "internal_db|rag|drive|web|prompt_inference",
  "reference": "string",
  "used_for": "string"
}
```

## 8. Effective health views

IA Auditor usa salud efectiva desde backend context builder:

- `public.v_iso_control_effective_health`
- `public.v_iso_effective_kpi_summary`

Esto evita volver a basarse solo en `tenant_controls.status`, `tenant_controls.score` o `control_health_scores`.

## 9. RAG status

Estado: integrado como wrapper seguro sobre knowledge local.

Archivo: `ai-engine/app/services/rag_context_service.py`.

Usa `knowledge_loader` y `ai-engine/knowledge`. Si no hay entradas aplicables, devuelve limitación explícita.

Pendiente: implementar búsqueda vectorial semántica si se quiere RAG avanzado por cláusula/control.

## 10. Google Drive status

Estado: parcialmente operativo.

Archivo: `ai-engine/app/services/drive_context_service.py`.

El ai-engine consume documentos Drive si backend los incluye en `context.documents`, `context.drive_documents` o `recent_evidences`. No construye OAuth propio. Si `.env` tiene Google configurado pero backend no envía documentos, devuelve limitación clara.

Pendiente exacto: enriquecer `aiContextBuilder.service.js` para buscar documentos Drive indexados desde las tablas actuales de integración documental y pasarlos al contexto canónico.

## 11. Brave status

Estado: integrado.

Archivo usado: `ai-engine/app/services/web_context_service.py`.

El orquestador llama Brave mediante `build_external_context` cuando `options.use_web=true`. Las consultas se sanitizan para no enviar datos sensibles del tenant.

Variables esperadas en `.env`:

- `ENABLE_WEB_CONTEXT`
- `WEB_CONTEXT_PROVIDER`
- `BRAVE_SEARCH_API_KEY`
- `BRAVE_SEARCH_ENDPOINT`
- `WEB_CONTEXT_MAX_RESULTS`
- `WEB_CONTEXT_TIMEOUT_MS`

## 12. ai-engine endpoint

Nuevo endpoint:

```txt
POST /api/ai/senior-auditor/analyze
```

Archivo: `ai-engine/app/routes/senior_auditor_v2.py`.

Registrado en `ai-engine/main.py`.

## 13. Backend IA Auditor orchestration

Archivo: `backend/src/routes/ai-auditor.routes.js`.

La ruta `POST /api/ai-auditor/analyze` ahora:

1. Valida permisos.
2. Arma contexto canónico.
3. Llama ai-engine v2.
4. Devuelve `answer`, `structured_result`, `source_trace`, `confidence`, `limitations`, `engine`.
5. Mantiene campos legacy para frontend, PDF e historial.

## 14. Frontend rendering

Archivo: `frontend/src/app/ia-auditor/page.tsx`.

Agrega panel progresivo:

- Resumen ejecutivo.
- Diagnóstico.
- Brechas detectadas.
- Evidencia faltante.
- Acciones recomendadas.
- Preguntas de auditor.
- Fuentes usadas.
- Confianza.
- Limitaciones.

Si `structured_result` no existe, la UI legacy sigue funcionando.

## 15. Fallback behavior

Backend fallback:

- `backend/src/services/aiEngineClient.service.js`
- Devuelve contrato completo aunque ai-engine esté caído.

ai-engine fallback:

- Si no hay proveedor LLM externo, usa motor determinístico auditor v2 basado en contexto interno.
- No inventa evidencia.
- Declara limitaciones.

## 16. Modified endpoints

- `POST /api/ai-auditor/analyze`
- `POST /api/ai/senior-auditor/analyze`

Rutas legacy mantenidas:

- `POST /api/ai/auditor/analyze`
- `POST /api/ai-auditor/analyze/:audit_id`

## 17. Curl examples

Backend:

```bash
curl -X POST "http://localhost:3000/api/ai-auditor/analyze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"standard_code":"ISO27001","depth":"standard","use_web":true,"use_drive":true,"use_rag":true}'
```

ai-engine interno:

```bash
curl -X POST "http://localhost:8001/api/ai/senior-auditor/analyze" \
  -H "X-AI-Token: $AI_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_type":"audit_analysis","tenant_id":"TENANT_ID","module_origin":"ia-auditor","question":"","locale":"es","context":{"tenant":{"tenant_id":"TENANT_ID"},"scope":{},"effective_health_summary":[],"priority_controls":[],"source_trace":[],"limitations":[]},"options":{"use_rag":true,"use_drive":true,"use_web":true,"depth":"standard","return_structured_result":true}}'
```

## 18. Post-deploy test plan

1. Abrir `/ia-auditor`.
2. Ejecutar análisis general.
3. Verificar que aparezca `Resultado estructurado Auditor Senior`.
4. Confirmar que existen `source_trace`, `confidence`, `limitations`.
5. Ejecutar con norma específica.
6. Validar que no se crean registros automáticamente.
7. Revisar logs de backend y ai-engine si Brave/Drive no responden.

## 19. Pending items

1. Migrar `POST /api/ai-auditor/analyze/:audit_id` al flujo v2 completo.
2. Enriquecer `buildAiEvidenceContext`, `buildAiFindingContext`, `buildAiActionPlanContext` y `buildAiAuditContext`.
3. Pasar documentos Google Drive indexados desde backend al contexto canónico.
4. Evaluar proveedor LLM real dentro de ai-engine si se requiere razonamiento generativo más rico.
5. Migrar IA Compliance a `aiEngineClient.analyzeWithSeniorAuditor`.
6. Persistir trazas IA v2 en tabla dedicada si se requiere auditoría de prompts/respuestas.

## 20. Known limitations

- RAG actual es knowledge wrapper local, no vector store semántico completo.
- Google Drive no se consulta directamente desde ai-engine para evitar duplicar OAuth; se espera contexto documental desde backend.
- Brave depende de `.env` y de acceso de red del runtime de ai-engine.
- El motor v2 es determinístico si no existe proveedor LLM configurado.
