'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getHomePathFromToken, getStoredValidToken } from '@/utils/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getStoredValidToken();
    router.replace(token ? getHomePathFromToken() : '/login');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef3f8_100%)] px-6 py-10 text-slate-950">
      <section className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(8,25,58,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-600 text-white shadow-[0_16px_34px_rgba(37,99,235,0.3)]">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
            <path d="M9 12l2 2 4-5" />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          Tecdex GRC Compliance
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Plataforma de cumplimiento ISO para operación, auditoría y evidencia.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
          Estamos preparando tu sesión. Si ya tienes acceso activo, entrarás al panel correspondiente a tu rol.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Ir al login
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
