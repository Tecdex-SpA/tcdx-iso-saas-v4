# CODEX_UI_EXECUTION_CONTRACT — obligatorio para todo prompt UI

## Discovery gate
Antes de editar codigo, Codex debe leer y citar en su reporte:
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- todos los archivos `docs/codex/ui/*.md`
- las cinco imagenes `docs/codex/ui/references/*.png`
- el Design System TecDex en modo READ-ONLY.

Si no puede inspeccionar las PNG o el Design System, debe detener la implementacion y reportar BLOCKED_VISUAL_BASELINE_UNAVAILABLE. No debe improvisar.

## No-design-invention gate
La tarea de Codex es IMPLEMENTAR el baseline aprobado, no rediseñarlo. No puede cambiar por iniciativa propia paleta, sidebar, densidad, jerarquia, radios, sombras, tipografia, composicion, navegacion, charts o patrones.

## Visual acceptance gate
Para cada vista modificada debe producir evidencia visual (screenshot) en desktop y, cuando aplique, responsive. Debe comparar explicitamente contra la referencia correspondiente y reportar diferencias. No se acepta DONE si existe desviacion visual material no justificada.

## Gates de cierre
VISUAL_BASELINE_READ=PASS
DESIGN_SYSTEM_READ_ONLY=PASS
NO_DESIGN_INVENTION=PASS
REFERENCE_PATTERN_MATCH=PASS
SIDEBAR_GRAPHITE_NOT_BLUE=PASS
COMPONENT_REUSE=PASS
RESPONSIVE=PASS
ACCESSIBILITY=PASS
FUNCTIONAL_REGRESSION=PASS
SELLABLE_MULTI_TENANT=PASS
VISUAL_EVIDENCE=PASS
