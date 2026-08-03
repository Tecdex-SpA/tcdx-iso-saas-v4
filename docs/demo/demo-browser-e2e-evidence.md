# Evidencia E2E del tenant Demo Tecdex

Estado: **QA_PENDING**
Fecha del último intento: 2026-08-03

La especificación autenticada y el generador de este documento están implementados, pero no se declara evidencia visual sin ejecutar contra un ambiente QA/desplegado controlado. Producción está explícitamente bloqueada por los scripts.

| ruta | usuario | endpoint | conteo esperado | conteo observado | screenshot | resultado | observaciones |
|---|---|---|---:|---:|---|---|---|
| Todas las rutas de `scripts/demo/demo-visual-routes.json` | admin.demo@tcdx.demo | endpoints trazados en la matriz | según contrato | — | — | QA_PENDING | Requiere `DEMO_WEB_BASE_URL` y `DEMO_API_BASE_URL` de QA. |
| Todas las rutas de `scripts/demo/demo-visual-routes.json` | auditor.demo@tcdx.demo | endpoints trazados en la matriz | según contrato | — | — | QA_PENDING | Requiere `DEMO_WEB_BASE_URL` y `DEMO_API_BASE_URL` de QA. |

Al ejecutar `npm run demo:visual:browser-e2e`, este archivo se regenera desde el reporte JSON de Playwright con una fila por ruta y usuario.
