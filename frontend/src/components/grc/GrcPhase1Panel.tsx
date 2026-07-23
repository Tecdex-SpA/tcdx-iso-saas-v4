'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  EnterpriseBadge,
  EnterpriseButton,
  EnterpriseCard,
  EnterpriseEmptyState,
} from '@/components/ui/enterprise';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type PanelMode = 'dashboard' | 'evidence' | 'audit' | 'framework' | 'workflow';
type PermissionMap = Record<string, boolean> & { platform?: boolean };

type MetaResponse = {
  module?: { is_enabled?: boolean; display_name?: string };
  permissions?: PermissionMap;
};

type Summary = {
  active_workflows?: number;
  open_evidence_requests?: number;
  overdue_evidence_requests?: number;
  readiness_score?: number | string | null;
  pending_workpaper_reviews?: number;
  framework_mappings?: number;
};

type EvidenceRequest = {
  id: string;
  title: string;
  status: string;
  due_at?: string | null;
  valid_until?: string | null;
  submission_count?: number;
  latest_quality_score?: number | string | null;
};

type WorkflowDefinition = {
  id: string;
  code: string;
  name: string;
  entity_type: string;
  status: string;
  active_version?: number | null;
  instance_count?: number;
};

type Framework = {
  id: string;
  code: string;
  name: string;
  content_classification: string;
  versions?: Array<{ id: string; version_label: string; status: string }>;
};

type AuditWorkspace = {
  universe_entities?: number;
  annual_plans?: number;
  programs?: number;
  workpapers?: number;
  pending_reviews?: number;
  open_conflicts?: number;
  open_followups?: number;
  review_queue?: Array<{ id: string; audit_id: string; code: string; version: number; status: string; objective: string }>;
};

type Readiness = {
  id: string;
  score: number | string;
  generated_at: string;
  formula_version: string;
  results?: Array<{
    dimension: string;
    score: number | string;
    weight: number | string;
    rule_description: string;
    formula: string;
    source_table: string;
  }>;
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: string; code?: string };

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('Tu sesión no está disponible. Ingresa nuevamente.');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const envelope = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || envelope.ok === false) {
    throw new Error(envelope.error || 'No fue posible completar la operación.');
  }
  return envelope.data as T;
}

