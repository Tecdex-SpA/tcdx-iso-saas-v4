'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserFromToken } from '@/utils/auth';
import { translateStatusLabel } from '@/i18n/displayText';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

const ui = {
  es: {
    loading: 'Cargando cotizador...',
    unauthorized: 'No autorizado. Esta vista es solo para superusuario y dealer.',
    badge: 'Cotizador SaaS',
    title: 'Cotizador comercial TCDX',
    subtitle:
      'Genera estimaciones mensuales para pymes y clientes B2B usando planes, normas activas, módulos premium y cuotas IA. Los usuarios no se cobran.',
    quoteData: 'Datos de la cotización',
    quoteHelp: 'Completa el escenario comercial. El cálculo se actualiza automáticamente.',
    prospectName: 'Empresa / prospecto',
    rut: 'RUT',
    contactEmail: 'Email contacto',
    activeStandards: 'Normas',
    premiumModules: 'Módulos premium',
    aiQuota: 'Cuota IA incluida',
    discount: 'Descuento',
    crmReference: 'Referencia CRM futura',
    commercialNotes: 'Notas comerciales',
    saveQuote: 'Guardar cotización',
    saving: 'Guardando...',
    estimatedResult: 'Resultado estimado',
    estimatedHelp: 'Total mensual referencial. No incluye factura legal.',
    totalMonthly: 'Total mensual',
    subtotal: 'Subtotal',
    users: 'Usuarios',
    unlimited: 'Ilimitados',
    concept: 'Concepto',
    quantity: 'Cantidad',
    unitPrice: 'Precio unitario',
    type: 'Tipo',
    billable: 'Facturable',
    informative: 'Informativa',
    savedQuotes: 'Cotizaciones guardadas',
    dealerListHelp: 'Solo ves tus cotizaciones.',
    superadminListHelp: 'Superusuario ve todas las cotizaciones.',
    refresh: 'Refrescar',
    plan: 'Plan',
    standardsShort: 'normas',
    modulesShort: 'módulos',
    quoteRequired: 'Ingresa el nombre del prospecto o empresa.',
    quoteSaved: (quoteNumber: string) => `Cotización guardada: ${quoteNumber}`,
    quoteSaveError: 'Error guardando cotización',
    onlySuperadminConvert: 'Solo superadmin puede convertir cotizaciones en empresa/contrato.',
    associatedCompanyConfirm: (quoteNumber: string) =>
      `La cotización ${quoteNumber} ya tiene una empresa asociada.\n\nAceptar = usar empresa existente.\nCancelar = intentar crear empresa nueva desde la cotización.`,
    createCompanyConfirm: (quote: SavedQuote, amount: string) =>
      `Convertir la cotización ${quote.quote_number} creando una empresa nueva?\n\nProspecto: ${quote.prospect_name}\nPlan: ${quote.plan_key}\nTotal mensual: ${amount}`,
    finalConvertConfirm: (mode: string, quote: SavedQuote, amount: string) =>
      `Confirmar conversión\n\nModo: ${mode}\nCotización: ${quote.quote_number}\nProspecto: ${quote.prospect_name}\nPlan: ${quote.plan_key}\nTotal mensual: ${amount}`,
    useExistingCompany: 'usar empresa existente',
    createNewCompany: 'crear empresa nueva',
    convertSuccess: 'Cotización convertida correctamente en empresa/contrato SaaS.',
    convertError: 'Error convirtiendo cotización',
    updateStatusError: 'Error actualizando estado',
    draft: 'Borrador',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    expired: 'Expirada',
    converting: 'Convirtiendo...',
    alreadyConverted: 'Ya convertida / aceptada',
    convertToCompany: 'Convertir en empresa',
    noQuotes: 'No hay cotizaciones guardadas.',
  },
  en: {
    loading: 'Loading quote builder...',
    unauthorized: 'Unauthorized. This view is only for superuser and dealer roles.',
    badge: 'SaaS Quote Builder',
    title: 'TCDX Commercial Quote Builder',
    subtitle:
      'Generate monthly estimates for SMBs and B2B clients using plans, active standards, premium modules, and AI quotas. Users are not billed.',
    quoteData: 'Quote details',
    quoteHelp: 'Complete the commercial scenario. The calculation updates automatically.',
    prospectName: 'Company / prospect',
    rut: 'Tax ID',
    contactEmail: 'Contact email',
    activeStandards: 'Standards',
    premiumModules: 'Premium modules',
    aiQuota: 'Included AI quota',
    discount: 'Discount',
    crmReference: 'Future CRM reference',
    commercialNotes: 'Commercial notes',
    saveQuote: 'Save quote',
    saving: 'Saving...',
    estimatedResult: 'Estimated result',
    estimatedHelp: 'Reference monthly total. It does not include a legal invoice.',
    totalMonthly: 'Monthly total',
    subtotal: 'Subtotal',
    users: 'Users',
    unlimited: 'Unlimited',
    concept: 'Concept',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    type: 'Type',
    billable: 'Billable',
    informative: 'Informational',
    savedQuotes: 'Saved quotes',
    dealerListHelp: 'You only see your quotes.',
    superadminListHelp: 'Superuser sees all quotes.',
    refresh: 'Refresh',
    plan: 'Plan',
    standardsShort: 'standards',
    modulesShort: 'modules',
    quoteRequired: 'Enter the prospect or company name.',
    quoteSaved: (quoteNumber: string) => `Quote saved: ${quoteNumber}`,
    quoteSaveError: 'Error saving quote',
    onlySuperadminConvert: 'Only superadmin can convert quotes into a company/contract.',
    associatedCompanyConfirm: (quoteNumber: string) =>
      `Quote ${quoteNumber} already has an associated company.\n\nAccept = use existing company.\nCancel = try to create a new company from the quote.`,
    createCompanyConfirm: (quote: SavedQuote, amount: string) =>
      `Convert quote ${quote.quote_number} by creating a new company?\n\nProspect: ${quote.prospect_name}\nPlan: ${quote.plan_key}\nMonthly total: ${amount}`,
    finalConvertConfirm: (mode: string, quote: SavedQuote, amount: string) =>
      `Confirm conversion\n\nMode: ${mode}\nQuote: ${quote.quote_number}\nProspect: ${quote.prospect_name}\nPlan: ${quote.plan_key}\nMonthly total: ${amount}`,
    useExistingCompany: 'use existing company',
    createNewCompany: 'create new company',
    convertSuccess: 'Quote successfully converted into a SaaS company/contract.',
    convertError: 'Error converting quote',
    updateStatusError: 'Error updating status',
    draft: 'Draft',
    sent: 'Sent',
    accepted: 'Accepted',
    rejected: 'Rejected',
    expired: 'Expired',
    converting: 'Converting...',
    alreadyConverted: 'Already converted / accepted',
    convertToCompany: 'Convert to company',
    noQuotes: 'No saved quotes.',
  },
} as const;

