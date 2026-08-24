# Prompt para Codex - Implementacion posterior UI-02

Los archivos UI-01, UI-02 y la referencia visual ya se encuentran en `docs/codex/ui`. Usar este prompt para iniciar solamente la Etapa 1.

---

## PROMPT

Actua como Principal Frontend Engineer, Principal Product Designer y Design Systems Architect para una plataforma SaaS enterprise GRC.

Producto:
`TCDX ISO SaaS v4`

Repositorio:
`Tecdex-SpA/tcdx-iso-saas-v4`

Repositorio de identidad visual:
`Tecdex-SpA/tecdex-design-system`

IMPORTANTE:

- `tecdex-design-system` es READ ONLY.
- No modificar backend.
- No modificar base de datos.
- No modificar APIs.
- No modificar RBAC.
- No modificar Math Governance.
- No modificar Data Trust.
- No modificar Observation, Gap, Impact Graph, Priority Engine, Knowledge Base, RAG, Regulatory Intelligence, Operational Memory ni AI Governance.
- No crear migraciones.
- No eliminar rutas.
- No hacer deploy.
- No hacer push.
- No hacer merge.
- No hacer commits salvo que yo lo pida explicitamente.
- No hardcodear tenants, IDs, periodos, datos demo, normas ni clientes.
- No convertir `null`, dato faltante, dato insuficiente, dato no calculable, dato no disponible o error en cero.

## Contexto

UI-01 ya definio:

- Inventario de 97 rutas App Router.
- Arquitectura objetivo de 9 dominios.
- Matriz Current -> Target.
- Matriz de consolidacion.
- Backlog de diseno.

UI-02 selecciono la direccion visual:

**Executive GRC Workspace**

Debes leer antes de editar:

1. `docs/codex/ui/README.md`
2. `docs/codex/ui/CODEX_UI_EXECUTION_CONTRACT.md`
3. `docs/codex/ui/UI01_ROUTE_INVENTORY.md`
4. `docs/codex/ui/UI01_INFORMATION_ARCHITECTURE.md`
5. `docs/codex/ui/UI01_CURRENT_TO_TARGET_MAP.md`
6. `docs/codex/ui/UI01_CONSOLIDATION_MATRIX.md`
7. `docs/codex/ui/UI01_DESIGN_BACKLOG.md`
8. `docs/codex/ui/UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md`
9. `docs/codex/ui/UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md`
10. `docs/codex/ui/UI02_CODEX_IMPLEMENTATION_REFERENCE.md`
11. `docs/codex/ui/UI_DESIGN_TARGET.md`
12. `docs/codex/ui/UI_COMPONENT_RULES.md`
13. `docs/codex/ui/UI_LAYOUT_PATTERNS.md`
14. `docs/codex/ui/UI_VISUAL_BENCHMARKS.md`
15. `docs/codex/ui/references/ui02-executive-grc-workspace-v2.png`

Tambien inspecciona:

- `frontend/src/app/globals.css`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/ui/enterprise/*`
- `frontend/src/utils/mvpPermissions.ts`

## Objetivo de esta ejecucion

Implementar la primera etapa de UI-02:

**Etapa 1 - Visual Foundation tecnica**

Alcance de esta etapa:

- Normalizar tokens visuales globales segun UI-02.
- Ajustar estilo base enterprise: surfaces, borders, radius, elevation, typography y estados.
- Mejorar componentes `Enterprise*` existentes sin duplicar libreria visual.
- Mantener App Shell actual funcional.
- No remodelar todavia todos los workspaces.
- No cambiar contratos ni datos.

## Resultado visual esperado

La UI debe acercarse a:

- SaaS enterprise.
- Sobria.
- Profesional.
- Moderna.
- Densa pero legible.
- Util para trabajo diario.
- Comercialmente presentable.

Debe evitar:

- Estetica startup colorida.
- Gamer/futurista.
- Gradientes decorativos.
- Exceso de sombras.
- Cards gigantes.
- Mucho espacio vacio.
- Iconografia decorativa.
- Colores sin significado operacional.

## Reglas de diseno obligatorias

1. Usar TECDEX como fuente de marca:
   - Naranja TECDEX para CTA/acento activo.
   - Teal TECDEX como acento secundario controlado.
   - Grafito/navy TECDEX en sidebar.
   - Blanco/gris claro en superficies.

2. Reducir radios excesivos:
   - Botones/inputs: 6 px.
   - Cards/tablas/drawers: 8 px.
   - Modals/panels destacados: 12 px.

3. Reducir sombras:
   - Usar borders como estructura principal.
   - Sombras solo para capas funcionales.

4. Mejorar tablas:
   - Header claro.
   - Row height enterprise.
   - Hover/selected.
   - Empty/error/insufficient states explicitos.

5. Mantener Data Trust visible:
   - Trusted.
   - Trusted with warnings.
   - Low confidence.
   - Insufficient data.

6. IA contextual:
   - Solo como cards/panels integrados.
   - No crear chatbot persistente.
   - No declarar decisiones automaticas.

## Proceso requerido

1. Ejecuta `git status --short`.
2. Lee los archivos de referencia indicados.
3. Inspecciona los componentes y estilos actuales.
4. Propone brevemente el alcance exacto de archivos a tocar.
5. Implementa solo la Etapa 1.
6. Ejecuta lint/build o checks frontend disponibles.
7. Revisa diff.
8. Entrega resumen con:
   - Archivos modificados.
   - Cambios realizados.
   - Checks ejecutados.
   - Riesgos pendientes.
   - Siguiente etapa recomendada.

## Prohibiciones especificas

- No tocar `backend/`.
- No tocar `database/`.
- No tocar `ai-engine/`.
- No tocar contratos F6.
- No tocar rutas para eliminarlas.
- No renombrar entidades funcionales.
- No cambiar permisos.
- No cambiar comportamiento de calculos.
- No cambiar formulas.
- No cambiar integraciones.
- No introducir datos mock nuevos para pasar visualmente.

## Criterios de aceptacion

La etapa se considera lista si:

- La app conserva funcionalidad existente.
- Los componentes base se ven coherentes con Executive GRC Workspace.
- Los tokens quedan claros y reutilizables.
- No se pierde ninguna ruta.
- No se cambia backend/API/BD/RBAC.
- Los estados de datos se representan de forma segura.
- `git diff` muestra cambios acotados al frontend visual/base.
- Los checks disponibles pasan o se documenta claramente por que no pudieron ejecutarse.

Al terminar, NO hagas commit. Espera mis instrucciones.
