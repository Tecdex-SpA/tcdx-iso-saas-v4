# IA Auditor Senior — Fase 3

## Objetivo

IA Auditor Senior entrega una evaluación auditora no destructiva usando datos reales del tenant.

## Alcance inicial

- GET `/api/ai-auditor/scope`
- POST `/api/ai-auditor/analyze`
- POST `/api/ai-auditor/suggestions/:type/prepare`
- Vista frontend `/ia-auditor`

## Seguridad

IA Auditor:

- no aprueba controles;
- no cierra planes;
- no crea hallazgos definitivos;
- no modifica evidencias;
- no modifica datos históricos;
- requiere revisión humana.

## Datos considerados

- normas activas;
- controles;
- evidencias;
- hallazgos abiertos;
- planes de acción abiertos/vencidos;
- health por norma;
- auditorías recientes;
- ciclo de vida si existe.

## Roles

Solo lectura:

- gerencia;
- auditor externo;
- consultor externo;
- responsable de área.

Ejecución IA:

- responsable ISO;
- auditor interno;
- CISO;
- compliance manager.

Aprobación humana:

- administrador tenant;
- responsable ISO principal;
- auditor líder.

## Validación

```bash
node -c backend/src/routes/ai-auditor.routes.js
cd frontend && npm run build
```

Post deploy:

```bash
GET /api/ai-auditor/scope
POST /api/ai-auditor/analyze
```

## Límite de Fase 3 inicial

Esta fase no toca DB, no toca PDF y no obliga a ai-engine. Deja una base segura para evolucionar hacia análisis IA más profundo.


## Fase 3B — Conexión con ai-engine

El endpoint `POST /api/ai-auditor/analyze` ahora intenta enriquecer el análisis usando ai-engine mediante:

- `POST /api/ai/auditor/analyze` en la VM IA.
- Header interno `X-AI-Token`.
- Header `x-tcdx-locale`.

El backend conserva el análisis determinístico como fallback.

### Reglas de seguridad

- Si ai-engine falla, responde lento o devuelve JSON inválido, el backend retorna fallback sin error HTTP.
- `human_review_required` siempre queda en `true`.
- `can_create_records` siempre queda en `false`.
- No escribe en base de datos.
- No crea hallazgos.
- No cierra planes.
- No modifica evidencias.
- No toca PDF.

### Trazabilidad

La respuesta incluye:

```json
{
  "trace": {
    "ai_engine_used": true,
    "source": "ai_engine_senior_auditor",
    "endpoint": "/api/ai/auditor/analyze"
  }
}
```

Si se usa fallback:

```json
{
  "trace": {
    "ai_engine_used": false,
    "ai_engine_error": "..."
  }
}
```


## Fase 3C — Scope normalizado

El scope global del IA Auditor normaliza ahora el conteo de controles para evitar inconsistencias entre `counts.controls_total`, `health_by_standard` y `coverage`.

### Fuente de controles

El backend calcula `controls_total` con prioridad:

1. `control_health_scores`, usando la suma de `health_by_standard.controls`.
2. `tenant_controls`, si existe una columna usable para norma:
   - `standard_code`
   - `iso_code`
   - `iso`
3. fallback seguro con advertencia.

La respuesta incluye:

```json
{
  "controls_by_standard": [
    {
      "standard_code": "ISO27001",
      "controls": 48,
      "source": "control_health_scores"
    }
  ],
  "sources": {
    "controls_source": "control_health_scores",
    "warnings": []
  }
}
```

### Reglas

- No escribe en base de datos.
- No modifica datos históricos.
- No cambia endpoints.
- Mantiene fallback si ai-engine falla.
- Mantiene `human_review_required=true`.
- Mantiene `can_create_records=false`.
