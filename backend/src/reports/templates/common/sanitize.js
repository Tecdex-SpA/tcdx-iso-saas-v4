'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'object') {
    return cleanText(value.title || value.name || value.label || value.description || value.summary, fallback);
  }
  return String(value).replace(/\s+/g, ' ').trim() || fallback;
}

function truncateText(value, maxChars = 240, fallback = '-') {
  const text = cleanText(value, fallback);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

module.exports = {
  escapeHtml,
  cleanText,
  truncateText,
};
