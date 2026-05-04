# Configuración de ambiente — TCDX ISO SaaS

## Objetivo

Centralizar URLs, IPs, puertos y credenciales mediante variables de entorno para que el sistema funcione en laboratorio, demo, Oracle Cloud y producción futura.

No se deben commitear archivos `.env` reales.

## Puertos estándar

| Servicio | Puerto |
|---|---:|
| PostgreSQL | 5432 |
| Backend | 3000 |
| Nginx frontend laboratorio | 3000 |
| Next.js interno | 8080 |
| ai-engine | 8000 |

## Laboratorio actual

```text
Mac/Navegador → http://192.168.100.130:3000
Nginx VM frontend :3000 → http://127.0.0.1:8080
Next.js interno → 8080
Backend → http://192.168.100.120:3000
ai-engine → http://192.168.100.140:8000
PostgreSQL → 192.168.100.110:5432
```

## Frontend

Archivo real sugerido en VM frontend:

```bash
frontend/.env.local
```

Contenido base:

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://192.168.100.120:3000
NEXT_PUBLIC_FRONTEND_URL=http://192.168.100.130:3000
NEXT_PUBLIC_FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
```

## Backend

Archivo real sugerido en VM backend:

```bash
backend/.env
```

Contenido base sin secretos:

```env
NODE_ENV=development
PORT=3000
DB_HOST=192.168.100.110
DB_PORT=5432
DB_NAME=tecdex_saas
DB_USER=<usuario_real>
DB_PASSWORD=<password_real>
AI_ENGINE_URL=http://192.168.100.140:8000
FRONTEND_URL=http://192.168.100.130:3000
FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
CORS_ORIGIN=http://192.168.100.130:3000
CORS_ORIGINS=http://192.168.100.130:3000,http://192.168.100.130:8080
JWT_SECRET=<secreto_real>
AI_INTERNAL_TOKEN=<token_real>
```

## ai-engine

Archivo real sugerido en VM IA:

```bash
ai-engine/.env
```

Contenido base sin secretos:

```env
AI_ENGINE_HOST=0.0.0.0
AI_ENGINE_PORT=8000
BACKEND_API_URL=http://192.168.100.120:3000
DATABASE_URL=<url_real_si_aplica>
AI_INTERNAL_TOKEN=<token_real>
BRAVE_API_KEY=<key_real_si_aplica>
MODEL_PROVIDER=<proveedor>
MODEL_NAME=<modelo>
```

## Validación

```bash
bash scripts/env-check.sh
```

## Regla

Los archivos `.env.example` se pueden versionar. Los `.env` reales no.

## Seguridad básica Fase 4B

Variables backend opcionales:

```env
SECURITY_RATE_LIMIT_WINDOW_MS=60000
SECURITY_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_MAX=60
JSON_BODY_LIMIT=2mb
```

Estas variables controlan rate limiting en memoria y límite de payload JSON. No reemplazan WAF/API Gateway en producción cloud.
