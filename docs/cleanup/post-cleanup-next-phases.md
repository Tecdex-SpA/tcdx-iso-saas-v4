# Plan de fases posteriores al cleanup

Fecha: 2026-06-12

El cleanup frontend/legacy queda cerrado. Los siguientes trabajos deben
mantenerse separados para evitar mezclar decisiones de producto, seguridad,
DBA y mantenibilidad.

| Fase | Objetivo | Riesgo | Bloquea MVP | Recomendacion |
| ---- | -------- | -----: | ----------: | ------------- |
| Fase IA | Fusionar `/ia` dentro de `/ia-compliance` y retirar `/ia` solo cuando la funcionalidad util este cubierta. | Medio | No | Crear matriz de paridad UI/API, preservar trazabilidad y validar entitlements/RBAC. |
| Documentos / Integraciones | Revisar `/documentos`, document integrations, Google/Zoho y contrato backend antes de mover o exponer. | Alto | No | Separar primero contrato documental de la auditoria OAuth; probar lifecycle y tenant isolation. |
| Backend Routes | Revisar `report.routes.js` y otras rutas no montadas o duplicadas. | Alto | No | Mapear consumidores y pruebas antes de cuarentena; no mezclar con cambios de reportes MVP. |
| DBA | Revisar QA fixes, seeds, migraciones con `DROP`/`DELETE`, drift DB, indices tenant y RLS. | Alto | No | Inspeccion estructural primero; ejecutar SQL solo con aprobacion, backup y rollback. |
| Scripts | Clasificar scripts QA, validate, patch, deploy, backup y restore por uso real. | Medio | No | Asignar owner, entorno, efecto, secretos y estado CI/manual/legacy. |
| Seguridad / Integraciones | Revisar OAuth Google/Zoho, Sync Agent, IA traces, external lookup y exposicion multi-tenant. | Alto | No | Ejecutar threat model y pruebas negativas tenant-scoped sin imprimir secretos. |
| Calidad Frontend | Reducir warnings TypeScript/ESLint sin cambiar alcance funcional. | Bajo | No | Trabajar por regla/modulo y mantener build, TypeScript y superficie oficial en PASS. |

## Criterios por fase

### Fase IA

- Comparar el contrato `GET /api/ai/recommendations/:tenantId` con IA
  Compliance.
- Identificar informacion comercialmente util y trazabilidad requerida.
- Mantener aprobacion humana y scope tenant.
- IA.2 confirma drift de contrato y clasifica `PUT /api/ai/apply/:tenant_control_id`
  como reemplazable por borrador revisable de plan de accion antes de retirar
  `/ia`.
- Retirar `/ia` solo tras pruebas de paridad y guard actualizado.

### Fase Documentos / Integraciones

- Inventariar endpoints, persistencia, deep links y consumidores de
  `/documentos`.
- Revisar lifecycle de fuentes y archivos sin mezclarlo con cleanup visual.
- Auditar Google/Zoho en un subalcance de seguridad separado.
- No aceptar cambios que debiliten RBAC o tenant isolation.

### Fase Backend Routes

- Comparar `report.routes.js` con `reports.routes.js`.
- Identificar rutas no montadas, duplicadas y administrativas.
- Agregar pruebas de contrato antes de mover o eliminar.
- Mantener reportes/exportes MVP operativos.

### Fase DBA

- Clasificar migraciones de producto, seeds y QA fixes.
- Revisar `DROP`, `DELETE FROM`, `TRUNCATE`, backups y rollback.
- Verificar indices tenant, foreign keys y RLS mediante inspeccion aprobada.
- No ejecutar SQL como parte de una revision documental.

### Fase Scripts

- Registrar owner, ultima evidencia de uso y entorno permitido.
- Separar CI, QA manual, deploy, backup, restore, patch y legacy.
- Evitar que scripts con efectos queden disponibles sin runbook.
- Retirar scripts solo tras desacoplar referencias vigentes.

### Fase Seguridad / Integraciones

- Revisar OAuth state, callbacks, tokens, revocacion y reconnect.
- Revisar pairing y tokens del Sync Agent.
- Revisar redaccion, retencion y RBAC de traces.
- Revisar minimizacion de datos y logging de external lookup.

### Fase Calidad Frontend

- Establecer baseline de warnings por regla y carpeta.
- Corregir en lotes pequenos sin refactors funcionales.
- Mantener las 10 rutas MVP, build de 42 paginas y guard oficial.
- No usar cleanup de warnings para alterar producto.
