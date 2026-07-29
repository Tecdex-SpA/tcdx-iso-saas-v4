# Fase 5 — Seguridad y multi-tenancy

Controles implementados:

- Rutas montadas bajo `/api` después de auth global.
- `enforceApiAccess` tiene reglas explícitas para Fase 5.
- `enforceTenantRequestScope` sigue aplicando a `/api`.
- Las queries usan `tenant_id`.
- Platform admin puede operar por reglas existentes; usuarios tenant quedan acotados a su tenant.
- Descarga de reportes valida tenant, path dentro del directorio controlado y checksum.
- Fórmulas no ejecutan JavaScript ni SQL arbitrario.
- Errores sanitizados con `request_id`.
