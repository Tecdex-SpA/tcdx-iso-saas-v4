# Fase 5 - Demo Enterprise acceptance

## Principio

El tenant demo debe usar datos sinteticos por modelos reales. No se insertan snapshots artificiales para cerrar Fase 5.

## Cobertura requerida

Debe demostrar:

- datos suficientes para una parte significativa de los 22 indicadores;
- estados legitimos `source_unavailable`, `insufficient`, `stale`, `zero real` y `not_comparable`;
- cambios de dato que alteren mediciones;
- igualdad API, UI, snapshot y export;
- aislamiento tenant.

## Estado en esta ejecucion

No se ejecutaron migraciones demo ni Playwright de demo enterprise desde esta rama. La aceptacion funcional queda condicionada a los checks demo existentes y a la suite numerica de Fase 5.
