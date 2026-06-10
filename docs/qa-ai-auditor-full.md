# QA IA Auditor Senior completo

## Objetivo

`scripts/qa-ai-auditor-full.sh` valida el flujo IA Auditor Senior end-to-end desde la Mac contra las VMs del sistema.

## Qué valida

- Login y obtención de token.
- `GET /api/ai-auditor/scope`.
- Scope filtrado por `ISO27001` e `ISO9001`.
- `POST /api/ai-auditor/analyze` en inglés y español.
- Trazabilidad:
  - `trace.ai_engine_used`.
  - `trace.db_write=false`.
- Seguridad:
  - `human_review_required=true`.
  - `can_create_records=false`.
- `POST /api/ai-auditor/suggestions/:type/prepare` para:
  - finding.
  - action_plan.
  - evidence.
  - nonconformity.
- Deep links hacia módulos destino.
- Rutas frontend:
  - `/ia-auditor`.
  - `/hallazgos`.
  - `/plan-accion`.
  - `/evidencias`.
  - `/no-conformidades`.

## Qué NO valida

- No valida visualmente que sessionStorage prellene formularios.
- No crea registros reales.
- No sube archivos.
- No guarda hallazgos, planes, evidencias ni no conformidades.
- No modifica datos.

## Ejecución

Desde la raíz del repo:

```bash
API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
EMAIL="<qa-user-email>" \
PASSWORD="<qa-user-password>" \
bash ./scripts/qa-ai-auditor-full.sh
```

## Resultados

El script genera:

- `qa-results/qa-ai-auditor-full-YYYYMMDD_HHMMSS.txt`
- `qa-results/qa-ai-auditor-full-YYYYMMDD_HHMMSS.json`
- `qa-results/qa-ai-auditor-full-YYYYMMDD_HHMMSS.md`

## Interpretación

- `PASS`: validación correcta.
- `WARN`: condición aceptable que debe revisarse, por ejemplo fallback seguro si ai-engine no responde.
- `FAIL`: error que impide cerrar la fase.

## Seguridad

El script solo usa endpoints seguros:

- login;
- scope;
- analyze;
- suggestions prepare;
- GET/HEAD de frontend.

No ejecuta endpoints destructivos.


## Hardening Fase 3J

La validación incluye también rutas de integración visual:

- `/dashboard`
- `/auditorias`

El QA mantiene el principio de no destructividad:

- no crea hallazgos;
- no crea planes;
- no crea evidencias;
- no crea no conformidades;
- solo usa `scope`, `analyze`, `suggestions/:type/prepare` y rutas HTTP de frontend.

## Historial Fase 3K

Validar `GET /api/ai-auditor/history`, `trace.history_saved`, `trace.history_run_id` y detalle histórico cuando existe. Si la migración aún no está aplicada, reportar WARN, no FAIL, siempre que el análisis siga operativo.

## Fase 3K.2

El QA valida historial antes/después de análisis, `trace.history_saved`, `trace.history_run_id` y detalle histórico si existe run id.

## Validación revisión humana

El QA ejecuta una revisión controlada sobre un `history_run_id` generado por el propio análisis y valida que el detalle histórico devuelva `human_review_status=accepted`.

## Cierre Fase 3O

El QA IA Auditor es la validación principal para cierre productivo inicial. Debe ejecutarse después del deploy y terminar con `FAIL: 0`.
