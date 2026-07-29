'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiBaseUrl } from '@/utils/apiClient';

const API_URL = getApiBaseUrl();

type ApiResponse<T> = { ok?: boolean; data?: T; error?: string; message?: string };
type Catalog = {
  plans?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  modules?: Array<Record<string, unknown>>;
  capabilities?: Array<Record<string, unknown>>;
  limits?: Array<Record<string, unknown>>;
  packs?: Array<Record<string, unknown>>;
  methodologies?: Array<Record<string, unknown>>;
  workpapers?: Array<Record<string, unknown>>;
};

type TenantState = {
  subscription?: Record<string, unknown> | null;
  modules?: Array<Record<string, unknown>>;
  capabilities?: Record<string, Record<string, unknown>>;
  limits?: Record<string, Record<string, unknown>>;
  health?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  trials?: Array<Record<string, unknown>>;
  packs?: Array<Record<string, unknown>>;
};

type Props = {
  selectedTenantId: string;
  canManage: boolean;
  onChanged?: () => void;
};

function text(value: unknown, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberText(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString('es-CL') : '0';
}

function getError(payload: ApiResponse<unknown>, fallback: string) {
  return payload.error || payload.message || fallback;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || payload.ok === false) throw new Error(getError(payload, 'No fue posible operar el dominio comercial.'));
  return payload.data as T;
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function Phase4CommercialPanel({ selectedTenantId, canManage, onChanged }: Props) {
  const [catalog, setCatalog] = useState<Catalog>({});
  const [tenantState, setTenantState] = useState<TenantState>({});
  const [targetPlan, setTargetPlan] = useState('enterprise');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [packKey, setPackKey] = useState('implementation_quickstart');
  const [capabilityKey, setCapabilityKey] = useState('tprm.suppliers');
  const [resourceKey, setResourceKey] = useState('imports_monthly');
  const [limitValue, setLimitValue] = useState('25');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [tenantError, setTenantError] = useState('');
  const [message, setMessage] = useState('');

  const capabilities = useMemo(() => Object.values(tenantState.capabilities || {}), [tenantState.capabilities]);
  const limits = useMemo(() => Object.values(tenantState.limits || {}), [tenantState.limits]);
  const health = tenantState.health || {};

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setCatalogError('');
    setTenantError('');

    const [catalogResult, tenantResult] = await Promise.allSettled([
      api<Catalog>('/api/admin-saas/catalog'),
      selectedTenantId ? api<TenantState>(`/api/admin-saas/tenants/${selectedTenantId}/entitlements`) : Promise.resolve({}),
    ]);

    if (catalogResult.status === 'fulfilled') {
      setCatalog(catalogResult.value || {});
    } else {
      setCatalogError(catalogResult.reason instanceof Error ? catalogResult.reason.message : 'No fue posible cargar catálogo comercial.');
    }

    if (tenantResult.status === 'fulfilled') {
      setTenantState(tenantResult.value || {});
    } else {
      setTenantError(tenantResult.reason instanceof Error ? tenantResult.reason.message : 'No fue posible cargar estado comercial del tenant.');
    }

    setLoading(false);
  }, [selectedTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runPreview = async () => {
    if (!selectedTenantId) return;
    setSaving('preview');
    setError('');
    try {
      const data = await api<Record<string, unknown>>(`/api/admin-saas/tenants/${selectedTenantId}/change-preview`, {
        method: 'POST',
        body: JSON.stringify({ target_plan_key: targetPlan }),
      });
      setPreview(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible previsualizar el cambio.');
    } finally {
      setSaving(null);
    }
  };

  const changePlan = async () => {
    if (!selectedTenantId || !preview) return;
    setSaving('change-plan');
    setError('');
    try {
      await api(`/api/admin-saas/tenants/${selectedTenantId}/change-plan`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `phase4-plan-${selectedTenantId}-${targetPlan}` },
        body: JSON.stringify({ target_plan_key: targetPlan, reason: 'Cambio comercial administrado', idempotency_key: `phase4-plan-${selectedTenantId}-${targetPlan}` }),
      });
      setMessage('Plan actualizado e invalidación de entitlements lista para recarga.');
      setPreview(null);
      onChanged?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible ejecutar el cambio.');
    } finally {
      setSaving(null);
    }
  };

  const applyOverride = async () => {
    if (!selectedTenantId) return;
    setSaving('override');
    setError('');
    try {
      await api(`/api/admin-saas/tenants/${selectedTenantId}/overrides`, {
        method: 'POST',
        body: JSON.stringify({ capability_key: capabilityKey, enabled: true, reason: 'Override comercial con vigencia controlada' }),
      });
      setMessage('Override aplicado.');
      onChanged?.();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible aplicar override.');
    } finally {
      setSaving(null);
    }
  };

  const saveLimit = async () => {
    if (!selectedTenantId) return;
    setSaving('limit');
    setError('');
    try {
      await api(`/api/admin-saas/tenants/${selectedTenantId}/limits/${resourceKey}`, {
        method: 'PUT',
        body: JSON.stringify({ limit_value: Number(limitValue), warning_threshold: 0.8, enforcement: 'block' }),
      });
      setMessage('Limite actualizado.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar limite.');
    } finally {
      setSaving(null);
    }
  };

  const installPack = async () => {
    if (!selectedTenantId) return;
    setSaving('pack');
    setError('');
    try {
      await api(`/api/admin-saas/tenants/${selectedTenantId}/packs/${packKey}/install`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `phase4-pack-${selectedTenantId}-${packKey}` },
      });
      setMessage('Pack instalado o ya existente para este tenant.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible instalar pack.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={loading}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Gobierno comercial del producto</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Planes, módulos, capabilities, límites, salud de tenant y aceleradores instalables con trazabilidad administrativa.
          </p>
        </div>
        <button type="button" onClick={load} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Actualizar
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {catalogError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Catálogo: {catalogError}</div>}
      {tenantError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Tenant: {tenantError}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Plan vigente</div><div className="mt-1 text-lg font-bold text-slate-950">{text(tenantState.subscription?.plan_key, 'Sin plan')}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Capabilities</div><div className="mt-1 text-lg font-bold text-slate-950">{capabilities.filter((item) => item.enabled === true).length}/{capabilities.length}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Salud</div><div className="mt-1 text-lg font-bold text-slate-950">{text(health.status, 'Sin cálculo')}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Score</div><div className="mt-1 text-lg font-bold text-slate-950">{numberText(health.score)}</div></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Capabilities efectivas</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
            {capabilities.map((capability) => (
              <div key={String(capability.capability_key)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-800" title={String(capability.capability_key)}>{String(capability.capability_key)}</span>
                <Badge tone={capability.enabled ? 'green' : 'red'}>{capability.enabled ? 'habilitada' : 'bloqueada'} · {text(capability.source)}</Badge>
              </div>
            ))}
            {capabilities.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Sin capabilities comerciales resueltas para el tenant.</div>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Límites y consumo</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
            {limits.map((limit) => (
              <div key={String(limit.resource_key)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-800">{String(limit.resource_key)}</span><Badge tone={limit.exhausted ? 'red' : 'blue'}>{numberText(limit.usage)} / {limit.limit === null ? 'sin límite' : numberText(limit.limit)}</Badge></div>
              </div>
            ))}
            {limits.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Sin límites configurados.</div>}
          </div>
        </div>
      </div>

      {canManage && selectedTenantId && (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Cambio de plan</h3>
            <select value={targetPlan} onChange={(event) => setTargetPlan(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {(catalog.plans || []).map((plan) => <option key={String(plan.plan_key)} value={String(plan.plan_key)}>{String(plan.display_name || plan.plan_key)}</option>)}
            </select>
            <div className="mt-3 flex gap-2"><button type="button" onClick={runPreview} disabled={saving === 'preview'} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Preview</button><button type="button" onClick={changePlan} disabled={!preview || saving === 'change-plan'} className="rounded-xl bg-[#F97316] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Aplicar</button></div>
            {preview && <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(preview, null, 2)}</pre>}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Override y límites</h3>
            <input value={capabilityKey} onChange={(event) => setCapabilityKey(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Capability" />
            <button type="button" onClick={applyOverride} disabled={saving === 'override'} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Habilitar override</button>
            <div className="mt-4 grid grid-cols-[1fr_100px] gap-2"><input value={resourceKey} onChange={(event) => setResourceKey(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Recurso" /><input value={limitValue} onChange={(event) => setLimitValue(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Límite" /></div>
            <button type="button" onClick={saveLimit} disabled={saving === 'limit'} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Guardar límite</button>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Packs y metodologías</h3>
            <select value={packKey} onChange={(event) => setPackKey(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {(catalog.packs || []).map((pack) => <option key={String(pack.pack_key)} value={String(pack.pack_key)}>{String(pack.display_name || pack.pack_key)} · {String(pack.status)}</option>)}
            </select>
            <button type="button" onClick={installPack} disabled={saving === 'pack'} className="mt-3 rounded-xl bg-[#1b2733] px-3 py-2 text-sm font-semibold text-white">Instalar pack</button>
            <div className="mt-4 text-xs text-slate-500">Metodologías: {(catalog.methodologies || []).length} · Papeles de trabajo: {(catalog.workpapers || []).length}</div>
          </div>
        </div>
      )}
    </section>
  );
}
