# Frontend Next.js interno en puerto 8080

## Decisión

Next.js corre internamente en puerto 8080.

En laboratorio, el acceso externo queda por Nginx en puerto 3000:

```text
Mac/Navegador → https://181.212.166.187:8443
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
NEXT_PUBLIC_API_URL=http://bk.tcdx.int:3000
NEXT_PUBLIC_FRONTEND_URL=https://181.212.166.187:8443
NEXT_PUBLIC_FRONTEND_INTERNAL_URL=http://127.0.0.1:8080
```

## QA

```bash
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL=admin@rieltec.com PASSWORD=123456 bash ./scripts/qa-ai-auditor-full.sh
```
