'use client';

import { useEffect, useMemo, useState } from 'react';

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

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function formatPct(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return 'Sin fecha';
  }
}

function statusLabel(status: string) {
  const s = String(status || '').toLowerCase();

  if (s === 'cumplido') return 'Cumplido';
  if (s === 'pendiente') return 'Pendiente';
  if (s === 'atrasado') return 'Atrasado';
  if (s === 'cancelado') return 'Cancelado';

  return 'En progreso';
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

export default function ObjectivesPanel({
  tenantId,
  standards,
}: {
  tenantId: string;
  standards: StandardOption[];
}) {
  const [items, setItems] = useState<ObjectiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [standardFilter, setStandardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [form, setForm] = useState<ObjectiveForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);

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
        throw new Error(json.error || 'Error cargando objetivos');
      }

      setItems(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      setError(err.message || 'Error cargando objetivos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, standardFilter, statusFilter]);

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
        message: 'No existe tenant_id para recalcular KPI-01.',
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
          message: json.error || json.detail || 'No se pudo recalcular KPI-01.',
        };
      }

      return {
        ok: true,
        message: 'KPI-01 actualizado correctamente.',
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || 'Error recalculando KPI-01.',
      };
    }
  };

  const saveObjective = async () => {
    if (!tenantId) return;

    const cleanTitle = form.title.trim();

    if (!cleanTitle) {
      alert('El título del objetivo es obligatorio.');
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
        throw new Error(json.error || 'Error guardando objetivo');
      }

      const recalcResult = await recalculateKpisAfterObjectiveChange();

      await loadData();
      resetForm();

      if (recalcResult.ok) {
        alert('Objetivo guardado correctamente y KPI-01 actualizado.');
      } else {
        alert(`Objetivo guardado correctamente, pero no se pudo recalcular KPI-01: ${recalcResult.message}`);
      }
    } catch (err: any) {
      setError(err.message || 'Error guardando objetivo');
      alert(err.message || 'Error guardando objetivo');
    } finally {
      setSaving('');
    }
  };

  const deleteObjective = async (item: ObjectiveItem) => {
    const ok = window.confirm(`¿Eliminar/cancelar el objetivo "${item.title}"?`);
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
        throw new Error(json.error || 'Error eliminando objetivo');
      }

      const recalcResult = await recalculateKpisAfterObjectiveChange();

      await loadData();

      if (recalcResult.ok) {
        alert('Objetivo cancelado correctamente y KPI-01 actualizado.');
      } else {
        alert(`Objetivo cancelado correctamente, pero no se pudo recalcular KPI-01: ${recalcResult.message}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error eliminando objetivo');
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
                KPI-01
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Objetivos del sistema de gestión
              </span>
            </div>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Objetivos del Sistema de Gestión
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Define objetivos por norma, responsable, período y avance. Estos registros
              alimentan el KPI-01 Cumplimiento de Objetivos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {showForm ? 'Cerrar formulario' : 'Nuevo objetivo'}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Objetivos activos" value={stats.total} />
          <MetricCard title="Cumplidos" value={stats.completed} />
          <MetricCard title="En progreso" value={stats.inProgress} />
          <MetricCard title="Atrasados" value={stats.overdue} />
          <MetricCard title="Cumplimiento" value={`${stats.compliancePct}%`} />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Norma
            </label>
            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">Todas</option>
              {standards.map((standard) => (
                <option key={standard.code} value={standard.code}>
                  {standard.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
              <option value="cumplido">Cumplido</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
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
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-[30px] border border-indigo-200 bg-indigo-50/40 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {form.id ? 'Editar objetivo' : 'Nuevo objetivo'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                El avance puede calcularse por meta/valor actual o ingresarse manualmente.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Título" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Input label="Responsable" value={form.owner} onChange={(v) => setForm({ ...form, owner: v })} />

            <Select
              label="Norma"
              value={form.standard_code}
              onChange={(v) => setForm({ ...form, standard_code: v })}
              options={[
                { value: '', label: 'Global' },
                ...standards.map((s) => ({ value: s.code, label: s.code })),
              ]}
            />

            <Select
              label="Estado"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'en_progreso', label: 'En progreso' },
                { value: 'cumplido', label: 'Cumplido' },
                { value: 'atrasado', label: 'Atrasado' },
                { value: 'cancelado', label: 'Cancelado' },
              ]}
            />

            <Select
              label="Periodo"
              value={form.period_type}
              onChange={(v) => setForm({ ...form, period_type: v })}
              options={[
                { value: 'mensual', label: 'Mensual' },
                { value: 'trimestral', label: 'Trimestral' },
                { value: 'semestral', label: 'Semestral' },
                { value: 'anual', label: 'Anual' },
              ]}
            />

            <Input label="Inicio" type="date" value={form.period_start} onChange={(v) => setForm({ ...form, period_start: v })} />
            <Input label="Fin" type="date" value={form.period_end} onChange={(v) => setForm({ ...form, period_end: v })} />
            <Input label="Meta" type="number" value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} />
            <Input label="Valor actual" type="number" value={form.actual_value} onChange={(v) => setForm({ ...form, actual_value: v })} />
            <Input label="Avance %" type="number" value={form.progress_percent} onChange={(v) => setForm({ ...form, progress_percent: v })} />
            <Input label="URL evidencia" value={form.evidence_url} onChange={(v) => setForm({ ...form, evidence_url: v })} />

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Descripción
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
                Notas
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
              {saving === 'save' ? 'Guardando...' : 'Guardar objetivo'}
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
            Listado de objetivos
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {items.length} registro(s)
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-slate-50 p-5 text-slate-500">
            Cargando objetivos...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            No hay objetivos registrados. Crea al menos un objetivo para alimentar KPI-01.
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
                        {item.standard_code || 'GLOBAL'}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <h4 className="mt-3 text-lg font-bold text-slate-900">
                      {item.title}
                    </h4>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.description || 'Sin descripción'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                    <div className="text-3xl font-bold text-slate-900">
                      {formatPct(item.progress_percent)}
                    </div>
                    <div className="text-xs text-slate-500">avance</div>
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

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <SmallStat label="Responsable" value={item.owner || 'N/D'} />
                  <SmallStat label="Inicio" value={formatDate(item.period_start)} />
                  <SmallStat label="Fin" value={formatDate(item.period_end)} />
                  <SmallStat label="Meta" value={item.target_value ?? 'N/D'} />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {item.evidence_url && (
                    <a
                      href={item.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Evidencia
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => editItem(item)}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteObjective(item)}
                    disabled={saving === `delete-${item.id}`}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    Cancelar
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
