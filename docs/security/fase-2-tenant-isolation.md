# Fase 2 — Aislamiento tenant y portal

## Controles

- Todas las consultas de datos de cliente incluyen `tenant_id`.
- Los IDs de URL no modifican el tenant resuelto por autenticación.
- Las relaciones transversales validan ambos extremos en el tenant.
- Los exportes vuelven a verificar tenant y permiso de dominio al generarse y
  descargarse.
- Credenciales se almacenan en envelope AES-256-GCM y nunca forman parte del
  DTO de respuesta.
- Webhooks usan HMAC SHA-256 con comparación constante, límite de tamaño e
  idempotencia.

## Portal

La invitación se entrega una sola vez y solo se persiste su hash. El intercambio
crea una sesión hash, expirable y revocable, ligada a un único
tenant/proveedor/evaluación. El DTO público solo contiene nombre del proveedor,
metadatos mínimos de evaluación, preguntas asignadas, historia limitada y
evidencia propia.

Los archivos se procesan en memoria, respetan allowlist y tamaño por invitación,
se renombran, reciben SHA-256 y se guardan bajo el tenant/evaluación. Cargas
duplicadas reutilizan el registro y eliminan el archivo temporal sobrante.

## Evidencia de prueba

La integración PostgreSQL verifica que Tenant B obtiene cero actividades,
incidentes, proveedores y registros externos de Tenant A. Los E2E prueban
denegación RBAC, consulta cross-tenant, token vencido, DTO sin campos internos,
proveedor A sin visibilidad de B y rechazo de MIME no permitido.
