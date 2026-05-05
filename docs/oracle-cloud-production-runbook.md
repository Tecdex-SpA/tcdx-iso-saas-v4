# Oracle Cloud Production Runbook — TCDX ISO SaaS

## Objetivo

Preparar el despliegue productivo inicial del SaaS ISO/TCDX en Oracle Cloud con una arquitectura de 4 VMs, manteniendo separación de capas, seguridad básica, trazabilidad operativa y compatibilidad con el laboratorio actual.

Esta guía no ejecuta cambios sobre Oracle Cloud. Es una referencia de implementación, validación y cutover.

## Arquitectura objetivo

```text
Usuario Internet -> DNS compliance.tcdx.cl -> VM Frontend pública Nginx 80/443 -> Next.js 127.0.0.1:8080 -> Backend Node/Express 3000 -> PostgreSQL 5432 privado / AI Engine 8000 privado
```

## VMs recomendadas

| VM | Servicio | Exposición | Puerto |
|---|---|---:|---:|
| VM 1 | PostgreSQL | Privado | 5432 |
| VM 2 | Backend Node/Express | Privado o API HTTPS | 3000 |
| VM 3 | Frontend Next.js + Nginx | Público | 80/443 externo, 8080 interno |
| VM 4 | AI Engine FastAPI | Privado | 8000 |

## Reglas de red sugeridas

Solo la VM Frontend debe recibir tráfico público 80/443. SSH debe restringirse a IP administrativa. Backend 3000, PostgreSQL 5432 y AI Engine 8000 deben quedar privados.

## Variables por ambiente

### Frontend

```env
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_URL=https://api.tcdx.cl
NEXT_PUBLIC_FRONTEND_URL=https://compliance.tcdx.cl
NEXT_PUBLIC_FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
```

### Backend

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<db-private-host>:5432/tecdex_saas
AI_ENGINE_URL=http://<ai-engine-private-host>:8000
FRONTEND_URL=https://compliance.tcdx.cl
FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
CORS_ORIGIN=https://compliance.tcdx.cl
CORS_ORIGINS=https://compliance.tcdx.cl
JWT_SECRET=<secret-outside-git>
AI_INTERNAL_TOKEN=<secret-outside-git>
SECURITY_RATE_LIMIT_WINDOW_MS=60000
SECURITY_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_MAX=60
JSON_BODY_LIMIT=2mb
```

### AI Engine

```env
AI_ENGINE_HOST=0.0.0.0
AI_ENGINE_PORT=8000
BACKEND_API_URL=http://<backend-private-host>:3000
DATABASE_URL=postgresql://<user>:<password>@<db-private-host>:5432/tecdex_saas
AI_INTERNAL_TOKEN=<secret-outside-git>
BRAVE_API_KEY=<secret-outside-git>
MODEL_PROVIDER=<provider>
MODEL_NAME=<model>
```

## Systemd

Plantillas incluidas:

- `deploy/templates/systemd/tecdex-backend.service`
- `deploy/templates/systemd/tecdex-frontend.service`
- `deploy/templates/systemd/ai-engine.service`

Instalación ejemplo:

```bash
sudo cp deploy/templates/systemd/tecdex-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tecdex-backend
sudo systemctl restart tecdex-backend
```

## Nginx

Plantillas incluidas:

- `deploy/templates/nginx/tcdx-frontend-http.conf`
- `deploy/templates/nginx/tcdx-frontend-https.conf`
- `deploy/templates/nginx/tcdx-backend-api.conf`

Frontend productivo: Internet 443 → Nginx → `http://127.0.0.1:8080`.
Backend API público opcional: `api.tcdx.cl` 443 → Nginx → `http://127.0.0.1:3000`.

## Paquetes base

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ca-certificates build-essential
```

Frontend requiere Nginx. DB requiere PostgreSQL. AI Engine requiere Python/venv/pip.

## QA post-deploy

```bash
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin-email> PASSWORD=<admin-password> bash ./scripts/qa-security-basic.sh
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin-email> PASSWORD=<admin-password> bash ./scripts/qa-rbac-basic.sh
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin-email> PASSWORD=<admin-password> bash ./scripts/qa-ai-auditor-full.sh
```

## Rollback resumido

1. Mantener DNS apuntando al laboratorio hasta QA cloud exitoso.
2. Si el cutover falla, revertir DNS al endpoint anterior.
3. Restaurar DB desde último backup validado si hubo escritura en cloud.
4. Mantener servicios lab encendidos hasta cerrar ventana de estabilización.

## Observabilidad inicial

Antes de cutover a Oracle Cloud ejecutar:

```bash
bash scripts/qa-cloud-readiness.sh
bash scripts/qa-backup-readiness.sh
API_URL=<api-url> FRONTEND_URL=<frontend-url> AI_ENGINE_URL=<ai-engine-url> EMAIL=<admin> PASSWORD=<password> bash scripts/qa-observability.sh
```

En producción avanzada se recomienda complementar con Oracle Monitoring, métricas de Nginx, logs centralizados y alertas.


## Cierre Fase 4 y nota AI Engine 8001

El laboratorio validado mantiene AI Engine en `192.168.100.140:8001`.

Para Oracle Cloud se recomienda decidir explícitamente antes del cutover:

1. mantener `8001` y documentarlo como estándar operativo; o
2. normalizar a `8000` actualizando systemd, `.env`, backend y QA.

Esta decisión queda como riesgo residual controlado, no como bloqueo de Fase 4.
