# Metodología Data Trust

La evaluación usa ocho dimensiones: completeness, accuracy, consistency, freshness, lineage, validation, stability y coverage. Cada dimensión registra score nulo o 0–100, evidencia, regla, numerador, denominador, warnings, timestamp, versión y checksum.

La política publicada v1 usa pesos que suman 1: 0,15; 0,15; 0,10; 0,15; 0,15; 0,10; 0,10; 0,10. El score compuesto pondera solo dimensiones conocidas y declara su peso conocido. `unknown` permanece nulo. Falta de dimensiones críticas limita la confianza, lineage ausente impide 100, freshness stale limita el score y una validación rechazada impide estado trusted. Los estados son trusted, acceptable, attention, untrusted y unknown.

Freshness se deriva de la fecha efectiva, frecuencia y zona horaria; nunca de `created_at` cuando existe fecha de negocio. Suficiencia usa inputs, muestra, población y cobertura de la regla publicada. La evaluación completa se persiste y su checksum queda incluido en el snapshot reproducible.

## Evidencia y clasificación

Cada dimensión incluye `rule`, `evidence`, numerador, denominador, población/muestra, warnings, versión y checksum. Un denominador ausente conserva score nulo. El compuesto se clasifica `trusted`, `acceptable`, `attention`, `untrusted` o `unknown`; el peso conocido se expone para evitar una falsa precisión.

Las salvaguardas son contractuales: lineage ausente impide 100; freshness stale reduce el máximo; validation rejected nunca es trusted; una dimensión crítica desconocida impide confianza alta. La misma evidencia y política producen el mismo checksum porque timestamps de ejecución no forman parte del material determinista.

## Freshness y suficiencia

Freshness usa fecha efectiva, fin de período, frecuencia, SLA, timezone y última evidencia válida, con estados `fresh`, `aging`, `stale`, `unknown`. Suficiencia usa estados `sufficient`, `partial`, `insufficient`, `source_unavailable`, `mapping_required`, `invalid`. Ninguno de estos estados se convierte en valor numérico.
