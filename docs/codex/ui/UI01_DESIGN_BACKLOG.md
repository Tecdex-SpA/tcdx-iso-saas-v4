# UI-01 — Design Backlog

## Fuentes y límites de esta auditoría

UI-01 se ejecutó como **análisis read-only**. No se modificó el repositorio de producto ni `Tecdex-SpA/tecdex-design-system`.

Fuentes canónicas inspeccionadas: `PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`, `CURRENT_STATE.md`, `SHARED_BASELINE.md`, `WORK_QUEUE.md`, `DECISIONS.md`, `CONTRACTS_REGISTRY.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md`, `handoffs/6.14-A.md`, árbol real `frontend/src/app`, `Sidebar.tsx`, `mvpPermissions.ts`, `docs/product`, y el design system TECDEX en modo lectura.

Baseline GitHub usado para el cierre del escaneo: `main@35d852fcad93c7721df29a7c007205692959b10f` (merge F6.14-A). El inventario de rutas se verificó contra el árbol App Router y subárboles `truncated=false`.

**Discrepancia documental detectada:** el commit de `main` ya contiene el merge F6.14-A, pero `CURRENT_STATE.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md` y `handoffs/6.14-A.md` todavía expresan `F6_14_A_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`. UI-01 no corrige ese estado porque tiene prohibido modificar documentación/código del repositorio. Esta discrepancia no impide el inventario UX read-only, pero debe reconciliarse antes de una etapa de implementación si la validación runtime ya ocurrió fuera del repositorio.


## P0 — antes de implementar la nueva UI

- **P0.1 Reconciliar estado F6.14 runtime:** `main` contiene merge F6.14-A, pero documentos canónicos siguen marcando runtime pending. No reabrir contratos; sólo aclarar el gate documental/runtime antes de UI-02 si la validación ya ocurrió.
- **P0.2 Congelar inventario de 97 rutas:** usar este mapa como baseline de no-pérdida funcional.
- **P0.3 Definir 9 dominios y ownership UX:** aprobar nombres y ubicación de cada subworkspace.
- **P0.4 Definir navegación RBAC/entitlements:** mantener autorización backend; el frontend sólo filtra/presenta.
- **P0.5 Definir patrón universal de workspace:** header contextual, filtros persistentes, tabs, content area, right-context panel, detail drawer, breadcrumbs.
- **P0.6 Definir estados universales:** loading, empty, insufficient data, error, permission denied, stale, Data Trust warning, partial dataset. Nunca convertir falta de datos en cero/verde.
- **P0.7 Definir patrón AI contextual:** grounding/provenance, confidence, insufficient evidence, human decision boundary.
- **P0.8 Proteger deep links y accesibilidad:** ninguna consolidación rompe URLs de detalle sin redirect/compatibilidad comprobada.


## P1 — transformación de la experiencia

- **P1.1 App shell enterprise:** Sidebar por dominios, topbar contextual, tenant/period selector, search, notifications, profile.
- **P1.2 Centro Ejecutivo:** reemplazar competencia dashboard/grc-global por home adaptativa por rol.
- **P1.3 Workspace Cumplimiento:** diagnóstico/health/SOA/ciclo/control con tabs y un solo contexto normativo.
- **P1.4 Workspace Riesgo y Control:** registro/matriz/cuantitativo/activos/controles con filtros compartidos.
- **P1.5 Workspace Auditoría y Mejora:** auditorías→ejecución→hallazgo/NC→plan→effectiveness.
- **P1.6 Workspace Resiliencia:** BIA→continuidad→pruebas→crisis/incidentes; privacidad y proveedores como subworkspaces.
- **P1.7 Workspace Datos y Evidencia:** catálogo/calidad/lineage/semántica/evidencia/ingestión con Data Trust visible.
- **P1.8 Inteligencia contextual:** Priority, Impact Graph, patterns/trends/anomalies, RAG/Regulatory y recomendaciones sin crear otro source of truth.
- **P1.9 Reportes:** BI, Studio, generaciones y exportes bajo una sola arquitectura.
- **P1.10 Administración:** separar tenant admin, platform admin y dealer de la navegación GRC de negocio.


## P2 — refinamiento y optimización

- Telemetría UX para saber qué rutas/subvistas se usan y cerrar `LEGACY_REVIEW`.
- Command palette/search universal por entidad y capacidad autorizada.
- Personalización de home por rol sin crear dashboards paralelos.
- Saved views, filtros y columnas por usuario/rol.
- Progressive disclosure para funciones avanzadas.
- Responsive final y WCAG; navegación por teclado, focus states y contraste.
- QA visual automatizable y snapshots de rutas críticas.
- Evaluar redirects definitivos de `/health` y `/plan-accion` sólo después de paridad 100%.


## Criterios de aceptación de diseño

- 97/97 rutas tienen destino target.
- 0 capacidades eliminadas.
- 9 dominios principales como máximo para cliente; subset por rol/entitlement.
- Ninguna entidad GRC se fusiona semánticamente sólo por reducir pantallas.
- Data Trust/insufficient data/provenance tienen representación explícita.
- AI conserva límites F6.14 y aparece contextual.
- Admin/dealer quedan segregados de navegación cliente.
- Design system se usa como referencia/tokens, sin modificar su repositorio.


## Gates UI-01

`ALL_FRONTEND_ROUTES_INVENTORIED = PASS`
`ROUTE_FUNCTION_MAPPING = PASS`
`DUPLICATE_FLOW_ANALYSIS = PASS`
`CONSOLIDATION_MATRIX = PASS`
`TARGET_INFORMATION_ARCHITECTURE = PASS`
`ROLE_NAVIGATION_ANALYSIS = PASS`
`AI_CONTEXTUALIZATION_ANALYSIS = PASS`
`CURRENT_TO_TARGET_MAP = PASS`
`DESIGN_BACKLOG = PASS`

`FUNCTIONALITY_LOST = 0`
`BACKEND_CHANGED = 0`
`DATABASE_CHANGED = 0`
`API_CHANGED = 0`
`RBAC_CHANGED = 0`
`F6_CONTRACTS_CHANGED = 0`
`REPOSITORY_FILES_CHANGED = 0`
`DESIGN_REPOSITORY_CHANGED = 0`
`DEPLOY_EXECUTED = 0`

## Estado

**UI-01 = COMPLETE / PASS (READ-ONLY).** No se inicia UI-02 en este entregable.
