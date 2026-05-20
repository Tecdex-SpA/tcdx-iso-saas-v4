# PDF rendering HTML/CSS + Puppeteer

## Objetivo

Los PDF cliente premium se renderizan con HTML/CSS autonomo y `puppeteer-core`, usando Google Chrome no-Snap en la VM backend. PDFKit queda como dependencia legacy/fallback temporal, pero no debe ser el motor principal para reportes cliente premium.

## Motor oficial

- Servicio: `backend/src/reports/services/htmlPdfRenderer.service.js`
- Renderer: `puppeteer-core`
- Browser recomendado: `/usr/bin/google-chrome-stable`
- Variable principal: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`
- No usar: `/snap/bin/chromium`

Orden de resolucion del browser:

1. `PUPPETEER_EXECUTABLE_PATH`
2. `CHROME_PATH`
3. `CHROMIUM_PATH`
4. `CHROME_EXECUTABLE_PATH`
5. `/usr/bin/google-chrome-stable`
6. `/usr/bin/google-chrome`
7. `/usr/bin/chromium`
8. `/usr/bin/chromium-browser`

Si solo existe Chromium Snap, el renderer falla de forma controlada con `PDF_BROWSER_UNAVAILABLE`.

## Variables backend

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
PDF_RENDER_ENGINE=puppeteer
PDF_RENDER_TIMEOUT_MS=120000
PDF_RENDER_FORMAT=A4
PDF_RENDER_PRINT_BACKGROUND=true
PDF_RENDER_CACHE_ENABLED=true
```

## Instalacion VM backend

VM: `bk.tcdx.int`

```bash
sudo apt update
sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  fonts-dejavu \
  fonts-noto \
  fonts-noto-color-emoji \
  libnss3 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libgtk-3-0 \
  libasound2t64 \
  libx11-xcb1 \
  libxshmfence1 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libcairo2
```

Si `libasound2t64` no existe en la version de Ubuntu:

```bash
sudo apt install -y libasound2
```

Instalar Chrome no-Snap:

```bash
wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y /tmp/google-chrome.deb
google-chrome-stable --version
```

Evitar `sudo apt install chromium` salvo que se confirme que no instala Snap.

## Templates

Los templates deben ser HTML completo con CSS embebido, sin CDN ni recursos externos obligatorios. Todo contenido dinamico debe escaparse con helpers de `backend/src/reports/templates/common/`.

Reglas CSS base:

```css
@page {
  size: A4;
  margin: 14mm 12mm 16mm 12mm;
}

.section,
.card,
.kpi-card,
.table-row,
.keep-together {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

Evitar `position: fixed` excesivo, alturas rigidas peligrosas, `overflow: hidden` sobre contenido importante y columnas demasiado angostas.

## PDFs migrados

- Reportes `/api/reports/generate` y `/api/reports/generate/start`.
- Descargas `/api/reports/download/:id` de reportes generados.
- PDF historico IA Auditor `GET /api/ai-auditor/history/:id/report`.
- PDF IA Auditor actual `POST /api/ai-auditor/report`.
- Fallback PDF de preparacion documental cuando no hay conversion LibreOffice disponible.
- Ruta legacy `/api/report/:tenant_id` si llega a montarse.

No aplica:

- PDFs subidos por usuarios y servidos desde evidencias/auditorias.
- ZIP, DOCX, XLSX, PPTX.
- Procesamiento OCR/extraccion de PDFs cargados por usuarios.

## Observabilidad

Buscar en logs backend:

```bash
sudo journalctl -u tecdex-backend -n 200 --no-pager | grep -E 'HTML PDF RENDER|PDF_BROWSER|PDF_RENDER|render_engine'
```

Exito esperado:

- `HTML PDF RENDER OK`
- `render_engine=puppeteer`
- `browser_path=/usr/bin/google-chrome-stable`

No debe aparecer:

- `/snap/bin/chromium`
- `PDF_BROWSER_UNAVAILABLE`
- `REPORT_BROWSER_LAUNCH_FAILED`

## QA local

```bash
node scripts/qa/test-html-pdf-renderer.js
```

Genera archivos temporales en `/tmp`:

- `/tmp/tcdx-html-pdf-ia-auditor.pdf`
- `/tmp/tcdx-html-pdf-executive-iso-status.pdf`

Los PDFs generados por QA no deben commitearse.
