# UI-01 — Matriz de consolidación

Principio: **menos navegación, más contexto; menos pantallas aisladas, más workspaces; ninguna capacidad funcional se elimina.**

## Fuentes y límites de esta auditoría

UI-01 se ejecutó como **análisis read-only**. No se modificó el repositorio de producto ni `Tecdex-SpA/tecdex-design-system`.

Fuentes canónicas inspeccionadas: `PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`, `CURRENT_STATE.md`, `SHARED_BASELINE.md`, `WORK_QUEUE.md`, `DECISIONS.md`, `CONTRACTS_REGISTRY.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md`, `handoffs/6.14-A.md`, árbol real `frontend/src/app`, `Sidebar.tsx`, `mvpPermissions.ts`, `docs/product`, y el design system TECDEX en modo lectura.

Baseline GitHub usado para el cierre del escaneo: `main@35d852fcad93c7721df29a7c007205692959b10f` (merge F6.14-A). El inventario de rutas se verificó contra el árbol App Router y subárboles `truncated=false`.

**Discrepancia documental detectada:** el commit de `main` ya contiene el merge F6.14-A, pero `CURRENT_STATE.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md` y `handoffs/6.14-A.md` todavía expresan `F6_14_A_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`. UI-01 no corrige ese estado porque tiene prohibido modificar documentación/código del repositorio. Esta discrepancia no impide el inventario UX read-only, pero debe reconciliarse antes de una etapa de implementación si la validación runtime ya ocurrió fuera del repositorio.


## Definiciones de clasificación

- **KEEP:** superficie diferenciada que sigue siendo ancla o experiencia independiente.
- **MERGE:** la capacidad se absorbe visualmente en un workspace; el contrato/flujo se conserva.
- **SUBVIEW:** pestaña/sección contextual.
- **DETAIL:** detalle/ejecución master-detail.
- **REDIRECT_CANDIDATE:** alias o ruta duplicada a validar antes de redirigir.
- **ADMIN_ONLY:** superficie restringida.
- **LEGACY_REVIEW:** uso/ownership UX a verificar antes de cualquier retiro.


## Conteos

- KEEP: **16**
- MERGE: **5**
- SUBVIEW: **45**
- DETAIL: **17**
- REDIRECT_CANDIDATE: **2**
- ADMIN_ONLY: **9**
- LEGACY_REVIEW: **3**

## Consolidaciones prioritarias

1. **Centro Ejecutivo:** `/dashboard` como home; `/grc-global` se integra como vista ejecutiva/portfolio, no como segundo home.
2. **GRC integrado:** `/grc`, `/operaciones-grc` y capacidades F6.8–F6.14 se presentan desde workspaces y contexto, evitando un “portal GRC” paralelo.
3. **Cumplimiento e ISO:** `/cumplimiento-auditoria`, diagnóstico, ISO Health, controles, SOA y ciclo de vida se convierten en una navegación interna coherente.
4. **Auditoría y Mejora:** auditorías, ejecución, hallazgos, NC, planes y recomendaciones comparten contexto pero conservan entidades distintas.
5. **Riesgo y Control:** registro, matriz, cuantitativo, activos y controles comparten filtros/periodo/unidad y drill-down.
6. **Datos y Evidencia:** calidad, catálogo, lineage, semántica, evidencias, importaciones y knowledge surfaces se conectan por provenance/Data Trust.
7. **Resiliencia:** BIA, continuidad, pruebas, crisis, incidentes y eventos de pérdida se estructuran como un mismo ciclo operativo.
8. **Proveedores:** assessment/cuestionarios/detalle y portal externo se relacionan, pero el portal externo conserva experiencia separada.
9. **Privacidad:** actividades, DPIA, brechas y solicitudes como tabs de un workspace único.
10. **Inteligencia y Reportes:** métricas/indicadores/Cross-GRC/AI se diferencian de BI/Report Studio/exportación, pero comparten contexto y filtros.


