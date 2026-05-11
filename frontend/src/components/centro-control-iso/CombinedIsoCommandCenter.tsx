'use client';

import { useState } from 'react';
import IsoCommandCenterDashboard from '@/components/command-center-iso/IsoCommandCenterDashboard';
import UnifiedIsoCommandCenter from './UnifiedIsoCommandCenter';

type ViewKey = 'unified' | 'executive';

const views: Array<{ key: ViewKey; label: string; description: string }> = [
  {
    key: 'unified',
    label: 'Centro unificado',
    description: 'Operacion diaria, prioridades, workflow y accesos por norma contratada.',
  },
  {
    key: 'executive',
    label: 'Vista ejecutiva',
    description: 'Readiness, cobertura, actividad y panorama directivo del cumplimiento ISO.',
  },
];

export default function CombinedIsoCommandCenter() {
  const [activeView, setActiveView] = useState<ViewKey>('unified');

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-7xl px-4 pt-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Centro de Control ISO</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                Vista combinada de gestion y command center
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Consolidación de brechas, riesgos, documentos, acciones y documentos operativos
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {views.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setActiveView(view.key)}
                  title={view.description}
                  className={[
                    'rounded-md px-3 py-2 text-sm font-semibold transition',
                    activeView === view.key
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white',
                  ].join(' ')}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {activeView === 'unified' ? <UnifiedIsoCommandCenter /> : <IsoCommandCenterDashboard />}
    </div>
  );
}
