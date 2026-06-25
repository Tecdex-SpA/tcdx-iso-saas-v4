'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

const ui = {
  es: {
    tenantRequired:
      'Prefacturación requiere un tenant seleccionado. Ingresa como administrador de empresa, dealer o superadmin.',
    dealerLoadError: 'No fue posible cargar clientes asignados al dealer.',
    dealerNoClients: 'No tienes clientes asignados para consultar prefacturación.',
    tenantsLoadError: 'No fue posible cargar empresas para prefacturación.',
    tenantsEmpty: 'No hay empresas disponibles para prefacturación.',
    preinvoiceLoadError: 'Error obteniendo prefacturación',
    preinvoiceSaveError: 'Error guardando prefacturación',
    preinvoiceSaved: 'Prefacturación guardada correctamente',
    badge: 'Administración SaaS',
    title: 'Prefacturación mensual',
    subtitle:
      'Referencia comercial mensual del tenant. El modelo no cobra por usuarios: considera base SaaS, normas activas, módulos activos y consumo IA adicional.',
    calculating: 'Calculando...',
    recalculate: 'Recalcular',
    savePreinvoice: 'Guardar prefacturación',
    plan: 'Plan',
    activeStandards: 'Normas activas',
    activeModules: 'Módulos activos',
    totalUf: 'Total UF',
    detail: 'Detalle referencial',
    baseMonthly: 'Base mensual SaaS',
    aiExtra: 'Consumo IA adicional',
    estimatedTotal: 'Total estimado',
  },
  en: {
    tenantRequired:
      'Pre-invoicing requires a selected tenant. Sign in as a company administrator, dealer, or superadmin.',
    dealerLoadError: 'Assigned dealer clients could not be loaded.',
    dealerNoClients: 'You do not have assigned clients available for pre-invoicing review.',
    tenantsLoadError: 'Companies for pre-invoicing could not be loaded.',
    tenantsEmpty: 'There are no companies available for pre-invoicing.',
    preinvoiceLoadError: 'Error loading pre-invoicing data',
    preinvoiceSaveError: 'Error saving pre-invoicing data',
    preinvoiceSaved: 'Pre-invoicing saved successfully',
    badge: 'SaaS Administration',
    title: 'Monthly pre-invoicing',
    subtitle:
      'Monthly commercial reference for the tenant. The model does not charge per user: it considers the SaaS base, active standards, active modules, and additional AI usage.',
    calculating: 'Calculating...',
    recalculate: 'Recalculate',
    savePreinvoice: 'Save pre-invoicing',
    plan: 'Plan',
    activeStandards: 'Active standards',
    activeModules: 'Active modules',
    totalUf: 'Total UF',
    detail: 'Reference detail',
    baseMonthly: 'Monthly SaaS base',
    aiExtra: 'Additional AI usage',
    estimatedTotal: 'Estimated total',
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  const record = isRecord(payload) ? payload : {};
  return String(record.error || fallback);
}

function resolveTenantId(user: unknown) {
  const record = isRecord(user) ? user : {};
  return String(record.tenant_id || record.tenantId || record.tenant || '');
}

function resolveRole(user: unknown) {
  const record = isRecord(user) ? user : {};
  return String(record.role || record.user_role || record.userRole || '').toLowerCase();
}

type DealerTenant = {
  tenant_id: string;
  tenant_name?: string;
};

type TenantOption = {
  tenant_id: string;
  tenant_name?: string;
};

type PreinvoiceData = {
  amounts?: Record<string, string | number | null | undefined>;
  usage?: Record<string, string | number | null | undefined>;
  settings?: Record<string, string | number | null | undefined>;
  commercial_note?: string | null;
};

function isPlatformRole(role: string) {
  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(role);
}

function translateCommercialNote(value: unknown, lang: 'es' | 'en') {
  const text = String(value || '').trim();
  if (!text || lang !== 'en') return text;

  const dictionary: Record<string, string> = {
    'referencia comercial mensual': 'Monthly commercial reference',
    'no constituye factura': 'does not constitute an invoice',
    'no incluye impuestos': 'does not include taxes',
    'consumo ia adicional': 'additional AI usage',
    'usuarios no se cobran': 'users are not billed',
  };

  let translated = text;
  Object.entries(dictionary).forEach(([source, target]) => {
    translated = translated.replace(new RegExp(source, 'gi'), target);
  });

  return translated;
}

export default function PrefacturacionPage() {
  const { locale } = useTranslation();
  const lang = locale === 'en' ? 'en' : 'es';
  const copy = ui[lang];

  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState('');
  const [dealerTenants, setDealerTenants] = useState<DealerTenant[]>([]);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<PreinvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();
    const tid = resolveTenantId(u);
    const role = resolveRole(u);

    if (!t) {
      window.location.href = '/login';
      return;
    }

    setToken(t);
    setTenantId(tid);
    setRole(role);

    if (!tid && role !== 'dealer' && !isPlatformRole(role)) {
      setMessage(copy.tenantRequired);
    }
  }, [copy.tenantRequired]);

  useEffect(() => {
    const loadDealerTenants = async () => {
      if (!token || role !== 'dealer') return;

      try {
        const res = await fetch(`${API_URL}/api/admin-saas/dealer/my-tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json: unknown = await res.json();

        if (!res.ok || (isRecord(json) && json.ok === false)) {
          setMessage(getApiErrorMessage(json, copy.dealerLoadError));
          return;
        }

        const dealerData = isRecord(json) ? json.data : [];
        const rows: DealerTenant[] = Array.isArray(dealerData) ? dealerData as DealerTenant[] : [];
        setDealerTenants(rows);

        if (!tenantId && rows.length > 0) {
          setTenantId(rows[0].tenant_id);
        }

        if (rows.length === 0) {
          setMessage(copy.dealerNoClients);
        } else {
          setMessage('');
        }
      } catch {
        setMessage(copy.dealerLoadError);
      }
    };

    void loadDealerTenants();
  }, [token, role, tenantId, copy.dealerLoadError, copy.dealerNoClients]);

  useEffect(() => {
    const loadPlatformTenants = async () => {
      if (!token || !isPlatformRole(role)) return;

      try {
        const res = await fetch(`${API_URL}/api/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json: unknown = await res.json();

        if (!res.ok || !Array.isArray(json)) {
          setMessage(copy.tenantsLoadError);
          return;
        }

        const rows: TenantOption[] = json.map((tenant) => {
          const record = isRecord(tenant) ? tenant : {};
          return {
            tenant_id: String(record.id || record.tenant_id || ''),
            tenant_name: record.name || record.tenant_name
              ? String(record.name || record.tenant_name)
              : undefined,
          };
        }).filter((tenant) => tenant.tenant_id);

        setTenantOptions(rows);

        if (!tenantId && rows.length > 0) {
          setTenantId(rows[0].tenant_id);
        }

        if (rows.length === 0) {
          setMessage(copy.tenantsEmpty);
        } else {
          setMessage('');
        }
      } catch {
        setMessage(copy.tenantsLoadError);
      }
    };

    void loadPlatformTenants();
  }, [token, role, tenantId, copy.tenantsLoadError, copy.tenantsEmpty]);

  const load = async () => {
    if (!token || !tenantId) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/billing/preinvoice/${tenantId}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json: unknown = await res.json();

      if (!res.ok || (isRecord(json) && json.ok === false)) {
        alert(getApiErrorMessage(json, copy.preinvoiceLoadError));
        return;
      }

      const preinvoiceData = isRecord(json) && isRecord(json.data) ? json.data as PreinvoiceData : null;
      setData(preinvoiceData);
    } finally {
      setLoading(false);
    }
  };

  const materialize = async () => {
    if (!token || !tenantId) return;

    const res = await fetch(`${API_URL}/api/billing/preinvoice/${tenantId}/materialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ period }),
    });

    const json: unknown = await res.json();

    if (!res.ok || (isRecord(json) && json.ok === false)) {
      alert(getApiErrorMessage(json, copy.preinvoiceSaveError));
      return;
    }

    alert(copy.preinvoiceSaved);
    setData(isRecord(json) && isRecord(json.preinvoice) ? json.preinvoice as PreinvoiceData : null);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, period]);

  const amounts = data?.amounts || {};
  const usage = data?.usage || {};
  const settings = data?.settings || {};

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-[34px] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
            {copy.badge}
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            {copy.title}
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            {copy.subtitle}
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            {role === 'dealer' && dealerTenants.length > 0 && (
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {dealerTenants.map((tenant) => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {tenant.tenant_name || tenant.tenant_id}
                  </option>
                ))}
              </select>
            )}

            {isPlatformRole(role) && tenantOptions.length > 0 && (
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {tenantOptions.map((tenant) => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {tenant.tenant_name || tenant.tenant_id}
                  </option>
                ))}
              </select>
            )}

            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />

            <button
              onClick={load}
              disabled={loading}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {loading ? copy.calculating : copy.recalculate}
            </button>

            <button
              onClick={materialize}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            >
              {copy.savePreinvoice}
            </button>
          </div>
        </section>

        {data && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Metric label={copy.plan} value={settings.plan_code || '-'} />
              <Metric label={copy.activeStandards} value={usage.active_standards_count || 0} />
              <Metric label={copy.activeModules} value={usage.active_modules_count || 0} />
              <Metric label={copy.totalUf} value={amounts.total_uf || 0} />
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{copy.detail}</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    <Row label={copy.baseMonthly} value={`${amounts.base_monthly_uf || 0} UF`} />
                    <Row label={copy.activeStandards} value={`${amounts.standards_uf || 0} UF`} />
                    <Row label={copy.activeModules} value={`${amounts.modules_uf || 0} UF`} />
                    <Row label={copy.aiExtra} value={`${amounts.ai_extra_uf || 0} UF`} />
                    <Row label={copy.estimatedTotal} value={`${amounts.total_uf || 0} UF`} strong />
                  </tbody>
                </table>
              </div>

              <p className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                {translateCommercialNote(data.commercial_note, lang)}
              </p>
            </section>
          </>
        )}

        {!data && message && (
          <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
            {message}
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className="border-b">
      <td className="px-3 py-3 text-slate-600">{label}</td>
      <td className={`px-3 py-3 text-right ${strong ? 'text-xl font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
        {value}
      </td>
    </tr>
  );
}
