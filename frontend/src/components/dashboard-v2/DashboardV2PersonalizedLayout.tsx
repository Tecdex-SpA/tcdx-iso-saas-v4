'use client';

import type { ReactNode } from 'react';
import DashboardV2Panel from './DashboardV2Panel';
import DashboardV2StandardCard from './DashboardV2StandardCard';
import type { DashboardV2BlockKey, DashboardV2Layout, DashboardV2Response, DashboardV2Standard } from './types';
import { chipClass, statusLabel } from './utils';

export const DEFAULT_DASHBOARD_V2_LAYOUT: DashboardV2Layout = {
  version: 1,
  order: ['standards', 'salud_iso', 'ciclo_vida', 'acciones', 'riesgos', 'kpis', 'alertas'],
  collapsed: {},
};

const BLOCK_META: Record<DashboardV2BlockKey, { title: string; description: string; tabKey?: string }> = {
  standards: {
    title: 'Normas contratadas',
    description: 'Tarjetas activas del tenant actual.',
  },
  salud_iso: {
    title: 'Salud ISO',
    description: 'Salud global, por norma y distribucion de controles.',
    tabKey: 'salud_iso',
  },
  ciclo_vida: {
    title: 'Ciclo de vida',
    description: 'Etapas, avance y bloqueos del ciclo operativo ISO.',
    tabKey: 'ciclo_vida',
  },
  acciones: {
    title: 'Acciones y trabajo pendiente',
    description: 'Sugerencias, conversiones y pendientes operativos.',
    tabKey: 'acciones',
  },
  riesgos: {
    title: 'Riesgos ISO',
    description: 'Riesgos prioritarios y vista interna expandible.',
    tabKey: 'riesgos',
  },
  kpis: {
    title: 'KPIs',
    description: 'Indicadores ejecutivos y por norma contratada.',
    tabKey: 'kpis',
  },
  alertas: {
    title: 'Alertas inteligentes',
    description: 'Alertas accionables desde riesgos, acciones, salud y KPIs.',
    tabKey: 'alertas',
  },
};

type Props = {
  data: DashboardV2Response;
  standards: DashboardV2Standard[];
  layout: DashboardV2Layout;
  editMode: boolean;
  onMove: (from: DashboardV2BlockKey, to: DashboardV2BlockKey) => void;
  onToggleCollapse: (block: DashboardV2BlockKey) => void;
};

export function normalizeDashboardV2Layout(layout?: Partial<DashboardV2Layout> | null): DashboardV2Layout {
  const order: DashboardV2BlockKey[] = [];
  const allowed = new Set(DEFAULT_DASHBOARD_V2_LAYOUT.order);

  (Array.isArray(layout?.order) ? layout.order : DEFAULT_DASHBOARD_V2_LAYOUT.order).forEach((block) => {
    if (allowed.has(block) && !order.includes(block)) order.push(block);
  });
  DEFAULT_DASHBOARD_V2_LAYOUT.order.forEach((block) => {
    if (!order.includes(block)) order.push(block);
  });

  return {
    version: 1,
    order,
    collapsed: {
      ...DEFAULT_DASHBOARD_V2_LAYOUT.collapsed,
      ...(layout?.collapsed || {}),
    },
    updated_at: layout?.updated_at,
  };
}

export default function DashboardV2PersonalizedLayout({
  data,
  standards,
  layout,
  editMode,
  onMove,
  onToggleCollapse,
}: Props) {
  return (
    <div className="space-y-4">
      {layout.order.map((block) => (
        <DashboardBlock
          key={block}
          block={block}
          collapsed={layout.collapsed[block] === true}
          editMode={editMode}
          onMove={onMove}
          onToggleCollapse={onToggleCollapse}
        >
          {block === 'standards' ? (
            <StandardsBlock data={data} standards={standards} />
          ) : (
            <DashboardV2Panel activeTab={BLOCK_META[block].tabKey || block} data={data} />
          )}
        </DashboardBlock>
      ))}
    </div>
  );
}

function DashboardBlock({
  block,
  collapsed,
  editMode,
  onMove,
  onToggleCollapse,
  children,
}: {
  block: DashboardV2BlockKey;
  collapsed: boolean;
  editMode: boolean;
  onMove: (from: DashboardV2BlockKey, to: DashboardV2BlockKey) => void;
  onToggleCollapse: (block: DashboardV2BlockKey) => void;
  children: ReactNode;
}) {
  const meta = BLOCK_META[block];

  return (
    <section
      draggable={editMode}
      onDragStart={(event) => {
        if (!editMode) return;
        event.dataTransfer.setData('text/plain', block);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        if (editMode) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!editMode) return;
        event.preventDefault();
        const from = event.dataTransfer.getData('text/plain') as DashboardV2BlockKey;
        if (from && from !== block) onMove(from, block);
      }}
      className={[
        'rounded-xl border bg-white/70 p-2 transition',
        editMode ? 'border-blue-200 ring-1 ring-blue-100' : 'border-transparent',
      ].join(' ')}
    >
      {editMode && (
        <div className="mb-2 flex flex-col gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-950">{meta.title}</div>
            <div className="text-xs text-blue-800">{meta.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-800">
              Arrastrar
            </span>
            <button
              type="button"
              onClick={() => onToggleCollapse(block)}
              className="rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              {collapsed ? 'Expandir' : 'Colapsar'}
            </button>
          </div>
        </div>
      )}

      {collapsed ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{meta.title}</h2>
              <p className="mt-1 text-sm text-slate-500">Bloque colapsado en tu layout personal.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleCollapse(block)}
              className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              Expandir
            </button>
          </div>
        </div>
      ) : children}
    </section>
  );
}

function StandardsBlock({ data, standards }: { data: DashboardV2Response; standards: DashboardV2Standard[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Normas contratadas</h2>
          <p className="mt-1 text-xs text-slate-500">Solo tarjetas activas del tenant actual.</p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(data.general_health.status)}`}>
          {statusLabel(data.general_health.status)}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {standards.map((standard) => (
          <DashboardV2StandardCard
            key={`${standard.standard_code}-${standard.version_code}`}
            standard={standard}
          />
        ))}
      </div>
    </section>
  );
}
