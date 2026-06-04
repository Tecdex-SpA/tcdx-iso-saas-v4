'use client';

import AppLayout from '@/components/AppLayout';
import ProcessesOperationsPanel from '@/components/configuracion/ProcessesOperationsPanel';

export default function ConfiguracionPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Vista consolidada Sprint 2
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Configuración
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Administración tenant para usuarios, Perfil Empresa y la base segura de procesos y operaciones. La consola SaaS interna permanece separada del flujo cliente.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/usuarios" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Usuarios
            </a>
            <a href="/perfil-empresa" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Perfil empresa
            </a>
          </div>
        </section>

        <ProcessesOperationsPanel />
      </div>
    </AppLayout>
  );
}
