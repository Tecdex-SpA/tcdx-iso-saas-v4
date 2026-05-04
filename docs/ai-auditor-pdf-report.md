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

## Fase 3N — Revisión humana y gobernanza en PDF

El PDF ejecutivo incluye una sección específica de revisión humana cuando el reporte se genera desde una ejecución histórica.

Incluye:

- estado de revisión humana;
- comentario de revisión;
- usuario/identificador del revisor cuando está disponible;
- fecha de revisión;
- advertencia de que la revisión humana del informe IA no equivale a cierre formal de auditoría;
- confirmación de que IA Auditor no crea registros críticos automáticamente.

El reporte sigue siendo un entregable documental y no reemplaza la validación formal del auditor humano.
