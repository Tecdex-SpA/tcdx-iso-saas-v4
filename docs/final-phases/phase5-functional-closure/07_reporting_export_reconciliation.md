# Fase 5 - Reconciliacion Report Studio y Exportes

## Export oficial

`indicatorGovernance.service.exportCatalog` exporta filas oficiales con `metric_code`, `unit`, `period`, `state`, `value`, `coverage`, `trust`, `freshness`, `sufficiency`, `interpretation`, `snapshot_id` y `checksum`. El valor solo se emite si el snapshot esta calculado.

## Report Studio

`backend/src/routes/reports.routes.js` incorpora `reportData.official_indicators = await indicatorGovernance.listCatalog(...)`. Por tanto las cifras clasificadas como `OFFICIAL_INDICATOR` se alimentan del mismo catalogo/snapshot oficial que Dashboard, BI y export.

## Validacion

- Local: `npm run phase5-5:artifact-validation` PASS, con PDF/DOCX/XLSX y checksum.
- CI PR #61: ejecuta `phase5-5:browser-e2e`, `phase5-5:full-e2e`, `phase5-5:cross-view-consistency` y `phase5-5:artifact-validation`.

Las estadisticas operacionales que no sean indicadores oficiales pueden permanecer si se rotulan y prueban como universo distinto.
