type TranslationFn = (key: string, params?: Record<string, string | number>) => string;

type ErrorPayload = {
  error_code?: string;
  code?: string;
  message?: string;
  error?: string;
  details?: unknown;
} | null | undefined;

function isTranslationKey(value: string) {
  return value.includes('.') && !value.includes(' ');
}

export function getTranslatedErrorMessage(payload: ErrorPayload, t: TranslationFn) {
  const code = String(payload?.error_code || payload?.code || '').trim();

  if (code) {
    const key = `common.errors.${code}`;
    const translated = t(key);

    if (translated && translated !== key && !isTranslationKey(translated)) {
      return translated;
    }
  }

  if (payload?.message) return String(payload.message);
  if (payload?.error) return String(payload.error);

  const fallback = t('common.errors.GENERIC');
  return fallback === 'common.errors.GENERIC'
    ? 'Error procesando solicitud'
    : fallback;
}

export function getErrorCode(payload: ErrorPayload) {
  return String(payload?.error_code || payload?.code || '').trim() || null;
}
