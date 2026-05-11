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
        `http://192.168.100.120:3000/api/tenant-standards/${tenantId}`,
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

      const res = await fetch(
        `http://192.168.100.120:3000/api/soa/${tenantId}?iso=${encodeURIComponent(iso)}`,
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
    } catch (err) {
      console.error('ERROR LOAD SOA:', err);
      setData([]);
    } finally {
      setLoadingData(false);
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
        `http://192.168.100.120:3000/api/soa/${row.tenant_control_id}`,
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

      const res = await fetch(`http://192.168.100.120:3000/api/findings`, {
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

      const res = await fetch(`http://192.168.100.120:3000/api/action-plans`, {
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
    const implemented = data.filter((r) => r.implementation_status === 'implementado').length;
    const pending = data.filter((r) => r.implementation_status === 'pendiente').length;

    return {
      total,
      applicable,
      notApplicable,
      implemented,
      pending
    };
  }, [data]);

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

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-2xl font-bold">Statement of Applicability (SoA)</h1>

          <select
            value={selectedISO}
            onChange={(e) => setSelectedISO(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            {standards.map((s: any) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-blue-50 p-4 rounded text-sm text-gray-700">
          El SoA permite definir qué controles aplican a la organización, su estado de implementación y la justificación de su exclusión cuando corresponda.
          {isReadOnly && (
            <div className="mt-2 font-semibold text-blue-800">
              Modo solo lectura para auditor.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Total" value={metrics.total} />
          <MetricCard title={translateDisplayText("Aplican", locale, "generic")} value={metrics.applicable} />
          <MetricCard title={translateDisplayText("No aplican", locale, "generic")} value={metrics.notApplicable} />
          <MetricCard title={translateDisplayText("Implementados", locale, "generic")} value={metrics.implemented} />
          <MetricCard title={translateStatusLabel("Pendiente", locale)} value={metrics.pending} />
        </div>

        <div className="space-y-4">
          {data.map((row: any) => (
            <div key={row.tenant_control_id} className="bg-white p-4 rounded shadow space-y-4">

              <div>
                <div className="font-semibold">
                  {translateClauseLabel(row.clause, locale)} — {translateDisplayText(row.category || 'General', locale, 'category')}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {translateDisplayText(row.description, locale, 'control')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Estado diagnóstico actual: {translateStatusLabel(row.diagnostic_status || 'pendiente', locale)}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Aplica</label>
                  <select
                    value={
                      row.applicable === true
                        ? 'true'
                        : row.applicable === false
                        ? 'false'
                        : ''
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value === 'true'
                          ? true
                          : e.target.value === 'false'
                          ? false
                          : null;
                      changeField(row.tenant_control_id, 'applicable', value);
                    }}
                    disabled={isReadOnly}
                    className="border p-2 rounded w-full"
                  >
                    <option value="">Pendiente definir</option>
                    <option value="true">Sí aplica</option>
                    <option value="false">No aplica</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Estado implementación</label>
                  <select
                    value={row.implementation_status || 'pendiente'}
                    onChange={(e) =>
                      changeField(row.tenant_control_id, 'implementation_status', e.target.value)
                    }
                    disabled={isReadOnly}
                    className="border p-2 rounded w-full"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="implementado">Implementado</option>
                    <option value="parcial">Parcial</option>
                    <option value="no implementado">No implementado</option>
                    <option value="no aplica">No aplica</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Responsable</label>
                  <input
                    value={row.owner || ''}
                    onChange={(e) =>
                      changeField(row.tenant_control_id, 'owner', e.target.value)
                    }
                    disabled={isReadOnly}
                    className="border p-2 rounded w-full"
                    placeholder="Responsable del control"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Fecha revisión</label>
                  <input
                    type="date"
                    value={row.review_date ? String(row.review_date).slice(0, 10) : ''}
                    onChange={(e) =>
                      changeField(row.tenant_control_id, 'review_date', e.target.value)
                    }
                    disabled={isReadOnly}
                    className="border p-2 rounded w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">Justificación</label>
                <textarea
                  value={row.justification || ''}
                  onChange={(e) =>
                    changeField(row.tenant_control_id, 'justification', e.target.value)
                  }
                  disabled={isReadOnly}
                  className="border p-2 rounded w-full min-h-[90px]"
                  placeholder="Justificación de aplicabilidad o exclusión"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">Notas</label>
                <textarea
                  value={row.notes || ''}
                  onChange={(e) =>
                    changeField(row.tenant_control_id, 'notes', e.target.value)
                  }
                  disabled={isReadOnly}
                  className="border p-2 rounded w-full min-h-[90px]"
                  placeholder="Notas complementarias"
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <div className="flex flex-wrap gap-2">
                  {!isReadOnly && (
                    <>
                      <button
                        onClick={() => createFinding(row)}
                        disabled={actionLoading === `finding-${row.tenant_control_id}`}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      >
                        {actionLoading === `finding-${row.tenant_control_id}` ? 'Creando...' : 'Crear hallazgo'}
                      </button>

                      <button
                        onClick={() => createActionPlan(row)}
                        disabled={actionLoading === `action-${row.tenant_control_id}`}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      >
                        {actionLoading === `action-${row.tenant_control_id}` ? 'Creando...' : 'Crear acción'}
                      </button>
                    </>
                  )}
                </div>

                {!isReadOnly && (
                  <button
                    onClick={() => saveRow(row)}
                    disabled={savingId === row.tenant_control_id}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {savingId === row.tenant_control_id ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}

function MetricCard({ title, value }: any) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
