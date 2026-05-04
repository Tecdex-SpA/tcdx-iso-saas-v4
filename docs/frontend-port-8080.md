# Frontend Next.js interno en puerto 8080

## Decisión

Next.js corre internamente en puerto 8080.

En laboratorio, el acceso externo queda por Nginx en puerto 3000:

```text
Mac/Navegador → http://192.168.100.130:3000
Nginx → http://127.0.0.1:8080
```

## Comandos

```bash
cd /home/tecdex/frontend
npm run build
PORT=8080 npm start
```

Como servicio:

```bash
sudo systemctl restart tecdex-frontend
sudo systemctl status tecdex-frontend --no-pager
```

## Variables frontend

```env
NEXT_PUBLIC_API_URL=http://192.168.100.120:3000
NEXT_PUBLIC_FRONTEND_URL=http://192.168.100.130:3000
NEXT_PUBLIC_FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
```

## QA

```bash
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:3000 EMAIL=admin@rieltec.com PASSWORD=123456 bash ./scripts/qa-ai-auditor-full.sh
```
