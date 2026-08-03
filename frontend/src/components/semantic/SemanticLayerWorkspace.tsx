'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiRequestJson, ApiClientError } from '@/utils/apiClient';
import { getUserRoleFromToken } from '@/utils/auth';

type ContractVersion = {
  id: string;
  version_number: number;
  status: string;
  minimum_coverage?: number;
  maximum_age_seconds?: number | null;
  mappings?: Mapping[];
};
type Contract = {
  id: string;
  source_code: string;
  display_name: string;
  entity_type: string;
  adapter_key: string;
  status: string;
  current_version_id?: string | null;
  current_version_number?: number | null;
  versions?: ContractVersion[];
};
type Mapping = {
  id: string;
  physical_table: string;
  physical_column: string;
  canonical_field: string;
  transformation_type: string;
  required: boolean;
  status: string;
};
type Preview = {
  status: string;
  valid: boolean;
  quality?: { status: string; score: number };
  freshness?: { status: string; age_seconds: number | null };
  sufficiency?: { status: string; coverage: number; sample_size: number; usable_rows: number };
  warnings?: Array<{ code?: string; field?: string; message?: string } | string>;
  rows?: Array<Record<string, unknown>>;
};
type Observation = {
  id: string;
  observation_type: string;
  observed_at: string;
  quality_status: string;
  freshness_status: string;
  quality_score?: number | null;
  is_current: boolean;
};
type Reconciliation = { status: string; total: number; equivalent: number; adapted: number; missing: number };

const ADMIN_ROLES = new Set(['admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin', 'superadmin', 'super_admin', 'platform_admin']);
const TRANSFORMATIONS = ['direct','trim','lowercase','uppercase','date_parse','timezone_normalize','status_map','severity_map','unit_convert','boolean_map','numeric_parse','enum_map','coalesce_controlled'];

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

function message(error: unknown) {
  if (error instanceof ApiClientError) return `${error.message}`;
  return error instanceof Error ? error.message : 'No fue posible completar la operación.';
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    source_ready: 'Fuente disponible', source_ready_with_warnings: 'Disponible con observaciones',
    sufficient: 'Datos suficientes', insufficient_data: 'Datos insuficientes', stale_source: 'Fuente desactualizada',
    quality_failed: 'Calidad insuficiente', schema_incompatible: 'Estructura incompatible', source_unavailable: 'Fuente no disponible',
    fresh: 'Vigente', attention: 'Requiere atención', stale: 'Desactualizada', valid: 'Válida', failed: 'No válida', unknown: 'Sin medición',
    draft: 'Borrador', reviewed: 'Revisada', approved: 'Aprobada', published: 'Publicada', retired: 'Retirada', active: 'Activa',
  };
  return labels[String(status || '')] || String(status || 'Sin estado');
}

