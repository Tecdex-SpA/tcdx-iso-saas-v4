'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type QuoteLine = {
  line_type: string;
  line_key: string;
  line_name: string;
  line_description?: string;
  quantity: number;
  unit_price: number;
  subtotal_amount: number;
  is_billable: boolean;
};

type QuoteCalculation = {
  currency: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_monthly_amount: number;
  lines: QuoteLine[];
};

type SavedQuote = {
  id: string;
  tenant_id?: string | null;
  quote_number: string;
  prospect_name: string;
  prospect_rut?: string;
  prospect_email?: string;
  status: string;
  plan_key: string;
  active_standards_count: number;
  premium_modules_count: number;
  external_lookup_quota: number;
  total_monthly_amount: number;
  created_at?: string;
};

function money(value: any) {
  const n = Number(value || 0);

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CotizadorPage() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<any>(null);

  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [calculation, setCalculation] = useState<QuoteCalculation | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const [form, setForm] = useState({
    prospect_name: '',
    prospect_rut: '',
    prospect_email: '',
    prospect_phone: '',
    plan_key: 'pyme',
    active_standards_count: '1',
    premium_modules_count: '0',
    external_lookup_quota: '25',
    discount_amount: '0',
    validity_days: '15',
    notes: '',
    crm_reference: '',
  });

  const role = String(user?.role || '').toLowerCase();
  const canUse = role === 'superadmin' || role === 'dealer';

  const quotePayload = useMemo(() => {
    return {
      ...form,
      active_standards_count: Number(form.active_standards_count || 0),
      premium_modules_count: Number(form.premium_modules_count || 0),
      external_lookup_quota: Number(form.external_lookup_quota || 0),
      discount_amount: Number(form.discount_amount || 0),
      validity_days: Number(form.validity_days || 15),
    };
  }, [form]);

  async function fetchJson(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || `Error HTTP ${res.status}`);
    }

    return json;
  }

  async function loadQuotes() {
    const json = await fetchJson('/api/quotes');
    setQuotes(json.data || []);
  }

  async function calculateQuote() {
    const json = await fetchJson('/api/quotes/calculate', {
      method: 'POST',
      body: JSON.stringify(quotePayload),
    });

    setCalculation(json.data || null);
  }

  async function saveQuote() {
    if (!form.prospect_name.trim()) {
      alert('Ingresa el nombre del prospecto o empresa.');
      return;
    }

    try {
      setSaving('quote');

      const json = await fetchJson('/api/quotes', {
        method: 'POST',
        body: JSON.stringify(quotePayload),
      });

      await loadQuotes();

      setForm((prev) => ({
        ...prev,
        prospect_name: '',
        prospect_rut: '',
        prospect_email: '',
        prospect_phone: '',
        notes: '',
        crm_reference: '',
      }));

      setCalculation(null);

      alert(`Cotización guardada: ${json.data?.quote_number || ''}`);
    } catch (err: any) {
      alert(err.message || 'Error guardando cotización');
    } finally {
      setSaving('');
    }
  }


  async function convertQuoteToTenant(quote: SavedQuote) {
    if (role !== 'superadmin') {
      alert('Solo superadmin puede convertir cotizaciones en empresa/contrato.');
      return;
    }

    let conversionMode: 'create_new' | 'use_existing' = 'create_new';

    if (quote.tenant_id) {
      const useExisting = window.confirm(
        `La cotización ${quote.quote_number} ya tiene una empresa asociada.\n\n` +
          `Aceptar = usar empresa existente.\n` +
          `Cancelar = intentar crear empresa nueva desde la cotización.`
      );

      conversionMode = useExisting ? 'use_existing' : 'create_new';
    } else {
      const createNew = window.confirm(
        `Convertir la cotización ${quote.quote_number} creando una empresa nueva?\n\n` +
          `Prospecto: ${quote.prospect_name}\n` +
          `Plan: ${quote.plan_key}\n` +
          `Total mensual: ${money(quote.total_monthly_amount)}`
      );

      if (!createNew) return;

      conversionMode = 'create_new';
    }

    const ok = window.confirm(
      `Confirmar conversión\n\n` +
        `Modo: ${conversionMode === 'use_existing' ? 'usar empresa existente' : 'crear empresa nueva'}\n` +
        `Cotización: ${quote.quote_number}\n` +
        `Prospecto: ${quote.prospect_name}\n` +
        `Plan: ${quote.plan_key}\n` +
        `Total mensual: ${money(quote.total_monthly_amount)}`
    );

    if (!ok) return;

    try {
      setSaving(`convert-${quote.id}`);

      const now = new Date();
      const startedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      await fetchJson(`/api/quotes/${quote.id}/convert-to-tenant`, {
        method: 'POST',
        body: JSON.stringify({
          conversion_mode: conversionMode,
          tenant_id: conversionMode === 'use_existing' ? quote.tenant_id : null,
          started_at: startedAt,
          ends_at: '',
        }),
      });

      await loadQuotes();

      alert('Cotización convertida correctamente en empresa/contrato SaaS.');
    } catch (err: any) {
      alert(err.message || 'Error convirtiendo cotización');
    } finally {
      setSaving('');
    }
  }


  async function updateQuoteStatus(id: string, status: string) {
    try {
      setSaving(id);

      await fetchJson(`/api/quotes/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      await loadQuotes();
    } catch (err: any) {
      alert(err.message || 'Error actualizando estado');
    } finally {
      setSaving('');
    }
  }

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();

    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    if (!token || !canUse) {
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        await loadQuotes();
        await calculateQuote();
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canUse]);

  useEffect(() => {
    if (!token || !canUse) return;

    const timer = setTimeout(() => {
      void calculateQuote();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    canUse,
    form.plan_key,
    form.active_standards_count,
    form.premium_modules_count,
    form.external_lookup_quota,
    form.discount_amount,
  ]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Cargando cotizador...</div>
      </AppLayout>
    );
  }

  if (!canUse) {
    return (
      <AppLayout>
        <div className="p-6">No autorizado. Esta vista es solo para superusuario y dealer.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="rounded-2xl bg-[#1b2733] p-6 text-white shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-200">
            Cotizador SaaS
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            Cotizador comercial TCDX
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-200">
            Genera estimaciones mensuales para pymes y clientes B2B usando planes,
            normas activas, módulos premium y cuotas IA. Los usuarios no se cobran.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Datos de la cotización</h2>
            <p className="mt-1 text-sm text-slate-500">
              Completa el escenario comercial. El cálculo se actualiza automáticamente.
            </p>

            <div className="mt-5 space-y-3">
              <input
                value={form.prospect_name}
                onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
                placeholder="Empresa / prospecto"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                value={form.prospect_rut}
                onChange={(e) => setForm({ ...form, prospect_rut: e.target.value })}
                placeholder="RUT"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                value={form.prospect_email}
                onChange={(e) => setForm({ ...form, prospect_email: e.target.value })}
                placeholder="Email contacto"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <select
                value={form.plan_key}
                onChange={(e) => setForm({ ...form, plan_key: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="demo">Demo</option>
                <option value="pyme">Pyme</option>
                <option value="empresa">Empresa</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                    Normas
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.active_standards_count}
                    onChange={(e) =>
                      setForm({ ...form, active_standards_count: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                    Módulos premium
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.premium_modules_count}
                    onChange={(e) =>
                      setForm({ ...form, premium_modules_count: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                    Cuota IA incluida
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.external_lookup_quota}
                    onChange={(e) =>
                      setForm({ ...form, external_lookup_quota: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                    Descuento
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.discount_amount}
                    onChange={(e) =>
                      setForm({ ...form, discount_amount: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <input
                value={form.crm_reference}
                onChange={(e) => setForm({ ...form, crm_reference: e.target.value })}
                placeholder="Referencia CRM futura"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas comerciales"
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={saveQuote}
                disabled={saving === 'quote'}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving === 'quote' ? 'Guardando...' : 'Guardar cotización'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Resultado estimado</h2>
                  <p className="text-sm text-slate-500">
                    Total mensual referencial. No incluye factura legal.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase text-slate-400">Total mensual</div>
                  <div className="text-3xl font-bold text-blue-700">
                    {money(calculation?.total_monthly_amount || 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Subtotal</div>
                  <div className="font-bold text-slate-900">
                    {money(calculation?.subtotal_amount || 0)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Descuento</div>
                  <div className="font-bold text-slate-900">
                    {money(calculation?.discount_amount || 0)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Usuarios</div>
                  <div className="font-bold text-slate-900">Ilimitados</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-3 pr-4">Concepto</th>
                      <th className="py-3 pr-4">Cantidad</th>
                      <th className="py-3 pr-4">Precio unitario</th>
                      <th className="py-3 pr-4">Subtotal</th>
                      <th className="py-3 pr-4">Tipo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(calculation?.lines || []).map((line) => (
                      <tr key={`${line.line_type}-${line.line_key}`} className="border-b border-slate-100">
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-slate-900">{line.line_name}</div>
                          <div className="text-xs text-slate-500">{line.line_description}</div>
                        </td>
                        <td className="py-4 pr-4">{line.quantity}</td>
                        <td className="py-4 pr-4">{money(line.unit_price)}</td>
                        <td className="py-4 pr-4 font-bold">{money(line.subtotal_amount)}</td>
                        <td className="py-4 pr-4">
                          {line.is_billable ? 'Facturable' : 'Informativa'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Cotizaciones guardadas</h2>
                  <p className="text-sm text-slate-500">
                    {role === 'dealer'
                      ? 'Solo ves tus cotizaciones.'
                      : 'Superusuario ve todas las cotizaciones.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadQuotes}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Refrescar
                </button>
              </div>

              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div key={quote.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-bold text-slate-900">
                          {quote.quote_number} · {quote.prospect_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Plan {quote.plan_key} · {quote.active_standards_count} normas ·{' '}
                          {quote.premium_modules_count} módulos · {quote.status}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-blue-700">
                          {money(quote.total_monthly_amount)}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                          <select
                            value={quote.status}
                            onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                            disabled={saving === quote.id}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          >
                            <option value="draft">Borrador</option>
                            <option value="sent">Enviada</option>
                            <option value="accepted">Aceptada</option>
                            <option value="rejected">Rechazada</option>
                            <option value="expired">Expirada</option>
                          </select>

                          {role === 'superadmin' && (
                            <button
                              type="button"
                              onClick={() => convertQuoteToTenant(quote)}
                              disabled={saving === `convert-${quote.id}` || quote.status === 'accepted'}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {saving === `convert-${quote.id}`
                                ? 'Convirtiendo...'
                                : quote.status === 'accepted'
                                  ? 'Ya convertida / aceptada'
                                  : 'Convertir en empresa'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {quotes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    No hay cotizaciones guardadas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
