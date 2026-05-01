# AI Engine Knowledge Base

## Objetivo

La base de conocimiento del AI Engine agrega reglas internas para que TCDX razone como auditor senior, consultor ISO y analista de riesgos. No reemplaza la evidencia interna del tenant ni el juicio humano final. Su funcion es ordenar criterios, salidas y limites de la IA.

## Archivos creados

La carpeta `ai-engine/knowledge/` contiene:

- `tcdx_ai_knowledge_seed.json`
- `senior_auditor_reasoning_rules.json`
- `report_generation_rules.json`
- `task_generation_rules.json`
- `audit_intelligence_rules.json`
- `evidence_quality_rules.json`
- `risk_analysis_rules.json`
- `kpi_interpretation_rules.json`
- `ai_output_schemas.json`
- `web_context_rules.json`

Todos deben ser JSON validos.

## Loader

El servicio `ai-engine/app/services/knowledge_loader.py` carga la base de conocimiento al iniciar el AI Engine. Expone:

- `get_knowledge_base()`
- `get_knowledge_module(module)`
- `get_knowledge_status()`
- `reload_knowledge()`

Modulos disponibles:

- `reports`
- `tasks`
- `audit`
- `evidence`
- `risk`
- `kpi`
- `web_context`
- `global`

## Endpoints

Los endpoints quedan bajo la convencion actual del AI Engine y exigen `x-ai-token`:

```bash
GET /api/ai/knowledge/status
GET /api/ai/knowledge/module/{module_name}
POST /api/ai/auditor/analyze
```

El estado devuelve archivos cargados, faltantes, errores y configuracion segura de contexto web. No devuelve secretos.

`POST /api/ai/auditor/analyze` ejecuta una primera capa de razonamiento auditor senior sobre resumenes internos ya filtrados por tenant. La salida incluye `summary`, `insights`, `suggested_tasks`, `audit_observations`, `limitations`, `external_context`, `knowledge` y `guardrails`.

## Uso en reportes

Los reportes deben usar `report_generation_rules.json` para ordenar resumen ejecutivo, KPIs, riesgos, evidencias, hallazgos, planes de accion y contexto externo complementario cuando aplique.

La conclusion de cumplimiento siempre debe depender de datos internos: controles, evidencias, riesgos, hallazgos, planes, KPIs y auditorias del tenant.

Desde fase 3, el backend consume `POST /api/ai/auditor/analyze` en:

- `backend/src/reports/services/reportData.service.js`, al construir datos de reportes premium.
- `backend/src/routes/reports.routes.js`, al enriquecer el addendum ejecutivo si existe respuesta de auditor senior.
- `backend/src/routes/ai-compliance.routes.js`, en los endpoints `/health-summary` y `/executive-brief`.

El consumo usa fallback: si el endpoint de auditor senior falla, los reportes y respuestas existentes siguen funcionando con la inteligencia previa. El contexto web desde backend esta desactivado por defecto y solo se activa con `AI_AUDITOR_WEB_CONTEXT=true`, `AI_REPORT_WEB_CONTEXT=true` o `AI_COMPLIANCE_WEB_CONTEXT=true`, segun la ruta.

Desde fase 4, las tareas, brechas de evidencia y alertas de riesgo generadas por auditor senior pueden persistirse como borradores en `ai_suggestions`. La persistencia esta centralizada en `backend/src/services/seniorAuditorSuggestions.service.js` y deduplica por tenant, tipo, titulo, entidad y estado abierto antes de insertar. Esto evita que llamadas repetidas a reportes o resumenes creen sugerencias duplicadas.

Las sugerencias de tipo `senior_auditor_task`, `senior_auditor_risk_alert`, `senior_auditor_evidence_gap` y `senior_auditor_insight` pueden aplicarse como borrador de plan de accion mediante el flujo existente `POST /api/ai-compliance/suggestions/:id/apply` con `apply_mode=create_action_plan_draft`.

## Uso en sugerencias y tareas

Las sugerencias deben seguir `task_generation_rules.json` y `ai_output_schemas.json`. La IA solo debe sugerir tareas cuando exista una senal concreta en los datos y debe indicar prioridad, razon y entidades relacionadas.

## Uso en auditoria IA

La auditoria IA debe seguir:

- `senior_auditor_reasoning_rules.json`
- `audit_intelligence_rules.json`
- `evidence_quality_rules.json`
- `risk_analysis_rules.json`
- `kpi_interpretation_rules.json`

La IA puede sugerir posibles no conformidades, pero debe indicarlas como posibles y dejar la validacion final al auditor humano.

## Que no debe hacer la IA

- No inventar cumplimiento.
- No inventar evidencias.
- No mezclar datos entre tenants.
- No duplicar hallazgos, no conformidades o planes abiertos equivalentes.
- No copiar textos protegidos de normas ISO.
- No usar internet como fuente principal para declarar cumplimiento interno.
- No enviar datos sensibles del tenant a proveedores externos.

