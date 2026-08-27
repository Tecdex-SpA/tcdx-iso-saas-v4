# UI-01 — Mapa Current → Target

## Fuentes y límites de esta auditoría

UI-01 se ejecutó como **análisis read-only**. No se modificó el repositorio de producto ni `Tecdex-SpA/tecdex-design-system`.

Fuentes canónicas inspeccionadas: `PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`, `CURRENT_STATE.md`, `SHARED_BASELINE.md`, `WORK_QUEUE.md`, `DECISIONS.md`, `CONTRACTS_REGISTRY.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md`, `handoffs/6.14-A.md`, árbol real `frontend/src/app`, `Sidebar.tsx`, `mvpPermissions.ts`, `docs/product`, y el design system TECDEX en modo lectura.

Baseline GitHub usado para el cierre del escaneo: `main@35d852fcad93c7721df29a7c007205692959b10f` (merge F6.14-A). El inventario de rutas se verificó contra el árbol App Router y subárboles `truncated=false`.

**Discrepancia documental detectada:** el commit de `main` ya contiene el merge F6.14-A, pero `CURRENT_STATE.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md` y `handoffs/6.14-A.md` todavía expresan `F6_14_A_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`. UI-01 no corrige ese estado porque tiene prohibido modificar documentación/código del repositorio. Esta discrepancia no impide el inventario UX read-only, pero debe reconciliarse antes de una etapa de implementación si la validación runtime ya ocurrió fuera del repositorio.


