# Fase 4B — Hardening básico de seguridad SaaS

## Objetivo

Fortalecer la seguridad base del backend TCDX ISO SaaS antes de pilotos y despliegue cloud, sin tocar base de datos ni modificar datos de cliente.

## Alcance aplicado

- CORS controlado por variables de entorno y fallbacks de laboratorio.
- Headers HTTP básicos sin CSP estricta.
- `x-request-id` por respuesta.
- Límites de payload JSON configurables.
- Rate limiting básico en memoria.
- QA de seguridad repetible.
- Documentación de variables.

## CORS

Origenes permitidos:

```env
CORS_ORIGIN=https://181.212.166.187:8443
CORS_ORIGINS=https://181.212.166.187:8443,http://www.tcdx.int:8080
FRONTEND_URL=https://181.212.166.187:8443
FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
```

El backend mantiene compatibilidad con `curl` y llamadas server-to-server sin header `Origin`.

## Headers de seguridad

Se agregan headers básicos:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `X-XSS-Protection: 0`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

No se agrega CSP estricta en esta fase para evitar romper Next.js o assets existentes.

## Payload limits

Variable:

```env
JSON_BODY_LIMIT=2mb
```

No afecta `multipart/form-data` usado por evidencias. Los uploads siguen usando `multer`.

## Rate limiting

Variables:

```env
SECURITY_RATE_LIMIT_WINDOW_MS=60000
SECURITY_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_MAX=60
```

El rate limit es en memoria y apto para laboratorio / single instance. Para producción multi-instancia se recomienda mover la protección a WAF, API Gateway, Nginx rate limiting o Redis.

## Endpoints revisados

- `/api/auth/login`
- `/api/ai-auditor/*`
- `/api/ai-compliance/*`
- `/api/reports/*`
- `/api/evidences/*`
- `/api/admin-saas/*`
- `/api/tenants/*`
- `/api/users/*`
- `/api/findings/*`
- `/api/action-plans/*`
- `/api/nonconformities/*`

## QA

Ejecutar:

```bash
API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
EMAIL="<qa-user-email>" \
PASSWORD="<qa-user-password>" \
bash ./scripts/qa-security-basic.sh
```

El script valida login, endpoints protegidos, CORS, headers, IA Auditor no destructivo y frontend por Nginx 3000.

## Limitaciones

- No implementa RBAC fino nuevo.
- No cambia permisos existentes.
- No agrega dependencias externas.
- No usa Redis para rate limit.
- No modifica DB.
- No crea migraciones.

## Pendiente Fase 4C

- Permisos finos por rol.
- Matriz de permisos por módulo.
- Validación granular por tenant/rol.
- Gobierno SaaS por plan/tenant.
