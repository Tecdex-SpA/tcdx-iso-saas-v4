'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import CompanyProfileImpactPanel from '@/components/company-profile/CompanyProfileImpactPanel';
import {
  EnterpriseButton,
  EnterpriseKpiCard,
  EnterprisePageHeader,
} from '@/components/ui/enterprise';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

function isPlatformRole(user: unknown) {
  const record = user && typeof user === 'object' ? user as Record<string, unknown> : {};
  const role = String(record.role || record.user_role || record.userRole || '').toLowerCase();
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(role);
}

type LatestSnapshot = {
  id?: string;
  standard_code?: string | null;
  value?: string | number | null;
  numerator_value?: string | number | null;
  denominator_value?: string | number | null;
  status_color?: string | null;
  period_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  calculated_at?: string | null;
  breakdown_json?: Record<string, any>;
};

type KpiAdminItem = {
  id: string;
  code: string;
  name: string;
  custom_label?: string | null;
  description?: string | null;
  custom_description?: string | null;
  category: string;
  kpi_type: string;
  unit: string;
  frequency: string;
  override_frequency?: string | null;
  direction: string;
  override_direction?: string | null;
  target_value?: number | null;
  override_target_value?: number | null;
  is_standard: boolean;
  is_enabled: boolean;
  tenant_id?: string | null;
  applicable_standards?: string[];
  is_health_kpi?: boolean;
  latest_value?: string | number | null;
  latest_status_color?: string | null;
  latest_standard_code?: string | null;
  latest_period_start?: string | null;
  latest_period_end?: string | null;
  latest_calculated_at?: string | null;
  has_multiple_snapshots?: boolean;
  latest_snapshots?: LatestSnapshot[];
  thresholds?: {
    green_min?: number | null;
    green_max?: number | null;
    yellow_min?: number | null;
    yellow_max?: number | null;
    red_min?: number | null;
    red_max?: number | null;
    override?: Record<string, any>;
  };
};

type StandardItem = {
  code: string;
  name: string;
  is_active?: boolean;
};

function formatNumber(value: any, decimals = 2) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(decimals);
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';

  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return value;
  }
}

function isHealthKpi(item: KpiAdminItem) {
  return item.is_health_kpi || item.code.startsWith('KPI-HLT-');
}

