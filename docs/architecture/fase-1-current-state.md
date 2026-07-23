# Fase 1 - Estado actual del núcleo GRC

## Alcance inspeccionado

El backend usa Express, `pg`, autenticación global, RBAC por prefijo y scope tenant global. Las capacidades de Fase 1 reutilizan `audit_event_log`, `tcdx_async_jobs`, `permissions`, `role_permissions`, `saas_modules` y `tenant_module_settings`.

| Entidad | Persistencia actual | Superficie actual | Estado/transiciones | Integración Fase 1 |
|---|---|---|---|---|---|
| Documento | `iso_generated_documents` | `/documentos` | draft/approved/archived | adaptador `document` + workflow/SLA/evidencia/readiness |
| Evidencia | `evidences` | `/evidencias` | pendiente/aprobada/rechazada | adaptador, solicitudes recurrentes, calidad y exportación |
| Control | `tenant_controls` | `/controles` | status/health | adaptador y mappings versionados |
| Riesgo | `asset_risks` + `assets` | `/riesgos` | dominio local | adaptador tenant vía `assets` |
| Hallazgo/NC/Acción | tablas existentes | vistas existentes | estados legacy | adaptador compartido, workflow, SLA y exportación |
| Auditoría | `audits` y preparación documental | `/auditorias` | pendiente/en ejecución/completada | adaptador, planificación, revisión supervisora y exportación |

## Reutilización obligatoria

- Autenticación y sesión: sin cambios.
- Tenant: middleware existente y filtros SQL explícitos en cada consulta nueva.
- Permisos: RBAC grueso existente más `user_has_permission` para permisos Fase 1.
- Auditoría: eventos nuevos en `audit_event_log`.
- Jobs: `asyncJob.service.js` y `tcdx_async_jobs`.
- Feature flag: `grc_phase1_core`, beta y deshabilitado por defecto.

## Runtime común cerrado localmente

Los contratos legacy se preservan. `grcRuntimeAdapters.js` centraliza los seis dominios prioritarios y evita replicar validación tenant, workflow, eventos, auditoría, SLA, evidencia y readiness. El backend es autoridad de aprobación, scheduler, escalamiento, revisión y exportación. `grc_phase1_core` continúa deshabilitado por defecto.

La evidencia estructurada completa está en `artifacts/fase-1/current-state.json`.
