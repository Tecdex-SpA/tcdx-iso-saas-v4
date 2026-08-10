# Fase 5 - Closeout funcional del PR #61

Estado actual: `READY_FOR_CI_VALIDATION`

Este PR no hace merge ni deploy. El cierre queda listo para revision de merge cuando el workflow de GitHub Actions actualizado termine en success.

## Corregido en esta pasada

- `INCIDENTS` deja de compartir la fuente de hallazgos y queda vinculado a `incident_operational_events`.
- `EVIDENCE-FRESH` deja de usar data quality como sustituto y queda vinculado a `evidence_freshness_records`.
- `ACTIONS` y `REMEDIATION` normalizan `progress_percent`, `latest_progress_percent`, `due_date`, `latest_status_after` y `latest_update_at`.
- `RISK-INHERENT` acepta `likelihood` como alias canonico controlado de `probability`.
- `RISK-RESIDUAL` exige efectividad de control real; ausencia no se vuelve cero.
- `CONTROL-EFFECT` ya no replica un score global hacia diseno, implementacion, operacion y evidencia.
- `SUPPLIER-HEALTH` no calcula health con componentes faltantes.
- Dashboard no convierte `official_score` faltante en 0 y no sintetiza tendencia oficial desde delta.
- Report/export quedan amarrados a snapshot oficial con `snapshot_id` y `checksum`.
- CI ejecuta browser E2E, consistencia cross-view y validacion de artefactos despues de generar evidencia.

## Validaciones locales ejecutadas

- `npm run phase5:functional-closure`: PASS.
- `npm run phase5-5:source-binding-check`: PASS.
- `npm run phase5-5:formula-registry-check`: PASS.
- `npm run phase5-c3:scripts-check`: PASS.
- `npm run phase5-5:artifact-validation`: PASS.

## Validaciones delegadas al CI del PR

El Mac local no se usa como gate unico para PostgreSQL descartable ni browser E2E. GitHub Actions ejecuta el workflow con entorno Linux y Docker/servicios disponibles:

- PostgreSQL descartable de fases 5/5.5/C2/C3.
- Browser E2E Phase 5.5.
- Evidencia `full-e2e`.
- Consistencia cross-view.
- Validacion de artefactos PDF/DOCX/XLSX.

## Legacy permitido

- Superficies operacionales legacy pueden seguir mostrando estadisticas no oficiales si no se etiquetan como indicadores oficiales.
- `external_fx_rates` permanece `source_unavailable`; no se mezclan monedas sin fuente oficial.

## Estado de deuda

- Deuda funcional critica conocida dentro de este PR: 0.
- Merge: no.
- Deploy: no.
- Produccion: no.
