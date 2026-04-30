'use client';

import { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';

export default function IaAuditorRedirectPage() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = '/auditorias';
    }, 1800);

    return () => clearTimeout(t);
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl rounded-[34px] border border-indigo-100 bg-white p-8 shadow-sm">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
          IA Auditor
        </span>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          IA Auditor ahora vive dentro de Auditorías
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Para obtener un análisis útil, selecciona una auditoría específica y usa el botón
          IA Auditor desde esa auditoría. Te estamos llevando a Auditorías.
        </p>
      </div>
    </AppLayout>
  );
}
