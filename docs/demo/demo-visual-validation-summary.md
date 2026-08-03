# Resumen cuantitativo de cobertura visual — Demo Tecdex

Fecha: 2026-08-03
Estado global: **POSTGRES_VERIFIED_QA_PENDING**

Los conteos “base” son las anclas observadas después del seed existente. “Enriquecido” enumera las filas operativas adicionales verificadas por el gate PostgreSQL efímero; no es una suma de tablas heterogéneas. Endpoints y elementos visuales provienen del inventario de componentes reales.

| módulo | registros base | registros enriquecidos verificados | endpoints | cards/KPI | gráficos/heatmap/timeline | tablas | rutas |
|---|---|---|---:|---:|---:|---:|---:|
| Inicio | 4 dashboards / 18 widgets | 55 health + 144 puntos KPI | 8 | 3 | 4 | 1 | 1 |
| Cumplimiento y normas | 2 normas / 55 controles | 20 alcances + 55 aplicabilidades + 55 SoA + 144 snapshots | 6 | 1 | 2 | 3 | 6 |
| Controles | 55 | 55 health + 55 assurance + pruebas/evidencias relacionadas | 1 | 0 | 0 | 1 | 1 |
| Evidencias | 80 | 80 quality scores + solicitudes/versiones/revisiones/links | 1 | 0 | 0 | 1 | 1 |
| Auditorías | 5 | 15 workpapers + programas/equipos/muestras/entrevistas/follow-ups | 1 | 0 | 0 | 1 | 1 |
| Hallazgos / NC | 18 hallazgos | 12 NC + seguimiento y efectividad | 2 | 0 | 0 | 2 | 2 |
| Acciones | 24 | 72 updates + 16 recomendaciones | 2 | 0 | 0 | 3 | 3 |
| Riesgos | 24 | 24 ítems matriz + 8 simulaciones | 5 | 1 | 2 | 2 | 4 |
| Métricas | 12 definiciones / 144 mediciones | 144 legacy + 96 operacionales + quality/trust | 3 | 0 | 2 | 1 | 3 |
| GRC / Ejecutivo | readiness base | 15 workpapers + read models Phase 1/2 | 3 | 2 | 0 | 1 | 2 |
| Privacidad | cobertura parcial | 10 actividades + 6 DPIA + 12 DSR + 3 brechas | 5 | 1 | 1 | 3 | 5 |
| Incidentes | cobertura parcial | 12 incidentes + 48 eventos | 1 | 0 | 0 | 1 | 1 |
| Proveedores | cobertura parcial | 8 proveedores/evaluaciones + cuestionario versionado | 3 | 0 | 0 | 3 | 3 |
| Conectores | cobertura parcial | 4 conectores + 48 runs + 96 registros | 3 | 1 | 1 | 1 | 3 |
| Operaciones / continuidad | 10 procesos | 8 unidades + 8 servicios + 8 BIA + 8 planes + 24 pruebas | 8 | 1 | 1 | 6 | 8 |
| Datos / semántica | 6 contratos / 24 mappings / 12 observaciones / 140 lineage | 18 reglas + 216 assessments | 5 | 0 | 2 | 3 | 5 |
| Encuestas | 1 definición | 8 respuestas + 96 respuestas de ítem + evaluaciones/aprobaciones | 2 | 0 | 0 | 2 | 2 |
| Assurance | 12 ejecuciones | 60 muestras/resultados + 6 excepciones | 1 | 0 | 0 | 1 | 1 |
| Pérdidas | 6 eventos | relaciones existentes conservadas | 1 | 0 | 0 | 1 | 1 |
| BI | 4 dashboards / 18 widgets | 8 permisos role-scoped | 1 | 0 | 0 | 1 | 1 |
| Reportes | 4 definiciones / 12 generaciones | 12 templates + 4 schedules + 12 exportaciones | 3 | 0 | 1 | 2 | 3 |
| Configuración | 10 procesos | 20 alcances norma-operación | 1 | 0 | 0 | 1 | 1 |
| IA implementada | habilitada en tenant | resumen determinístico derivado de health/evidencias/hallazgos | 1 | 1 | 0 | 0 | 1 |

## Gates ejecutados

- Estático: 59 rutas, 68 componentes, 64 endpoints, 25 archivos de servicio y 95 fuentes SQL.
- PostgreSQL 16 efímero: preflight, dry-run con rollback, apply, retry desde ledger fallido, segunda ejecución idempotente y aislamiento de Tenant B.
- QA/API/browser: pendiente; requiere URLs de ambiente controlado y por diseño no admite hosts que contengan `prod` o `production`.

Hasta que se ejecute QA, ningún conteo SQL se considera evidencia de renderizado UI.
