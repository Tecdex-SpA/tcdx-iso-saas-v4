# Matriz RBAC, capabilities y límites

## Regla de autorización

Toda operación sensible requiere simultáneamente:

`identidad + tenant/partner scope + rol/permiso + capability + entitlement + límite + vigencia + propósito`.

El frontend comunica disponibilidad; el backend decide. Un engagement MSP nunca sustituye un permiso ni una aprobación de acceso.

## Estado actual

- Roles runtime observados: plataforma (`superadmin`, `platform_admin` y aliases), tenant admin, compliance admin, auditor, area owner/operativo, ejecutivo/viewer, dealer.
- Fase 5 declara permisos para datos, métricas, encuestas, assurance, pérdidas, dashboards y reportes.
- Fase 5 declara capabilities `data.*`, `metrics.*`, `surveys.engine`, `assurance.testing`, `loss.events`, `bi.*` y `reporting.*`.
- Fase 2 valida permisos detallados de privacidad, incidentes, proveedores y conectores.
- El inventario JSON de autorización no refleja rutas Fase 2/5 actuales; debe regenerarse en 5-C1.

## Roles funcionales

| Rol funcional | Scope | Lectura | Mutación | Aprobación | Restricciones |
|---|---|---|---|---|---|
| Platform Admin | Global con tenant seleccionado | Catálogos y salud comercial | Configuración SaaS y soporte autorizado | Planes/catálogos globales | Toda operación tenant exige selección y auditoría |
| Tenant Admin | Un tenant | Todos los módulos contratados | Configuración y operación tenant | Según permiso específico | No administra catálogo global ni otro tenant |
| Executive | Un tenant | Centro Ejecutivo, dashboards y reportes aprobados | Crear decisión/comentario si se autoriza | Aceptación de riesgo/decisión delegada | Sin detalle técnico ni edición metodológica |
| GRC Manager | Un tenant | GRC completo | Riesgos, controles, acciones y decisiones | Publicación/closure según segregación | No administra secretos/integraciones por defecto |
| Compliance Manager | Un tenant | Normas, SoA, evaluaciones, evidencia | Evaluar, mapear y remediar | No aplica y evaluaciones según política | Sin cambios de fórmula |
| Risk Manager | Un tenant | Riesgos, controles, pérdidas, proveedores | Evaluar/tratar riesgos y KRIs | Aceptación separada cuando corresponda | No autoaprueba su tratamiento crítico |
| Control Owner | Entidades asignadas | Controles/riesgos/requisitos vinculados | Ejecuciones, evidencia y acciones | No aprueba su propio assurance | Scope por assignment |
| Evidence Owner | Entidades asignadas | Solicitudes/evidencias propias | Entregar/versionar | Sin revisión propia | Archivos tenant-scoped |
| Auditor / Assurance | Tenant y plan asignado | Evidencia y entidades auditadas | Tests, workpapers, hallazgos | Revisión independiente | Conflictos de independencia bloquean acciones |
| Data Owner / Steward | Dominio asignado | Catálogo, calidad, lineage | Contratos/mappings/calidad | Publicación técnica segregada | Nombres físicos solo con permiso técnico |
| Integration Admin | Tenant | Catálogo, health, runs | Configuración, sync, mapping | Scopes/secret change con aprobación | Secret value nunca legible después de guardar |
| Report Author | Tenant | Resultados oficiales | Definiciones y generaciones | No aprueba su propio reporte clasificado | Solo snapshots autorizados |
| Viewer | Tenant | Lectura autorizada | Ninguna | Ninguna | Export/download requiere permiso separado |
| Dealer | Tenants asignados comercialmente | Catálogo/comercial autorizado | Cotización y acciones delegadas | No administra tenant | Sin acceso operacional implícito |
| Partner Admin | Partner | Partner, equipos y engagements | Usuarios/equipos/solicitudes | Interna partner, no tenant | PROPUESTO Fase 7; sin datos tenant por defecto |
| Partner Delivery Manager | Engagements asignados | Proyectos/servicios/SLA | Asignar tareas y operar servicio | Hitos internos | PROPUESTO; requiere tenant assignment |
| Partner Analyst | Engagement/servicio | Datos mínimos del servicio | Tareas/evidencias autorizadas | Ninguna | PROPUESTO; acceso temporal cuando soporte |
| Partner Support | Ticket y sesión aprobada | Recurso necesario | Diagnóstico acotado | Ninguna | PROPUESTO; propósito y expiración obligatorios |
| Tenant Partner Approver | Tenant | Solicitudes de partner | Aprobar/revocar accesos | Acceso partner | PROPUESTO; no es rol partner |

## Permisos por dominio

| Dominio | Lectura | Operación | Publicación/aprobación | Seguridad especial |
|---|---|---|---|---|
| Datos | `data.catalog.read`, `data.quality.read`, `data.lineage.read` | `data.catalog.manage`, `data.quality.manage`, `data.lineage.manage` | `data.contract.publish` propuesto | `data.technical.read` para detalle físico |
| Métricas | `metrics.read` | `metrics.manage`, `metrics.measure`, `metrics.recalculate` | `metrics.publish`, `metrics.validate` | `metrics.methodology.read/manage` técnico |
| GRC | permisos existentes por workflow/evidence/framework/audit | manage/transition por recurso | review/approve/close separado | actor no autoaprueba cuando aplique |
| Encuestas | `surveys.read` | `surveys.manage`, `surveys.respond`, `surveys.evaluate` | `surveys.publish`, `surveys.approve` | PII de respuestas por scope |
| Assurance | `assurance_tests.read` | manage/execute | review/approve/re-test | independencia y muestra |
| Pérdidas | `loss_events.read` | manage/recover | confirm/close | montos y moneda sensibles |
| BI | `dashboards.read` | `dashboards.manage` | `dashboards.publish` | permisos de dashboard y dataset |
| Reporting | `reports.read`, `reports.download` | `reports.manage`, `reports.generate`, `reports.schedule` | `reports.approve` | clasificación y signed download |
| Integraciones | `connectors.read`, `connectors.logs.read` | `connectors.manage`, `connectors.sync.run`, `connectors.mapping.manage` | `connectors.mapping.publish` | `connectors.credentials.manage`, sin read secret |
| Decisiones | `grc.decisions.read` | `grc.decisions.manage` | `grc.decisions.approve` | aceptación de riesgo separada |
| MSP | `partners.read` | manage por recurso | approve access/provision/offboarding | PROPUESTO; partner y tenant scopes simultáneos |

