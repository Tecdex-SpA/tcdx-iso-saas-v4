# Contrato API 5-C2

Prefijo: `/api/data/semantic`. Recursos: contratos, versiones, mappings, preview/assessment, ingesta, observaciones, relaciones, lineage, quality/freshness, reglas de suficiencia, reconciliación y jobs.

Las respuestas exitosas usan `{ ok, data, request_id }`. Los errores incluyen código funcional y request id; no exponen SQL, stack ni secretos. Listados tienen límite máximo. Borradores se editan con PATCH; review, approval y publication son transiciones explícitas. La ingesta exige versión publicada y suficiencia válida.
