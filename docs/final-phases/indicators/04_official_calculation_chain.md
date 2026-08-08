# Cadena oficial de cálculo

La cadena única es: catálogo funcional → binding publicado → contrato semántico 5-C2 → mapping → observaciones/snapshot de fuente → suficiencia/freshness → `officialCalculationOrchestrator` → Data Trust → medición oficial → interpretación → snapshot draft → publicación → comparación/API/consumers.

`indicatorGovernance.service.js` nunca evalúa fórmulas configurables: invoca el orquestador matemático existente con el único `formula_code` del binding. El endpoint legacy `/api/metrics/:id/calculate` también resuelve ahora el código funcional y delega en esta cadena; `formulaEngine` queda como compatibilidad de validación histórica, no como fuente de resultados oficiales.

Solo `calculated` conserva valor numérico, incluido cero real. Los demás estados (`unmeasured`, `source_unavailable`, `mapping_required`, `insufficient_data`, `insufficient_coverage`, `stale_source`, `dependency_pending`, `source_incompatible`, `validation_failed`, `technical_error`) conservan valor nulo y explicación. El frontend únicamente formatea el valor recibido.

## Resolución autoritativa

1. La sesión fija `tenant_id` y actor.
2. `resolveIndicator` selecciona versión tenant publicada o, en su ausencia, global publicada.
3. El binding fija fórmula, versión, contrato semántico, mapping, unidad y metodología.
4. El orquestador resuelve observaciones canónicas y source snapshots con la capa 5-C2.
5. Suficiencia y freshness pueden impedir el cálculo antes de invocar la fórmula.
6. La salida del registro matemático genera medición, evaluación Data Trust e interpretación.
7. El snapshot conserva todas las versiones y hashes necesarios para replay.

No existe selector entre motor legacy y oficial. Los builders técnicos administran conceptos y fuentes; toda ruta que declara un resultado funcional termina en `indicatorGovernance.service.js` y `officialCalculationOrchestrator.service.js`.
