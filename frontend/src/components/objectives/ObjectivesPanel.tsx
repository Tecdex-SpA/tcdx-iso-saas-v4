'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel } from '@/i18n/statusLabels';
import { translateDisplayText } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type StandardOption = {
  code: string;
  name?: string;
};

type ObjectiveItem = {
  id: string;
  tenant_id: string;
  standard_code?: string | null;
  title: string;
  description?: string | null;
  owner?: string | null;
  period_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  target_value?: string | number | null;
  actual_value?: string | number | null;
  progress_percent?: string | number | null;
  status: string;
  is_active: boolean;
  evidence_url?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  status_updated_at?: string | null;
};

type ObjectiveForm = {
  id?: string;
  standard_code: string;
  title: string;
  description: string;
  owner: string;
  period_type: string;
  period_start: string;
  period_end: string;
  target_value: string;
  actual_value: string;
  progress_percent: string;
  status: string;
  evidence_url: string;
  notes: string;
};

const emptyForm: ObjectiveForm = {
  standard_code: '',
  title: '',
  description: '',
  owner: '',
  period_type: 'mensual',
  period_start: '',
  period_end: '',
  target_value: '',
  actual_value: '',
  progress_percent: '',
  status: 'en_progreso',
  evidence_url: '',
  notes: '',
};

