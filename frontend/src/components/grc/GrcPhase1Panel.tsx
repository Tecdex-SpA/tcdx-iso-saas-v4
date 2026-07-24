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

type EvidenceSubmission = {
  id: string;
  evidence_id: string;
  status: string;
  versions: Array<{ id: string; version: number; evidence_id: string; created_at: string }>;
  reviews: Array<{ id: string; decision: string; reason?: string; created_at: string }>;
};

type EvidenceRequestDetail = EvidenceRequest & {
  submissions: EvidenceSubmission[];
  requirements: Array<{ id: string; requirement_type: string; requirement_id: string; mandatory: boolean }>;
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

type WorkflowInstance = {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  current_state_name: string;
  available_transitions: Array<{ code: string; name: string; approval_mode: string }>;
  history: Array<{ id: string; comment?: string; created_at: string }>;
  approvals: Array<{ id: string; decision: string; comment?: string }>;
};

type Framework = {
  id: string;
  code: string;
  name: string;
  content_classification: string;
  versions?: Array<{ id: string; version_label: string; status: string }>;
};

type FrameworkRequirement = {
  id: string;
  reference_code: string;
  permitted_title?: string | null;
  tcdx_interpretation?: string | null;
  framework_code: string;
  framework_name: string;
  version_label: string;
};

type FrameworkMapping = {
  id: string;
  requirement_id: string;
  tenant_control_id?: string | null;
  mapping_type: string;
  coverage_level: number | string;
  justification: string;
  status: string;
  framework_code: string;
  reference_code: string;
  reviews: Array<{ id: string; decision: string; comment?: string }>;
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

type AuditOperations = {
  audit_id: string;
  team: Array<{ id: string; user_id: string; team_role: string; independence_status: string }>;
  conflicts: Array<{ id: string; team_member_id: string; conflict_type: string; description: string; status: string }>;
  programs: Array<{ id: string; version: number; status: string }>;
  samples: Array<{ id: string; sample_size: number; method: string }>;
  workpapers: Array<{ id: string; code: string; status: string; version: number }>;
  evidence_links: Array<{ evidence_id: string; workpaper_id?: string | null }>;
  reviews: Array<{ id: string; decision: string; version: number }>;
  followups: Array<{ id: string; status: string; due_at?: string | null }>;
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

type BootstrapStatus = {
  tenant_id: string;
  initialized: boolean;
  ready: boolean;
  checks: Record<string, boolean>;
  missing: string[];
  counts: {
    workflows: number;
    escalation_policies: number;
    readiness_rules: number;
    frameworks: number;
    mappings: number;
  };
  configuration?: {
    initialized_at?: string;
    validated_at?: string;
    bootstrap_version?: number;
  } | null;
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

async function downloadExport(domain: string, format: string, filters: Record<string, unknown> = {}) {
  const token = getToken();
  if (!token) throw new Error('Tu sesión no está disponible. Ingresa nuevamente.');
  const response = await fetch(`${API_URL}/api/grc/exports/${domain}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, filters }),
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
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [frameworkRequirements, setFrameworkRequirements] = useState<FrameworkRequirement[]>([]);
  const [frameworkMappings, setFrameworkMappings] = useState<FrameworkMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const permissions = useMemo(() => meta?.permissions || {}, [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
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
      if (mode === 'workflow') {
        const [workflows, bootstrap] = await Promise.all([
          api<WorkflowDefinition[]>('/api/grc/workflows'),
          can(nextMeta.permissions || {}, 'workflow.manage')
            ? api<BootstrapStatus>('/api/grc/bootstrap/status')
            : Promise.resolve(null),
        ]);
        setData(workflows);
        setBootstrapStatus(bootstrap);
      }
      if (mode === 'framework') {
        const [frameworks, requirements, mappings] = await Promise.all([
          api<Framework[]>('/api/grc/frameworks'),
          api<FrameworkRequirement[]>('/api/grc/framework-requirements'),
          api<FrameworkMapping[]>('/api/grc/mappings'),
        ]);
        setData(frameworks);
        setFrameworkRequirements(requirements);
        setFrameworkMappings(mappings);
      }
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

  async function perform(action: () => Promise<unknown>, successMessage = 'Operación completada y persistida.') {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await action();
      await load();
      setSuccess(successMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la operación.');
    } finally {
      setActionLoading(false);
    }
  }

  async function performWithoutReload(
    action: () => Promise<unknown>,
    successMessage = 'Operación validada.'
  ) {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible completar la validación.');
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
      {success ? (
        <div role="status" aria-live="polite" className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {mode === 'dashboard' ? (
        <><DashboardPanel
          summary={(data || {}) as Summary}
          readiness={readiness}
          canGenerate={can(permissions, 'readiness.generate')}
          disabled={actionLoading}
          onGenerate={() => perform(() => api('/api/grc/readiness/snapshots', { method: 'POST', body: '{}' }), 'Snapshot generado y persistido.')}
        /><ExportPanel domains={['readiness']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></>
      ) : null}
      {mode === 'evidence' ? (
        <><EvidencePanel
          rows={(data || []) as EvidenceRequest[]}
          canCreate={can(permissions, 'evidence.request.manage')}
          disabled={actionLoading}
          onCreate={(body) => perform(() => api('/api/grc/evidence/requests', { method: 'POST', body: JSON.stringify(body) }), 'Solicitud de evidencia creada.')}
        /><EvidenceOperationsPanel
          requests={(data || []) as EvidenceRequest[]}
          canManage={can(permissions, 'evidence.request.manage')}
          canReview={can(permissions, 'evidence.review')}
        /><ExportPanel domains={['evidence']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></>
      ) : null}
      {mode === 'workflow' ? (
        <><BootstrapPanel
          status={bootstrapStatus}
          disabled={actionLoading}
          canManage={can(permissions, 'workflow.manage')}
          onInitialize={() => perform(
            () => api('/api/grc/bootstrap', {
              method: 'POST',
              headers: { 'Idempotency-Key': `grc-bootstrap-${crypto.randomUUID()}` },
              body: JSON.stringify({ confirmation: 'INITIALIZE_GRC' }),
            }),
            'Núcleo GRC inicializado y validado.'
          )}
          onValidate={() => perform(
            () => api('/api/grc/bootstrap/validate', { method: 'POST', body: '{}' }),
            'Configuración GRC revalidada.'
          )}
        /><WorkflowPanel
          rows={(data || []) as WorkflowDefinition[]}
          canManage={can(permissions, 'workflow.manage')}
          disabled={actionLoading}
          onCreate={(body) => perform(() => api('/api/grc/workflows', { method: 'POST', body: JSON.stringify(body) }), 'Borrador de workflow creado.')}
          onSave={(id, body) => perform(() => api(`/api/grc/workflows/${id}/draft`, { method: 'PUT', body: JSON.stringify(body) }), 'Borrador validado y guardado.')}
          onValidate={(body) => performWithoutReload(
            () => api('/api/grc/workflows/validate', {
              method: 'POST',
              body: JSON.stringify(body),
            }),
            'Configuración de workflow válida.'
          )}
          onPublish={(id) => perform(() => api(`/api/grc/workflows/${id}/publish`, { method: 'POST', body: '{}' }), 'Versión de workflow publicada.')}
          onArchive={(id) => perform(() => api(`/api/grc/workflows/${id}/archive`, { method: 'POST', body: '{}' }), 'Workflow archivado.')}
        /><WorkflowRuntimePanel
          definitions={(data || []) as WorkflowDefinition[]}
          canTransition={can(permissions, 'workflow.transition')}
        /><AutomationPanel
          disabled={actionLoading}
          canRun={can(permissions, 'grc.scheduler.run')}
          canManage={can(permissions, 'grc.escalation.manage')}
          onRun={() => perform(() => api('/api/grc/scheduler/run', { method: 'POST', body: JSON.stringify({ run_type: 'manual_controlled' }) }), 'Scheduler ejecutado; revisa el resumen actualizado.')}
          onCreatePolicy={(body) => perform(() => api('/api/grc/escalations/policies', { method: 'POST', body: JSON.stringify(body) }), 'Política de escalamiento guardada.')}
        /></>
      ) : null}
      {mode === 'framework' ? <><FrameworkPanel
        rows={(data || []) as Framework[]}
        requirements={frameworkRequirements}
        mappings={frameworkMappings}
        canManage={can(permissions, 'framework.manage')}
        disabled={actionLoading}
        onCreate={(body) => perform(() => api('/api/grc/mappings', { method: 'POST', body: JSON.stringify(body) }), 'Mapping creado y enviado a revisión.')}
        onReview={(id, body) => perform(() => api(`/api/grc/mappings/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }), 'Revisión de mapping persistida.')}
      /><ExportPanel domains={['frameworks', 'mappings']} disabled={actionLoading} canExport={can(permissions, 'grc.export.generate')} onExport={(domain, format) => perform(() => downloadExport(domain, format))} /></> : null}
      {mode === 'audit' ? (
        <><AuditPanel
          workspace={(data || {}) as AuditWorkspace}
          canManage={can(permissions, 'audit.plan.manage')}
          canReview={can(permissions, 'audit.review')}
          canExport={can(permissions, 'grc.export.generate')}
          disabled={actionLoading}
          onCreatePlan={(body) => perform(() => api('/api/grc/audits/annual-plans', { method: 'POST', body: JSON.stringify(body) }), 'Plan anual creado y persistido.')}
          onReview={(id, body) => perform(() => api(`/api/grc/audits/workpapers/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }), 'Revisión supervisora registrada.')}
          onExport={(domain, format) => perform(() => downloadExport(domain, format))}
        /><AuditOperationsConsole
          canManage={can(permissions, 'audit.plan.manage')}
          canWorkpaper={can(permissions, 'audit.workpaper.manage')}
          canReview={can(permissions, 'audit.review')}
          canExport={can(permissions, 'grc.export.generate')}
        /></>
      ) : null}
    </section>
  );
}

function BootstrapPanel({
  status,
  disabled,
  canManage,
  onInitialize,
  onValidate,
}: {
  status: BootstrapStatus | null;
  disabled: boolean;
  canManage: boolean;
  onInitialize: () => void;
  onValidate: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  if (!canManage) return null;
  return (
    <EnterpriseCard
      title="Inicialización operacional GRC"
      subtitle="Configuración explícita, idempotente y auditable para este tenant."
      bodyClassName="p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseBadge tone={status?.ready ? 'success' : status?.initialized ? 'warning' : 'neutral'}>
              {status?.ready ? 'Listo' : status?.initialized ? 'Requiere atención' : 'No inicializado'}
            </EnterpriseBadge>
            {status?.configuration?.bootstrap_version ? (
              <span className="text-xs text-slate-500">Bootstrap v{status.configuration.bootstrap_version}</span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {status?.ready
              ? `${status.counts.workflows} workflows, ${status.counts.readiness_rules} reglas y ${status.counts.escalation_policies} políticas verificadas.`
              : status?.missing?.length
                ? `Faltan: ${status.missing.join(', ')}.`
                : 'Comprueba el estado y ejecuta la inicialización controlada.'}
          </p>
          {status?.configuration?.initialized_at ? (
            <p className="mt-2 text-xs text-slate-500">
              Inicializado: {formatDate(status.configuration.initialized_at)}
              {status.configuration.validated_at ? ` · Validado: ${formatDate(status.configuration.validated_at)}` : ''}
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          {!status?.ready ? (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 size-4"
              />
              <span>Confirmo la creación de configuración base sin datos de negocio.</span>
            </label>
          ) : null}
          {!status?.ready ? (
            <EnterpriseButton type="button" disabled={disabled || !confirmed} onClick={onInitialize} className="w-full">
              {disabled ? 'Inicializando...' : status?.initialized ? 'Completar inicialización' : 'Inicializar GRC'}
            </EnterpriseButton>
          ) : null}
          <EnterpriseButton type="button" variant="secondary" disabled={disabled || !status?.initialized} onClick={onValidate} className="w-full">
            Revalidar configuración
          </EnterpriseButton>
        </div>
      </div>
    </EnterpriseCard>
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

function EvidenceOperationsPanel({ requests, canManage, canReview }: {
  requests: EvidenceRequest[];
  canManage: boolean;
  canReview: boolean;
}) {
  const [requestId, setRequestId] = useState('');
  const [detail, setDetail] = useState<EvidenceRequestDetail | null>(null);
  const [evidenceId, setEvidenceId] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [reason, setReason] = useState('');
  const [entityType, setEntityType] = useState('control');
  const [entityId, setEntityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!canManage && !canReview) return null;
  async function load(id = requestId) {
    if (!id) return;
    const next = await api<EvidenceRequestDetail>(`/api/grc/evidence/requests/${id}`);
    setDetail(next);
    if (!submissionId && next.submissions[0]) setSubmissionId(next.submissions[0].id);
  }
  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      await load();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible operar la evidencia.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <EnterpriseCard title="Entrega, revisión y vínculos" subtitle="Opera evidencias existentes del tenant, conserva versiones y registra cada decisión." bodyClassName="p-5">
      {message ? <p role="status" aria-live="polite" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Solicitud
            <select value={requestId} onChange={event => {
              const id = event.target.value;
              setRequestId(id);
              setSubmissionId('');
              setDetail(null);
              if (id) void run(() => load(id), 'Solicitud e historial cargados.');
            }} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3">
              <option value="">Seleccionar</option>
              {requests.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">ID de evidencia existente
            <input value={evidenceId} onChange={event => setEvidenceId(event.target.value)} pattern="[0-9a-fA-F-]{36}" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" />
          </label>
          {canManage ? <div className="flex flex-wrap gap-2">
            <EnterpriseButton type="button" disabled={busy || !requestId || !evidenceId} onClick={() => void run(
              () => api(`/api/grc/evidence/requests/${requestId}/submissions`, { method: 'POST', body: JSON.stringify({ evidence_id: evidenceId, source_type: 'manual' }) }),
              'Evidencia enviada a revisión.'
            )}>Enviar evidencia</EnterpriseButton>
            <EnterpriseButton type="button" variant="secondary" disabled={busy || !submissionId || !evidenceId} onClick={() => void run(
              () => api(`/api/grc/evidence/submissions/${submissionId}/versions`, { method: 'POST', body: JSON.stringify({ evidence_id: evidenceId, source_type: 'manual' }) }),
              'Nueva versión registrada.'
            )}>Nueva versión</EnterpriseButton>
          </div> : null}
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Entrega
            <select value={submissionId} onChange={event => setSubmissionId(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3">
              <option value="">Seleccionar</option>
              {(detail?.submissions || []).map(item => <option key={item.id} value={item.id}>{item.status} · {item.versions.length} versión(es)</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Causa u observación
            <textarea value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-md border border-slate-300 p-3" />
          </label>
          {canReview ? <div className="flex flex-wrap gap-2">
            <EnterpriseButton type="button" disabled={busy || !submissionId} onClick={() => void run(
              () => api(`/api/grc/evidence/submissions/${submissionId}/review`, { method: 'POST', body: JSON.stringify({ decision: 'approved', reason }) }),
              'Evidencia aprobada.'
            )}>Aprobar</EnterpriseButton>
            <EnterpriseButton type="button" variant="secondary" disabled={busy || !submissionId || !reason.trim()} onClick={() => void run(
              () => api(`/api/grc/evidence/submissions/${submissionId}/review`, { method: 'POST', body: JSON.stringify({ decision: 'rejected', reason }) }),
              'Evidencia rechazada con causa.'
            )}>Rechazar</EnterpriseButton>
            <EnterpriseButton type="button" variant="secondary" disabled={busy || !evidenceId} onClick={() => void run(
              () => api(`/api/grc/evidence/${evidenceId}/quality`, { method: 'POST', body: JSON.stringify({ consistent: true, coverage: 1 }) }),
              'Calidad calculada y persistida.'
            )}>Calcular calidad</EnterpriseButton>
          </div> : null}
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Vincular a
            <select value={entityType} onChange={event => setEntityType(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="control">Control</option><option value="audit">Auditoría</option><option value="risk">Riesgo</option><option value="finding">Hallazgo</option><option value="nonconformity">No conformidad</option><option value="action">Acción</option><option value="document">Documento</option></select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">ID de entidad
            <input value={entityId} onChange={event => setEntityId(event.target.value)} pattern="[0-9a-fA-F-]{36}" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" />
          </label>
          {canManage ? <EnterpriseButton type="button" disabled={busy || !evidenceId || !entityId} onClick={() => void run(
            () => api(`/api/grc/evidence/${evidenceId}/links`, { method: 'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId }) }),
            'Evidencia vinculada a la entidad.'
          )}>Vincular evidencia</EnterpriseButton> : null}
          <p className="text-xs text-slate-500">Entregas: {detail?.submissions.length || 0} · Requisitos: {detail?.requirements.length || 0}</p>
        </div>
      </div>
    </EnterpriseCard>
  );
}

function WorkflowPanel({ rows, canManage, disabled, onCreate, onSave, onValidate, onPublish, onArchive }: {
  rows: WorkflowDefinition[];
  canManage: boolean;
  disabled: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onSave: (id: string, body: Record<string, unknown>) => void;
  onValidate: (body: Record<string, unknown>) => void;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('evidence');
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<{ id: string; versions: Array<{ id: string; version: number; status: string; published_at?: string | null }> } | null>(null);
  const [historyError, setHistoryError] = useState('');
  function draftBody() {
    const code = `${entityType}-${name}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      code, name, entity_type: entityType,
      states: [
        { code: 'draft', name: 'Borrador', state_type: 'initial' },
        { code: 'under_review', name: 'En revisión', state_type: 'active' },
        { code: 'approved', name: 'Aprobado', state_type: 'terminal' },
        { code: 'rejected', name: 'Rechazado', state_type: 'rejected' },
      ],
      transitions: [
        { code: 'submit', name: 'Enviar a revisión', from_state: 'draft', to_state: 'under_review', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor', 'control_owner'] },
        { code: 'approve', name: 'Aprobar', from_state: 'under_review', to_state: 'approved', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor'], preconditions: ['comment_required'] },
        { code: 'reject', name: 'Rechazar', from_state: 'under_review', to_state: 'rejected', required_permission: 'workflow.transition', roles: ['admin', 'tenant_admin', 'auditor'], preconditions: ['comment_required'] },
      ],
    };
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const body = draftBody();
    if (selectedId) onSave(selectedId, body);
    else onCreate(body);
    setName('');
    setSelectedId('');
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <EnterpriseCard title="Definiciones versionadas" subtitle="Las versiones publicadas son inmutables; las instancias conservan su versión." bodyClassName="p-5">
        {!rows.length ? <EnterpriseEmptyState title="Sin workflows" description="No existen definiciones configuradas para esta empresa." /> : (
          <div className="space-y-3">{rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
              <div className="min-w-0"><p className="truncate font-semibold text-slate-900" title={row.name}>{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.entity_type} · versión {row.active_version || 'borrador'} · {number(row.instance_count)} instancias</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <EnterpriseBadge tone={statusTone(row.status)}>{row.status}</EnterpriseBadge>
                {canManage && row.status !== 'archived' ? <EnterpriseButton type="button" variant="secondary" onClick={() => { setSelectedId(row.id); setName(row.name); setEntityType(row.entity_type); }} disabled={disabled}>Editar borrador</EnterpriseButton> : null}
                {canManage && row.status === 'draft' ? <EnterpriseButton type="button" variant="secondary" onClick={() => onPublish(row.id)} disabled={disabled}>Publicar</EnterpriseButton> : null}
                <EnterpriseButton type="button" variant="secondary" onClick={() => {
                  setHistoryError('');
                  void api<{ id: string; versions: Array<{ id: string; version: number; status: string; published_at?: string | null }> }>(`/api/grc/workflows/${row.id}`)
                    .then(setHistory)
                    .catch(caught => setHistoryError(caught instanceof Error ? caught.message : 'No fue posible cargar el historial.'));
                }} disabled={disabled}>Historial</EnterpriseButton>
                {canManage && row.status !== 'archived' ? <EnterpriseButton type="button" variant="secondary" onClick={() => onArchive(row.id)} disabled={disabled}>Archivar</EnterpriseButton> : null}
              </div>
            </div>
          ))}</div>
        )}
        {history ? <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">Historial de versiones</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{history.versions.map(version => <li key={version.id}>v{version.version} · {version.status}{version.published_at ? ` · ${formatDate(version.published_at)}` : ''}</li>)}</ul></div> : null}
        {historyError ? <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{historyError}</p> : null}
      </EnterpriseCard>
      {canManage ? (
        <EnterpriseCard title="Crear borrador" subtitle="Plantilla operativa editable antes de publicar." bodyClassName="p-5">
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-xs text-slate-500">{selectedId ? 'Editando una versión borrador de la definición seleccionada.' : 'Creando una definición nueva.'}</p>
            <label className="block text-sm font-semibold text-slate-700">Nombre<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100" /></label>
            <label className="block text-sm font-semibold text-slate-700">Entidad<select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"><option value="evidence">Evidencia</option><option value="action">Acción</option><option value="finding">Hallazgo</option><option value="nonconformity">No conformidad</option><option value="document">Documento</option><option value="audit">Auditoría</option><option value="control">Control</option><option value="risk">Riesgo</option></select></label>
            <div className="flex gap-2">
              <EnterpriseButton type="button" variant="secondary" disabled={disabled || !name.trim()} onClick={() => onValidate(draftBody())}>Validar</EnterpriseButton>
              <EnterpriseButton type="submit" disabled={disabled || !name.trim()}>{disabled ? 'Guardando...' : selectedId ? 'Guardar borrador' : 'Crear borrador'}</EnterpriseButton>
            </div>
          </form>
        </EnterpriseCard>
      ) : null}
    </div>
  );
}

function WorkflowRuntimePanel({ definitions, canTransition }: {
  definitions: WorkflowDefinition[];
  canTransition: boolean;
}) {
  const active = definitions.filter(item => item.active_version);
  const [definitionId, setDefinitionId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [transitionCode, setTransitionCode] = useState('');
  const [decision, setDecision] = useState('approved');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!canTransition) return null;
  const selected = active.find(item => item.id === definitionId);
  async function run(work: () => Promise<WorkflowInstance>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await work();
      const refreshed = await api<WorkflowInstance>(`/api/grc/workflow-instances/${result.id || instanceId}`);
      setInstance(refreshed);
      setInstanceId(refreshed.id);
      setTransitionCode('');
      setComment('');
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible operar la instancia.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <EnterpriseCard title="Instancias y transiciones" subtitle="Crea una instancia real, aplica decisiones autorizadas y consulta su historial persistido." bodyClassName="p-5">
      {message ? <p role="status" aria-live="polite" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!selected) return;
          void run(
            () => api<WorkflowInstance>('/api/grc/workflow-instances', {
              method: 'POST',
              body: JSON.stringify({ definition_id: selected.id, entity_type: selected.entity_type, entity_id: entityId }),
            }),
            'Instancia creada y persistida.'
          );
        }}>
          <label className="block text-sm font-semibold text-slate-700">Workflow
            <select value={definitionId} onChange={event => setDefinitionId(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3">
              <option value="">Seleccionar</option>
              {active.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">ID de entidad
            <input value={entityId} onChange={event => setEntityId(event.target.value)} required pattern="[0-9a-fA-F-]{36}" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" />
          </label>
          <EnterpriseButton type="submit" disabled={busy || !definitionId || !entityId}>Crear instancia</EnterpriseButton>
          <div className="flex gap-2">
            <input aria-label="ID de instancia existente" value={instanceId} onChange={event => setInstanceId(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3" />
            <EnterpriseButton type="button" variant="secondary" disabled={busy || !instanceId} onClick={() => void run(() => api<WorkflowInstance>(`/api/grc/workflow-instances/${instanceId}`), 'Instancia actualizada.')}>Consultar</EnterpriseButton>
          </div>
        </form>
        <div className="rounded-md border border-slate-200 p-4">
          {!instance ? <EnterpriseEmptyState title="Sin instancia seleccionada" description="Crea o consulta una instancia para operar sus transiciones." /> : (
            <div className="space-y-3">
              <div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-900">{instance.current_state_name}</p><p className="text-xs text-slate-500">{instance.entity_type} · {instance.entity_id}</p></div><EnterpriseBadge tone={statusTone(instance.status)}>{instance.status}</EnterpriseBadge></div>
              <label className="block text-sm font-semibold text-slate-700">Transición
                <select value={transitionCode} onChange={event => setTransitionCode(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3">
                  <option value="">Seleccionar</option>
                  {instance.available_transitions.map(item => <option key={item.code} value={item.code}>{item.name} ({item.approval_mode})</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Decisión
                <select value={decision} onChange={event => setDecision(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="approved">Aprobar</option><option value="rejected">Rechazar</option><option value="returned">Devolver</option><option value="reopened">Reabrir</option></select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Comentario
                <textarea value={comment} onChange={event => setComment(event.target.value)} className="mt-2 min-h-20 w-full rounded-md border border-slate-300 p-3" />
              </label>
              <EnterpriseButton type="button" disabled={busy || !transitionCode} onClick={() => void run(
                () => api<WorkflowInstance>(`/api/grc/workflow-instances/${instance.id}/transitions`, {
                  method: 'POST',
                  body: JSON.stringify({ transition_code: transitionCode, decision, comment }),
                }),
                'Transición registrada y vista actualizada.'
              )}>Ejecutar transición</EnterpriseButton>
              <p className="text-xs text-slate-500">Historial: {instance.history.length} · Aprobaciones: {instance.approvals.length}</p>
            </div>
          )}
        </div>
      </div>
    </EnterpriseCard>
  );
}

function FrameworkPanel({ rows, requirements, mappings, canManage, disabled, onCreate, onReview }: {
  rows: Framework[];
  requirements: FrameworkRequirement[];
  mappings: FrameworkMapping[];
  canManage: boolean;
  disabled: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onReview: (id: string, body: Record<string, unknown>) => void;
}) {
  const [requirementId, setRequirementId] = useState('');
  const [controlId, setControlId] = useState('');
  const [mappingType, setMappingType] = useState('partial');
  const [coverage, setCoverage] = useState('50');
  const [justification, setJustification] = useState('');
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  return (
    <>
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EnterpriseCard title="Mappings revisables" subtitle="Requisito → control, cobertura, justificación e historial de revisión." bodyClassName="p-5">
          {!mappings.length ? <EnterpriseEmptyState title="Sin mappings tenant" description="Crea una relación explicable contra un control de esta empresa." /> : (
            <div className="space-y-3">{mappings.map(mapping => (
              <div key={mapping.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{mapping.framework_code} · {mapping.reference_code}</p><EnterpriseBadge tone={statusTone(mapping.status)}>{mapping.status}</EnterpriseBadge></div>
                <p className="mt-2 text-sm text-slate-600">{mapping.mapping_type} · {number(mapping.coverage_level).toFixed(1)}% · {mapping.justification}</p>
                {canManage ? <div className="mt-3 flex flex-wrap gap-2">
                  <input aria-label={`Comentario mapping ${mapping.reference_code}`} value={reviewComments[mapping.id] || ''} onChange={event => setReviewComments(current => ({ ...current, [mapping.id]: event.target.value }))} className="min-h-10 min-w-52 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
                  <EnterpriseButton type="button" variant="secondary" disabled={disabled} onClick={() => onReview(mapping.id, { decision: 'approved', comment: reviewComments[mapping.id] || '' })}>Aprobar</EnterpriseButton>
                  <EnterpriseButton type="button" variant="secondary" disabled={disabled || !reviewComments[mapping.id]?.trim()} onClick={() => onReview(mapping.id, { decision: 'changes_requested', comment: reviewComments[mapping.id] })}>Solicitar cambios</EnterpriseButton>
                  <EnterpriseButton type="button" variant="secondary" disabled={disabled || !reviewComments[mapping.id]?.trim()} onClick={() => onReview(mapping.id, { decision: 'rejected', comment: reviewComments[mapping.id] })}>Rechazar</EnterpriseButton>
                </div> : null}
              </div>
            ))}</div>
          )}
        </EnterpriseCard>
        {canManage ? <EnterpriseCard title="Nuevo mapping" subtitle="Solo requisitos autorizados y controles del tenant." bodyClassName="p-5">
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            onCreate({ requirement_id: requirementId, tenant_control_id: controlId, mapping_type: mappingType, coverage_level: Number(coverage), justification, source_type: 'tcdx_interpretation' });
          }}>
            <label className="block text-sm font-semibold text-slate-700">Requisito<select value={requirementId} onChange={event => setRequirementId(event.target.value)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="">Seleccionar</option>{requirements.map(item => <option key={item.id} value={item.id}>{item.framework_code} {item.reference_code} · {item.version_label}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-700">ID control tenant<input value={controlId} onChange={event => setControlId(event.target.value)} required pattern="[0-9a-fA-F-]{36}" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="block text-sm font-semibold text-slate-700">Tipo<select value={mappingType} onChange={event => setMappingType(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="exact">Exacto</option><option value="partial">Parcial</option><option value="related">Relacionado</option><option value="support">Soporte</option><option value="not_equivalent">No equivalente</option></select></label>
            <label className="block text-sm font-semibold text-slate-700">Cobertura<input type="number" min="0" max="100" value={coverage} onChange={event => setCoverage(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="block text-sm font-semibold text-slate-700">Justificación<textarea value={justification} onChange={event => setJustification(event.target.value)} required className="mt-2 min-h-20 w-full rounded-md border border-slate-300 p-3" /></label>
            <EnterpriseButton type="submit" disabled={disabled || !requirementId || !controlId || !justification.trim()}>Crear mapping</EnterpriseButton>
          </form>
        </EnterpriseCard> : null}
      </div>
    </>
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

function AuditOperationsConsole({ canManage, canWorkpaper, canReview, canExport }: {
  canManage: boolean;
  canWorkpaper: boolean;
  canReview: boolean;
  canExport: boolean;
}) {
  const [auditId, setAuditId] = useState('');
  const [operations, setOperations] = useState<AuditOperations | null>(null);
  const [closeBlockers, setCloseBlockers] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [teamRole, setTeamRole] = useState('auditor');
  const [memberId, setMemberId] = useState('');
  const [conflictId, setConflictId] = useState('');
  const [notes, setNotes] = useState('');
  const [workpaperId, setWorkpaperId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [code, setCode] = useState('WP-001');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!canManage && !canWorkpaper && !canReview) return null;
  async function refresh() {
    if (!auditId) return;
    const [next, readiness] = await Promise.all([
      api<AuditOperations>(`/api/grc/audits/${auditId}/operations`),
      api<{ can_close: boolean; blockers: string[] }>(`/api/grc/audits/${auditId}/close-readiness`),
    ]);
    setOperations(next);
    setCloseBlockers(readiness.blockers || []);
    if (!memberId && next.team[0]) setMemberId(next.team[0].id);
    if (!conflictId && next.conflicts[0]) setConflictId(next.conflicts[0].id);
    if (!workpaperId && next.workpapers[0]) setWorkpaperId(next.workpapers[0].id);
  }
  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await work();
      await refresh();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible operar la auditoría.');
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, body: Record<string, unknown>) => api(path, { method: 'POST', body: JSON.stringify(body) });
  return (
    <EnterpriseCard title="Ejecución operacional de auditoría" subtitle="Equipo, independencia, programa, muestra, papeles, evidencia, seguimiento y cierre bloqueante." bodyClassName="p-5">
      {message ? <p role="status" aria-live="polite" className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <div className="mb-5 flex flex-wrap gap-2">
        <input aria-label="ID de auditoría operacional" value={auditId} onChange={event => setAuditId(event.target.value)} pattern="[0-9a-fA-F-]{36}" className="min-h-11 min-w-72 flex-1 rounded-md border border-slate-300 px-3" />
        <EnterpriseButton type="button" variant="secondary" disabled={busy || !auditId} onClick={() => void run(refresh, 'Workspace de auditoría actualizado.')}>Cargar auditoría</EnterpriseButton>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {canManage ? <form className="space-y-3 rounded-md border border-slate-200 p-4" onSubmit={event => {
          event.preventDefault();
          void run(() => post(`/api/grc/audits/${auditId}/team`, { user_id: userId, team_role: teamRole, independence_status: 'declared', declaration: { confirmed: true } }), 'Miembro e independencia registrados.');
        }}>
          <p className="font-semibold text-slate-900">Equipo e independencia</p>
          <input aria-label="ID usuario del equipo" value={userId} onChange={event => setUserId(event.target.value)} required pattern="[0-9a-fA-F-]{36}" className="min-h-11 w-full rounded-md border border-slate-300 px-3" />
          <select aria-label="Rol del equipo" value={teamRole} onChange={event => setTeamRole(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="auditor">Auditor</option><option value="supervisor">Supervisor</option><option value="lead_auditor">Auditor líder</option></select>
          <EnterpriseButton type="submit" disabled={busy || !auditId || !userId}>Asignar y declarar</EnterpriseButton>
        </form> : null}
        {canManage ? <form className="space-y-3 rounded-md border border-slate-200 p-4" onSubmit={event => {
          event.preventDefault();
          void run(() => post(`/api/grc/audits/${auditId}/conflicts`, { team_member_id: memberId, conflict_type: 'independence', description: notes }), 'Conflicto registrado y cierre bloqueado.');
        }}>
          <p className="font-semibold text-slate-900">Conflicto</p>
          <select aria-label="Miembro con conflicto" value={memberId} onChange={event => setMemberId(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3"><option value="">Seleccionar</option>{(operations?.team || []).map(item => <option key={item.id} value={item.id}>{item.team_role} · {item.user_id}</option>)}</select>
          <textarea aria-label="Descripción o resolución del conflicto" value={notes} onChange={event => setNotes(event.target.value)} className="min-h-20 w-full rounded-md border border-slate-300 p-3" />
          <div className="flex flex-wrap gap-2"><EnterpriseButton type="submit" disabled={busy || !memberId || !notes.trim()}>Registrar</EnterpriseButton>{canReview ? <EnterpriseButton type="button" variant="secondary" disabled={busy || !conflictId || !notes.trim()} onClick={() => void run(() => post(`/api/grc/audits/conflicts/${conflictId}/resolve`, { status: 'mitigated', resolution: notes }), 'Conflicto mitigado.')}>Resolver seleccionado</EnterpriseButton> : null}</div>
          <select aria-label="Conflicto a resolver" value={conflictId} onChange={event => setConflictId(event.target.value)} className="min-h-10 w-full rounded-md border border-slate-300 px-3"><option value="">Seleccionar conflicto</option>{(operations?.conflicts || []).map(item => <option key={item.id} value={item.id}>{item.status} · {item.description}</option>)}</select>
        </form> : null}
        {canManage ? <div className="space-y-3 rounded-md border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">Programa</p>
          <EnterpriseButton type="button" variant="secondary" disabled={busy || !notes.trim()} onClick={() => void run(() => post('/api/grc/audits/universe', { entity_type: 'process', name: notes, metadata: { source: 'web' } }), 'Entidad agregada al universo auditable.')}>Agregar al universo</EnterpriseButton>
          <EnterpriseButton type="button" disabled={busy || !auditId} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/programs`, { objectives: ['Verificar alcance'], scope: { source: 'web' }, criteria: ['evidence_based'], procedures: ['inspection'] }), 'Programa versionado creado.')}>Crear programa</EnterpriseButton>
          {canWorkpaper ? <EnterpriseButton type="button" variant="secondary" disabled={busy || !auditId} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/interviews`, { agenda: notes || 'Entrevista de auditoría', participants: [], questions_answers: [] }), 'Entrevista registrada.')}>Registrar entrevista</EnterpriseButton> : null}
          <p className="text-xs text-slate-500">Versiones: {operations?.programs.length || 0}</p>
        </div> : null}
        {canWorkpaper ? <form className="space-y-3 rounded-md border border-slate-200 p-4" onSubmit={event => {
          event.preventDefault();
          void run(() => post('/api/grc/audits/workpapers', { audit_id: auditId, code, objective: 'Verificar evidencia', procedure_text: 'Inspeccionar evidencia vinculada', result: 'Documentado', conclusion: notes || 'Conforme', status: 'submitted', content_hash: `web-${auditId}-${code}` }), 'Papel enviado a revisión.');
        }}>
          <p className="font-semibold text-slate-900">Papel de trabajo</p>
          <input aria-label="Código papel de trabajo" value={code} onChange={event => setCode(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3" />
          <EnterpriseButton type="submit" disabled={busy || !auditId || !code}>Crear y enviar</EnterpriseButton>
          <select aria-label="Papel de trabajo seleccionado" value={workpaperId} onChange={event => setWorkpaperId(event.target.value)} className="min-h-10 w-full rounded-md border border-slate-300 px-3"><option value="">Seleccionar papel</option>{(operations?.workpapers || []).map(item => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}</select>
        </form> : null}
        {canWorkpaper ? <div className="space-y-3 rounded-md border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">Muestra y evidencia</p>
          <EnterpriseButton type="button" disabled={busy || !auditId} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/samples`, { population_description: 'Población documentada desde web', method: 'judgmental', sample_size: 1, limitation: 'Muestra dirigida y declarada' }), 'Plan de muestra creado.')}>Crear muestra</EnterpriseButton>
          <input aria-label="ID evidencia para auditoría" value={evidenceId} onChange={event => setEvidenceId(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3" />
          <EnterpriseButton type="button" variant="secondary" disabled={busy || !auditId || !evidenceId || !workpaperId} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/evidence-links`, { evidence_id: evidenceId, workpaper_id: workpaperId }), 'Evidencia vinculada a auditoría.')}>Vincular evidencia</EnterpriseButton>
        </div> : null}
        {canManage ? <div className="space-y-3 rounded-md border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">Seguimiento y cierre</p>
          <EnterpriseButton type="button" variant="secondary" disabled={busy || !auditId} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/followups`, { verification_notes: notes || 'Seguimiento creado desde web' }), 'Seguimiento creado.')}>Crear seguimiento</EnterpriseButton>
          {canExport ? <EnterpriseButton type="button" variant="secondary" disabled={busy || !auditId} onClick={() => void run(() => downloadExport('audit', 'pdf', { id: auditId }), 'Informe PDF generado, registrado y descargado.')}>Generar informe PDF</EnterpriseButton> : null}
          {canReview ? <EnterpriseButton type="button" disabled={busy || !operations || !auditId || closeBlockers.length > 0} onClick={() => void run(() => post(`/api/grc/audits/${auditId}/close`, {}), 'Auditoría cerrada con controles satisfechos.')}>Cerrar auditoría</EnterpriseButton> : null}
          <p className="text-xs text-slate-500">{closeBlockers.length ? `Bloqueos: ${closeBlockers.join(', ')}` : operations ? 'Sin bloqueos de cierre.' : 'Carga una auditoría para evaluar el cierre.'}</p>
        </div> : null}
      </div>
    </EnterpriseCard>
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
