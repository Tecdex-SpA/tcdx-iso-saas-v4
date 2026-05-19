# TCDX ISO SaaS - Production Readiness Checklist ESXi

Esta checklist deja el piloto SaaS en modo controlado. No reemplaza una auditoria de seguridad formal, pero fija los pasos minimos antes de exponer el ambiente a clientes piloto.

## Seguridad y credenciales

- Rotar la clave demo de `admin@rieltec.com` antes de cualquier piloto publico.
- Definir `TCDX_QA_EMAIL` y `TCDX_QA_PASSWORD` para QA; no depender de credenciales demo en scripts operativos.
- Mantener `AI_INTERNAL_TOKEN`, `JWT_SECRET`, `DB_PASSWORD`, `GOOGLE_CLIENT_SECRET` y claves privadas fuera de Git.
- Configurar `AI_ENGINE_PUBLIC_DOCS=false` en el AI Engine para ocultar `/docs`, `/redoc` y `/openapi.json` en produccion.
- Validar que el navegador nunca reciba `AI_INTERNAL_TOKEN` ni credenciales de base de datos.

## Modelos IA Auditor

Modo recomendado:

- `AI_AUDITOR_MODEL_MODE=fast`
- `OLLAMA_MODEL_FAST=qwen2.5:1.5b`
- `OLLAMA_MODEL_AUDITOR=qwen2.5:7b`
- `OLLAMA_MODEL_DEEP=qwen2.5:14b`
- `OLLAMA_MODEL_FALLBACK=qwen2.5:1.5b`
- `AI_AUDITOR_DEEP_ASYNC_REQUIRED=true`

Uso esperado:

- Fast: deterministico por defecto, sin LLM, para pantallas ejecutivas interactivas.
- Balanced: usar `qwen2.5:7b` solo bajo flujo asincrono.
- Deep: usar `qwen2.5:14b` solo bajo flujo asincrono o reportes premium.

## Jobs asincronos persistentes

Aplicar la migracion:

```bash
cd ~/repos/tcdx-iso-saas
psql "$DATABASE_URL" -f database/migrations/20260519_tcdx_async_jobs.sql
```

Si se ejecuta en la VM de base de datos con usuario postgres:

```bash
sudo -u postgres psql -d tecdex_saas -f /ruta/database/migrations/20260519_tcdx_async_jobs.sql
```

Validacion:

```sql
SELECT job_type, status, count(*)
FROM tcdx_async_jobs
GROUP BY job_type, status
ORDER BY job_type, status;
```

La tabla persiste estado de IA Auditor y reportes. Si el proceso Node se reinicia durante un job en ejecucion, el estado queda visible en base; la recuperacion automatica de workers pendientes queda como mejora operativa futura.

## PDF y reportes

- Verificar Chrome/Chromium no-Snap para Puppeteer:

```bash
ssh tcdx-backend "which google-chrome-stable || which google-chrome || which chromium || which chromium-browser || true"
ssh tcdx-backend "/usr/bin/google-chrome-stable --version || true"
```

- No usar `/snap/bin/chromium` con systemd.
- Mantener:
  - `REPORT_PUBLIC_BASE_URL=https://181.212.166.187:8443`
  - `TCDX_LOGO_URL=https://181.212.166.187:8443/uploads/logos/tcdx-logo.png`
  - `REPORT_ASYNC_INTERNAL_BASE_URL=http://127.0.0.1:3000`

## Backups

Base de datos:

```bash
ssh tcdx-db
sudo -u postgres pg_dump -Fc tecdex_saas > /tmp/tecdex_saas_$(date +%Y%m%d_%H%M).dump
```

Uploads:

```bash
ssh tcdx-backend
sudo tar -czf /tmp/tcdx_uploads_$(date +%Y%m%d_%H%M).tgz /home/tecdex/backend/uploads
```

Respaldar `.env` fuera del repositorio y en vault/almacen seguro.

## Operacion ESXi

Backend:

```bash
ssh tcdx-backend
sudo systemctl status tecdex-backend --no-pager
sudo journalctl -u tecdex-backend -n 100 --no-pager
```

AI Engine:

```bash
ssh tcdx-ai
sudo systemctl status ai-engine --no-pager
sudo systemctl status ollama --no-pager
ollama list
free -h
df -h
```

Frontend:

```bash
ssh tcdx-frontend
sudo systemctl status tcdx-frontend --no-pager
sudo systemctl status nginx --no-pager
```

## QA final

```bash
cd ~/repos/tcdx-iso-saas
./scripts/test-tcdx-system-master.sh
```

Resultado esperado:

- `Critical failures: 0`
- `WARN: 0`
- IA Auditor fast bajo 2 segundos en condiciones normales.
- Docs IA clasificados segun `AI_ENGINE_PUBLIC_DOCS_EXPECTED`.
- Referencias `192.168.100.x` solo como informacion si son selector legacy/documentacion.

## Deploy

```bash
cd ~/repos/tcdx-iso-saas
./scripts/deploy-vms.sh
```

Elegir opcion `2` para ESXi y confirmar con `s`.

## Rollback

Si el merge introduce una regresion:

```bash
cd ~/repos/tcdx-iso-saas
git checkout main
git pull origin main
git revert <merge_commit>
git push origin main
./scripts/deploy-vms.sh
```

Alternativa operativa: redeploy del commit estable anterior de `main` y restaurar DB/uploads desde backup si hubo migraciones o archivos generados que deban retrocederse.
