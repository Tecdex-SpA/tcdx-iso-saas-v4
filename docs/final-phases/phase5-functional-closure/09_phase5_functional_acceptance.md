# Fase 5 - Aceptacion funcional

## Cambios implementados

- `data_requirements` accionables para fallos funcionales del orquestador oficial.
- Rutas/capabilities de correccion declaradas en source contracts.
- Warning explicito cuando un resolver usa fallback legacy por fuente primaria sin filas.
- UI tecnica de formulas muestra datos requeridos para desbloquear calculo.
- Fuentes por indicador para `INCIDENTS` y `EVIDENCE-FRESH`.
- Mapping real de acciones/remediacion desde `action_plans` y ultimo `action_plan_updates` cuando existe.
- Dashboard oficial sin conversion de ausencia a cero y sin tendencia sintetica.
- Gate CI con browser E2E, evidencia full E2E, consistencia cross-view y artefactos.

## Checks ejecutados localmente

- `npm run phase5:functional-closure`: PASS.
- `npm run phase5-5:source-binding-check`: PASS.
- `npm run phase5-5:formula-registry-check`: PASS.
- `npm run phase5-c3:scripts-check`: PASS.
- `npm run phase5-5:artifact-validation`: PASS.
- `npm --prefix backend test`: PASS.
- `npm --prefix frontend run lint`: PASS.
- `npm --prefix frontend run typecheck`: PASS.
- `npm --prefix frontend test`: PASS.
- `npm --prefix frontend run build`: PASS.
- `git diff --check`: PASS.

## Runtime disposable / browser

El Mac local no es gate unico. El workflow del PR ejecuta las pruebas PostgreSQL descartables y browser E2E que requieren Docker/Chromium:

- `npm run phase5-5:browser-e2e`;
- `npm run phase5-5:full-e2e`;
- `npm run phase5-5:cross-view-consistency`;
- `npm run phase5-5:artifact-validation`.

## Criterio de aceptacion

La rama queda lista para revision de merge cuando el CI del PR termina en success sobre el nuevo SHA. No se hizo merge, deploy ni cambio en produccion.
