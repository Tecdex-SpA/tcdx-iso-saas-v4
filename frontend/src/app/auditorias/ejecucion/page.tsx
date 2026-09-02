'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { translateDisplayText, translateStatusLabel, translateClauseLabel, translateStandardLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type ReviewRow = {
  id: string;
  audit_id: string;
  control_code?: string;
  control_title?: string;
  clause?: string;
  initial_status?: string;
  initial_health_status?: string;
  result?: string;
  notes?: string;
};

type AuditSummary = {
  iso?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  auditor_name?: string;
  requester_name?: string;
};

type AuditOption = AuditSummary & {
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveTenantId(user: unknown) {
  const record = isRecord(user) ? user : {};
  return String(record.tenant_id || record.tenantId || record.tenant || '');
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  const record = isRecord(payload) ? payload : {};
  return String(record.error || fallback);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('es-CL');
}

function statusClass(value?: string) {
  if (value === 'conforme') return 'border-green-200 bg-green-50 text-green-700';
  if (value === 'no_conforme') return 'border-red-200 bg-red-50 text-red-700';
  if (value === 'observacion') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'sin_evidencia') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (value === 'no_aplica') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-slate-200 bg-white text-slate-700';
}

function isUuidLike(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function friendlyControlTitle(row: ReviewRow) {
  const title = String(row.control_title || '').trim();
  const code = String(row.control_code || '').trim();
  const clause = String(row.clause || '').trim();

  if (title && !isUuidLike(title)) return title;
  if (code && !isUuidLike(code)) return code;
  if (clause && clause !== '-' && !isUuidLike(clause)) return `Cláusula ${clause}`;

  return 'Control sin nombre';
}

function friendlyControlMeta(row: ReviewRow) {
  const parts: string[] = [];
  const code = String(row.control_code || '').trim();
  const clause = String(row.clause || '').trim();

  if (clause && clause !== '-' && !isUuidLike(clause)) {
    parts.push(`Cláusula ${clause}`);
  }

  if (code && !isUuidLike(code) && code !== clause) {
    parts.push(`Código ${code}`);
  }

  return parts.length ? parts.join(' · ') : 'Sin código visible';
}

export default function AuditExecutionPage() {
  const { t } = useTranslation();

  return (
    <Suspense fallback={<AppLayout><div className="p-6">{t('auditExecution.loading')}</div></AppLayout>}>
      <AuditExecutionContent />
    </Suspense>
  );
}

function AuditExecutionContent() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const requestedAuditId = isUuidLike(params.get('id')) ? String(params.get('id')) : '';

  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [auditOptions, setAuditOptions] = useState<AuditOption[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState('');
  const [loadedAuditId, setLoadedAuditId] = useState('');
  const [audit, setAudit] = useState<AuditSummary | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [selectorError, setSelectorError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();

    const resolvedTenantId = resolveTenantId(u);

    if (!t || !resolvedTenantId) {
      window.location.href = '/login';
      return;
    }

    setToken(t);
    setTenantId(resolvedTenantId);
  }, []);

  useEffect(() => {
    if (!token || !tenantId) return;

    const loadAudits = async () => {
      try {
        setLoadingAudits(true);
        setSelectorError('');

        const res = await fetch(`${API_URL}/api/audits/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json: unknown = await res.json();

        if (!res.ok) {
          setAuditOptions([]);
          setSelectorError(getApiErrorMessage(json, t('auditExecution.loadError')));
          return;
        }

        const rows = Array.isArray(json) ? json.filter((item): item is AuditOption => isRecord(item) && isUuidLike(String(item.id || ''))) : [];
        setAuditOptions(rows);

        const requested = requestedAuditId && rows.some((item) => item.id === requestedAuditId)
          ? requestedAuditId
          : '';
        const nextSelected = requested || (selectedAuditId && rows.some((item) => item.id === selectedAuditId) ? selectedAuditId : '');
        setSelectedAuditId(nextSelected);

        if (requested) {
          setLoadedAuditId(requested);
          router.replace('/auditorias/ejecucion');
        } else if (params.get('id')) {
          setSelectorError(t('auditExecution.auditNotAvailable'));
          setLoadedAuditId('');
        }
      } catch (error) {
        setAuditOptions([]);
        setSelectorError(error instanceof Error ? error.message : t('auditExecution.loadError'));
      } finally {
        setLoadingAudits(false);
      }
    };

    void loadAudits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, requestedAuditId, t]);

  const load = async () => {
    if (!token || !loadedAuditId) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/audit-execution/${loadedAuditId}/checklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json: unknown = await res.json();

      if (!res.ok || (isRecord(json) && json.ok === false)) {
        alert(getApiErrorMessage(json, t('auditExecution.loadError')));
        return;
      }

      const auditData = isRecord(json) ? json.audit : null;
      const rowData = isRecord(json) ? json.data : [];
      setAudit(isRecord(auditData) ? auditData as AuditSummary : null);
      setRows(Array.isArray(rowData) ? rowData as ReviewRow[] : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadedAuditId]);

  const loadSelectedAudit = () => {
    if (!selectedAuditId || !auditOptions.some((item) => item.id === selectedAuditId)) return;
    setLoadedAuditId(selectedAuditId);
    router.replace('/auditorias/ejecucion');
  };

  const summary = useMemo(() => {
    return {
      total: rows.length,
      conformes: rows.filter((r) => r.result === 'conforme').length,
      observaciones: rows.filter((r) => r.result === 'observacion').length,
      noConformes: rows.filter((r) => r.result === 'no_conforme').length,
      sinEvidencia: rows.filter((r) => r.result === 'sin_evidencia').length,
      pendientes: rows.filter((r) => !r.result || r.result === 'pendiente').length,
    };
  }, [rows]);

  const updateReview = async (row: ReviewRow, result: string, notes?: string) => {
    if (!token) return;

    try {
      setSavingId(row.id);

      const res = await fetch(`${API_URL}/api/audit-execution/review/${row.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          result,
          notes: notes ?? row.notes ?? '',
        }),
      });

      const json: unknown = await res.json();

      if (!res.ok || (isRecord(json) && json.ok === false)) {
        alert(getApiErrorMessage(json, t('auditExecution.updateError')));
        return;
      }

      const updatedRow = isRecord(json) && isRecord(json.data) ? json.data as ReviewRow : row;
      setRows((prev) => prev.map((item) => (item.id === row.id ? updatedRow : item)));
    } finally {
      setSavingId('');
    }
  };

  const selectedAudit = auditOptions.find((item) => item.id === selectedAuditId) || null;

  if (!loadedAuditId) {
    return (
      <AppLayout>
        <EnterpriseDomainWorkspaceShell
          domain="audit"
          eyebrow={t('auditExecution.eyebrow')}
          title={t('auditExecution.title')}
          description={t('auditExecution.subtitle')}
        >
          <section className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-6 shadow-sm">
            {loadingAudits ? (
              <div className="text-sm text-[var(--tcdx-color-text-secondary)]">{t('auditExecution.loading')}</div>
            ) : auditOptions.length === 0 ? (
              <div>
                <h2 className="text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{t('auditExecution.noAudits')}</h2>
                <p className="mt-2 text-sm text-[var(--tcdx-color-text-secondary)]">{t('auditExecution.missingAuditId')}</p>
                <button
                  type="button"
                  onClick={() => router.push('/auditorias')}
                  className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--tcdx-color-action-primary)] px-4 text-sm font-semibold text-white"
                >
                  {t('auditExecution.createAudit')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
                  {t('auditExecution.selectAudit')}
                  <select
                    value={selectedAuditId}
                    onChange={(event) => setSelectedAuditId(event.target.value)}
                    className="mt-2 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 py-3 font-normal text-[var(--tcdx-color-text-ink)]"
                  >
                    <option value="">{t('auditExecution.selectAuditPlaceholder')}</option>
                    {auditOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {translateStandardLabel(option.iso || '-', locale)} · {formatDate(option.start_date)} a {formatDate(option.end_date)} · {translateStatusLabel(option.status || 'pendiente', locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!selectedAudit}
                  onClick={loadSelectedAudit}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--tcdx-color-action-primary)] px-4 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-600"
                >
                  {t('auditExecution.loadAudit')}
                </button>
                {selectorError && <div className="text-sm font-semibold text-amber-800 lg:col-span-2">{selectorError}</div>}
              </div>
            )}
          </section>
        </EnterpriseDomainWorkspaceShell>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <EnterpriseDomainWorkspaceShell
        domain="audit"
        eyebrow={t('auditExecution.eyebrow')}
        title={t('auditExecution.title')}
        description={t('auditExecution.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setLoadedAuditId('');
                setAudit(null);
                setRows([]);
                router.replace('/auditorias/ejecucion');
              }}
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-focus)]"
            >
              {t('auditExecution.selectAudit')}
            </button>
            <button
              onClick={() => window.location.href = '/auditorias'}
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-focus)]"
            >
              {t('auditExecution.backToAudits')}
            </button>
          </div>
        }
      >
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-5 shadow-sm">
          {audit && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Metric label="ISO" value={translateDisplayText(audit.iso || '-', locale, 'standard')} />
              <Metric label={t('auditExecution.metrics.total')} value={summary.total} />
              <Metric label={t('auditExecution.metrics.compliant')} value={summary.conformes} />
              <Metric label={t('auditExecution.metrics.observations')} value={summary.observaciones} />
              <Metric label={t('auditExecution.metrics.nonCompliant')} value={summary.noConformes} />
              <Metric label={t('auditExecution.metrics.noEvidence')} value={summary.sinEvidencia} />
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">{t('auditExecution.loadingControls')}</div>
        ) : (
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-3 py-3">{t('auditExecution.columns.clause')}</th>
                    <th className="px-3 py-3">{t('auditExecution.columns.control')}</th>
                    <th className="px-3 py-3">{t('auditExecution.columns.initialStatus')}</th>
                    <th className="px-3 py-3">{t('auditExecution.columns.auditResult')}</th>
                    <th className="px-3 py-3">{t('auditExecution.columns.notes')}</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-3 py-3 font-semibold text-slate-700">{translateClauseLabel(row.clause || '-', locale)}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{translateDisplayText(friendlyControlTitle(row), locale, 'control')}</div>
                        <div className="mt-1 max-w-xl text-xs font-semibold text-indigo-600">
                          {translateDisplayText(friendlyControlMeta(row), locale, 'control')}
                        </div>
                        {row.initial_health_status && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {t('auditExecution.initialHealth')}: {translateStatusLabel(row.initial_health_status, locale)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        <div>{translateStatusLabel(row.initial_status || '-', locale)}</div>
                        <div>{translateStatusLabel(row.initial_health_status || '-', locale)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.result || 'pendiente'}
                          disabled={savingId === row.id}
                          onChange={(e) => updateReview(row, e.target.value)}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${statusClass(row.result)}`}
                        >
                          <option value="pendiente">{t('statuses.controls.pendiente')}</option>
                          <option value="conforme">{t('auditExecution.results.compliant')}</option>
                          <option value="observacion">{t('auditExecution.results.observation')}</option>
                          <option value="no_conforme">{t('auditExecution.results.nonCompliant')}</option>
                          <option value="sin_evidencia">{t('auditExecution.results.noEvidence')}</option>
                          <option value="no_aplica">{t('statuses.controls.no_aplica')}</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          defaultValue={row.notes || ''}
                          rows={2}
                          onBlur={(e) => updateReview(row, row.result || 'pendiente', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-300"
                          placeholder={t('auditExecution.notesPlaceholder')}
                        />
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                        {t('auditExecution.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      </EnterpriseDomainWorkspaceShell>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
