# AI Report Fallback Migration

Fecha: 2026-05-14

## Objetivo

Migrar reportes/exportes desde el fallback legacy `/api/ai/suggest/health-summary` y `/api/ai/suggest/executive-brief` hacia el flujo v2 fast/local_compact. La generación de reportes no debe esperar Ollama por defecto.

## Mapa de callers

| file | function | current fallback call | current purpose | migrated_to | action |
|---|---|---|---|---|---|
| `backend/src/reports/services/reportData.service.js` | `getAiEnhancements()` | `safeAiCall('/api/ai/suggest/executive-brief')` | Enriquecer `executive_brief` del reporte | `buildReportAiEnrichment()` | Migrado. Usa v2 fast y deriva `executive_brief`, `health_summary`, `ai_enrichment`, `ai_metrics`. |
| `backend/src/reports/services/reportData.service.js` | `getAiEnhancements()` | `safeAiCall('/api/ai/suggest/health-summary')` | Enriquecer `health_summary` del reporte | `buildReportAiEnrichment()` | Migrado. Ya no llama suggest health-summary. |
| `backend/src/routes/reports.routes.js` | `buildAiReportAddendum()` | `fetch('/api/ai/suggest/executive-brief')` | Addendum IA para reporte premium | `buildReportAiEnrichment()` | Migrado. Mantiene fallback interno si el enriquecimiento falla. |
| `backend/src/reports/services/reportData.service.js` | análisis de hallazgos top | `safeAiCall('/api/ai/suggest/finding-analysis')` | Análisis breve de hallazgos específicos | Sin cambio | No corresponde a `health-summary/executive-brief`; queda fuera de esta pasada. |
| `ai-engine/app/routes/ai.py` | endpoints legacy suggest | `/api/ai/suggest/*` | Compatibilidad interna/externa | Preservado | Siguen disponibles, rápidos, métricas activas, sin LLM por defecto. |

## Nuevo comportamiento

`backend/src/services/reportAiEnrichment.service.js` centraliza el enriquecimiento v2 para reportes:

- usa `aiContextBuilder`;
- llama `aiEngineClient.analyzeWithSeniorAuditor`;
- fuerza `local_compact=true`;
- fuerza `fast_mode=true` por defecto;
- fuerza `use_llm_in_fast_mode=false`;
- usa RAG;
- no usa Brave/web;
- Drive queda en `auto`;
- devuelve objeto normalizado para reportes.

Campos aditivos en `reportData.service.js`:

- `ai_enrichment`
- `ai_summary`
- `ai_recommended_actions`
- `ai_limitations`
- `ai_metrics`

Los campos existentes `executive_brief`, `health_summary`, `senior_auditor`, `top_finding_analyses` se preservan.

## Métricas

El enriquecimiento devuelve:

- `metrics.duration_ms`
- `metrics.mode`
- `metrics.used_llm`
- `metrics.used_rag`
- `metrics.used_drive`
- `metrics.used_web`
- `metrics.report_type`

Por defecto se espera:

- `mode=fast_mode`
- `used_llm=false`
- `used_web=false`

## Compatibilidad legacy

Los endpoints internos legacy no se eliminan:

- `/api/ai/suggest/health-summary`
- `/api/ai/suggest/executive-brief`

Siguen disponibles para integraciones externas o pruebas, pero reportes ya no los prefieren como fallback.

## Pruebas post deploy

### Generar reporte

Usar el endpoint real de generación configurado en el entorno:

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/reports/generate" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"report_type_code\":\"executive_iso_status\",
    \"period\":\"Periodo actual\"
  }" | python3 -m json.tool
```

Esperado si el endpoint responde JSON:

- reporte generado;
- `ai_enrichment` o `ai_summary` disponible en payload interno si aplica;
- `ai_metrics.duration_ms` presente cuando se incluye data IA;
- `ai_metrics.used_llm=false` por defecto;
- sin dependencia requerida de `/api/ai/suggest/health-summary` o `/api/ai/suggest/executive-brief`.

### Validar servicio v2 fast indirectamente

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/ai-compliance/analyze" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"standard_code\":\"ISO9001\",
    \"depth\":\"executive\",
    \"local_compact\":true,
    \"fast_mode\":true
  }" | python3 -m json.tool
```

Esperado:

- `engine.fast_mode=true`;
- `engine.used_llm=false`;
- `metrics.duration_ms` presente.

### Legacy aún disponible

```bash
time curl -s -H "X-AI-Token: $AI_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:8001/api/ai/suggest/executive-brief" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"tenant_name\":\"Cliente\",
    \"standards\":[\"ISO9001\"],
    \"controls_total\":10,
    \"controls_warning\":2,
    \"controls_critical\":1,
    \"evidences_pending\":3,
    \"findings_critical\":0,
    \"weakest_standards\":[]
  }" | python3 -m json.tool
```

Esperado:

- `engine.used_llm=false`;
- `metrics.duration_ms` presente.

