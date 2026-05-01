'use client';

import { useEffect, useState } from 'react';
import {
  decodeJwtPayload,
  getHomePathByRole,
  getHomePathFromToken,
  isTokenExpired,
} from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

export default function LoginPage() {
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
        setError('Ingresa tu email.');
        return;
      }

      if (!password.trim()) {
        setError('Ingresa tu contraseña.');
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
        throw new Error(`Respuesta inválida del backend. HTTP ${res.status}.`);
      }

      if (!res.ok || !data.token) {
        setError(data.error || data.message || 'Credenciales inválidas.');
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
      setError(err.message || 'Error de conexión con backend.');
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
            ISO SaaS Platform
          </p>

          <h1 className="max-w-xl text-4xl font-bold leading-tight">
            Cumplimiento ISO con operación, evidencia e inteligencia auditora.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
            Plataforma multi-tenant para preparar auditorías, sostener controles,
            gestionar hallazgos y convertir evidencias en decisiones ejecutivas.
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-3 text-sm text-white/82">
            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              Auditorías ISO 27001, 9001 y 22301.
            </div>

            <div className="rounded-lg border border-white/12 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              Evidencias, riesgos, KPI y planes de acción.
            </div>
          </div>
        </div>

        <div className="text-xs text-white/55">
          Acceso segmentado por rol, tenant, módulos contratados y alcance activo.
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 md:w-[54%]">
        <div className="tcdx-card w-full max-w-md rounded-lg p-8">
          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center md:hidden">
              <img src="/logo.png" className="h-16 w-auto object-contain" alt="TCDX Compliance" />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Acceso seguro
            </p>

            <h2 className="text-2xl font-bold text-slate-950">
              Iniciar sesión
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Ingresa con tus credenciales para acceder a la plataforma.
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
                Email
              </label>

              <input
                className="tcdx-focus-ring w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-slate-900 placeholder:text-slate-400"
                placeholder="usuario@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Contraseña
              </label>

              <input
                type="password"
                className="tcdx-focus-ring w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-slate-900 placeholder:text-slate-400"
                placeholder="Contraseña"
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
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            La ruta inicial se asigna automáticamente según tu rol.
          </div>
        </div>
      </div>
    </div>
  );
}
