'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

function resolveRole(user: any) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

type DealerTenant = {
  tenant_id: string;
  tenant_name?: string;
};

export default function PrefacturacionPage() {
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState('');
  const [dealerTenants, setDealerTenants] = useState<DealerTenant[]>([]);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
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

    if (!tid && role !== 'dealer') {
      setMessage(
        'Prefacturación requiere un tenant seleccionado. Ingresa como administrador de empresa o dealer con acceso asignado.'
      );
    }
  }, []);

  useEffect(() => {
    const loadDealerTenants = async () => {
      if (!token || role !== 'dealer') return;

      try {
        const res = await fetch(`${API_URL}/api/admin-saas/dealer/my-tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          setMessage(json?.error || 'No fue posible cargar clientes asignados al dealer.');
          return;
        }

        const rows: DealerTenant[] = json?.data || [];
        setDealerTenants(rows);

        if (!tenantId && rows.length > 0) {
          setTenantId(rows[0].tenant_id);
        }

        if (rows.length === 0) {
          setMessage('No tienes clientes asignados para consultar prefacturación.');
        } else {
          setMessage('');
        }
      } catch {
        setMessage('No fue posible cargar clientes asignados al dealer.');
      }
    };

    void loadDealerTenants();
  }, [token, role, tenantId]);

  const load = async () => {
    if (!token || !tenantId) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/billing/preinvoice/${tenantId}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json.error || 'Error obteniendo prefacturación');
        return;
      }

      setData(json.data);
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

    const json = await res.json();

    if (!res.ok || json?.ok === false) {
      alert(json.error || 'Error guardando prefacturación');
      return;
    }

    alert('Prefacturación guardada correctamente');
    setData(json.preinvoice);
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
            Administración SaaS
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            Prefacturación mensual
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Referencia comercial mensual del tenant. El modelo no cobra por usuarios:
            considera base SaaS, normas activas, módulos activos y consumo IA adicional.
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
              {loading ? 'Calculando...' : 'Recalcular'}
            </button>

            <button
              onClick={materialize}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Guardar prefacturación
            </button>
          </div>
        </section>

        {data && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Metric label="Plan" value={settings.plan_code || '-'} />
              <Metric label="Normas activas" value={usage.active_standards_count || 0} />
              <Metric label="Módulos activos" value={usage.active_modules_count || 0} />
              <Metric label="Total UF" value={amounts.total_uf || 0} />
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Detalle referencial</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    <Row label="Base mensual SaaS" value={`${amounts.base_monthly_uf || 0} UF`} />
                    <Row label="Normas activas" value={`${amounts.standards_uf || 0} UF`} />
                    <Row label="Módulos activos" value={`${amounts.modules_uf || 0} UF`} />
                    <Row label="Consumo IA adicional" value={`${amounts.ai_extra_uf || 0} UF`} />
                    <Row label="Total estimado" value={`${amounts.total_uf || 0} UF`} strong />
                  </tbody>
                </table>
              </div>

              <p className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                {data.commercial_note}
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

function Metric({ label, value }: { label: string; value: any }) {
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
