# Fase 2 — Matriz RBAC

La migración registra 22 permisos. `admin` recibe gestión y aprobación;
`auditor` lectura y evaluación; `area_owner` lectura y gestión operativa;
`executive` lectura ejecutiva. Las rutas verifican permiso y módulo en backend.

| Dominio | Lectura | Gestión | Autoridad reforzada |
|---|---|---|---|
| Privacidad | `privacy.read` | `privacy.manage`, `privacy.dpia.manage`, `privacy.requests.manage`, `privacy.breaches.manage` | `privacy.approve` |
| Incidentes | `incidents.read` | `incidents.manage`, `incidents.command`, `incidents.notifications.manage` | `incidents.close` |
| TPRM | `suppliers.read` | `suppliers.manage`, `suppliers.assess`, `suppliers.portal.manage` | `suppliers.approve` |
| Integraciones | `connectors.read`, `connectors.logs.read` | `connectors.manage`, `connectors.sync.run` | `connectors.credentials.manage` |
| Exportes | permiso de lectura del dominio | `grc.phase2.export` | ambos son obligatorios |

El cierre de incidentes exige `incidents.close`; aprobación de privacidad y
proveedores exige sus permisos específicos; configurar secretos exige
`connectors.credentials.manage`. El rol por sí solo no sustituye la evaluación
de permisos efectivos.
