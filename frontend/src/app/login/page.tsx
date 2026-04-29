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
    <div className="flex h-screen">
      <div className="hidden md:flex w-1/2 bg-[#0A1F44] text-white flex-col justify-center items-center p-10">
        <img src="/logo.png" className="w-64 mb-8" alt="TCDX Compliance" />
        <div className="h-1 w-20 bg-blue-400 mb-6 rounded" />

        <h1 className="text-3xl font-bold mb-4">TCDX Compliance 3.0</h1>

        <p className="text-lg text-blue-200 text-center max-w-md">
          Sistema de cumplimiento de normativas
        </p>

        <div className="mt-10 grid grid-cols-1 gap-3 text-sm text-blue-100 max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            Gobierno ISO, evidencias, riesgos, hallazgos y planes de acción.
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            Acceso segmentado por rol: plataforma, cliente, auditor y dealer.
          </div>
        </div>
      </div>

      <div className="flex w-full md:w-1/2 items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Iniciar sesión
            </h2>

            <p className="mt-2 text-sm text-gray-500">
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>

              <input
                className="border border-gray-300 p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="usuario@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña
              </label>

              <input
                type="password"
                className="border border-gray-300 p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="bg-blue-600 text-white p-3 w-full rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
            La ruta inicial se asigna automáticamente según tu rol.
          </div>
        </div>
      </div>
    </div>
  );
}
