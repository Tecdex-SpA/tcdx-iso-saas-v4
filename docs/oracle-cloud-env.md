# Variables de entorno para Oracle Cloud — TCDX ISO SaaS

## Objetivo

Preparar el sistema para moverlo a OCI sin depender de IPs del laboratorio.

## Ejemplo de URLs productivas

```env
NEXT_PUBLIC_API_URL=https://api.tcdx.cl
NEXT_PUBLIC_FRONTEND_URL=https://compliance.tcdx.cl
FRONTEND_URL=https://compliance.tcdx.cl
CORS_ORIGIN=https://compliance.tcdx.cl
CORS_ORIGINS=https://compliance.tcdx.cl
AI_ENGINE_URL=http://<ai-engine-private-host>:8000
DATABASE_URL=postgresql://<user>:<password>@<db-private-host>:5432/tecdex_saas
```

## Recomendación de red

- Frontend público vía HTTPS.
- Backend detrás de API/proxy HTTPS.
- ai-engine privado, accesible solo desde backend.
- PostgreSQL privado, accesible solo desde backend y servicios autorizados.

## Puertos internos

- Backend: 3000
- Frontend: 8080 si se expone directamente; idealmente detrás de Nginx/HTTPS.
- ai-engine: 8000
- PostgreSQL: 5432

## Seguridad

- No exponer PostgreSQL públicamente.
- No exponer ai-engine públicamente salvo vía backend.
- Usar security lists / NSG en OCI.
- Mantener secretos fuera de Git.
