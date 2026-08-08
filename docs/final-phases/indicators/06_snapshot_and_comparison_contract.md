# Contrato de snapshots y comparaciones

Un snapshot captura tenant, indicador/versión, fórmula/versión, período y fecha efectiva, resultado/estado/unidad/objetivo, cobertura, Data Trust completo, freshness, suficiencia, threshold/version, interpretación, contrato semántico, mapping, política, metodología, source snapshots, lineage, run/correlation ID, actor y checksum.

La creación produce draft. Publicar requiere capability separada y bloquea cambios o borrado posteriores. La unicidad `(tenant, definición, período, checksum)` hace idempotente una misma entrada; el cálculo de checksum usa serialización canónica. La transacción evita snapshots parciales publicados.

Las comparaciones registran origen, destino, delta absoluto/relativo, cambios de estado/trust/cobertura, ventana y checksum. La dirección favorable del indicador determina improved/deteriorated. Fórmula, versión, metodología o unidad distintas producen `not_comparable` con razón; nunca se recalcula historia. Las ventanas 6/12/24 se solicitan mediante `window_periods` y conservan el mismo contrato.

## Ciclo de vida e inmutabilidad

`createSnapshot` inserta `draft` con `ON CONFLICT DO NOTHING` y devuelve el snapshot lógico preexistente para la misma entrada. `publishSnapshot` realiza la transición una sola vez. El trigger rechaza UPDATE y DELETE de registros publicados; la unicidad publicada incluye tenant, definición, período, versión de definición, versión de fórmula oficial y content hash.

Un job fallido no publica: medición, trust, interpretación y draft se escriben transaccionalmente. El checksum excluye correlation/run ID operacionales y cubre el contrato semántico, mapping, policy, versiones, fuentes, lineage y resultado; por eso el replay con la misma entrada es reproducible.

## Tipos de comparación

`previous`, `baseline`, `target` y `window` comparten payload firmado. `window_periods` acepta 1–24, por lo que 6/12/24 quedan soportados sin rutas especiales. `target` conserva objetivo sin inventar snapshot de destino. Si alguno de los estados no es calculado o cambia fórmula, metodología o unidad, se persiste `not_comparable` y su razón.
