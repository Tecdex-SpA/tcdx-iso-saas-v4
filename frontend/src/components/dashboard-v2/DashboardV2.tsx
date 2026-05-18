'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken } from '@/utils/auth';
import DashboardV2Header from './DashboardV2Header';
import DashboardV2Panel from './DashboardV2Panel';
import DashboardV2PersonalizedLayout, {
  DEFAULT_DASHBOARD_V2_LAYOUT,
  normalizeDashboardV2Layout,
} from './DashboardV2PersonalizedLayout';
import DashboardV2Tabs from './DashboardV2Tabs';
import type { DashboardV2BlockKey, DashboardV2Layout, DashboardV2Response } from './types';
import { statusLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://181.212.166.187:8443';

type ApiEnvelope = Partial<DashboardV2Response> & {
  ok?: boolean;
  data?: DashboardV2Response;
  error?: string;
};

type PreferencesEnvelope = {
  ok?: boolean;
  data?: {
    layout_json?: Partial<DashboardV2Layout>;
    is_default?: boolean;
  };
  layout_json?: Partial<DashboardV2Layout>;
  error?: string;
};

function emptyData(): DashboardV2Response {
  return {
    executive_readiness: {
      headline: 'Sin datos suficientes',
      score: 0,
      readiness_label: 'sin_datos',
      statement: 'Aun no hay datos suficientes para calcular readiness.',
      blockers: [],
      blockers_summary: 'Sin datos suficientes',
    },
    general_health: {
      score: 0,
      label: 'sin_datos',
      coverage_pct: 0,
      status: 'limited',
    },
    audit_readiness: {
      score: 0,
      label: 'sin_datos',
      message: 'Sin datos suficientes',
      blockers: [],
    },
    active_standards: [],
    summary: {
      active_standards: 0,
      operational_versions: 0,
      transition_versions: 0,
      readiness_score: 0,
      coverage_pct: 0,
      pending_actions: 0,
      converted_actions: 0,
      high_risks: 0,
      open_findings: 0,
      open_nonconformities: 0,
      open_action_plans: 0,
    },
    operational_panels: {
      actions: {
        summary: {
          total: 0,
          pending: 0,
          converted: 0,
          overdue: 0,
          pending_approval: 0,
          critical: 0,
          open_action_plans: 0,
          open_findings: 0,
          open_nonconformities: 0,
        },
        by_standard: [],
        recent: [],
        work_pending: [],
        data_quality: 'limited',
      },
      risks: {
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          without_owner: 0,
          without_treatment: 0,
          upcoming_due: 0,
        },
        by_standard: [],
        priority_risks: [],
        all_risks: [],
        data_quality: 'limited',
      },
      kpis: {
        summary: {
          measured_kpis: 0,
          green: 0,
          yellow: 0,
          red: 0,
          gray: 0,
          executive_score: 0,
          last_calculated_at: null,
        },
        by_standard: [],
        items: [],
        data_quality: 'limited',
      },
      alerts: [],
    },
    alerts: [],
    priorities: [],
    tabs: [
      { key: 'resumen', title: 'Resumen', status: 'empty', metric: 0 },
      { key: 'salud_iso', title: 'Salud ISO', status: 'prepared', metric: 0 },
      { key: 'ciclo_vida', title: 'Ciclo de vida', status: 'prepared', metric: 0 },
      { key: 'acciones', title: 'Acciones', status: 'prepared', metric: 0 },
      { key: 'riesgos', title: 'Riesgos', status: 'prepared', metric: 0 },
      { key: 'kpis', title: 'KPIs', status: 'prepared', metric: 0 },
      { key: 'alertas', title: 'Alertas', status: 'prepared', metric: 0 },
    ],
    data_quality: { level: 'limited', notes: [] },
  };
}

