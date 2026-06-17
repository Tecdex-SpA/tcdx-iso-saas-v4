'use strict';

const { escapeHtml, sanitizePdfText } = require('./reportTextSanitizer.helpers');

function getBaseUrl() {
  return (
    process.env.REPORT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    ''
  ).replace(/\/+$/, '');
}

function absolutizeUrl(value) {
  const raw = sanitizePdfText(value);

  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${getBaseUrl()}${raw}`;
  if (raw.startsWith('uploads/')) return `${getBaseUrl()}/${raw}`;

  return raw;
}

function resolveTcdxLogoUrl() {
  return absolutizeUrl(
    process.env.REPORT_TCDX_LOGO_URL ||
    process.env.TCDX_LOGO_URL ||
    '/uploads/logos/tcdx-logo.png'
  );
}

function resolveTenantLogoUrl(tenant = {}) {
  return absolutizeUrl(
    tenant.report_logo_url ||
    tenant.logo_url ||
    tenant.logo_path ||
    tenant.client_logo_url ||
    tenant.brand_logo_url ||
    tenant.logo ||
    tenant.logoUrl ||
    ''
  );
}

function getInitials(name = '') {
  const clean = sanitizePdfText(name || 'Cliente');
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'CL';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] || 'C'}${words[1][0] || 'L'}`.toUpperCase();
}

function renderLogoOrFallback(src, label, options = {}) {
  const resolved = absolutizeUrl(src);
  const safeLabel = sanitizePdfText(label || 'Logo');
  const initials = getInitials(safeLabel);
  const className = options.className || '';
  const role = options.role || (/tcdx/i.test(safeLabel) ? 'tcdx' : 'tenant');

  if (!resolved) {
    return `<div class="logoFallback ${className}" data-logo-role="${escapeHtml(role)}" data-logo-loaded="fallback">${escapeHtml(initials)}</div>`;
  }

  const onError = [
    "this.style.display='none';",
    "if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}",
  ].join('');

  return `
    <div class="logoImageWrap ${className}" data-logo-role="${escapeHtml(role)}">
      <img src="${escapeHtml(resolved)}" alt="${escapeHtml(safeLabel)}" data-logo-role="${escapeHtml(role)}" data-logo-source="${escapeHtml(resolved)}" onerror="${onError}" />
      <div class="logoFallback logoFallbackBehind" data-logo-loaded="fallback">${escapeHtml(initials)}</div>
    </div>
  `;
}

module.exports = {
  getBaseUrl,
  absolutizeUrl,
  resolveTcdxLogoUrl,
  resolveTenantLogoUrl,
  renderLogoOrFallback,
  getInitials,
};
