'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function IsoHealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[iso-health] route error', {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-600">
          Health ISO
        </p>
        <h1 className="mt-2 text-2xl font-black">No fue posible cargar Health ISO</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ocurrió un error en la vista. Puedes reintentar o volver al dashboard.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver al dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
