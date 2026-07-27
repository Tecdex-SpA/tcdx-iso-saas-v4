# Fase 2 — Framework de conectores

## Ciclo

`grc_connector_instances` conserva configuración por tenant, versión, modo,
credential envelope cifrado, OAuth state hash, expiración/refresh, scopes,
cursor, scheduler, webhook, rate limit, retry y salud.

El pipeline es:

`fuente → envelope → normalización → hash/deduplicación → procedencia → mapping
→ entidad/alerta/métrica GRC → regla`.

Cada sync crea una ejecución idempotente. Los registros externos son únicos por
tenant, conector, tipo, ID externo y hash. Los errores quedan en ejecución y
dead-letter con retry manual; el scheduler toma únicamente instancias
habilitadas cuyo `next_sync_at` venció.

## Seguridad

El cifrado usa AES-256-GCM con nonce y tag por envelope. Las APIs responden solo
`credentials_configured`. OAuth exige redirect HTTPS, state de uso único y
ventana de 15 minutos; refresh sustituye el envelope cifrado. Los webhooks
requieren firma antes de normalizar.

## Modos

- `sandbox`: fixtures deterministas por adapter, sin red ni secretos, para
  pruebas contractuales completas.
- `live`: llamadas productivas, OAuth/scopes y rate limits del proveedor.

El estado live solo se considera autorizado tras completar OAuth con
credenciales del cliente. El sandbox no se etiqueta como integración live.
