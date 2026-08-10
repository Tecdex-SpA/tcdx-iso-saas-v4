# Fase 5 - Aceptacion funcional

## Cambios implementados en esta ejecucion

- Documentacion previa de comprension e inventario.
- `data_requirements` accionables para fallos funcionales del orquestador oficial.
- Rutas/capabilities de correccion declaradas en source contracts.
- Warning explicito cuando un resolver usa fallback legacy por fuente primaria sin filas.
- UI tecnica de formulas muestra datos requeridos para desbloquear calculo.

## Checks focales ejecutados

- `node backend/src/services/math-governance/officialCalculationOrchestrator.test.js`
- `node backend/src/services/math-governance/sourceResolver.test.js`
- `node --check` sobre source contracts, source resolver y orchestrator.
- `npm --prefix frontend run lint`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- `npm --prefix backend test`
- `npm run phase5-5:check`
- `npm run phase5-c2:contracts-check`
- `npm run phase5-c2:security-check`
- `npm run phase5-c2:unit`
- `npm run phase5-c3:contracts-check`
- `npm run phase5-c3:security-check`
- `npm run phase5-c3:scripts-check`
- `npm run phase5:contracts:check`
- `npm run phase5:security-check`
- `npm run phase5:migration:checksum`
- `git diff --check`

## Checks bloqueados por infraestructura local

Los siguientes checks fallaron al iniciar PostgreSQL efimero porque Docker daemon no esta disponible en la maquina local:

- `npm run phase5-c2:check` en `phase5-c2:postgres`
- `npm run phase5-c3:check` en `phase5-c3:postgres`
- `npm run phase5:check` en `phase5:postgres-integration`

Error comun:

```text
failed to connect to the docker API at unix:///Users/andresbarouh/.docker/run/docker.sock
```

## Criterios pendientes para cierre estricto

- suite numerica completa de los 22 indicadores;
- pruebas de cambio de dato para varios indicadores;
- report/export artefactos reales;
- browser E2E sobre Dashboard/BI/Metricas/Reportes;
- PostgreSQL integration completa de Fase 5/C2/C3 posterior a estos cambios cuando Docker este disponible;
- browser E2E numerico completo.
