# Evidencia numérica y E2E 5-C3

Evidencia local registrada el 2026-08-07:

- `indicatorCore.test.js`: cálculo Data Trust, unknown, lineage, stale/rejected, suficiencia, cero real, null prohibido, thresholds, interpretación, checksum, comparación compatible/incompatible y propuesta idempotente: verde.
- PostgreSQL 16 efímero: catálogo 22, bindings 22, ocho dimensiones, dos writers concurrentes convergen a un snapshot lógico, failed retry, reaplicación, checksum mismatch rechazado, cero real preservado, null-to-zero rechazado, snapshot publicado inmutable y aislamiento Tenant A/B: verde.
- Browser real local: 6/6, cuatro perfiles, dos tenants, backend/Next/PostgreSQL reales, `api_interception=false`, `/metricas`, `/bi` y `/dashboard` autorizado; Tenant A=82 y Tenant B=64 coinciden en API, export, UI y snapshot; cross-tenant=404; 0 5xx, 0 hydration/RBAC inesperado y máximo un catálogo/bootstrap por carga.
- Backend completo: verde, incluidas RBAC y políticas `authenticatedRateLimit`, `publicRateLimit` y anti-bruteforce.
- Frontend: lint, typecheck, contratos y build de 84 rutas verdes.
- Regresión 5.5: 53 fórmulas, 899 aserciones, 18 contratos fuente, packages 3–6 y anti-superficial verdes.
- PostgreSQL: Fases 4, 5, 5.5, C2 y C3 verdes en PostgreSQL 16 efímero.
- Browser C2 focalizado: 1/1 verde; se conserva como regresión interceptada declarada, no como aceptación 5-C3.

No se ejecutó burst anti-bruteforce productivo. La no regresión proviene de la suite backend local y el código/policies de `public_auth_login` no fueron modificados.
