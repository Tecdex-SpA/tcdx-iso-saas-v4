# Frontend en puerto 8080

## Cambio

Desde Fase 4A, el frontend Next.js debe ejecutarse en puerto 8080.

URL de laboratorio:

```text
http://192.168.100.130:8080
```

## Comandos

```bash
cd frontend
npm run build
PORT=8080 npm start
```

`frontend/package.json` usa:

```json
"start": "next start -H 0.0.0.0 -p ${PORT:-8080}"
```

## Backend / CORS

Backend debe permitir:

```env
FRONTEND_URL=http://192.168.100.130:8080
CORS_ORIGIN=http://192.168.100.130:8080
CORS_ORIGINS=http://192.168.100.130:8080
```

## QA

Ejecutar QA apuntando al puerto 8080:

```bash
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:8080 EMAIL=admin@rieltec.com PASSWORD=123456 bash ./scripts/qa-ai-auditor-full.sh
```
