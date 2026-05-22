'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type ImpactRecord = Record<string, unknown>;

type ModuleImpact = {
  ok?: boolean;
  tenant_id?: string;
  module_code?: string;
  module_label?: string;
  company_profile_used?: boolean;
  ai_profile_used?: boolean;
  tenant_filter_enforced?: boolean;
  filtered_by_tenant_id?: boolean;
  prioritized_items?: ImpactRecord[];
  business_relevance?: string;
  recommended_focus?: Array<string | ImpactRecord>;
  suggested_actions?: ImpactRecord[];
  suggested_evidence?: Array<string | ImpactRecord>;
  maturity_gap?: ImpactRecord;
  risk_alignment?: ImpactRecord[];
  kpi_interpretation?: Array<string | ImpactRecord>;
  audit_focus?: Array<string | ImpactRecord>;
  roadmap_items?: ImpactRecord[];
  trace?: {
    selected_model?: string | null;
    used_web?: boolean;
    used_rag?: boolean;
    fallback_used?: boolean;
    calculated_at?: string;
    internal_context_counts?: Record<string, number>;
  };
};

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function itemText(item: unknown, keys: string[] = []): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const record = item as ImpactRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  const fallback = record.title || record.name || record.description || record.summary || record.reason || record.control || record.kpi || record.risk;
  return typeof fallback === 'string' ? fallback : '';
}

async function readJson(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(preview || 'Respuesta no JSON del servidor');
  }
  return res.json();
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{children}</span>;
}

export default function CompanyProfileImpactPanel({
  moduleCode,
  title,
  compact = false,
}: {
  moduleCode: 'dashboard' | 'health' | 'controls' | 'kpis' | 'audits' | 'action-plans' | 'reports';
  title?: string;
  compact?: boolean;
}) {
  const [impact, setImpact] = useState<ModuleImpact | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token') || '';
    if (!token) return;
    fetch(`${API_URL}/api/company-profile/impact/module/${moduleCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(readJson)
      .then((json) => {
        if (cancelled) return;
        if (!json?.ok) throw new Error(json?.error || 'No fue posible cargar impacto del Perfil Empresa');
        setImpact(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible cargar impacto del Perfil Empresa');
      });
    return () => {
      cancelled = true;
    };
  }, [moduleCode]);

  const focus = useMemo(() => {
    return asArray(impact?.recommended_focus)
      .map((item) => itemText(item, ['title', 'reason', 'description']))
      .filter(Boolean)
      .slice(0, 5);
  }, [impact]);

  const items = useMemo(() => {
    return asArray(impact?.prioritized_items)
      .map((item) => ({
        title: itemText(item, ['description', 'control', 'kpi', 'risk', 'title', 'name']),
        reason: itemText(item, ['profile_priority_reason', 'reason', 'linked_internal_signal', 'source']),
      }))
      .filter((item) => item.title)
      .slice(0, 5);
  }, [impact]);

  const actions = useMemo(() => {
    return asArray(impact?.suggested_actions)
      .map((item) => ({
        title: itemText(item, ['title', 'description']),
        reason: itemText(item, ['reason', 'linked_internal_signal']),
      }))
      .filter((item) => item.title)
      .slice(0, 4);
  }, [impact]);

  if (error) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Perfil Empresa: {error}
      </section>
    );
  }

  if (!impact) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Cargando impacto operativo del Perfil Empresa...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Perfil Empresa aplicado</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{title || impact.module_label || 'Impacto operativo'}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {impact.business_relevance || 'No hay datos internos suficientes para generar priorización completa; completar evidencias, controles y KPIs.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{impact.tenant_filter_enforced ? 'tenant-scope' : 'sin traza tenant'}</Badge>
          <Badge>{impact.company_profile_used ? 'perfil usado' : 'perfil pendiente'}</Badge>
          <Badge>{impact.ai_profile_used ? 'IA perfil' : 'determinístico'}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-800">Foco recomendado</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {(focus.length ? focus : ['No hay datos internos suficientes para priorización completa.']).slice(0, 5).map((row) => (
              <li key={row} className="leading-5">{row}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800">Elementos priorizados</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(items.length ? items : [{ title: 'Completar datos internos', reason: 'Sin evidencia interna suficiente para sostener recomendación completa.' }]).map((item) => (
              <div key={`${item.title}-${item.reason}`} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    Priorizado por Perfil Empresa
                  </span>
                </div>
                <strong className="block text-slate-900">{item.title}</strong>
                {item.reason && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.reason}</span>}
              </div>
            ))}
          </div>
        </article>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">Acciones sugeridas</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {(actions.length ? actions : [{ title: 'Completar evidencia y KPIs base', reason: 'Recomendación hipotética por falta de datos internos suficientes.' }]).map((item) => (
                <li key={`${item.title}-${item.reason}`} className="rounded-xl bg-slate-50 p-3">
                  <strong>{item.title}</strong>
                  {item.reason && <span className="block text-xs text-slate-500">{item.reason}</span>}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">Trazabilidad compacta</h3>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-2">
              <span>Modelo: {impact.trace?.fallback_used ? 'No disponible' : (impact.trace?.selected_model || 'No informado')}</span>
              <span>Web: {impact.trace?.used_web ? 'Sí' : 'No'}</span>
              <span>RAG: {impact.trace?.used_rag ? 'Sí' : 'No'}</span>
              <span>Fallback: {impact.trace?.fallback_used ? 'Sí' : 'No'}</span>
              <span>Controles: {impact.trace?.internal_context_counts?.controls_analyzed ?? 0}</span>
              <span>KPIs: {impact.trace?.internal_context_counts?.kpis_analyzed ?? 0}</span>
            </div>
          </article>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
      >
        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
      </button>
    </section>
  );
}
