# QA fuentes efectivas de salud ISO

## Estado consolidado

- `/dashboard` es la entrada principal para Vista Ejecutiva, Vista KPI y Centro Control ISO.
- `/dashboard?view=kpi` reemplaza la experiencia visible de `/dashboard-kpi`.
- `/dashboard?view=iso` reemplaza la experiencia visible de `/centro-control-iso` y `/command-center-iso`.
- `/dashboard-v2` queda como ruta legacy con redireccion segura a `/dashboard`.

## Rutas legacy

- `/dashboard-kpi` redirige a `/dashboard?view=kpi`.
- `/centro-control-iso` redirige a `/dashboard?view=iso`.
- `/command-center-iso` redirige a `/dashboard?view=iso`.
- `/dashboard-v2` redirige a `/dashboard`.

Las rutas no se eliminaron fisicamente para evitar romper enlaces guardados o integraciones existentes.

## Pantallas que ya usan salud efectiva

- Dashboard principal:
  - Vista Ejecutiva usa `effectiveHealthRows` cuando hay alcance activo.
  - Vista KPI consume KPIs y suma el pulso de salud ISO efectiva.
  - Centro Control ISO usa `active_summary` desde `/api/kpi/effective-health-summary/:tenantId`.
- Controles/workbench:
  - El backend prioriza `public.v_iso_control_effective_health`.
  - El frontend muestra `effective_health_score`, `effective_health_status` y `compliance_bucket` cuando existen.

## Endpoints y vistas preferentes

- `/api/kpi/effective-health-summary/:tenantId`
  - Fuente: `public.v_iso_effective_kpi_summary`.
  - Debe usarse para resumen por norma/operacion activa.
- `/api/controls/workbench/:tenant_id/:iso`
  - Fuente preferente: `public.v_iso_control_effective_health`.
  - Debe usarse para salud real por control.

## Reportes y exportes

Se alinearon los agregados principales de reportes para preferir:

- `public.v_iso_control_effective_health`
- `public.v_iso_effective_kpi_summary`

Funciones ajustadas:

- `getControlStats`
- `getControlHealthStats`
- `getComplianceByStandard`
- `getAuditFocusControls`
- `getControlStatusRows`
- cobertura ISO en `reportCoverage.service.js`

El objetivo fue mantener los contratos actuales de las plantillas, evitando contar controles fuera de alcance como incumplimiento activo.

## IA Auditor

IA Auditor ahora prepara contexto desde salud efectiva:

- resumen por norma desde `public.v_iso_effective_kpi_summary`;
- contexto priorizado por control desde `public.v_iso_control_effective_health`;
- campos incluidos: control, ISO, clausula, operacion, descripcion, score efectivo, estado efectivo, bucket de cumplimiento, calidad de evidencia, evidencia oficial, hallazgos, no conformidades y planes vencidos.

No se reescribieron prompts ni flujos completos de IA Auditor en esta pasada.

## Pendientes controlados

- Revisar en una pasada posterior los templates PDF para mejorar microcopy visual sobre evidencia oficial y fuera de alcance.
- Auditar modulos historicos de ciclo de vida que aun muestran `health_status`/`avg_health_score` propios del flujo de lifecycle.
- Evaluar si `/centro-control-iso` debe eliminarse fisicamente cuando no existan enlaces externos activos.
- Revisar reportes avanzados pagina por pagina si se decide redisenar exportes premium completos.
