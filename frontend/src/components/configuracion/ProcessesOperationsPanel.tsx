'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiClient';
import { getUserFromToken } from '@/utils/auth';
import { canAccessMvpFeature } from '@/utils/mvpPermissions';

const API_URL = getApiBaseUrl();

type ProcessRow = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  area?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  criticality: string;
  is_active: boolean;
  sort_order?: number;
  operations_count?: number;
  active_operations_count?: number;
  updated_at?: string | null;
};

type OperationRow = {
  id: string;
  process_id?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  operation_type: string;
  frequency?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  is_active: boolean;
  is_default?: boolean;
  sort_order?: number;
  active_standards_count?: number;
  active_standards?: string[];
};

type ProcessForm = {
  code: string;
  name: string;
  description: string;
  area: string;
  owner_user_id: string;
  criticality: string;
  is_active: boolean;
};

type OperationForm = {
  code: string;
  name: string;
  description: string;
  operation_type: string;
  frequency: string;
  owner_user_id: string;
  is_active: boolean;
};

const emptyProcess: ProcessForm = {
  code: '',
  name: '',
  description: '',
  area: '',
  owner_user_id: '',
  criticality: 'media',
  is_active: true,
};

const emptyOperation: OperationForm = {
  code: '',
  name: '',
  description: '',
  operation_type: 'operacion',
  frequency: '',
  owner_user_id: '',
  is_active: true,
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-CL');
}

function statusBadge(active: boolean) {
  return active
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-50 text-slate-500';
}

function buildHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

