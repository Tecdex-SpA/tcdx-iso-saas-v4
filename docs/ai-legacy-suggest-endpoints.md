# AI Legacy Suggest Endpoints

Fecha: 2026-05-14

Esta pasada cierra el riesgo de que flujos legacy de sugerencias disparen análisis LLM pesados por defecto. El objetivo es preservar compatibilidad, exponer métricas de duración y mantener el camino rápido basado en datos internos + RAG.

| endpoint | file | current behavior | calls LLM? | default mode | risk | action applied |
|---|---|---|---|---|---|---|
| `POST /api/ai/suggest/health-summary` | `ai-engine/app/routes/ai.py` | Endpoint interno ai-engine. Usa `generate_health_summary()` de `guided_endpoint_adapter`, que combina reglas/guiado y conocimiento legacy. | No Ollama directo. | `deterministic` / `fast_mode` legacy. | Sin métricas explícitas antes. | Se agregó `metrics.duration_ms` y `engine` con `used_llm=false`. |
| `POST /api/ai/suggest/executive-brief` | `ai-engine/app/routes/ai.py` | Endpoint interno ai-engine. Usa `generate_executive_brief()` de `guided_endpoint_adapter`. | No Ollama directo. | `deterministic` / `fast_mode` legacy. | Sin métricas explícitas antes. | Se agregó `metrics.duration_ms` y `engine` con `used_llm=false`. |
| `GET /api/ai-compliance/health-summary` | `backend/src/routes/ai-compliance.routes.js` | Endpoint visible al frontend de IA Compliance. Antes llamaba ai-engine suggest legacy y v2 fast en paralelo. | No debía, pero duplicaba trabajo. | `fast_mode`. | Latencia innecesaria por llamada legacy paralela. | Se eliminó la llamada legacy por defecto; ahora usa IA v2 fast y arma respuesta legacy compatible. |
| `GET /api/ai-compliance/executive-brief` | `backend/src/routes/ai-compliance.routes.js` | Endpoint visible al frontend de IA Compliance. Antes llamaba ai-engine suggest legacy y v2 fast en paralelo. | No debía, pero duplicaba trabajo. | `fast_mode`. | Latencia innecesaria por llamada legacy paralela. | Se eliminó la llamada legacy por defecto; ahora usa IA v2 fast y arma respuesta legacy compatible. |
| Reportes ejecutivos | `backend/src/reports/services/reportData.service.js`, `backend/src/routes/reports.routes.js` | Reportes aún consumen `safeAiCall('/api/ai/suggest/*')` como complemento opcional con fallback. | No Ollama directo según implementación actual. | `deterministic` legacy. | Puede sumar latencia, pero no bloquea porque tiene fallback/timeout. | Documentado como pendiente de migrar a v2 fast si se requiere paridad total de métricas. |

## Comportamiento actual

- IA Compliance visible ya no llama `callAiEngine('/api/ai/suggest/health-summary')` ni `callAiEngine('/api/ai/suggest/executive-brief')` por defecto.
- Los endpoints internos legacy de ai-engine siguen existiendo para compatibilidad y reportes.
- Los endpoints internos legacy devuelven `engine.used_llm=false` y `metrics.duration_ms`.
- El análisis generativo/deep debe hacerse por rutas v2, por ejemplo `POST /api/ai-compliance/analyze` con `depth=standard|deep` y `fast_mode=false`.

## Pruebas post deploy

### IA Compliance health-summary rápido

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/ai-compliance/health-summary?tenant_id=$TENANT_ID&standard_code=ISO9001&operation_id=$OPERATION_ID" \
  | python3 -m json.tool
```

Esperado:

- `metrics.duration_ms` presente;
- `metrics.mode=fast_mode`;
- `engine.fast_mode=true`;
- `engine.used_llm=false`;
- respuesta rápida.

### IA Compliance executive-brief rápido

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/ai-compliance/executive-brief?tenant_id=$TENANT_ID&standard_code=ISO9001&operation_id=$OPERATION_ID" \
  | python3 -m json.tool
```

Esperado:

- `metrics.duration_ms` presente;
- `metrics.mode=fast_mode`;
- `engine.fast_mode=true`;
- `engine.used_llm=false`;
- respuesta rápida.

### Ruta deep explícita

```bash
time curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/ai-compliance/analyze" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"standard_code\":\"ISO9001\",
    \"operation_id\":\"$OPERATION_ID\",
    \"depth\":\"standard\",
    \"fast_mode\":false,
    \"local_compact\":true,
    \"use_llm_in_fast_mode\":true
  }" | python3 -m json.tool
```

Esperado:

- `metrics.duration_ms` presente;
- `engine.used_llm` puede ser `true` si Ollama está disponible;
- `engine.local_compact=true`;
- `engine.used_web=false` salvo `force_web=true`.

### ai-engine legacy suggest directo

```bash
time curl -s -H "X-AI-Token: $AI_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:8001/api/ai/suggest/health-summary" \
  -d "{
    \"tenant_id\":\"$TENANT_ID\",
    \"tenant_name\":\"Cliente\",
    \"standards\":[\"ISO9001\"],
    \"controls_total\":10,
    \"controls_warning\":2,
    \"controls_critical\":1,
    \"evidences_pending\":3,
    \"findings_critical\":0
  }" | python3 -m json.tool
```

Esperado:

- `engine.used_llm=false`;
- `metrics.duration_ms` presente.

