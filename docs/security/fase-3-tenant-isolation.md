# Fase 3 - Aislamiento tenant

## Controles

- Todas las tablas operacionales incluyen `tenant_id`.
- Listados y detalles filtran por `tenant_id`.
- Relaciones validan origen y destino en el mismo tenant antes de persistir.
- Dependencias validan ambas entidades antes de insertar o actualizar.
- Eventos, alertas, observaciones, readiness, historial y auditoría conservan tenant.
- Capability se resuelve por `tenant_module_settings`.
- La habilitación inicial apunta exclusivamente al UUID confirmado de `tcdx.local`.

## Casos post-deploy

1. Tenant A crea una unidad y Tenant B no la lista.
2. Token B consulta el ID A y recibe 404 o denegación sin revelar datos.
3. Una relación A -> entidad B es rechazada.
4. Un usuario sin permiso no muta aunque el tenant tenga capability.
5. Un tenant sin capability recibe 403 en API y no renderiza contenido autorizado.

La ejecución de estos casos queda pendiente de validación web/runtime posterior al
deploy manual.
