# Fase 5 - Reconciliacion Report Studio y Exportes

## Export oficial

`indicatorGovernance.service.exportCatalog` exporta filas oficiales con:

- `metric_code`
- `unit`
- `period`
- `state`
- `value` solo si el snapshot esta calculado
- `coverage`
- `trust`
- `freshness`
- `sufficiency`
- `interpretation`
- `snapshot_id`
- `checksum`

Esto cumple la regla de no convertir ausencia en cero.

## Report Studio

Cada cifra de reporte debe clasificarse como:

- `OFFICIAL_INDICATOR`: debe venir de `metric_snapshots`.
- `OPERATIONAL_STATISTIC`: puede venir de SQL/servicio directo si no se presenta como indicador oficial.
- `LEGACY_DUPLICATE`: debe eliminarse o migrarse.

## Estado pendiente

La generacion de PDF/DOCX/XLSX y comparacion byte/contenido contra snapshot oficial no fue ejecutada en esta pasada. Debe ejecutarse antes de declarar cierre productivo estricto.
