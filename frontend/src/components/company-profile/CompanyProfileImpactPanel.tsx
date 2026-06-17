'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type ImpactRecord = Record<string, unknown>;

type ApplicabilitySummary = {
  applicable_controls_count?: number;
  applicable_kpis_count?: number;
  applicable_evidence_requirements_count?: number;
  exclusions_count?: number;
  active_universe?: boolean;
};

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
    applicability_summary?: ApplicabilitySummary | null;
  };
  applicability_summary?: ApplicabilitySummary | null;
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
  return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{children}</span>;
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
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canShowAiTrace = !entitlementsLoading && canUseAiFeature('company_profile_analysis');
  const [impact, setImpact] = useState<ModuleImpact | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<boolean>(false);

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

  const summary = impact?.applicability_summary || impact?.trace?.applicability_summary || null;
  const nextAction = actions[0]?.title || focus[0] || 'Completar evidencias, controles y KPIs aplicables.';
  const primaryItem = items[0]?.title || 'Universo aplicable pendiente de completar';

  if (error) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Perfil Empresa: {error}
      </section>
    );
  }

  if (!impact) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Cargando impacto operativo del Perfil Empresa...
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Perfil Empresa aplicado</p>
            <Badge>{impact.tenant_filter_enforced ? 'tenant-scope' : 'sin traza tenant'}</Badge>
            <Badge>{summary?.active_universe !== false ? 'universo aplicable' : 'pendiente'}</Badge>
          </div>
          <h2 className="mt-1 text-base font-black text-slate-900">{title || impact.module_label || 'Impacto operativo'}</h2>
          <p className="mt-1 max-w-4xl truncate text-sm text-slate-600">
            Prioridad: {primaryItem}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="block font-black text-slate-900">{summary?.applicable_controls_count ?? 0}</span>
            <span className="text-slate-500">controles</span>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="block font-black text-slate-900">{summary?.applicable_kpis_count ?? 0}</span>
            <span className="text-slate-500">KPIs</span>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="block font-black text-slate-900">{summary?.applicable_evidence_requirements_count ?? 0}</span>
            <span className="text-slate-500">evidencias</span>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="block font-black text-slate-900">{summary?.exclusions_count ?? 0}</span>
            <span className="text-slate-500">excluidos</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950 md:flex-row md:items-center md:justify-between">
        <span className="truncate">Próxima acción: {nextAction}</span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle de aplicabilidad'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-800">Foco</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {(focus.length ? focus : ['No hay datos internos suficientes para priorización completa.']).slice(0, 3).map((row) => (
                <li key={row} className="leading-5">{row}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-800">Acciones sugeridas</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {(actions.length ? actions : [{ title: 'Completar evidencia y KPIs base', reason: 'Recomendación hipotética por falta de datos internos suficientes.' }]).slice(0, 3).map((item) => (
                <li key={`${item.title}-${item.reason}`} className="rounded-lg bg-slate-50 p-2">
                  <strong>{item.title}</strong>
                  {item.reason && <span className="block text-xs text-slate-500">{item.reason}</span>}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-800">Trazabilidad compacta</h3>
            <div className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">
              {canShowAiTrace && (
                <>
                  <span>Modelo: {impact.trace?.fallback_used ? 'No disponible' : (impact.trace?.selected_model || 'No informado')}</span>
                  <span>Web: {impact.trace?.used_web ? 'Sí' : 'No'}</span>
                  <span>RAG: {impact.trace?.used_rag ? 'Sí' : 'No'}</span>
                  <span>Fallback: {impact.trace?.fallback_used ? 'Sí' : 'No'}</span>
                </>
              )}
              <span>Controles: {impact.trace?.internal_context_counts?.controls_analyzed ?? 0}</span>
              <span>KPIs: {impact.trace?.internal_context_counts?.kpis_analyzed ?? 0}</span>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
