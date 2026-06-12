# Rutas oficiales de demo y piloto

Fecha: 2026-06-11
Estado: gating frontend aplicado en Bloque 6

## Objetivo

Definir un recorrido comercial repetible y un conjunto controlado de rutas para
piloto. Las rutas beta, internas y legacy se conservan por compatibilidad; no se
eliminan como parte de esta clasificacion.

## Rutas oficiales demo/piloto

| Orden | Ruta | Vista |
|---:|---|---|
| 1 | `/dashboard` | Dashboard consolidado |
| 2 | `/cumplimiento-auditoria` | Cumplimiento y auditoria |
| 3 | `/evidencias` | Evidencias |
| 4 | `/riesgos` | Riesgos |
| 5 | `/planes-accion` | Planes de accion |
| 6 | `/exportes` | Reportes |
| 7 | `/ia-compliance` | IA Compliance supervisada |
| 8 | `/configuracion` | Configuracion tenant |

Estas son las entradas principales del sidebar cliente. La disponibilidad final
depende de rol, modulos contratados y entitlements.

## Visibilidad por rol

| Rol | Navegacion principal visible |
|---|---|
| Plataforma | `/admin-saas`; `/empresas` se mantiene como alias directo |
| Dealer | `/dealer`, `/cotizador`, `/prefacturacion` |
| Admin/compliance tenant | Flujo oficial completo; IA depende de entitlement |
| Auditor | Cumplimiento, evidencias, riesgos, planes, reportes e IA habilitada |
| Operativo/area owner | Dashboard, cumplimiento, evidencias, riesgos, planes y reportes de lectura |
| Viewer/ejecutivo | Dashboard, cumplimiento resumido, riesgos, planes y reportes de lectura |

`/configuracion`, `/usuarios` y `/perfil-empresa` requieren rol admin tenant.
`/perfil` es una ruta personal disponible para roles tenant autenticados desde
el header. Viewer y operativo no reciben controles separados de generacion o
administracion de reportes en la navegacion.

## Subrutas oficiales

Las siguientes rutas forman parte de una vista principal y no deben presentarse
como modulos comerciales independientes:

| Vista principal | Subrutas |
|---|---|
| Cumplimiento y auditoria | `/diagnostico`, `/health`, `/controles`, `/soa`, `/ciclo-vida`, `/auditorias`, `/auditorias/ejecucion`, `/hallazgos`, `/no-conformidades` |
| Riesgos | `/matriz-riesgo`, `/activos` |
| Planes de accion | `/plan-accion`, `/acciones-recomendadas` |
| IA Compliance | `/ia-compliance/sugerencias` |
| Configuracion | `/usuarios`, `/perfil`, `/perfil-empresa` |

El alcance funcional resumido es: diagnostico, health, controles, SoA, ciclo de
vida, auditorias, hallazgos, no conformidades, activos, matriz de riesgo, plan de
accion, usuarios y perfiles.

## Rutas de plataforma

| Ruta | Uso |
|---|---|
| `/admin-saas` | Administracion interna de plataforma |
| `/empresas` | Alias/redireccion hacia administracion SaaS |

Estas rutas no pertenecen al recorrido cliente. Requieren rol de plataforma.

## Rutas dealer

| Ruta | Uso |
|---|---|
| `/dealer` | Portal dealer |
| `/cotizador` | Cotizacion |
| `/prefacturacion` | Prefacturacion de clientes autorizados |

Estas rutas son un canal separado y no deben mezclarse con la demo cliente.

## Rutas ocultas o internas propuestas

| Ruta | Clasificacion |
|---|---|
| `/administrar-kpis` | Administrativa/interna |
| `/documentos` | Beta/post-MVP |
| `/ejecucion-iso` | Beta/interna |
| `/ia` | Legacy IA |
| `/ia-auditor` | Interna/beta |
| `/auditorias/ia` | Interna/beta |

Ocultar significa retirarlas de la navegacion oficial para clientes. No implica
borrar archivos, rutas frontend, endpoints backend ni contratos existentes.
El acceso directo de clientes se redirige al home autorizado mediante
`AppLayout`; plataforma conserva acceso interno cuando corresponde.

## Aliases legacy

| Ruta legacy | Comportamiento actual |
|---|---|
| `/dashboard-v2` | Redirige a `/dashboard` |

La demo cliente usa `/dashboard` para KPI y Centro Control ISO, y
`/cumplimiento-auditoria` para el acceso agregado a auditoria. Los aliases
retirados del contrato de demo pueden permanecer temporalmente como wrappers
tecnicos, pero no deben ser usados por QA, deep links ni navegacion nueva.

## Navegacion y layout

- `AppLayout` mantiene sidebar y header persistentes en las vistas privadas.
- `Sidebar` filtra opciones por rol, permisos MVP, modulos y entitlements.
- `AppLayout` protege acceso directo a rutas de plataforma, dealer e internas.
- El header mantiene sesion, perfil, busqueda, notificaciones y logout.
- No se detectaron carpetas con parentesis bajo `frontend/src/app`; el proyecto
  no usa route groups de Next.js en esa ubicacion.

## Reglas de seguridad

- Ocultar una ruta en frontend no sustituye autorizacion backend.
- Toda ruta privada debe mantener JWT, RBAC y aislamiento tenant.
- Acceso directo por URL debe aplicar los mismos permisos que el sidebar.
- Las rutas legacy se mantienen hasta tener referencias, plan de deprecacion y
  rollback.
- La IA opera como asistente supervisado. No aprueba por si sola hallazgos, no
  conformidades, acciones ni documentos.
- `CLIENT_MVP_NAV_ITEMS` y `MVP_ROUTE_RULES` son la fuente de gating del flujo
  cliente; no se creo un sistema paralelo.

## Recorrido minimo sugerido

1. Login con usuario de demo autorizado.
2. Dashboard consolidado.
3. Cumplimiento y auditoria.
4. Evidencias.
5. Riesgos y planes de accion.
6. Reportes: lectura, descarga o generacion segun rol.
7. IA Compliance mostrando revision humana.
8. Logout desde el header.

La validacion automatizada API-based de este recorrido se ejecuta con
`scripts/qa-e2e-minimal.sh`. Cubre sesion, dashboard, evidencias,
reportes/exportes, health, tokens rechazados, rol viewer y descargas opcionales.
El logout queda `SKIP` mientras no exista un endpoint backend seguro que no
invalide tokens compartidos.

La ejecucion runtime API-based contra `https://tcdx-iso.tecdex.net` finalizo
con PASS 8, FAIL 0 y SKIP 6. El smoke visual por rol sigue siendo una
verificacion previa al piloto, no un reemplazo de la autorizacion backend.
