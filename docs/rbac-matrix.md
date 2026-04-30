# TCDX ISO SaaS - Matriz formal de roles y permisos

## Roles oficiales

| Rol | Descripción |
|---|---|
| superadmin | Administra toda la plataforma SaaS TCDX. |
| dealer | Partner externo que vende/administra sus clientes asignados. |
| admin | Administrador de una empresa/tenant. |
| auditor | Usuario responsable de auditorías, validaciones y hallazgos. |
| operativo | Usuario que ejecuta tareas operativas del sistema de gestión. |
| viewer | Usuario ejecutivo o solo lectura. |

---

## Rutas frontend por rol

| Ruta | superadmin | dealer | admin | auditor | operativo | viewer |
|---|---:|---:|---:|---:|---:|---:|
| /dashboard | Sí | No | Sí | Sí | Sí | Sí |
| /dashboard Vista KPI | Sí | No | Sí | Sí lectura | Sí lectura | Sí lectura |
| /admin-saas | Sí | No | No | No | No | No |
| /empresas | Sí | No | No | No | No | No |
| /dealer | No | Sí | No | No | No | No |
| /cotizador | No | Sí | No | No | No | No |
| /usuarios | Sí | No | Sí | No | No | No |
| /administrar-kpis | Sí | No | Sí | No | No | No |
| /ciclo-vida | Sí | No | Sí | Sí | Sí | Sí lectura |
| /ciclo-vida Vista Objetivos | Sí | No | Sí | Sí lectura | Sí/operativo | No |
| /health | Sí | No | Sí | Sí | Sí | Sí lectura |
| /auditorias | Sí | No | Sí | Sí | Sí lectura | Sí lectura |
| /evidencias | Sí | No | Sí | Sí lectura | Sí | No |
| /plan-accion | Sí | No | Sí | Sí lectura | Sí | No |
| /hallazgos | Sí | No | Sí | Sí | Sí | No |
| /no-conformidades | Sí | No | Sí | Sí | Sí | No |
| /controles | Sí | No | Sí | Sí lectura | Sí lectura | No |
| /matriz-riesgo | Sí | No | Sí | Sí lectura | Sí lectura | No |
| /activos | Sí | No | Sí | Sí lectura | Sí | No |
| /soa | Sí | No | Sí | Sí lectura | Sí lectura | No |
| /ia-compliance | Sí | No | Sí | No | Sí limitado | No |
| /exportes | Sí | Sí limitado | Sí | Sí | Sí lectura | Sí lectura |

---

## Acciones críticas por rol

| Acción | superadmin | dealer | admin | auditor | operativo | viewer |
|---|---:|---:|---:|---:|---:|---:|
| Crear usuarios | Sí | No | Sí tenant | No | No | No |
| Crear dealer | Sí | No | No | No | No | No |
| Administrar tenant SaaS | Sí | No | No | No | No | No |
| Recalcular KPI | Sí | No | Sí | No | No | No |
| Cargar KPI manual | Sí | No | Sí | No | No | No |
| Recalcular salud ISO | Sí | No | Sí | Sí | No | No |
| Crear objetivo | Sí | No | Sí | No | Sí | No |
| Ver objetivos | Sí | No | Sí | Sí | Sí | No |
| Mover tarjetas ciclo de vida | Sí | No | Sí | Sí/validación | Sí/solicitud | No |
| Aprobar/rechazar cambio ciclo vida | Sí | No | Sí | Sí | No | No |
| Crear auditoría | Sí | No | Sí | Sí | No | No |
| Iniciar/cerrar auditoría | Sí | No | Sí | Sí | No | No |
| Subir informe auditoría | Sí | No | Sí | Sí | No | No |
| Ver auditorías | Sí | No | Sí | Sí | Sí | Sí |
| Crear evidencia | Sí | No | Sí | No | Sí | No |
| Ver evidencia | Sí | No | Sí | Sí | Sí | No |
| Crear plan de acción | Sí | No | Sí | Sí | Sí | No |
| Ver plan de acción | Sí | No | Sí | Sí | Sí | No |
| Crear reporte | Sí | Según regla dealer | Sí | Sí | No | No |
| Ver/descargar reporte generado | Sí | Clientes asignados | Sí | Sí | Sí | Sí |

---

## Reglas clave

1. Ocultar menú no es seguridad suficiente.
2. Toda acción sensible debe estar bloqueada en backend.
3. AppLayout debe bloquear acceso directo por URL.
4. Las vistas deben ocultar botones no permitidos por rol.
5. Viewer nunca debe ejecutar escrituras.
6. Dealer no debe actuar como usuario operativo de tenant.
7. Operativo ejecuta tareas, pero no gobierna auditorías ni KPI.
8. Auditor valida y audita, pero no administra usuarios ni KPI.
9. Admin gobierna su tenant.
10. Superadmin gobierna plataforma completa.

---

## Validación mínima antes de demo

- viewer no puede POST a KPI, auditorías, planes, evidencias ni usuarios.
- operativo puede ver auditorías, pero no crearlas.
- auditor puede gestionar auditorías, pero no usuarios ni KPI.
- admin puede gestionar usuarios y KPI dentro del tenant.
- dealer solo accede a portal dealer/cotizador/reportes autorizados.
- superadmin mantiene acceso completo.
