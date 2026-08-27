# UI-01 — Arquitectura de información objetivo

## Fuentes y límites de esta auditoría

UI-01 se ejecutó como **análisis read-only**. No se modificó el repositorio de producto ni `Tecdex-SpA/tecdex-design-system`.

Fuentes canónicas inspeccionadas: `PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`, `CURRENT_STATE.md`, `SHARED_BASELINE.md`, `WORK_QUEUE.md`, `DECISIONS.md`, `CONTRACTS_REGISTRY.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md`, `handoffs/6.14-A.md`, árbol real `frontend/src/app`, `Sidebar.tsx`, `mvpPermissions.ts`, `docs/product`, y el design system TECDEX en modo lectura.

Baseline GitHub usado para el cierre del escaneo: `main@35d852fcad93c7721df29a7c007205692959b10f` (merge F6.14-A). El inventario de rutas se verificó contra el árbol App Router y subárboles `truncated=false`.

**Discrepancia documental detectada:** el commit de `main` ya contiene el merge F6.14-A, pero `CURRENT_STATE.md`, `ARCHITECTURE_MAP.md`, `PHASE6_EXPANDED_CLOSURE.md` y `handoffs/6.14-A.md` todavía expresan `F6_14_A_RUNTIME=PENDING_USER_DEPLOY_VALIDATION`. UI-01 no corrige ese estado porque tiene prohibido modificar documentación/código del repositorio. Esta discrepancia no impide el inventario UX read-only, pero debe reconciliarse antes de una etapa de implementación si la validación runtime ya ocurrió fuera del repositorio.


## Arquitectura objetivo: 9 dominios principales

| # | Dominio | Propósito | Workspaces/subvistas principales | Roles de entrada |
|---:|---|---|---|---|
| 1 | **Inicio** | Prioridad, salud, cambios y trabajo pendiente | Centro Ejecutivo, Mi trabajo, alertas | Alta Dirección, managers, owners |
| 2 | **Cumplimiento** | Estado normativo/ISO y control de cumplimiento | Overview, diagnóstico, health, SOA, ciclo de vida | Compliance/ISO Manager, Auditor |
| 3 | **Riesgo y Control** | Riesgo, controles, activos y análisis | Registro, matriz, cuantitativo, controles | Risk Manager, Control Owner |
| 4 | **Auditoría y Mejora** | Assurance, findings, NC y acciones | Auditorías, ejecución, hallazgos, NC, planes | Auditor, Action Owner |
| 5 | **Operación y Resiliencia** | Procesos, BCM, privacidad, proveedores e incidentes | Operación GRC, BIA/BCM, Crisis, Proveedores, Privacidad | Process Owner, BCM, Privacy, Supplier Risk |
| 6 | **Datos y Evidencia** | Calidad, evidencia, provenance y conocimiento | Evidencias, calidad, catálogo, lineage, semántica, ingestión | Evidence Contributor, Data Steward |
| 7 | **Inteligencia** | Prioridad, patrones, anomalías, métricas y asistencia AI | Métricas, indicadores, Cross-GRC, recomendaciones | GRC Managers, Alta Dirección, Auditor |
| 8 | **Reportes** | BI, Report Studio, exportes y generaciones | BI, dashboards, Studio, generaciones | Alta Dirección, Auditor |
| 9 | **Administración** | Configuración, usuarios, integraciones y plataformas restringidas | Perfil, tenant, usuarios, conectores, SaaS Admin, Dealer | Tenant Admin, SaaS Admin, Dealer |

## Navegación propuesta

**Nivel 1:** 9 dominios máximos, filtrados por rol/entitlement. **Nivel 2:** workspaces del dominio. **Nivel 3:** tabs/subvistas. **Nivel 4:** detalle mediante drawer/panel o ruta de detalle cuando sea necesario para deep-linking. La URL puede conservarse por compatibilidad aunque deje de ser una entrada de Sidebar.

El menú cliente actual tiene hasta **18 entradas configuradas**. La propuesta reduce la carga cognitiva a **9 dominios**, sin suprimir las 97 rutas ni sus capacidades durante la transición.


## Home / dashboard

