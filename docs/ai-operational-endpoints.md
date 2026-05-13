# AI Operational Endpoints

Estos endpoints exponen el contrato IA v2 fuera de IA Auditor/IA Compliance. Son endpoints backend pequeños: validan autenticación, verifican tenant, construyen contexto con salud ISO efectiva y delegan razonamiento al `ai-engine`.

Todos retornan:

- `answer`
- `structured_result`
- `source_trace`
- `confidence`
- `limitations`
- `engine`

## Endpoints implementados

| módulo | endpoint | task_type | contexto |
|---|---|---|---|
| Controles | `POST /api/controls/:tenant_control_id/ai-analyze` | `control_analysis` | `buildAiControlContext` |
| Evidencias | `POST /api/evidences/:evidence_id/ai-review` | `evidence_review` | control vinculado o `buildAiEvidenceContext` |
| Planes de acción | `POST /api/action-plans/:action_plan_id/ai-review` | `action_plan_review` | control vinculado o `buildAiActionPlanContext` |
| Hallazgos | `POST /api/findings/:finding_id/ai-review` | `standard_gap_analysis` | control vinculado o `buildAiFindingContext` |
| No conformidades | `POST /api/nonconformities/:nonconformity_id/ai-review` | `standard_gap_analysis` | control vinculado o contexto tenant |

## Ejemplos post-deploy

Control:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/controls/TENANT_CONTROL_ID/ai-analyze \
  -d '{
    "tenant_id":"TENANT_ID",
    "standard_code":"ISO27001",
    "operation_id":"OPERATION_ID",
    "depth":"deep"
  }' | python3 -m json.tool
```

Evidencia:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/evidences/EVIDENCE_ID/ai-review \
  -d '{
    "tenant_id":"TENANT_ID",
    "depth":"standard"
  }' | python3 -m json.tool
```

Plan de acción:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/action-plans/ACTION_PLAN_ID/ai-review \
  -d '{
    "tenant_id":"TENANT_ID",
    "depth":"standard"
  }' | python3 -m json.tool
```

Hallazgo:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/findings/FINDING_ID/ai-review \
  -d '{
    "tenant_id":"TENANT_ID",
    "depth":"standard"
  }' | python3 -m json.tool
```

No conformidad:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/nonconformities/NONCONFORMITY_ID/ai-review \
  -d '{
    "tenant_id":"TENANT_ID",
    "depth":"standard"
  }' | python3 -m json.tool
```

## Frontend rollout pendiente

La UI operativa queda como siguiente pasada para evitar riesgo visual en módulos ya estables. Plan exacto:

1. Agregar botón `Analizar con IA` en detalle o fila seleccionada de controles.
2. Reutilizar el render de `structured_result` ya usado por IA Auditor/IA Compliance.
3. Añadir drawer/modal común con diagnóstico, brechas, acciones, fuentes, confianza y limitaciones.
4. Repetir en evidencias, plan de acción, hallazgos y no conformidades con el mismo componente.
5. Ejecutar `cd frontend && npm run build` y prueba visual por módulo.
