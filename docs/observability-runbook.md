# Observability Runbook — TCDX ISO SaaS

## Objetivo

Definir una capa operativa básica de observabilidad para detectar si el SaaS ISO/TCDX está sano, degradado o caído.

Esta fase no incorpora herramientas pesadas. Usa scripts versionados, `curl`, systemd, Nginx, health checks y logs.

## Componentes monitoreados

| Componente | Validación |
|---|---|
| Frontend externo lab | `https://181.212.166.187:8443/login` |
| Next interno | `http://127.0.0.1:8080/login` desde VM frontend |
| Backend | `http://bk.tcdx.int:3000/` |
| AI Engine | `http://ai.tcdx.int:8001/health` |
| IA Auditor | `/api/ai-auditor/scope` con token |
| IA Compliance | `/api/ai-compliance/engine-health` con token |
| Nginx | `systemctl status nginx` y proxy 3000 |
| Systemd | servicios `tecdex-backend`, `tecdex-frontend`, `ai-engine` |
| Disco | `df -h` |
| Puertos | `ss -ltnp` |

## Scripts

### Monitor runtime

```bash
API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
AI_ENGINE_URL=http://ai.tcdx.int:8001 \
EMAIL="<qa-user-email>" \
PASSWORD="<qa-user-password>" \
bash scripts/monitor-runtime.sh
```

Salida:

```text
qa-results/runtime-monitor-YYYYMMDD_HHMMSS.txt
qa-results/runtime-monitor-YYYYMMDD_HHMMSS.json
qa-results/runtime-monitor-YYYYMMDD_HHMMSS.md
```

### Snapshot de logs operativos

```bash
bash scripts/collect-ops-logs.sh
```

Salida:

```text
qa-results/ops-logs-YYYYMMDD_HHMMSS.txt
```

En Mac puede producir advertencias porque no existen `systemctl` o `journalctl`. En VM recopila más información.

### QA observability

```bash
API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
AI_ENGINE_URL=http://ai.tcdx.int:8001 \
EMAIL="<qa-user-email>" \
PASSWORD="<qa-user-password>" \
bash scripts/qa-observability.sh
```

## Interpretación PASS / WARN / FAIL

| Estado | Interpretación |
|---|---|
| PASS | Validación correcta |
| WARN | Degradación o información no disponible, sin cortar operación necesariamente |
| FAIL | Debe revisarse antes de avanzar a deploy/cutover |

## AI Engine requerido u opcional

Por defecto, el monitor permite que AI Engine caído sea `WARN`:

```bash
REQUIRE_AI_ENGINE=false bash scripts/monitor-runtime.sh
```

Para exigirlo como crítico:

```bash
REQUIRE_AI_ENGINE=true bash scripts/monitor-runtime.sh
```

## PDF HTML/Puppeteer

Los reportes cliente premium usan HTML/CSS + Puppeteer desde el backend. Diagnostico rapido:

```bash
sudo journalctl -u tecdex-backend -n 200 --no-pager | grep -E 'HTML PDF RENDER|PDF_BROWSER|PDF_RENDER|render_engine'
```

Senales esperadas:

- `HTML PDF RENDER OK`
- `render_engine=puppeteer`
- `browser_path=/usr/bin/google-chrome-stable`

Alertas a revisar:

- `PDF_BROWSER_UNAVAILABLE`: Chrome/Chromium no-Snap no esta disponible o `PUPPETEER_EXECUTABLE_PATH` apunta mal.
- `PDF_RENDER_FAILED`: el template o Chromium fallo durante render.
- `PDF_EMPTY_OUTPUT`: se genero un archivo vacio o demasiado pequeno.
- `/snap/bin/chromium`: no debe usarse bajo `systemd`.

QA local del renderer:

```bash
node scripts/qa/test-html-pdf-renderer.js
```

## Comandos por VM

### Frontend

```bash
sudo systemctl status tecdex-frontend --no-pager
sudo systemctl status nginx --no-pager
curl -I http://127.0.0.1:8080/login
curl -I http://127.0.0.1:3000/login
```

### Backend

```bash
sudo systemctl status tecdex-backend --no-pager
curl -I http://127.0.0.1:3000/
```

### AI Engine

```bash
sudo systemctl status ai-engine --no-pager
curl -I http://127.0.0.1:8001/health
```

### DB

```bash
sudo systemctl status postgresql --no-pager
sudo -u postgres psql -d tecdex_saas -c "SELECT now();"
```

## Propuesta futura

Para producción avanzada:

- Prometheus Node Exporter;
- Grafana;
- Loki o journald centralizado;
- alertas por correo/Slack;
- uptime externo;
- Oracle Monitoring;
- WAF/Load Balancer metrics.

## Relación con continuidad

Ante un `FAIL`, usar:

```text
docs/continuity-operations-runbook.md
```

para diagnóstico y recuperación.


## Nota de puerto AI Engine laboratorio

El estado real validado del laboratorio es:

```text
AI Engine: http://ai.tcdx.int:8001
```

El objetivo futuro puede normalizarse a `8000`, pero no es bloqueo operativo mientras backend, IA Auditor e IA Compliance validen contra `8001`.
