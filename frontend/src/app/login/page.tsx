'use client';

import { useEffect, useState } from 'react';
import {
  decodeJwtPayload,
  getHomePathByRole,
  getHomePathFromToken,
  isTokenExpired,
} from '@/utils/auth';
import LanguageSelector from '@/components/language/LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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
      <div className="hidden w-[46%] flex-col justify-between bg-[linear-gradient(180deg,#06173a_0%,#061f49_52%,#041126_100%)] p-10 text-white shadow-[18px_0_42px_rgba(8,25,58,0.2)] md:flex">
        <div>
          <img src="/logo.png" className="mb-10 w-56" alt="TCDX Compliance" />
          <div className="h-1 w-16 rounded bg-emerald-300" />
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

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-3 text-sm text-white/82">
            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {t('login.heroCardAudits')}
            </div>

            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {t('login.heroCardEvidence')}
            </div>
          </div>
        </div>

        <div className="text-xs text-white/55">
          {t('login.heroFooter')}
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 md:w-[54%]">
        <div className="tcdx-card w-full max-w-md rounded-lg p-8">
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
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-lg bg-[#1f6feb] p-3 font-semibold text-white shadow-[0_14px_28px_rgba(31,111,235,0.24)] transition hover:bg-[#195fc9] disabled:cursor-not-allowed disabled:opacity-60"
            >
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