function colorBadgeClass(color?: string | null) {
  if (color === 'green') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (color === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (color === 'red') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

type TFunction = (key: string, params?: Record<string, string | number>) => string;

function colorLabel(color: string | null | undefined, t: TFunction) {
  if (color === 'green') return t('statuses.kpis.verde');
  if (color === 'yellow') return t('statuses.kpis.amarillo');
  if (color === 'red') return t('statuses.kpis.rojo');
  return t('common.noData');
}

function getHealthRefreshCount(payload: any): number {
  if (Array.isArray(payload?.health_kpi_refresh)) {
    return payload.health_kpi_refresh.reduce((acc: number, row: any) => {
      return acc + Number(row?.snapshots_inserted || row?.inserted || 0);
    }, 0);
  }

  return Number(payload?.health_recalculated || 0);
}

export default function AdministrarKpisPage() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [canRefreshHealth, setCanRefreshHealth] = useState(false);

  const [standards, setStandards] = useState<StandardItem[]>([]);
  const [data, setData] = useState<KpiAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [saving, setSaving] = useState('');

  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [standardFilter, setStandardFilter] = useState('');

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    category: 'cumplimiento',
    kpi_type: 'manual',
    unit: '%',
    base_formula: '',
    formula_expression: '',
    data_source_summary: '',
    frequency: 'mensual',
    direction: 'higher_is_better',
    target_value: '',
    min_value: '',
    max_value: '',
    green_min: '',
    green_max: '',
    yellow_min: '',
    yellow_max: '',
    red_min: '',
    red_max: '',
    standard_codes: [] as string[]
  });

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (authToken) {
      if (isPlatformRole(u)) {
        setCanRefreshHealth(true);
      } else {
        fetch(`${API_URL}/api/me/permissions`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
          .then((res) => res.json())
          .then((json) => {
            setCanRefreshHealth(json?.permission_map?.['health.refresh'] === true);
          })
          .catch(() => {
            setCanRefreshHealth(false);
          });
      }
    }

    if (!authToken || !u?.tenant_id) {
      setLoading(false);
      setLoadingStandards(false);
    }
  }, []);

  function requireHealthRefresh() {
    if (canRefreshHealth) return true;
    alert('No tienes permisos para recalcular o administrar Health ISO.');
    return false;
  }

  useEffect(() => {
    if (!token || !user?.tenant_id) return;
    loadStandards(user.tenant_id, token);
    loadData(user.tenant_id, token);
  }, [token, user]);

  const loadStandards = async (tenantId: string, authToken: string) => {
    try {
      setLoadingStandards(true);

      const res = await fetch(
        `${API_URL}/api/tenant-standards/${tenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD KPI STANDARDS:', json);
        setStandards([]);
        return;
      }

      const activeStandards = (json || []).filter((s: any) => s.is_active === true);
      setStandards(activeStandards);
    } catch (err) {
      console.error('ERROR LOAD KPI STANDARDS:', err);
      setStandards([]);
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadData = async (tenantId: string, authToken: string) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_URL}/api/kpis/admin/${tenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD KPI ADMIN:', json);
        setData([]);
        return;
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD KPI ADMIN:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!token || !user?.tenant_id) return;
    await loadData(user.tenant_id, token);
  };

  const availableStandards = useMemo(() => {
    const map = new Map<string, string>();

    standards.forEach((s) => {
      map.set(s.code, s.name || s.code);
    });

    data.forEach((item) => {
      (item.applicable_standards || []).forEach((code) => {
        if (!map.has(code)) map.set(code, code);
      });
    });

    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [standards, data]);

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const searchText = filter.trim().toLowerCase();

      const searchOk =
        !searchText ||
        item.code.toLowerCase().includes(searchText) ||
        item.name.toLowerCase().includes(searchText) ||
        (item.custom_label || '').toLowerCase().includes(searchText) ||
        (item.description || '').toLowerCase().includes(searchText) ||
        (item.custom_description || '').toLowerCase().includes(searchText);

      const categoryOk = !categoryFilter || item.category === categoryFilter;
      const typeOk = !typeFilter || item.kpi_type === typeFilter;

      const statusOk =
        !statusFilter ||
        (statusFilter === 'enabled' && item.is_enabled) ||
        (statusFilter === 'disabled' && !item.is_enabled);

      const originOk =
        !originFilter ||
        (originFilter === 'standard' && item.is_standard) ||
        (originFilter === 'custom' && !item.is_standard) ||
        (originFilter === 'health' && isHealthKpi(item));

      const standardOk =
        !standardFilter ||
        (item.applicable_standards || []).includes(standardFilter) ||
        (item.latest_snapshots || []).some((s) => s.standard_code === standardFilter);

      return searchOk && categoryOk && typeOk && statusOk && originOk && standardOk;
    });
  }, [data, filter, categoryFilter, typeFilter, statusFilter, originFilter, standardFilter]);

  const toggleStandardCode = (code: string) => {
    setForm((prev) => ({
      ...prev,
      standard_codes: prev.standard_codes.includes(code)
        ? prev.standard_codes.filter((s) => s !== code)
        : [...prev.standard_codes, code]
    }));
  };

  const createCustomKpi = async () => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    if (!form.name.trim()) {
      alert(t('kpiAdmin.nameRequired'));
      return;
    }

    try {
      setSaving('create');

      const res = await fetch(`${API_URL}/api/kpis/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          code: form.code.trim() || undefined,
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category,
          kpi_type: form.kpi_type,
          unit: form.unit.trim(),
          base_formula: form.base_formula.trim() || null,
          formula_expression: form.formula_expression.trim() || null,
          data_source_summary: form.data_source_summary.trim() || null,
          frequency: form.frequency,
          direction: form.direction,
          target_value: form.target_value || null,
          min_value: form.min_value || null,
          max_value: form.max_value || null,
          green_min: form.green_min || null,
          green_max: form.green_max || null,
          yellow_min: form.yellow_min || null,
          yellow_max: form.yellow_max || null,
          red_min: form.red_min || null,
          red_max: form.red_max || null,
          standard_codes: form.standard_codes
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.createError'));
        return;
      }

      setForm({
        code: '',
        name: '',
        description: '',
        category: 'cumplimiento',
        kpi_type: 'manual',
        unit: '%',
        base_formula: '',
        formula_expression: '',
        data_source_summary: '',
        frequency: 'mensual',
        direction: 'higher_is_better',
        target_value: '',
        min_value: '',
        max_value: '',
        green_min: '',
        green_max: '',
        yellow_min: '',
        yellow_max: '',
        red_min: '',
        red_max: '',
        standard_codes: []
      });

      await refresh();
      alert(t('kpiAdmin.createSuccess'));
    } catch (err) {
      console.error('ERROR CREATE KPI:', err);
      alert(t('kpiAdmin.createError'));
    } finally {
      setSaving('');
    }
  };

  const toggleTenantEnabled = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    if (isHealthKpi(item)) {
      alert(t('kpiAdmin.healthKpisCannotDisable'));
      return;
    }

    try {
      setSaving(`toggle-${item.id}`);

      const res = await fetch(`${API_URL}/api/kpis/tenant-setting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          kpi_id: item.id,
          is_enabled: !item.is_enabled,
          override_frequency: item.override_frequency || item.frequency,
          override_target_value: item.override_target_value ?? item.target_value,
          override_direction: item.override_direction || item.direction,
          custom_label: item.custom_label || null,
          custom_description: item.custom_description || null
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.updateError'));
        return;
      }

      await refresh();
    } catch (err) {
      console.error('ERROR TOGGLE KPI:', err);
      alert(t('kpiAdmin.updateError'));
    } finally {
      setSaving('');
    }
  };

  const updateTenantCustomization = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    if (isHealthKpi(item)) {
      alert(t('kpiAdmin.healthKpisManaged'));
      return;
    }

    const customLabel =
      window.prompt(t('kpiAdmin.customLabelPrompt'), item.custom_label || item.name) ??
      item.custom_label ??
      item.name;

    const customDescription =
      window.prompt(t('kpiAdmin.customDescriptionPrompt'), item.custom_description || item.description || '') ??
      item.custom_description ??
      item.description ??
      '';

    const overrideFrequency =
      window.prompt(
        t('kpiAdmin.frequencyPrompt'),
        item.override_frequency || item.frequency
      ) ??
      item.override_frequency ??
      item.frequency;

    const overrideDirection =
      window.prompt(
        t('kpiAdmin.directionPrompt'),
        item.override_direction || item.direction
      ) ??
      item.override_direction ??
      item.direction;

    const overrideTargetValue =
      window.prompt(
        t('kpiAdmin.numericTargetPrompt'),
        String(item.override_target_value ?? item.target_value ?? '')
      ) ??
      String(item.override_target_value ?? item.target_value ?? '');

    try {
      setSaving(`customize-${item.id}`);

      const res = await fetch(`${API_URL}/api/kpis/tenant-setting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          kpi_id: item.id,
          is_enabled: item.is_enabled,
          override_frequency: overrideFrequency || null,
          override_target_value: overrideTargetValue || null,
          override_direction: overrideDirection || null,
          custom_label: customLabel || null,
          custom_description: customDescription || null
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.customizeError'));
        return;
      }

      await refresh();
      alert(t('kpiAdmin.customizeSuccess'));
    } catch (err) {
      console.error('ERROR CUSTOMIZE KPI:', err);
      alert(t('kpiAdmin.customizeError'));
    } finally {
      setSaving('');
    }
  };

  const editCustomKpi = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    if (item.is_standard) {
      alert(t('kpiAdmin.customEndpointOnly'));
      return;
    }

    const name = window.prompt(t('kpiAdmin.kpiName'), item.name) ?? item.name;
    const description =
      window.prompt(t('kpiAdmin.description'), item.description || '') ?? item.description ?? '';
    const category =
      window.prompt(
        t('kpiAdmin.categoryPrompt'),
        item.category
      ) ?? item.category;
    const kpiType =
      window.prompt(t('kpiAdmin.typePrompt'), item.kpi_type) ?? item.kpi_type;
    const unit = window.prompt(t('kpiAdmin.unit'), item.unit) ?? item.unit;
    const frequency =
      window.prompt(
        t('kpiAdmin.frequencyPrompt'),
        item.override_frequency || item.frequency
      ) ?? (item.override_frequency || item.frequency);
    const direction =
      window.prompt(
        t('kpiAdmin.directionPrompt'),
        item.override_direction || item.direction
      ) ?? (item.override_direction || item.direction);
    const targetValue =
      window.prompt(
        t('kpiAdmin.numericTargetPrompt'),
        String(item.override_target_value ?? item.target_value ?? '')
      ) ?? String(item.override_target_value ?? item.target_value ?? '');
    const greenMin =
      window.prompt(t('kpiAdmin.greenMin'), String(item.thresholds?.green_min ?? '')) ??
      String(item.thresholds?.green_min ?? '');
    const greenMax =
      window.prompt(t('kpiAdmin.greenMax'), String(item.thresholds?.green_max ?? '')) ??
      String(item.thresholds?.green_max ?? '');
    const yellowMin =
      window.prompt(t('kpiAdmin.yellowMin'), String(item.thresholds?.yellow_min ?? '')) ??
      String(item.thresholds?.yellow_min ?? '');
    const yellowMax =
      window.prompt(t('kpiAdmin.yellowMax'), String(item.thresholds?.yellow_max ?? '')) ??
      String(item.thresholds?.yellow_max ?? '');
    const redMin =
      window.prompt(t('kpiAdmin.redMin'), String(item.thresholds?.red_min ?? '')) ??
      String(item.thresholds?.red_min ?? '');
    const redMax =
      window.prompt(t('kpiAdmin.redMax'), String(item.thresholds?.red_max ?? '')) ??
      String(item.thresholds?.red_max ?? '');

    const standardCodesRaw =
      window.prompt(
        t('kpiAdmin.associatedStandardsPrompt'),
        (item.applicable_standards || []).join(',')
      ) ?? (item.applicable_standards || []).join(',');

    try {
      setSaving(`edit-custom-${item.id}`);

      const res = await fetch(`${API_URL}/api/kpis/custom/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description: description || null,
          category,
          kpi_type: kpiType,
          unit,
          frequency,
          direction,
          target_value: targetValue || null,
          green_min: greenMin || null,
          green_max: greenMax || null,
          yellow_min: yellowMin || null,
          yellow_max: yellowMax || null,
          red_min: redMin || null,
          red_max: redMax || null,
          standard_codes: standardCodesRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.editError'));
        return;
      }

      await refresh();
      alert(t('kpiAdmin.editSuccess'));
    } catch (err) {
      console.error('ERROR EDIT CUSTOM KPI:', err);
      alert(t('kpiAdmin.editError'));
    } finally {
      setSaving('');
    }
  };

  const deleteCustomKpi = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    if (item.is_standard) {
      alert(t('kpiAdmin.deleteCustomOnly'));
      return;
    }

    const ok = window.confirm(
      t('kpiAdmin.deleteConfirm', { name: item.name })
    );

    if (!ok) return;

    try {
      setSaving(`delete-custom-${item.id}`);

      const res = await fetch(`${API_URL}/api/kpis/custom/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.deleteError'));
        return;
      }

      await refresh();
      alert(t('kpiAdmin.deleteSuccess'));
    } catch (err) {
      console.error('ERROR DELETE CUSTOM KPI:', err);
      alert(t('kpiAdmin.deleteError'));
    } finally {
      setSaving('');
    }
  };

  const saveManualValue = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) {
      alert(t('kpiAdmin.noActiveSession'));
      return;
    }

    if (!requireHealthRefresh()) return;

    if (isHealthKpi(item)) {
      alert(t('kpiAdmin.healthKpisAutomatic'));
      return;
    }

    if (item.kpi_type === 'automatico') {
      alert(t('kpiAdmin.automaticNoManual'));
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const frequency = item.override_frequency || item.frequency || 'mensual';

    let periodStart = new Date(year, month, 1);
    let periodEnd = new Date(year, month + 1, 0);

    if (frequency === 'trimestral') {
      const startMonth = Math.floor(month / 3) * 3;
      periodStart = new Date(year, startMonth, 1);
      periodEnd = new Date(year, startMonth + 3, 0);
    }

    if (frequency === 'semestral') {
      const startMonth = month < 6 ? 0 : 6;
      periodStart = new Date(year, startMonth, 1);
      periodEnd = new Date(year, startMonth + 6, 0);
    }

    if (frequency === 'anual') {
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31);
    }

    const standards = Array.isArray(item.applicable_standards)
      ? item.applicable_standards.filter(Boolean)
      : [];

    let standardCode: string | null = standards[0] || null;

    if (standards.length > 1) {
      const selectedStandard = window.prompt(
        t('kpiAdmin.multiStandardPrompt', { standards: standards.join(', ') }),
        standardCode || ''
      );

      if (selectedStandard === null) return;

      standardCode = selectedStandard.trim() || null;

      if (standardCode && !standards.includes(standardCode)) {
        alert(t('kpiAdmin.invalidStandard', { standards: standards.join(', ') }));
        return;
      }
    }

    if (standards.length === 0) {
      const selectedGlobal = window.prompt(
        t('kpiAdmin.globalStandardPrompt'),
        ''
      );

      if (selectedGlobal === null) return;

      standardCode = selectedGlobal.trim() || null;
    }

    const valueInput = window.prompt(
      t('kpiAdmin.manualValuePrompt', { code: item.code, name: item.name, frequency, standard: standardCode || t('kpiAdmin.global') }),
      ''
    );

    if (valueInput === null) return;

    const normalizedValue = valueInput.trim().replace(',', '.');
    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue)) {
      alert(t('kpiAdmin.invalidNumericValue'));
      return;
    }

    const notes = window.prompt(
      t('kpiAdmin.manualValueCommentPrompt'),
      t('kpiAdmin.manualValueDefaultComment')
    );

    if (notes === null) return;

    const ok = window.confirm(
      t('kpiAdmin.confirmManualValue', {
        code: item.code,
        name: item.name,
        value: numericValue,
        standard: standardCode || t('kpiAdmin.global'),
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
      })
    );

    if (!ok) return;

    try {
      setSaving(`manual-${item.id}`);

      const res = await fetch(`${API_URL}/api/kpis/manual-value`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          kpi_id: item.id,
          standard_code: standardCode,
          period_type: frequency,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          value: numericValue,
          notes
        })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json.error || t('kpiAdmin.manualSaveError'));
        return;
      }

      await refresh();

      if (json.snapshot?.id) {
        alert(t('kpiAdmin.manualSaveSnapshotSuccess'));
      } else if (json.snapshot_error) {
        alert(t('kpiAdmin.manualSaveSnapshotWarning', { error: json.snapshot_error }));
      } else {
        alert(t('kpiAdmin.manualSaveSuccess'));
      }
    } catch (err) {
      console.error('ERROR SAVE KPI MANUAL VALUE:', err);
      alert(t('kpiAdmin.manualSaveError'));
    } finally {
      setSaving('');
    }
  };

  const recalculateKpis = async () => {
    if (!token || !user?.tenant_id) return;
    if (!requireHealthRefresh()) return;

    try {
      setSaving('recalculate');

      const res = await fetch(
        `${API_URL}/api/kpis/recalculate/${user.tenant_id}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('dashboardKpi.recalculateError'));
        return;
      }

      await refresh();

      const kpisRecalculated = Number(
        json?.snapshots_created ?? json?.recalculated ?? 0
      );

      const healthRecalculated = getHealthRefreshCount(json);

      alert(
        t('dashboardKpi.recalculateSuccess', { count: kpisRecalculated, healthCount: healthRecalculated })
      );
    } catch (err) {
      console.error('ERROR RECALCULATE KPI:', err);
      alert(t('dashboardKpi.recalculateError'));
    } finally {
      setSaving('');
    }
  };

  const stats = useMemo(() => {
    return {
      total: data.length,
      enabled: data.filter((item) => item.is_enabled).length,
      standard: data.filter((item) => item.is_standard && !isHealthKpi(item)).length,
      custom: data.filter((item) => !item.is_standard).length,
      health: data.filter((item) => isHealthKpi(item)).length,
      filtered: filtered.length
    };
  }, [data, filtered]);

  const manualPendingKpis = useMemo(() => {
    return data
      .filter((item) => item.is_enabled)
      .filter((item) => !isHealthKpi(item))
      .filter((item) => ['manual', 'hibrido'].includes(String(item.kpi_type || '').toLowerCase()))
      .filter((item) => {
        const color = item.latest_status_color;
        const value = item.latest_value;
        return !color || color === 'gray' || value === null || value === undefined || value === '';
      })
      .slice(0, 8);
  }, [data]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <EnterprisePageHeader
          title={t('kpiAdmin.title')}
          subtitle={t('kpiAdmin.subtitle')}
          actions={
            <>
            <EnterpriseButton
              href="/iso-health"
              variant="secondary"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              {t('kpiAdmin.viewHealth')}
            </EnterpriseButton>

            <EnterpriseButton
              type="button"
              onClick={recalculateKpis}
              disabled={saving === 'recalculate' || !canRefreshHealth}
              title={!canRefreshHealth ? 'No tienes permisos para recalcular o administrar Health ISO.' : undefined}
              className="disabled:opacity-60"
            >
              {saving === 'recalculate' ? t('dashboardKpi.recalculating') : t('dashboardKpi.recalculateKpis')}
            </EnterpriseButton>

            <EnterpriseButton
              href="/dashboard"
              variant="secondary"
            >
              {t('kpiAdmin.backToDashboard')}
            </EnterpriseButton>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard title={t('kpiAdmin.totalKpis')} value={stats.total} />
          <MetricCard title={t('kpiAdmin.enabled')} value={stats.enabled} />
          <MetricCard title={t('kpiAdmin.standard')} value={stats.standard} />
          <MetricCard title={t('dashboardKpi.health')} value={stats.health} />
          <MetricCard title={t('kpiAdmin.custom')} value={stats.custom} />
          <MetricCard title={t('kpiAdmin.filtered')} value={stats.filtered} />
        </div>

        <CompanyProfileImpactPanel
          moduleCode="health"
          title="Lectura Health ISO según Perfil Empresa"
          compact
        />

        {manualPendingKpis.length > 0 && (
          <section className="enterprise-card border-amber-200 bg-amber-50/70">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t('kpiAdmin.pendingManualKpis')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t('kpiAdmin.pendingManualSubtitle')}
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                {t('kpiAdmin.pendingCount', { count: manualPendingKpis.length })}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {manualPendingKpis.map((item) => (
                <div
                  key={`manual-pending-${item.id}`}
                  className="rounded-2xl border border-amber-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                          {item.code}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {item.kpi_type}
                        </span>
                      </div>

                      <div className="mt-2 font-semibold text-slate-900">
                        {item.custom_label || item.name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {item.category} · {item.override_frequency || item.frequency}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveManualValue(item)}
                      disabled={saving === `manual-${item.id}`}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving === `manual-${item.id}` ? t('kpiAdmin.saving') : t('kpiAdmin.loadValue')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="enterprise-card space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t('kpiAdmin.createCustomKpi')}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {t('kpiAdmin.createCustomSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder={t('kpiAdmin.optionalCode')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('kpiAdmin.kpiName')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="estrategico">{t('kpiAdmin.categories.strategic')}</option>
              <option value="operacional">{t('kpiAdmin.categories.operational')}</option>
              <option value="riesgo">{t('kpiAdmin.categories.risk')}</option>
              <option value="cumplimiento">{t('kpiAdmin.categories.compliance')}</option>
              <option value="cliente">{t('kpiAdmin.categories.client')}</option>
              <option value="industrial">{t('kpiAdmin.categories.industrial')}</option>
              <option value="financiero">{t('kpiAdmin.categories.financial')}</option>
              <option value="personalizado">{t('kpiAdmin.categories.custom')}</option>
            </select>

            <select
              value={form.kpi_type}
              onChange={(e) => setForm({ ...form, kpi_type: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="manual">{t('kpiAdmin.types.manual')}</option>
              <option value="hibrido">{t('kpiAdmin.types.hybrid')}</option>
              <option value="automatico">{t('kpiAdmin.types.automatic')}</option>
            </select>

            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder={t('kpiAdmin.unit')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="mensual">{t('kpiAdmin.frequency.monthly')}</option>
              <option value="trimestral">{t('kpiAdmin.frequency.quarterly')}</option>
              <option value="semestral">{t('kpiAdmin.frequency.semiannual')}</option>
              <option value="anual">{t('kpiAdmin.frequency.annual')}</option>
            </select>

            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="higher_is_better">{t('kpiAdmin.directionHigher')}</option>
              <option value="lower_is_better">{t('kpiAdmin.directionLower')}</option>
              <option value="target_range">{t('kpiAdmin.directionTargetRange')}</option>
            </select>

            <input
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              placeholder={t('kpiAdmin.target')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('kpiAdmin.description')}
            className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={form.base_formula}
              onChange={(e) => setForm({ ...form, base_formula: e.target.value })}
              placeholder={t('kpiAdmin.baseFormula')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.formula_expression}
              onChange={(e) => setForm({ ...form, formula_expression: e.target.value })}
              placeholder={t('kpiAdmin.formulaExpression')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.data_source_summary}
              onChange={(e) => setForm({ ...form, data_source_summary: e.target.value })}
              placeholder={t('kpiAdmin.dataSource')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <input
              value={form.green_min}
              onChange={(e) => setForm({ ...form, green_min: e.target.value })}
              placeholder={t('kpiAdmin.greenMin')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.green_max}
              onChange={(e) => setForm({ ...form, green_max: e.target.value })}
              placeholder={t('kpiAdmin.greenMax')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.yellow_min}
              onChange={(e) => setForm({ ...form, yellow_min: e.target.value })}
              placeholder={t('kpiAdmin.yellowMin')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.yellow_max}
              onChange={(e) => setForm({ ...form, yellow_max: e.target.value })}
              placeholder={t('kpiAdmin.yellowMax')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.red_min}
              onChange={(e) => setForm({ ...form, red_min: e.target.value })}
              placeholder={t('kpiAdmin.redMin')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.red_max}
              onChange={(e) => setForm({ ...form, red_max: e.target.value })}
              placeholder={t('kpiAdmin.redMax')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-700">
              {t('kpiAdmin.associateStandards')}
            </div>

            {loadingStandards ? (
              <div className="text-sm text-slate-500">{t('kpiAdmin.loadingStandards')}</div>
            ) : standards.length === 0 ? (
              <div className="text-sm text-slate-500">{t('kpiAdmin.noActiveStandards')}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {standards.map((s) => {
                  const checked = form.standard_codes.includes(s.code);

                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => toggleStandardCode(s.code)}
                      className={[
                        'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                        checked
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      ].join(' ')}
                    >
                      {s.code}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={createCustomKpi}
              disabled={saving === 'create'}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving === 'create' ? t('health.creating') : t('kpiAdmin.createCustomKpi')}
            </button>
          </div>
        </section>

        <section className="enterprise-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t('kpiAdmin.kpiList')}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {t('kpiAdmin.kpiListSubtitle')}
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {t('common.refresh')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('kpiAdmin.searchPlaceholder')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">{t('kpiAdmin.allOrigins')}</option>
              <option value="standard">{t('kpiAdmin.onlyStandard')}</option>
              <option value="custom">{t('kpiAdmin.onlyCustom')}</option>
              <option value="health">{t('kpiAdmin.onlyHealth')}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">{t('kpiAdmin.allStatuses')}</option>
              <option value="enabled">{t('kpiAdmin.enabled')}</option>
              <option value="disabled">{t('kpiAdmin.disabled')}</option>
            </select>

            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">{t('health.allStandards')}</option>
              {availableStandards.map((standard) => (
                <option key={standard.code} value={standard.code}>
                  {standard.code}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">{t('kpiAdmin.allCategories')}</option>
              <option value="estrategico">{t('kpiAdmin.categories.strategic')}</option>
              <option value="operacional">{t('kpiAdmin.categories.operational')}</option>
              <option value="riesgo">{t('kpiAdmin.categories.risk')}</option>
              <option value="cumplimiento">{t('kpiAdmin.categories.compliance')}</option>
              <option value="cliente">{t('kpiAdmin.categories.client')}</option>
              <option value="industrial">{t('kpiAdmin.categories.industrial')}</option>
              <option value="financiero">{t('kpiAdmin.categories.financial')}</option>
              <option value="personalizado">{t('kpiAdmin.categories.custom')}</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">{t('kpiAdmin.allTypes')}</option>
              <option value="manual">{t('kpiAdmin.types.manual')}</option>
              <option value="hibrido">{t('kpiAdmin.types.hybrid')}</option>
              <option value="automatico">{t('kpiAdmin.types.automatic')}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">
              {t('kpiAdmin.showing')} <span className="font-semibold text-slate-900">{filtered.length}</span> {t('kpiAdmin.of')}{' '}
              <span className="font-semibold text-slate-900">{data.length}</span> KPI(s)
            </div>

            <button
              type="button"
              onClick={() => {
                setFilter('');
                setCategoryFilter('');
                setTypeFilter('');
                setStatusFilter('');
                setOriginFilter('');
                setStandardFilter('');
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.clearFilters')}
            </button>
          </div>

          {loading ? (
            <div className="text-slate-500">{t('kpiAdmin.loadingKpis')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500">{t('kpiAdmin.noKpisFound')}</div>
          ) : (
            <div className="space-y-4">
              {filtered.map((item) => {
                const health = isHealthKpi(item);
                const latestSnapshots = item.latest_snapshots || [];

                return (
                  <div
                    key={item.id}
                    className={[
                      'rounded-2xl border p-5 space-y-4',
                      health
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-slate-200 bg-slate-50'
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                            {item.code}
                          </span>

                          {health ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {t('kpiAdmin.healthEngine')}
                            </span>
                          ) : (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                item.is_standard
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {item.is_standard ? t('kpiAdmin.standard') : t('kpiAdmin.custom')}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.is_enabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {item.is_enabled ? t('kpiAdmin.enabled') : t('kpiAdmin.disabled')}
                          </span>

                          {item.latest_status_color && (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorBadgeClass(
                                item.latest_status_color
                              )}`}
                            >
                              {colorLabel(item.latest_status_color, t)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xl font-semibold text-slate-900">
                          {item.custom_label || item.name}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {item.custom_description || item.description || t('header.noDescription')}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {(item.applicable_standards || []).map((code) => (
                            <span
                              key={`${item.id}-${code}`}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        <InfoBox label={t('kpiAdmin.category')} value={item.category} />
                        <InfoBox label={t('kpiAdmin.type')} value={item.kpi_type} />
                        <InfoBox label={t('kpiAdmin.unit')} value={item.unit} />
                        <InfoBox label={t('kpiAdmin.frequencyLabel')} value={item.override_frequency || item.frequency} />
                        <InfoBox label={t('kpiAdmin.direction')} value={item.override_direction || item.direction} />
                        <InfoBox
                          label={t('kpiAdmin.target')}
                          value={item.override_target_value ?? item.target_value ?? t('common.noData')}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {t('kpiAdmin.latestCalculatedValue')}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t('common.period')}: {formatDate(item.latest_period_start)} - {formatDate(item.latest_period_end)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-3xl font-bold text-slate-900">
                            {formatNumber(item.latest_value)}
                            {item.unit === '%' ? '%' : item.unit ? ` ${item.unit}` : ''}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t('kpiAdmin.calculated')}: {formatDate(item.latest_calculated_at)}
                          </div>
                        </div>
                      </div>

                      {latestSnapshots.length > 1 && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t('kpiAdmin.detailByScope')}
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                            {latestSnapshots.map((snap, idx) => (
                              <div
                                key={`${item.id}-${snap.standard_code || 'GLOBAL'}-${idx}`}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-600">
                                    {snap.standard_code || t('kpiAdmin.global')}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorBadgeClass(
                                      snap.status_color
                                    )}`}
                                  >
                                    {colorLabel(snap.status_color, t)}
                                  </span>
                                </div>

                                <div className="mt-2 text-xl font-bold text-slate-900">
                                  {formatNumber(snap.value)}
                                  {item.unit === '%' ? '%' : item.unit ? ` ${item.unit}` : ''}
                                </div>

                                <div className="mt-1 text-[11px] text-slate-500">
                                  {snap.period_type || item.frequency}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {health && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          {t('kpiAdmin.healthKpiNotice')}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {health ? (
                        <a
                          href="/iso-health?tab=kpis"
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          {t('kpiAdmin.viewHealthDashboard')}
                        </a>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleTenantEnabled(item)}
                            disabled={saving === `toggle-${item.id}`}
                            className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                          >
                            {saving === `toggle-${item.id}`
                              ? t('kpiAdmin.saving')
                              : item.is_enabled
                              ? t('kpiAdmin.disable')
                              : t('kpiAdmin.enable')}
                          </button>

                          {!item.is_standard && (
                            <button
                              type="button"
                              onClick={() => editCustomKpi(item)}
                              disabled={saving === `edit-custom-${item.id}`}
                              className="rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                            >
                              {saving === `edit-custom-${item.id}` ? t('kpiAdmin.saving') : t('kpiAdmin.editKpi')}
                            </button>
                          )}

                          {!item.is_standard && (
                            <button
                              type="button"
                              onClick={() => deleteCustomKpi(item)}
                              disabled={saving === `delete-custom-${item.id}`}
                              className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {saving === `delete-custom-${item.id}` ? t('kpiAdmin.deleting') : t('kpiAdmin.deleteKpi')}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateTenantCustomization(item)}
                            disabled={saving === `customize-${item.id}`}
                            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {saving === `customize-${item.id}` ? t('kpiAdmin.saving') : t('kpiAdmin.customizeTenant')}
                          </button>

                          {item.kpi_type !== 'automatico' && (
                            <button
                              type="button"
                              onClick={() => saveManualValue(item)}
                              disabled={saving === `manual-${item.id}`}
                              className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                            >
                              {saving === `manual-${item.id}` ? t('kpiAdmin.saving') : t('kpiAdmin.saveManualValue')}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {!item.is_standard && !health && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                        {t('kpiAdmin.customTenantNotice')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <EnterpriseKpiCard
      label={title}
      value={value}
      tone="info"
    />
  );
}

function InfoBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
