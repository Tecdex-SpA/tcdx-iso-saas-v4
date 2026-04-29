'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type TenantRow = {
  tenant_id: string;
  tenant_name: string;
  rut?: string;
  business?: string;
  active_standards?: string;
  inactive_standards?: string;
  enabled_modules?: string;
  disabled_modules?: string;
  plan_key?: string;
  contract_status?: string;
  started_at?: string;
  ends_at?: string;
  last_admin_event_at?: string;
};

type TenantDetail = {
  tenant: any;
  summary: any;
  contract: any;
  standards: any[];
  modules: any[];
  users: any[];
  dealers: any[];
};


type ExternalLookupQuota = {
  tenant_id: string;
  tenant_name: string;
  rut?: string;
  monthly_limit: number;
  quota_active?: boolean;
  used_count: number;
  remaining: number;
  last_lookup_at?: string;
  notes?: string;
};




type TenantStandardCatalogItem = {
  standard_code: string;
  standard_name: string;
  is_contracted: boolean;
  is_active: boolean;
  lifecycle_status?: 'active' | 'paused' | 'deactivated' | string | null;
  contracted_at?: string | null;
  deactivated_at?: string | null;
  paused_at?: string | null;
  permanently_deactivated_at?: string | null;
  updated_at?: string | null;
  catalog_controls_count: number;
  tenant_controls_count: number;
};



type SaasPriceCatalogItem = {
  id: string;
  item_type: string;
  item_key: string;
  item_name: string;
  item_description?: string | null;
  currency: string;
  unit_price: number | string;
  billing_frequency: string;
  is_active: boolean;
  metadata?: any;
  updated_at?: string;
};


type TenantModuleCatalogItem = {
  tenant_id: string;
  tenant_name?: string;
  module_key: string;
  module_name: string;
  module_description?: string | null;
  sort_order?: number | null;
  is_enabled: boolean;
  enabled_at?: string | null;
  disabled_at?: string | null;
  notes?: string | null;
  metadata?: any;
  can_enable?: boolean;
};

type TenantModulesCatalogResponse = {
  contract: TenantContract | null;
  max_premium_modules: number | string | null;
  enabled_modules_count: number;
  modules: TenantModuleCatalogItem[];
};

type TenantContract = {
  id?: string;
  tenant_id?: string;
  plan_key?: string;
  contract_status?: string;
  started_at?: string | null;
  ends_at?: string | null;
  billing_currency?: string;
  commercial_notes?: string | null;
  crm_reference?: string | null;
  max_active_standards?: number | string | null;
  max_premium_modules?: number | string | null;
  external_lookup_quota?: number | string | null;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
};

type TenantContractResponse = {
  tenant: {
    id: string;
    name: string;
    rut?: string;
  };
  contract: TenantContract | null;
};