- `/dashboard` debe ser la **Home operativa y ejecutiva adaptativa por rol**, no un catálogo de cards.
- Alta Dirección: exposición, prioridades, cumplimiento, tendencia, top gaps, decisiones/effectiveness y señales con Data Trust.
- Managers: prioridades accionables, aging, responsables, periodos y excepciones.
- Owners/contributors: “mi trabajo”, evidencias pendientes, controles/acciones asignados.
- `/grc-global` no debe competir como segundo home: su portfolio se integra como vista del Centro Ejecutivo.
- `/iso-health` funciona mejor como indicador/drill-down de Cumplimiento; no requiere entrada principal permanente.


## Navegación por rol

| Rol | Entrada primaria | Dominios prioritarios | Evitar por defecto |
|---|---|---|---|
| Alta Dirección | Inicio | Inicio, Inteligencia, Reportes | administración técnica |
| Compliance/ISO Manager | Cumplimiento | Cumplimiento, Auditoría y Mejora, Datos, Inteligencia | SaaS Admin |
| Risk Manager | Riesgo y Control | Riesgo y Control, Operación y Resiliencia, Inteligencia | configuración técnica |
| Auditor | Auditoría y Mejora | Auditoría, Cumplimiento, Datos, Reportes | mutaciones administrativas |
| Control Owner | Riesgo y Control | Riesgo y Control, Auditoría y Mejora | vistas globales no accionables |
| Process Owner | Operación y Resiliencia | Operación, Riesgo, Acciones | SaaS Admin |
| Evidence Contributor | Datos y Evidencia | Evidencias, tareas asignadas | BI/administración no requerida |
| Privacy Officer | Operación y Resiliencia / Privacidad | Privacidad, Incidentes, Datos | módulos no aplicables |
| Supplier Risk | Operación y Resiliencia / Proveedores | Proveedores, Riesgo, Evidencia | administración global |
| Business Continuity | Operación y Resiliencia / BCM | BIA, Continuidad, Crisis, Incidentes | compliance profundo salvo relación |
| Tenant Admin | Administración | Administración, Datos, Integraciones | SaaS global |
| SaaS Admin | Administración | SaaS Admin, métricas de plataforma | datos tenant no autorizados |

## IA contextual

La IA no debe ser un silo de navegación. Se proponen **context panels** y acciones “Explicar / Resumir / Sugerir / Comparar / Preparar evidencia” dentro del objeto que el usuario ya está gestionando.

- `/ia`: integrar como Centro de Inteligencia/assistant global para consultas transversales autorizadas, no como única forma de usar IA.
- `/ia-auditor` + `/auditorias/ia`: asistencia dentro de auditoría, con contexto de auditoría/hallazgos/evidencia.
- `/ia-compliance` + sugerencias: asistencia contextual en Cumplimiento y priorización; preserve deep links durante transición.
- `/acciones-recomendadas`: recomendaciones visibles en Auditoría y Mejora/Planes, con provenance, decisión humana y Effectiveness.
- F6.14 debe traducirse visualmente en provenance, grounding, estado de evidencia, fallback/insufficient evidence y límites de autoridad, sin exponer complejidad técnica innecesaria.
- La IA **no aprueba cumplimiento, no acepta riesgo, no cierra Gap, no publica verdad legal, no ejecuta SQL ni confirma memoria operacional**.


## Lenguaje visual TECDEX

Referencia read-only `tecdex-design-system`: naranja `#F0721D` para CTA primario, teal `#51ABA8` como acento secundario, navy `#2B3944` para superficies oscuras, base blanca/gris clara; Roboto en encabezados/acento y sistema tipográfico documentado. Para SaaS enterprise, usar los tokens como fuente de verdad, tablas densas, jerarquía clara, badges semánticos, drawers, tabs, breadcrumbs y estados universales. Evitar sombras decorativas excesivas, estética gamer, proliferación de cards y páginas de una sola acción.


## Gates
`TARGET_INFORMATION_ARCHITECTURE = PASS`
`ROLE_NAVIGATION_ANALYSIS = PASS`
`AI_CONTEXTUALIZATION_ANALYSIS = PASS`
