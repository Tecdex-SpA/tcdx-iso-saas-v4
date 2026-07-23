# Fase 1 - Auditoría avanzada

## Alcance

El workspace integrado en `/auditorias` amplía `audits` con universo, plan anual, programa, equipo, independencia, conflictos, muestreo, papeles de trabajo, entrevistas, evidencia, revisión supervisora, informes y seguimiento. No se creó una ruta visual paralela.

## Revisión supervisora

- La asignación y cada decisión quedan en `grc_audit_supervisor_reviews` con versión, revisor, asignado, evidencia, revisión anterior y hash de confirmación.
- Decisiones: asignar, aprobar, devolver, solicitar cambios, reabrir y aceptar/bloquear.
- El preparador no puede revisar su propio papel; un conflicto abierto bloquea la revisión.
- Devolución, cambios y reapertura exigen observaciones.
- Aceptar bloquea el papel; reabrir incrementa su versión.
- `GET /api/grc/audits/:id/close-readiness` bloquea cierre si existen conflictos, devoluciones o papeles sin aprobar/bloquear.
- La cola y las acciones supervisoras viven en el panel actual de `/auditorias`.

## Exportación

Auditorías, hallazgos y acciones se exportan desde el mismo workspace en PDF, DOCX, XLSX o CSV. Cada artifact usa datos reales filtrados por tenant, persiste snapshot fuente, filtros, versión, fecha, nombre seguro, MIME, bytes y hashes de fuente/contenido. El download por ID devuelve exactamente los bytes persistidos.

## API

- `GET /api/grc/audits/workspace`
- `POST /api/grc/audits/annual-plans`
- `POST /api/grc/audits/workpapers`
- `POST /api/grc/audits/workpapers/:id/reviews`
- `GET /api/grc/audits/workpapers/:id/reviews`
- `GET /api/grc/audits/:id/close-readiness`
- `POST /api/grc/exports/:domain`
- `GET /api/grc/exports/:id/download`

Estos endpoints complementan, no reemplazan, `/api/audits`, `/api/audit-execution` y `/api/audit-preparation`.
