# Fase 1 - Cruces normativos versionados

## Marcos registrados

ISO 9001, ISO/IEC 27001, ISO/IEC 27002, ISO/IEC 42001, ISO 22301, NIST CSF, CIS Controls, Ley 21.663 y Ley 21.719.

La semilla registra únicamente identificadores, versiones, editor, clasificación y URL de referencia. No copia texto protegido.

## Modelo

`grc_frameworks`, `grc_framework_versions`, `grc_framework_requirements`, `grc_requirement_control_mappings` y `grc_mapping_reviews` preservan historia y origen. Los tipos son exact, partial, related, support, not_equivalent y pending_review.

Cada mapping registra cobertura, justificación y origen: `official_reference`, `tcdx_interpretation`, `customer_content`, `licensed_content` o `public_law`. Un control y una evidencia pueden reutilizarse sin duplicar almacenamiento.

## API y UI

- `GET /api/grc/frameworks`
- `POST /api/grc/mappings`
- `POST /api/grc/exports/frameworks`
- `POST /api/grc/exports/mappings`
- Integración visual en `/controles`.

Publicar una nueva versión no destruye versiones ni mappings históricos.
