# Sprint 0 - Revisión KPIs, health y cumplimiento

## Tablas y vistas detectadas
- Código KPI: `backend/src/controllers/kpi.controller.js`, `backend/src/services/kpi.engine.js`.
- Vistas health/KPI: `v_iso_control_effective_health`, `v_iso_effective_kpi_summary`, variantes `*_applicable`, `v_health_dashboard_by_standard_applicable`, `v_health_dashboard_summary_applicable`.
- Tablas inferidas por código: `kpi_definitions`, `kpi_snapshots`, `kpi_snapshot_dimensions`, `kpi_standard_mappings`, `control_health_scores`.
- Aplicabilidad: `tenant_applicable_kpis`, `tenant_applicable_controls`, `tenant_applicable_evidence_requirements`.

## Endpoints existentes
- `/api/kpi` y `/api/kpis`: recalculate, dashboard, effective-health-summary, catalog, admin, custom KPI, tenant-setting, manual-value.
- `/health`: dashboard, standards, kpis, controls-risk, root-causes, remediation, evidence approval queue, controls recovered, audit-log, refresh.
- Frontend: `/dashboard`, `/health`, `/administrar-kpis`, componentes Dashboard V2.

## Relación actual
- Controles: health se apoya en `tenant_controls`, `control_health_scores`, vistas efectivas y catálogos ISO.
- Normas activas: varias vistas y endpoints filtran por `tenant_standards` y operaciones activas.
- Evidencias: evidencia pendiente/aprobada incide en health y queues.
- Acciones: remediation crea action plans y audita recuperaciones.

## Brechas para salud/cumplimiento por proceso
- Hoy el proceso/operación existe parcialmente como `tenant_standard_operations` y `operation_id`, pero no hay entidad explícita de procesos de negocio transversal.
- KPIs no parecen modelar `process_id` estable para todos los módulos.
- Evidencias, riesgos y controles necesitan trazabilidad común proceso -> operación -> control.

## Propuesta conceptual futura, sin implementar
- KPIs por proceso: catálogo KPI con `process_id`, `operation_id`, `standard_code` y `tenant_id`.
- Salud por proceso: agregación de control health por proceso y norma activa.
- Cumplimiento por proceso: porcentaje de controles aplicables cubiertos, evidencias aprobadas y brechas abiertas.
- Evidencia por proceso: evidencias enlazadas a proceso/control y fuente documental.
- Acciones vencidas por proceso: action plans abiertos por proceso, criticidad y vencimiento.
- Riesgos por proceso: matriz que cruce proceso, activo, amenaza, control y brecha.
