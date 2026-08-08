# Catálogo funcional oficial 5-C3

El catálogo publicado contiene 22 conceptos estables: `GRC-HEALTH`, `ISO-READINESS`, `COMPLIANCE`, `COVERAGE`, `RISK-INHERENT`, `RISK-RESIDUAL`, `CONTROL-EFFECT`, `EVIDENCE-FRESH`, `REMEDIATION`, `FINDINGS`, `ACTIONS`, `AUDIT-ASSURANCE`, `SUPPLIER-RISK`, `CONTINUITY`, `INCIDENTS`, `LOSSES`, `DATA-TRUST`, `MATURITY`, `OP-PERFORMANCE`, `CONTROL-COVERAGE`, `SLA-COMPLIANCE` y `SUPPLIER-HEALTH`.

La fuente versionada es `functionalIndicatorCatalog.js`. Cada entrada incorpora definición de negocio, dominio, objetivo, unidad, dirección favorable, frecuencia, población, tipo, cobertura mínima, binding a una fórmula registrada, metodología, tres bandas y checksum. La migración materializa una definición global, su versión publicada inmutable, un binding único, política de cálculo y thresholds publicados. Las variantes tenant se resuelven antes que la global sin permitir selección de motor.

Los estados de publicación son draft, reviewed, published y retired. Modificar una versión publicada está prohibido por trigger; una evolución requiere nueva versión y vigencia.

## Contrato de una versión

`metric_definition_versions` conserva código funcional, nombre, definición, dominio, objetivo, unidad, dirección favorable, frecuencia, población, numerador/denominador conceptuales, metodología, contrato semántico, owner, reviewer, vigencia, estado, checksum, actor y timestamps. La definición global es reusable; una versión tenant usa el mismo código estable y prevalece solo dentro de su tenant.

Cada versión publicada debe tener exactamente un binding publicado resoluble, una política de cálculo, reglas de suficiencia, thresholds de igual unidad y una política Data Trust. El bootstrap rechaza fórmulas ausentes del registro y no admite SQL o JavaScript configurables.

## Gobierno

El flujo permitido es `draft → reviewed → published → retired`. Revisión y publicación son operaciones separadas y auditadas. La publicación de una nueva versión no altera la versión histórica ni sus snapshots. Los tres composites añadidos al registro (`F5_C3_DATA_TRUST`, `F5_C3_OPERATIONAL_PERFORMANCE`, `F5_C3_SUPPLIER_HEALTH`) exigen todos sus componentes y pesos fijos versionados; una dependencia ausente produce ausencia explícita, no renormalización.
