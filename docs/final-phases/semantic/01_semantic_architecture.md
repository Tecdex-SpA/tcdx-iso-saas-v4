# Arquitectura semántica oficial 5-C2

La cadena autoritativa es: registro operacional → contrato lógico versionado → mapping tipado → observación canónica append-only → evaluación de quality/freshness/sufficiency → snapshot inmutable → lineage. PostgreSQL conserva estado; Express aplica tenant, RBAC, capability, entitlement y límites. Las tablas operacionales no se reemplazan ni se alteran.

Se reutilizan `data_snapshots`, `data_lineage_edges`, `official_formula_source_contracts`, `tcdx_async_jobs`, auditoría comercial, catálogo de permisos, capabilities y límites. Se crean solo las seis estructuras inexistentes que requiere 5-C2. No existe ejecución de SQL o JavaScript configurado por usuario.

Los estados funcionales son `source_ready`, `source_ready_with_warnings`, `insufficient_data`, `stale_source`, `schema_incompatible`, `source_unavailable`, `permission_denied`, `mapping_invalid`, `unit_incompatible`, `period_incompatible`, `quality_failed` y `technical_error`. La ausencia no se convierte en cero.