async function downloadExport(domain: string, format: string) {
  const token = getToken();
  if (!token) throw new Error('Tu sesión no está disponible. Ingresa nuevamente.');
  const response = await fetch(`${API_URL}/api/grc/exports/${domain}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, filters: {} }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiEnvelope<never>;
    throw new Error(body.error || 'No fue posible generar la exportación.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `grc_${domain}.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function can(permissions: PermissionMap, key: string) {
  return permissions.platform === true || permissions[key] === true;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-CL');
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['approved', 'published', 'active', 'completed'].includes(status)) return 'success';
  if (['rejected', 'expired', 'critical'].includes(status)) return 'danger';
  if (['requested', 'submitted', 'under_review', 'changes_requested'].includes(status)) return 'warning';
  if (['draft', 'planned'].includes(status)) return 'info';
  return 'neutral';
}

export default function GrcPhase1Panel({ mode }: { mode: PanelMode }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const permissions = useMemo(() => meta?.permissions || {}, [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextMeta = await api<MetaResponse>('/api/grc/meta');
      setMeta(nextMeta);
      if (nextMeta.module?.is_enabled !== true) return;
      if (mode === 'dashboard') {
        const [summary, latest] = await Promise.all([
          api<Summary>('/api/grc/summary'),
          api<Readiness | null>('/api/grc/readiness/latest'),
        ]);
        setData(summary);
        setReadiness(latest);
      }
      if (mode === 'evidence') setData(await api<EvidenceRequest[]>('/api/grc/evidence/requests'));
      if (mode === 'workflow') setData(await api<WorkflowDefinition[]>('/api/grc/workflows'));
      if (mode === 'framework') setData(await api<Framework[]>('/api/grc/frameworks'));
      if (mode === 'audit') setData(await api<AuditWorkspace>('/api/grc/audits/workspace'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible cargar el núcleo GRC.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function perform(action: () => Promise<unknown>) {
    setActionLoading(true);
    setError('');
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la operación.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!loading && meta?.module?.is_enabled !== true) return null;

  if (loading) {
    return (
      <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-5" aria-busy="true">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-20 animate-pulse rounded bg-slate-100" />
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Operación GRC avanzada">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--tcdx-color-text-ink)]">Operación GRC avanzada</h2>
            <EnterpriseBadge tone="info">Beta controlada</EnterpriseBadge>
          </div>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            Automatización trazable con revisión humana y alcance por empresa.
          </p>
        </div>
        <EnterpriseButton type="button" variant="secondary" onClick={() => void load()} disabled={actionLoading}>
          Actualizar
        </EnterpriseButton>
      </div>

      {error ? (
        <div role="alert" className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {mode === 'dashboard' ? (
        <><DashboardPanel
          summary={(data || {}) as Summary}
          readiness={readiness}
          canGenerate={can(permissions, 'readiness.generate')}
          disabled={actionLoading}
          onGenerate={() => perform(() => api('/api/grc/readiness/snapshots', { method: 'POST', body: '{}' }))}
        /><ExportPanel domains={['readiness']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></>
      ) : null}
      {mode === 'evidence' ? (
        <><EvidencePanel
          rows={(data || []) as EvidenceRequest[]}
          canCreate={can(permissions, 'evidence.request.manage')}
          disabled={actionLoading}
          onCreate={(body) => perform(() => api('/api/grc/evidence/requests', { method: 'POST', body: JSON.stringify(body) }))}
        /><ExportPanel domains={['evidence']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></>
      ) : null}
      {mode === 'workflow' ? (
        <><WorkflowPanel
          rows={(data || []) as WorkflowDefinition[]}
          canManage={can(permissions, 'workflow.manage')}
          disabled={actionLoading}
          onCreate={(body) => perform(() => api('/api/grc/workflows', { method: 'POST', body: JSON.stringify(body) }))}
          onPublish={(id) => perform(() => api(`/api/grc/workflows/${id}/publish`, { method: 'POST', body: '{}' }))}
        /><AutomationPanel
          disabled={actionLoading}
          canRun={can(permissions, 'grc.scheduler.run')}
          canManage={can(permissions, 'grc.escalation.manage')}
          onRun={() => perform(() => api('/api/grc/scheduler/run', { method: 'POST', body: JSON.stringify({ run_type: 'manual_controlled' }) }))}
          onCreatePolicy={(body) => perform(() => api('/api/grc/escalations/policies', { method: 'POST', body: JSON.stringify(body) }))}
        /></>
      ) : null}
      {mode === 'framework' ? <><FrameworkPanel rows={(data || []) as Framework[]} /><ExportPanel domains={['frameworks', 'mappings']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></> : null}
      {mode === 'audit' ? (
        <AuditPanel
          workspace={(data || {}) as AuditWorkspace}
          canManage={can(permissions, 'audit.plan.manage')}
          canReview={can(permissions, 'audit.review')}
          canExport={can(permissions, 'grc.export.generate')}
          disabled={actionLoading}
          onCreatePlan={(body) => perform(() => api('/api/grc/audits/annual-plans', { method: 'POST', body: JSON.stringify(body) }))}
          onReview={(id, body) => perform(() => api(`/api/grc/audits/workpapers/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }))}
          onExport={(domain, format) => perform(() => downloadExport(domain, format))}
        />
      ) : null}
    </section>
  );
}

function DashboardPanel({
  summary,
  readiness,
  canGenerate,
  disabled,
  onGenerate,
}: {
  summary: Summary;
  readiness: Readiness | null;
  canGenerate: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const stats = [
    ['Readiness', `${number(readiness?.score ?? summary.readiness_score).toFixed(1)}%`],
    ['Workflows activos', number(summary.active_workflows)],
    ['Solicitudes abiertas', number(summary.open_evidence_requests)],
    ['Solicitudes vencidas', number(summary.overdue_evidence_requests)],
    ['Revisiones pendientes', number(summary.pending_workpaper_reviews)],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <EnterpriseCard key={label} className="min-w-0" bodyClassName="p-4">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          </EnterpriseCard>
        ))}
      </div>
      <EnterpriseCard
        title="Preparación para auditoría"
        subtitle={readiness ? `Snapshot ${formatDate(readiness.generated_at)} · ${readiness.formula_version}` : 'Aún no existe un snapshot.'}
        actions={canGenerate ? (
          <EnterpriseButton type="button" onClick={onGenerate} disabled={disabled}>
            {disabled ? 'Generando...' : 'Generar snapshot'}
          </EnterpriseButton>
        ) : undefined}
        bodyClassName="p-5"
      >
        {!readiness?.results?.length ? (
          <EnterpriseEmptyState title="Sin medición disponible" description="Genera un snapshot para obtener un cálculo determinista y desglosable." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {readiness.results.map((result) => (
              <div key={result.dimension} className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-slate-50 p-4" title={`${result.formula} · ${result.source_table}`}>
                <p className="text-sm font-semibold capitalize text-slate-800">{result.dimension}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{number(result.score).toFixed(1)}%</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{result.rule_description}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">Indicador operativo reproducible. No constituye certificación ni reemplaza una auditoría.</p>
      </EnterpriseCard>
    </>
  );
}

function EvidencePanel({ rows, canCreate, disabled, onCreate }: {
  rows: EvidenceRequest[];
  canCreate: boolean;
  disabled: boolean;
  onCreate: (body: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [frequency, setFrequency] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(), status: 'requested', due_at: dueAt || null,
      ...(frequency ? { schedule: { frequency, start_at: new Date().toISOString(), interval_value: 1 } } : {}),
    });
    setTitle('');
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <EnterpriseCard title="Solicitudes y recurrencia" subtitle="Estado, vigencia y trazabilidad de la evidencia requerida." bodyClassName="p-0">
        {!rows.length ? (
          <div className="p-5"><EnterpriseEmptyState title="Sin solicitudes" description="No existen solicitudes de evidencia continua para esta empresa." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr><th className="px-4 py-3">Solicitud</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3">Entregas</th><th className="px-4 py-3">Calidad</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="max-w-xs px-4 py-3 font-semibold text-slate-900"><span className="line-clamp-2" title={row.title}>{row.title}</span></td>
                    <td className="px-4 py-3"><EnterpriseBadge tone={statusTone(row.status)}>{row.status}</EnterpriseBadge></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.due_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{number(row.submission_count)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.latest_quality_score == null ? 'Sin cálculo' : `${number(row.latest_quality_score).toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EnterpriseCard>
      {canCreate ? (
        <EnterpriseCard title="Nueva solicitud" subtitle="La recurrencia es idempotente y auditable." bodyClassName="p-5">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold text-slate-700">Título<input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Fecha límite<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Periodicidad<select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"><option value="">Única</option><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></label>
            <EnterpriseButton type="submit" disabled={disabled || !title.trim()} className="w-full">{disabled ? 'Creando...' : 'Crear solicitud'}</EnterpriseButton>
          </form>
        </EnterpriseCard>
      ) : null}
    </div>
  );
}

function WorkflowPanel({ rows, canManage, disabled, onCreate, onPublish }: {
  rows: WorkflowDefinition[];
  canManage: boolean;
  disabled: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onPublish: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('evidence');
  function submit(event: FormEvent) {
    event.preventDefault();
    const code = `${entityType}-${name}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    onCreate({
      code, name, entity_type: entityType,
      states: [
        { code: 'draft', name: 'Borrador', state_type: 'initial' },
        { code: 'under_review', name: 'En revisión', state_type: 'active' },
        { code: 'approved', name: 'Aprobado', state_type: 'terminal' },
        { code: 'rejected', name: 'Rechazado', state_type: 'rejected' },
      ],
      transitions: [
        { code: 'submit', name: 'Enviar a revisión', from_state: 'draft', to_state: 'under_review', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor', 'operativo'] },
        { code: 'approve', name: 'Aprobar', from_state: 'under_review', to_state: 'approved', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor'], preconditions: ['comment_required'] },
        { code: 'reject', name: 'Rechazar', from_state: 'under_review', to_state: 'rejected', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor'], preconditions: ['comment_required'] },
      ],
    });
    setName('');
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <EnterpriseCard title="Definiciones versionadas" subtitle="Las versiones publicadas son inmutables; las instancias conservan su versión." bodyClassName="p-5">
        {!rows.length ? <EnterpriseEmptyState title="Sin workflows" description="No existen definiciones configuradas para esta empresa." /> : (
          <div className="space-y-3">{rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
              <div className="min-w-0"><p className="truncate font-semibold text-slate-900" title={row.name}>{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.entity_type} · versión {row.active_version || 'borrador'} · {number(row.instance_count)} instancias</p></div>
              <div className="flex items-center gap-2"><EnterpriseBadge tone={statusTone(row.status)}>{row.status}</EnterpriseBadge>{canManage && !row.active_version ? <EnterpriseButton type="button" variant="secondary" onClick={() => onPublish(row.id)} disabled={disabled}>Publicar</EnterpriseButton> : null}</div>
            </div>
          ))}</div>
        )}
      </EnterpriseCard>
      {canManage ? (
        <EnterpriseCard title="Crear borrador" subtitle="Plantilla operativa editable antes de publicar." bodyClassName="p-5">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold text-slate-700">Nombre<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Entidad<select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"><option value="evidence">Evidencia</option><option value="action">Acción</option><option value="finding">Hallazgo</option><option value="nonconformity">No conformidad</option><option value="document">Documento</option><option value="audit">Auditoría</option><option value="control">Control</option><option value="risk">Riesgo</option></select></label>
            <EnterpriseButton type="submit" disabled={disabled || !name.trim()} className="w-full">{disabled ? 'Creando...' : 'Crear borrador'}</EnterpriseButton>
          </form>
        </EnterpriseCard>
      ) : null}
    </div>
  );
}

function FrameworkPanel({ rows }: { rows: Framework[] }) {
  return (
    <EnterpriseCard title="Frameworks y versiones" subtitle="Referencias normativas versionadas sin reproducir contenido protegido." bodyClassName="p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-950">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.code}</p></div><EnterpriseBadge tone="neutral">{row.content_classification}</EnterpriseBadge></div>
            <p className="mt-3 text-sm text-slate-600">{row.versions?.length ? `${row.versions.length} versión(es) registradas` : 'Referencia registrada; versión pendiente de publicación.'}</p>
          </div>
        ))}
      </div>
    </EnterpriseCard>
  );
}

function AutomationPanel({ disabled, canRun, canManage, onRun, onCreatePolicy }: {
  disabled: boolean;
  canRun: boolean;
  canManage: boolean;
  onRun: () => void;
  onCreatePolicy: (body: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState('evidence-default');
  const [entityType, setEntityType] = useState('evidence_request');
  const [priorNotice, setPriorNotice] = useState('24');
  const [secondEscalation, setSecondEscalation] = useState('24');
  if (!canRun && !canManage) return null;
  return (
    <EnterpriseCard title="Scheduler y escalamiento" subtitle="Ejecución idempotente con locking, retry y políticas configurables por empresa." bodyClassName="p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        {canManage ? (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onCreatePolicy({ code, entity_type: entityType, prior_notice_hours: Number(priorNotice), first_escalation_hours: 0, second_escalation_hours: Number(secondEscalation), role_keys: [] }); }}>
            <label className="text-sm font-semibold text-slate-700">Código<input value={code} onChange={(event) => setCode(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Entidad<select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="evidence_request">Solicitud de evidencia</option><option value="action">Acción</option><option value="audit_followup">Seguimiento de auditoría</option><option value="audit">Auditoría</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Aviso previo (horas)<input type="number" min="0" value={priorNotice} onChange={(event) => setPriorNotice(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="text-sm font-semibold text-slate-700">Segundo escalamiento (horas)<input type="number" min="0" value={secondEscalation} onChange={(event) => setSecondEscalation(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <EnterpriseButton type="submit" disabled={disabled || !code.trim()}>Guardar política</EnterpriseButton>
          </form>
        ) : <div />}
        {canRun ? <EnterpriseButton type="button" variant="secondary" disabled={disabled} onClick={onRun}>{disabled ? 'Ejecutando...' : 'Ejecutar ahora'}</EnterpriseButton> : null}
      </div>
    </EnterpriseCard>
  );
}

function AuditPanel({ workspace, canManage, canReview, canExport, disabled, onCreatePlan, onReview, onExport }: {
  workspace: AuditWorkspace;
  canManage: boolean;
  canReview: boolean;
  canExport: boolean;
  disabled: boolean;
  onCreatePlan: (body: Record<string, unknown>) => void;
  onReview: (id: string, body: Record<string, unknown>) => void;
  onExport: (domain: string, format: string) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [observations, setObservations] = useState('');
  const stats = [
    ['Universo auditable', workspace.universe_entities], ['Planes anuales', workspace.annual_plans],
    ['Programas', workspace.programs], ['Papeles de trabajo', workspace.workpapers],
    ['Revisiones pendientes', workspace.pending_reviews], ['Conflictos abiertos', workspace.open_conflicts],
    ['Seguimientos abiertos', workspace.open_followups],
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <EnterpriseCard title="Auditoría avanzada" subtitle="Universo, planificación, ejecución, revisión y seguimiento en un mismo dominio." bodyClassName="p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{number(value)}</p></div>)}</div>
        <p className="mt-4 text-xs text-slate-500">La asignación de papeles de trabajo bloquea conflictos de independencia abiertos.</p>
        {canReview && workspace.review_queue?.length ? (
          <div className="mt-5 space-y-3" aria-label="Revisión supervisora">
            <label className="block text-sm font-semibold text-slate-700">Observaciones supervisoras<input value={observations} onChange={(event) => setObservations(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            {workspace.review_queue.slice(0, 5).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div><p className="font-semibold text-slate-900">{item.code} · v{item.version}</p><p className="text-xs text-slate-500">{item.objective}</p></div>
                <div className="flex gap-2"><EnterpriseButton type="button" variant="secondary" disabled={disabled} onClick={() => onReview(item.id, { decision: 'approved', observations })}>Aprobar</EnterpriseButton><EnterpriseButton type="button" variant="secondary" disabled={disabled || !observations.trim()} onClick={() => onReview(item.id, { decision: 'returned', observations })}>Devolver</EnterpriseButton></div>
              </div>
            ))}
          </div>
        ) : null}
      </EnterpriseCard>
      {canManage ? (
        <EnterpriseCard title="Plan anual" subtitle="Crea una versión auditable del plan." bodyClassName="p-5">
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onCreatePlan({ year: Number(year), prioritization_criteria: { method: 'risk_based' } }); }}>
            <label className="block text-sm font-semibold text-slate-700">Año<input type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            <EnterpriseButton type="submit" disabled={disabled} className="w-full">{disabled ? 'Creando...' : 'Crear plan'}</EnterpriseButton>
          </form>
        </EnterpriseCard>
      ) : null}
      <div className="xl:col-span-2"><ExportPanel domains={['audit', 'findings', 'actions']} disabled={disabled} canExport={canExport} onExport={onExport} /></div>
    </div>
  );
}

function ExportPanel({ domains, disabled, canExport, onExport }: {
  domains: string[];
  disabled: boolean;
  canExport: boolean;
  onExport: (domain: string, format: string) => void;
}) {
  const [domain, setDomain] = useState(domains[0]);
  const [format, setFormat] = useState('xlsx');
  if (!canExport) return null;
  return (
    <EnterpriseCard title="Exportación trazable" subtitle="Datos reales del tenant con versión, fecha, identificador y hash reproducible." bodyClassName="p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-slate-700">Dominio<select value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-2 block min-h-11 rounded-md border border-slate-300 px-3">{domains.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Formato<select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-2 block min-h-11 rounded-md border border-slate-300 px-3"><option value="xlsx">XLSX</option><option value="csv">CSV</option><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label>
        <EnterpriseButton type="button" disabled={disabled} onClick={() => onExport(domain, format)}>{disabled ? 'Generando...' : 'Exportar'}</EnterpriseButton>
      </div>
    </EnterpriseCard>
  );
}
