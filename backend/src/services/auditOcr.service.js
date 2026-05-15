const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function removeDirSafe(dir) {
  if (!dir || !dir.startsWith(os.tmpdir())) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn('AUDIT OCR CLEANUP WARN:', { message: error.message });
  }
}

async function runPdfOcr(buffer, options = {}) {
  const enabled = boolEnv('AUDIT_OCR_ENABLED', false);
  const maxPages = Math.min(numberEnv('AUDIT_OCR_MAX_PAGES', 10), 25);
  const lang = process.env.AUDIT_OCR_LANG || 'spa+eng';
  const timeoutMs = Math.min(numberEnv('AUDIT_OCR_TIMEOUT_MS', 45000), 180000);
  const pdftoppmBin = process.env.PDFTOPPM_BIN || 'pdftoppm';
  const tesseractBin = process.env.TESSERACT_BIN || 'tesseract';

  const base = {
    ocr_attempted: false,
    ocr_success: false,
    ocr_pages_processed: 0,
    ocr_error: null,
    extraction_method: 'failed',
    text: '',
    warning: null,
  };

  if (!enabled) {
    return {
      ...base,
      warning: 'PDF escaneado detectado, OCR deshabilitado.',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcdx-audit-ocr-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const imagePrefix = path.join(tempDir, 'page');

  try {
    fs.writeFileSync(inputPath, buffer);
    await execFileAsync(pdftoppmBin, ['-f', '1', '-l', String(maxPages), '-png', inputPath, imagePrefix], { timeout: timeoutMs });
    const images = fs.readdirSync(tempDir)
      .filter((file) => /^page-\d+\.png$/i.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const chunks = [];
    for (const image of images) {
      const imagePath = path.join(tempDir, image);
      const { stdout } = await execFileAsync(tesseractBin, [imagePath, 'stdout', '-l', lang], { timeout: timeoutMs });
      chunks.push(String(stdout || '').trim());
    }

    const text = chunks.join('\n\n').trim();
    return {
      ...base,
      ocr_attempted: true,
      ocr_success: Boolean(text),
      ocr_pages_processed: images.length,
      extraction_method: text ? 'ocr' : 'failed',
      text,
      warning: text ? null : 'OCR ejecutado sin texto útil; requiere revisión humana.',
    };
  } catch (error) {
    return {
      ...base,
      ocr_attempted: true,
      ocr_success: false,
      ocr_error: String(error.message || error).slice(0, 500),
      warning: 'OCR no disponible o falló durante la extracción; requiere revisión humana.',
    };
  } finally {
    removeDirSafe(tempDir);
  }
}

module.exports = {
  runPdfOcr,
};
