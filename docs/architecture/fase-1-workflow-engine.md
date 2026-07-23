# Fase 1 - Motor transversal de workflows

## Contrato

El runtime `/api/grc` usa definiciones/versiones inmutables, estados, transiciones, roles, instancias, historial, aprobaciones, comentarios, adjuntos y automatización. Toda decisión crítica se valida dentro de transacciones backend con permiso granular y tenant explícito.

## Aprobaciones múltiples

Modos: simple, secuencial, paralelo, quorum y unanimidad. La configuración publicada define pasos, usuarios/roles, cantidad requerida, quorum y vencimiento. El runtime admite aprobación, rechazo, devolución, reapertura, delegación, sustitución, comentarios y evidencia. Rechazo/devolución/reapertura exigen comentario; secuencia, identidad, rol y permiso se comprueban en backend. Cada decisión y reemplazo genera auditoría con correlation ID.

## Adaptadores runtime

`grcRuntimeAdapters.js` cubre Documentos, Evidencias, Controles, Riesgos, Auditorías y el dominio compartido Hallazgos/No conformidades/Acciones. Cada lectura usa entidad real + `tenant_id`, aplica permiso, expone workflow/estado/SLA/evidencia/readiness y registra evento/auditoría. Inicio y transición reutilizan el motor común.

## Operaciones adicionales

- `POST /api/grc/workflow-instances/:id/context`: comentario/evidencia.
- `POST /api/grc/approvals/:id/delegate`: delegación o sustitución.
- `GET/POST /api/grc/runtime/:entityType/:id[/workflows]`: adaptadores.
- `POST /api/grc/scheduler/run`: ejecución manual controlada.
- `GET/POST /api/grc/escalations/policies`: configuración tenant.

Los contratos legacy permanecen compatibles y no se duplicaron rutas visuales.
