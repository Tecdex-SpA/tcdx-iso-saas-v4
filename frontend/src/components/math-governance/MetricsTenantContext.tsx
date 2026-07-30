'use client';

import { useEffect, useMemo, useState } from 'react';
import { clearTenantEntitlementsCache } from '@/hooks/useTenantEntitlements';
import {
  ApiClientError,
  apiRequestJson,
  getActiveTenantId,
  setActiveTenantId,
} from '@/utils/apiClient';
import {
  getTenantIdFromToken,
  getUserFromToken,
  getUserRoleFromToken,
} from '@/utils/auth';

type TenantOption = {
  tenant_id: string;
  tenant_name: string;
  service_status?: string;
};

type UnknownRecord = Record<string, unknown>;

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTenantRows(payload: unknown): TenantOption[] {
  const root = isRecord(payload) ? payload : {};
  const raw = Array.isArray(root.data)
    ? root.data
    : Array.isArray(payload)
      ? payload
      : [];

  return raw
    .filter(isRecord)
    .map((row) => ({
      tenant_id: stringValue(row.tenant_id || row.id),
      tenant_name: stringValue(row.tenant_name || row.name) || 'Empresa sin nombre',
      service_status: stringValue(row.service_status),
    }))
    .filter((row) => row.tenant_id);
}

function tenantNameFromToken() {
  const user = getUserFromToken();
  if (!isRecord(user)) return 'Empresa de la sesión';
  return (
    stringValue(user.tenant_name) ||
    stringValue(user.company_name) ||
    stringValue(user.company) ||
    'Empresa de la sesión'
  );
}

export default function MetricsTenantContext() {
  const role = getUserRoleFromToken();
  const isPlatform = PLATFORM_ROLES.has(role);
  const tokenTenantId = stringValue(getTenantIdFromToken());
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(() =>
    isPlatform ? getActiveTenantId() || '' : tokenTenantId
  );
  const [loading, setLoading] = useState(isPlatform);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPlatform) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    apiRequestJson('/api/admin-saas/tenants', {
      tenantRequired: false,
      fallbackMessage: 'No fue posible cargar las empresas disponibles.',
    })
      .then((payload) => {
        if (cancelled) return;
        const rows = normalizeTenantRows(payload);
        setTenants(rows);
        const current = getActiveTenantId() || '';
        setSelectedTenantId(rows.some((row) => row.tenant_id === current) ? current : '');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiClientError || err instanceof Error
            ? err.message
            : 'No fue posible cargar las empresas disponibles.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPlatform]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenant_id === selectedTenantId) || null,
    [selectedTenantId, tenants]
  );

  function changeTenant(nextTenantId: string) {
    setSelectedTenantId(nextTenantId);
    setActiveTenantId(nextTenantId || null);
    clearTenantEntitlementsCache();
    window.dispatchEvent(
      new CustomEvent('tcdx:tenant-context-changed', {
        detail: { tenantId: nextTenantId || null },
      })
    );
    window.location.assign('/metricas');
  }

  if (!isPlatform) {
    return (
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-4 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Contexto de empresa</p>
            <p className="mt-1 text-base font-semibold text-[var(--tcdx-color-text-ink)]">{tenantNameFromToken()}</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            Alcance limitado a su propia empresa
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-4 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,520px)] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Contexto operativo del superadministrador</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">Empresa sobre la que se calcularán las métricas</h2>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            La selección controla el tenant enviado al backend, los permisos comerciales, las fuentes operacionales y todos los resultados calculados.
          </p>
        </div>
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
          Empresa activa
          <select
            value={selectedTenantId}
            onChange={(event) => changeTenant(event.target.value)}
            disabled={loading}
            className="mt-1 block min-h-11 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal disabled:opacity-60"
          >
            <option value="">Selecciona una empresa</option>
            {tenants.map((tenant) => (
              <option key={tenant.tenant_id} value={tenant.tenant_id}>
                {tenant.tenant_name}{tenant.service_status && tenant.service_status !== 'active' ? ` · ${tenant.service_status}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="mt-3 text-sm text-[var(--tcdx-color-text-secondary)]">Cargando empresas autorizadas…</p>}
      {error && <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
      {!loading && !error && selectedTenant && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          Operando sobre <strong>{selectedTenant.tenant_name}</strong>. El recálculo, los snapshots, la explicación y el lineage quedarán aislados en este tenant.
        </div>
      )}
      {!loading && !error && !selectedTenantId && (
        <div role="alert" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Selecciona una empresa antes de consultar o recalcular métricas oficiales.
        </div>
      )}
    </section>
  );
}