type PrebillingRecord = {
  id: string;
  tenant_id: string;
  billing_month: string;
  status: string;
  currency: string;
  plan_key?: string;
  contract_status?: string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  additional_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

type PrebillingLine = {
  id: string;
  line_type: string;
  line_key: string;
  line_name: string;
  line_description?: string;
  quantity: number | string;
  unit_price: number | string;
  subtotal_amount: number | string;
  is_manual?: boolean;
  is_discount?: boolean;
  is_billable?: boolean;
};

type PrebillingContext = {
  tenant_id: string;
  tenant_name: string;
  plan_key?: string;
  contract_status?: string;
  active_standards?: number;
  enabled_modules?: number;
  total_users?: number;
  external_lookup_monthly_limit?: number;
  external_lookup_used_month?: number;
  external_lookup_remaining_month?: number;
};

type PrebillingResponse = {
  billing_month: string;
  prebilling: PrebillingRecord | null;
  lines: PrebillingLine[];
  context: PrebillingContext | null;
};

type ExternalLookupQuotaAudit = {
  id: string;
  tenant_id: string;
  changed_by_user_id?: string;
  changed_by_email?: string;
  changed_by_name?: string;
  old_monthly_limit?: number | null;
  new_monthly_limit: number;
  old_is_active?: boolean | null;
  new_is_active: boolean;
  old_notes?: string | null;
  new_notes?: string | null;
  change_reason?: string | null;
  source?: string;
  created_at?: string;
};

type ExternalLookupLog = {
  id: string;
  tenant_id: string;
  standard_code?: string;
  domain_code?: string;
  problem_type_code?: string;
  scenario_code?: string;
  query_text?: string;
  response_used?: boolean;
  quality_score?: number;
  sources_used_count?: number;
  result_summary?: string;
  created_at?: string;
};

type Dealer = {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  active_tenants?: number;
};


const IA_EXTERNAL_PACKAGE_SIZE = 100;
const IA_EXTERNAL_PACKAGE_PRICE = 4990;
const IA_EXTERNAL_EXTRA_QUERY_PRICE = 100;

function getExternalLookupPackageCount(limit: any) {
  const n = Number(limit || 0);

  if (!Number.isFinite(n) || n <= 0) return 0;

  return Math.ceil(n / IA_EXTERNAL_PACKAGE_SIZE);
}

function getExternalLookupNormalizedLimit(limit: any) {
  const packages = getExternalLookupPackageCount(limit);

  return packages * IA_EXTERNAL_PACKAGE_SIZE;
}

function getExternalLookupMonthlyPrice(limit: any) {
  return getExternalLookupPackageCount(limit) * IA_EXTERNAL_PACKAGE_PRICE;
}


function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

function formatDateTime(value?: string | null) {
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

  if (['active', 'activo', 'aprobada', 'approved', 'true'].includes(v)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['demo', 'trial'].includes(v)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['inactive', 'inactivo', 'revoked', 'cancelled', 'false'].includes(v)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (['pending', 'pendiente', 'open', 'in_review'].includes(v)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function boolLabel(value: any) {
  return value === true ? 'Activo' : 'Inactivo';
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export default function AdminSaasPage() {
  const [token, setToken] = useState<string | null>(null);

  const [governance, setGovernance] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantDetail, setTenantDetail] = useState<TenantDetail | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [dealerRequests, setDealerRequests] = useState<any[]>([]);
  const [externalQuotas, setExternalQuotas] = useState<ExternalLookupQuota[]>([]);
  const [externalLogs, setExternalLogs] = useState<ExternalLookupLog[]>([]);
  const [externalQuotaAudit, setExternalQuotaAudit] = useState<ExternalLookupQuotaAudit[]>([]);
  const [prebilling, setPrebilling] = useState<PrebillingResponse | null>(null);
  const [tenantContract, setTenantContract] = useState<TenantContract | null>(null);
  const [tenantModulesCatalog, setTenantModulesCatalog] = useState<TenantModulesCatalogResponse | null>(null);
  const [priceCatalog, setPriceCatalog] = useState<SaasPriceCatalogItem[]>([]);
  const [tenantContractForm, setTenantContractForm] = useState<Record<string, string>>({
    plan_key: 'demo',
    contract_status: 'trial',
    started_at: '',
    ends_at: '',
    billing_currency: 'CLP',
    commercial_notes: '',
    crm_reference: '',
    max_active_standards: '',
    max_premium_modules: '',
    external_lookup_quota: '',
  });
  const [standardsCatalog, setStandardsCatalog] = useState<TenantStandardCatalogItem[]>([]);
  const [prebillingMonth, setPrebillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [quotaDraftByTenant, setQuotaDraftByTenant] = useState<Record<string, {
    monthly_limit: string;
    notes: string;
  }>>({});

  const [search, setSearch] = useState('');
  const [selectedDealerId, setSelectedDealerId] = useState('');

  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState<Record<string, string>>({
    name: '',
    rut: '',
    address: '',
    business: '',
    branches: '',
  });
  const [newTenantLogo, setNewTenantLogo] = useState<File | null>(null);

  const [tenantEditForm, setTenantEditForm] = useState<Record<string, string>>({
    name: '',
    rut: '',
    address: '',
    business: '',
    branches: '',
  });
  const [tenantEditLogo, setTenantEditLogo] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [isSuperadminUi, setIsSuperadminUi] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('empresa');

  const isPlatform = governance?.data?.scope?.is_platform === true;
  const canViewAdminSaas =
    governance?.data?.permission_map?.['admin_saas.view'] === true;
  const canManageAdminSaas =
    governance?.data?.permission_map?.['admin_saas.manage'] === true ||
    isPlatform;

  const canAccess = isPlatform || canViewAdminSaas;

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

  async function loadGovernance(authToken?: string) {
    const finalToken = authToken || token || localStorage.getItem('token') || '';

    const res = await fetch(`${API_URL}/api/me/governance`, {
      headers: {
        Authorization: `Bearer ${finalToken}`,
      },
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Error obteniendo gobernanza');
    }

    setGovernance(json);
    return json;
  }


  function getSelectedTenantNameForCriticalAction() {
    const detail: any = tenantDetail || {};
    const listItem: any = (tenants as any[]).find(
      (item: any) =>
        item?.tenant_id === selectedTenantId ||
        item?.id === selectedTenantId
    );

    return (
      detail?.tenant_name ||
      detail?.name ||
      listItem?.tenant_name ||
      listItem?.name ||
      ''
    );
  }

  function getSelectedTenantServiceStatus() {
    const detail: any = tenantDetail || {};
    const listItem: any = (tenants as any[]).find(
      (item: any) =>
        item?.tenant_id === selectedTenantId ||
        item?.id === selectedTenantId
    );

    return String(
      detail?.service_status ||
        listItem?.service_status ||
        'active'
    );
  }

  async function suspendSelectedTenantService() {
    if (!selectedTenantId || !isSuperadminUi) return;

    const tenantName = getSelectedTenantNameForCriticalAction();

    const reason = window.prompt(
      `Motivo de suspensión por no pago para ${tenantName || 'esta empresa'}:`,
      'Suspensión manual por no pago'
    );

    if (!reason || !reason.trim()) return;

    const ok = window.confirm(
      `Se suspenderá el servicio de ${tenantName || selectedTenantId}.\n\n` +
        'La empresa no se elimina y la información histórica se mantiene.\n\n' +
        '¿Confirmas la suspensión?'
    );

    if (!ok) return;

    try {
      setSavingKey('tenant-suspend-service');
      setError('');

      const json = await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/suspend-service`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        }
      );

      alert(json?.message || 'Servicio suspendido correctamente.');

      await loadTenants();
      await loadTenantDetail(selectedTenantId);
      await loadTenantContract(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      const msg = err.message || 'Error suspendiendo servicio';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }

  async function reactivateSelectedTenantService() {
    if (!selectedTenantId || !isSuperadminUi) return;

    const tenantName = getSelectedTenantNameForCriticalAction();

    const reason = window.prompt(
      `Motivo de reactivación para ${tenantName || 'esta empresa'}:`,
      'Reactivación manual de servicio'
    );

    if (!reason || !reason.trim()) return;

    const ok = window.confirm(
      `Se reactivará el servicio de ${tenantName || selectedTenantId}.\n\n` +
        '¿Confirmas la reactivación?'
    );

    if (!ok) return;

    try {
      setSavingKey('tenant-reactivate-service');
      setError('');

      const json = await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/reactivate-service`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        }
      );

      alert(json?.message || 'Servicio reactivado correctamente.');

      await loadTenants();
      await loadTenantDetail(selectedTenantId);
      await loadTenantContract(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      const msg = err.message || 'Error reactivando servicio';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }

  async function deleteSelectedTenantSoft() {
    if (!selectedTenantId || !isSuperadminUi) return;

    const tenantName = getSelectedTenantNameForCriticalAction();

    if (!tenantName) {
      alert('No se pudo determinar el nombre de la empresa para confirmar eliminación.');
      return;
    }

    const typedName = window.prompt(
      `Para eliminar lógicamente esta empresa, escribe exactamente:\n\n${tenantName}`
    );

    if (typedName !== tenantName) {
      alert('Confirmación inválida. No se eliminó la empresa.');
      return;
    }

    const reason = window.prompt(
      'Motivo de eliminación lógica:',
      'Eliminación lógica manual de empresa descontratada'
    );

    if (!reason || !reason.trim()) return;

    const ok = window.confirm(
      `Última confirmación.\n\n` +
        `Empresa: ${tenantName}\n\n` +
        'Esta acción NO borra físicamente los datos, pero marca la empresa como eliminada y fuera de operación normal.\n\n' +
        'Solo debe hacerse si la empresa está descontratada.\n\n' +
        '¿Confirmas la eliminación lógica?'
    );

    if (!ok) return;

    try {
      setSavingKey('tenant-delete-soft');
      setError('');

      const json = await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            confirm_name: tenantName,
            reason: reason.trim(),
          }),
        }
      );

      alert(json?.message || 'Empresa eliminada lógicamente.');

      await loadTenants();
      setSelectedTenantId('');
      setTenantDetail(null);
      setTenantContract(null);
    } catch (err: any) {
      const msg = err.message || 'Error eliminando empresa';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }


  async function loadTenants() {
    const query = search.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : '';

    const json = await fetchJson(`/api/admin-saas/tenants${query}`);
    const rows: TenantRow[] = json.data || [];

    setTenants(rows);

    const finalTenantId =
      selectedTenantId || rows[0]?.tenant_id || '';

    if (finalTenantId) {
      setSelectedTenantId(finalTenantId);
      await loadTenantDetail(finalTenantId);
    } else {
      setTenantDetail(null);
    }
  }

  async function loadDealers() {
    const json = await fetchJson('/api/admin-saas/dealers');
    setDealers(json.data || []);
  }





  async function loadPriceCatalog() {
    try {
      const json = await fetchJson('/api/admin-saas/prebilling/prices');
      setPriceCatalog(json.data || []);
    } catch (err) {
      console.error('ERROR LOAD PRICE CATALOG:', err);
      setPriceCatalog([]);
    }
  }

  async function updatePriceCatalogItem(item: SaasPriceCatalogItem) {
    if (!canManageAdminSaas) return;

    try {
      setSavingKey(`price-${item.id}`);
      setError('');

      const json = await fetchJson(`/api/admin-saas/prebilling/prices/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          item_name: item.item_name,
          item_description: item.item_description || '',
          unit_price: Number(item.unit_price || 0),
          is_active: item.is_active,
        }),
      });

      setPriceCatalog((prev) =>
        prev.map((row) => (row.id === item.id ? json.data : row))
      );

      if (selectedTenantId) {
        await loadPrebilling(selectedTenantId, prebillingMonth);
      }
    } catch (err: any) {
      setError(err.message || 'Error actualizando precio SaaS');
    } finally {
      setSavingKey('');
    }
  }



  async function loadTenantModulesCatalog(tenantId: string) {
    if (!tenantId) {
      setTenantModulesCatalog(null);
      return;
    }

    try {
      const json = await fetchJson(`/api/admin-saas/tenants/${tenantId}/modules/catalog`);
      setTenantModulesCatalog(json.data || null);
    } catch (err) {
      console.error('ERROR LOAD TENANT MODULES CATALOG:', err);
      setTenantModulesCatalog(null);
    }
  }

  async function toggleTenantModuleCatalog(moduleKey: string, isEnabled: boolean) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const ok = window.confirm(
      `${isEnabled ? 'Habilitar' : 'Deshabilitar'} módulo ${moduleKey} para esta empresa?`
    );

    if (!ok) return;

    try {
      setSavingKey(`tenant-module-${moduleKey}`);
      setError('');

      await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/modules/${encodeURIComponent(
          moduleKey
        )}/contract-toggle`,
        {
          method: 'PUT',
          body: JSON.stringify({
            is_enabled: isEnabled,
            notes: isEnabled
              ? 'Módulo habilitado desde Administración SaaS'
              : 'Módulo deshabilitado desde Administración SaaS',
            metadata: {
              source: 'admin_saas_frontend',
              feature: 'tenant_modules_contract_limit',
            },
          }),
        }
      );

      await loadTenantModulesCatalog(selectedTenantId);
      await loadTenantDetail(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      const msg = err.message || 'Error actualizando módulo del tenant';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }


  async function loadTenantContract(tenantId: string) {
    if (!tenantId) {
      setTenantContract(null);
      return;
    }

    try {
      const json = await fetchJson(`/api/admin-saas/tenants/${tenantId}/contract`);
      const data: TenantContractResponse | null = json.data || null;
      const contract = data?.contract || null;

      setTenantContract(contract);

      setTenantContractForm({
        plan_key: contract?.plan_key || 'demo',
        contract_status: contract?.contract_status || 'trial',
        started_at: contract?.started_at ? String(contract.started_at).slice(0, 10) : '',
        ends_at: contract?.ends_at ? String(contract.ends_at).slice(0, 10) : '',
        billing_currency: contract?.billing_currency || 'CLP',
        commercial_notes: contract?.commercial_notes || '',
        crm_reference: contract?.crm_reference || '',
        max_active_standards: contract?.max_active_standards !== undefined && contract?.max_active_standards !== null ? String(contract.max_active_standards) : '',
        max_premium_modules: contract?.max_premium_modules !== undefined && contract?.max_premium_modules !== null ? String(contract.max_premium_modules) : '',
        external_lookup_quota: contract?.external_lookup_quota !== undefined && contract?.external_lookup_quota !== null ? String(contract.external_lookup_quota) : '',
      });
    } catch (err) {
      console.error('ERROR LOAD TENANT CONTRACT:', err);

      setTenantContract(null);
      setTenantContractForm({
        plan_key: 'demo',
        contract_status: 'trial',
        started_at: '',
        ends_at: '',
        billing_currency: 'CLP',
        commercial_notes: '',
        crm_reference: '',
        max_active_standards: '',
        max_premium_modules: '',
        external_lookup_quota: '',
      });
    }
  }

  async function saveTenantContract() {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const ok = window.confirm(
      `Guardar contrato SaaS para esta empresa con plan ${tenantContractForm.plan_key}?`
    );

    if (!ok) return;

    try {
      setSavingKey('tenant-contract');
      setError('');

      const json = await fetchJson(`/api/admin-saas/tenants/${selectedTenantId}/contract`, {
        method: 'PUT',
        body: JSON.stringify({
          plan_key: tenantContractForm.plan_key || 'demo',
          contract_status: tenantContractForm.contract_status || 'trial',
          started_at: tenantContractForm.started_at || null,
          ends_at: tenantContractForm.ends_at || null,
          billing_currency: tenantContractForm.billing_currency || 'CLP',
          commercial_notes: tenantContractForm.commercial_notes || null,
          crm_reference: tenantContractForm.crm_reference || null,
          max_active_standards: tenantContractForm.max_active_standards || null,
          max_premium_modules: tenantContractForm.max_premium_modules || null,
          external_lookup_quota: tenantContractForm.external_lookup_quota || null,
          metadata: {
            source: 'admin_saas_frontend',
            feature: 'tenant_contract',
          },
        }),
      });

      setTenantContract(json.data || null);

      await loadTenantContract(selectedTenantId);
      await loadTenants();
      await loadTenantDetail(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      setError(err.message || 'Error guardando contrato SaaS');
    } finally {
      setSavingKey('');
    }
  }



  const getStandardLifecycle = (item: TenantStandardCatalogItem) => {
    if (item.lifecycle_status) return String(item.lifecycle_status);

    if (item.is_active) return 'active';
    if (item.is_contracted) return 'paused';

    return 'not_contracted';
  };

  const getStandardLifecycleLabel = (item: TenantStandardCatalogItem) => {
    const status = getStandardLifecycle(item);

    if (status === 'active') return 'Contratada / activa';
    if (status === 'paused') return 'Pausada';
    if (status === 'deactivated') return 'Desactivada';
    return 'No contratada';
  };

  const getStandardLifecycleClass = (item: TenantStandardCatalogItem) => {
    const status = getStandardLifecycle(item);

    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'paused') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'deactivated') return 'border-red-200 bg-red-50 text-red-700';

    return 'border-slate-200 bg-slate-50 text-slate-600';
  };


  async function loadStandardsCatalog(tenantId: string) {
    if (!tenantId) {
      setStandardsCatalog([]);
      return;
    }

    try {
      const json = await fetchJson(
        `/api/admin-saas/tenants/${tenantId}/standards/catalog`
      );

      setStandardsCatalog(json.data || []);
    } catch (err) {
      console.error('ERROR LOAD STANDARDS CATALOG:', err);
      setStandardsCatalog([]);
    }
  }

  async function contractTenantStandard(
    standardCode: string,
    action: 'activate' | 'pause' | 'deactivate'
  ) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const actionText =
      action === 'activate'
        ? 'contratar/activar'
        : action === 'pause'
          ? 'pausar'
          : 'desactivar definitivamente';

    const ok = window.confirm(
      `¿Deseas ${actionText} la norma ${standardCode} para esta empresa?`
    );

    if (!ok) return;

    try {
      setSavingKey(`standard-contract-${standardCode}`);
      setError('');

      await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/standards/${encodeURIComponent(
          standardCode
        )}/contract`,
        {
          method: 'PUT',
          body: JSON.stringify({
            action,
            notes:
              action === 'activate'
                ? 'Norma contratada/activada desde Administración SaaS'
                : action === 'pause'
                  ? 'Norma pausada desde Administración SaaS'
                  : 'Norma desactivada definitivamente desde Administración SaaS',
          }),
        }
      );

      await loadStandardsCatalog(selectedTenantId);
      await loadTenants();
      await loadTenantDetail(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      const msg = err.message || 'Error actualizando norma contratada';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }


  async function initializeTenantStandardControls(standardCode: string) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const ok = window.confirm(
      `¿Inicializar controles de ${standardCode} para esta empresa?

` +
        'Esto creará los controles faltantes del tenant. No duplica controles existentes.'
    );

    if (!ok) return;

    try {
      setSavingKey(`standard-init-${standardCode}`);
      setError('');

      const json = await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/standards/${encodeURIComponent(
          standardCode
        )}/initialize-controls`,
        {
          method: 'POST',
          body: JSON.stringify({
            source: 'admin_saas',
          }),
        }
      );

      await loadStandardsCatalog(selectedTenantId);
      await loadTenantDetail(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);

      if (json?.data?.message) {
        alert(json.data.message);
      } else {
        alert('Controles inicializados correctamente.');
      }
    } catch (err: any) {
      const msg = err.message || 'Error inicializando controles de la norma';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }


  async function loadPrebilling(tenantId: string, month = prebillingMonth) {
    if (!tenantId) {
      setPrebilling(null);
      return;
    }

    try {
      const json = await fetchJson(
        `/api/admin-saas/tenants/${tenantId}/prebilling/current?month=${encodeURIComponent(month)}`
      );

      setPrebilling(json.data || null);
    } catch (err) {
      console.error('ERROR LOAD PREBILLING:', err);
      setPrebilling(null);
    }
  }

  async function recalculatePrebilling() {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const ok = window.confirm(
      `Recalcular prefacturación del mes ${prebillingMonth} para esta empresa?`
    );

    if (!ok) return;

    try {
      setSavingKey('prebilling-recalculate');
      setError('');

      const json = await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/prebilling/recalculate`,
        {
          method: 'POST',
          body: JSON.stringify({
            month: prebillingMonth,
          }),
        }
      );

      setPrebilling(json.data || null);
    } catch (err: any) {
      setError(err.message || 'Error recalculando prefacturación');
    } finally {
      setSavingKey('');
    }
  }

  async function updatePrebillingStatus(status: string) {
    if (!prebilling?.prebilling?.id || !canManageAdminSaas) return;

    try {
      setSavingKey(`prebilling-status-${status}`);
      setError('');

      await fetchJson(`/api/admin-saas/prebilling/${prebilling.prebilling.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
        }),
      });

      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      setError(err.message || 'Error actualizando estado de prefactura');
    } finally {
      setSavingKey('');
    }
  }


  async function loadExternalQuotas() {
    try {
      const json = await fetchJson('/api/admin-saas/external-lookup/quotas');
      const rows: ExternalLookupQuota[] = json.data || [];

      setExternalQuotas(rows);

      setQuotaDraftByTenant((prev) => {
        const next = { ...prev };

        for (const row of rows) {
          if (!next[row.tenant_id]) {
            next[row.tenant_id] = {
              monthly_limit: String(row.monthly_limit ?? 100),
              notes: row.notes || '',
            };
          }
        }

        return next;
      });
    } catch (err) {
      console.error('ERROR LOAD EXTERNAL QUOTAS:', err);
    }
  }

  async function loadExternalLogs(tenantId: string) {
    if (!tenantId) {
      setExternalLogs([]);
      return;
    }

    try {
      const json = await fetchJson(
        `/api/admin-saas/tenants/${tenantId}/external-lookup/logs?limit=30`
      );

      setExternalLogs(json.data || []);
    } catch (err) {
      console.error('ERROR LOAD EXTERNAL LOGS:', err);
      setExternalLogs([]);
    }
  }

  async function loadExternalQuotaAudit(tenantId: string) {
    if (!tenantId) {
      setExternalQuotaAudit([]);
      return;
    }

    try {
      const json = await fetchJson(
        `/api/admin-saas/tenants/${tenantId}/external-lookup/quota-audit?limit=30`
      );

      setExternalQuotaAudit(json.data || []);
    } catch (err) {
      console.error('ERROR LOAD EXTERNAL QUOTA AUDIT:', err);
      setExternalQuotaAudit([]);
    }
  }

  async function saveExternalQuota() {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const draft = quotaDraftByTenant[selectedTenantId] || {
      monthly_limit: '100',
      notes: '',
    };

    const requestedLimit = Number(draft.monthly_limit);

    if (!Number.isFinite(requestedLimit) || requestedLimit < 0) {
      setError('La cuota mensual debe ser un número válido mayor o igual a 0.');
      return;
    }

    const normalizedLimit = getExternalLookupNormalizedLimit(requestedLimit);
    const packageCount = getExternalLookupPackageCount(requestedLimit);
    const monthlyPrice = getExternalLookupMonthlyPrice(requestedLimit);

    const ok = window.confirm(
      `Actualizar respaldo externo IA?\n\n` +
        `Consultas contratadas: ${normalizedLimit}\n` +
        `Paquetes de 100: ${packageCount}\n` +
        `Valor mensual: ${formatMoney(monthlyPrice)}\n\n` +
        `Si el cliente supera sus consultas contratadas, cada consulta adicional costará ${formatMoney(
          IA_EXTERNAL_EXTRA_QUERY_PRICE
        )} y deberá ser aceptada antes de ejecutarse.`
    );

    if (!ok) return;

    try {
      setSavingKey('external-quota');
      setError('');

      await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/external-lookup/quota`,
        {
          method: 'PUT',
          body: JSON.stringify({
            monthly_limit: normalizedLimit,
            quota_active: normalizedLimit > 0,
            notes:
              draft.notes ||
              `Paquete respaldo externo IA: ${packageCount} paquete(s) de 100 consultas`,
            metadata: {
              source: 'admin_saas_frontend',
              feature: 'external_lookup_quota',
              pricing_model: 'fixed_package_100',
              package_size: IA_EXTERNAL_PACKAGE_SIZE,
              package_count: packageCount,
              package_price_clp: IA_EXTERNAL_PACKAGE_PRICE,
              monthly_price_clp: monthlyPrice,
              extra_query_price_clp: IA_EXTERNAL_EXTRA_QUERY_PRICE,
            },
          }),
        }
      );

      await loadExternalQuotas();
      await loadExternalLogs(selectedTenantId);
      await loadExternalQuotaAudit(selectedTenantId);
      await loadStandardsCatalog(selectedTenantId);
      await loadTenantContract(selectedTenantId);
      await loadTenantModulesCatalog(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    } catch (err: any) {
      setError(err.message || 'Error guardando cuota de búsqueda externa');
    } finally {
      setSavingKey('');
    }
  }


  async function loadTenantDetail(tenantId: string) {
    if (!tenantId) return;

    try {
      setLoadingTenant(true);
      setError('');

      const [detailJson, auditJson, requestsJson] = await Promise.all([
        fetchJson(`/api/admin-saas/tenants/${tenantId}`),
        fetchJson(`/api/admin-saas/audit-log?tenant_id=${tenantId}&limit=50`),
        fetchJson(`/api/admin-saas/dealer/requests?tenant_id=${tenantId}&limit=50`),
      ]);

      const detailData = detailJson.data || null;

      setTenantDetail(detailData);

      if (detailData?.tenant) {
        setTenantEditForm({
          name: detailData.tenant.name || '',
          rut: detailData.tenant.rut || '',
          address: detailData.tenant.address || '',
          business: detailData.tenant.business || '',
          branches: detailData.tenant.branches || '',
        });
        setTenantEditLogo(null);
      }

      setAuditLog(auditJson.data || []);
      setDealerRequests(requestsJson.data || []);
    } catch (err: any) {
      setError(err.message || 'Error cargando empresa');
    } finally {
      setLoadingTenant(false);
    }
  }

  async function boot() {
    try {
      setLoading(true);
      setError('');

      const authToken = localStorage.getItem('token');
      setToken(authToken);

      if (!authToken) {
        setError('Token no encontrado. Inicia sesión nuevamente.');
        return;
      }

      const gov = await loadGovernance(authToken);

      const allowed =
        gov?.data?.scope?.is_platform === true ||
        gov?.data?.permission_map?.['admin_saas.view'] === true;

      if (!allowed) {
        setError('No autorizado para ver Administración SaaS.');
        return;
      }

      const tenantsJson = await fetch(`${API_URL}/api/admin-saas/tenants`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const tenantsText = await tenantsJson.text();
      const tenantsParsed = tenantsText ? JSON.parse(tenantsText) : {};

      if (!tenantsJson.ok || tenantsParsed.ok === false) {
        throw new Error(tenantsParsed.error || 'Error cargando empresas');
      }

      const rows: TenantRow[] = tenantsParsed.data || [];
      setTenants(rows);

      const firstTenantId = rows[0]?.tenant_id || '';
      setSelectedTenantId(firstTenantId);

      const dealersJson = await fetch(`${API_URL}/api/admin-saas/dealers`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const dealersText = await dealersJson.text();
      const dealersParsed = dealersText ? JSON.parse(dealersText) : {};

      if (dealersJson.ok && dealersParsed.ok !== false) {
        setDealers(dealersParsed.data || []);
      }

      if (firstTenantId) {
        setLoadingTenant(true);

        const [detailRes, auditRes, requestsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin-saas/tenants/${firstTenantId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${API_URL}/api/admin-saas/audit-log?tenant_id=${firstTenantId}&limit=50`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${API_URL}/api/admin-saas/dealer/requests?tenant_id=${firstTenantId}&limit=50`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        const detail = await detailRes.json();
        const audit = await auditRes.json();
        const requests = await requestsRes.json();

        if (detailRes.ok && detail.ok !== false) {
          const detailData = detail.data || null;
          setTenantDetail(detailData);

          if (detailData?.tenant) {
            setTenantEditForm({
              name: detailData.tenant.name || '',
              rut: detailData.tenant.rut || '',
              address: detailData.tenant.address || '',
              business: detailData.tenant.business || '',
              branches: detailData.tenant.branches || '',
            });
            setTenantEditLogo(null);
          }
        }
        if (auditRes.ok && audit.ok !== false) setAuditLog(audit.data || []);
        if (requestsRes.ok && requests.ok !== false) setDealerRequests(requests.data || []);

        setLoadingTenant(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando Administración SaaS');
    } finally {
      setLoading(false);
      setLoadingTenant(false);
    }
  }

async function uploadSelectedTenantLogo(file: File) {
  if (!selectedTenantId || !file) {
    alert('Debes seleccionar una empresa y un archivo de logo.');
    return;
  }

  if (!canManageAdminSaas) {
    alert('No tienes permisos para modificar el logo de esta empresa.');
    return;
  }

  try {
    setSavingKey('tenant-logo');
    setError('');

    const authToken = token || localStorage.getItem('token') || '';

    const formData = new FormData();
    formData.append('logo', file);

    const res = await fetch(
      `${API_URL}/api/admin-saas/tenants/${selectedTenantId}/logo`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      }
    );

    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Error subiendo logo');
    }

    setTenantEditLogo(null);

    await loadTenants();
    await loadTenantDetail(selectedTenantId);

    alert('Logo actualizado correctamente. Recarga la página si el header no cambia de inmediato.');
  } catch (err: any) {
    const msg = err.message || 'Error actualizando logo de empresa';
    setError(msg);
    alert(msg);
  } finally {
    setSavingKey('');
  }
}


  async function createTenant() {
    if (!canManageAdminSaas) return;

    const name = String(newTenantForm.name || '').trim();
    const rut = String(newTenantForm.rut || '').trim();

    if (!name || !rut) {
      setError('Nombre y RUT son obligatorios para crear una empresa.');
      return;
    }

    const ok = window.confirm(`Crear nueva empresa "${name}"?`);
    if (!ok) return;

    try {
      setSavingKey('create-tenant');
      setError('');

      const authToken = token || localStorage.getItem('token') || '';

      const fd = new FormData();
      fd.append('name', name);
      fd.append('rut', rut);
      fd.append('address', newTenantForm.address || '');
      fd.append('business', newTenantForm.business || '');
      fd.append('branches', newTenantForm.branches || '');

      if (newTenantLogo) {
        fd.append('logo', newTenantLogo);
      }

      const res = await fetch(`${API_URL}/api/admin-saas/tenants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Error creando empresa');
      }

      const createdTenantId = json?.data?.tenant_id || json?.data?.id || '';

      setNewTenantForm({
        name: '',
        rut: '',
        address: '',
        business: '',
        branches: '',
      });
      setNewTenantLogo(null);
      setShowCreateTenant(false);

      await loadTenants();
      await loadExternalQuotas();

      if (createdTenantId) {
        setSelectedTenantId(createdTenantId);
        await loadTenantDetail(createdTenantId);
        await loadExternalLogs(createdTenantId);
        await loadExternalQuotaAudit(createdTenantId);
      }
    } catch (err: any) {
      setError(err.message || 'Error creando empresa');
    } finally {
      setSavingKey('');
    }
  }


  async function refreshAll() {
    await loadTenants();
    await loadDealers();
    await loadExternalQuotas();

    if (selectedTenantId) {
      await loadExternalLogs(selectedTenantId);
      await loadExternalQuotaAudit(selectedTenantId);
      await loadStandardsCatalog(selectedTenantId);
      await loadTenantContract(selectedTenantId);
      await loadTenantModulesCatalog(selectedTenantId);
      await loadPrebilling(selectedTenantId, prebillingMonth);
    }
  }


    async function updateTenant() {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const name = String(tenantEditForm.name || '').trim();
    const rut = String(tenantEditForm.rut || '').trim();

    if (!name || !rut) {
      setError('Nombre y RUT son obligatorios.');
      return;
    }

    const ok = window.confirm(`Guardar cambios de la empresa "${name}"?`);
    if (!ok) return;

    try {
      setSavingKey('update-tenant');
      setError('');

      const authToken = token || localStorage.getItem('token') || '';

      const res = await fetch(`${API_URL}/api/admin-saas/tenants/${selectedTenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          rut,
          address: tenantEditForm.address || '',
          business: tenantEditForm.business || '',
          branches: tenantEditForm.branches || '',
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Error actualizando empresa');
      }

      if (tenantEditLogo) {
        await uploadSelectedTenantLogo(tenantEditLogo);
        return;
      }

      await loadTenants();
      await loadTenantDetail(selectedTenantId);

      alert('Empresa actualizada correctamente.');
    } catch (err: any) {
      const msg = err.message || 'Error actualizando empresa';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }


  async function toggleModule(moduleKey: string, current: boolean) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const next = !current;

    const ok = window.confirm(
      `${next ? 'Habilitar' : 'Deshabilitar'} módulo ${moduleKey} para esta empresa?`
    );

    if (!ok) return;

    try {
      setSavingKey(`module-${moduleKey}`);
      setError('');

      await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/modules/${moduleKey}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            is_enabled: next,
            notes: next
              ? 'Cambio realizado desde Administración SaaS'
              : 'Módulo deshabilitado desde Administración SaaS',
            metadata: {
              source: 'admin_saas_frontend',
              module_key: moduleKey,
            },
          }),
        }
      );

      await loadTenantDetail(selectedTenantId);
      await loadTenants();
    } catch (err: any) {
      const msg = err.message || 'Error actualizando módulo del tenant';
      setError(msg);
      alert(msg);
    } finally {
      setSavingKey('');
    }
  }

  async function toggleStandard(standardCode: string, current: boolean) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const next = !current;

    const ok = window.confirm(
      `${next ? 'Activar' : 'Desactivar'} norma ${standardCode} para esta empresa?\n\n` +
        (next
          ? 'Se inicializarán controles faltantes y se recalculará salud.'
          : 'Se limpiarán Health/KPIs operativos de esa norma, sin borrar histórico.')
    );

    if (!ok) return;

    try {
      setSavingKey(`standard-${standardCode}`);
      setError('');

      await fetchJson(`/api/admin-saas/tenants/${selectedTenantId}/standards`, {
        method: 'PUT',
        body: JSON.stringify({
          standard_code: standardCode,
          is_active: next,
          initialize_controls: next,
          refresh_health: true,
          notes: next
            ? 'Norma activada desde Administración SaaS'
            : 'Norma desactivada desde Administración SaaS',
          metadata: {
            source: 'admin_saas_frontend',
            standard_code: standardCode,
          },
        }),
      });

      await loadTenantDetail(selectedTenantId);
      await loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error actualizando norma');
    } finally {
      setSavingKey('');
    }
  }

  async function initializeStandard(standardCode: string) {
    if (!selectedTenantId || !canManageAdminSaas) return;

    const ok = window.confirm(
      `Inicializar controles faltantes para ${standardCode}?`
    );

    if (!ok) return;

    try {
      setSavingKey(`initialize-${standardCode}`);
      setError('');

      await fetchJson(
        `/api/admin-saas/tenants/${selectedTenantId}/standards/${encodeURIComponent(standardCode)}/initialize-controls`,
        {
          method: 'POST',
          body: JSON.stringify({
            standard_code: standardCode,
            refresh_health: true,
          }),
        }
      );

      await loadTenantDetail(selectedTenantId);
      await loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error inicializando controles');
    } finally {
      setSavingKey('');
    }
  }

  async function assignDealer() {
    if (!selectedTenantId || !selectedDealerId || !canManageAdminSaas) return;

    const dealer = dealers.find((d) => d.id === selectedDealerId);

    const ok = window.confirm(
      `Asignar ${dealer?.email || 'dealer'} a esta empresa?`
    );

    if (!ok) return;

    try {
      setSavingKey('assign-dealer');
      setError('');

      await fetchJson(
        `/api/admin-saas/dealers/${selectedDealerId}/tenants/${selectedTenantId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            relationship_type: 'commercial_partner',
            can_view_health: true,
            can_view_contract: true,
            can_request_changes: true,
            can_view_sensitive_evidence: false,
            metadata: {
              source: 'admin_saas_frontend',
            },
          }),
        }
      );

      setSelectedDealerId('');
      await loadTenantDetail(selectedTenantId);
      await loadDealers();
    } catch (err: any) {
      setError(err.message || 'Error asignando dealer');
    } finally {
      setSavingKey('');
    }
  }

  async function reviewDealerRequest(requestId: string, status: string) {
    if (!canManageAdminSaas) return;

    const comment =
      status === 'approved'
        ? 'Solicitud aprobada desde Administración SaaS.'
        : 'Solicitud rechazada desde Administración SaaS.';

    const ok = window.confirm(`Cambiar solicitud a ${status}?`);

    if (!ok) return;

    try {
      setSavingKey(`request-${requestId}`);
      setError('');

      await fetchJson(`/api/admin-saas/dealer/requests/${requestId}/review`, {
        method: 'PUT',
        body: JSON.stringify({
          request_status: status,
          review_comment: comment,
        }),
      });

      await loadTenantDetail(selectedTenantId);
    } catch (err: any) {
      setError(err.message || 'Error revisando solicitud dealer');
    } finally {
      setSavingKey('');
    }
  }

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token && canAccess) {
      void loadExternalQuotas();
      void loadPriceCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canAccess]);

  useEffect(() => {
    if (token && canAccess && selectedTenantId) {
      void loadExternalLogs(selectedTenantId);
      void loadExternalQuotaAudit(selectedTenantId);
      void loadStandardsCatalog(selectedTenantId);
      void loadTenantContract(selectedTenantId);
      void loadTenantModulesCatalog(selectedTenantId);
      void loadPrebilling(selectedTenantId, prebillingMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canAccess, selectedTenantId, prebillingMonth]);


  const formatMoney = (value: any, currency = 'CLP') => {
    const amount = Number(value || 0);

    try {
      return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `$${Math.round(amount).toLocaleString('es-CL')}`;
    }
  };

  const getPrebillingStatusLabel = (status?: string) => {
    const map: Record<string, string> = {
      draft: 'Borrador',
      reviewed: 'Revisada',
      crm_ready: 'Lista CRM',
      exported: 'Exportada',
      cancelled: 'Cancelada',
    };

    return map[String(status || 'draft')] || status || 'Borrador';
  };

  const getPrebillingStatusClass = (status?: string) => {
    switch (status) {
      case 'reviewed':
      case 'crm_ready':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'exported':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'cancelled':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-amber-200 bg-amber-50 text-amber-700';
    }
  };

  const selectedTenant = useMemo(() => {
    return tenants.find((tenant) => tenant.tenant_id === selectedTenantId);
  }, [tenants, selectedTenantId]);

  const selectedExternalQuota = useMemo(() => {
    return externalQuotas.find((quota) => quota.tenant_id === selectedTenantId) || null;
  }, [externalQuotas, selectedTenantId]);

  const selectedQuotaDraft = quotaDraftByTenant[selectedTenantId] || {
    monthly_limit: String(selectedExternalQuota?.monthly_limit ?? 100),
    notes: selectedExternalQuota?.notes || '',
  };

  const activeStandards = tenantDetail?.standards?.filter((s) => s.is_active) || [];
  const inactiveStandards = tenantDetail?.standards?.filter((s) => !s.is_active) || [];
  const enabledModules = tenantDetail?.modules?.filter((m) => m.is_enabled) || [];
  const disabledModules = tenantDetail?.modules?.filter((m) => !m.is_enabled) || [];

  const adminTabs = [
    { key: 'empresa', label: 'Empresa' },
    { key: 'contrato', label: 'Contrato' },
    { key: 'operacion', label: 'Normas y módulos' },
    { key: 'ia', label: 'IA externa' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'auditoria', label: 'Auditoría' },
    { key: 'precios', label: 'Precios' },
  ];

  return (
    <AppLayout>
      <div data-admin-root data-active-admin-tab={activeAdminTab} className="min-h-screen bg-[#f5f7fb] p-6">

        <style jsx global>{`
          [data-admin-root] [data-admin-tab-section] {
            display: none !important;
          }

          [data-active-admin-tab="empresa"] [data-admin-tab-section="empresa"],
          [data-active-admin-tab="contrato"] [data-admin-tab-section="contrato"],
          [data-active-admin-tab="operacion"] [data-admin-tab-section="operacion"],
          [data-active-admin-tab="ia"] [data-admin-tab-section="ia"],
          [data-active-admin-tab="comercial"] [data-admin-tab-section="comercial"],
          [data-active-admin-tab="auditoria"] [data-admin-tab-section="auditoria"],
          [data-active-admin-tab="precios"] [data-admin-tab-section="precios"] {
            display: block !important;
          }
        `}</style>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Administración SaaS
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gobierno de empresas, módulos, normas contratadas, dealers y bitácora administrativa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              Refrescar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
            Cargando Administración SaaS...
          </div>
        ) : !canAccess ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            No autorizado para ver Administración SaaS.
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <SmallCard title="Empresas" value={tenants.length} />
              <SmallCard
                title="Usuario"
                value={governance?.data?.user?.email || '-'}
                subtitle={governance?.data?.role?.display_name || governance?.data?.user?.role}
              />
              <SmallCard
                title="Permiso"
                value={canManageAdminSaas ? 'Administrar' : 'Solo lectura'}
              />
              <SmallCard
                title="Dealers"
                value={dealers.length}
                subtitle="Partners comerciales"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <SectionTitle
                      title="Empresas"
                      subtitle="Selecciona una empresa para administrar."
                    />

                    {canManageAdminSaas && (
                      <button
                        type="button"
                        onClick={() => setShowCreateTenant((prev) => !prev)}
                        className="rounded-xl bg-[#1b2733] px-3 py-2 text-xs font-semibold text-white hover:bg-[#26384b]"
                      >
                        {showCreateTenant ? 'Cerrar' : 'Nueva empresa'}
                      </button>
                    )}
                  </div>

                  {showCreateTenant && (
                    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="mb-3">
                        <div className="font-bold text-slate-900">
                          Crear nueva empresa
                        </div>
                        <div className="text-xs text-slate-500">
                          Se creará el tenant y quedará disponible para configurar contrato, normas, módulos y cuotas.
                        </div>
                      </div>

                      <div className="space-y-2">
                        <input
                          value={newTenantForm.name}
                          onChange={(e) =>
                            setNewTenantForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="Nombre empresa"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />

                        <input
                          value={newTenantForm.rut}
                          onChange={(e) =>
                            setNewTenantForm((prev) => ({ ...prev, rut: e.target.value }))
                          }
                          placeholder="RUT"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />

                        <input
                          value={newTenantForm.business}
                          onChange={(e) =>
                            setNewTenantForm((prev) => ({ ...prev, business: e.target.value }))
                          }
                          placeholder="Rubro / giro"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />

                        <input
                          value={newTenantForm.address}
                          onChange={(e) =>
                            setNewTenantForm((prev) => ({ ...prev, address: e.target.value }))
                          }
                          placeholder="Dirección"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />

                        <input
                          value={newTenantForm.branches}
                          onChange={(e) =>
                            setNewTenantForm((prev) => ({ ...prev, branches: e.target.value }))
                          }
                          placeholder="Sucursales"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewTenantLogo(e.target.files?.[0] || null)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />

                        <button
                          type="button"
                          onClick={createTenant}
                          disabled={savingKey === 'create-tenant'}
                          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingKey === 'create-tenant' ? 'Creando...' : 'Crear empresa'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-3 flex gap-2">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadTenants();
                      }}
                      placeholder="Buscar empresa..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />

                    <button
                      type="button"
                      onClick={loadTenants}
                      className="rounded-xl bg-[#1b2733] px-3 py-2 text-sm font-semibold text-white hover:bg-[#26384b]"
                    >
                      Buscar
                    </button>
                  </div>

                  <div className="max-h-[680px] space-y-2 overflow-auto pr-1">
                    {tenants.map((tenant) => {
                      const selected = tenant.tenant_id === selectedTenantId;

                      return (
                        <button
                          key={tenant.tenant_id}
                          type="button"
                          onClick={() => {
                            setSelectedTenantId(tenant.tenant_id);
                            loadTenantDetail(tenant.tenant_id);
                          }}
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
                            {tenant.rut || 'Sin RUT'} · {tenant.business || 'Sin giro'}
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
                        No hay empresas para mostrar.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {loadingTenant ? (
                  <div className="rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
                    Cargando detalle de empresa...
                  </div>
                ) : !tenantDetail ? (
                  <div className="rounded-2xl bg-white p-6 text-slate-500 shadow-sm">
                    Selecciona una empresa.
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            Empresa seleccionada
                          </p>
                          <h2 className="mt-1 text-2xl font-bold text-slate-900">
                            {tenantDetail.tenant?.name || selectedTenant?.tenant_name}
                          </h2>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(tenantDetail.contract?.contract_status)}`}>
                              Contrato: {tenantDetail.contract?.contract_status || 'sin contrato'}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Plan: {tenantDetail.contract?.plan_key || 'N/A'}
                            </span>

                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Normas activas: {activeStandards.length}
                            </span>

                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              Módulos activos: {enabledModules.length}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          <div>
                            <b>Inicio:</b> {formatDate(tenantDetail.contract?.started_at)}
                          </div>
                          <div>
                            <b>Término:</b> {formatDate(tenantDetail.contract?.ends_at)}
                          </div>
                          <div>
                            <b>Último evento:</b>{' '}
                            {formatDateTime(tenantDetail.summary?.last_admin_event_at)}
                          </div>
                        </div>
                      </div>
                    </div>


                    <div data-admin-tab-section="empresa" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className={`${activeAdminTab === 'empresa' ? 'block' : 'hidden'} mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Datos básicos de empresa"
                          subtitle="Edita la información base del tenant seleccionado."
                        />

                        {!canManageAdminSaas && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Solo lectura
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Nombre
                          </label>
                          <input
                            value={tenantEditForm.name}
                            onChange={(e) =>
                              setTenantEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            RUT
                          </label>
                          <input
                            value={tenantEditForm.rut}
                            onChange={(e) =>
                              setTenantEditForm((prev) => ({ ...prev, rut: e.target.value }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Rubro / giro
                          </label>
                          <input
                            value={tenantEditForm.business}
                            onChange={(e) =>
                              setTenantEditForm((prev) => ({ ...prev, business: e.target.value }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Dirección
                          </label>
                          <input
                            value={tenantEditForm.address}
                            onChange={(e) =>
                              setTenantEditForm((prev) => ({ ...prev, address: e.target.value }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Sucursales
                          </label>
                          <input
                            value={tenantEditForm.branches}
                            onChange={(e) =>
                              setTenantEditForm((prev) => ({ ...prev, branches: e.target.value }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Logo
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setTenantEditLogo(e.target.files?.[0] || null)}
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={updateTenant}
                          disabled={!canManageAdminSaas || savingKey === 'update-tenant'}
                          className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white hover:bg-[#26384b] disabled:opacity-60"
                        >
                          {savingKey === 'update-tenant' ? 'Guardando...' : 'Guardar datos empresa'}
                        </button>
                      </div>
                    </div>

                    <div className={`${activeAdminTab === 'empresa' ? 'grid' : 'hidden'} grid-cols-1 gap-4 md:grid-cols-4`}>
                      <SmallCard
                        title="Normas activas"
                        value={activeStandards.length}
                        subtitle={`${inactiveStandards.length} inactivas`}
                      />
                      <SmallCard
                        title="Módulos activos"
                        value={enabledModules.length}
                        subtitle={`${disabledModules.length} inactivos`}
                      />
                      <SmallCard
                        title="Usuarios"
                        value={tenantDetail.users?.length || 0}
                      />
                      <SmallCard
                        title="Dealers asignados"
                        value={
                          tenantDetail.dealers?.filter((d) => d.status === 'active').length || 0
                        }
                      />
                    </div>



                                        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap gap-2">
                        {adminTabs.map((tab) => {
                          const active = activeAdminTab === tab.key;

                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveAdminTab(tab.key)}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                active
                                  ? 'bg-[#1b2733] text-white shadow-sm'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>



                    <div data-admin-tab-section="ia" className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
                      <div className={`${activeAdminTab === 'ia' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Respaldo externo IA"
                          subtitle="Configura paquetes mensuales de 100 consultas. Cada paquete cuesta $4.990; consultas adicionales cuestan $100 previa aceptación."
                        />

                        {!canManageAdminSaas && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Solo lectura
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <SmallCard
                          title="Consultas contratadas"
                          value={selectedExternalQuota?.monthly_limit ?? 100}
                          subtitle="Paquetes de 100"
                        />
                        <SmallCard
                          title="Usadas"
                          value={selectedExternalQuota?.used_count ?? 0}
                          subtitle="Mes actual"
                        />
                        <SmallCard
                          title="Restantes"
                          value={selectedExternalQuota?.remaining ?? 100}
                          subtitle="Antes de bloquear"
                        />
                        <SmallCard
                          title="Valor mensual"
                          value={formatMoney(getExternalLookupMonthlyPrice(selectedExternalQuota?.monthly_limit ?? 0))}
                          subtitle={`Base: ${formatMoney(IA_EXTERNAL_PACKAGE_PRICE)} / 100 consultas`}
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_auto]">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Consultas contratadas / mes
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={selectedQuotaDraft.monthly_limit}
                            onChange={(e) =>
                              setQuotaDraftByTenant((prev) => ({
                                ...prev,
                                [selectedTenantId]: {
                                  ...(prev[selectedTenantId] || selectedQuotaDraft),
                                  monthly_limit: e.target.value,
                                },
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Ingresa 100, 200, 300, etc. Si ingresas un valor intermedio, se redondeará al paquete superior. Consulta adicional: $100 previa aceptación.
                          </p>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Notas
                          </label>
                          <input
                            value={selectedQuotaDraft.notes}
                            onChange={(e) =>
                              setQuotaDraftByTenant((prev) => ({
                                ...prev,
                                [selectedTenantId]: {
                                  ...(prev[selectedTenantId] || selectedQuotaDraft),
                                  notes: e.target.value,
                                },
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="Ej: 1 paquete base, 2 paquetes contratados, ajuste comercial..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={saveExternalQuota}
                            disabled={!canManageAdminSaas || savingKey === 'external-quota'}
                            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {savingKey === 'external-quota' ? 'Guardando...' : 'Guardar cuota'}
                          </button>
                        </div>
                      </div>


                      <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              Auditoría de cambios de cuota
                            </h3>
                            <p className="text-xs text-slate-500">
                              Registro de cambios realizados por superusuarios sobre la cuota mensual.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => loadExternalQuotaAudit(selectedTenantId)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refrescar auditoría
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[950px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                                <th className="py-3 pr-4">Fecha</th>
                                <th className="py-3 pr-4">Usuario</th>
                                <th className="py-3 pr-4">Cuota anterior</th>
                                <th className="py-3 pr-4">Cuota nueva</th>
                                <th className="py-3 pr-4">Estado</th>
                                <th className="py-3 pr-4">Motivo</th>
                                <th className="py-3 pr-4">Origen</th>
                              </tr>
                            </thead>

                            <tbody>
                              {externalQuotaAudit.map((item) => (
                                <tr key={item.id} className="border-b border-slate-100">
                                  <td className="py-4 pr-4 text-slate-700">
                                    {formatDateTime(item.created_at)}
                                  </td>

                                  <td className="py-4 pr-4">
                                    <div className="font-semibold text-slate-900">
                                      {item.changed_by_email || item.changed_by_name || '-'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {item.changed_by_user_id || ''}
                                    </div>
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {item.old_monthly_limit ?? '-'}
                                  </td>

                                  <td className="py-4 pr-4 font-bold text-slate-900">
                                    {item.new_monthly_limit}
                                  </td>

                                  <td className="py-4 pr-4">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                        item.new_is_active
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-red-200 bg-red-50 text-red-700'
                                      }`}
                                    >
                                      {item.new_is_active ? 'Activa' : 'Inactiva'}
                                    </span>
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {item.change_reason || item.new_notes || '-'}
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {item.source || '-'}
                                  </td>
                                </tr>
                              ))}

                              {externalQuotaAudit.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="py-6 text-slate-500">
                                    No hay cambios de cuota registrados para esta empresa.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              Últimas búsquedas externas
                            </h3>
                            <p className="text-xs text-slate-500">
                              Incluye búsquedas reales, reutilización de caché y calidad de fuentes.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => loadExternalLogs(selectedTenantId)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refrescar logs
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[900px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                                <th className="py-3 pr-4">Fecha</th>
                                <th className="py-3 pr-4">Escenario</th>
                                <th className="py-3 pr-4">Norma</th>
                                <th className="py-3 pr-4">Fuentes</th>
                                <th className="py-3 pr-4">Score</th>
                                <th className="py-3 pr-4">Estado</th>
                              </tr>
                            </thead>

                            <tbody>
                              {externalLogs.map((log) => (
                                <tr key={log.id} className="border-b border-slate-100">
                                  <td className="py-4 pr-4 text-slate-700">
                                    {formatDateTime(log.created_at)}
                                  </td>

                                  <td className="py-4 pr-4">
                                    <div className="font-semibold text-slate-900">
                                      {log.scenario_code || '-'}
                                    </div>
                                    <div className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                                      {log.query_text || log.result_summary || '-'}
                                    </div>
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {log.standard_code || '-'}
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {log.sources_used_count ?? 0}
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {log.quality_score ?? '-'}
                                  </td>

                                  <td className="py-4 pr-4">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                        log.response_used
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-slate-200 bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      {log.response_used ? 'Usada' : 'No usada'}
                                    </span>
                                  </td>
                                </tr>
                              ))}

                              {externalLogs.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-6 text-slate-500">
                                    No hay búsquedas externas registradas para esta empresa.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>




                    <div data-admin-tab-section="precios" className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
                      <div className={`${activeAdminTab === 'precios' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Catálogo de precios SaaS"
                          subtitle="Administra precios comerciales para planes, normas, módulos y consumos adicionales. Los cambios impactan al recalcular prefacturación."
                        />

                        <button
                          type="button"
                          onClick={loadPriceCatalog}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Refrescar precios
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Concepto</th>
                              <th className="py-3 pr-4">Tipo</th>
                              <th className="py-3 pr-4">Precio</th>
                              <th className="py-3 pr-4">Frecuencia</th>
                              <th className="py-3 pr-4">Activo</th>
                              <th className="py-3 pr-4">Acción</th>
                            </tr>
                          </thead>

                          <tbody>
                            {priceCatalog.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100">
                                <td className="py-4 pr-4">
                                  <input
                                    value={item.item_name}
                                    onChange={(e) =>
                                      setPriceCatalog((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? { ...row, item_name: e.target.value }
                                            : row
                                        )
                                      )
                                    }
                                    disabled={!canManageAdminSaas}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 disabled:bg-slate-50"
                                  />

                                  <input
                                    value={item.item_description || ''}
                                    onChange={(e) =>
                                      setPriceCatalog((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? { ...row, item_description: e.target.value }
                                            : row
                                        )
                                      )
                                    }
                                    disabled={!canManageAdminSaas}
                                    placeholder="Descripción"
                                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:bg-slate-50"
                                  />
                                </td>

                                <td className="py-4 pr-4">
                                  <div className="font-semibold text-slate-800">
                                    {item.item_type}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {item.item_key}
                                  </div>
                                </td>

                                <td className="py-4 pr-4">
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.unit_price}
                                    onChange={(e) =>
                                      setPriceCatalog((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? { ...row, unit_price: e.target.value }
                                            : row
                                        )
                                      )
                                    }
                                    disabled={!canManageAdminSaas}
                                    className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                                  />
                                  <div className="mt-1 text-xs text-slate-500">
                                    {formatMoney(item.unit_price, item.currency || 'CLP')}
                                  </div>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {item.billing_frequency}
                                </td>

                                <td className="py-4 pr-4">
                                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.is_active)}
                                      onChange={(e) =>
                                        setPriceCatalog((prev) =>
                                          prev.map((row) =>
                                            row.id === item.id
                                              ? { ...row, is_active: e.target.checked }
                                              : row
                                          )
                                        )
                                      }
                                      disabled={!canManageAdminSaas}
                                    />
                                    Activo
                                  </label>
                                </td>

                                <td className="py-4 pr-4">
                                  <button
                                    type="button"
                                    onClick={() => updatePriceCatalogItem(item)}
                                    disabled={!canManageAdminSaas || savingKey === `price-${item.id}`}
                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {savingKey === `price-${item.id}` ? 'Guardando...' : 'Guardar'}
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {priceCatalog.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-slate-500">
                                  No hay precios configurados.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div data-admin-tab-section="contrato" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      
                    {isSuperadminUi && selectedTenantId && (
                      <div
                        data-admin-tab-section="empresa"
                        className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
                      >
                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <SectionTitle
                            title="Zona crítica superadmin"
                            subtitle="Acciones manuales de gobierno SaaS. Usar solo para suspensión por no pago, reactivación o baja lógica de empresas descontratadas."
                          />

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${
                              getSelectedTenantServiceStatus() === 'active'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : getSelectedTenantServiceStatus() === 'suspended_non_payment'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : getSelectedTenantServiceStatus() === 'deleted'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            Estado servicio: {getSelectedTenantServiceStatus()}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="font-bold text-amber-900">
                              Suspender por no pago
                            </div>
                            <p className="mt-2 text-sm leading-6 text-amber-800">
                              Bloquea manualmente el servicio por deuda o mora. No elimina datos,
                              evidencias ni historial.
                            </p>

                            <button
                              type="button"
                              onClick={suspendSelectedTenantService}
                              disabled={
                                savingKey === 'tenant-suspend-service' ||
                                getSelectedTenantServiceStatus() === 'suspended_non_payment' ||
                                getSelectedTenantServiceStatus() === 'deleted'
                              }
                              className="mt-4 rounded-xl border border-amber-300 bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {savingKey === 'tenant-suspend-service'
                                ? 'Suspendiendo...'
                                : 'Suspender servicio'}
                            </button>
                          </div>

                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="font-bold text-emerald-900">
                              Reactivar servicio
                            </div>
                            <p className="mt-2 text-sm leading-6 text-emerald-800">
                              Reactiva una empresa suspendida manualmente y devuelve el contrato
                              a estado activo.
                            </p>

                            <button
                              type="button"
                              onClick={reactivateSelectedTenantService}
                              disabled={
                                savingKey === 'tenant-reactivate-service' ||
                                getSelectedTenantServiceStatus() === 'active' ||
                                getSelectedTenantServiceStatus() === 'deleted'
                              }
                              className="mt-4 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {savingKey === 'tenant-reactivate-service'
                                ? 'Reactivando...'
                                : 'Reactivar servicio'}
                            </button>
                          </div>

                          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                            <div className="font-bold text-red-900">
                              Eliminar empresa descontratada
                            </div>
                            <p className="mt-2 text-sm leading-6 text-red-800">
                              Eliminación lógica. Requiere que el contrato esté terminado,
                              cancelado, expirado o descontratado.
                            </p>

                            <button
                              type="button"
                              onClick={deleteSelectedTenantSoft}
                              disabled={
                                savingKey === 'tenant-delete-soft' ||
                                getSelectedTenantServiceStatus() === 'deleted'
                              }
                              className="mt-4 rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {savingKey === 'tenant-delete-soft'
                                ? 'Eliminando...'
                                : 'Eliminar lógicamente'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                          Estas acciones quedan registradas en la empresa y contrato. La eliminación es lógica:
                          mantiene datos históricos para auditoría, prefacturación y trazabilidad.
                        </div>
                      </div>
                    )}


<div className={`${activeAdminTab === 'contrato' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Contrato SaaS"
                          subtitle="Define el plan comercial, estado contractual y datos de referencia para prefacturación y CRM."
                        />

                        {tenantContract?.updated_at && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            Última actualización: {formatDateTime(tenantContract.updated_at)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Plan contratado
                          </label>
                          <select
                            value={tenantContractForm.plan_key}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                plan_key: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          >
                            <option value="demo">Demo</option>
                            <option value="pyme">Pyme</option>
                            <option value="empresa">Empresa</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Estado contrato
                          </label>
                          <select
                            value={tenantContractForm.contract_status}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                contract_status: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Activo</option>
                            <option value="suspended">Suspendido</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Inicio
                          </label>
                          <input
                            type="date"
                            value={tenantContractForm.started_at}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                started_at: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Término / renovación
                          </label>
                          <input
                            type="date"
                            value={tenantContractForm.ends_at}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                ends_at: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Moneda
                          </label>
                          <select
                            value={tenantContractForm.billing_currency}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                billing_currency: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          >
                            <option value="CLP">CLP</option>
                            <option value="UF">UF</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Referencia CRM
                          </label>
                          <input
                            value={tenantContractForm.crm_reference}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                crm_reference: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="CRM-PENDIENTE / Deal ID"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Máx. normas activas
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={tenantContractForm.max_active_standards}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                max_active_standards: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="Ej: 2"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Máx. módulos premium
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={tenantContractForm.max_premium_modules}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                max_premium_modules: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="Ej: 1"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Cuota IA incluida
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={tenantContractForm.external_lookup_quota}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                external_lookup_quota: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="Ej: 25"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                            Notas comerciales
                          </label>
                          <input
                            value={tenantContractForm.commercial_notes}
                            onChange={(e) =>
                              setTenantContractForm((prev) => ({
                                ...prev,
                                commercial_notes: e.target.value,
                              }))
                            }
                            disabled={!canManageAdminSaas}
                            placeholder="Condiciones especiales, descuento pactado, observaciones comerciales..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                          Al guardar el contrato, recalcula la prefacturación para aplicar el precio del plan seleccionado.
                        </div>

                        <button
                          type="button"
                          onClick={saveTenantContract}
                          disabled={!canManageAdminSaas || savingKey === 'tenant-contract'}
                          className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white hover:bg-[#26384b] disabled:opacity-60"
                        >
                          {savingKey === 'tenant-contract' ? 'Guardando...' : 'Guardar contrato'}
                        </button>
                      </div>
                    </div>

                    <div data-admin-tab-section="contrato" className="rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm">
                      <div className={`${activeAdminTab === 'contrato' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Prefacturación mensual SaaS"
                          subtitle="Estimación comercial mensual del servicio contratado, adicionales y cuotas. No corresponde a factura legal."
                        />

                        <div className="flex flex-wrap gap-2">
                          <input
                            type="month"
                            value={prebillingMonth}
                            onChange={(e) => setPrebillingMonth(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />

                          <button
                            type="button"
                            onClick={() => loadPrebilling(selectedTenantId, prebillingMonth)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refrescar
                          </button>

                          {canManageAdminSaas && (
                            <button
                              type="button"
                              onClick={recalculatePrebilling}
                              disabled={savingKey === 'prebilling-recalculate'}
                              className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                            >
                              {savingKey === 'prebilling-recalculate'
                                ? 'Recalculando...'
                                : 'Recalcular prefactura'}
                            </button>
                          )}
                        </div>
                      </div>

                      {prebilling?.prebilling ? (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <SmallCard
                              title="Estado"
                              value={getPrebillingStatusLabel(prebilling.prebilling.status)}
                              subtitle={prebilling.billing_month}
                            />
                            <SmallCard
                              title="Subtotal"
                              value={formatMoney(prebilling.prebilling.subtotal_amount, prebilling.prebilling.currency)}
                              subtitle="Servicios base y adicionales"
                            />
                            <SmallCard
                              title="Descuentos"
                              value={formatMoney(prebilling.prebilling.discount_amount, prebilling.prebilling.currency)}
                              subtitle="Ajustes comerciales"
                            />
                            <SmallCard
                              title="Total estimado"
                              value={formatMoney(prebilling.prebilling.total_amount, prebilling.prebilling.currency)}
                              subtitle="Referencia mensual"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPrebillingStatusClass(
                                prebilling.prebilling.status
                              )}`}
                            >
                              {getPrebillingStatusLabel(prebilling.prebilling.status)}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Plan: {prebilling.prebilling.plan_key || prebilling.context?.plan_key || 'demo'}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Normas: {prebilling.context?.active_standards ?? 0}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              Módulos: {prebilling.context?.enabled_modules ?? 0}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                              IA externa: {prebilling.context?.external_lookup_used_month ?? 0} / {prebilling.context?.external_lookup_monthly_limit ?? 0}
                            </span>
                          </div>

                          {canManageAdminSaas && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => updatePrebillingStatus('reviewed')}
                                disabled={savingKey === 'prebilling-status-reviewed'}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                Marcar revisada
                              </button>

                              <button
                                type="button"
                                onClick={() => updatePrebillingStatus('crm_ready')}
                                disabled={savingKey === 'prebilling-status-crm_ready'}
                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                              >
                                Lista CRM
                              </button>

                              <button
                                type="button"
                                onClick={() => updatePrebillingStatus('draft')}
                                disabled={savingKey === 'prebilling-status-draft'}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Volver a borrador
                              </button>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                                  <th className="py-3 pr-4">Concepto</th>
                                  <th className="py-3 pr-4">Tipo</th>
                                  <th className="py-3 pr-4">Cantidad</th>
                                  <th className="py-3 pr-4">Precio unitario</th>
                                  <th className="py-3 pr-4">Subtotal</th>
                                  <th className="py-3 pr-4">Facturable</th>
                                </tr>
                              </thead>

                              <tbody>
                                {(prebilling.lines || []).map((line) => (
                                  <tr key={line.id} className="border-b border-slate-100">
                                    <td className="py-4 pr-4">
                                      <div className="font-semibold text-slate-900">
                                        {line.line_name}
                                      </div>
                                      {line.line_description && (
                                        <div className="mt-1 text-xs text-slate-500">
                                          {line.line_description}
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-4 pr-4 text-slate-700">
                                      {line.line_type}
                                    </td>

                                    <td className="py-4 pr-4 text-slate-700">
                                      {Number(line.quantity || 0)}
                                    </td>

                                    <td className="py-4 pr-4 text-slate-700">
                                      {formatMoney(line.unit_price, prebilling.prebilling?.currency || 'CLP')}
                                    </td>

                                    <td className="py-4 pr-4 font-bold text-slate-900">
                                      {formatMoney(line.subtotal_amount, prebilling.prebilling?.currency || 'CLP')}
                                    </td>

                                    <td className="py-4 pr-4">
                                      <span
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                          line.is_billable
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 bg-slate-50 text-slate-500'
                                        }`}
                                      >
                                        {line.is_billable ? 'Sí' : 'Informativa'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                          No existe prefactura para este mes. Presiona
                          <b> Recalcular prefactura </b>
                          para generar la estimación mensual.
                        </div>
                      )}
                    </div>



                    <div data-admin-tab-section="operacion" className="hidden">
                      <div className={`${activeAdminTab === 'operacion' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Módulos contratados"
                          subtitle="Activa o desactiva módulos SaaS respetando el máximo contratado. Los módulos no se habilitan automáticamente al convertir una cotización."
                        />

                        <button
                          type="button"
                          onClick={() => loadTenantModulesCatalog(selectedTenantId)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Refrescar módulos
                        </button>
                      </div>

                      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <SmallCard
                          title="Módulos activos"
                          value={`${tenantModulesCatalog?.enabled_modules_count ?? 0} / ${
                            tenantModulesCatalog?.max_premium_modules ?? 'Sin tope'
                          }`}
                          subtitle="Según contrato SaaS"
                        />

                        <SmallCard
                          title="Máximo contratado"
                          value={`${tenantModulesCatalog?.max_premium_modules ?? 'Sin tope'}`}
                          subtitle="Campo max_premium_modules"
                        />

                        <SmallCard
                          title="Disponibles catálogo"
                          value={`${tenantModulesCatalog?.modules?.length ?? 0}`}
                          subtitle="Módulos SaaS configurados"
                        />
                      </div>

                      {tenantModulesCatalog?.max_premium_modules !== null &&
                        tenantModulesCatalog?.max_premium_modules !== undefined &&
                        Number(tenantModulesCatalog?.enabled_modules_count || 0) >=
                          Number(tenantModulesCatalog?.max_premium_modules || 0) && (
                          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                            Esta empresa ya alcanzó el máximo de módulos premium contratados.
                            Para habilitar otro módulo, primero deshabilita uno activo o aumenta el máximo en Contrato SaaS.
                          </div>
                        )}

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Módulo</th>
                              <th className="py-3 pr-4">Estado</th>
                              <th className="py-3 pr-4">Último cambio</th>
                              <th className="py-3 pr-4">Notas</th>
                              <th className="py-3 pr-4">Acción</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(tenantModulesCatalog?.modules || []).map((item) => {
                              const blockedByContract =
                                !item.is_enabled &&
                                item.can_enable === false;

                              return (
                                <tr key={item.module_key} className="border-b border-slate-100">
                                  <td className="py-4 pr-4">
                                    <div className="font-bold text-slate-900">
                                      {item.module_name || item.module_key}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.module_description || item.module_key}
                                    </div>
                                  </td>

                                  <td className="py-4 pr-4">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                        item.is_enabled
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-slate-200 bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      {item.is_enabled ? 'Habilitado' : 'Deshabilitado'}
                                    </span>
                                  </td>

                                  <td className="py-4 pr-4 text-slate-700">
                                    {item.is_enabled
                                      ? item.enabled_at
                                        ? String(item.enabled_at).slice(0, 19).replace('T', ' ')
                                        : '-'
                                      : item.disabled_at
                                        ? String(item.disabled_at).slice(0, 19).replace('T', ' ')
                                        : '-'}
                                  </td>

                                  <td className="py-4 pr-4 text-xs text-slate-500">
                                    {blockedByContract
                                      ? 'Bloqueado por tope contractual'
                                      : item.notes || '-'}
                                  </td>

                                  <td className="py-4 pr-4">
                                    {item.is_enabled ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleTenantModuleCatalog(item.module_key, false)}
                                        disabled={
                                          !canManageAdminSaas ||
                                          savingKey === `tenant-module-${item.module_key}`
                                        }
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        Deshabilitar
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => toggleTenantModuleCatalog(item.module_key, true)}
                                        disabled={
                                          !canManageAdminSaas ||
                                          blockedByContract ||
                                          savingKey === `tenant-module-${item.module_key}`
                                        }
                                        title={
                                          blockedByContract
                                            ? 'No se puede habilitar: el contrato ya alcanzó el máximo de módulos premium.'
                                            : 'Habilitar módulo'
                                        }
                                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                      >
                                        {blockedByContract ? 'Tope contrato' : 'Habilitar'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {(tenantModulesCatalog?.modules || []).length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-6 text-slate-500">
                                  No hay módulos para mostrar.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div data-admin-tab-section="operacion" className="hidden">
                      <div className={`${activeAdminTab === 'operacion' ? 'block' : 'hidden'} mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                        <SectionTitle
                          title="Contratación de normas ISO"
                          subtitle="Activa, pausa e inicializa normas contratadas para esta empresa. Esto impacta la prefacturación mensual."
                        />

                        <button
                          type="button"
                          onClick={() => loadStandardsCatalog(selectedTenantId)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Refrescar normas
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Norma</th>
                              <th className="py-3 pr-4">Estado comercial</th>
                              <th className="py-3 pr-4">Controles catálogo</th>
                              <th className="py-3 pr-4">Controles tenant</th>
                              <th className="py-3 pr-4">Último cambio</th>
                              <th className="py-3 pr-4">Acciones</th>
                            </tr>
                          </thead>

                          <tbody>
                            {standardsCatalog.map((item) => (
                              <tr key={item.standard_code} className="border-b border-slate-100">
                                <td className="py-4 pr-4">
                                  <div className="font-bold text-slate-900">
                                    {item.standard_code}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.standard_name}
                                  </div>
                                </td>

                                <td className="py-4 pr-4">
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStandardLifecycleClass(item)}`}
                                  >
                                    {getStandardLifecycleLabel(item)}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {item.catalog_controls_count ?? 0}
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {item.tenant_controls_count ?? 0}
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {formatDateTime(item.updated_at || item.contracted_at || item.deactivated_at || undefined)}
                                </td>

                                <td className="py-4 pr-4">
                                  <div className="flex flex-wrap gap-2">
                                    {getStandardLifecycle(item) !== 'active' && (
                                      <button
                                        type="button"
                                        onClick={() => contractTenantStandard(item.standard_code, 'activate')}
                                        disabled={
                                          !canManageAdminSaas ||
                                          savingKey === `standard-contract-${item.standard_code}`
                                        }
                                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                      >
                                        {getStandardLifecycle(item) === 'paused' ? 'Reactivar' : 'Contratar'}
                                      </button>
                                    )}

                                    {getStandardLifecycle(item) === 'active' && (
                                      <button
                                        type="button"
                                        onClick={() => contractTenantStandard(item.standard_code, 'pause')}
                                        disabled={
                                          !canManageAdminSaas ||
                                          savingKey === `standard-contract-${item.standard_code}`
                                        }
                                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                      >
                                        Pausar
                                      </button>
                                    )}

                                    {getStandardLifecycle(item) === 'paused' && (
                                      <button
                                        type="button"
                                        onClick={() => contractTenantStandard(item.standard_code, 'deactivate')}
                                        disabled={
                                          !canManageAdminSaas ||
                                          savingKey === `standard-contract-${item.standard_code}`
                                        }
                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                      >
                                        Desactivar
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => initializeTenantStandardControls(item.standard_code)}
                                      disabled={
                                        !canManageAdminSaas ||
                                        getStandardLifecycle(item) !== 'active' ||
                                        savingKey === `standard-init-${item.standard_code}`
                                      }
                                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                                    >
                                      Inicializar controles
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {standardsCatalog.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-slate-500">
                                  No hay normas disponibles en el catálogo o no se pudo cargar la información.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                        Después de contratar o pausar normas, recalcula la prefacturación mensual para actualizar el costo estimado.
                      </div>
                    </div>

                    <div className="hidden">
                      <div className="hidden">
                        <SectionTitle
                          title="Normas contratadas"
                          subtitle="Activa o desactiva normas por empresa. Al desactivar se limpia Health/KPIs operativo."
                        />

                        {!canManageAdminSaas && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Solo lectura
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Norma</th>
                              <th className="py-3 pr-4">Estado</th>
                              <th className="py-3 pr-4">Controles tenant</th>
                              <th className="py-3 pr-4">Acciones</th>
                            </tr>
                          </thead>

                          <tbody>
                            {tenantDetail.standards.map((standard) => (
                              <tr key={standard.code} className="border-b border-slate-100">
                                <td className="py-4 pr-4">
                                  <div className="font-semibold text-slate-900">
                                    {standard.code}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {standard.name}
                                  </div>
                                </td>

                                <td className="py-4 pr-4">
                                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(String(standard.is_active))}`}>
                                    {boolLabel(standard.is_active)}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {standard.tenant_controls || 0}
                                </td>

                                <td className="py-4 pr-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={!canManageAdminSaas || savingKey === `standard-${standard.code}`}
                                      onClick={() => toggleStandard(standard.code, standard.is_active)}
                                      className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                                        standard.is_active
                                          ? 'bg-red-600 hover:bg-red-700'
                                          : 'bg-emerald-600 hover:bg-emerald-700'
                                      }`}
                                    >
                                      {savingKey === `standard-${standard.code}`
                                        ? 'Guardando...'
                                        : standard.is_active
                                          ? 'Desactivar'
                                          : 'Activar'}
                                    </button>

                                    {standard.is_active && (
                                      <button
                                        type="button"
                                        disabled={!canManageAdminSaas || savingKey === `initialize-${standard.code}`}
                                        onClick={() => initializeStandard(standard.code)}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        {savingKey === `initialize-${standard.code}`
                                          ? 'Inicializando...'
                                          : 'Inicializar controles'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {tenantDetail.standards.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-6 text-slate-500">
                                  No hay normas configuradas.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="hidden">
                      <SectionTitle
                        title="Módulos SaaS"
                        subtitle="Controla qué módulos tiene habilitados la empresa."
                      />

                      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {tenantDetail.modules.map((module) => (
                          <div
                            key={module.module_key}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-slate-900">
                                  {module.module_name || module.module_key}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-slate-500">
                                  {module.module_description || 'Sin descripción'}
                                </div>
                              </div>

                              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(String(module.is_enabled))}`}>
                                {boolLabel(module.is_enabled)}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="text-xs text-slate-500">
                                {module.notes || 'Sin notas'}
                              </div>

                              <button
                                type="button"
                                disabled={!canManageAdminSaas || savingKey === `module-${module.module_key}`}
                                onClick={() => toggleModule(module.module_key, module.is_enabled)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                                  module.is_enabled
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                {savingKey === `module-${module.module_key}`
                                  ? 'Guardando...'
                                  : module.is_enabled
                                    ? 'Deshabilitar'
                                    : 'Habilitar'}
                              </button>
                            </div>
                          </div>
                        ))}

                        {tenantDetail.modules.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                            No hay módulos configurados.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <div data-admin-tab-section="comercial" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className={`${activeAdminTab === 'comercial' ? 'block' : 'hidden'} mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
                          <SectionTitle
                            title="Dealers / Partners"
                            subtitle="Partners asignados a esta empresa."
                          />
                        </div>

                        {canManageAdminSaas && (
                          <div className="mb-4 flex gap-2">
                            <select
                              value={selectedDealerId}
                              onChange={(e) => setSelectedDealerId(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                              <option value="">Seleccionar dealer</option>
                              {dealers.map((dealer) => (
                                <option key={dealer.id} value={dealer.id}>
                                  {dealer.email} {dealer.full_name ? `- ${dealer.full_name}` : ''}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={assignDealer}
                              disabled={!selectedDealerId || savingKey === 'assign-dealer'}
                              className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white hover:bg-[#26384b] disabled:opacity-60"
                            >
                              {savingKey === 'assign-dealer' ? 'Asignando...' : 'Asignar'}
                            </button>
                          </div>
                        )}

                        <div className="space-y-3">
                          {tenantDetail.dealers?.map((dealer) => (
                            <div
                              key={dealer.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {dealer.dealer_email || dealer.dealer_name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {dealer.relationship_type || 'commercial_partner'}
                                  </div>
                                </div>

                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(dealer.status)}`}>
                                  {dealer.status}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <span className="rounded-lg bg-white p-2 text-slate-600">
                                  Salud: {dealer.can_view_health ? 'Sí' : 'No'}
                                </span>
                                <span className="rounded-lg bg-white p-2 text-slate-600">
                                  Contrato: {dealer.can_view_contract ? 'Sí' : 'No'}
                                </span>
                                <span className="rounded-lg bg-white p-2 text-slate-600">
                                  Solicitudes: {dealer.can_request_changes ? 'Sí' : 'No'}
                                </span>
                                <span className="rounded-lg bg-white p-2 text-slate-600">
                                  Evidencia sensible:{' '}
                                  {dealer.can_view_sensitive_evidence ? 'Sí' : 'No'}
                                </span>
                              </div>
                            </div>
                          ))}

                          {(!tenantDetail.dealers || tenantDetail.dealers.length === 0) && (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                              No hay dealers asignados a esta empresa.
                            </div>
                          )}
                        </div>
                      </div>

                      <div data-admin-tab-section="comercial" className={`${activeAdminTab === 'comercial' ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`}>
                        <SectionTitle
                          title="Usuarios del tenant"
                          subtitle="Usuarios asociados a esta empresa."
                        />

                        <div className="mt-4 space-y-3">
                          {tenantDetail.users?.map((user) => (
                            <div
                              key={user.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="font-semibold text-slate-900">
                                {user.email}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {user.full_name || 'Sin nombre'} · {user.role}
                              </div>
                            </div>
                          ))}

                          {(!tenantDetail.users || tenantDetail.users.length === 0) && (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                              No hay usuarios asociados.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div data-admin-tab-section="comercial" className={`${activeAdminTab === 'comercial' ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`}>
                      <SectionTitle
                        title="Solicitudes Dealer"
                        subtitle="Solicitudes comerciales u operativas enviadas por partners."
                      />

                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Solicitud</th>
                              <th className="py-3 pr-4">Dealer</th>
                              <th className="py-3 pr-4">Tipo</th>
                              <th className="py-3 pr-4">Estado</th>
                              <th className="py-3 pr-4">Fecha</th>
                              <th className="py-3 pr-4">Acción</th>
                            </tr>
                          </thead>

                          <tbody>
                            {dealerRequests.map((request) => (
                              <tr key={request.id} className="border-b border-slate-100">
                                <td className="py-4 pr-4">
                                  <div className="font-semibold text-slate-900">
                                    {request.title}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {request.description || 'Sin descripción'}
                                  </div>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {request.dealer_email || '-'}
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {request.request_type}
                                </td>

                                <td className="py-4 pr-4">
                                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(request.request_status)}`}>
                                    {request.request_status}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {formatDateTime(request.created_at)}
                                </td>

                                <td className="py-4 pr-4">
                                  {canManageAdminSaas &&
                                  ['open', 'in_review'].includes(request.request_status) ? (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={savingKey === `request-${request.id}`}
                                        onClick={() => reviewDealerRequest(request.id, 'approved')}
                                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                      >
                                        Aprobar
                                      </button>

                                      <button
                                        type="button"
                                        disabled={savingKey === `request-${request.id}`}
                                        onClick={() => reviewDealerRequest(request.id, 'rejected')}
                                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                      >
                                        Rechazar
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">Sin acción</span>
                                  )}
                                </td>
                              </tr>
                            ))}

                            {dealerRequests.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-6 text-slate-500">
                                  No hay solicitudes dealer para esta empresa.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div data-admin-tab-section="auditoria" className={`${activeAdminTab === 'auditoria' ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`}>
                      <SectionTitle
                        title="Bitácora administrativa"
                        subtitle="Últimos eventos de gobierno SaaS para esta empresa."
                      />

                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[1050px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                              <th className="py-3 pr-4">Fecha</th>
                              <th className="py-3 pr-4">Actor</th>
                              <th className="py-3 pr-4">Entidad</th>
                              <th className="py-3 pr-4">Acción</th>
                              <th className="py-3 pr-4">Detalle</th>
                            </tr>
                          </thead>

                          <tbody>
                            {auditLog.map((event) => (
                              <tr key={event.id} className="border-b border-slate-100">
                                <td className="py-4 pr-4 text-slate-700">
                                  {formatDateTime(event.created_at)}
                                </td>

                                <td className="py-4 pr-4">
                                  <div className="font-semibold text-slate-900">
                                    {event.actor_email || event.actor_role || '-'}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {event.actor_name || event.actor_role}
                                  </div>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {event.entity_type}
                                </td>

                                <td className="py-4 pr-4">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {event.action}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 text-slate-700">
                                  {event.action_label || '-'}
                                </td>
                              </tr>
                            ))}

                            {auditLog.length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-6 text-slate-500">
                                  No hay eventos administrativos para esta empresa.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
