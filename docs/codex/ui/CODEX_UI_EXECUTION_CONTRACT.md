# CODEX UI EXECUTION CONTRACT

Contrato obligatorio para cualquier trabajo de interfaz en TCDX ISO SaaS v4.

## 1. Orden de lectura

Antes de editar codigo, Codex debe leer y citar en su reporte:

1. `docs/codex/CURRENT_STATE.md`
2. `docs/codex/WORK_QUEUE.md`
3. `docs/codex/SHARED_BASELINE.md`
4. `docs/codex/DECISIONS.md`
5. `docs/codex/CONTRACTS_REGISTRY.md`
6. `docs/codex/ARCHITECTURE_MAP.md`
7. `docs/codex/ui/README.md`
8. Los cinco documentos `docs/codex/ui/UI01_*.md`
9. `docs/codex/ui/UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md`
10. `docs/codex/ui/UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md`
11. `docs/codex/ui/UI02_CODEX_IMPLEMENTATION_REFERENCE.md`
12. `docs/codex/ui/references/ui02-executive-grc-workspace-v2.png`
13. El repositorio `Tecdex-SpA/tecdex-design-system` en modo READ ONLY.

`UI02_PROMPT_CODEX_IMPLEMENTACION.md` se usa como orden de trabajo, no como fuente superior a la foundation.

Si Codex no puede inspeccionar la imagen V2 o el Design System, debe detener la implementacion y reportar `BLOCKED_VISUAL_BASELINE_UNAVAILABLE`. No debe improvisar.

## 2. Jerarquia normativa

En caso de ambiguedad o conflicto:

1. Contratos funcionales y documentos canonicos del producto.
2. UI-01 para arquitectura, rutas y preservacion de capacidades.
3. UI-02 Visual Foundation para tokens, componentes, estados, navegacion y responsive.
4. UI-02 Product Design Adjustment V2 para composicion, jerarquia y densidad.
5. Imagen V2 para apariencia y proporcion visual.

La imagen nunca autoriza inventar datos, estados, reglas o capacidades.

## 3. Limites de implementacion

No modificar backend, base de datos, APIs, RBAC, Math Governance, Data Trust, Observation, Gap, Impact Graph, Priority Engine, Knowledge Base, RAG, Regulatory Intelligence, Operational Memory ni AI Governance.

No eliminar rutas, romper deep links, hardcodear tenant/IDs/periodos/datos demo, convertir ausencia de datos en cero, crear migraciones, desplegar ni crear commits salvo orden explicita.

`Tecdex-SpA/tecdex-design-system` es exclusivamente READ ONLY.

## 4. No design invention gate

La direccion aprobada es **B - Executive GRC Workspace**. Codex implementa el baseline; no redefine paleta, densidad, tipografia, radios, sombras, navegacion, tablas, Data Trust, IA contextual ni patrones responsive por iniciativa propia.

Cuando el repositorio tenga un componente reutilizable, debe adaptarlo a los tokens oficiales antes de crear otro. No introducir una segunda libreria visual.

## 5. Visual acceptance gate

Cada vista modificada debe verificarse en desktop 1440, laptop 1280 y los breakpoints que apliquen. Codex debe producir screenshots, comparar contra la referencia V2 y reportar diferencias materiales.

No se acepta `DONE` sin validar estados loading, empty, insufficient data, error, permisos, focus, teclado, overflow y ausencia de regresiones funcionales.

## 6. Gates de cierre

```text
VISUAL_BASELINE_READ=PASS
UI01_ROUTE_BASELINE_READ=PASS
UI02_FOUNDATION_READ=PASS
PRODUCT_DESIGN_V2_READ=PASS
DESIGN_SYSTEM_READ_ONLY=PASS
NO_DESIGN_INVENTION=PASS
REFERENCE_PATTERN_MATCH=PASS
COMPONENT_REUSE=PASS
DATA_STATES_PRESERVED=PASS
DATA_TRUST_SEPARATE_FROM_RISK=PASS
AI_CONTEXTUAL_ADVISORY_ONLY=PASS
RESPONSIVE=PASS
ACCESSIBILITY_WCAG_AA=PASS
FUNCTIONAL_REGRESSION=PASS
SELLABLE_MULTI_TENANT=PASS
VISUAL_EVIDENCE=PASS
```