## Capabilities y entitlements

| Capability | Estado | Permiso requerido | Límite asociado | Comportamiento disabled/downgrade |
|---|---|---|---|---|
| `data.governance` | Existente | `data.catalog.read` | dominios/elementos opcional | Lectura de histórico; sin nuevas mutaciones |
| `data.lineage` | Existente | `data.lineage.read` | nodos/edges/retención | Sin grafo nuevo; evidencia histórica preservada |
| `data.impact_graph` | Existente | `data.lineage.read` | propagaciones/período | Ocultar acción; conservar snapshots |
| `metrics.catalog` | Existente | `metrics.read` | definiciones publicadas | Catálogo publicado legible según plan |
| `metrics.engine` | Existente | `metrics.measure` | cálculos/mes y concurrencia | Read-only; jobs pendientes no se descartan |
| `metrics.data_trust` | Existente | `data.quality.read` | evaluaciones/mes | Mostrar unknown, no score inventado |
| `surveys.engine` | Existente | `surveys.read` | campañas, recipients, respuestas | Campañas activas se cierran según política |
| `assurance.testing` | Existente | `assurance_tests.read` | tests/ejecuciones/muestra | Histórico legible; nuevas ejecuciones bloqueadas |
| `loss.events` | Existente | `loss_events.read` | eventos/mes | Histórico legible; nuevas confirmaciones bloqueadas |
| `bi.executive_dashboards` | Existente | `dashboards.read` | dashboards/widgets | Solo dashboards publicados |
| `bi.dashboard_builder` | Existente | `dashboards.manage` | drafts/widgets/versions | Builder read-only |
| `reporting.studio` | Existente | `reports.read` | definiciones/generaciones | Definiciones legibles; generación según formatos |
| `reporting.pdf/docx/xlsx` | Existente | `reports.generate` | artefactos/mes/bytes | Formato no incluido se rechaza 403 funcional |
| `reporting.scheduled` | Existente | `reports.schedule` | schedules/runs | Pausar schedules antes del downgrade efectivo |
| `integrations.hub` | Propuesto | `connectors.read` | integraciones activas | Health e histórico visibles; sync bloqueado |
| `integrations.provider.<key>` | Propuesto | `connectors.read` | por provider/plan | No instalar provider no contratado |
| `integrations.sync` | Propuesto | `connectors.sync.run` | runs, API calls, records, bytes | Pausar schedule; preservar checkpoint |
| `integrations.mapping_studio` | Propuesto | mapping manage | mappings/versiones | Mappings publicados continúan para lectura |
| `msp.portal` | Propuesto | `partners.read` | partner users/tenants | Partner suspendido pierde sesiones |
| `msp.implementation` | Propuesto | project manage | proyectos/tenants | Histórico preservado; nuevas tareas bloqueadas |
| `msp.support` | Propuesto | ticket manage | tickets/mes/SLA tiers | Tickets activos se transfieren según contrato |
| `msp.managed_services` | Propuesto | service manage | servicios/tareas | Pausar calendario y preservar evidencia |
| `msp.integration_delivery` | Propuesto | integration assignment | assignments/runs | Revocar assignment sin borrar integración tenant |

## Límites medibles

| Limit key | Dimensión | Medición idempotente | Respuesta al alcanzar límite |
|---|---|---|---|
| `metrics.calculations.month` | Tenant/mes | calculation run exitoso único | 429 con uso, límite y período |
| `metrics.concurrent_jobs` | Tenant | jobs running | Queue o 429; nunca duplicar |
| `dashboards.count`, `dashboard.widgets` | Tenant/dashboard | versiones activas | Preview permitido; publish bloqueado |
| `reports.generations.month`, `reports.storage_bytes` | Tenant/mes | generation/artifact checksum | Generación bloqueada; descargas existentes preservadas |
| `surveys.active_campaigns`, `survey.recipients` | Tenant | campañas/recipients válidos | Launch bloqueado antes de enviar |
| `assurance.executions.month` | Tenant | execution idempotency key | Nueva ejecución bloqueada |
| `integrations.active`, `integration.runs.month`, `integration.records.month`, `integration.bytes.month` | Tenant/provider/período | usage ledger por run | Pausa controlada y alerta; no perder checkpoint |
| `partners.tenant_engagements`, `partner.users`, `partner.access.concurrent` | Partner/período | engagement/user/session únicos | Solicitud rechazada o pendiente de upgrade |

## Pruebas obligatorias

Por cada endpoint mutable: rol permitido, rol denegado, capability off, entitlement off, límite alcanzado, tenant A/B, partner A/B cuando corresponda, vigencia expirada e idempotencia. Archivos, reportes, snapshots, runs y secrets requieren además IDOR y acceso directo por ID.