## Mapa exhaustivo
| Ruta actual | Disposición | Dominio target | Workspace target | Resultado UX |
|---|---|---|---|---|
| `/` | **KEEP** | Acceso | Acceso / sesión | ancla conservada |
| `/acciones-recomendadas` | **SUBVIEW** | Auditoría y Mejora | Auditoría y Mejora | tab/sección contextual |
| `/activos` | **SUBVIEW** | Riesgo y Control | Riesgo y Control | tab/sección contextual |
| `/admin-saas` | **ADMIN_ONLY** | Administración | Administración | shell restringido |
| `/administrar-kpis` | **ADMIN_ONLY** | Operación y Resiliencia | Operación GRC | shell restringido |
| `/auditorias` | **SUBVIEW** | Auditoría y Mejora | Auditoría y Mejora | tab/sección contextual |
| `/auditorias/ejecucion` | **DETAIL** | Auditoría y Mejora | Auditoría y Mejora | detalle contextual/deep link |
| `/auditorias/ia` | **SUBVIEW** | Auditoría y Mejora | Auditoría y Mejora | tab/sección contextual |
| `/bi` | **KEEP** | Reportes | BI y Reportes | ancla conservada |
| `/bi/dashboards/[id]` | **DETAIL** | Reportes | BI y Reportes | detalle contextual/deep link |
| `/bia` | **SUBVIEW** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | tab/sección contextual |
| `/bia/[id]` | **DETAIL** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | detalle contextual/deep link |
| `/ciclo-vida` | **SUBVIEW** | Cumplimiento | Cumplimiento e ISO | tab/sección contextual |
| `/conectores` | **SUBVIEW** | Administración | Integraciones y Conectores | tab/sección contextual |
| `/conectores/[id]` | **DETAIL** | Administración | Integraciones y Conectores | detalle contextual/deep link |
| `/conectores/salud` | **SUBVIEW** | Administración | Integraciones y Conectores | tab/sección contextual |
| `/conectores/sincronizaciones` | **SUBVIEW** | Administración | Integraciones y Conectores | tab/sección contextual |
| `/configuracion` | **ADMIN_ONLY** | Administración | Administración | shell restringido |
| `/continuidad` | **KEEP** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | ancla conservada |
| `/continuidad/planes/[id]` | **DETAIL** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | detalle contextual/deep link |
| `/continuidad/pruebas` | **SUBVIEW** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | tab/sección contextual |
| `/continuidad/pruebas/[id]` | **DETAIL** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | detalle contextual/deep link |
| `/controles` | **SUBVIEW** | Riesgo y Control | Riesgo y Control | tab/sección contextual |
| `/cotizador` | **ADMIN_ONLY** | Administración | Canal Dealer | shell restringido |
| `/crisis` | **SUBVIEW** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | tab/sección contextual |
| `/crisis/[id]` | **DETAIL** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | detalle contextual/deep link |
| `/cumplimiento-auditoria` | **KEEP** | Cumplimiento | Cumplimiento e ISO | ancla conservada |
| `/dashboard` | **KEEP** | Inicio | Centro Ejecutivo | ancla conservada |
| `/datos` | **KEEP** | Datos y Evidencia | Datos y Evidencia | ancla conservada |
| `/datos/calidad` | **SUBVIEW** | Datos y Evidencia | Datos y Evidencia | tab/sección contextual |
| `/datos/catalogo` | **SUBVIEW** | Datos y Evidencia | Datos y Evidencia | tab/sección contextual |
| `/datos/lineage` | **SUBVIEW** | Datos y Evidencia | Datos y Evidencia | tab/sección contextual |
| `/datos/semantica` | **SUBVIEW** | Datos y Evidencia | Datos y Evidencia | tab/sección contextual |
| `/dealer` | **ADMIN_ONLY** | Administración | Canal Dealer | shell restringido |
| `/diagnostico` | **SUBVIEW** | Cumplimiento | Cumplimiento e ISO | tab/sección contextual |
| `/documentos` | **LEGACY_REVIEW** | Datos y Evidencia | Datos y Evidencia | retener hasta validar uso |
| `/ejecucion-iso` | **LEGACY_REVIEW** | Cumplimiento | Cumplimiento e ISO | retener hasta validar uso |
| `/empresas` | **LEGACY_REVIEW** | Administración | Administración | retener hasta validar uso |
| `/encuestas` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/encuestas/[id]` | **DETAIL** | Operación y Resiliencia | Operación GRC | detalle contextual/deep link |
| `/evaluaciones` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/eventos-perdida` | **SUBVIEW** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | tab/sección contextual |
| `/evidencias` | **KEEP** | Datos y Evidencia | Datos y Evidencia | ancla conservada |
| `/exportes` | **SUBVIEW** | Reportes | BI y Reportes | tab/sección contextual |
| `/grc-global` | **MERGE** | Inicio | Centro Ejecutivo | capacidad integrada |
| `/grc` | **MERGE** | Inteligencia | Inteligencia GRC | capacidad integrada |
| `/hallazgos` | **SUBVIEW** | Auditoría y Mejora | Auditoría y Mejora | tab/sección contextual |
| `/health` | **REDIRECT_CANDIDATE** | Cumplimiento | Cumplimiento e ISO | compatibilidad + futura redirección si paridad |
| `/ia-auditor` | **MERGE** | Inteligencia | Inteligencia GRC | capacidad integrada |
| `/ia-compliance` | **MERGE** | Inteligencia | Inteligencia GRC | capacidad integrada |
| `/ia-compliance/sugerencias` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/ia` | **MERGE** | Inteligencia | Inteligencia GRC | capacidad integrada |
| `/importaciones` | **SUBVIEW** | Datos y Evidencia | Datos y Evidencia | tab/sección contextual |
| `/incidentes` | **SUBVIEW** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | tab/sección contextual |
| `/incidentes/[id]` | **DETAIL** | Operación y Resiliencia | Continuidad, Incidentes y Crisis | detalle contextual/deep link |
| `/indicadores` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/indicadores/[id]` | **DETAIL** | Inteligencia | Inteligencia GRC | detalle contextual/deep link |
| `/iso-health` | **SUBVIEW** | Cumplimiento | Cumplimiento e ISO | tab/sección contextual |
| `/login` | **KEEP** | Acceso | Acceso / sesión | ancla conservada |
| `/matriz-riesgo` | **SUBVIEW** | Riesgo y Control | Riesgo y Control | tab/sección contextual |
| `/metricas` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/metricas/[id]` | **DETAIL** | Inteligencia | Inteligencia GRC | detalle contextual/deep link |
| `/metricas/constructor` | **ADMIN_ONLY** | Inteligencia | Inteligencia GRC | shell restringido |
| `/no-conformidades` | **SUBVIEW** | Auditoría y Mejora | Auditoría y Mejora | tab/sección contextual |
| `/operaciones-grc` | **KEEP** | Operación y Resiliencia | Operación GRC | ancla conservada |
| `/operaciones-grc/activacion` | **SUBVIEW** | Operación y Resiliencia | Operación GRC | tab/sección contextual |
| `/operaciones-grc/importar` | **SUBVIEW** | Operación y Resiliencia | Operación GRC | tab/sección contextual |
| `/perfil-empresa` | **ADMIN_ONLY** | Administración | Administración | shell restringido |
| `/perfil` | **KEEP** | Administración | Administración | ancla conservada |
| `/plan-accion` | **REDIRECT_CANDIDATE** | Auditoría y Mejora | Auditoría y Mejora | compatibilidad + futura redirección si paridad |
| `/planes-accion` | **KEEP** | Auditoría y Mejora | Auditoría y Mejora | ancla conservada |
| `/portal-proveedor` | **KEEP** | Operación y Resiliencia | Riesgo de Proveedores | ancla conservada |
| `/prefacturacion` | **ADMIN_ONLY** | Administración | Canal Dealer | shell restringido |
| `/privacidad` | **KEEP** | Operación y Resiliencia | Privacidad | ancla conservada |
| `/privacidad/actividades` | **SUBVIEW** | Operación y Resiliencia | Privacidad | tab/sección contextual |
| `/privacidad/actividades/[id]` | **DETAIL** | Operación y Resiliencia | Privacidad | detalle contextual/deep link |
| `/privacidad/brechas` | **SUBVIEW** | Operación y Resiliencia | Privacidad | tab/sección contextual |
| `/privacidad/dpia` | **SUBVIEW** | Operación y Resiliencia | Privacidad | tab/sección contextual |
| `/privacidad/solicitudes` | **SUBVIEW** | Operación y Resiliencia | Privacidad | tab/sección contextual |
| `/procesos` | **SUBVIEW** | Operación y Resiliencia | Operación GRC | tab/sección contextual |
| `/procesos/[id]` | **DETAIL** | Operación y Resiliencia | Operación GRC | detalle contextual/deep link |
| `/proveedores` | **KEEP** | Operación y Resiliencia | Riesgo de Proveedores | ancla conservada |
| `/proveedores/[id]` | **DETAIL** | Operación y Resiliencia | Riesgo de Proveedores | detalle contextual/deep link |
| `/proveedores/cuestionarios` | **SUBVIEW** | Operación y Resiliencia | Riesgo de Proveedores | tab/sección contextual |
| `/proveedores/evaluaciones` | **SUBVIEW** | Operación y Resiliencia | Riesgo de Proveedores | tab/sección contextual |
| `/reportes/generaciones` | **SUBVIEW** | Reportes | BI y Reportes | tab/sección contextual |
| `/reportes/studio` | **KEEP** | Reportes | BI y Reportes | ancla conservada |
| `/riesgo-cuantitativo` | **SUBVIEW** | Riesgo y Control | Riesgo y Control | tab/sección contextual |
| `/riesgo-cuantitativo/[id]` | **DETAIL** | Riesgo y Control | Riesgo y Control | detalle contextual/deep link |
| `/riesgos` | **KEEP** | Riesgo y Control | Riesgo y Control | ancla conservada |
| `/servicios` | **SUBVIEW** | Operación y Resiliencia | Operación GRC | tab/sección contextual |
| `/servicios/[id]` | **DETAIL** | Operación y Resiliencia | Operación GRC | detalle contextual/deep link |
| `/soa` | **SUBVIEW** | Cumplimiento | Cumplimiento e ISO | tab/sección contextual |
| `/tests` | **SUBVIEW** | Inteligencia | Inteligencia GRC | tab/sección contextual |
| `/unidades` | **SUBVIEW** | Operación y Resiliencia | Operación GRC | tab/sección contextual |
| `/unidades/[id]` | **DETAIL** | Operación y Resiliencia | Operación GRC | detalle contextual/deep link |
| `/usuarios` | **ADMIN_ONLY** | Administración | Administración | shell restringido |

## Reglas de transición

1. No eliminar URLs en la primera iteración visual.
2. Primero introducir IA/workspaces y navegación contextual; luego medir y validar paridad.
3. Sólo `REDIRECT_CANDIDATE` puede convertirse en redirect, con deep-link preservation y verificación RBAC.
4. `MERGE` significa consolidación visual, no consolidación de entidades ni tablas.
5. `DETAIL` conserva ruta cuando aporta deep-linking/auditoría; la interacción puede usar drawer/master-detail.
6. `LEGACY_REVIEW` no se toca hasta confirmar uso, dependencias, telemetry y owner.
7. No modificar contratos F6.8–F6.14 para acomodar la UI; la UI consume los contratos existentes.


## Gates
`CURRENT_TO_TARGET_MAP = PASS`
`FUNCTIONALITY_LOST = 0`
`BACKEND_CHANGED = 0`
`DATABASE_CHANGED = 0`
`API_CHANGED = 0`
`RBAC_CHANGED = 0`
`F6_CONTRACTS_CHANGED = 0`
