# Mapping tipado

Cada mapping fija tenant, versión, tabla/columna allowlisted, campo canónico, prioridad, obligatoriedad, estado y auditoría. Transformaciones permitidas: `direct`, `trim`, `lowercase`, `uppercase`, `date_parse`, `timezone_normalize`, `status_map`, `severity_map`, `unit_convert`, `boolean_map`, `numeric_parse`, `enum_map` y `coalesce_controlled`.

La validación comprueba que tabla y columna existen y que todos los campos obligatorios poseen mapping. `coalesce_controlled` rechaza fallback cero salvo autorización explícita respaldada por contrato. Las versiones revisadas o publicadas no admiten edición de mappings.
