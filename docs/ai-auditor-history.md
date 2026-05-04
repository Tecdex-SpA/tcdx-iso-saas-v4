# IA Auditor Senior — Historial persistente

## Estado Fase 3K.2

El historial persistente queda visible en `/ia-auditor` y validado por QA.

## Qué guarda

La tabla `ai_auditor_runs` registra ejecuciones de IA Auditor Senior por tenant:

- usuario ejecutor;
- locale;
- norma;
- foco auditor;
- profundidad;
- score;
- readiness;
- uso de ai-engine;
- resumen;
- cobertura;
- sugerencias;
- resultado completo;
- trace.

## Endpoints

- `GET /api/ai-auditor/history`
- `GET /api/ai-auditor/history/:id`

## Seguridad

El historial no crea registros críticos.

Se mantiene:

- `human_review_required=true`;
- `can_create_records=false`;
- `trace.db_write=false`.

El guardado histórico se marca aparte:

- `trace.history_saved=true`;
- `trace.history_run_id=<uuid>`.

## UI

`/ia-auditor` muestra:

- historial reciente;
- detalle de ejecución;
- resumen ejecutivo;
- brechas principales;
- próximos pasos;
- trazabilidad.

## Validación

```bash
API_URL=http://192.168.100.120:3000 \
FRONTEND_URL=http://192.168.100.130:3000 \
EMAIL=admin@rieltec.com \
PASSWORD=123456 \
bash ./scripts/qa-ai-auditor-full.sh
```

## Reporte PDF desde historial

Cada ejecución histórica puede exportarse mediante `GET /api/ai-auditor/history/:id/report`, validando tenant desde JWT.
