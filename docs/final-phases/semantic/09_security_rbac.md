# Seguridad y RBAC

Contrato de autorización: autenticación + tenant efectivo + permiso semántico + capability `data.semantic_layer` + entitlement `data_governance_core` + límite backend + vigencia.

Permisos separados cubren lectura, administración, revisión, publicación, mappings, validación, observaciones, ingesta, lineage y suficiencia. Administradores gestionan; auditoría y roles operacionales autorizados leen. Catálogo global exige platform admin. Identificadores físicos pasan allowlist; no se aceptan SQL, JS, secretos o adapter keys arbitrarios desde negocio.

Límites: contratos activos, mappings activos y observaciones mensuales. Los errores se sanitizan y registran con request/correlation/tenant sin payload sensible.
