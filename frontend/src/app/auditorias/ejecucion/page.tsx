'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
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
  const { t } = useTranslation();
  const params = useSearchParams();
  const auditId = params.get('id') || '';

  const [token, setToken] = useState('');
  const [audit, setAudit] = useState<any>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();

    if (!t || !resolveTenantId(u)) {
      window.location.href = '/login';
      return;
    }

    setToken(t);
  }, []);

  const load = async () => {
    if (!token || !auditId) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/audit-execution/${auditId}/checklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json.error || t('auditExecution.loadError'));
        return;
      }

      setAudit(json.audit);
      setRows(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, auditId]);

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

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json.error || t('auditExecution.updateError'));
        return;
      }

      setRows((prev) => prev.map((item) => (item.id === row.id ? json.data : item)));
    } finally {
      setSavingId('');
    }
  };

  if (!auditId) {
    return (
      <AppLayout>
        <div className="p-6">{t('auditExecution.missingAuditId')}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-[34px] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                {t('auditExecution.eyebrow')}
              </span>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                {t('auditExecution.title')}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {t('auditExecution.subtitle')}
              </p>
            </div>

            <button
              onClick={() => window.location.href = '/auditorias'}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t('auditExecution.backToAudits')}
            </button>
          </div>

          {audit && (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
              <Metric label="ISO" value={audit.iso || '-'} />
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
                      <td className="px-3 py-3 font-semibold text-slate-700">{row.clause || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{friendlyControlTitle(row)}</div>
                        <div className="mt-1 max-w-xl text-xs font-semibold text-indigo-600">
                          {friendlyControlMeta(row)}
                        </div>
                        {row.initial_health_status && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {t('auditExecution.initialHealth')}: {row.initial_health_status}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        <div>{row.initial_status || '-'}</div>
                        <div>{row.initial_health_status || '-'}</div>
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
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