## Matriz ruta → disposición
| Ruta | Clasificación | Workspace destino | Patrón | Riesgo | Decisión |
|---|---|---|---|---|---|
| `/` | **KEEP** | Acceso / sesión | workspace/anchor | bajo | mantener |
| `/acciones-recomendadas` | **SUBVIEW** | Auditoría y Mejora | tab/section | medio | retener como subvista |
| `/activos` | **SUBVIEW** | Riesgo y Control | tab/section | medio | retener como subvista |
| `/admin-saas` | **ADMIN_ONLY** | Administración | restricted admin shell | bajo | sacar del menú de negocio |
| `/administrar-kpis` | **ADMIN_ONLY** | Operación GRC | restricted admin shell | medio | sacar del menú de negocio |
| `/auditorias` | **SUBVIEW** | Auditoría y Mejora | tab/section | medio | retener como subvista |
| `/auditorias/ejecucion` | **DETAIL** | Auditoría y Mejora | master-detail/drawer | medio | retener como detalle contextual |
| `/auditorias/ia` | **SUBVIEW** | Auditoría y Mejora | tab/section | medio | retener como subvista |
| `/bi` | **KEEP** | BI y Reportes | workspace/anchor | medio | mantener |
| `/bi/dashboards/[id]` | **DETAIL** | BI y Reportes | master-detail/drawer | medio | retener como detalle contextual |
| `/bia` | **SUBVIEW** | Continuidad, Incidentes y Crisis | tab/section | medio | retener como subvista |
| `/bia/[id]` | **DETAIL** | Continuidad, Incidentes y Crisis | master-detail/drawer | medio | retener como detalle contextual |
| `/ciclo-vida` | **SUBVIEW** | Cumplimiento e ISO | tab/section | medio | retener como subvista |
| `/conectores` | **SUBVIEW** | Integraciones y Conectores | tab/section | bajo | retener como subvista |
| `/conectores/[id]` | **DETAIL** | Integraciones y Conectores | master-detail/drawer | bajo | retener como detalle contextual |
| `/conectores/salud` | **SUBVIEW** | Integraciones y Conectores | tab/section | bajo | retener como subvista |
| `/conectores/sincronizaciones` | **SUBVIEW** | Integraciones y Conectores | tab/section | bajo | retener como subvista |
| `/configuracion` | **ADMIN_ONLY** | Administración | restricted admin shell | bajo | sacar del menú de negocio |
| `/continuidad` | **KEEP** | Continuidad, Incidentes y Crisis | workspace/anchor | medio | mantener |
| `/continuidad/planes/[id]` | **DETAIL** | Continuidad, Incidentes y Crisis | master-detail/drawer | medio | retener como detalle contextual |
| `/continuidad/pruebas` | **SUBVIEW** | Continuidad, Incidentes y Crisis | tab/section | medio | retener como subvista |
| `/continuidad/pruebas/[id]` | **DETAIL** | Continuidad, Incidentes y Crisis | master-detail/drawer | medio | retener como detalle contextual |
| `/controles` | **SUBVIEW** | Riesgo y Control | tab/section | medio | retener como subvista |
| `/cotizador` | **ADMIN_ONLY** | Canal Dealer | restricted admin shell | bajo | sacar del menú de negocio |
| `/crisis` | **SUBVIEW** | Continuidad, Incidentes y Crisis | tab/section | medio | retener como subvista |
| `/crisis/[id]` | **DETAIL** | Continuidad, Incidentes y Crisis | master-detail/drawer | medio | retener como detalle contextual |
| `/cumplimiento-auditoria` | **KEEP** | Cumplimiento e ISO | workspace/anchor | medio | mantener |
| `/dashboard` | **KEEP** | Centro Ejecutivo | workspace/anchor | alto | mantener |
| `/datos` | **KEEP** | Datos y Evidencia | workspace/anchor | medio | mantener |
| `/datos/calidad` | **SUBVIEW** | Datos y Evidencia | tab/section | medio | retener como subvista |
| `/datos/catalogo` | **SUBVIEW** | Datos y Evidencia | tab/section | medio | retener como subvista |
| `/datos/lineage` | **SUBVIEW** | Datos y Evidencia | tab/section | medio | retener como subvista |
| `/datos/semantica` | **SUBVIEW** | Datos y Evidencia | tab/section | medio | retener como subvista |
| `/dealer` | **ADMIN_ONLY** | Canal Dealer | restricted admin shell | bajo | sacar del menú de negocio |
| `/diagnostico` | **SUBVIEW** | Cumplimiento e ISO | tab/section | medio | retener como subvista |
| `/documentos` | **LEGACY_REVIEW** | Datos y Evidencia | retain until telemetry/product validation | medio | no retirar aún |
| `/ejecucion-iso` | **LEGACY_REVIEW** | Cumplimiento e ISO | retain until telemetry/product validation | medio | no retirar aún |
| `/empresas` | **LEGACY_REVIEW** | Administración | retain until telemetry/product validation | bajo | no retirar aún |
| `/encuestas` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/encuestas/[id]` | **DETAIL** | Operación GRC | master-detail/drawer | medio | retener como detalle contextual |
| `/evaluaciones` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/eventos-perdida` | **SUBVIEW** | Continuidad, Incidentes y Crisis | tab/section | medio | retener como subvista |
| `/evidencias` | **KEEP** | Datos y Evidencia | workspace/anchor | medio | mantener |
| `/exportes` | **SUBVIEW** | BI y Reportes | tab/section | medio | retener como subvista |
| `/grc-global` | **MERGE** | Centro Ejecutivo | workspace tab/context panel | alto | integrar sin perder capacidad |
| `/grc` | **MERGE** | Inteligencia GRC | workspace tab/context panel | alto | integrar sin perder capacidad |
| `/hallazgos` | **SUBVIEW** | Auditoría y Mejora | tab/section | medio | retener como subvista |
| `/health` | **REDIRECT_CANDIDATE** | Cumplimiento e ISO | compatibility redirect after validation | medio | validar y redirigir si paridad=100% |
| `/ia-auditor` | **MERGE** | Inteligencia GRC | workspace tab/context panel | alto | integrar sin perder capacidad |
| `/ia-compliance` | **MERGE** | Inteligencia GRC | workspace tab/context panel | alto | integrar sin perder capacidad |
| `/ia-compliance/sugerencias` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/ia` | **MERGE** | Inteligencia GRC | workspace tab/context panel | alto | integrar sin perder capacidad |
| `/importaciones` | **SUBVIEW** | Datos y Evidencia | tab/section | medio | retener como subvista |
| `/incidentes` | **SUBVIEW** | Continuidad, Incidentes y Crisis | tab/section | medio | retener como subvista |
| `/incidentes/[id]` | **DETAIL** | Continuidad, Incidentes y Crisis | master-detail/drawer | medio | retener como detalle contextual |
| `/indicadores` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/indicadores/[id]` | **DETAIL** | Inteligencia GRC | master-detail/drawer | alto | retener como detalle contextual |
| `/iso-health` | **SUBVIEW** | Cumplimiento e ISO | tab/section | medio | retener como subvista |
| `/login` | **KEEP** | Acceso / sesión | workspace/anchor | bajo | mantener |
| `/matriz-riesgo` | **SUBVIEW** | Riesgo y Control | tab/section | medio | retener como subvista |
| `/metricas` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/metricas/[id]` | **DETAIL** | Inteligencia GRC | master-detail/drawer | alto | retener como detalle contextual |
| `/metricas/constructor` | **ADMIN_ONLY** | Inteligencia GRC | restricted admin shell | alto | sacar del menú de negocio |
| `/no-conformidades` | **SUBVIEW** | Auditoría y Mejora | tab/section | medio | retener como subvista |
| `/operaciones-grc` | **KEEP** | Operación GRC | workspace/anchor | medio | mantener |
| `/operaciones-grc/activacion` | **SUBVIEW** | Operación GRC | tab/section | medio | retener como subvista |
| `/operaciones-grc/importar` | **SUBVIEW** | Operación GRC | tab/section | medio | retener como subvista |
| `/perfil-empresa` | **ADMIN_ONLY** | Administración | restricted admin shell | bajo | sacar del menú de negocio |
| `/perfil` | **KEEP** | Administración | workspace/anchor | bajo | mantener |
| `/plan-accion` | **REDIRECT_CANDIDATE** | Auditoría y Mejora | compatibility redirect after validation | medio | validar y redirigir si paridad=100% |
| `/planes-accion` | **KEEP** | Auditoría y Mejora | workspace/anchor | medio | mantener |
| `/portal-proveedor` | **KEEP** | Riesgo de Proveedores | workspace/anchor | bajo | mantener |
| `/prefacturacion` | **ADMIN_ONLY** | Canal Dealer | restricted admin shell | bajo | sacar del menú de negocio |
| `/privacidad` | **KEEP** | Privacidad | workspace/anchor | bajo | mantener |
| `/privacidad/actividades` | **SUBVIEW** | Privacidad | tab/section | bajo | retener como subvista |
| `/privacidad/actividades/[id]` | **DETAIL** | Privacidad | master-detail/drawer | bajo | retener como detalle contextual |
| `/privacidad/brechas` | **SUBVIEW** | Privacidad | tab/section | bajo | retener como subvista |
| `/privacidad/dpia` | **SUBVIEW** | Privacidad | tab/section | bajo | retener como subvista |
| `/privacidad/solicitudes` | **SUBVIEW** | Privacidad | tab/section | bajo | retener como subvista |
| `/procesos` | **SUBVIEW** | Operación GRC | tab/section | medio | retener como subvista |
| `/procesos/[id]` | **DETAIL** | Operación GRC | master-detail/drawer | medio | retener como detalle contextual |
| `/proveedores` | **KEEP** | Riesgo de Proveedores | workspace/anchor | bajo | mantener |
| `/proveedores/[id]` | **DETAIL** | Riesgo de Proveedores | master-detail/drawer | bajo | retener como detalle contextual |
| `/proveedores/cuestionarios` | **SUBVIEW** | Riesgo de Proveedores | tab/section | bajo | retener como subvista |
| `/proveedores/evaluaciones` | **SUBVIEW** | Riesgo de Proveedores | tab/section | bajo | retener como subvista |
| `/reportes/generaciones` | **SUBVIEW** | BI y Reportes | tab/section | medio | retener como subvista |
| `/reportes/studio` | **KEEP** | BI y Reportes | workspace/anchor | medio | mantener |
| `/riesgo-cuantitativo` | **SUBVIEW** | Riesgo y Control | tab/section | medio | retener como subvista |
| `/riesgo-cuantitativo/[id]` | **DETAIL** | Riesgo y Control | master-detail/drawer | medio | retener como detalle contextual |
| `/riesgos` | **KEEP** | Riesgo y Control | workspace/anchor | medio | mantener |
| `/servicios` | **SUBVIEW** | Operación GRC | tab/section | medio | retener como subvista |
| `/servicios/[id]` | **DETAIL** | Operación GRC | master-detail/drawer | medio | retener como detalle contextual |
| `/soa` | **SUBVIEW** | Cumplimiento e ISO | tab/section | medio | retener como subvista |
| `/tests` | **SUBVIEW** | Inteligencia GRC | tab/section | alto | retener como subvista |
| `/unidades` | **SUBVIEW** | Operación GRC | tab/section | medio | retener como subvista |
| `/unidades/[id]` | **DETAIL** | Operación GRC | master-detail/drawer | medio | retener como detalle contextual |
| `/usuarios` | **ADMIN_ONLY** | Administración | restricted admin shell | bajo | sacar del menú de negocio |

## Duplicación/fragmentación detectada

- **Dashboard/GRC:** `/dashboard`, `/grc-global`, `/grc` y `/operaciones-grc` compiten por ser “puerta” del estado GRC.
- **Health:** `/iso-health` y `/health` aparecen en el mismo grupo de permisos/active state; `/health` queda como `REDIRECT_CANDIDATE` hacia una única experiencia de salud ISO.
- **Planes:** `/planes-accion` y `/plan-accion` coexistentes; singular queda como `REDIRECT_CANDIDATE` tras validar paridad.
- **IA:** `/ia`, `/ia-auditor`, `/ia-compliance`, `/ia-compliance/sugerencias`, `/auditorias/ia`, `/acciones-recomendadas` deben pasar de “destinos IA” a **asistencia contextual**.
- **Métricas/KPI:** `/metricas`, `/indicadores`, `/administrar-kpis` representan lectura, señal operacional y administración; no deben ser tres conceptos indistinguibles en navegación.
- **Auditoría/NC/hallazgos:** no son la misma entidad; deben compartir workspace y relaciones, no colapsar semánticamente.


## Gates
`DUPLICATE_FLOW_ANALYSIS = PASS`
`CONSOLIDATION_MATRIX = PASS`
`FUNCTIONALITY_LOST = 0`
