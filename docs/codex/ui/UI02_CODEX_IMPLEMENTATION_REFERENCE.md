# UI-02 Codex Implementation Reference
# TCDX ISO SaaS v4 - Executive GRC Workspace

Este archivo es una referencia para Codex antes de implementar UI. Debe leerse junto con:

1. `docs/codex/ui/UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md`
2. `docs/codex/ui/UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md`
3. Los entregables UI-01:
   - `docs/codex/ui/UI01_ROUTE_INVENTORY.md`
   - `docs/codex/ui/UI01_INFORMATION_ARCHITECTURE.md`
   - `docs/codex/ui/UI01_CURRENT_TO_TARGET_MAP.md`
   - `docs/codex/ui/UI01_CONSOLIDATION_MATRIX.md`
   - `docs/codex/ui/UI01_DESIGN_BACKLOG.md`
4. Documentos internos del repo:
   - `docs/codex/ui/UI_DESIGN_TARGET.md`
   - `docs/codex/ui/UI_COMPONENT_RULES.md`
   - `docs/codex/ui/UI_LAYOUT_PATTERNS.md`
   - `docs/codex/ui/UI_VISUAL_BENCHMARKS.md`
5. Referencia visual aprobada:
   - `docs/codex/ui/references/ui02-executive-grc-workspace-v2.png`

---

## 1. Objetivo de implementacion

Implementar progresivamente la foundation UI-02 en el frontend de `TCDX ISO SaaS v4`, sin alterar comportamiento funcional ni contratos de datos.

La implementacion debe transformar la experiencia visual hacia **Executive GRC Workspace**:

- SaaS enterprise.
- Sobria.
- Moderna.
- Densa pero legible.
- Eficiente para uso diario.
- Comercialmente presentable.
- Sin perdida de capacidades.

---

## 2. Reglas no negociables

No modificar:

- Backend.
- Base de datos.
- APIs.
- RBAC.
- Math Governance.
- Data Trust.
- Observation.
- Gap.
- Impact Graph.
- Priority Engine.
- Knowledge Base.
- RAG.
- Regulatory Intelligence.
- Operational Memory.
- AI Governance.

No hacer:

- Commit.
- Push.
- Merge.
- Deploy.
- Migraciones.
- Eliminacion de rutas.
- Redireccion definitiva sin validacion.
- Hardcode de tenant, IDs, datos demo, normas o periodos.
- Cambio de reglas funcionales.
- Conversion de null/dato faltante/error a cero.

---

## 3. Archivos probables a inspeccionar primero

Inspeccionar antes de editar:

| Area | Archivos |
|---|---|
| Shell | `frontend/src/components/AppLayout.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/Header.tsx` |
| Tokens globales | `frontend/src/app/globals.css` |
| Componentes enterprise | `frontend/src/components/ui/enterprise/*` |
| Navegacion/RBAC frontend | `frontend/src/utils/mvpPermissions.ts` |
| Dashboard | `frontend/src/app/dashboard/page.tsx`, componentes relacionados |
| Riesgo y Control | `frontend/src/app/riesgos`, `frontend/src/app/matriz-riesgo`, `frontend/src/app/riesgo-cuantitativo`, `frontend/src/components/riesgos/*` |
| Cumplimiento | `frontend/src/app/cumplimiento-auditoria`, `frontend/src/app/soa`, `frontend/src/app/iso-health` |
| Datos/Evidencia | `frontend/src/app/datos`, `frontend/src/app/evidencias` |
| Inteligencia | `frontend/src/components/intelligence/*`, `frontend/src/components/math-governance/*` |

Si existen cambios no relacionados en el worktree, no revertirlos.

---

## 4. Estrategia de implementacion recomendada

### Etapa 1 - Foundation tecnica visual

Objetivo:

- Normalizar tokens CSS.
- Ajustar radius, shadows, borders y surfaces.
- Consolidar estilos `Enterprise*`.
- No cambiar flujos.

Entregable:

- App shell y componentes base se ven como Executive GRC Workspace.

### Etapa 2 - App Shell y navegacion

Objetivo:

- Sidebar con 9 dominios maximos.
- Mantener filtrado RBAC/entitlements.
- Topbar con breadcrumb, tenant, periodo, search, notificaciones y usuario.
- Conservar deep links actuales.

Entregable:

- Menos entradas visibles sin eliminar rutas.

### Etapa 3 - Riesgo y Control como workspace modelo

Objetivo:

- Implementar el patron completo en un dominio.
- Header + KPIs + tabs + filtros + tabla + drawer + IA contextual.
- Usar datos reales existentes y contratos actuales.

Entregable:

- Workspace modelo para replicar en Cumplimiento, Auditoria, Datos y Reportes.

