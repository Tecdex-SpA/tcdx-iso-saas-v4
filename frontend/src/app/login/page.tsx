'use client';

import { useEffect, useState } from 'react';
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

      let data: any = null;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(t('login.errors.invalidBackendResponse', { status: res.status }));
      }

      if (!res.ok || !data.token) {
        setError(data.error || data.message || t('login.errors.invalidCredentials'));
        return;
      }

      localStorage.setItem('token', data.token);

      const payload = decodeJwtPayload(data.token);

      const role =
        payload?.role ||
        payload?.user_role ||
        payload?.userRole ||
        '';

      const homePath = getHomePathByRole(role);

      window.location.href = homePath;
    } catch (err: any) {
      console.error('ERROR LOGIN:', err);
      setError(err.message || t('login.errors.connection'));
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
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_48%,#eef3f8_100%)]">
      <div className="relative hidden w-[46%] overflow-hidden bg-[linear-gradient(180deg,#06173a_0%,#061f49_52%,#041126_100%)] text-white shadow-[18px_0_42px_rgba(8,25,58,0.2)] md:flex">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-[linear-gradient(180deg,transparent_0%,rgba(16,185,129,0.08)_100%)]" />
        <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-10">
        <div>
          <img src="/logo.png" className="mb-10 w-56" alt="TCDX Compliance" />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/80">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
            Plataforma SaaS B2B ISO
          </div>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100/80">
            {t('login.heroEyebrow')}
          </p>

          <h1 className="max-w-xl text-4xl font-bold leading-tight">
            {t('login.heroTitle')}
          </h1>

          <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
            {t('login.heroSubtitle')}
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-1 gap-3 text-sm text-white/82 xl:grid-cols-2">
            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-emerald-100">
                <TcdxIcon name="audit" className="h-5 w-5" />
              </div>
              <div className="font-semibold text-white">{t('login.heroCardAudits')}</div>
              <div className="mt-2 text-xs leading-5 text-white/58">
                Preparación auditora, hallazgos, evidencia y trazabilidad por rol.
              </div>
            </div>

            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-blue-100">
                <TcdxIcon name="evidence" className="h-5 w-5" />
              </div>
              <div className="font-semibold text-white">{t('login.heroCardEvidence')}</div>
              <div className="mt-2 text-xs leading-5 text-white/58">
                Operación diaria conectada con KPIs, riesgos y acciones.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs text-white/60">
          <div className="rounded-lg border border-white/10 bg-white/7 px-3 py-3">
            <div className="text-lg font-bold text-white">ISO</div>
            <div className="mt-1">Multinorma</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/7 px-3 py-3">
            <div className="text-lg font-bold text-white">JWT</div>
            <div className="mt-1">Multiempresa</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/7 px-3 py-3">
            <div className="text-lg font-bold text-white">IA</div>
            <div className="mt-1">Auditora</div>
          </div>
        </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-6 sm:p-6 md:w-[54%]">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white/95 p-6 shadow-[0_24px_70px_rgba(8,25,58,0.12)] backdrop-blur sm:p-8">
          <div className="mb-6">
            <LanguageSelector variant="login" />
          </div>

          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center md:hidden">
              <img src="/logo.png" className="h-16 w-auto object-contain" alt="TCDX Compliance" />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              {t('login.secureAccess')}
            </p>

            <h2 className="text-2xl font-bold text-slate-950">
              {t('login.title')}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {t('login.subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('login.email')}
              </label>

              <input
                type="email"
                className="tcdx-focus-ring w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-slate-900 placeholder:text-slate-400"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('login.password')}
              </label>

              <input
                type="password"
                className="tcdx-focus-ring w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-slate-900 placeholder:text-slate-400"
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
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f6feb] p-3 font-semibold text-white shadow-[0_14px_28px_rgba(31,111,235,0.24)] transition hover:-translate-y-0.5 hover:bg-[#195fc9] hover:shadow-[0_18px_34px_rgba(31,111,235,0.28)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            {t('login.routeHint')}
          </div>
        </div>
      </div>
    </div>
  );
}
