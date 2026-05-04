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


## Fase 3D — UI ejecutiva

La vista `/ia-auditor` incorpora una experiencia ejecutiva para demo y operación:

- selector dinámico de norma;
- selector de foco auditor;
- selector de profundidad;
- trazabilidad visible de ai-engine;
- fuente normalizada de controles;
- controles por norma;
- advertencia permanente de revisión humana;
- confirmación visual de que no se crean registros automáticamente.

### Filtros

La UI envía al backend:

```json
{
  "standard_code": "ISO27001",
  "audit_focus": "general",
  "depth": "executive",
  "locale": "en"
}
```

### Criterio de demo

El usuario debe poder ejecutar análisis con:

- todas las normas;
- ISO27001;
- ISO9001;
- idioma español;
- idioma inglés.

El módulo sigue siendo no destructivo.


## Fase 3E — Sugerencias accionables

El módulo permite preparar sugerencias sin crear registros.

### Endpoint

`POST /api/ai-auditor/suggestions/:type/prepare`

Tipos soportados:

- `finding`
- `nonconformity`
- `evidence`
- `action_plan`

La respuesta incluye:

```json
{
  "ok": true,
  "can_create_records": false,
  "human_review_required": true,
  "deep_link": "/hallazgos?source=ai-auditor&draft=1&draft_key=...",
  "storage_key": "tcdx_ai_auditor_draft_...",
  "prepared_payload": {}
}
```

### Flujo frontend

1. El usuario ejecuta IA Auditor.
2. Elige una sugerencia.
3. Presiona preparar.
4. El frontend guarda el payload temporal en `sessionStorage`.
5. El usuario es redirigido al módulo correspondiente.
6. No se crea registro automáticamente.

### Seguridad

- No escribe en base de datos.
- No crea hallazgos.
- No crea planes.
- No aprueba ni cierra registros.
- La aprobación humana sigue siendo obligatoria.


## Fase 3F — Prefill seguro en módulos destino

El flujo de sugerencias accionables ahora permite que `/hallazgos` y `/plan-accion` lean borradores temporales preparados por IA Auditor Senior.

### Flujo

1. `/ia-auditor` prepara una sugerencia.
2. El frontend guarda el `prepared_payload` en `sessionStorage`.
3. El usuario es redirigido con `draft_key`.
4. El módulo destino lee `sessionStorage[draft_key]`.
5. Se muestra un banner de revisión humana.
6. Se prellenan campos del formulario.
7. No se guarda automáticamente.

### Módulos soportados en 3F

- `/hallazgos`
- `/plan-accion`

### Pendientes

- `/evidencias`
- `/no-conformidades`

### Seguridad

- No hay POST/PUT automático.
- No se crean registros automáticamente.
- No se modifican datos existentes.
- El payload se borra solo si el usuario descarta el borrador o lo limpia manualmente.


## Fase 3G — Prefill seguro en Evidencias y No Conformidades

El flujo de borradores IA Auditor se extendió a:

- `/evidencias`
- `/no-conformidades`

### Evidencias

El módulo lee `draft_key`, valida el payload temporal y prellena la descripción/contexto de carga.

Limitación deliberada:

- No adjunta archivos automáticamente.
- El usuario debe adjuntar archivo o evidencia antes de guardar.
- No ejecuta subida automática.

### No conformidades

El módulo lee `draft_key`, valida el payload temporal y muestra una tarjeta de borrador con:

- título sugerido;
- prioridad/severidad;
- norma;
- descripción preparada.

### Seguridad

- No hay POST/PUT automático.
- No se crean evidencias automáticamente.
- No se crean no conformidades automáticamente.
- El usuario puede descartar el borrador.
- El payload de cliente no se traduce.


## QA automatizado

La Fase 3H agrega el script:

```bash
scripts/qa-ai-auditor-full.sh
```

Este QA valida el flujo IA Auditor Senior end-to-end sin crear registros ni modificar datos.
Ver detalle en `docs/qa-ai-auditor-full.md`.


## Fase 3I — Integración en navegación, dashboard y auditorías

IA Auditor Senior queda integrado como módulo formal del sistema:

- acceso desde el sidebar como `IA Auditor` / `AI Auditor`;
- CTA ejecutivo en dashboard;
- CTA contextual en auditorías humanas;
- ruta `/ia-auditor` protegida bajo el módulo de auditorías;
- no ejecuta análisis automáticamente desde dashboard ni auditorías;
- no crea registros ni modifica datos.

### Seguridad

La integración es solo de navegación y acceso visual. El análisis sigue ejecutándose manualmente desde `/ia-auditor` y conserva:

- `human_review_required=true`;
- `can_create_records=false`;
- `trace.db_write=false`.


## Fase 3J — Cierre funcional y hardening

IA Auditor Senior queda cerrado como primera versión productiva no destructiva.

### Garantías funcionales

- No crea registros automáticamente.
- No cierra hallazgos.
- No aprueba planes.
- No modifica evidencias.
- No escribe en base de datos durante análisis.
- Mantiene `human_review_required=true`.
- Mantiene `can_create_records=false`.
- Mantiene `trace.db_write=false` en análisis.

### Drafts IA Auditor

Los borradores preparados se transportan por `sessionStorage` usando `draft_key`.

El helper `frontend/src/utils/aiAuditorDraft.ts` valida:

- origen `ai_auditor_senior`;
- `human_review_required=true`;
- `can_create_records=false`;
- tamaño máximo del payload;
- tipos permitidos;
- recorte de campos largos.

### Módulos integrados

- `/ia-auditor`
- `/hallazgos`
- `/plan-accion`
- `/evidencias`
- `/no-conformidades`
- `/dashboard`
- `/auditorias`

### QA

La validación operacional se realiza con:

```bash
scripts/qa-ai-auditor-full.sh
```

## Fase 3K — Historial persistente

IA Auditor Senior guarda ejecuciones en `ai_auditor_runs` cuando la migración está aplicada. El guardado es no destructivo y no crea registros críticos. Si el guardado falla o la tabla no existe, el análisis sigue funcionando y la traza informa `history_saved=false`.

## Fase 3K.2 — Frontend historial

`/ia-auditor` muestra historial reciente de ejecuciones guardadas en `ai_auditor_runs`, permite abrir detalle y no bloquea el análisis si el historial no está disponible.

## Fase 3L — Reporte PDF

IA Auditor Senior puede generar PDF ejecutivo desde análisis actual o desde historial persistente. El PDF no crea registros críticos y conserva las marcas `human_review_required=true`, `can_create_records=false` y `trace.db_write=false`.

## Fase 3M — Revisión humana

Las ejecuciones históricas de IA Auditor pueden marcarse como revisadas, aceptadas, rechazadas o pendientes de más evidencia. Esto deja trazabilidad humana sin cerrar ni aprobar controles automáticamente.

## Fase 3N — PDF con gobernanza

El reporte PDF de IA Auditor incluye revisión humana, gobernanza y trazabilidad reforzada. Mantiene explícitamente que la IA no crea, cierra ni aprueba registros críticos.
