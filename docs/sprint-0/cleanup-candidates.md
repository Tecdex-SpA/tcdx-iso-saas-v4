# Sprint 0 - Candidatos de limpieza sin borrar

| Candidato | Evidencia | Riesgo | Acción recomendada |
|---|---|---|---|
| ZIP histórico | `docs/inventory-tcdx-20260526_1353.zip` | Bajo | Mover fuera del repo o dejar como release artifact tras validar. |
| Artefactos QA | `qa-results/**` (2146 archivos) | Medio | Conservar últimos reportes relevantes y limpiar históricos. |
| Tokens QA | `qa-results/**/token.txt` (30 archivos) | Alto | Revisar contenido sin exponer; rotar si son reales; purgar del historial si aplica. |
| Ruta duplicada evidencias | `backend/src/routes/2evidences.routes.js` | Medio | Confirmar no montada; eliminar solo con pruebas y aprobación. |
| Ruta report legacy | `backend/src/routes/report.routes.js` | Medio | Confirmar no montada; consolidar con `reports.routes.js`. |
| Dashboards múltiples | `/dashboard`, `/dashboard-v2`, `/dashboard-kpi` | Medio | Definir una entrada MVP y ocultar variantes. |
| Command centers | `/centro-control-iso`, `/command-center-iso`, `/ejecucion-iso` | Medio | Agrupar funcionalmente bajo Cumplimiento/Acciones. |
| IA duplicada | `/ia`, `/ia-compliance`, `/ia-auditor`, `/auditorias/ia` | Medio | Separar IA Compliance MVP de IA Auditor enterprise. |
| SQL QA fixes | `database/qa-fixes/**` | Alto | No borrar ni ejecutar sin DBA; mover a runbooks si se decide. |
| Scripts QA numerosos | `scripts/test-*`, `scripts/validate-*`, `scripts/qa-*` | Bajo/Medio | Mantener, pero documentar cuáles son CI, producción o manuales. |
| Imports/componentes no usados | Requiere análisis TS/ESLint | Medio | Ejecutar lint/build y herramienta de dead-code antes de limpiar. |

No se eliminó ningún archivo en Sprint 0.
