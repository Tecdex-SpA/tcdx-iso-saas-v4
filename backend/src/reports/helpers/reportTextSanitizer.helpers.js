'use strict';

function sanitizePdfText(value, options = {}) {
  if (value === null || value === undefined) return '';

  let text = String(value);

  text = text
    .normalize('NFKC')
    .replace(/\u0000/g, '')
    .replace(/\uFFFE/g, '')
    .replace(/\uFFFF/g, '')
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\u2060/g, '')
    .replace(/â¯/g, ' ')
    .replace(/Â/g, '')
    .replace(/￾/g, '-')
    .replace(/�/g, '')
    .replace(/\s+a\.m\./gi, ' a.m.')
    .replace(/\s+p\.m\./gi, ' p.m.')
    .replace(/\s+/g, ' ')
    .trim();

  if (options.maxLength && text.length > options.maxLength) {
    text = `${text.slice(0, options.maxLength - 1).trim()}…`;
  }

  return text;
}

function escapeHtml(value) {
  return sanitizePdfText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeId(value) {
  return sanitizePdfText(value)
    .replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanFilename(value) {
  return sanitizePdfText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  sanitizePdfText,
  escapeHtml,
  sanitizeId,
  cleanFilename,
};