function money(value: any, locale = 'es') {
  const n = Number(value || 0);

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n);
}

function translateLineText(value: string | undefined, locale: 'es' | 'en') {
  const original = String(value || '').trim();
  if (!original || locale !== 'en') return original;

  const dictionary: Record<string, string> = {
    demo: 'Demo',
    pyme: 'SMB',
    empresa: 'Company',
    enterprise: 'Enterprise',
    'plan base': 'Base plan',
    'normas activas': 'Active standards',
    'módulos premium': 'Premium modules',
    'modulos premium': 'Premium modules',
    'cuota ia': 'AI quota',
    descuento: 'Discount',
  };

  return dictionary[original.toLowerCase()] || original;
}

export default function CotizadorPage() {
  const { locale } = useTranslation();
  const lang = locale === 'en' ? 'en' : 'es';
  const copy = ui[lang];

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
      throw new Error(json?.error || `HTTP error ${res.status}`);
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
      alert(copy.quoteRequired);
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

      alert(copy.quoteSaved(json.data?.quote_number || ''));
    } catch (err: any) {
      alert(err.message || copy.quoteSaveError);
    } finally {
      setSaving('');
    }
  }

  async function convertQuoteToTenant(quote: SavedQuote) {
    if (role !== 'superadmin') {
      alert(copy.onlySuperadminConvert);
      return;
    }

    let conversionMode: 'create_new' | 'use_existing' = 'create_new';

    if (quote.tenant_id) {
      const useExisting = window.confirm(copy.associatedCompanyConfirm(quote.quote_number));

      conversionMode = useExisting ? 'use_existing' : 'create_new';
    } else {
      const createNew = window.confirm(
        copy.createCompanyConfirm(quote, money(quote.total_monthly_amount, lang))
      );

      if (!createNew) return;

      conversionMode = 'create_new';
    }

    const ok = window.confirm(
      copy.finalConvertConfirm(
        conversionMode === 'use_existing' ? copy.useExistingCompany : copy.createNewCompany,
        quote,
        money(quote.total_monthly_amount, lang)
      )
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

      alert(copy.convertSuccess);
    } catch (err: any) {
      alert(err.message || copy.convertError);
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
      alert(err.message || copy.updateStatusError);
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
        <div className="p-6">{copy.loading}</div>
      </AppLayout>
    );
  }

  if (!canUse) {
    return (
      <AppLayout>
        <div className="p-6">{copy.unauthorized}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="rounded-2xl bg-[#1b2733] p-6 text-white shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-200">
            {copy.badge}
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-200">
            {copy.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">{copy.quoteData}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {copy.quoteHelp}
            </p>

            <div className="mt-5 space-y-3">
              <input
                value={form.prospect_name}
                onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
                placeholder={copy.prospectName}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                value={form.prospect_rut}
                onChange={(e) => setForm({ ...form, prospect_rut: e.target.value })}
                placeholder={copy.rut}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                value={form.prospect_email}
                onChange={(e) => setForm({ ...form, prospect_email: e.target.value })}
                placeholder={copy.contactEmail}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <select
                value={form.plan_key}
                onChange={(e) => setForm({ ...form, plan_key: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="demo">Demo</option>
                <option value="pyme">{lang === 'en' ? 'SMB' : 'Pyme'}</option>
                <option value="empresa">{lang === 'en' ? 'Company' : 'Empresa'}</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-400">
                    {copy.activeStandards}
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
                    {copy.premiumModules}
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
                    {copy.aiQuota}
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
                    {copy.discount}
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
                placeholder={copy.crmReference}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={copy.commercialNotes}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={saveQuote}
                disabled={saving === 'quote'}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving === 'quote' ? copy.saving : copy.saveQuote}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{copy.estimatedResult}</h2>
                  <p className="text-sm text-slate-500">
                    {copy.estimatedHelp}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase text-slate-400">{copy.totalMonthly}</div>
                  <div className="text-3xl font-bold text-blue-700">
                    {money(calculation?.total_monthly_amount || 0, lang)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{copy.subtotal}</div>
                  <div className="font-bold text-slate-900">
                    {money(calculation?.subtotal_amount || 0, lang)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{copy.discount}</div>
                  <div className="font-bold text-slate-900">
                    {money(calculation?.discount_amount || 0, lang)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{copy.users}</div>
                  <div className="font-bold text-slate-900">{copy.unlimited}</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-3 pr-4">{copy.concept}</th>
                      <th className="py-3 pr-4">{copy.quantity}</th>
                      <th className="py-3 pr-4">{copy.unitPrice}</th>
                      <th className="py-3 pr-4">{copy.subtotal}</th>
                      <th className="py-3 pr-4">{copy.type}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(calculation?.lines || []).map((line) => (
                      <tr key={`${line.line_type}-${line.line_key}`} className="border-b border-slate-100">
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-slate-900">{translateLineText(line.line_name, lang)}</div>
                          <div className="text-xs text-slate-500">{translateLineText(line.line_description, lang)}</div>
                        </td>
                        <td className="py-4 pr-4">{line.quantity}</td>
                        <td className="py-4 pr-4">{money(line.unit_price, lang)}</td>
                        <td className="py-4 pr-4 font-bold">{money(line.subtotal_amount, lang)}</td>
                        <td className="py-4 pr-4">
                          {line.is_billable ? copy.billable : copy.informative}
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
                  <h2 className="text-lg font-bold text-slate-900">{copy.savedQuotes}</h2>
                  <p className="text-sm text-slate-500">
                    {role === 'dealer' ? copy.dealerListHelp : copy.superadminListHelp}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadQuotes}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copy.refresh}
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
                          {copy.plan} {translateLineText(quote.plan_key, lang)} · {quote.active_standards_count} {copy.standardsShort} ·{' '}
                          {quote.premium_modules_count} {copy.modulesShort} · {translateLineText(quote.status, lang)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-blue-700">
                          {money(quote.total_monthly_amount, lang)}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                          <select
                            value={translateStatusLabel(quote.status, locale)}
                            onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                            disabled={saving === quote.id}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          >
                            <option value="draft">{copy.draft}</option>
                            <option value="sent">{copy.sent}</option>
                            <option value="accepted">{copy.accepted}</option>
                            <option value="rejected">{copy.rejected}</option>
                            <option value="expired">{copy.expired}</option>
                          </select>

                          {role === 'superadmin' && (
                            <button
                              type="button"
                              onClick={() => convertQuoteToTenant(quote)}
                              disabled={saving === `convert-${quote.id}` || quote.status === 'accepted'}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {saving === `convert-${quote.id}`
                                ? copy.converting
                                : quote.status === 'accepted'
                                  ? copy.alreadyConverted
                                  : copy.convertToCompany}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {quotes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    {copy.noQuotes}
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