### Etapa 4 - Estados universales y Data Trust

Objetivo:

- Crear/normalizar estados universales.
- Representar `zero`, `empty`, `insufficient`, `not calculable`, `not available`, `error`, `stale`, `partial dataset`.
- Mostrar Data Trust consistentemente.

Entregable:

- Las vistas criticas no confunden falta de datos con cero.

### Etapa 5 - Replicacion controlada por dominios

Objetivo:

- Aplicar patrones a Cumplimiento, Auditoria, Datos, Inteligencia y Reportes.
- Mantener rutas y capacidades segun UI-01.

Entregable:

- Plataforma coherente, no coleccion de paginas aisladas.

---

## 5. Componentes base sugeridos

Antes de crear, revisar si ya existen equivalentes.

| Componente | Funcion |
|---|---|
| `EnterpriseAppShell` | Shell base si conviene extraer de AppLayout |
| `EnterpriseSidebar` | Sidebar por dominios |
| `EnterpriseTopbar` | Tenant, periodo, search, user |
| `WorkspaceHeader` | Titulo, subtitulo, acciones, Data Trust opcional |
| `WorkspaceTabs` | Tabs consistentes |
| `WorkspaceFilterBar` | Filtros persistentes |
| `EnterpriseKpiCard` | KPI compacto |
| `EnterpriseDataTable` | Tabla con density, sticky, bulk, empty states |
| `EntityDetailDrawer` | Drawer derecho contextual |
| `DataTrustChip` | Estado y tooltip/popover |
| `UniversalStateBlock` | Empty/error/insufficient/no disponible |
| `ContextualAiCard` | IA contextual con provenance |
| `StatusChip` | Riesgo/cumplimiento/workflow |

---

## 6. Navegacion objetivo

Sidebar cliente:

1. Inicio
2. Cumplimiento
3. Riesgo y Control
4. Auditoria y Mejora
5. Operacion y Resiliencia
6. Datos y Evidencia
7. Inteligencia
8. Reportes
9. Administracion

Mapeo de rutas:

- Usar UI-01 como fuente.
- `KEEP` se mantiene como ancla.
- `SUBVIEW` se muestra como tab/seccion.
- `DETAIL` se conserva como deep link o drawer.
- `MERGE` es consolidacion visual, no eliminacion funcional.
- `ADMIN_ONLY` se restringe por rol.
- `LEGACY_REVIEW` no se toca salvo instruccion expresa.
- `REDIRECT_CANDIDATE` no se redirige todavia sin paridad comprobada.

---

## 7. Data Trust y estados

Codex debe implementar UI que distinga:

| Estado | No hacer | Hacer |
|---|---|---|
| Zero | No ocultar | Mostrar 0 como dato real |
| Empty | No mostrar 0 | Empty state explicito |
| Insufficient | No calcular igual | Mostrar datos insuficientes |
| Not calculable | No forzar formula | Explicar causa |
| Not available | No mostrar error tecnico | Mostrar no disponible/configurar |
| Error | No silenciar | Mostrar error y retry |
| Partial | No mostrar verde | Mostrar warnings/conteos |

Data Trust debe tener chip + tooltip/popover con fuente, timestamp, warnings y confidence cuando existan.

---

## 8. IA contextual

No crear una nueva pagina principal de IA para resolver UI-02.

Patrones:

- AI card dentro del drawer de riesgo/control/evidencia.
- AI explanation dentro de metricas.
- AI evidence review dentro de evidencias.
- AI audit assistant dentro de auditoria.

Regla de copy:

- Siempre dejar claro que es recomendacion/asistencia.
- Nunca declarar cumplimiento, cierre, aprobacion o aceptacion automatica.

---

## 9. Validacion minima por etapa

Por cada etapa:

1. `git status --short`.
2. Revisar diffs propios.
3. Ejecutar checks disponibles del frontend.
4. Si hay dev server viable, screenshot desktop 1440 y laptop 1280.
5. Verificar que rutas principales cargan.
6. Confirmar que no se tocaron backend/API/BD/RBAC.

Checks esperados si el repo lo soporta:

```bash
cd frontend
npm run lint
npm run build
```

Si usa pnpm/npm/yarn segun lockfile, respetar el gestor existente.

---

## 10. Definition of Done

Una etapa se puede cerrar solo si:

- No hay perdida funcional.
- No se modificaron contratos.
- No se introdujeron hardcodes.
- La navegacion sigue respetando RBAC.
- Los estados de datos son explicitos.
- La UI se ve coherente con Executive GRC Workspace.
- No hay overflow, clipping ni texto ilegible en desktop/laptop.
- Se documentan cambios y pruebas ejecutadas.
