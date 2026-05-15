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

function removeDirSafe(dir) {
  if (!dir || !dir.startsWith(os.tmpdir())) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn('AUDIT DOCX PDF CLEANUP WARN:', { message: error.message });
  }
}

async function convertDocxBufferToPdf(docxBuffer) {
  const enabled = boolEnv('AUDIT_DOCX_TO_PDF_ENABLED', false);
  const libreOfficeBin = process.env.LIBREOFFICE_BIN || '/usr/bin/libreoffice';
  const timeoutMs = Number(process.env.AUDIT_DOCX_TO_PDF_TIMEOUT_MS || 60000);
  const base = {
    pdf_conversion_attempted: false,
    pdf_conversion_success: false,
    pdf_conversion_engine: 'libreoffice',
    pdf_conversion_error: null,
    buffer: null,
  };

  if (!enabled) {
    return {
      ...base,
      pdf_conversion_error: 'Conversión DOCX a PDF deshabilitada por AUDIT_DOCX_TO_PDF_ENABLED.',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcdx-docx-pdf-'));
  const inputPath = path.join(tempDir, 'source.docx');
  const outputPath = path.join(tempDir, 'source.pdf');

  try {
    fs.writeFileSync(inputPath, docxBuffer);
    await execFileAsync(libreOfficeBin, ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, inputPath], { timeout: timeoutMs });
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('LibreOffice no generó un PDF válido.');
    }
    return {
      ...base,
      pdf_conversion_attempted: true,
      pdf_conversion_success: true,
      buffer: fs.readFileSync(outputPath),
    };
  } catch (error) {
    return {
      ...base,
      pdf_conversion_attempted: true,
      pdf_conversion_success: false,
      pdf_conversion_error: String(error.message || error).slice(0, 500),
    };
  } finally {
    removeDirSafe(tempDir);
  }
}

module.exports = {
  convertDocxBufferToPdf,
};
