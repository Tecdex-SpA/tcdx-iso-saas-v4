'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type DealerTenant = {
  id?: string;
  dealer_user_id: string;
  dealer_name?: string;
  dealer_email?: string;
  tenant_id: string;
  tenant_name: string;
  relationship_type?: string;
  can_view_health?: boolean;
  can_view_contract?: boolean;
  can_request_changes?: boolean;
  can_view_sensitive_evidence?: boolean;
  status?: string;
  assigned_at?: string;
  active_standards?: string;
  inactive_standards?: string;
  enabled_modules?: string;
  disabled_modules?: string;
  plan_key?: string;
  contract_status?: string;
  started_at?: string;
  ends_at?: string;
};

type DealerRequest = {
  id: string;
  dealer_user_id: string;
  dealer_email?: string;
  dealer_name?: string;
  tenant_id: string;
  tenant_name?: string;
  request_type: string;
  request_status: string;
  title: string;
  description?: string;
  requested_payload?: any;
  review_comment?: string;
  created_at?: string;
  reviewed_at?: string;
};

function formatDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value?: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeColor(value?: string) {
  const v = String(value || '').toLowerCase();

  if (['active', 'activo', 'approved', 'aprobada', 'aprobado'].includes(v)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['open', 'pending', 'pendiente', 'in_review'].includes(v)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (['rejected', 'rechazado', 'revoked', 'cancelled', 'inactive'].includes(v)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (['demo', 'trial'].includes(v)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function requestTypeLabel(value?: string) {
  const map: Record<string, string> = {
    activate_standard: 'Activar norma',
    deactivate_standard: 'Desactivar norma',
    enable_module: 'Habilitar módulo',
    disable_module: 'Deshabilitar módulo',
    commercial_upgrade: 'Upgrade comercial',
    support_request: 'Solicitud de soporte',
    other: 'Otra solicitud',
  };

  return map[String(value || '')] || value || 'Solicitud';
}

function SmallCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: any;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}

export default function DealerPortalPage() {
  const [token, setToken] = useState<string | null>(null);

  const [tenants, setTenants] = useState<DealerTenant[]>([]);
  const [requests, setRequests] = useState<DealerRequest[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    request_type: 'activate_standard',
    title: '',
    description: '',
    standard_code: '',
    module_key: '',
    notes: '',
  });

  const selectedTenant = useMemo(() => {
    return tenants.find((item) => item.tenant_id === selectedTenantId) || tenants[0];
  }, [tenants, selectedTenantId]);

  const openRequests = useMemo(() => {
    return requests.filter((item) =>
      ['open', 'in_review'].includes(String(item.request_status || '').toLowerCase())
    );
  }, [requests]);

  const approvedRequests = useMemo(() => {
    return requests.filter((item) =>
      ['approved', 'aprobada'].includes(String(item.request_status || '').toLowerCase())
    );
  }, [requests]);

  async function fetchJson(path: string, options: RequestInit = {}) {
    const authToken = token || localStorage.getItem('token') || '';

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await res.text();

    let json: any = null;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Respuesta inválida del backend en ${path}. HTTP ${res.status}.`);
    }

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || `Error backend en ${path}`);
    }

    return json;
  }

  async function loadPortal(authToken?: string) {
    const finalToken = authToken || token || localStorage.getItem('token') || '';

    if (!finalToken) {
      setError('Token no encontrado. Inicia sesión nuevamente.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [tenantsJson, requestsJson] = await Promise.all([
        fetch(`${API_URL}/api/admin-saas/dealer/my-tenants`, {
          headers: { Authorization: `Bearer ${finalToken}` },
        }),
        fetch(`${API_URL}/api/admin-saas/dealer/requests`, {
          headers: { Authorization: `Bearer ${finalToken}` },
        }),
      ]);

      const tenantsText = await tenantsJson.text();
      const requestsText = await requestsJson.text();

      const tenantsParsed = tenantsText ? JSON.parse(tenantsText) : {};
      const requestsParsed = requestsText ? JSON.parse(requestsText) : {};

      if (!tenantsJson.ok || tenantsParsed.ok === false) {
        throw new Error(tenantsParsed.error || 'Error cargando clientes asignados');
      }

      if (!requestsJson.ok || requestsParsed.ok === false) {
        throw new Error(requestsParsed.error || 'Error cargando solicitudes dealer');
      }

      const tenantRows: DealerTenant[] = tenantsParsed.data || [];
      const requestRows: DealerRequest[] = requestsParsed.data || [];

      setTenants(tenantRows);
      setRequests(requestRows);

      if (!selectedTenantId && tenantRows.length > 0) {
        setSelectedTenantId(tenantRows[0].tenant_id);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando Portal Dealer');
    } finally {
      setLoading(false);
    }
  }

  async function createRequest() {
    if (!selectedTenant?.tenant_id) {
      setError('Debes seleccionar un cliente.');
      return;
    }

    if (!selectedTenant.can_request_changes) {
      setError('No tienes permiso para generar solicitudes sobre este cliente.');
      return;
    }

    if (!form.title.trim()) {
      setError('El título de la solicitud es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const requestedPayload: any = {
        notes: form.notes || null,
        source: 'dealer_portal',
      };

      if (form.standard_code) {
        requestedPayload.standard_code = form.standard_code;
      }

      if (form.module_key) {
        requestedPayload.module_key = form.module_key;
      }

      await fetchJson('/api/admin-saas/dealer/requests', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: selectedTenant.tenant_id,
          request_type: form.request_type,
          title: form.title,
          description: form.description || null,
          requested_payload: requestedPayload,
        }),
      });

      setForm({
        request_type: 'activate_standard',
        title: '',
        description: '',
        standard_code: '',
        module_key: '',
        notes: '',
      });

      await loadPortal();
    } catch (err: any) {
      setError(err.message || 'Error creando solicitud dealer');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    setToken(authToken);

    loadPortal(authToken || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f7fb] p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Portal Dealer / Partner
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Consulta tus clientes asignados y genera solicitudes comerciales u operativas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadPortal()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Refrescar
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
            Cargando Portal Dealer...
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <SmallCard
                title="Clientes asignados"
                value={tenants.length}
                subtitle="Relaciones activas"
              />
              <SmallCard
                title="Solicitudes abiertas"
                value={openRequests.length}
                subtitle="Pendientes o en revisión"
              />
              <SmallCard
                title="Solicitudes aprobadas"
                value={approvedRequests.length}
                subtitle="Gestionadas por plataforma"
              />
              <SmallCard
                title="Cliente seleccionado"
                value={selectedTenant?.tenant_name || '-'}
                subtitle={selectedTenant?.contract_status || 'Sin contrato'}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-slate-900">
                    Mis clientes
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Empresas asignadas por la plataforma.
                  </p>
                </div>

                <div className="space-y-3">
                  {tenants.map((tenant) => {
                    const selected = tenant.tenant_id === selectedTenant?.tenant_id;

                    return (
                      <button
                        key={tenant.tenant_id}
                        type="button"
                        onClick={() => setSelectedTenantId(tenant.tenant_id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-slate-900">
                          {tenant.tenant_name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {tenant.relationship_type || 'commercial_partner'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${badgeColor(tenant.contract_status)}`}>
                            {tenant.contract_status || 'sin contrato'}
                          </span>

                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                            ISO activas: {tenant.active_standards || 0}
                          </span>

                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                            Módulos: {tenant.enabled_modules || 0}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {tenants.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      No tienes clientes asignados.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {selectedTenant ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            Cliente seleccionado
                          </p>

                          <h2 className="mt-1 text-2xl font-bold text-slate-900">
                            {selectedTenant.tenant_name}
                          </h2>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(selectedTenant.contract_status)}`}>
                              Contrato: {selectedTenant.contract_status || 'sin contrato'}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Plan: {selectedTenant.plan_key || 'N/A'}
                            </span>

                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Normas activas: {selectedTenant.active_standards || 0}
                            </span>

                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              Módulos activos: {selectedTenant.enabled_modules || 0}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          <div>
                            <b>Inicio:</b> {formatDate(selectedTenant.started_at)}
                          </div>
                          <div>
                            <b>Término:</b> {formatDate(selectedTenant.ends_at)}
                          </div>
                          <div>
                            <b>Asignado:</b> {formatDate(selectedTenant.assigned_at)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <SmallCard
                        title="Ver salud"
                        value={selectedTenant.can_view_health ? 'Sí' : 'No'}
                      />
                      <SmallCard
                        title="Ver contrato"
                        value={selectedTenant.can_view_contract ? 'Sí' : 'No'}
                      />
                      <SmallCard
                        title="Solicitar cambios"
                        value={selectedTenant.can_request_changes ? 'Sí' : 'No'}
                      />
                      <SmallCard
                        title="Evidencia sensible"
                        value={selectedTenant.can_view_sensitive_evidence ? 'Sí' : 'No'}
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-slate-900">
                          Nueva solicitud
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Envía solicitudes a la plataforma. El equipo superadmin revisa y aprueba.
                        </p>
                      </div>

                      {!selectedTenant.can_request_changes ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                          No tienes permiso para generar solicitudes sobre este cliente.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-600">
                                Tipo
                              </label>
                              <select
                                value={form.request_type}
                                onChange={(e) =>
                                  setForm({ ...form, request_type: e.target.value })
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              >
                                <option value="activate_standard">Activar norma</option>
                                <option value="deactivate_standard">Desactivar norma</option>
                                <option value="enable_module">Habilitar módulo</option>
                                <option value="disable_module">Deshabilitar módulo</option>
                                <option value="commercial_upgrade">Upgrade comercial</option>
                                <option value="support_request">Solicitud de soporte</option>
                                <option value="other">Otra solicitud</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-600">
                                Norma ISO opcional
                              </label>
                              <input
                                value={form.standard_code}
                                onChange={(e) =>
                                  setForm({ ...form, standard_code: e.target.value })
                                }
                                placeholder="Ej: ISO14001"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-600">
                                Módulo opcional
                              </label>
                              <input
                                value={form.module_key}
                                onChange={(e) =>
                                  setForm({ ...form, module_key: e.target.value })
                                }
                                placeholder="Ej: ai"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600">
                              Título
                            </label>
                            <input
                              value={form.title}
                              onChange={(e) => setForm({ ...form, title: e.target.value })}
                              placeholder="Ej: Solicitar activación ISO14001"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600">
                              Descripción
                            </label>
                            <textarea
                              value={form.description}
                              onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                              }
                              placeholder="Describe el requerimiento comercial u operativo..."
                              className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600">
                              Notas internas opcionales
                            </label>
                            <textarea
                              value={form.notes}
                              onChange={(e) => setForm({ ...form, notes: e.target.value })}
                              placeholder="Contexto adicional para el equipo plataforma..."
                              className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={createRequest}
                            disabled={saving}
                            className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#26384b] disabled:opacity-60"
                          >
                            {saving ? 'Enviando...' : 'Enviar solicitud'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-slate-900">
                          Mis solicitudes
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Historial de solicitudes creadas para clientes asignados.
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Fecha</th>
                              <th className="py-3 pr-4">Cliente</th>
                              <th className="py-3 pr-4">Solicitud</th>
                              <th className="py-3 pr-4">Tipo</th>
                              <th className="py-3 pr-4">Estado</th>
                              <th className="py-3 pr-4">Revisión</th>
                            </tr>
                          </thead>

                          <tbody>
                            {requests.map((request) => (
                              <tr key={request.id} className="border-b border-slate-100">
                                <td className="py-4 pr-4 text-slate-700">
                                  {formatDateTime(request.created_at)}
                                </td>

                                <td className="py-4 pr-4 font-semibold text-slate-900">
                                  {request.tenant_name || '-'}
                                </td>

                                <td className="py-4 pr-4">
                                  <div className="font-semibold text-slate-900">
                                    {request.title}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {request.description || 'Sin descripción'}
                                  </div>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {requestTypeLabel(request.request_type)}
                                </td>

                                <td className="py-4 pr-4">
                                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(request.request_status)}`}>
                                    {request.request_status}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {request.review_comment || '-'}
                                </td>
                              </tr>
                            ))}

                            {requests.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-slate-500">
                                  No hay solicitudes registradas.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
                    No tienes clientes asignados.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
