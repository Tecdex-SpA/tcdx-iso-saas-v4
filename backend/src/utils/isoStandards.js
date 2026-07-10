'use strict';

const CANONICAL_SOA_STANDARDS = ['ISO27001', 'ISO27701', 'ISO27017', 'ISO27018'];

const ISO_DISPLAY_NAMES = {
  ISO27001: 'ISO/IEC 27001',
  ISO27701: 'ISO/IEC 27701',
  ISO27017: 'ISO/IEC 27017',
  ISO27018: 'ISO/IEC 27018',
};

function compactIso(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeIsoCode(value) {
  const compact = compactIso(value);
  if (compact.includes('27001')) return 'ISO27001';
  if (compact.includes('27701')) return 'ISO27701';
  if (compact.includes('27017')) return 'ISO27017';
  if (compact.includes('27018')) return 'ISO27018';
  return String(value || '').trim();
}

function isoQueryAliases(value) {
  const canonical = normalizeIsoCode(value);
  const digits = canonical.replace('ISO', '');
  if (!digits) return [canonical].filter(Boolean);

  return Array.from(new Set([
    canonical,
    `ISO/IEC${digits}`,
    `ISO/IEC ${digits}`,
    `ISO ${digits}`,
    `ISO_${digits}`,
  ]));
}

function isSoAStandard(value) {
  return CANONICAL_SOA_STANDARDS.includes(normalizeIsoCode(value));
}

function displayIsoCode(value) {
  const canonical = normalizeIsoCode(value);
  return ISO_DISPLAY_NAMES[canonical] || canonical;
}

module.exports = {
  CANONICAL_SOA_STANDARDS,
  ISO_DISPLAY_NAMES,
  compactIso,
  normalizeIsoCode,
  isoQueryAliases,
  isSoAStandard,
  displayIsoCode,
};
