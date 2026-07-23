# Fase 1R - Contrato operacional de acciones UI

Todas las acciones están dentro de vistas existentes. `GrcPhase1Panel` no renderiza si el módulo está apagado; backend vuelve a validar flag, permiso y tenant. Loading bloquea doble clic, los errores preservan código/mensaje seguro y los éxitos usan `aria-live`.

| Ruta | Control | Evento/endpoint | Permiso | Persistencia/resultado | Error |
|---|---|---|---|---|---|
| todas | Actualizar | recarga GET del modo | lectura del modo | estado servidor actualizado | banner con código |
| `/dashboard` | Generar snapshot | `POST /api/grc/readiness/snapshots` | `readiness.generate` | snapshot/resultados inmutables | 403/422/500 visible |
| `/dashboard` | Exportar readiness | `POST /api/grc/exports/readiness` | `grc.export.generate` | fila `grc_exports` + descarga | error controlado |
| `/evidencias` | Crear solicitud | `POST /api/grc/evidence/requests` | `evidence.request.manage` | request y schedule opcional | validación por formulario/API |
| `/evidencias` | Entregar/versionar | submissions/versions | `evidence.request.manage` | entrega idempotente y versión incremental | tenant/estado validado |
| `/evidencias` | Aprobar/rechazar/calidad | review/quality | `evidence.review` | decisión, causa y score trazables | rechazo exige causa |
| `/evidencias` | Vincular entidad | `POST /api/grc/evidence/:id/links` | `evidence.request.manage` | vínculo contra adaptador real | entidad cross-tenant 404 |
| `/evidencias` | Exportar | `POST /api/grc/exports/evidence` | `grc.export.generate` | bytes/hash trazables | error controlado |
| `/configuracion` | Inicializar GRC | `POST /api/grc/bootstrap` | `workflow.manage` | configuración, workflows, reglas y políticas | exige confirmación/key |
| `/configuracion` | Revalidar | `POST /api/grc/bootstrap/validate` | `workflow.manage` | estado/fecha/resultado | faltantes visibles |
| `/configuracion` | Crear borrador | `POST /api/grc/workflows` | `workflow.manage` | definición/version/estados | 422 visible |
| `/configuracion` | Validar/editar/historial | validate/draft/GET | `workflow.manage/read` | borrador reconstruido y nueva versión | publicada inmutable |
| `/configuracion` | Publicar | `POST /api/grc/workflows/:id/publish` | `workflow.manage` | versión inmutable | 403/409 visible |
| `/configuracion` | Instanciar/transicionar | workflow-instances/transitions | `workflow.transition` | estado, aprobación e historial | precondición/rol visible |
| `/configuracion` | Archivar | `POST /api/grc/workflows/:id/archive` | `workflow.manage` | definición archivada | bloquea instancias activas |
| `/configuracion` | Guardar política | `POST /api/grc/escalations/policies` | `grc.escalation.manage` | política tenant | validación visible |
| `/configuracion` | Ejecutar ahora | `POST /api/grc/scheduler/run` | `grc.scheduler.run` | run/resultado auditado | lock/retry visible |
| `/controles` | Exportar framework/mappings | `POST /api/grc/exports/:domain` | `grc.export.generate` | archivo real tenant | error controlado |
| `/controles` | Crear/revisar mapping | mappings/reviews | `framework.manage` | cobertura, justificación y revisión | control cross-tenant 404 |
| `/auditorias` | Crear plan | `POST /api/grc/audits/annual-plans` | `audit.plan.manage` | plan anual | 422 visible |
| `/auditorias` | Aprobar/devolver revisión | `POST /api/grc/audits/workpapers/:id/reviews` | `audit.review` | versión/historial/workpaper | observación obligatoria |
| `/auditorias` | Equipo/conflicto/programa/muestra | endpoints `/audits/:id/*` | audit manage/workpaper | filas tenant y eventos auditados | independencia bloquea |
| `/auditorias` | Papel/evidencia/seguimiento | workpapers/evidence-links/followups | permisos audit | ejecución persistida | IDs tenant validados |
| `/auditorias` | Informe/cierre | export filtrado/close | export/review | PDF + `grc_audit_reports`; status completada | blockers explícitos |
| `/auditorias` | Exportar auditoría | `POST /api/grc/exports/audit` | `grc.export.generate` | archivo real tenant | error controlado |
| `/admin-saas` | Activar/desactivar módulo | `PUT /api/admin-saas/tenants/:tenant/modules/:key` | administración SaaS | `tenant_module_settings`, actor/auditoría | límite/bloqueo visible |

No se agregaron rutas `v2`, dashboards ni navegación paralela.
