# TCDX UI - Indice normativo

Estado: UI-01 completado y UI-02 aprobada como especificacion. La direccion oficial es **B - Executive GRC Workspace**.

## Lectura obligatoria para Codex

| Orden | Archivo | Funcion |
|---:|---|---|
| 1 | `CODEX_UI_EXECUTION_CONTRACT.md` | Limites, precedencia y gates |
| 2 | `UI01_ROUTE_INVENTORY.md` | Baseline de 97 rutas |
| 3 | `UI01_INFORMATION_ARCHITECTURE.md` | Nueve dominios y workspaces |
| 4 | `UI01_CURRENT_TO_TARGET_MAP.md` | Mapeo exhaustivo sin perdida funcional |
| 5 | `UI01_CONSOLIDATION_MATRIX.md` | Reglas KEEP/MERGE/SUBVIEW/DETAIL |
| 6 | `UI01_DESIGN_BACKLOG.md` | Prioridades y criterios UI-01 |
| 7 | `UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md` | Tokens, componentes, estados y reglas completas |
| 8 | `UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md` | Precision visual Product Design |
| 9 | `references/ui02-executive-grc-workspace-v2.png` | Referencia visual aprobada |
| 10 | `UI02_CODEX_IMPLEMENTATION_REFERENCE.md` | Estrategia tecnica por etapas |
| 11 | `UI02_PROMPT_CODEX_IMPLEMENTACION.md` | Prompt para iniciar Etapa 1 |

Los archivos `UI_DESIGN_TARGET.md`, `UI_COMPONENT_RULES.md`, `UI_LAYOUT_PATTERNS.md` y `UI_VISUAL_BENCHMARKS.md` son resumenes compatibles para handoffs existentes. No reemplazan la foundation completa.

## Fuente de verdad

- Contratos funcionales del repositorio: comportamiento y datos.
- UI-01: arquitectura, rutas y preservacion de capacidades.
- UI-02: sistema visual y experiencia objetivo.
- Imagen V2: composicion y apariencia, nunca datos o reglas.

## Estado de implementacion

Esta carpeta no significa que UI-02 ya este implementada. Para comenzar, entregar a Codex `UI02_PROMPT_CODEX_IMPLEMENTACION.md` y ordenar solamente la **Etapa 1 - Visual Foundation tecnica**. La implementacion debe validarse antes de avanzar a workspaces productivos.

No modificar `Tecdex-SpA/tecdex-design-system`; es READ ONLY. No tocar backend, base de datos, APIs, RBAC ni motores de gobierno para acomodar la interfaz.
