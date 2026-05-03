export const DEFAULT_LOCALE = 'es';
export const LOCALE_STORAGE_KEY = 'tcdx_locale';
export const LOCALE_COOKIE_KEY = 'tcdx_locale';

export type SupportedLocale = 'es' | 'en';
export type LocaleDirection = 'ltr';

export type LocaleDefinition = {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  direction: LocaleDirection;
};

export const AVAILABLE_LOCALES: LocaleDefinition[] = [
  {
    code: 'es',
    label: 'Spanish',
    nativeLabel: 'Español',
    direction: 'ltr',
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    direction: 'ltr',
  },
];

export function isSupportedLocale(value?: string | null): value is SupportedLocale {
  return value === 'es' || value === 'en';
}

export function getLocaleDirection(locale: SupportedLocale): LocaleDirection {
  return AVAILABLE_LOCALES.find((item) => item.code === locale)?.direction || 'ltr';
}
