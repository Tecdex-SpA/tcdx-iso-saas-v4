'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function MetricsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('METRICS_ROUTE_ERROR', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-xl border border-red-200 bg-white p-6 shadow-lg" role="alert">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Métricas y fórmulas</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">La vista no pudo completar la operación</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          La sesión y la empresa seleccionada se conservan. Reintenta la carga; si el problema continúa, vuelve a Administración SaaS y selecciona nuevamente la empresa.
        </p>
        {error.digest && <p className="mt-3 text-xs text-slate-500">Referencia técnica: {error.digest}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-md bg-[var(--tcdx-color-action-primary)] px-4 py-2 text-sm font-semibold text-white">
            Reintentar
          </button>
          <Link href="/admin-saas" className="rounded-md border border-[var(--tcdx-color-border)] px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-primary)]">
            Volver a Administración SaaS
          </Link>
        </div>
      </section>
    </main>
  );
}
