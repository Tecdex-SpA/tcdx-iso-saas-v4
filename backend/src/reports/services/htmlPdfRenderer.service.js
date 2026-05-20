'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const SNAP_CHROMIUM_PATH = '/snap/bin/chromium';

const CHROME_ENV_NAMES = [
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_PATH',
  'CHROMIUM_PATH',
  'CHROME_EXECUTABLE_PATH',
];

const SYSTEM_CHROME_CANDIDATES = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

class HtmlPdfRendererError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'HtmlPdfRendererError';
    this.code = code;
    this.stage = meta.stage || (code === 'PDF_BROWSER_UNAVAILABLE' ? 'BROWSER_LAUNCH' : null);
    this.meta = meta;
  }
}

function isSnapChromiumPath(value) {
  const normalized = String(value || '').trim();
  return normalized === SNAP_CHROMIUM_PATH || normalized.startsWith('/snap/');
}

function addCandidate(checked, source, candidate) {
  const candidatePath = String(candidate || '').trim();
  if (!candidatePath) return null;

  const exists = fs.existsSync(candidatePath);
  const isSnap = isSnapChromiumPath(candidatePath);
  const item = {
    source,
    path: candidatePath,
    exists,
    skipped: isSnap,
    reason: isSnap ? 'snap_chromium_not_supported_under_systemd' : null,
  };
  checked.push(item);

  return exists && !isSnap ? item : null;
}

function resolvePuppeteerExecutablePath() {
  const checked = [];

  for (const name of CHROME_ENV_NAMES) {
    const candidate = addCandidate(checked, name, process.env[name]);
    if (candidate) return { executablePath: candidate.path, checked };
  }

  for (const candidatePath of SYSTEM_CHROME_CANDIDATES) {
    const candidate = addCandidate(checked, 'system', candidatePath);
    if (candidate) return { executablePath: candidate.path, checked };
  }

  const snapExists = fs.existsSync(SNAP_CHROMIUM_PATH);
  if (snapExists) {
    checked.push({
      source: 'snap-diagnostic',
      path: SNAP_CHROMIUM_PATH,
      exists: true,
      skipped: true,
      reason: 'snap_chromium_detected_but_not_used_under_systemd',
    });
  }

  throw new HtmlPdfRendererError(
    'PDF_BROWSER_UNAVAILABLE',
    'No hay un navegador Chromium/Chrome compatible con Puppeteer bajo systemd. Instale Chrome/Chromium no-Snap o configure PUPPETEER_EXECUTABLE_PATH.',
    { checked, snap_chromium_detected: snapExists }
  );
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureOutputDir(outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

function validatePdfOutput(outputPath, minBytes = 10 * 1024) {
  if (!fs.existsSync(outputPath)) {
    throw new HtmlPdfRendererError('PDF_EMPTY_OUTPUT', 'El motor PDF no generó archivo de salida.', { outputPath });
  }
  const fileSize = fs.statSync(outputPath).size;
  if (fileSize < minBytes) {
    throw new HtmlPdfRendererError('PDF_EMPTY_OUTPUT', 'El PDF generado está vacío o incompleto.', {
      outputPath,
      file_size: fileSize,
      min_bytes: minBytes,
    });
  }
  return fileSize;
}

async function renderHtmlToPdf({
  html,
  outputPath,
  requestId = null,
  timeoutMs = null,
  format = process.env.PDF_RENDER_FORMAT || 'A4',
  landscape = false,
  printBackground = process.env.PDF_RENDER_PRINT_BACKGROUND !== 'false',
  metadata = {},
  minBytes = 10 * 1024,
} = {}) {
  const startedAt = Date.now();
  const safeHtml = String(html || '');
  const renderTimeoutMs = toPositiveInteger(timeoutMs || process.env.PDF_RENDER_TIMEOUT_MS, 120000);

  if (!safeHtml.trim()) {
    throw new HtmlPdfRendererError('PDF_TEMPLATE_FAILED', 'El HTML del PDF está vacío.', {
      request_id: requestId,
      templateName: metadata.templateName || null,
    });
  }

  if (!outputPath) {
    throw new HtmlPdfRendererError('PDF_RENDER_FAILED', 'outputPath es requerido para renderizar PDF.');
  }

  ensureOutputDir(outputPath);
  const browserResolution = resolvePuppeteerExecutablePath();
  const skippedSnapCandidates = browserResolution.checked.filter((item) => item.skipped);
  if (skippedSnapCandidates.length) {
    console.warn('HTML PDF BROWSER WARN:', {
      request_id: requestId,
      templateName: metadata.templateName || null,
      message: 'Chromium Snap detectado y omitido para Puppeteer bajo systemd.',
      skipped: skippedSnapCandidates,
    });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: browserResolution.executablePath,
      timeout: renderTimeoutMs,
      protocolTimeout: renderTimeoutMs,
      acceptInsecureCerts: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        '--no-default-browser-check',
        '--font-render-hinting=medium',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(renderTimeoutMs);
    page.setDefaultNavigationTimeout(renderTimeoutMs);
    await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(safeHtml, { waitUntil: 'networkidle0', timeout: renderTimeoutMs });
    await page.emulateMediaType('screen');
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }
      const images = Array.from(document.images || []);
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2500);
        });
      }));
    });

    await page.pdf({
      path: outputPath,
      format,
      landscape,
      printBackground,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });

    const fileSize = validatePdfOutput(outputPath, minBytes);
    const durationMs = Date.now() - startedAt;
    console.info('HTML PDF RENDER OK:', {
      request_id: requestId,
      templateName: metadata.templateName || null,
      outputPath,
      duration_ms: durationMs,
      browser_path: browserResolution.executablePath,
      file_size: fileSize,
      render_engine: 'puppeteer',
    });

    return {
      ok: true,
      outputPath,
      file_size: fileSize,
      duration_ms: durationMs,
      browser_path: browserResolution.executablePath,
      render_engine: 'puppeteer',
    };
  } catch (error) {
    if (error instanceof HtmlPdfRendererError) throw error;
    throw new HtmlPdfRendererError('PDF_RENDER_FAILED', 'No fue posible renderizar el PDF HTML.', {
      request_id: requestId,
      templateName: metadata.templateName || null,
      outputPath,
      browser_path: browserResolution.executablePath,
      duration_ms: Date.now() - startedAt,
      cause: error.message,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function renderTemplateToPdf({
  templateName,
  data,
  outputPath,
  requestId = null,
  options = {},
} = {}) {
  if (!templateName) {
    throw new HtmlPdfRendererError('PDF_TEMPLATE_FAILED', 'templateName es requerido.');
  }
  let template;
  try {
    template = require(path.join('..', 'templates', `${templateName}.template.js`));
  } catch (error) {
    throw new HtmlPdfRendererError('PDF_TEMPLATE_FAILED', 'No fue posible cargar la plantilla PDF.', {
      templateName,
      cause: error.message,
    });
  }
  const renderFn = template.render || template.default || Object.values(template).find((value) => typeof value === 'function');
  if (typeof renderFn !== 'function') {
    throw new HtmlPdfRendererError('PDF_TEMPLATE_FAILED', 'La plantilla PDF no exporta una función render.', { templateName });
  }
  const html = renderFn(data || {});
  return renderHtmlToPdf({
    html,
    outputPath,
    requestId,
    metadata: { ...(options.metadata || {}), templateName },
    ...options,
  });
}

module.exports = {
  HtmlPdfRendererError,
  resolvePuppeteerExecutablePath,
  renderHtmlToPdf,
  renderTemplateToPdf,
};
