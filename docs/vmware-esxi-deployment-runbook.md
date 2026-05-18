# VMware ESXi deployment runbook

## Topology

| Component | Host/IP | Service | Port |
|---|---:|---|---:|
| PostgreSQL | `db.tcdx.int` / `192.168.2.30` | `postgresql` | `5432` |
| Backend | `bk.tcdx.int` / `192.168.2.31` | `tecdex-backend` | `3000` |
| Frontend | `www.tcdx.int` / `192.168.2.33` | `tcdx-frontend` + Nginx | `8080` internal, `8443` HTTPS |
| AI engine | `ai.tcdx.int` / `192.168.2.34` | `ai-engine`, `ollama` | `8001`, `11434` |

Public entrypoint for the current ESXi installation:

```bash
https://181.212.166.187:8443
```

The certificate is self-signed in this stage.

## Required environment

Backend `/home/tecdex/backend/.env`:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=db.tcdx.int
DB_PORT=5432
DB_USER=tecdex_user
DB_NAME=tecdex_saas
DB_PASSWORD=<secret>
JWT_SECRET=<secret>
CORS_ORIGINS=https://181.212.166.187:8443,http://www.tcdx.int:8080,http://192.168.2.33:8080
FRONTEND_URL=https://181.212.166.187:8443
FRONTEND_INTERNAL_URL=http://192.168.2.33:8080
AI_ENGINE_URL=http://ai.tcdx.int:8001
AI_INTERNAL_TOKEN=<same internal token used by ai-engine>
AI_ENGINE_TIMEOUT_MS=120000
AI_AUDITOR_ENGINE_TIMEOUT_MS=25000
```

Frontend `/home/tecdex/frontend/.env`:

```bash
PORT=8080
# Recommended behind Nginx: use relative /api, /uploads paths.
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_BACKEND_URL=
```

AI engine `/home/tecdex/ai-engine/.env`:

```bash
APP_PORT=8001
BACKEND_API_URL=http://bk.tcdx.int:3000
FRONTEND_URL=https://181.212.166.187:8443
DB_HOST=db.tcdx.int
DB_PORT=5432
DB_USER=tecdex_user
DB_NAME=tecdex_saas
DB_PASSWORD=<secret>
AI_INTERNAL_TOKEN=<same token used by backend>
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
AI_ENGINE_LLM_TIMEOUT_MS=90000
```

UTM compatibility remains available by setting the same variables to explicit legacy lab values. Do not rely on legacy defaults in production.

## Nginx frontend proxy

Expected routing on the frontend VM:

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
}

location /api/ {
  proxy_pass http://bk.tcdx.int:3000/api/;
}

location /uploads/ {
  proxy_pass http://bk.tcdx.int:3000/uploads/;
}

location /ai-engine/ {
  proxy_pass http://ai.tcdx.int:8001/;
}
```

Keep `/health` as the visual page in the frontend. Backend health APIs should be reached under `/api/health/...`; authenticated endpoints such as `/api/health/dashboard` should return JSON `401` without a token, not HTML.

## Deployment commands

Backend VM:

```bash
cd /home/tecdex/backend
git pull
npm install
npm run check
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

Frontend VM:

```bash
cd /home/tecdex/frontend
git pull
npm install
npm run build
sudo systemctl restart tcdx-frontend
sudo systemctl status tcdx-frontend --no-pager
```

AI VM:

```bash
cd /home/tecdex/ai-engine
git pull
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile app/routes/senior_auditor_v2.py main.py
sudo systemctl restart ai-engine
sudo systemctl status ai-engine --no-pager
sudo systemctl status ollama --no-pager
ollama list
```

## Runtime validation

```bash
curl -k -I https://181.212.166.187:8443/
curl -k -i https://181.212.166.187:8443/api/health
curl -k -i https://181.212.166.187:8443/api/health/dashboard
curl -s http://ai.tcdx.int:8001/health || curl -s http://ai.tcdx.int:8001/docs
```

The dashboard health API should return JSON. If Nginx returns HTML for `/api/...`, check the proxy location order before debugging the application.
