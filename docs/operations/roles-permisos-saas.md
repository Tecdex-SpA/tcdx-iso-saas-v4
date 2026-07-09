# Roles y Permisos SaaS

Fuente: rutas actuales, `docs/sprint-1/role-feature-action-matrix.md` y `docs/security/rbac-route-matrix.md`. Donde la aplicacion usa alias, se documenta el alias operativo esperado.

## Grupos de roles existentes

| Grupo | Aliases observados |
|---|---|
| Platform admin | `superadmin`, `super_admin`, `platform_admin`, `admin_global`, `global_admin`, `owner` |
| Dealer | `dealer` |
| Tenant admin / Compliance manager | `admin`, `tenant_admin` |
| Auditor interno | `auditor` |
| Responsable proceso/control | `operativo`, `responsable_area`, `area_owner` |
| Viewer / lector | `viewer`, `cliente`, `client`, `read_only`, `readonly`, `solo_lectura`, `ejecutivo` |

## Matriz operativa

| Rol | Alcance | Usuarios | Reportes | Exportar | Evidencias | Hallazgos | IA Compliance | Restricciones | Riesgo si se asigna mal |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Platform admin | Plataforma completa | Si | Si | Si | Auditoria global | Auditoria global | Auditoria global | No usar para operacion diaria cliente | Exposicion cross-tenant y acciones no trazadas a cliente |
| Tenant admin | Tenant propio | Si | Si | Si | Si | Si | Si | Solo tenant_id propio | Puede modificar configuracion y usuarios del cliente |
| Compliance manager | Tenant propio | Si, si usa alias admin/tenant_admin | Si | Si | Si | Si | Si | Requiere confirmacion de alias si se usa rol comercial distinto | Sobregestion de usuarios o aprobaciones |
| Auditor interno | Tenant propio | No | Si | Si | Si | Si | Si | No administra usuarios | Puede ver informacion sensible de auditoria |
| Responsable proceso/control | Alcance asignado o tenant segun soporte endpoint | No | Lectura limitada/no premium | No por defecto | Cargar/gestionar asignadas | Segun flujo | No por defecto | Assigned-scope puede requerir validacion por ruta | Acceso excesivo a areas no asignadas |
| Viewer / lector | Lectura ejecutiva tenant | No | Si | Descarga autorizada | No | No | No | Sin generacion premium ni administracion | Exposicion de informacion ejecutiva a usuario incorrecto |

## Permisos esperados por modulo

| Permiso | Tenant admin | Auditor | Responsable | Viewer |
|---|---:|---:|---:|---:|
| Dashboard | Si | No por defecto | Si | Si |
| Cumplimiento/Auditoria | Si | Si | Lectura/asignado | Resumen |
| Evidencias lectura | Si | Si | Asignado | No |
| Evidencias carga | Si | Si segun flujo | Si asignado | No |
| Riesgos lectura | Si | Si | Si | Si |
| Riesgos escritura | Si | No por defecto | Si asignado | No |
| Planes lectura | Si | Si | Si | Si |
| Planes escritura | Si | No por defecto | Si asignado | No |
| Reportes lectura | Si | Si | Lectura limitada | Si |
| Reportes generacion | Si | Si | No | No |
| Reportes descarga | Si | Si | Segun autorizacion | Si |
| IA Compliance | Si | Si | No por defecto | No |
| Configuracion usuarios | Si | No | No | No |

## Reglas de asignacion

- Usar menor privilegio.
- Crear al menos un tenant admin responsable y un usuario viewer para validacion.
- No usar platform admin como usuario operativo del cliente.
- Si se requiere compliance manager como rol comercial, mapearlo a `admin` o `tenant_admin` hasta que exista rol persistido separado.
- Si se requiere responsable de area con alcance fino, validar endpoints concretos antes de declarar aislamiento por area.

## Confirmaciones tecnicas requeridas

- El modelo actual no introduce tabla DB-backed unica de permisos por accion; varias reglas viven en middleware/frontend/documentacion.
- Assigned-scope de `operativo` depende del soporte de cada modulo.
- Dealer tiene validaciones especificas por ruta y no debe usarse para onboarding directo del cliente salvo canal autorizado.
