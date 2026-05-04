# IA Auditor Senior — Reporte PDF ejecutivo

## Objetivo

La Fase 3L permite generar un PDF ejecutivo premium desde IA Auditor Senior.

El reporte puede generarse desde:

- un análisis actual;
- una ejecución histórica guardada en `ai_auditor_runs`.

## Endpoints

### POST /api/ai-auditor/report

Genera PDF desde el análisis actual enviado por frontend.

### GET /api/ai-auditor/history/:id/report

Genera PDF desde una ejecución histórica.

El backend valida que el `history_run_id` pertenece al tenant autenticado.

## Seguridad

El PDF no crea registros críticos.

Se mantiene:

- `human_review_required=true`;
- `can_create_records=false`;
- `trace.db_write=false`.

El PDF es un entregable documental, no una aprobación ni cierre de auditoría.

## Contenido del PDF

- Encabezado TCDX by Tecdex.
- Empresa/tenant.
- Fecha de emisión.
- Score.
- Readiness.
- Cobertura.
- Resumen ejecutivo.
- Opinión auditora.
- Brechas principales.
- Evidencias solicitadas.
- Hallazgos sugeridos.
- Planes sugeridos.
- Próximos pasos.
- Trazabilidad.
- Advertencia de revisión humana.

## Validación

El curl post-fase 3L valida:

- HTTP 200;
- tamaño PDF mayor a 5 KB;
- análisis no destructivo;
- descarga desde histórico.