export default function DashboardV2() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardV2Response>(emptyData());
  const [activeTab, setActiveTab] = useState('resumen');
  const [layout, setLayout] = useState<DashboardV2Layout>(DEFAULT_DASHBOARD_V2_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<DashboardV2Layout>(DEFAULT_DASHBOARD_V2_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingLayout, setSavingLayout] = useState(false);
  const [error, setError] = useState('');
  const [layoutMessage, setLayoutMessage] = useState('');

  const loadSummary = useCallback(async (activeToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard-v2/summary`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    const text = await response.text();
    let json: ApiEnvelope | null = null;

    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error('Respuesta invalida desde Dashboard v2.');
    }

    if (!response.ok || json?.ok === false || !json) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sesion no valida o sin permisos para Dashboard v2.');
      }
      throw new Error(json?.error || 'No fue posible cargar Dashboard v2.');
    }

    return (json.data || json) as DashboardV2Response;
  }, []);

  const loadPreferences = useCallback(async (activeToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard-v2/preferences`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    const text = await response.text();
    let json: PreferencesEnvelope | null = null;

    try {
      json = text ? JSON.parse(text) as PreferencesEnvelope : null;
    } catch {
      return DEFAULT_DASHBOARD_V2_LAYOUT;
    }

    if (!response.ok || json?.ok === false || !json) {
      setLayoutMessage(json?.error || 'No fue posible cargar preferencias; se usara el diseno predeterminado.');
      return DEFAULT_DASHBOARD_V2_LAYOUT;
    }

    return normalizeDashboardV2Layout(json.data?.layout_json || json.layout_json || DEFAULT_DASHBOARD_V2_LAYOUT);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      setLayoutMessage('');
      const [next, nextLayout] = await Promise.all([
        loadSummary(token),
        loadPreferences(token),
      ]);
      setLayout(nextLayout);
      setSavedLayout(nextLayout);
      setData({
        ...emptyData(),
        ...next,
        executive_readiness: { ...emptyData().executive_readiness, ...(next.executive_readiness || {}) },
        general_health: { ...emptyData().general_health, ...(next.general_health || {}) },
        audit_readiness: { ...emptyData().audit_readiness, ...(next.audit_readiness || {}) },
        active_standards: Array.isArray(next.active_standards) ? next.active_standards : [],
        alerts: Array.isArray(next.alerts) ? next.alerts : [],
        priorities: Array.isArray(next.priorities) ? next.priorities : [],
        tabs: Array.isArray(next.tabs) && next.tabs.length ? next.tabs : emptyData().tabs,
        summary: { ...emptyData().summary, ...(next.summary || {}) },
        operational_panels: {
          ...emptyData().operational_panels,
          ...(next.operational_panels || {}),
          actions: {
            ...emptyData().operational_panels?.actions,
            ...(next.operational_panels?.actions || {}),
            summary: {
              total: Number(next.operational_panels?.actions?.summary?.total || 0),
              pending: Number(next.operational_panels?.actions?.summary?.pending || 0),
              converted: Number(next.operational_panels?.actions?.summary?.converted || 0),
              overdue: Number(next.operational_panels?.actions?.summary?.overdue || 0),
              pending_approval: Number(next.operational_panels?.actions?.summary?.pending_approval || 0),
              critical: Number(next.operational_panels?.actions?.summary?.critical || 0),
              open_action_plans: Number(next.operational_panels?.actions?.summary?.open_action_plans || 0),
              open_findings: Number(next.operational_panels?.actions?.summary?.open_findings || 0),
              open_nonconformities: Number(next.operational_panels?.actions?.summary?.open_nonconformities || 0),
            },
            recent: Array.isArray(next.operational_panels?.actions?.recent) ? next.operational_panels.actions.recent : [],
            by_standard: Array.isArray(next.operational_panels?.actions?.by_standard) ? next.operational_panels.actions.by_standard : [],
            work_pending: Array.isArray(next.operational_panels?.actions?.work_pending) ? next.operational_panels.actions.work_pending : [],
          },
          risks: {
            ...emptyData().operational_panels?.risks,
            ...(next.operational_panels?.risks || {}),
            summary: {
              total: Number(next.operational_panels?.risks?.summary?.total || 0),
              critical: Number(next.operational_panels?.risks?.summary?.critical || 0),
              high: Number(next.operational_panels?.risks?.summary?.high || 0),
              medium: Number(next.operational_panels?.risks?.summary?.medium || 0),
              low: Number(next.operational_panels?.risks?.summary?.low || 0),
              without_owner: Number(next.operational_panels?.risks?.summary?.without_owner || 0),
              without_treatment: Number(next.operational_panels?.risks?.summary?.without_treatment || 0),
              upcoming_due: Number(next.operational_panels?.risks?.summary?.upcoming_due || 0),
            },
            priority_risks: Array.isArray(next.operational_panels?.risks?.priority_risks) ? next.operational_panels.risks.priority_risks : [],
            all_risks: Array.isArray(next.operational_panels?.risks?.all_risks) ? next.operational_panels.risks.all_risks : [],
            by_standard: Array.isArray(next.operational_panels?.risks?.by_standard) ? next.operational_panels.risks.by_standard : [],
          },
          kpis: {
            ...emptyData().operational_panels?.kpis,
            ...(next.operational_panels?.kpis || {}),
            summary: {
              measured_kpis: Number(next.operational_panels?.kpis?.summary?.measured_kpis || 0),
              green: Number(next.operational_panels?.kpis?.summary?.green || 0),
              yellow: Number(next.operational_panels?.kpis?.summary?.yellow || 0),
              red: Number(next.operational_panels?.kpis?.summary?.red || 0),
              gray: Number(next.operational_panels?.kpis?.summary?.gray || 0),
              executive_score: Number(next.operational_panels?.kpis?.summary?.executive_score || 0),
              last_calculated_at: next.operational_panels?.kpis?.summary?.last_calculated_at || null,
            },
            items: Array.isArray(next.operational_panels?.kpis?.items) ? next.operational_panels.kpis.items : [],
            by_standard: Array.isArray(next.operational_panels?.kpis?.by_standard) ? next.operational_panels.kpis.by_standard : [],
          },
          alerts: Array.isArray(next.operational_panels?.alerts) ? next.operational_panels.alerts : [],
        },
        data_quality: next.data_quality || { level: 'limited', notes: [] },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Dashboard v2.');
    } finally {
      setLoading(false);
    }
  }, [loadPreferences, loadSummary, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    setToken(validToken);

    if (!validToken) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver Dashboard v2.');
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [refresh, token]);

  const standards = useMemo(
    () => [...data.active_standards].sort((a, b) => Number(a.readiness_score || 0) - Number(b.readiness_score || 0)),
    [data.active_standards]
  );

  const layoutDirty = useMemo(
    () => JSON.stringify(layout) !== JSON.stringify(savedLayout),
    [layout, savedLayout]
  );

  const moveBlock = (from: DashboardV2BlockKey, to: DashboardV2BlockKey) => {
    setLayout((current) => {
      const order = [...current.order];
      const fromIndex = order.indexOf(from);
      const toIndex = order.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return current;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, from);
      return { ...current, order };
    });
  };

  const toggleCollapse = (block: DashboardV2BlockKey) => {
    setLayout((current) => ({
      ...current,
      collapsed: {
        ...current.collapsed,
        [block]: current.collapsed[block] !== true,
      },
    }));
  };

  const saveLayout = async () => {
    if (!token) return;
    try {
      setSavingLayout(true);
      setLayoutMessage('');
      const response = await fetch(`${API_BASE_URL}/api/dashboard-v2/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dashboard_key: 'dashboard_v2',
          layout_json: layout,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible guardar el diseno.');
      }
      const nextLayout = normalizeDashboardV2Layout(json?.data?.layout_json || json?.layout_json || layout);
      setLayout(nextLayout);
      setSavedLayout(nextLayout);
      setLayoutMessage('Diseno guardado para tu usuario.');
      setEditMode(false);
    } catch (err) {
      setLayoutMessage(err instanceof Error ? err.message : 'No fue posible guardar el diseno.');
    } finally {
      setSavingLayout(false);
    }
  };

  const resetLayout = async () => {
    if (!token) return;
    const confirmed = window.confirm('Restaurar el diseno predeterminado de Dashboard v2 para tu usuario?');
    if (!confirmed) return;

    try {
      setSavingLayout(true);
      setLayoutMessage('');
      const response = await fetch(`${API_BASE_URL}/api/dashboard-v2/preferences`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible restaurar el diseno.');
      }
      const nextLayout = normalizeDashboardV2Layout(json?.data?.layout_json || json?.layout_json || DEFAULT_DASHBOARD_V2_LAYOUT);
      setLayout(nextLayout);
      setSavedLayout(nextLayout);
      setLayoutMessage('Diseno predeterminado restaurado.');
      setEditMode(false);
    } catch (err) {
      setLayoutMessage(err instanceof Error ? err.message : 'No fue posible restaurar el diseno.');
    } finally {
      setSavingLayout(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardV2Header data={data} loading={loading} onRefresh={refresh} />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {data.data_quality?.notes && data.data_quality.notes.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Calidad de datos {statusLabel(data.data_quality.level)}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.data_quality.notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <DashboardV2Tabs tabs={data.tabs} activeTab={activeTab} onChange={setActiveTab} />

        {loading && (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && !error && standards.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Sin normas activas contratadas</div>
            <p className="mt-2 text-sm text-slate-500">
              Dashboard v2 no muestra normas no contratadas ni estados en cero de normas fuera del alcance del tenant.
            </p>
          </div>
        )}

        {!loading && !error && standards.length > 0 && (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Personalizacion visual</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Orden y bloques colapsados se guardan por usuario, tenant y Dashboard v2.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMode((value) => !value)}
                    className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                  >
                    {editMode ? 'Salir de edicion' : 'Personalizar dashboard'}
                  </button>
                  <button
                    type="button"
                    onClick={saveLayout}
                    disabled={!layoutDirty || savingLayout}
                    className="rounded bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                  >
                    {savingLayout ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={resetLayout}
                    disabled={savingLayout}
                    className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-45"
                  >
                    Restaurar predeterminado
                  </button>
                </div>
              </div>
              {(layoutDirty || layoutMessage) && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {layoutMessage || 'Hay cambios sin guardar en tu diseno.'}
                </div>
              )}
            </section>

            {activeTab === 'resumen' ? (
              <DashboardV2PersonalizedLayout
                data={data}
                standards={standards}
                layout={layout}
                editMode={editMode}
                onMove={moveBlock}
                onToggleCollapse={toggleCollapse}
              />
            ) : (
              <DashboardV2Panel activeTab={activeTab} data={data} />
            )}

            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Layout por usuario activo</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tu orden visual no modifica el Dashboard v2 de otros usuarios del mismo tenant.
                  </p>
                </div>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  {layout.updated_at ? `Guardado ${new Date(layout.updated_at).toLocaleDateString('es-CL')}` : 'Predeterminado'}
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
