# AI Fast Mode Determinístico + RAG

Fecha: 2026-05-14

## Objetivo

`fast_mode` permite que IA Auditor, IA Compliance y endpoints operativos entreguen un resultado útil sin esperar a Ollama. El modo usa:

- datos internos;
- `public.v_iso_effective_kpi_summary`;
- `public.v_iso_control_effective_health`;
- RAG baseline ISO;
- preanálisis determinístico.

Ollama queda disponible para análisis estándar/profundo, pero ya no es obligatorio para una respuesta ejecutiva.

## Activación

`fast_mode` se activa cuando:

- `payload.options.fast_mode=true`;
- `payload.options.local_compact=true` y `depth=executive`;
- `AI_ENGINE_FAST_MODE=true`.

En `fast_mode`, el motor devuelve:

```json
{
  "engine": {
    "fast_mode": true,
    "used_llm": false,
    "llm_skipped_reason": "fast_mode_deterministic_response",
    "used_internal_context": true,
    "used_rag": true
  }
}
```

Para forzar LLM aun en modo rápido:

```json
{
  "options": {
    "fast_mode": true,
    "use_llm_in_fast_mode": true
  }
}
```

## Preanálisis determinístico

`build_deterministic_preanalysis()` genera un `structured_result` completo:

- resumen ejecutivo;
- diagnóstico;
- hechos confirmados;
- inferencias;
- brechas;
- evaluación de evidencia;
- impacto de riesgo;
- readiness de auditoría;
- acciones recomendadas con criterios de aceptación;
- preguntas de auditor;
- documentos a solicitar;
- trazabilidad;
- confianza;
- limitaciones.

La lógica calcula:

- controles activos en alcance;
- cumplimiento efectivo;
- evidencia oficial;
- controles sin evidencia;
- planes vencidos;
- no conformidades abiertas;
- salud efectiva promedio.

## Uso de RAG

El RAG baseline aporta evidencia esperada, brechas típicas, preguntas auditoras y criterios de cierre. En `fast_mode`, esto mejora la especificidad sin aumentar latencia con LLM.

Comportamiento esperado:

- `engine.used_rag=true` si hay matches;
- `structured_result.rag_context_used` no vacío;
- `source_trace` incluye `source=rag`;
- el `answer` puede mencionar `Como referencia normativa interna...`.

## IA Compliance

Los endpoints de resumen/brief de IA Compliance ahora llaman al flujo v2 con:

```json
{
  "depth": "executive",
  "local_compact": true,
  "fast_mode": true,
  "use_llm_in_fast_mode": false,
  "use_web": false,
  "use_drive": "auto",
  "use_rag": true
}
```

El análisis pesado queda para `POST /api/ai-compliance/analyze` o solicitudes explícitas con `depth=standard|deep`.

## Pruebas post deploy

### Fast executive sin LLM

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/controls/$TENANT_CONTROL_ID/ai-analyze" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"standard_code\":\"ISO9001\",
    \"operation_id\":\"$OPERATION_ID\",
    \"depth\":\"executive\",
    \"local_compact\":true,
    \"fast_mode\":true
  }" | python3 -m json.tool
```

Esperado:

- `engine.fast_mode=true`;
- `engine.used_llm=false`;
- `structured_result.recommended_actions` con contenido si existen brechas;
- respuesta idealmente bajo 10 segundos, dependiente de red y DB.

### Standard con LLM

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/controls/$TENANT_CONTROL_ID/ai-analyze" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"standard_code\":\"ISO9001\",
    \"operation_id\":\"$OPERATION_ID\",
    \"depth\":\"standard\",
    \"local_compact\":true,
    \"fast_mode\":false
  }" | python3 -m json.tool
```

Esperado:

- `engine.used_llm=true` si Ollama está disponible;
- `engine.local_compact=true`;
- `engine.used_web=false` salvo `force_web=true`.

