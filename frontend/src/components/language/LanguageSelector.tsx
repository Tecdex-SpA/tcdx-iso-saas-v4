'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { SupportedLocale } from '@/i18n/locales';

type LanguageSelectorProps = {
  variant?: 'login' | 'compact';
};

export default function LanguageSelector({ variant = 'compact' }: LanguageSelectorProps) {
  const { locale, setLocale, availableLocales, t } = useTranslation();

  const isLogin = variant === 'login';
  const visibleLocales = isLogin
    ? availableLocales.filter((item) => item.code === 'es')
    : availableLocales;

  useEffect(() => {
    if (isLogin && locale !== 'es') {
      setLocale('es' as SupportedLocale);
    }
  }, [isLogin, locale, setLocale]);

  return (
    <div
      className={[
        isLogin
          ? 'rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-3 shadow-[var(--tcdx-shadow-tecdex-sm)]'
          : 'rounded-lg border border-white/10 bg-white/7 p-1',
      ].join(' ')}
    >
      {isLogin && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--tcdx-color-text-secondary)]">
          {t('login.language')}
        </div>
      )}

      <div className={isLogin ? 'grid grid-cols-1 gap-1' : 'grid grid-cols-2 gap-1'}>
        {/*
          Login temporalmente solo en espanol.
          Para reactivar ingles en login, volver a usar:
          availableLocales.map(...)
          y restaurar grid-cols-2 arriba.
        */}
        {visibleLocales.map((item) => {
          const selected = locale === item.code;

          return (
            <button
              key={item.code}
              type="button"
              onClick={() => setLocale(item.code as SupportedLocale)}
              aria-pressed={selected}
              className={[
                'rounded-md px-3 py-2 text-sm font-semibold transition',
                isLogin
                  ? selected
                    ? 'bg-[var(--tcdx-color-secondary)] text-white'
                    : 'text-[var(--tcdx-color-text-secondary)] hover:bg-[var(--tcdx-color-surface-alt)]'
                  : selected
                  ? 'bg-white text-[#06173a]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {item.nativeLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
