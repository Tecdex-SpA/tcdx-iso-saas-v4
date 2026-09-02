# UI-OPT-01-PRODUCTIVITY-CLEANUP — Handoff

Fecha: 2026-09-02  
Owner: CODEX C / Frontend UX Product E2E  
Account: codex  
Branch: `main`  
Base/HEAD: `e7dc1b01c03a20c6852db2db3e52a2ca10d4d24a`  
Status: `READY_FOR_HUMAN_REVIEW`  
Commit: `NO`  
Push/deploy/production writes: `NO`

## Objetivo Cerrado

Limpieza productiva focal de superficies UI que mezclaban duplicacion, enumeraciones tecnicas, CTAs falsos, fuentes documentales no productivas visibles y flujos avanzados expuestos como primarios. No cambia backend, BD, RBAC canonico, modelo comercial, formulas oficiales, Health authority ni rutas.

## Tabla De Cierre

| route | problem | root cause | decision | change | data source | CTA behavior | visibility decision | remaining debt |
|---|---|---|---|---|---|---|---|---|
| `/auditorias` | Bloque repetido de audit readiness competia con flujos reales | `AuditReadinessCard` incrustado fuera de flujo auditor | Remover duplicado y preservar preparacion auditora real | Se elimina bloque intelligence duplicado; quedan tabs y paneles auditores existentes | Hooks/componentes existentes | CTAs reales de tabs existentes | Visible como ruta productiva | None within scope |
| `/cumplimiento-auditoria` | Readiness inteligente duplicado antes del diagnostico | Componente transversal repetido en pantalla de diagnostico | Priorizar diagnostico y no duplicar readiness | Se elimina bloque `AuditReadinessCard`/empty/error repetido | `StrengthenedDiagnosticPanel` | Sin CTA nuevo | Visible como ruta productiva | None within scope |
| `/dashboard KPI` | Codigos KPI crudos visibles | Fallback visual usaba codigos internos como labels | Localizar presentacion sin cambiar lookups | `presentationLabel()` aplicado a `EVIDENCE-FRESH`, `COVERAGE`, `DATA-TRUST` y mini card code | Health/KPI existente | Sin CTA nuevo | Visible | None within scope |
| `/grc-global` | Superficie global avanzada expuesta en nav primaria | Ruta preservada pero item productivo confundia portfolio/dashboard | Ocultar de navegacion, no eliminar ruta ni permisos | Removido de enterprise nav, Phase2 nav y client MVP nav | Ruta/backend existentes | N/A | `HIDE_FROM_NAV`; route preserved | None within scope |
| `/exportes` | Reportes premium mostraban placeholder permanente y enums tecnicos | UI renderizaba preview/narrativa aunque no hubiera contenido real | Mostrar contenido solo si existe y empty explicativo si no | Preview/narrativa/fuentes condicionales; source/status/visibility localizados | `/api/reports/preview` y narrative existentes | Empty state sin href falso | Visible | None within scope |
| `/reportes/studio` | Diseñador de reportes util pero confuso | `OperationalBuilder` exponia campos tecnicos de metric builder para reportes | Especializar `kind='report'` sin afectar otros kinds | Flujo visible: resultado oficial, nombre/tipo/formato, previsualizar, guardar, generar, historial | Catalogo oficial + endpoints existentes | Botones reales; no href falso | Visible | None within scope |
| `/evidencias` | Fuentes no productivas visibles y biblioteca documental poco usable | Fallback/UI listaba Zoho, Sync Agent y carpeta montada como opciones productivas | Mostrar Google Drive y carga manual; preservar backend/integraciones | `fallbackSources`, filtros, cards, source rows y panel Google Drive limitan fuentes visibles; tabla scrolleable | Evidence library/document integrations existentes | Google OAuth/manual upload reales; sin CTA falsa | Zoho/Sync/Mounted hidden from productive UI | None within scope |
| `/datos` | Puerta de Data Governance exponia herramientas avanzadas como primarias | Nav local mezclaba semantica/calidad/lineage con entrada principal | Simplificar puerta a evidencias/importaciones | Empty con CTA real a `/importaciones`; links avanzados removidos | `/api/data/domains` | CTA real a importaciones | Visible como puerta principal | None within scope |
| `/datos/calidad` | Empty no indicaba siguiente accion real | Evaluacion depende de material importado/cargado | Mantener ruta avanzada con CTA real | Empty explica dependencia de datos y enlaza `/importaciones` | `/api/data/quality` | CTA real a importaciones | Hidden from primary data nav | None within scope |
| `/datos/catalogo` | Mensaje sugeria alta por API/admin desde pantalla sin flujo productivo | Catalogo avanzado sin alta UI | Explicar gobierno avanzado sin inventar CTA | Empty sin CTA nueva | `/api/data/elements` | Explanation only | Hidden from primary data nav | None within scope |
| `/datos/lineage` | Empty state generico podia sugerir flujo inexistente | Lineage necesita entidad real de origen | Explanation-only sin CTA falsa | `ActionableEmptyState` explica entrada desde entidad real | `/api/data/lineage` / `/api/data/impact` | Explanation only | Hidden from primary data nav | None within scope |
| `/datos/semantica` | Workspace avanzado expuesto al abrir URL directa | Ruta preservada pero no debe ser flujo productivo primario | Mantener ruta y explicar preservacion avanzada | Reemplazado por empty explicativo sin alta directa | Semantic layer backend/ruta preservados | Explanation only | Hidden from primary data nav | None within scope |

