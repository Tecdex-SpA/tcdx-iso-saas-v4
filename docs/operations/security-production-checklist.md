# Checklist de seguridad productiva minima

## Objetivo

Validar los controles minimos de seguridad antes de operar TCDX ISO SaaS v4 con clientes reales o semi-reales.

Este checklist no reemplaza una auditoria de seguridad formal. Es una puerta operativa minima para evitar riesgos basicos: secretos debiles, CORS abierto, endpoints sin autenticacion, uploads sin control, logs con secretos y despliegues sin evidencia.

## Alcance

- Dominio publico: `https://tcdx-iso.tecdex.net`.
- Backend publico bajo `/api`.
- Frontend publico bajo el mismo dominio.
- Uploads expuestos por rutas controladas.
- Roles administrativos y multi-tenant.
- Integraciones y componentes IA solo desde la perspectiva de seguridad operativa.

No se deben registrar en este documento contrasenas, tokens, JWT completos, secretos, `DATABASE_URL` completa ni archivos sensibles.

## Checklist

| Control | Comando/evidencia | Estado esperado | Bloquea produccion | Responsable |
|---|---|---|---|---|
| Dominio publico | `curl -I https://tcdx-iso.tecdex.net` | Responde por HTTPS sin error de certificado. | Si | Operaciones |
| HTTPS | Evidencia de `HTTP/2 200` o respuesta valida de aplicacion. | Certificado valido y aplicacion accesible. | Si | Operaciones |
| Redirect HTTP a HTTPS | `curl -I http://tcdx-iso.tecdex.net` | `301`, `302` o `308` hacia `https://tcdx-iso.tecdex.net/`. | Si | Operaciones |
| Certificado valido | Navegador o `curl -I https://tcdx-iso.tecdex.net`. | Sin advertencias TLS. | Si | Operaciones |
| Proxy Caddy/Nginx | Headers `server`/`via` y respuesta publica. | Frontend y `/api` enrutan por dominio publico. | Si | Operaciones |
| API publica | `curl -i https://tcdx-iso.tecdex.net/api/health \| head -40` | Respuesta JSON de Express; `200` o `401` segun ruta; no `502/504`. | Si | Backend |
| JWT_SECRET productivo | En VM backend: `grep -n "JWT_SECRET" .env \| sed -E 's/(=).+$/=***MASKED***/'` | Existe, no vacio, minimo 32 caracteres, no placeholder. | Si | Operaciones |
| TOKEN_ENCRYPTION_KEY | Misma validacion enmascarada. | Existe si la funcionalidad lo usa; no imprimir valor. | Si | Backend |
| DOCUMENT_INTEGRATION_ENCRYPTION_KEY | Misma validacion enmascarada. | Existe si Google/Zoho esta habilitado; no imprimir valor. | Si | Backend |
| CORS origen permitido | OPTIONS con `Origin: https://tcdx-iso.tecdex.net`. | Devuelve `Access-Control-Allow-Origin: https://tcdx-iso.tecdex.net`. | Si | Backend |
| CORS origen no autorizado | OPTIONS con `Origin: https://evil.example`. | No autoriza ese origen; no refleja origen externo. | Si | Backend |
| Rate limiting | Revisar headers `X-RateLimit-Limit` y `X-RateLimit-Remaining` en `/api/auth/login`. | Headers presentes; login usa limite mas estricto. | Si | Backend |
| Headers HTTP basicos | `curl -I https://tcdx-iso.tecdex.net/api/auth/login` | `x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`. | Si | Backend |
| Token storage | Revision de flujo de auth vigente. | No imprimir tokens en consola, docs, logs ni screenshots compartidos. | Si | Frontend/Backend |
| Uploads | Revisar `backend/src/utils/secureUpload.js` y rutas con `multer`. | Limite de tamano, MIME/ext allowlist, nombre saneado, rutas controladas. | Si | Backend |
| Rutas publicas de uploads | Smoke test con archivo controlado o inspeccion de rutas. | No exponen paths absolutos ni archivos fuera de directorios permitidos. | Si | Backend |
| Logs sin secretos | `journalctl`/busqueda focalizada con patrones sensibles. | Sin tokens completos, passwords, secrets, `Authorization` completo ni `DATABASE_URL` completa. | Si | Operaciones |
| Admin/RBAC | Revision de `/api/admin-saas`, `auth`, `enforceApiAccess`, helpers de admin. | Rutas admin requieren autenticacion y rol/permisos de plataforma. | Si | Backend |
| Cross-tenant | Ejecutar checklist `docs/operations/cross-tenant-validation.md`. | Usuario tenant A no ve datos tenant B; reportes e IA usan tenant correcto. | Si | QA/Backend |
| Backups | Evidencia operacional externa al repo. | Backup vigente, probado o con responsable asignado antes de clientes reales. | Si | Operaciones |
| IA/logging constraints | Validar IA Compliance y logs. | No se imprimen prompts sensibles, secretos, tokens ni stack traces al usuario. | Si | Backend/IA |
| Google/Zoho | Validar variables enmascaradas y revocacion documentada. | Client secrets no aparecen en logs; integraciones revocables. | Si | Backend |
| Separacion staging/produccion | Variables, dominios y VMs documentadas. | No mezclar `.env`, datos ni credenciales demo con produccion. | Si | Operaciones |
| Evidencia de validacion | Guardar outputs sanitizados. | Evidencia sin secretos y asociada al deploy o ventana de validacion. | No | QA |
| Aprobacion responsable | Registro interno de aprobacion. | Responsable TCDX aprueba liberar tenant/ambiente. | Si | Direccion/Operaciones |

## Criterio de aprobacion

La seguridad productiva minima queda aprobada solo si:

- HTTPS y redirect estan operativos.
- API publica enruta sin `502/504`.
- CORS no usa wildcard con credenciales en produccion.
- `JWT_SECRET` productivo existe y no es placeholder.
- Rate limiting y headers basicos estan activos.
- Uploads tienen limites y allowlist.
- Logs recientes no exponen secretos reales.
- Rutas admin estan protegidas por auth y RBAC o permisos equivalentes.
- Existe evidencia sanitizada de validacion.

## Criterio de bloqueo

Bloquea produccion cualquiera de estos casos:

- `JWT_SECRET` ausente, debil, demo o placeholder.
- CORS permite `*` con credenciales o refleja origen no autorizado.
- Uploads aceptan cualquier archivo sin limite.
- Endpoint admin critico queda sin autenticacion o sin rol/permisos.
- Logs imprimen passwords, tokens completos, secretos o `DATABASE_URL` completa.
- HTTPS o `/api` publico no operan.
