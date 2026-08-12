# QA fuentes efectivas de salud ISO

## Estado consolidado

- `/dashboard` es la entrada principal para Vista Ejecutiva, Vista KPI y Centro Control ISO.
- `/dashboard` concentra la experiencia visible KPI y Centro Control ISO.

## Rutas legacy

- No queda ruta `/dashboard-v2` en la superficie QA activa.

Los redirects desacoplados en B.3 dejan de ser contrato de QA y demo. Su
historial y retiro se controlan desde `docs/cleanup/`.

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
- Ejecutar la cuarentena fisica de redirects desacoplados en B.4.
- Revisar reportes avanzados pagina por pagina si se decide redisenar exportes premium completos.

## Pasada liviana Exportes + Ciclo de Vida

Alcance limitado por disponibilidad de Codex en el tramo actual. Se revisaron solo:

- `frontend/src/app/exportes/page.tsx`
- `frontend/src/app/ciclo-vida/page.tsx`
- `backend/src/reports/services/reportData.service.js`
- `backend/src/reports/services/reportCoverage.service.js`
- `backend/src/routes/lifecycle.routes.js`

Correcciones aplicadas:

- `/exportes` ahora comunica que los reportes ejecutivos usan salud ISO efectiva, controles activos en alcance, evidencia oficial, hallazgos, no conformidades y planes vencidos.
- `/exportes` agrega acceso directo a `/dashboard?view=iso`.
- Ciclo de vida reemplaza el promedio de health desde `control_health_scores` por `public.v_iso_control_effective_health`, filtrando por tenant, norma, operacion y alcance operacional activo.

Observaciones de auditoria rapida:

- `reportData.service.js` ya usa `public.v_iso_control_effective_health` y `public.v_iso_effective_kpi_summary` para los agregados principales de reportes.
- `reportCoverage.service.js` ya usa `public.v_iso_control_effective_health` para health de cobertura, pero mantiene `tenant_controls.status` para cobertura de implementacion. Eso no se cambio porque mide avance/cobertura operativa, no salud efectiva.
- `frontend/src/app/ciclo-vida/page.tsx` sigue mostrando `health_status` y `avg_health_score` como parte del tablero lifecycle; el backend ahora alimenta el promedio con salud efectiva, pero el microcopy visual completo queda pendiente.

No se toco por limite de Codex:

- Templates PDF premium y paginacion.
- Redisenos de `/exportes` o `/ciclo-vida`.
- Reglas PDCA, aprobacion automatica o transiciones de ciclo.
- IA Auditor.

Plan exacto para la proxima pasada:

1. Validar en runtime `/ciclo-vida` para confirmar que los scores coinciden con Centro Control ISO por tenant/norma/operacion.
2. Ajustar microcopy de tarjetas lifecycle para distinguir "avance de ciclo de vida" de "salud ISO efectiva".
3. Revisar templates `executivePremium`, `controlHealthPremium` e `internalAuditPremium` solo en las secciones que imprimen health/cumplimiento.
4. Agregar una nota visible en los PDFs indicando exclusion de controles fuera de alcance y preferencia por evidencia oficial.
5. Revisar si `reportCoverage.service.js` debe exponer dos metricas separadas: cobertura de implementacion y salud efectiva.
