# Observaciones canónicas

`grc_observations` es tenant-scoped, insert-only y conserva identidad física, contrato/versión, período, valores, unidad, quality, freshness, trust, owner, evidence, correlation y snapshot. La identidad combina tenant, versión, tabla y registro origen. Igual contenido es idempotente; un cambio crea una observación nueva y supersede la anterior.

`grc_observation_relations` vincula observaciones con entidades GRC mediante relaciones allowlisted y confianza 0..1. No implementa propagación de impacto, reservada para 5-C6.
