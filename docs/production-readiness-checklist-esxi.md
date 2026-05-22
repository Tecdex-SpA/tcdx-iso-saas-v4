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
- `OLLAMA_MODEL_REPORTS=qwen2.5:7b`
- `OLLAMA_MODEL_DEEP=qwen2.5:7b`
- `OLLAMA_MODEL_FALLBACK=qwen2.5:1.5b`
- `AI_AUDITOR_DEEP_ASYNC_REQUIRED=true`

Uso esperado:

- Fast: deterministico por defecto, sin LLM, para pantallas ejecutivas interactivas.
- Balanced: usar `qwen2.5:7b` solo bajo flujo asincrono.
- Reportes cliente: usar `qwen2.5:7b` como modelo balanceado por defecto.
- Deep: usar `qwen2.5:7b` hasta disponer de GPU; reservar modelos mayores para batch controlado cuando exista capacidad dedicada.
- Timeouts recomendados para reportes deep:
  - `AI_ENGINE_REQUEST_TIMEOUT_MS=420000`
  - `AI_REPORT_ENRICHMENT_TIMEOUT_MS=420000`
  - `AI_COMPANY_PROFILE_ANALYSIS_TIMEOUT_MS=600000`
  - `OLLAMA_TIMEOUT_MS=420000`
  - `REPORT_DEEP_JOB_TIMEOUT_MS=600000`

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

Para cache de PDF historico IA Auditor, aplicar tambien:

```bash
sudo -u postgres psql -d tecdex_saas -f /ruta/database/migrations/20260520_ai_auditor_pdf_cache.sql
```

Para habilitar Perfil empresa y el documento "Contexto de la organizacion":

```bash
sudo -u postgres psql -d tecdex_saas -f /ruta/database/migrations/20260520_tenant_company_profiles.sql
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
- Configurar el motor HTML/CSS oficial:
  - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`
  - `PDF_RENDER_ENGINE=puppeteer`
  - `PDF_RENDER_TIMEOUT_MS=300000`
  - `PDF_RENDER_FORMAT=A4`
  - `PDF_RENDER_PRINT_BACKGROUND=true`
  - `PDF_RENDER_CACHE_ENABLED=true`
- Validar renderer local antes de deploy:

```bash
node scripts/qa/test-html-pdf-renderer.js
```

- Ver documentacion completa en `docs/pdf-rendering-html-puppeteer.md`.

## Perfil empresa

- Ruta frontend: `/perfil-empresa`, bajo administracion/usuarios.
- API backend:
  - `GET /api/company-profile`
  - `PUT /api/company-profile`
  - `POST /api/company-profile/analyze`
  - `POST /api/company-profile/export-context-document`
  - `GET /api/company-profile/context-document/download`
- La informacion queda aislada por `tenant_id` y se usa como contexto de calibracion para reportes, IA Auditor, controles, riesgos, evidencias y recomendaciones.
- El perfil no reemplaza evidencia interna ni puede declarar certificacion; solo mejora el criterio de priorizacion y redaccion IA.

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