const ui = {
  es: {
    kpiCode: 'KPI-01',
    systemObjectives: 'Objetivos del sistema de gestión',
    systemObjectivesTitle: 'Objetivos del Sistema de Gestión',
    intro:
      'Define objetivos por norma, responsable, período y avance. Estos registros alimentan el KPI-01 Cumplimiento de Objetivos. El sistema ajusta automáticamente el estado si el avance llega a 100% o si la fecha de término venció.',
    newObjective: 'Nuevo objetivo',
    editObjective: 'Editar objetivo',
    closeForm: 'Cerrar formulario',
    refresh: 'Actualizar',
    refreshing: 'Actualizando...',
    activeObjectives: 'Objetivos activos',
    completed: 'Cumplidos',
    inProgress: 'En progreso',
    overdue: 'Atrasados',
    compliance: 'Cumplimiento',
    standard: 'Norma',
    allStandards: 'Todas',
    status: 'Estado',
    allStatuses: 'Todos',
    clearFilters: 'Limpiar filtros',
    formHelp: 'El avance puede calcularse por meta/valor actual o ingresarse manualmente.',
    cancel: 'Cancelar',
    title: 'Título',
    owner: 'Responsable',
    suggestedStatus: 'Estado sugerido',
    period: 'Periodo',
    periodStart: 'Inicio',
    periodEnd: 'Fin',
    target: 'Meta',
    actual: 'Valor actual',
    progress: 'Avance %',
    progressShort: 'avance',
    evidenceUrl: 'URL evidencia',
    description: 'Descripción',
    notes: 'Notas',
    saveObjective: 'Guardar objetivo',
    saving: 'Guardando...',
    objectivesList: 'Listado de objetivos',
    loadingObjectives: 'Cargando objetivos...',
    emptyObjectives: 'No hay objetivos registrados. Crea al menos un objetivo para alimentar KPI-01.',
    records: 'registro(s)',
    noDate: 'Sin fecha',
    noDescription: 'Sin descripción',
    notAvailable: 'N/D',
    global: 'Global',
    created: 'Creado',
    updated: 'Actualizado',
    createdBy: 'Creado por',
    updatedBy: 'Actualizado por',
    evidence: 'Evidencia',
    edit: 'Editar',
    deleteConfirm: (title: string) => `¿Eliminar/cancelar el objetivo "${title}"?`,
    titleRequired: 'El título del objetivo es obligatorio.',
    loadError: 'Error cargando objetivos',
    saveError: 'Error guardando objetivo',
    deleteError: 'Error eliminando objetivo',
    kpiNoTenant: 'No existe tenant_id para recalcular KPI-01.',
    kpiRecalculateError: 'No se pudo recalcular KPI-01.',
    kpiRecalculateException: 'Error recalculando KPI-01.',
    kpiUpdated: 'KPI-01 actualizado correctamente.',
    savedWithKpi: 'Objetivo guardado correctamente y KPI-01 actualizado.',
    savedWithoutKpi: (message: string) =>
      `Objetivo guardado correctamente, pero no se pudo recalcular KPI-01: ${message}`,
    cancelledWithKpi: 'Objetivo cancelado correctamente y KPI-01 actualizado.',
    cancelledWithoutKpi: (message: string) =>
      `Objetivo cancelado correctamente, pero no se pudo recalcular KPI-01: ${message}`,
    periodMonthly: 'Mensual',
    periodQuarterly: 'Trimestral',
    periodSemiannual: 'Semestral',
    periodAnnual: 'Anual',
  },
  en: {
    kpiCode: 'KPI-01',
    systemObjectives: 'Management system objectives',
    systemObjectivesTitle: 'Management System Objectives',
    intro:
      'Define objectives by standard, owner, period, and progress. These records feed KPI-01 Objectives Compliance. The system automatically adjusts the status when progress reaches 100% or when the end date is overdue.',
    newObjective: 'New objective',
    editObjective: 'Edit objective',
    closeForm: 'Close form',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    activeObjectives: 'Active objectives',
    completed: 'Completed',
    inProgress: 'In progress',
    overdue: 'Overdue',
    compliance: 'Compliance',
    standard: 'Standard',
    allStandards: 'All',
    status: 'Status',
    allStatuses: 'All',
    clearFilters: 'Clear filters',
    formHelp: 'Progress can be calculated from target/current value or entered manually.',
    cancel: 'Cancel',
    title: 'Title',
    owner: 'Owner',
    suggestedStatus: 'Suggested status',
    period: 'Period',
    periodStart: 'Start',
    periodEnd: 'End',
    target: 'Target',
    actual: 'Actual value',
    progress: 'Progress %',
    progressShort: 'progress',
    evidenceUrl: 'Evidence URL',
    description: 'Description',
    notes: 'Notes',
    saveObjective: 'Save objective',
    saving: 'Saving...',
    objectivesList: 'Objective list',
    loadingObjectives: 'Loading objectives...',
    emptyObjectives: 'No objectives have been registered. Create at least one objective to feed KPI-01.',
    records: 'record(s)',
    noDate: 'No date',
    noDescription: 'No description',
    notAvailable: 'N/A',
    global: 'Global',
    created: 'Created',
    updated: 'Updated',
    createdBy: 'Created by',
    updatedBy: 'Updated by',
    evidence: 'Evidence',
    edit: 'Edit',
    deleteConfirm: (title: string) => `Delete/cancel the objective "${title}"?`,
    titleRequired: 'The objective title is required.',
    loadError: 'Error loading objectives',
    saveError: 'Error saving objective',
    deleteError: 'Error deleting objective',
    kpiNoTenant: 'No tenant_id is available to recalculate KPI-01.',
    kpiRecalculateError: 'KPI-01 could not be recalculated.',
    kpiRecalculateException: 'Error recalculating KPI-01.',
    kpiUpdated: 'KPI-01 updated successfully.',
    savedWithKpi: 'Objective saved successfully and KPI-01 updated.',
    savedWithoutKpi: (message: string) =>
      `Objective saved successfully, but KPI-01 could not be recalculated: ${message}`,
    cancelledWithKpi: 'Objective cancelled successfully and KPI-01 updated.',
    cancelledWithoutKpi: (message: string) =>
      `Objective cancelled successfully, but KPI-01 could not be recalculated: ${message}`,
    periodMonthly: 'Monthly',
    periodQuarterly: 'Quarterly',
    periodSemiannual: 'Semiannual',
    periodAnnual: 'Annual',
  },
} as const;

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function formatPct(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n)}%`;
}

function formatDate(value?: string | null, locale = 'es') {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL');
  } catch {
    return null;
  }
}

function statusClass(status: string) {
  const s = String(status || '').toLowerCase();

  if (s === 'cumplido') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'atrasado') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'pendiente') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (s === 'cancelado') return 'bg-slate-100 text-slate-500 border-slate-200';

  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function displayText(value: string | number | null | undefined, locale: 'es' | 'en') {
  return translateDisplayText(value, locale, 'objective');
}

function standardLabel(value: string | null | undefined) {
  if (!value) return '';
  const normalized = String(value).replace(/\s+/g, '').toUpperCase();
  if (normalized === 'ISO9001') return 'ISO 9001';
  if (normalized === 'ISO27001') return 'ISO 27001';
  if (normalized === 'ISO22301') return 'ISO 22301';
  if (normalized === 'ISO14001') return 'ISO 14001';
  if (normalized === 'ISO20000-1' || normalized === 'ISO200001') return 'ISO 20000-1';
  return String(value);
}

export default function ObjectivesPanel({
  tenantId,
  standards,
}: {
  tenantId: string;
  standards: StandardOption[];
}) {
  const { locale, t } = useTranslation();
  const lang = locale === 'en' ? 'en' : 'es';
  const copy = ui[lang];

  const [items, setItems] = useState<ObjectiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [standardFilter, setStandardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [form, setForm] = useState<ObjectiveForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const renderDate = (value?: string | null) => formatDate(value, lang) || copy.noDate;

  const loadData = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();

      if (standardFilter !== 'ALL') params.set('standard_code', standardFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const url = `${API_URL}/api/objectives/${tenantId}${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await res.json();

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || copy.loadError);
      }

      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      setError(err.message || copy.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, standardFilter, statusFilter, lang]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.is_active);
    const completed = active.filter((item) => item.status === 'cumplido').length;
    const overdue = active.filter((item) => item.status === 'atrasado').length;
    const avgProgress = active.length
      ? active.reduce((acc, item) => acc + toNumber(item.progress_percent), 0) /
        active.length
      : 0;

    return {
      total: active.length,
      completed,
      inProgress: active.filter((item) => item.status === 'en_progreso').length,
      overdue,
      avgProgress,
      compliancePct: active.length ? Math.round((completed / active.length) * 100) : 0,
    };
  }, [items]);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const editItem = (item: ObjectiveItem) => {
    setForm({
      id: item.id,
      standard_code: item.standard_code || '',
      title: item.title || '',
      description: item.description || '',
      owner: item.owner || '',
      period_type: item.period_type || 'mensual',
      period_start: item.period_start ? String(item.period_start).slice(0, 10) : '',
      period_end: item.period_end ? String(item.period_end).slice(0, 10) : '',
      target_value:
        item.target_value === null || item.target_value === undefined
          ? ''
          : String(item.target_value),
      actual_value:
        item.actual_value === null || item.actual_value === undefined
          ? ''
          : String(item.actual_value),
      progress_percent:
        item.progress_percent === null || item.progress_percent === undefined
          ? ''
          : String(item.progress_percent),
      status: item.status || 'en_progreso',
      evidence_url: item.evidence_url || '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const recalculateKpisAfterObjectiveChange = async () => {
    if (!tenantId) {
      return {
        ok: false,
        message: copy.kpiNoTenant,
      };
    }

    try {
      setSaving('recalculate-kpi01');

      const res = await fetch(`${API_URL}/api/kpis/recalculate/${tenantId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          ok: false,
          message: json.error || json.detail || copy.kpiRecalculateError,
        };
      }

      return {
        ok: true,
        message: copy.kpiUpdated,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || copy.kpiRecalculateException,
      };
    }
  };

  const saveObjective = async () => {
    if (!tenantId) return;

    const cleanTitle = form.title.trim();

    if (!cleanTitle) {
      alert(copy.titleRequired);
      return;
    }

    try {
      setSaving('save');
      setError('');

      const isEdit = Boolean(form.id);

      const res = await fetch(
        isEdit
          ? `${API_URL}/api/objectives/${form.id}`
          : `${API_URL}/api/objectives`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            standard_code: form.standard_code || null,
            title: cleanTitle,
            description: form.description || null,
            owner: form.owner || null,
            period_type: form.period_type || 'mensual',
            period_start: form.period_start || null,
            period_end: form.period_end || null,
            target_value: form.target_value || null,
            actual_value: form.actual_value || null,
            progress_percent: form.progress_percent || null,
            status: form.status,
            evidence_url: form.evidence_url || null,
            notes: form.notes || null,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || copy.saveError);
      }

      const recalcResult = await recalculateKpisAfterObjectiveChange();

      await loadData();
      resetForm();

      if (recalcResult.ok) {
        alert(copy.savedWithKpi);
      } else {
        alert(copy.savedWithoutKpi(recalcResult.message));
      }
    } catch (err: any) {
      setError(err.message || copy.saveError);
      alert(err.message || copy.saveError);
    } finally {
      setSaving('');
    }
  };

  const deleteObjective = async (item: ObjectiveItem) => {
    const ok = window.confirm(copy.deleteConfirm(item.title));
    if (!ok) return;

    try {
      setSaving(`delete-${item.id}`);

      const res = await fetch(`${API_URL}/api/objectives/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || copy.deleteError);
      }

      const recalcResult = await recalculateKpisAfterObjectiveChange();

      await loadData();

      if (recalcResult.ok) {
        alert(copy.cancelledWithKpi);
      } else {
        alert(copy.cancelledWithoutKpi(recalcResult.message));
      }
    } catch (err: any) {
      alert(err.message || copy.deleteError);
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                {copy.kpiCode}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {copy.systemObjectives}
              </span>
            </div>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {copy.systemObjectivesTitle}
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {copy.intro}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {showForm ? copy.closeForm : copy.newObjective}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? copy.refreshing : copy.refresh}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title={copy.activeObjectives} value={stats.total} />
          <MetricCard title={copy.completed} value={stats.completed} />
          <MetricCard title={copy.inProgress} value={stats.inProgress} />
          <MetricCard title={copy.overdue} value={stats.overdue} />
          <MetricCard title={copy.compliance} value={`${stats.compliancePct}%`} />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {copy.standard}
            </label>
            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">{copy.allStandards}</option>
              {standards.map((standard) => (
                <option key={standard.code} value={standard.code}>
                  {standardLabel(standard.code)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {copy.status}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">{copy.allStatuses}</option>
              <option value="pendiente">{getStatusLabel('pendiente', t)}</option>
              <option value="en_progreso">{getStatusLabel('en_progreso', t)}</option>
              <option value="cumplido">{getStatusLabel('cumplido', t)}</option>
              <option value="atrasado">{getStatusLabel('atrasado', t)}</option>
              <option value="cancelado">{getStatusLabel('cancelado', t)}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setStandardFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {copy.clearFilters}
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-[30px] border border-indigo-200 bg-indigo-50/40 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {form.id ? copy.editObjective : copy.newObjective}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {copy.formHelp}
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {copy.cancel}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label={copy.title} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Input label={copy.owner} value={form.owner} onChange={(v) => setForm({ ...form, owner: v })} />

            <Select
              label={copy.standard}
              value={form.standard_code}
              onChange={(v) => setForm({ ...form, standard_code: v })}
              options={[
                { value: '', label: copy.global },
                ...standards.map((s) => ({ value: s.code, label: standardLabel(s.code) })),
              ]}
            />

            <Select
              label={copy.suggestedStatus}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: 'pendiente', label: getStatusLabel('pendiente', t) },
                { value: 'en_progreso', label: getStatusLabel('en_progreso', t) },
                { value: 'cumplido', label: getStatusLabel('cumplido', t) },
                { value: 'atrasado', label: getStatusLabel('atrasado', t) },
                { value: 'cancelado', label: getStatusLabel('cancelado', t) },
              ]}
            />

            <Select
              label={copy.period}
              value={form.period_type}
              onChange={(v) => setForm({ ...form, period_type: v })}
              options={[
                { value: 'mensual', label: copy.periodMonthly },
                { value: 'trimestral', label: copy.periodQuarterly },
                { value: 'semestral', label: copy.periodSemiannual },
                { value: 'anual', label: copy.periodAnnual },
              ]}
            />

            <Input label={copy.periodStart} type="date" value={form.period_start} onChange={(v) => setForm({ ...form, period_start: v })} />
            <Input label={copy.periodEnd} type="date" value={form.period_end} onChange={(v) => setForm({ ...form, period_end: v })} />
            <Input label={copy.target} type="number" value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} />
            <Input label={copy.actual} type="number" value={form.actual_value} onChange={(v) => setForm({ ...form, actual_value: v })} />
            <Input label={copy.progress} type="number" value={form.progress_percent} onChange={(v) => setForm({ ...form, progress_percent: v })} />
            <Input label={copy.evidenceUrl} value={form.evidence_url} onChange={(v) => setForm({ ...form, evidence_url: v })} />

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {copy.description}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {copy.notes}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={saveObjective}
              disabled={saving === 'save'}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving === 'save' ? copy.saving : copy.saveObjective}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            {copy.objectivesList}
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {items.length} {copy.records}
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-slate-50 p-5 text-slate-500">
            {copy.loadingObjectives}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            {copy.emptyObjectives}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                        {item.standard_code ? standardLabel(item.standard_code) : copy.global}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>
                        {getStatusLabel(item.status, t)}
                      </span>
                    </div>

                    <h4 className="mt-3 text-lg font-bold text-slate-900">
                      {displayText(item.title, lang)}
                    </h4>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.description ? displayText(item.description, lang) : copy.noDescription}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                    <div className="text-3xl font-bold text-slate-900">
                      {formatPct(item.progress_percent)}
                    </div>
                    <div className="text-xs text-slate-500">{copy.progressShort}</div>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, toNumber(item.progress_percent)))}%`,
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <SmallStat label={copy.owner} value={item.owner || copy.notAvailable} />
                  <SmallStat label={copy.periodStart} value={renderDate(item.period_start)} />
                  <SmallStat label={copy.periodEnd} value={renderDate(item.period_end)} />
                  <SmallStat label={copy.target} value={item.target_value ?? copy.notAvailable} />
                  <SmallStat label={copy.created} value={renderDate(item.created_at)} />
                  <SmallStat label={copy.updated} value={renderDate(item.updated_at)} />
                  <SmallStat label={copy.createdBy} value={item.created_by_name || copy.notAvailable} />
                  <SmallStat label={copy.updatedBy} value={item.updated_by_name || copy.notAvailable} />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {item.evidence_url && (
                    <a
                      href={item.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copy.evidence}
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => editItem(item)}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    {copy.edit}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteObjective(item)}
                    disabled={saving === `delete-${item.id}`}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
