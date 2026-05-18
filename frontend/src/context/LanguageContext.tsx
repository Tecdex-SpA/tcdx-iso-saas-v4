'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import es from '@/i18n/dictionaries/es.json';
import en from '@/i18n/dictionaries/en.json';
import {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  getLocaleDirection,
  isSupportedLocale,
  type LocaleDefinition,
  type LocaleDirection,
  type SupportedLocale,
} from '@/i18n/locales';

type TranslationValue = string | number;
type TranslationParams = Record<string, TranslationValue>;
type Dictionary = Record<string, any>;

type LanguageContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: TranslationParams) => string;
  direction: LocaleDirection;
  availableLocales: LocaleDefinition[];
};

const dictionaries: Record<SupportedLocale, Dictionary> = { es, en };

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split('=')[1] || '') : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getBrowserLocale() {
  if (typeof navigator === 'undefined') return null;

  const language = navigator.language?.split('-')[0];
  return isSupportedLocale(language) ? language : null;
}

function resolveClientLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;

  const cookieLocale = readCookie(LOCALE_COOKIE_KEY);
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  return getBrowserLocale() || DEFAULT_LOCALE;
}

function getNestedValue(dictionary: Dictionary, key: string) {
  return key.split('.').reduce<any>((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }

    return undefined;
  }, dictionary);
}

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
    const replacement = params[paramKey];
    return replacement === undefined || replacement === null
      ? ''
      : String(replacement);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveClientLocale());

  useEffect(() => {
    const direction = getLocaleDirection(locale);

    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.body.classList.remove('locale-es', 'locale-en', 'dir-ltr');
    document.body.classList.add(`locale-${locale}`, `dir-${direction}`);
  }, [locale]);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    if (!isSupportedLocale(nextLocale)) return;

    setLocaleState(nextLocale);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }

    writeCookie(LOCALE_COOKIE_KEY, nextLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const currentDictionary = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
      const fallbackDictionary = dictionaries[DEFAULT_LOCALE];
      const value =
        getNestedValue(currentDictionary, key) ??
        getNestedValue(fallbackDictionary, key);

      if (typeof value === 'string') {
        return interpolate(value, params);
      }

      return key;
    },
    [locale]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      direction: getLocaleDirection(locale),
      availableLocales: AVAILABLE_LOCALES,
    }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
