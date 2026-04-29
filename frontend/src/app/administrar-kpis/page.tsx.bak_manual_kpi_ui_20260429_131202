'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

function colorLabel(color?: string | null) {
  if (color === 'green') return 'Verde';
  if (color === 'yellow') return 'Amarillo';
  if (color === 'red') return 'Rojo';
  return 'Sin dato';
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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

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

    if (!authToken || !u?.tenant_id) {
      setLoading(false);
      setLoadingStandards(false);
    }
  }, []);

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

    if (!form.name.trim()) {
      alert('El nombre es obligatorio');
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
        alert(json.error || 'Error creando KPI personalizado');
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
      alert('KPI personalizado creado correctamente');
    } catch (err) {
      console.error('ERROR CREATE KPI:', err);
      alert('Error creando KPI personalizado');
    } finally {
      setSaving('');
    }
  };

  const toggleTenantEnabled = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;

    if (isHealthKpi(item)) {
      alert('Los KPIs de salud son automáticos del sistema y no se deshabilitan desde esta vista.');
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
        alert(json.error || 'Error actualizando KPI');
        return;
      }

      await refresh();
    } catch (err) {
      console.error('ERROR TOGGLE KPI:', err);
      alert('Error actualizando KPI');
    } finally {
      setSaving('');
    }
  };

  const updateTenantCustomization = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;

    if (isHealthKpi(item)) {
      alert('Los KPIs de salud son gestionados automáticamente por el motor Health.');
      return;
    }

    const customLabel =
      window.prompt('Etiqueta personalizada del KPI', item.custom_label || item.name) ??
      item.custom_label ??
      item.name;

    const customDescription =
      window.prompt('Descripción personalizada', item.custom_description || item.description || '') ??
      item.custom_description ??
      item.description ??
      '';

    const overrideFrequency =
      window.prompt(
        'Frecuencia: mensual / trimestral / semestral / anual',
        item.override_frequency || item.frequency
      ) ??
      item.override_frequency ??
      item.frequency;

    const overrideDirection =
      window.prompt(
        'Dirección: higher_is_better / lower_is_better / target_range',
        item.override_direction || item.direction
      ) ??
      item.override_direction ??
      item.direction;

    const overrideTargetValue =
      window.prompt(
        'Objetivo numérico',
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
        alert(json.error || 'Error personalizando KPI');
        return;
      }

      await refresh();
      alert('KPI actualizado para este tenant');
    } catch (err) {
      console.error('ERROR CUSTOMIZE KPI:', err);
      alert('Error personalizando KPI');
    } finally {
      setSaving('');
    }
  };

  const editCustomKpi = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (item.is_standard) {
      alert('Este endpoint es solo para KPIs personalizados');
      return;
    }

    const name = window.prompt('Nombre del KPI', item.name) ?? item.name;
    const description =
      window.prompt('Descripción', item.description || '') ?? item.description ?? '';
    const category =
      window.prompt(
        'Categoría: estrategico / operacional / riesgo / cumplimiento / cliente / industrial / financiero / personalizado',
        item.category
      ) ?? item.category;
    const kpiType =
      window.prompt('Tipo: manual / hibrido / automatico', item.kpi_type) ?? item.kpi_type;
    const unit = window.prompt('Unidad', item.unit) ?? item.unit;
    const frequency =
      window.prompt(
        'Frecuencia: mensual / trimestral / semestral / anual',
        item.override_frequency || item.frequency
      ) ?? (item.override_frequency || item.frequency);
    const direction =
      window.prompt(
        'Dirección: higher_is_better / lower_is_better / target_range',
        item.override_direction || item.direction
      ) ?? (item.override_direction || item.direction);
    const targetValue =
      window.prompt(
        'Objetivo numérico',
        String(item.override_target_value ?? item.target_value ?? '')
      ) ?? String(item.override_target_value ?? item.target_value ?? '');
    const greenMin =
      window.prompt('Verde min', String(item.thresholds?.green_min ?? '')) ??
      String(item.thresholds?.green_min ?? '');
    const greenMax =
      window.prompt('Verde max', String(item.thresholds?.green_max ?? '')) ??
      String(item.thresholds?.green_max ?? '');
    const yellowMin =
      window.prompt('Amarillo min', String(item.thresholds?.yellow_min ?? '')) ??
      String(item.thresholds?.yellow_min ?? '');
    const yellowMax =
      window.prompt('Amarillo max', String(item.thresholds?.yellow_max ?? '')) ??
      String(item.thresholds?.yellow_max ?? '');
    const redMin =
      window.prompt('Rojo min', String(item.thresholds?.red_min ?? '')) ??
      String(item.thresholds?.red_min ?? '');
    const redMax =
      window.prompt('Rojo max', String(item.thresholds?.red_max ?? '')) ??
      String(item.thresholds?.red_max ?? '');

    const standardCodesRaw =
      window.prompt(
        'Normas asociadas separadas por coma',
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
        alert(json.error || 'Error editando KPI personalizado');
        return;
      }

      await refresh();
      alert('KPI personalizado actualizado');
    } catch (err) {
      console.error('ERROR EDIT CUSTOM KPI:', err);
      alert('Error editando KPI personalizado');
    } finally {
      setSaving('');
    }
  };

  const deleteCustomKpi = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;
    if (item.is_standard) {
      alert('Solo se pueden eliminar KPIs personalizados');
      return;
    }

    const ok = window.confirm(
      `¿Eliminar el KPI personalizado "${item.name}"? Esta acción no se puede deshacer.`
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
        alert(json.error || 'Error eliminando KPI personalizado');
        return;
      }

      await refresh();
      alert('KPI personalizado eliminado');
    } catch (err) {
      console.error('ERROR DELETE CUSTOM KPI:', err);
      alert('Error eliminando KPI personalizado');
    } finally {
      setSaving('');
    }
  };

  const saveManualValue = async (item: KpiAdminItem) => {
    if (!token || !user?.tenant_id) return;

    if (isHealthKpi(item)) {
      alert('Los KPIs de salud se calculan automáticamente desde Health.');
      return;
    }

    if (item.kpi_type === 'automatico') {
      alert('Este KPI es automático y no permite carga manual.');
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let periodStart = new Date(year, month, 1);
    let periodEnd = new Date(year, month + 1, 0);

    if ((item.override_frequency || item.frequency) === 'trimestral') {
      const startMonth = Math.floor(month / 3) * 3;
      periodStart = new Date(year, startMonth, 1);
      periodEnd = new Date(year, startMonth + 3, 0);
    }

    if ((item.override_frequency || item.frequency) === 'semestral') {
      const startMonth = month < 6 ? 0 : 6;
      periodStart = new Date(year, startMonth, 1);
      periodEnd = new Date(year, startMonth + 6, 0);
    }

    if ((item.override_frequency || item.frequency) === 'anual') {
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31);
    }

    const value = window.prompt(`Valor manual para ${item.name}`, '');

    if (value === null) return;

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
          standard_code: item.applicable_standards?.[0] || null,
          period_type: item.override_frequency || item.frequency,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          value
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error guardando valor manual');
        return;
      }

      alert('Valor manual guardado correctamente');
    } catch (err) {
      console.error('ERROR SAVE KPI MANUAL VALUE:', err);
      alert('Error guardando valor manual');
    } finally {
      setSaving('');
    }
  };

  const recalculateKpis = async () => {
    if (!token || !user?.tenant_id) return;

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
        alert(json.error || 'Error recalculando KPIs');
        return;
      }

      await refresh();

      const kpisRecalculated = Number(
        json?.snapshots_created ?? json?.recalculated ?? 0
      );

      const healthRecalculated = getHealthRefreshCount(json);

      alert(
        `KPIs recalculados: ${kpisRecalculated}\nKPIs Health recalculados: ${healthRecalculated}`
      );
    } catch (err) {
      console.error('ERROR RECALCULATE KPI:', err);
      alert('Error recalculando KPIs');
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

  return (
    <AppLayout>
      <div className="p-6 bg-[#f5f7fb] min-h-screen space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Administrar KPIs</h1>
            <p className="mt-2 text-slate-500">
              Gestiona KPIs estándar, personalizados y KPIs automáticos del motor Health.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/health"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              Ver Health
            </a>

            <button
              type="button"
              onClick={recalculateKpis}
              disabled={saving === 'recalculate'}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving === 'recalculate' ? 'Recalculando...' : 'Recalcular KPIs'}
            </button>

            <a
              href="/dashboard"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Volver al Dashboard
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="KPIs totales" value={stats.total} />
          <MetricCard title="Habilitados" value={stats.enabled} />
          <MetricCard title="Estándar" value={stats.standard} />
          <MetricCard title="Health" value={stats.health} />
          <MetricCard title="Personalizados" value={stats.custom} />
          <MetricCard title="Filtrados" value={stats.filtered} />
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Crear KPI personalizado</h2>
            <p className="text-sm text-slate-500 mt-1">
              Este KPI se administra desde el sistema y puede asignarse a una o más normas contratadas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Código opcional"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre KPI"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="estrategico">Estratégico</option>
              <option value="operacional">Operacional</option>
              <option value="riesgo">Riesgo</option>
              <option value="cumplimiento">Cumplimiento</option>
              <option value="cliente">Cliente</option>
              <option value="industrial">Industrial</option>
              <option value="financiero">Financiero</option>
              <option value="personalizado">Personalizado</option>
            </select>

            <select
              value={form.kpi_type}
              onChange={(e) => setForm({ ...form, kpi_type: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="manual">Manual</option>
              <option value="hibrido">Híbrido</option>
              <option value="automatico">Automático</option>
            </select>

            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="Unidad"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>

            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="higher_is_better">Más alto es mejor</option>
              <option value="lower_is_better">Más bajo es mejor</option>
              <option value="target_range">Rango óptimo</option>
            </select>

            <input
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              placeholder="Objetivo"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción"
            className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={form.base_formula}
              onChange={(e) => setForm({ ...form, base_formula: e.target.value })}
              placeholder="Fórmula base"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.formula_expression}
              onChange={(e) => setForm({ ...form, formula_expression: e.target.value })}
              placeholder="Fórmula expresión"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.data_source_summary}
              onChange={(e) => setForm({ ...form, data_source_summary: e.target.value })}
              placeholder="Fuente de datos"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <input
              value={form.green_min}
              onChange={(e) => setForm({ ...form, green_min: e.target.value })}
              placeholder="Verde min"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.green_max}
              onChange={(e) => setForm({ ...form, green_max: e.target.value })}
              placeholder="Verde max"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.yellow_min}
              onChange={(e) => setForm({ ...form, yellow_min: e.target.value })}
              placeholder="Amarillo min"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.yellow_max}
              onChange={(e) => setForm({ ...form, yellow_max: e.target.value })}
              placeholder="Amarillo max"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.red_min}
              onChange={(e) => setForm({ ...form, red_min: e.target.value })}
              placeholder="Rojo min"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
            <input
              value={form.red_max}
              onChange={(e) => setForm({ ...form, red_max: e.target.value })}
              placeholder="Rojo max"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-700">
              Asociar a normas contratadas
            </div>

            {loadingStandards ? (
              <div className="text-sm text-slate-500">Cargando normas...</div>
            ) : standards.length === 0 ? (
              <div className="text-sm text-slate-500">No hay normas activas disponibles.</div>
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
              {saving === 'create' ? 'Creando...' : 'Crear KPI personalizado'}
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Listado de KPIs</h2>
              <p className="text-sm text-slate-500 mt-1">
                Aquí se listan los KPIs disponibles, sus configuraciones y sus últimos valores calculados.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Refrescar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por código, nombre o descripción"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Todos los orígenes</option>
              <option value="standard">Solo estándar</option>
              <option value="custom">Solo personalizados</option>
              <option value="health">Solo Health</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Todos los estados</option>
              <option value="enabled">Habilitados</option>
              <option value="disabled">Deshabilitados</option>
            </select>

            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Todas las normas</option>
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
              <option value="">Todas las categorías</option>
              <option value="estrategico">Estratégico</option>
              <option value="operacional">Operacional</option>
              <option value="riesgo">Riesgo</option>
              <option value="cumplimiento">Cumplimiento</option>
              <option value="cliente">Cliente</option>
              <option value="industrial">Industrial</option>
              <option value="financiero">Financiero</option>
              <option value="personalizado">Personalizado</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">Todos los tipos</option>
              <option value="manual">Manual</option>
              <option value="hibrido">Híbrido</option>
              <option value="automatico">Automático</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">
              Mostrando <span className="font-semibold text-slate-900">{filtered.length}</span> de{' '}
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
              Limpiar filtros
            </button>
          </div>

          {loading ? (
            <div className="text-slate-500">Cargando KPIs...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500">No se encontraron KPIs con esos filtros.</div>
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
                              Motor Health
                            </span>
                          ) : (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                item.is_standard
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {item.is_standard ? 'Estándar' : 'Personalizado'}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.is_enabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {item.is_enabled ? 'Habilitado' : 'Deshabilitado'}
                          </span>

                          {item.latest_status_color && (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorBadgeClass(
                                item.latest_status_color
                              )}`}
                            >
                              {colorLabel(item.latest_status_color)}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 text-xl font-semibold text-slate-900">
                          {item.custom_label || item.name}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {item.custom_description || item.description || 'Sin descripción'}
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
                        <InfoBox label="Categoría" value={item.category} />
                        <InfoBox label="Tipo" value={item.kpi_type} />
                        <InfoBox label="Unidad" value={item.unit} />
                        <InfoBox label="Frecuencia" value={item.override_frequency || item.frequency} />
                        <InfoBox label="Dirección" value={item.override_direction || item.direction} />
                        <InfoBox
                          label="Objetivo"
                          value={item.override_target_value ?? item.target_value ?? 'N/A'}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Último valor calculado
                          </div>
                          <div className="text-xs text-slate-500">
                            Período: {formatDate(item.latest_period_start)} - {formatDate(item.latest_period_end)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-3xl font-bold text-slate-900">
                            {formatNumber(item.latest_value)}
                            {item.unit === '%' ? '%' : item.unit ? ` ${item.unit}` : ''}
                          </div>
                          <div className="text-xs text-slate-500">
                            Calculado: {formatDate(item.latest_calculated_at)}
                          </div>
                        </div>
                      </div>

                      {latestSnapshots.length > 1 && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Detalle por norma / alcance
                          </div>

                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                            {latestSnapshots.map((snap, idx) => (
                              <div
                                key={`${item.id}-${snap.standard_code || 'GLOBAL'}-${idx}`}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-600">
                                    {snap.standard_code || 'Global'}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorBadgeClass(
                                      snap.status_color
                                    )}`}
                                  >
                                    {colorLabel(snap.status_color)}
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
                          KPI automático generado desde el motor de salud de controles. Su valor proviene de
                          evidencias, estado de controles, cobertura y deterioro. Para ver el detalle operacional,
                          usa el Dashboard de Salud ISO.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {health ? (
                        <a
                          href="/health"
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Ver Dashboard Health
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
                              ? 'Guardando...'
                              : item.is_enabled
                              ? 'Deshabilitar'
                              : 'Habilitar'}
                          </button>

                          {!item.is_standard && (
                            <button
                              type="button"
                              onClick={() => editCustomKpi(item)}
                              disabled={saving === `edit-custom-${item.id}`}
                              className="rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                            >
                              {saving === `edit-custom-${item.id}` ? 'Guardando...' : 'Editar KPI'}
                            </button>
                          )}

                          {!item.is_standard && (
                            <button
                              type="button"
                              onClick={() => deleteCustomKpi(item)}
                              disabled={saving === `delete-custom-${item.id}`}
                              className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {saving === `delete-custom-${item.id}` ? 'Eliminando...' : 'Eliminar KPI'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateTenantCustomization(item)}
                            disabled={saving === `customize-${item.id}`}
                            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {saving === `customize-${item.id}` ? 'Guardando...' : 'Personalizar tenant'}
                          </button>

                          {item.kpi_type !== 'automatico' && (
                            <button
                              type="button"
                              onClick={() => saveManualValue(item)}
                              disabled={saving === `manual-${item.id}`}
                              className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                            >
                              {saving === `manual-${item.id}` ? 'Guardando...' : 'Cargar valor manual'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {!item.is_standard && !health && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                        KPI personalizado del tenant. Puedes editarlo directamente con el botón “Editar KPI”.
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
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-5xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
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
