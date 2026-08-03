# Compatibilidad legacy

Los contratos de `official_formula_source_contracts` permanecen disponibles para consumidores históricos. El bootstrap crea su representación semántica global sin borrar ni renombrar origen. `/api/data/semantic/reconciliation` compara códigos, versiones y checksums y clasifica `equivalent`, `adapted` o `missing`.

Nuevas observaciones usan exclusivamente la capa semántica. Los cálculos vigentes continúan por sus adaptadores existentes hasta 5-C3, donde se migra cada consumidor con prueba de equivalencia. No existe divergencia silenciosa: un checksum distinto se expone como adaptado.
