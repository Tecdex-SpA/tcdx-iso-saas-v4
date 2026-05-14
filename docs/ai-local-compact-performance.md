# AI Local Compact Performance

## Current Flow

Backend arma contexto multi-tenant con salud ISO efectiva y llama:

```txt
POST /api/ai/senior-auditor/analyze
```

En ai-engine:

1. `senior_auditor_orchestrator.py` valida payload.
2. Aplica guardrails.
3. Consulta RAG.
4. Evalúa Drive/documentos.
5. Evalúa Brave/web según política.
6. Construye preanálisis determinístico.
7. Llama Ollama si está disponible.
8. Normaliza `structured_result`.
9. Aplica guardrails finales.

## Riesgos De Latencia Detectados

- Prompt maestro completo demasiado grande para modelos locales pequeños.
- Contexto bruto con arrays extensos.
- Brave/web y Drive usados demasiado seguido.
- Falta de límites `num_predict` por profundidad.
- El LLM recibía demasiada responsabilidad de descubrir brechas desde datos crudos.

## local_compact

`local_compact` se activa cuando:

- `LLM_PROVIDER=ollama`
- `AI_ENGINE_LOCAL_COMPACT=true`
- `payload.options.local_compact=true`

Puede desactivarse por request con:

```json
{ "options": { "local_compact": false } }
```

## Variables

```env
AI_ENGINE_LOCAL_COMPACT=true
AI_ENGINE_LOCAL_COMPACT_MAX_CONTROLS=8
AI_ENGINE_LOCAL_COMPACT_MAX_EVIDENCES=5
AI_ENGINE_LOCAL_COMPACT_MAX_FINDINGS=5
AI_ENGINE_LOCAL_COMPACT_MAX_ACTIONS=5
AI_ENGINE_LOCAL_COMPACT_USE_WEB=false
AI_ENGINE_LOCAL_COMPACT_USE_DRIVE=auto
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_EXECUTIVE=220
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_STANDARD=420
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_DEEP=700
AI_ENGINE_LOCAL_COMPACT_NUM_CTX=2048
```

## Compact Context

En modo compacto se conserva:

- resumen efectivo activo;
- peores controles primero;
- evidencias recientes limitadas;
- hallazgos/NC abiertos limitados;
- planes abiertos/vencidos limitados;
- documentos solo por metadata, sin textos largos;
- `source_trace`;
- `limitations`.

Se omite o resume:

- arrays grandes;
- texto largo;
- documentos completos;
- datos fuera de alcance.

## Prompt Compacto

Archivo:

```txt
ai-engine/prompts/iso_senior_auditor_compact.md
```

El prompt exige JSON válido, respuesta breve y límites por profundidad:

- executive: <= 180 palabras, 3 brechas, 3 acciones.
- standard: <= 300 palabras, 5 brechas, 5 acciones.
- deep: <= 500 palabras, 8 brechas, 8 acciones.

## Ollama Options

En `local_compact`, `llm_client.py` envía:

- `temperature = 0.2`
- `top_p = 0.9`
- `repeat_penalty = 1.05`
- `num_ctx = 2048`
- `num_predict` según profundidad:
  - executive: 220
  - standard: 420
  - deep: 700

## Source Policy

RAG:

- siempre habilitado si existe;
- executive: 2 resultados;
- standard: 3 resultados;
- deep: 5 resultados.

Drive:

- executive: solo si hay entidad directa y documento coincidente;
- standard: solo si hay match directo;
- deep: permitido si se solicitó y es relevante.

Brave:

- executive: deshabilitado por defecto;
- standard: deshabilitado salvo `force_web=true`;
- deep: permitido si `use_web=true`.

## Cache

Cache en memoria omitida por ahora. Razón: antes de cachear respuestas con contexto de cumplimiento, conviene cerrar invalidación por cambios de evidencia/plan/NC para evitar respuestas stale. El modo compacto ya reduce prompt/contexto sin riesgo de stale data.

## IA Compliance

Las llamadas v2 de resumen/brief se ajustan a `local_compact`, `depth=executive`, `use_web=false`, `use_drive=auto`. El análisis profundo queda para acciones explícitas.

## Pruebas Post-Deploy

```bash
time curl --connect-timeout 3 --max-time 10 -i -s http://192.168.100.140:8001/health | head -n 40
```

```bash
time curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:1.5b",
    "prompt": "Responde solo: OK",
    "stream": false,
    "options": { "num_predict": 10, "temperature": 0.2 }
  }'
```

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/controls/$TENANT_CONTROL_ID/ai-analyze" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"standard_code\":\"ISO9001\",
    \"operation_id\":\"$OPERATION_ID\",
    \"depth\":\"executive\",
    \"local_compact\":true
  }" | python3 -m json.tool
```

Respuesta esperada:

- `engine.local_compact = true`
- `engine.fast_mode = true` para `depth=executive` salvo override
- `engine.used_llm = false` en fast executive por defecto
- `engine.used_rag = true`
- `engine.used_web = false` salvo `force_web=true`
- `structured_result` existe
- `answer` existe

## Fast Mode Determinístico

La optimización principal ya no intenta que Ollama sea siempre rápido. En `local_compact + executive`, ai-engine devuelve una respuesta determinística basada en salud efectiva y RAG sin llamar al LLM. Esto evita esperas de 40+ segundos para análisis rápidos de control/estado.

Para solicitar redacción con LLM:

```json
{
  "depth": "standard",
  "local_compact": true,
  "fast_mode": false
}
```

O bien:

```json
{
  "depth": "executive",
  "local_compact": true,
  "fast_mode": true,
  "use_llm_in_fast_mode": true
}
```

IA Compliance health/brief usa `fast_mode=true` y `use_llm_in_fast_mode=false`; el análisis generativo queda para acciones explícitas.

## Métricas de Duración

Las respuestas IA relevantes exponen:

- `metrics.duration_ms`
- `metrics.mode`
- `metrics.fast_mode`
- `metrics.local_compact`
- `metrics.used_llm`
- `metrics.used_rag`
- `metrics.used_drive`
- `metrics.used_web`

Los endpoints internos legacy de ai-engine `/api/ai/suggest/health-summary` y `/api/ai/suggest/executive-brief` también devuelven `engine.used_llm=false` y `metrics.duration_ms`.