export default function SemanticLayerWorkspace() {
  const [role, setRole] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<Contract | null>(null);
  const [versionId, setVersionId] = useState('');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contractForm, setContractForm] = useState({ source_code: '', display_name: '', entity_type: '', adapter_key: '' });
  const [versionForm, setVersionForm] = useState({ physical_table: '', required_fields: 'value, observed_at', timestamp_field: 'observed_at', minimum_coverage: '0.8', maximum_age_seconds: '2592000' });
  const [mappingForm, setMappingForm] = useState({ physical_table: '', physical_column: '', canonical_field: '', transformation_type: 'direct', required: false });

  const canManage = useMemo(() => ADMIN_ROLES.has(role), [role]);
  const versions = selected?.versions || [];
  const currentVersion = versions.find((item) => item.id === versionId) || null;

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [payload, reconciliationPayload] = await Promise.all([
        apiRequestJson('/api/data/semantic/source-contracts'),
        apiRequestJson('/api/data/semantic/reconciliation'),
      ]);
      const rows = unwrap<Contract[]>(payload);
      setContracts(rows);
      setReconciliation(unwrap<Reconciliation>(reconciliationPayload));
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadSelected = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    try {
      const [contractPayload, observationsPayload] = await Promise.all([
        apiRequestJson(`/api/data/semantic/source-contracts/${id}`),
        apiRequestJson(`/api/data/semantic/observations?contract_id=${encodeURIComponent(id)}&limit=25`),
      ]);
      const contract = unwrap<Contract>(contractPayload);
      setSelected(contract);
      setObservations(unwrap<Observation[]>(observationsPayload));
      const activeVersion = contract.current_version_id || contract.versions?.[0]?.id || '';
      setVersionId((current) => contract.versions?.some((item) => item.id === current) ? current : activeVersion);
    } catch (requestError) {
      setError(message(requestError));
    }
  }, []);

  useEffect(() => {
    setRole(getUserRoleFromToken());
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    void loadSelected(selectedId);
  }, [loadSelected, selectedId]);

  async function perform<T>(label: string, action: () => Promise<T>, success: string): Promise<T | undefined> {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await action();
      setNotice(success);
      await loadContracts();
      if (selectedId) await loadSelected(selectedId);
      return result;
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setBusy('');
    }
  }

  async function createContract(event: FormEvent) {
    event.preventDefault();
    const payload = await perform('contract', () => apiRequestJson('/api/data/semantic/source-contracts', { method: 'POST', body: JSON.stringify(contractForm) }), 'Contrato creado en borrador.');
    const created = payload ? unwrap<Contract>(payload) : null;
    if (created?.id) {
      setSelectedId(created.id);
      await loadSelected(created.id);
    }
    setContractForm({ source_code: '', display_name: '', entity_type: '', adapter_key: '' });
  }

  async function createVersion(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    const requiredFields = versionForm.required_fields.split(',').map((item) => item.trim()).filter(Boolean);
    await perform('version', () => apiRequestJson(`/api/data/semantic/source-contracts/${selectedId}/versions`, {
      method: 'POST', body: JSON.stringify({
        physical_tables: [versionForm.physical_table.trim()],
        tenant_key_candidates: ['tenant_id'],
        timestamp_candidates: versionForm.timestamp_field ? [versionForm.timestamp_field.trim()] : [],
        required_fields: requiredFields,
        minimum_coverage: Number(versionForm.minimum_coverage),
        maximum_age_seconds: Number(versionForm.maximum_age_seconds),
      }),
    }), 'Versión creada. Configure y valide los mappings antes de revisión.');
  }

  async function saveMapping(event: FormEvent) {
    event.preventDefault();
    if (!versionId) return;
    await perform('mapping', () => apiRequestJson(`/api/data/semantic/versions/${versionId}/mappings`, {
      method: 'POST', body: JSON.stringify(mappingForm),
    }), 'Mapping guardado.');
    setMappingForm((current) => ({ ...current, physical_column: '', canonical_field: '' }));
  }

  async function runPreview() {
    setBusy('preview');
    setError('');
    try {
      const payload = await apiRequestJson(`/api/data/semantic/versions/${versionId}/preview`, { method: 'POST', body: '{}' });
      setPreview(unwrap<Preview>(payload));
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setBusy('');
    }
  }

  async function transition(next: 'review' | 'approve' | 'publish') {
    await perform(next, () => apiRequestJson(`/api/data/semantic/versions/${versionId}/${next}`, { method: 'POST', body: '{}' }), `Versión ${next === 'review' ? 'revisada' : next === 'approve' ? 'aprobada' : 'publicada'}.`);
  }

  async function ingest() {
    await perform('ingest', () => apiRequestJson(`/api/data/semantic/versions/${versionId}/ingest`, { method: 'POST', body: '{}' }), 'Ingesta completada y snapshot registrado.');
  }

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <header className="border-b border-[var(--tcdx-color-border)] pb-5">
        <p className="text-xs font-semibold text-[var(--tcdx-color-primary)]">Gobierno de datos</p>
        <h1 className="mt-2 text-2xl font-semibold">Capa semántica GRC</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">Administra disponibilidad, calidad, vigencia y trazabilidad de las fuentes usadas por métricas oficiales.</p>
      </header>

      {error && <div role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mt-4 border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,2.2fr)]">
        <aside className="min-w-0 border-r border-[var(--tcdx-color-border)] pr-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Fuentes gobernadas</h2>
            <button type="button" onClick={() => void loadContracts()} className="min-h-10 border border-[var(--tcdx-color-border)] px-3 text-xs font-semibold">Actualizar</button>
          </div>
          {reconciliation && <p className="mt-2 text-xs text-[var(--tcdx-color-text-secondary)]">Reconciliación: {reconciliation.equivalent + reconciliation.adapted}/{reconciliation.total} contratos compatibles{reconciliation.missing ? ` · ${reconciliation.missing} pendientes` : ''}.</p>}
          {loading ? <p className="mt-4 text-sm">Cargando fuentes…</p> : (
            <div className="mt-3 grid gap-2">
              {contracts.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-current={selectedId === item.id ? 'page' : undefined} className={`min-h-12 border px-3 py-2 text-left text-sm ${selectedId === item.id ? 'border-[var(--tcdx-color-primary)] bg-white' : 'border-[var(--tcdx-color-border)]'}`}>
                  <span className="block font-semibold">{item.display_name}</span>
                  <span className="block text-xs text-[var(--tcdx-color-text-secondary)]">{statusLabel(item.status)}</span>
                </button>
              ))}
              {!contracts.length && <p className="text-sm text-[var(--tcdx-color-text-secondary)]">No hay fuentes configuradas.</p>}
            </div>
          )}
        </aside>

        <section className="min-w-0">
          {!selected && !loading && <p className="text-sm">Seleccione una fuente para consultar su estado.</p>}
          {selected && (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selected.display_name}</h2>
                  <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">{selected.entity_type} · {statusLabel(selected.status)}</p>
                </div>
                <select aria-label="Versión" value={versionId} onChange={(event) => { setVersionId(event.target.value); setPreview(null); }} className="min-h-10 border border-[var(--tcdx-color-border)] bg-white px-3 text-sm">
                  {versions.map((item) => <option key={item.id} value={item.id}>Versión {item.version_number} · {statusLabel(item.status)}</option>)}
                </select>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="border border-[var(--tcdx-color-border)] bg-white p-4"><p className="text-xs text-[var(--tcdx-color-text-secondary)]">Disponibilidad</p><p className="mt-1 font-semibold">{statusLabel(preview?.status || 'unknown')}</p></div>
                <div className="border border-[var(--tcdx-color-border)] bg-white p-4"><p className="text-xs text-[var(--tcdx-color-text-secondary)]">Cobertura</p><p className="mt-1 font-semibold">{preview?.sufficiency ? `${Math.round(preview.sufficiency.coverage * 100)}%` : 'Sin medición'}</p></div>
                <div className="border border-[var(--tcdx-color-border)] bg-white p-4"><p className="text-xs text-[var(--tcdx-color-text-secondary)]">Calidad y vigencia</p><p className="mt-1 font-semibold">{preview ? `${statusLabel(preview.quality?.status)} · ${statusLabel(preview.freshness?.status)}` : 'Sin medición'}</p></div>
              </div>

              {canManage && currentVersion && (
                <div className="mt-6 border-t border-[var(--tcdx-color-border)] pt-5">
                  <h3 className="text-base font-semibold">Configuración técnica autorizada</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void runPreview()} disabled={Boolean(busy)} className="min-h-10 bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white">Validar y previsualizar</button>
                    {currentVersion.status === 'draft' && <button type="button" onClick={() => void transition('review')} disabled={Boolean(busy)} className="min-h-10 border border-[var(--tcdx-color-border)] px-4 text-sm font-semibold">Enviar a revisión</button>}
                    {currentVersion.status === 'reviewed' && <button type="button" onClick={() => void transition('approve')} disabled={Boolean(busy)} className="min-h-10 border border-[var(--tcdx-color-border)] px-4 text-sm font-semibold">Aprobar</button>}
                    {currentVersion.status === 'approved' && <button type="button" onClick={() => void transition('publish')} disabled={Boolean(busy)} className="min-h-10 border border-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-[var(--tcdx-color-primary)]">Publicar</button>}
                    {currentVersion.status === 'published' && <button type="button" onClick={() => void ingest()} disabled={Boolean(busy)} className="min-h-10 border border-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-[var(--tcdx-color-primary)]">Ingerir observaciones</button>}
                  </div>
                  <form onSubmit={saveMapping} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="text-xs font-semibold">Tabla permitida<input required value={mappingForm.physical_table} onChange={(event) => setMappingForm({ ...mappingForm, physical_table: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
                    <label className="text-xs font-semibold">Columna<input required value={mappingForm.physical_column} onChange={(event) => setMappingForm({ ...mappingForm, physical_column: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
                    <label className="text-xs font-semibold">Campo canónico<input required value={mappingForm.canonical_field} onChange={(event) => setMappingForm({ ...mappingForm, canonical_field: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
                    <label className="text-xs font-semibold">Transformación<select value={mappingForm.transformation_type} onChange={(event) => setMappingForm({ ...mappingForm, transformation_type: event.target.value })} className="mt-1 min-h-10 w-full border bg-white px-3 text-sm">{TRANSFORMATIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <button type="submit" disabled={Boolean(busy) || currentVersion.status === 'published'} className="min-h-10 self-end border border-[var(--tcdx-color-border)] px-3 text-sm font-semibold disabled:opacity-50">Guardar mapping</button>
                  </form>
                  <div className="mt-4 overflow-x-auto border border-[var(--tcdx-color-border)]">
                    <table className="min-w-full text-sm"><thead className="bg-[var(--tcdx-color-surface)]"><tr><th className="p-3 text-left">Campo canónico</th><th className="p-3 text-left">Origen</th><th className="p-3 text-left">Transformación</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{currentVersion.mappings?.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.canonical_field}</td><td className="p-3">{item.physical_table}.{item.physical_column}</td><td className="p-3">{item.transformation_type}</td><td className="p-3">{statusLabel(item.status)}</td></tr>)}</tbody></table>
                  </div>
                </div>
              )}

              {preview && (
                <div className="mt-6 border-t border-[var(--tcdx-color-border)] pt-5">
                  <h3 className="text-base font-semibold">Resultado de validación</h3>
                  <p className="mt-2 text-sm">{statusLabel(preview.status)}. {preview.sufficiency?.usable_rows || 0} de {preview.sufficiency?.sample_size || 0} registros utilizables.</p>
                  {preview.warnings?.length ? <ul className="mt-3 list-disc pl-5 text-sm">{preview.warnings.map((warning, index) => <li key={index}>{typeof warning === 'string' ? warning : `${warning.field || 'Fuente'}: ${warning.message || warning.code}`}</li>)}</ul> : null}
                </div>
              )}

              <div className="mt-6 border-t border-[var(--tcdx-color-border)] pt-5">
                <h3 className="text-base font-semibold">Observaciones vigentes</h3>
                <div className="mt-3 overflow-x-auto border border-[var(--tcdx-color-border)]">
                  <table className="min-w-full text-sm"><thead className="bg-[var(--tcdx-color-surface)]"><tr><th className="p-3 text-left">Concepto</th><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Calidad</th><th className="p-3 text-left">Vigencia</th><th className="p-3 text-left">Trazabilidad</th></tr></thead><tbody>
                    {observations.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.observation_type}</td><td className="p-3">{new Date(item.observed_at).toLocaleString('es-CL')}</td><td className="p-3">{statusLabel(item.quality_status)}</td><td className="p-3">{statusLabel(item.freshness_status)}</td><td className="p-3"><Link className="font-semibold text-[var(--tcdx-color-primary)]" href={`/datos/lineage?entityType=grc_observation&entityId=${item.id}&mode=lineage`}>Ver lineage</Link></td></tr>)}
                    {!observations.length && <tr><td colSpan={5} className="p-4 text-[var(--tcdx-color-text-secondary)]">Aún no existen observaciones para esta fuente.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {canManage && (
        <section className="mt-8 grid gap-6 border-t border-[var(--tcdx-color-border)] pt-6 lg:grid-cols-2">
          <form onSubmit={createContract} className="border border-[var(--tcdx-color-border)] bg-white p-5">
            <h2 className="font-semibold">Nuevo contrato semántico</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Código<input required value={contractForm.source_code} onChange={(event) => setContractForm({ ...contractForm, source_code: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Nombre visible<input required value={contractForm.display_name} onChange={(event) => setContractForm({ ...contractForm, display_name: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Entidad<input required value={contractForm.entity_type} onChange={(event) => setContractForm({ ...contractForm, entity_type: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Adaptador autorizado<input required value={contractForm.adapter_key} onChange={(event) => setContractForm({ ...contractForm, adapter_key: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
            </div>
            <button type="submit" disabled={Boolean(busy)} className="mt-4 min-h-10 bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white">Crear contrato</button>
          </form>
          <form onSubmit={createVersion} className="border border-[var(--tcdx-color-border)] bg-white p-5">
            <h2 className="font-semibold">Nueva versión</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Tabla permitida<input required value={versionForm.physical_table} onChange={(event) => setVersionForm({ ...versionForm, physical_table: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Timestamp<input value={versionForm.timestamp_field} onChange={(event) => setVersionForm({ ...versionForm, timestamp_field: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Campos obligatorios<input required value={versionForm.required_fields} onChange={(event) => setVersionForm({ ...versionForm, required_fields: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
              <label className="text-xs font-semibold">Cobertura mínima<input type="number" min="0" max="1" step="0.01" value={versionForm.minimum_coverage} onChange={(event) => setVersionForm({ ...versionForm, minimum_coverage: event.target.value })} className="mt-1 min-h-10 w-full border px-3 text-sm" /></label>
            </div>
            <button type="submit" disabled={Boolean(busy) || !selectedId} className="mt-4 min-h-10 border border-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-[var(--tcdx-color-primary)]">Crear versión</button>
          </form>
        </section>
      )}
    </main>
  );
}