async function parseApiResponse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || json?.message || 'No fue posible procesar la solicitud.');
  }
  return json;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ProcessesOperationsPanel() {
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [processForm, setProcessForm] = useState<ProcessForm>(emptyProcess);
  const [operationForm, setOperationForm] = useState<OperationForm>(emptyOperation);
  const [editingProcessId, setEditingProcessId] = useState('');
  const [editingOperationId, setEditingOperationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedProcess = useMemo(
    () => processes.find((item) => item.id === selectedProcessId) || null,
    [processes, selectedProcessId]
  );
  const canManageProcesses = useMemo(() => {
    const user = getUserFromToken();
    const role = user?.role || user?.user_role || user?.userRole || '';

    return (
      canAccessMvpFeature(role, 'config.processes.view') &&
      canAccessMvpFeature(role, 'config.operations.view')
    );
  }, []);

  const loadProcesses = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/tenant-processes`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const json = await parseApiResponse(res);
    const rows = Array.isArray(json?.data) ? json.data : [];
    setProcesses(rows);
    setSelectedProcessId((current) => current || rows[0]?.id || '');
  }, []);

  const loadOperations = useCallback(async (processId: string) => {
    if (!processId) {
      setOperations([]);
      return;
    }

    setOperationsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tenant-processes/${processId}/operations`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await parseApiResponse(res);
      setOperations(Array.isArray(json?.data) ? json.data : []);
    } finally {
      setOperationsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      await loadProcesses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible cargar procesos.'));
    } finally {
      setLoading(false);
    }
  }, [loadProcesses]);

  useEffect(() => {
    if (!canManageProcesses) return;
    void refreshAll();
  }, [canManageProcesses, refreshAll]);

  useEffect(() => {
    if (!canManageProcesses) return;
    void loadOperations(selectedProcessId).catch((err: unknown) => {
      setError(getErrorMessage(err, 'No fue posible cargar operaciones.'));
    });
  }, [canManageProcesses, loadOperations, selectedProcessId]);

  function editProcess(row: ProcessRow) {
    setEditingProcessId(row.id);
    setProcessForm({
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      area: row.area || '',
      owner_user_id: row.owner_user_id || '',
      criticality: row.criticality || 'media',
      is_active: row.is_active !== false,
    });
  }

  function editOperation(row: OperationRow) {
    setEditingOperationId(row.id);
    setOperationForm({
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      operation_type: row.operation_type || 'operacion',
      frequency: row.frequency || '',
      owner_user_id: row.owner_user_id || '',
      is_active: row.is_active !== false,
    });
  }

  async function saveProcess() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const method = editingProcessId ? 'PUT' : 'POST';
      const url = editingProcessId
        ? `${API_URL}/api/tenant-processes/${editingProcessId}`
        : `${API_URL}/api/tenant-processes`;

      await parseApiResponse(
        await fetch(url, {
          method,
          headers: buildHeaders(),
          body: JSON.stringify(processForm),
        })
      );

      setProcessForm(emptyProcess);
      setEditingProcessId('');
      setSuccess('Proceso guardado correctamente.');
      await loadProcesses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible guardar el proceso.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleProcess(row: ProcessRow) {
    try {
      setError('');
      setSuccess('');
      await parseApiResponse(
        await fetch(`${API_URL}/api/tenant-processes/${row.id}/status`, {
          method: 'PATCH',
          headers: buildHeaders(),
          body: JSON.stringify({ is_active: !row.is_active }),
        })
      );
      setSuccess(row.is_active ? 'Proceso desactivado.' : 'Proceso activado.');
      await loadProcesses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible cambiar el estado del proceso.'));
    }
  }

  async function saveOperation() {
    if (!selectedProcessId && !editingOperationId) {
      setError('Selecciona un proceso antes de crear una operación.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const method = editingOperationId ? 'PUT' : 'POST';
      const url = editingOperationId
        ? `${API_URL}/api/tenant-operations/${editingOperationId}`
        : `${API_URL}/api/tenant-processes/${selectedProcessId}/operations`;

      await parseApiResponse(
        await fetch(url, {
          method,
          headers: buildHeaders(),
          body: JSON.stringify(operationForm),
        })
      );

      setOperationForm(emptyOperation);
      setEditingOperationId('');
      setSuccess('Operación guardada correctamente.');
      await loadOperations(selectedProcessId);
      await loadProcesses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible guardar la operación.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleOperation(row: OperationRow) {
    try {
      setError('');
      setSuccess('');
      await parseApiResponse(
        await fetch(`${API_URL}/api/tenant-operations/${row.id}/status`, {
          method: 'PATCH',
          headers: buildHeaders(),
          body: JSON.stringify({ is_active: !row.is_active }),
        })
      );
      setSuccess(row.is_active ? 'Operación desactivada.' : 'Operación activada.');
      await loadOperations(selectedProcessId);
      await loadProcesses();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible cambiar el estado de la operación.'));
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Perfil empresa
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Procesos y operaciones</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Base administrativa tenant-scoped para registrar procesos de negocio y sus operaciones. No vincula controles, evidencias, riesgos, KPIs, reportes ni IA en Sprint 2.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
      </div>

      {!canManageProcesses && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          La administración de procesos y operaciones está disponible solo para Admin cumplimiento o tenant admin.
        </div>
      )}

      {canManageProcesses && <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">
              {editingProcessId ? 'Editar proceso' : 'Nuevo proceso'}
            </h3>
            <div className="mt-4 space-y-3">
              <Input label="Nombre" value={processForm.name} onChange={(value) => setProcessForm({ ...processForm, name: value })} />
              <Input label="Código" value={processForm.code} onChange={(value) => setProcessForm({ ...processForm, code: value })} />
              <Input label="Área" value={processForm.area} onChange={(value) => setProcessForm({ ...processForm, area: value })} />
              <Input label="Responsable user_id opcional" value={processForm.owner_user_id} onChange={(value) => setProcessForm({ ...processForm, owner_user_id: value })} />
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Criticidad</span>
                <select
                  value={processForm.criticality}
                  onChange={(e) => setProcessForm({ ...processForm, criticality: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
              <Textarea label="Descripción" value={processForm.description} onChange={(value) => setProcessForm({ ...processForm, description: value })} />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={processForm.is_active}
                  onChange={(e) => setProcessForm({ ...processForm, is_active: e.target.checked })}
                />
                Proceso activo
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving || !processForm.name.trim()}
                  onClick={saveProcess}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar proceso
                </button>
                {editingProcessId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProcessId('');
                      setProcessForm(emptyProcess);
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">
              {editingOperationId ? 'Editar operación' : 'Nueva operación'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {selectedProcess ? `Proceso: ${selectedProcess.name}` : 'Selecciona un proceso para crear operaciones.'}
            </p>
            <div className="mt-4 space-y-3">
              <Input label="Nombre" value={operationForm.name} onChange={(value) => setOperationForm({ ...operationForm, name: value })} />
              <Input label="Código" value={operationForm.code} onChange={(value) => setOperationForm({ ...operationForm, code: value })} />
              <Input label="Tipo" value={operationForm.operation_type} onChange={(value) => setOperationForm({ ...operationForm, operation_type: value })} />
              <Input label="Frecuencia" value={operationForm.frequency} onChange={(value) => setOperationForm({ ...operationForm, frequency: value })} />
              <Input label="Responsable user_id opcional" value={operationForm.owner_user_id} onChange={(value) => setOperationForm({ ...operationForm, owner_user_id: value })} />
              <Textarea label="Descripción" value={operationForm.description} onChange={(value) => setOperationForm({ ...operationForm, description: value })} />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={operationForm.is_active}
                  onChange={(e) => setOperationForm({ ...operationForm, is_active: e.target.checked })}
                />
                Operación activa
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving || !operationForm.name.trim() || (!selectedProcessId && !editingOperationId)}
                  onClick={saveOperation}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar operación
                </button>
                {editingOperationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOperationId('');
                      setOperationForm(emptyOperation);
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Procesos registrados</h3>
              <span className="text-sm text-slate-500">{processes.length}</span>
            </div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-500">Cargando procesos...</div>
            ) : processes.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No hay procesos registrados todavía.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Proceso</th>
                      <th className="px-3 py-3">Área</th>
                      <th className="px-3 py-3">Criticidad</th>
                      <th className="px-3 py-3">Ops</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {processes.map((row) => (
                      <tr key={row.id} className={selectedProcessId === row.id ? 'bg-blue-50/60' : ''}>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => setSelectedProcessId(row.id)} className="text-left">
                            <div className="font-semibold text-slate-900">{row.name}</div>
                            <div className="text-xs text-slate-500">{row.code || 'Sin código'} · {formatDate(row.updated_at)}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.area || '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{row.criticality}</td>
                        <td className="px-3 py-3 text-slate-600">{row.active_operations_count || 0}/{row.operations_count || 0}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(row.is_active)}`}>
                            {row.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => editProcess(row)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold">
                              Editar
                            </button>
                            <button type="button" onClick={() => toggleProcess(row)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold">
                              {row.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Operaciones del proceso</h3>
                <p className="text-sm text-slate-500">{selectedProcess?.name || 'Sin proceso seleccionado'}</p>
              </div>
              <span className="text-sm text-slate-500">{operations.length}</span>
            </div>
            {operationsLoading ? (
              <div className="mt-4 text-sm text-slate-500">Cargando operaciones...</div>
            ) : !selectedProcessId ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Selecciona un proceso para ver sus operaciones.
              </div>
            ) : operations.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Este proceso todavía no tiene operaciones.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Operación</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Frecuencia</th>
                      <th className="px-3 py-3">Normas</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {operations.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.code || 'Sin código'}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.operation_type}</td>
                        <td className="px-3 py-3 text-slate-600">{row.frequency || '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{row.active_standards_count || 0}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(row.is_active)}`}>
                            {row.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => editOperation(row)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold">
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={row.is_default}
                              onClick={() => toggleOperation(row)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {row.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>}
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
      />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
      />
    </label>
  );
}
