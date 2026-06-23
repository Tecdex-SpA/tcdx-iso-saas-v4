'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useLanguage } from '@/context/LanguageContext';
import { getUserFromToken } from '@/utils/auth';
import { translateDisplayText, translateClauseLabel, translateStatusLabel } from '@/i18n/displayText';

const SOA_STANDARDS = [
  'ISO27001',
  'ISO/IEC27701',
  'ISO/IEC27017',
  'ISO/IEC27018'
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

export default function SoAPage() {
  const { locale } = useLanguage();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [standards, setStandards] = useState<any[]>([]);
  const [selectedISO, setSelectedISO] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [savingId, setSavingId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [preflight, setPreflight] = useState<any>(null);
  const [initializing, setInitializing] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    applicable: 'all',
    implementation: 'all',
    owner: 'all',
    issue: 'all'
  });

  const isReadOnly = user?.role === 'auditor';

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (!authToken || !u?.tenant_id) {
      setLoadingStandards(false);
      setLoadingData(false);
    }
  }, []);

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
        console.error('ERROR LOAD SOA STANDARDS:', json);
        setStandards([]);
        setSelectedISO('');
        return;
      }

      const activeStandards = (json || []).filter(
        (s: any) =>
          (s.is_active || Number(s.tenant_controls) > 0) &&
          SOA_STANDARDS.includes(s.code)
      );

      setStandards(activeStandards);

      if (activeStandards.length > 0) {
        setSelectedISO((prev) => {
          const exists = activeStandards.some((s: any) => s.code === prev);
          return exists ? prev : activeStandards[0].code;
        });
      } else {
        setSelectedISO('');
      }
    } catch (err) {
      console.error('ERROR LOAD SOA STANDARDS:', err);
      setStandards([]);
      setSelectedISO('');
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadSoA = async (tenantId: string, authToken: string, iso: string) => {
    try {
      setLoadingData(true);

      const preflightRes = await fetch(
        `${API_URL}/api/soa/${tenantId}/preflight?iso=${encodeURIComponent(iso)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      const preflightJson = await preflightRes.json();

      if (!preflightRes.ok) {
        console.error('ERROR LOAD SOA PREFLIGHT:', preflightJson);
        setPreflight(null);
      } else {
        setPreflight(preflightJson);
      }

      const res = await fetch(
        `${API_URL}/api/soa/${tenantId}?iso=${encodeURIComponent(iso)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD SOA:', json);
        setData([]);
        return;
      }

      setData(json || []);
      setSelectedRowId('');
    } catch (err) {
      console.error('ERROR LOAD SOA:', err);
      setData([]);
      setPreflight(null);
    } finally {
      setLoadingData(false);
    }
  };

  const initializeSoA = async () => {
    if (!token || !user?.tenant_id || !selectedISO) return;

    try {
      setInitializing(true);
      const res = await fetch(
        `${API_URL}/api/soa/${user.tenant_id}/initialize?iso=${encodeURIComponent(selectedISO)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json?.blocking_reason || json?.error || 'No fue posible inicializar SoA');
        return;
      }

      await loadSoA(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR INITIALIZE SOA:', err);
      alert('Error inicializando SoA');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    if (!token || !user?.tenant_id) return;
    loadStandards(user.tenant_id, token);
  }, [token, user]);

  useEffect(() => {
    if (!token || !user?.tenant_id || !selectedISO) {
      if (!loadingStandards) setLoadingData(false);
      return;
    }

    loadSoA(user.tenant_id, token, selectedISO);
  }, [token, user, selectedISO, loadingStandards]);

  const changeField = (id: string, field: string, value: any) => {
    setData((prev) =>
      prev.map((row) => {
        if (row.tenant_control_id !== id) return row;

        const updated = { ...row, [field]: value };

        if (field === 'applicable') {
          if (value === false) {
            updated.implementation_status = 'no aplica';
          }
          if (value === true && updated.implementation_status === 'no aplica') {
            updated.implementation_status = 'pendiente';
          }
        }

        return updated;
      })
    );
  };

  const saveRow = async (row: any) => {
    if (!token) return;

    try {
      setSavingId(row.tenant_control_id);

      const res = await fetch(
        `${API_URL}/api/soa/${row.tenant_control_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            applicable: row.applicable,
            implementation_status: row.implementation_status,
            justification: row.justification,
            notes: row.notes,
            owner: row.owner,
            review_date: row.review_date || null
          })
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error guardando SoA');
        return;
      }

      setData((prev) =>
        prev.map((r) =>
          r.tenant_control_id === row.tenant_control_id ? json : r
        )
      );
      setSelectedRowId(row.tenant_control_id);
    } catch (err) {
      console.error('ERROR SAVE SOA:', err);
      alert('Error guardando SoA');
    } finally {
      setSavingId('');
    }
  };

  const createFinding = async (row: any) => {
    if (!token || !user?.tenant_id) return;

    const title = window.prompt(
      `Título del hallazgo para ${row.clause}`,
      `Hallazgo SoA en control ${row.clause}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del hallazgo',
        row.justification || row.description || ''
      ) || '';

    let findingType = 'observacion';
    let severity = 'media';

    if (row.applicable === true && row.implementation_status === 'no implementado') {
      findingType = 'no conformidad';
      severity = 'alta';
    } else if (row.applicable === true && row.implementation_status === 'parcial') {
      findingType = 'observacion';
      severity = 'media';
    } else if (row.applicable === false) {
      findingType = 'oportunidad de mejora';
      severity = 'baja';
    }

    try {
      setActionLoading(`finding-${row.tenant_control_id}`);

      const res = await fetch(`${API_URL}/api/findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          iso_code: selectedISO,
          title,
          description,
          finding_type: findingType,
          severity,
          source_type: 'soa',
          tenant_control_id: row.tenant_control_id
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando hallazgo');
        return;
      }

      alert('Hallazgo creado correctamente');
    } catch (err) {
      console.error('ERROR CREATE SOA FINDING:', err);
      alert('Error creando hallazgo');
    } finally {
      setActionLoading('');
    }
  };

  const createActionPlan = async (row: any) => {
    if (!token || !user?.tenant_id) return;

    const title = window.prompt(
      `Título del plan de acción para ${row.clause}`,
      `Acción SoA para control ${row.clause}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del plan de acción',
        row.justification || row.description || ''
      ) || '';

    const owner =
      window.prompt('Responsable del plan de acción', row.owner || '') || row.owner || '';

    let priority = 'media';
    if (row.applicable === true && row.implementation_status === 'no implementado') {
      priority = 'alta';
    } else if (row.applicable === true && row.implementation_status === 'parcial') {
      priority = 'media';
    } else if (row.applicable === false) {
      priority = 'baja';
    }

    try {
      setActionLoading(`action-${row.tenant_control_id}`);

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          iso_code: selectedISO,
          title,
          description,
          priority,
          owner,
          source_type: 'control',
          tenant_control_id: row.tenant_control_id
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando plan de acción');
        return;
      }

      alert('Plan de acción creado correctamente');
    } catch (err) {
      console.error('ERROR CREATE SOA ACTION PLAN:', err);
      alert('Error creando plan de acción');
    } finally {
      setActionLoading('');
    }
  };

  const metrics = useMemo(() => {
    const total = data.length;
    const applicable = data.filter((r) => r.applicable === true).length;
    const notApplicable = data.filter((r) => r.applicable === false).length;
    const applicabilityDefined = applicable + notApplicable;
    const implemented = data.filter((r) => r.implementation_status === 'implementado').length;
    const partial = data.filter((r) => r.implementation_status === 'parcial').length;
    const notImplemented = data.filter((r) => r.implementation_status === 'no implementado').length;
    const pending = data.filter((r) => r.implementation_status === 'pendiente').length;
    const applicableRows = data.filter((r) => r.applicable === true);
    const notApplicableRows = data.filter((r) => r.applicable === false);
    const missingJustification = notApplicableRows.filter((r) => !String(r.justification || '').trim()).length;
    const missingOwner = data.filter((r) => !String(r.owner || '').trim()).length;
    const today = new Date().toISOString().slice(0, 10);
    const reviewMissing = data.filter((r) => !r.review_date).length;
    const reviewOverdue = data.filter((r) => r.review_date && String(r.review_date).slice(0, 10) < today).length;
    const implementedApplicable = applicableRows.filter((r) => r.implementation_status === 'implementado').length;
    const justifiedExclusions = notApplicableRows.length - missingJustification;

    const percent = (value: number, base: number) => {
      if (!base) return 0;
      return Math.round((value / base) * 100);
    };

    return {
      total,
      applicability_defined: applicabilityDefined,
      applicable,
      notApplicable,
      implemented,
      partial,
      notImplemented,
      pending,
      missingJustification,
      missingOwner,
      reviewMissing,
      reviewOverdue,
      soaCompletionPercent: percent(applicabilityDefined, total),
      implementationPercent: percent(implementedApplicable, applicableRows.length),
      exclusionJustificationPercent: percent(justifiedExclusions, notApplicableRows.length)
    };
  }, [data]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(data.map((row) => row.category).filter(Boolean))).sort();
  }, [data]);

  const ownerOptions = useMemo(() => {
    return Array.from(new Set(data.map((row) => row.owner).filter(Boolean))).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const query = filters.search.trim().toLowerCase();

    return data.filter((row) => {
      const haystack = [
        row.clause,
        row.category,
        row.description,
        row.diagnostic_status,
        row.owner,
        row.justification,
        row.notes
      ].join(' ').toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (filters.category !== 'all' && row.category !== filters.category) return false;
      if (filters.implementation !== 'all' && (row.implementation_status || 'pendiente') !== filters.implementation) return false;
      if (filters.owner !== 'all' && row.owner !== filters.owner) return false;
      if (filters.applicable === 'true' && row.applicable !== true) return false;
      if (filters.applicable === 'false' && row.applicable !== false) return false;
      if (filters.applicable === 'pending' && row.applicable !== null && row.applicable !== undefined) return false;
      if (filters.issue === 'missing_justification' && !(row.applicable === false && !String(row.justification || '').trim())) return false;
      if (filters.issue === 'missing_owner' && String(row.owner || '').trim()) return false;
      if (filters.issue === 'review_missing' && row.review_date) return false;
      if (filters.issue === 'review_overdue' && !(row.review_date && String(row.review_date).slice(0, 10) < today)) return false;
      return true;
    });
  }, [data, filters]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return data.find((row) => row.tenant_control_id === selectedRowId) || null;
  }, [data, selectedRowId]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas SoA...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && standards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Statement of Applicability (SoA)</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              Esta empresa no tiene normas que usen SoA
            </h2>

            <p className="text-sm text-gray-700">
              El módulo SoA solo aplica a normas de seguridad y privacidad como:
              <b> ISO27001, ISO/IEC27701, ISO/IEC27017, ISO/IEC27018</b>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingData) {
    return (
      <AppLayout>
        <div className="p-6">Cargando SoA...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Statement of Applicability</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">SoA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Define aplicabilidad, exclusiones justificadas, estado de implementación, responsable y revisión para controles de seguridad y privacidad.
            </p>
            {isReadOnly && (
              <div className="mt-2 text-sm font-semibold text-blue-800">
                Modo solo lectura para auditor.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedISO}
              onChange={(e) => setSelectedISO(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
            >
              {standards.map((s: any) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>

            {preflight?.can_initialize_soa && !isReadOnly && (
              <button
                type="button"
                onClick={initializeSoA}
                disabled={initializing}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {initializing ? 'Inicializando...' : 'Inicializar SoA'}
              </button>
            )}
          </div>
        </div>

        {preflight && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <PreflightCard title="Norma activa" value={preflight.standard_active ? 'Sí' : 'No'} tone={preflight.standard_active ? 'success' : 'warning'} />
            <PreflightCard title="Operaciones activas" value={preflight.active_operations_count ?? 0} />
            <PreflightCard title="Controles tenant" value={preflight.tenant_controls_count ?? 0} />
            <PreflightCard title="Controles legacy" value={preflight.legacy_controls_count ?? 0} />
            <PreflightCard title="Filas SoA" value={preflight.soa_rows_count ?? 0} tone={(preflight.soa_rows_count || 0) > 0 ? 'success' : 'warning'} />
          </div>
        )}

        {preflight?.blocking_reason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <div className="font-black">SoA no disponible para la norma seleccionada</div>
            <div className="mt-1">Motivo: {preflight.blocking_reason}</div>
          </div>
        )}

        {data.length === 0 && preflight?.can_initialize_soa && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-xl font-black text-blue-950">SoA pendiente de inicialización</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
              {selectedISO} está activa y tiene {preflight.tenant_controls_count} controles disponibles desde tenant_controls, pero aún no existen filas SoA materializadas.
            </p>
            {!isReadOnly && (
              <button
                type="button"
                onClick={initializeSoA}
                disabled={initializing}
                className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {initializing ? 'Inicializando...' : 'Inicializar SoA desde controles existentes'}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Cobertura aplicabilidad" value={`${metrics.soaCompletionPercent}%`} subtitle={`${metrics.applicability_defined} de ${metrics.total} definidos`} />
          <MetricCard title="Implementación aplicables" value={`${metrics.implementationPercent}%`} subtitle={`${metrics.implemented} implementados`} />
          <MetricCard title="Exclusiones justificadas" value={`${metrics.exclusionJustificationPercent}%`} subtitle={`${metrics.missingJustification} sin justificación`} />
          <MetricCard title="Revisión / ownership" value={metrics.missingOwner + metrics.reviewOverdue} subtitle="Sin responsable o vencidos" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard title="Total controles" value={metrics.total} compact />
          <MetricCard title="Aplican" value={metrics.applicable} compact />
          <MetricCard title="No aplican" value={metrics.notApplicable} compact />
          <MetricCard title="Implementados" value={metrics.implemented} compact />
          <MetricCard title="Parciales" value={metrics.partial} compact />
          <MetricCard title="No implementados" value={metrics.notImplemented} compact />
          <MetricCard title="Pendientes" value={metrics.pending} compact />
          <MetricCard title="Revisión faltante" value={metrics.reviewMissing} compact />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar cláusula, control o descripción"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm xl:col-span-2"
            />
            <select value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Todas las categorías</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value={filters.applicable} onChange={(e) => setFilters((prev) => ({ ...prev, applicable: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Aplicabilidad</option>
              <option value="true">Aplica</option>
              <option value="false">No aplica</option>
              <option value="pending">Pendiente</option>
            </select>
            <select value={filters.implementation} onChange={(e) => setFilters((prev) => ({ ...prev, implementation: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Estado implementación</option>
              <option value="pendiente">Pendiente</option>
              <option value="implementado">Implementado</option>
              <option value="parcial">Parcial</option>
              <option value="no implementado">No implementado</option>
              <option value="no aplica">No aplica</option>
            </select>
            <select value={filters.owner} onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Responsable</option>
              {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <select value={filters.issue} onChange={(e) => setFilters((prev) => ({ ...prev, issue: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Sin alertas</option>
              <option value="missing_justification">Sin justificación</option>
              <option value="missing_owner">Sin responsable</option>
              <option value="review_missing">Sin revisión</option>
              <option value="review_overdue">Revisión vencida</option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Mostrando {filteredData.length} de {data.length} controles</span>
            <button
              type="button"
              onClick={() => setFilters({ search: '', category: 'all', applicable: 'all', implementation: 'all', owner: 'all', issue: 'all' })}
              className="text-blue-700 hover:text-blue-900"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Control</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Aplica</th>
                    <th className="px-4 py-3">Implementación</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((row: any) => (
                    <tr
                      key={row.tenant_control_id}
                      onClick={() => setSelectedRowId(row.tenant_control_id)}
                      className={`cursor-pointer hover:bg-blue-50 ${selectedRow?.tenant_control_id === row.tenant_control_id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-950">{translateClauseLabel(row.clause, locale)}</div>
                        <div className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-600">{translateDisplayText(row.description, locale, 'control')}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{translateDisplayText(row.category || 'General', locale, 'category')}</td>
                      <td className="px-4 py-3"><StatusPill value={applicabilityLabel(row.applicable)} /></td>
                      <td className="px-4 py-3"><StatusPill value={translateStatusLabel(row.implementation_status || 'pendiente', locale)} /></td>
                      <td className="px-4 py-3 text-slate-600">{row.owner || 'Sin responsable'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.review_date ? String(row.review_date).slice(0, 10) : 'Sin fecha'}</td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No hay controles que coincidan con los filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRow && (
            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-blue-700">{translateClauseLabel(selectedRow.clause, locale)}</div>
                  <h2 className="mt-1 text-lg font-black text-slate-950">Detalle SoA</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{translateDisplayText(selectedRow.category || 'General', locale, 'category')}</p>
                </div>
                <button type="button" onClick={() => setSelectedRowId('')} className="text-sm font-bold text-slate-500 hover:text-slate-900">Cerrar</button>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-700">{translateDisplayText(selectedRow.description, locale, 'control')}</p>

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Aplica</span>
                  <select
                    value={selectedRow.applicable === true ? 'true' : selectedRow.applicable === false ? 'false' : ''}
                    onChange={(e) => {
                      const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
                      changeField(selectedRow.tenant_control_id, 'applicable', value);
                    }}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Pendiente definir</option>
                    <option value="true">Sí aplica</option>
                    <option value="false">No aplica</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Estado implementación</span>
                  <select
                    value={selectedRow.implementation_status || 'pendiente'}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'implementation_status', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="implementado">Implementado</option>
                    <option value="parcial">Parcial</option>
                    <option value="no implementado">No implementado</option>
                    <option value="no aplica">No aplica</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Responsable</span>
                  <input
                    value={selectedRow.owner || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'owner', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Responsable del control"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Fecha revisión</span>
                  <input
                    type="date"
                    value={selectedRow.review_date ? String(selectedRow.review_date).slice(0, 10) : ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'review_date', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Justificación</span>
                  <textarea
                    value={selectedRow.justification || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'justification', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Justificación de aplicabilidad o exclusión"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Notas</span>
                  <textarea
                    value={selectedRow.notes || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'notes', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas complementarias"
                  />
                </label>
              </div>

              {!isReadOnly && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => saveRow(selectedRow)} disabled={savingId === selectedRow.tenant_control_id} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    {savingId === selectedRow.tenant_control_id ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => createFinding(selectedRow)} disabled={actionLoading === `finding-${selectedRow.tenant_control_id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
                    {actionLoading === `finding-${selectedRow.tenant_control_id}` ? 'Creando...' : 'Crear hallazgo'}
                  </button>
                  <button onClick={() => createActionPlan(selectedRow)} disabled={actionLoading === `action-${selectedRow.tenant_control_id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
                    {actionLoading === `action-${selectedRow.tenant_control_id}` ? 'Creando...' : 'Crear acción'}
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({ title, value, subtitle, compact = false }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={compact ? 'mt-2 text-2xl font-black text-slate-950' : 'mt-2 text-3xl font-black text-slate-950'}>{value}</div>
      {subtitle && <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>}
    </div>
  );
}

function PreflightCard({ title, value, tone = 'neutral' }: any) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function applicabilityLabel(value: boolean | null | undefined) {
  if (value === true) return 'Aplica';
  if (value === false) return 'No aplica';
  return 'Pendiente';
}

function StatusPill({ value }: any) {
  const normalized = String(value || '').toLowerCase();
  const tone = normalized.includes('no implementado') || normalized.includes('venc')
    ? 'bg-red-50 text-red-700 ring-red-100'
    : normalized.includes('parcial') || normalized.includes('pendiente')
    ? 'bg-amber-50 text-amber-700 ring-amber-100'
    : normalized.includes('implementado') || normalized === 'aplica'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : 'bg-slate-50 text-slate-700 ring-slate-100';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>
      {value}
    </span>
  );
}
