# Snapshots y lineage

Se reutiliza `data_snapshots` con `snapshot_type=semantic_source`. El payload guarda versión, hash de input, conteos, quality, freshness, suficiencia y correlation; el trigger impide update/delete. El hash hace idempotente una repetición equivalente.

Cada ingesta registra `data_lineage_edges` desde `source_contract_version` a `grc_observation`; la observación referencia su snapshot. La consulta devuelve además relaciones GRC tenant-scoped.