## Do Not Rediscover

- `GRC_GLOBAL_NAV_VISIBILITY=HIDDEN`; `GRC_GLOBAL_ROUTE_PRESERVED=YES`.
- `RBAC_PRESERVED=YES`; no modificar permisos canonicos, roles ni gates comerciales.
- `BACKEND_PRESERVED=YES`; no cambiar endpoints, APIs, BD, migraciones ni formulas.
- Data Governance avanzado queda fuera de navegacion primaria: `/datos/calidad`, `/datos/catalogo`, `/datos/lineage`, `/datos/semantica`.
- Evidencias productivas visibles: Google Drive y carga manual.
- Zoho Drive/WorkDrive, Sync Agent y carpeta montada quedan hidden from productive UI; backend/integraciones preservadas.
- Audit readiness duplicado no debe reinsertarse en `/auditorias` ni `/cumplimiento-auditoria`.
- No convertir ausencia/no-data/insufficient en cero.

## Archivos Cambiados

- `frontend/src/app/auditorias/page.tsx`
- `frontend/src/app/cumplimiento-auditoria/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/datos/page.tsx`
- `frontend/src/app/datos/calidad/page.tsx`
- `frontend/src/app/datos/catalogo/page.tsx`
- `frontend/src/app/datos/lineage/page.tsx`
- `frontend/src/app/datos/semantica/page.tsx`
- `frontend/src/components/enterprise-domain/EnterpriseDomainWorkspaceShell.tsx`
- `frontend/src/components/evidences/GoogleDriveSourcesPanel.tsx`
- `frontend/src/components/evidences/UnifiedEvidenceLibrary.tsx`
- `frontend/src/components/indicators/FunctionalIndicatorCatalog.tsx`
- `frontend/src/components/math-governance/OperationalBuilder.tsx`
- `frontend/src/components/phase2/Phase2Nav.tsx`
- `frontend/src/components/phase5/Phase5Workspace.tsx`
- `frontend/src/components/reports/PremiumReportsPanel.tsx`
- `frontend/src/components/ui/enterprise/ActionableEmptyState.tsx`
- `frontend/src/components/ui/enterprise/index.ts`
- `frontend/src/config/enterpriseNavigation.ts`
- `frontend/src/utils/mvpPermissions.ts`
- `frontend/src/utils/presentationLabels.ts`

## Contratos, Arquitectura Y Migraciones

- Contracts modified: `NO`
- Architecture modified: `NO`
- Database modified: `NO`
- Migrations modified: `NO`
- Backend/API modified: `NO`
- Commercial authority modified: `NO`
- RBAC authority modified: `NO`
- Tenant-specific logic: `NO`

## Validacion

PASS local:

- `git diff --check`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:phase6-sidebar-rbac`
- `npm --prefix frontend run test:phase6-commercial-multitenant`
- `npm --prefix frontend run build`

Nota: `npm --prefix frontend run build` actualizo automaticamente `frontend/tsconfig.json` para incluir `.next/dev/types/**/*.ts`; se restauro `frontend/tsconfig.json` y `git diff --check` quedo limpio.

No ejecutar Playwright completo, suite backend completa, push, merge ni deploy desde Codex.

## Remaining Debt

NONE_WITHIN_UI_OPT_01_SCOPE

## Next Gate

`HUMAN_REVIEW -> COMMIT -> PUSH -> OFFICIAL_DEPLOY -> FOCAL_POSTDEPLOY_UI_VALIDATION`
