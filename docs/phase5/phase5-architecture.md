# Fase 5 — Arquitectura

La Fase 5 agrega una capa gobernada de datos, métricas, encuestas, assurance, pérdidas, BI y reporting sobre PostgreSQL.

Componentes implementados:

- Migración: `database/migrations/20260729_phase5_data_metrics_bi_reporting.sql`.
- Runner: `scripts/phase5/apply-phase5-migration.js`.
- Backend: `backend/src/services/phase5/*` y `backend/src/routes/phase5.routes.js`.
- Frontend: `frontend/src/components/phase5/Phase5Workspace.tsx` y rutas `/datos`, `/metricas`, `/encuestas`, `/evaluaciones`, `/tests`, `/eventos-perdida`, `/bi`, `/reportes/studio`.
- Deploy: `scripts/deploy-vms.sh` ejecuta runners registrados por allowlist.

Reglas de diseño:

- PostgreSQL es fuente de verdad.
- APIs bajo `/api` pasan por auth, RBAC y tenant-scope global.
- Capabilities comerciales se validan con `requireCommercialCapability`.
- Fórmulas usan DSL JSON declarativo; no hay `eval`, JavaScript dinámico ni SQL arbitrario.
- Reportes generan archivos reales PDF, DOCX y XLSX con checksum y descarga autorizada.
