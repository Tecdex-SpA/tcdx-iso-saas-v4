# IA Auditor Senior — Historial persistente

## Objetivo

La Fase 3K agrega trazabilidad persistente para las ejecuciones de IA Auditor Senior.

## Tabla

`ai_auditor_runs`

Migración:

`database/migrations/20260504_3k_ai_auditor_runs.sql`

## Seguridad

El historial no equivale a creación de registros críticos.

IA Auditor mantiene:

- `human_review_required=true`
- `can_create_records=false`
- `trace.db_write=false`

Cuando se guarda historial, el análisis agrega:

- `trace.history_saved=true`
- `trace.history_run_id=<uuid>`

## Endpoints

- `GET /api/ai-auditor/history`
- `GET /api/ai-auditor/history/:id`

## Aplicación de migración

```bash
scp database/migrations/20260504_3k_ai_auditor_runs.sql tecdex@192.168.100.110:/tmp/
ssh tecdex@192.168.100.110
psql -U tecdex -d tecdex_saas -f /tmp/20260504_3k_ai_auditor_runs.sql
```

Ajustar usuario/base si el ambiente usa otros nombres.

## Limitaciones

- No crea hallazgos, planes, evidencias ni no conformidades.
- No incluye PDF IA Auditor.
- No incluye workflow de revisión/aprobación.
