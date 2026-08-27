'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Phase3Nav from './Phase3Nav';
import { phase3Request } from './phase3Api';

type ActivationItem = {
  key: string;
  label: string;
  value: number;
  href: string;
};

type ActivationReadiness = {
  state: 'demo' | 'configurado' | 'operativo' | 'incompleto' | 'bloqueado';
  ready_to_operate: boolean;
  items: ActivationItem[];
};

const positiveCounters = new Set(['units_configured', 'processes_with_owner']);

const stateDescriptions: Record<ActivationReadiness['state'], string> = {
  demo: 'Hay registros identificados como demostración. Sepáralos antes de activar datos reales.',
  configurado: 'La base está configurada, pero quedan actividades operacionales de seguimiento.',
  operativo: 'La cadena mínima está completa y dispone de seguimiento operacional.',
  incompleto: 'Existen datos reales, pero faltan relaciones o elementos críticos.',
  bloqueado: 'Falta la estructura mínima para comenzar a operar.',
};

export default function Phase3Activation() {
  const [data, setData] = useState<ActivationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await phase3Request<ActivationReadiness>('/readiness'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible evaluar la activación.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout>
      <section className="space-y-6">
        <nav aria-label="Migas de pan" className="text-sm text-[var(--tcdx-color-text-secondary)]">
          <Link href="/dashboard">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/operaciones-grc">Riesgo Operativo</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">Activación</span>
        </nav>
        <Phase3Nav />
        <header>
          <p className="text-xs font-semibold uppercase text-[var(--tcdx-color-primary)]">
            Onboarding operacional
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">
            Asistente de activación
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
            Revisa la cadena completa y navega directamente a cada dato pendiente.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-300 bg-white p-4 text-sm text-red-700">
            {error}
            <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">
              Reintentar
            </button>
          </div>
        )}
        {loading && (
          <div aria-busy="true" className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-200" />)}
          </div>
        )}
        {data && (
          <>
            <section className="rounded-xl border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[var(--tcdx-color-text-primary)]">
                    Estado: <span className="capitalize text-[var(--tcdx-color-primary)]">{data.state}</span>
                  </h2>
                  <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
                    {stateDescriptions[data.state]}
                  </p>
                </div>
                <span className={[
                  'rounded-full px-3 py-1 text-sm font-semibold',
                  data.ready_to_operate ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900',
                ].join(' ')}>
                  {data.ready_to_operate ? 'Datos listos para operar' : 'Datos aún no listos'}
                </span>
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map(item => {
                const complete = positiveCounters.has(item.key) ? Number(item.value) > 0 : Number(item.value) === 0;
                return (
                  <article key={item.key} className="rounded-xl border border-[var(--tcdx-color-border)] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">{item.label}</h2>
                        <p className="mt-2 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">{item.value}</p>
                      </div>
                      <span className={complete ? 'text-emerald-700' : 'text-amber-700'}>
                        {complete ? 'Completo' : 'Pendiente'}
                      </span>
                    </div>
                    <Link href={item.href} className="mt-4 inline-block text-sm font-semibold text-[var(--tcdx-color-primary)] hover:underline">
                      {complete ? 'Revisar datos' : 'Resolver pendiente'}
                    </Link>
                  </article>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              {data.state === 'demo' ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
                  La importación real se habilita al separar los registros demo.
                </p>
              ) : (
                <Link href="/operaciones-grc/importar" className="rounded-lg bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white">
                  Importar datos reales
                </Link>
              )}
              <Link href="/operaciones-grc" className="rounded-lg border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold">
                Volver al dashboard
              </Link>
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
