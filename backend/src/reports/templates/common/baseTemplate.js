'use strict';

const { escapeHtml } = require('./sanitize');
const { basePdfStyles } = require('./styles');

function renderBaseTemplate({ title = 'TCDX Report', body = '', extraStyles = '' } = {}) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${basePdfStyles}${extraStyles || ''}</style>
  </head>
  <body>${body}</body>
</html>`;
}

module.exports = {
  renderBaseTemplate,
};
