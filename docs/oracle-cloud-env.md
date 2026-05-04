# Variables de entorno para Oracle Cloud — TCDX ISO SaaS

## Objetivo

Preparar el sistema para moverlo a OCI sin depender de IPs del laboratorio.

## URLs productivas sugeridas

```env
NEXT_PUBLIC_API_URL=https://api.tcdx.cl
NEXT_PUBLIC_FRONTEND_URL=https://compliance.tcdx.cl
FRONTEND_URL=https://compliance.tcdx.cl
FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
CORS_ORIGIN=https://compliance.tcdx.cl
CORS_ORIGINS=https://compliance.tcdx.cl
AI_ENGINE_URL=http://<ai-engine-private-host>:8000
DATABASE_URL=postgresql://<user>:<password>@<db-private-host>:5432/tecdex_saas
```

## Patrón recomendado

```text
Usuario → HTTPS 443 → Nginx / Load Balancer → Next.js 127.0.0.1:8080
Backend API → 3000
ai-engine privado → 8000
PostgreSQL privado → 5432
```

## Seguridad

- No exponer PostgreSQL públicamente.
- No exponer ai-engine públicamente.
- Backend debe ser el único consumidor directo de ai-engine.
- Usar NSG/Security Lists de OCI.
- Mantener secretos fuera de Git.
