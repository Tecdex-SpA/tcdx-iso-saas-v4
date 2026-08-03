# Contratos de fuente

`data_source_contracts` identifica una fuente global o tenant-scoped. `data_source_contract_versions` conserva tablas allowlisted, joins declarativos allowlisted, candidatos de tenant/timestamp, campos, equivalencias, unidades, períodos, exclusiones, fallback controlado, cobertura, freshness, vigencia y checksum.

Flujo: draft → reviewed → approved → published. Una versión publicada es inmutable; todo cambio metodológico crea otra versión. Los joins aceptan solo `inner` o `left`, tablas incluidas en el contrato y columnas con identificadores validados. No se aceptan fragmentos SQL.

El bootstrap importa idempotentemente los 17 contratos publicados del registro oficial y preserva checksum e historia. Solo platform admin administra catálogo global.
