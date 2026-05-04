# Configuración de ambiente — TCDX ISO SaaS

## Objetivo

Centralizar URLs, IPs, puertos y credenciales mediante variables de entorno para que el sistema funcione en laboratorio/desarrollo, demo, Oracle Cloud y producción futura.

No se deben commitear archivos `.env` reales.

## Puertos estándar

| Servicio | Puerto |
|---|---:|
| PostgreSQL | 5432 |
| Backend | 3000 |
| Frontend | 8080 |
| ai-engine | 8000 |

## Desarrollo/lab actual

### Frontend

Archivo real sugerido en VM frontend:

```bash
frontend/.env.local
```

Contenido base:

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://192.168.100.120:3000
NEXT_PUBLIC_FRONTEND_URL=http://192.168.100.130:8080
```

### Backend

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
FRONTEND_URL=http://192.168.100.130:8080
CORS_ORIGIN=http://192.168.100.130:8080
CORS_ORIGINS=http://192.168.100.130:8080
JWT_SECRET=<secreto_real>
AI_INTERNAL_TOKEN=<token_real>
```

### ai-engine

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
