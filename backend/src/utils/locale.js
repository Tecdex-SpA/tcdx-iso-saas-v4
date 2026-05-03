const SUPPORTED_LOCALES = ['es', 'en'];
const DEFAULT_LOCALE = 'es';

function normalizeLocale(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace('_', '-');

  if (!raw) return DEFAULT_LOCALE;

  const base = raw.split(',')[0].split(';')[0].split('-')[0];

  if (SUPPORTED_LOCALES.includes(base)) {
    return base;
  }

  return DEFAULT_LOCALE;
}

function resolveLocale(req) {
  const bodyLocale =
    req && req.body && typeof req.body === 'object'
      ? req.body.locale || req.body.language
      : null;

  const queryLocale =
    req && req.query && typeof req.query === 'object'
      ? req.query.locale || req.query.language
      : null;

  const headerLocale =
    req && req.headers
      ? req.headers['x-tcdx-locale'] ||
        req.headers['x-locale'] ||
        req.headers['accept-language']
      : null;

  return normalizeLocale(queryLocale || bodyLocale || headerLocale || DEFAULT_LOCALE);
}

function localeToIntl(locale) {
  return normalizeLocale(locale) === 'en' ? 'en-US' : 'es-CL';
}

function isEnglishLocale(locale) {
  return normalizeLocale(locale) === 'en';
}

module.exports = {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  normalizeLocale,
  resolveLocale,
  localeToIntl,
  isEnglishLocale,
};
