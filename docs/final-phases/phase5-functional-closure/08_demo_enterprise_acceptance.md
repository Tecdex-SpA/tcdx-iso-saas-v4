# Fase 5 - Demo Enterprise acceptance

## Principio

El tenant demo usa datos sinteticos por modelos reales. No se insertan snapshots artificiales para ocultar cadenas rotas.

## Estado

La aceptacion Demo Enterprise queda cubierta por los checks demo existentes y por el workflow CI del PR para runtime descartable. Esta rama no modifica produccion ni ejecuta migraciones remotas.

## Criterios verificados por gates

- PostgreSQL descartable en CI.
- Browser E2E Phase 5.5.
- Consistencia cross-view.
- Artefactos PDF/DOCX/XLSX con checksum.
- `source_unavailable` legitimo para FX externo.
- Estados no medidos sin conversion a cero.
- Aislamiento tenant en suites existentes.
