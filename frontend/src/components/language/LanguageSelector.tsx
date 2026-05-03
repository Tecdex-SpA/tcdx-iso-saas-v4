'use client';

import { useTranslation } from '@/hooks/useTranslation';
import type { SupportedLocale } from '@/i18n/locales';

type LanguageSelectorProps = {
  variant?: 'login' | 'compact';
};

export default function LanguageSelector({ variant = 'compact' }: LanguageSelectorProps) {
  const { locale, setLocale, availableLocales, t } = useTranslation();

  const isLogin = variant === 'login';

  return (
    <div
      className={[
        isLogin
          ? 'rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm'
          : 'rounded-lg border border-white/10 bg-white/7 p-1',
      ].join(' ')}
    >
      {isLogin && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t('login.language')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1">
        {availableLocales.map((item) => {
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
                    ? 'bg-[#1f6feb] text-white shadow-[0_8px_18px_rgba(31,111,235,0.22)]'
                    : 'text-slate-600 hover:bg-slate-100'
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
