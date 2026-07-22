'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  decodeJwtPayload,
  getHomePathByRole,
  getHomePathFromToken,
  isTokenExpired,
} from '@/utils/auth';
import LanguageSelector from '@/components/language/LanguageSelector';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return getUserSafeLoginError(message, fallback);
}

function getUserSafeLoginError(message: string, fallback: string) {
  if (/jwt|bearer|token|decode|payload|authorization/i.test(message)) {
    return fallback;
  }

  return message || fallback;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) return;

    if (isTokenExpired(token)) {
      localStorage.removeItem('token');
      return;
    }

    const homePath = getHomePathFromToken();
    window.location.href = homePath;
  }, []);

  const handleLogin = async () => {
    try {
      setError('');

      if (!email.trim()) {
        setError(t('login.errors.emailRequired'));
        return;
      }

      if (!password.trim()) {
        setError(t('login.errors.passwordRequired'));
        return;
      }

      setLoading(true);

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const text = await res.text();

      let data: unknown = null;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(t('login.errors.invalidBackendResponse', { status: res.status }));
      }

      const record = isRecord(data) ? data : {};
      const token = typeof record.token === 'string' ? record.token : '';

      if (!res.ok || !token) {
        setError(getUserSafeLoginError(
          String(record.error || record.message || ''),
          t('login.errors.invalidCredentials')
        ));
        return;
      }

      localStorage.setItem('token', token);

      const payload = decodeJwtPayload(token);

      const role =
        payload?.role ||
        payload?.user_role ||
        payload?.userRole ||
        '';

      const homePath = getHomePathByRole(role);

      window.location.href = homePath;
    } catch (err: unknown) {
      console.error('ERROR LOGIN:', err);
      setError(getErrorMessage(err, t('login.errors.connection')));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin();
    }
  };

  return (
    <main className="flex min-h-screen bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-primary)] [font-family:var(--tcdx-font-family-body)]">
      <section className="relative hidden min-h-screen w-[48%] overflow-hidden border-r border-[var(--tcdx-color-header-border)] bg-[linear-gradient(145deg,var(--tcdx-color-navy-deep)_0%,var(--tcdx-color-navy)_100%)] text-[var(--tcdx-color-text-on-dark)] lg:flex">
        <div className="absolute inset-x-0 top-0 h-px bg-[var(--tcdx-color-header-border)]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--tcdx-color-primary)]" />

        <div className="relative z-10 flex min-h-screen w-full flex-col justify-between px-10 py-9 xl:px-14">
          <div>
            <Image
              src="/tecdex.png"
              width={260}
              height={72}
              className="mb-9 h-16 w-auto object-contain"
              alt="TECDEX"
              priority
            />

            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[var(--tcdx-font-size-caption)] font-semibold uppercase tracking-[var(--tcdx-letter-spacing-button)] text-white/78">
              <span className="h-2 w-2 rounded-full bg-[var(--tcdx-color-secondary)]" />
              Plataforma de gestión ISO
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-[var(--tcdx-font-size-label)] font-semibold uppercase tracking-[0.08em] text-[var(--tcdx-color-warning)]">
              {t('login.heroEyebrow')}
            </p>

            <h1 className="max-w-xl text-[var(--tcdx-font-size-h1)] font-medium leading-[var(--tcdx-line-height-tight)] text-white">
              {t('login.heroTitle')}
            </h1>

            <p className="mt-5 max-w-lg text-[var(--tcdx-font-size-body)] leading-[var(--tcdx-line-height-body)] text-white/72">
              {t('login.heroSubtitle')}
            </p>

            <div className="mt-9 grid max-w-xl grid-cols-1 gap-4 text-sm text-white/82 xl:grid-cols-2">
              <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/12 bg-white/8 p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-[rgba(240,114,29,0.18)] text-[var(--tcdx-color-primary)]">
                  <TcdxIcon name="audit" className="h-5 w-5" />
                </div>
                <div className="font-semibold text-white">{t('login.heroCardAudits')}</div>
                <div className="mt-2 text-xs leading-5 text-white/58">
                  Apoyo a auditoría, hallazgos, evidencia y trazabilidad por rol.
                </div>
              </div>

              <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/12 bg-white/8 p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-[rgba(81,171,168,0.18)] text-[var(--tcdx-color-secondary)]">
                  <TcdxIcon name="evidence" className="h-5 w-5" />
                </div>
                <div className="font-semibold text-white">{t('login.heroCardEvidence')}</div>
                <div className="mt-2 text-xs leading-5 text-white/58">
                  Operación diaria conectada con KPIs, riesgos y acciones.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs text-white/62">
            {[
              ['ISO', 'Multinorma'],
              ['B2B', 'Multiempresa'],
              ['IA', 'Asistida'],
            ].map(([value, label]) => (
              <div
                key={value}
                className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/10 bg-white/7 px-3 py-3"
              >
                <div className="text-lg font-semibold text-white">{value}</div>
                <div className="mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex w-full items-center justify-center px-4 py-6 sm:p-6 lg:w-[52%]">
        <div className="w-full max-w-[430px] rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-white)] p-6 shadow-[var(--tcdx-shadow-tecdex-lg)] sm:p-8">
          <div className="mb-6">
            <LanguageSelector variant="login" />
          </div>

          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center lg:hidden">
              <Image
                src="/tecdex.png"
                width={260}
                height={72}
                className="h-16 w-auto object-contain"
                alt="TECDEX"
                priority
              />
            </div>

            <p className="mb-2 text-[var(--tcdx-font-size-label)] font-semibold uppercase tracking-[0.08em] text-[var(--tcdx-color-primary)]">
              {t('login.secureAccess')}
            </p>

            <h2 className="text-[var(--tcdx-font-size-h2)] font-normal leading-[var(--tcdx-line-height-tight)] text-[var(--tcdx-color-text-ink)] [font-family:var(--tcdx-font-family-heading)]">
              {t('login.title')}
            </h2>

            <p className="mt-3 text-[var(--tcdx-font-size-body-sm)] leading-[var(--tcdx-line-height-body)] text-[var(--tcdx-color-text-secondary)]">
              {t('login.subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(201,91,91,0.3)] bg-[rgba(201,91,91,0.08)] p-4 text-sm text-[#963f3f]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[var(--tcdx-font-size-label)] font-semibold text-[var(--tcdx-color-text-primary)]">
                {t('login.email')}
              </label>

              <input
                type="email"
                className="tcdx-focus-ring w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-white)] px-4 py-3 text-[var(--tcdx-color-text-ink)] placeholder:text-[var(--tcdx-color-text-secondary)]"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-[var(--tcdx-font-size-label)] font-semibold text-[var(--tcdx-color-text-primary)]">
                {t('login.password')}
              </label>

              <input
                type="password"
                className="tcdx-focus-ring w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-white)] px-4 py-3 text-[var(--tcdx-color-text-ink)] placeholder:text-[var(--tcdx-color-text-secondary)]"
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-primary)] px-6 py-3 text-[var(--tcdx-font-size-button)] font-semibold uppercase tracking-[var(--tcdx-letter-spacing-button)] text-white transition duration-150 ease-[var(--tcdx-motion-ease)] hover:bg-[var(--tcdx-color-primary-hover)] active:translate-y-px active:bg-[var(--tcdx-color-primary-active)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </div>

          <div className="mt-6 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">
            {t('login.routeHint')}
          </div>
        </div>
      </section>
    </main>
  );
}