## Multi-tenant

El loader no accede a datos de tenants. Es configuracion estatica del AI Engine. Cualquier analisis que use estos criterios debe recibir contexto filtrado por tenant desde backend o servicios internos existentes.

## Contexto externo y Brave Search

`web_context_rules.json` define el uso seguro de internet. Brave Search es solo contexto complementario. La informacion externa puede enriquecer buenas practicas, amenazas actuales o recomendaciones tecnicas, pero no reemplaza evidencia interna.

Brave debe usarse solo si:

- `ENABLE_WEB_CONTEXT=true`
- `WEB_CONTEXT_PROVIDER=brave`
- existe `BRAVE_SEARCH_API_KEY`
- la consulta puede sanitizarse
- el caso de uso aporta valor real

No debe usarse si:

- la tarea se resuelve con datos internos,
- la consulta contiene datos sensibles,
- el usuario pidio no usar internet,
- falta API key,
- `WEB_CONTEXT_PROVIDER=disabled`,
- `ENABLE_WEB_CONTEXT=false`.

## Variables de entorno

Variables recomendadas para la VM IA:

```ini
ENABLE_WEB_CONTEXT=true
WEB_CONTEXT_PROVIDER=brave
BRAVE_SEARCH_API_KEY=
BRAVE_SEARCH_ENDPOINT=https://api.search.brave.com/res/v1/web/search
WEB_CONTEXT_MAX_RESULTS=5
WEB_CONTEXT_TIMEOUT_MS=8000
WEB_CONTEXT_CACHE_TTL_MINUTES=1440
```

Variables legacy ya soportadas por el servicio actual:

```ini
BRAVE_SEARCH_MAX_QUERIES_PER_REQUEST=3
BRAVE_SEARCH_MAX_RESULTS_PER_QUERY=5
```

Para modo seguro sin internet:

```ini
ENABLE_WEB_CONTEXT=false
WEB_CONTEXT_PROVIDER=disabled
```

## Validacion local o en VM

```bash
chmod +x scripts/validate-ai-knowledge.sh
./scripts/validate-ai-knowledge.sh
```

Validar endpoint en la VM IA:

```bash
cd /home/tecdex/ai-engine
sudo systemctl restart ai-engine
sudo systemctl status ai-engine --no-pager
curl -s http://localhost:8001/health
curl -s http://localhost:8001/api/ai/knowledge/status -H "x-ai-token: $AI_INTERNAL_TOKEN" | jq
curl -s http://localhost:8001/api/ai/knowledge/module/audit -H "x-ai-token: $AI_INTERNAL_TOKEN" | jq
```

Prueba de analisis sin contexto externo:

```bash
curl -s -X POST http://localhost:8001/api/ai/auditor/analyze \
  -H "Content-Type: application/json" \
  -H "x-ai-token: $AI_INTERNAL_TOKEN" \
  -d '{
    "tenant_context": {"tenant_id": "demo"},
    "active_standards": ["ISO27001"],
    "controls_summary": {
      "deteriorated_controls": 3,
      "controls_without_evidence": 2
    },
    "evidence_summary": {"old_evidence_count": 5},
    "risks_summary": {"high_residual_risks": 2},
    "requested_output": "audit_preparation",
    "allow_web_context": false
  }' | jq
```

Prueba con contexto externo opcional:

```bash
curl -s -X POST http://localhost:8001/api/ai/auditor/analyze \
  -H "Content-Type: application/json" \
  -H "x-ai-token: $AI_INTERNAL_TOKEN" \
  -d '{
    "tenant_context": {"tenant_id": "demo"},
    "active_standards": ["ISO27001"],
    "controls_summary": {
      "deteriorated_controls": 3,
      "controls_without_evidence": 2
    },
    "evidence_summary": {"old_evidence_count": 5},
    "risks_summary": {"high_residual_risks": 2},
    "requested_output": "audit_preparation",
    "allow_web_context": true,
    "web_context_topics": [
      "iso_best_practices",
      "cybersecurity_threats"
    ]
  }' | jq
```

## Agregar nuevas reglas

1. Editar o crear JSON en `ai-engine/knowledge/`.
2. Mantener JSON valido.
3. Si es un archivo nuevo, agregarlo a `EXPECTED_FILES` y `MODULE_FILE_MAP` en `knowledge_loader.py`.
4. Ejecutar `scripts/validate-ai-knowledge.sh`.
5. Reiniciar `ai-engine`.
6. Revisar `/api/ai/knowledge/status`.

## Revision de fuentes externas

Cuando una fase posterior use Brave Search en analisis, las fuentes deben quedar en la respuesta como `external_context.sources`, con titulo, URL, fuente, fecha de consulta y resumen. Si no se usa internet, la respuesta debe indicar `external_context.used=false`.
