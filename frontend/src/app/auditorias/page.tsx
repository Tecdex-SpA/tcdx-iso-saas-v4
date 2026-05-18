'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import IsoAuditorPreview from '@/components/auditor-iso/IsoAuditorPreview';
import AuditPreparationPanel from '@/components/auditorias/AuditPreparationPanel';
import IaAuditorPanel from '@/components/auditorias/IaAuditorPanel';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel } from '@/i18n/statusLabels';
import { translateDisplayText, translateStatusLabel, translatePriorityLabel, translateSeverityLabel, translateStandardLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type AuditRow = {
  id: string;
  tenant_id?: string;
  iso: string;
  start_date: string;
  end_date: string;
  requester_name?: string;
  auditor_type?: string;
  auditor_name?: string;
  status?: string;
  report_file?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FindingRow = {
  id: string;
  iso_code?: string | null;
  audit_id?: string | null;
  title?: string | null;
  finding_type?: string | null;
  severity?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ActionPlanRow = {
  id: string;
  iso_code?: string | null;
  audit_id?: string | null;
  title?: string | null;
  priority?: string | null;
  status?: string | null;
  approval_status?: string | null;
  evidence_count?: number;
  approved_evidence_count?: number;
  pending_evidence_count?: number;
  latest_progress_percent?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type ScopeOperation = {
  id: string;
  name: string;
  is_active?: boolean;
};

type ScopeResponse = {
  operations: ScopeOperation[];
  standards: ScopeStandard[];
};

type AuditSummaryResponse = {
  ok?: boolean;
  tenant_id?: string;
  iso?: string | null;
  summary?: {
    total?: number;
    pendientes?: number;
    en_ejecucion?: number;
    completadas?: number;
    con_informe?: number;
    sin_informe?: number;
    hallazgos?: number;
    acciones?: number;
  };
  next_audit?: AuditRow | null;
  recent_audits?: AuditRow[];
  note?: string;
};

function resolveTenantId(user: any): string {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function resolveRole(user: any): string {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function isOperationalStandard(s: ScopeStandard) {
  return (
    (s?.is_active === true || s?.is_active === 'true' || s?.is_active === 1) &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);

  return d.toLocaleDateString('es-CL');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeAuditStatus(status?: string | null) {
  const raw = String(status || '').toLowerCase().trim();

  if (raw === 'completada') return 'completada';
  if (raw === 'en_ejecucion' || raw === 'en ejecución') return 'en_ejecucion';
  return 'pendiente';
}

async function openAuthorizedFile(url: string, token: string | null) {
  if (!token) {
    alert('Sesión no disponible. Inicia sesión nuevamente.');
    return;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    alert('No fue posible abrir el archivo.');
    return;
  }

  const blobUrl = URL.createObjectURL(await res.blob());
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export default function AuditoriasPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">{t('audits.loading')}</div>
        </AppLayout>
      }
    >
      <AuditoriasWorkspaceContent />
    </Suspense>
  );
}

const auditWorkspaceTabs = [
  { value: 'programa', label: 'Programa de auditorías' },
  { value: 'preparacion', label: 'Preparación documental' },
  { value: 'preauditoria', label: 'Preauditoría ISO' },
  { value: 'ia', label: 'IA Auditor Senior' },
];

function AuditoriasWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get('view') || 'programa';
  const activeView = auditWorkspaceTabs.some((tab) => tab.value === rawView)
    ? rawView
    : 'programa';

  const setActiveView = (view: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (view === 'programa') {
      nextParams.delete('view');
    } else {
      nextParams.set('view', view);
    }

    const query = nextParams.toString();
    router.push(query ? `/auditorias?${query}` : '/auditorias');
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <section className="mx-auto flex max-w-[1800px] flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="px-2">
            <h1 className="text-xl font-black text-slate-950">Auditorías</h1>
            <p className="mt-1 text-sm text-slate-500">
              Programa, preauditoría e IA auditora en un solo espacio operativo.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {auditWorkspaceTabs.map((tab) => {
              const active = activeView === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveView(tab.value)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    active
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeView === 'preauditoria' ? (
          <IsoAuditorPreview />
        ) : activeView === 'preparacion' ? (
          <AuditPreparationPanel auditId={searchParams.get('id') || ''} />
        ) : activeView === 'ia' ? (
          <IaAuditorPanel />
        ) : (
          <AuditProgramPanel />
        )}
      </div>
    </AppLayout>
  );
}

function AiAuditorAuditCta({ t, iso }: { t: (key: string) => string; iso?: string }) {
  const href = iso
    ? `/auditorias?view=ia&standard_code=${encodeURIComponent(iso)}`
    : '/auditorias?view=ia';

  return (
    <section className="rounded-[28px] border border-indigo-100 bg-indigo-50 p-5 text-indigo-950 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600">
            {t('aiAuditor.shortTitle')}
          </div>
          <h2 className="mt-1 text-xl font-black">
            {t('aiAuditor.auditCtaTitle')}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-indigo-800">
            {t('aiAuditor.auditCtaDescription')}
          </p>
          <p className="mt-2 text-xs font-semibold text-indigo-700">
            {t('aiAuditor.humanReviewNote')}
          </p>
        </div>

        <a
          href={href}
          className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700"
        >
          {t('aiAuditor.auditCtaButton')}
        </a>
      </div>
    </section>
  );
}


function AuditProgramPanel() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');

  const [iso, setIso] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewStep, setViewStep] = useState<'intro' | 'workspace'>('intro');

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [actions, setActions] = useState<ActionPlanRow[]>([]);
  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [auditSummary, setAuditSummary] = useState<AuditSummaryResponse | null>(null);
  const [loadingAuditSummary, setLoadingAuditSummary] = useState(true);

  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [loadingRelations, setLoadingRelations] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [focusedAuditId, setFocusedAuditId] = useState('');
  const [focusMessage, setFocusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedAuditId, setExpandedAuditId] = useState('');

  const [form, setForm] = useState({
    start: '',
    end: '',
    requester: '',
    type: '',
    auditor: '',
  });

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const focusAppliedRef = useRef(false);

  const currentRole = resolveRole(user);

  const isViewer =
    currentRole === 'viewer' ||
    currentRole === 'cliente' ||
    currentRole === 'client' ||
    currentRole === 'solo_lectura' ||
    currentRole === 'read_only' ||
    currentRole === 'readonly' ||
    currentRole === 'ejecutivo';

  const isOperativo = currentRole === 'operativo';

  const isReadOnly = isViewer || isOperativo;

  const readOnlyMessage = isViewer
    ? t('audits.readOnly.viewer')
    : t('audits.readOnly.operational');

  const tenantId = resolveTenantId(user);

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const operationalStandardCodes = useMemo(() => {
    return new Set(operationalStandards.map((s) => s.code).filter(Boolean));
  }, [operationalStandards]);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = getUserFromToken();

    if (!t || !resolveTenantId(u)) {
      alert('Sesión expirada');
      window.location.href = '/login';
      return;
    }

    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedAuditId('');
    setFocusMessage('');
  }, [focusId, focusISO]);

  const loadScope = async (tenantIdValue: string, tkn: string) => {
    try {
      setLoadingStandards(true);
      setErrorMessage('');

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${tenantIdValue}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD AUDITS SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setIso('');
        setViewStep('intro');
        setErrorMessage(t('audits.scopeLoadError'));
        return;
      }

      const nextScope: ScopeResponse = {
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      };

      const activeStandards = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      setIso((prev) => {
        if (focusISO) {
          const existsFocus = activeStandards.some((s) => s.code === focusISO);
          if (existsFocus) return focusISO;
        }

        const exists = activeStandards.some((s) => s.code === prev);
        return exists ? prev : '';
      });

      if (activeStandards.length === 0) {
        setViewStep('intro');
      }
    } catch (err) {
      console.error('ERROR LOAD AUDITS SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setIso('');
      setViewStep('intro');
      setErrorMessage(t('audits.scopeLoadGenericError'));
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadAudits = async (tenantIdValue: string, tkn: string) => {
    try {
      setLoadingAudits(true);

      const params = new URLSearchParams();
      if (iso) params.append('iso', iso);

      const res = await fetch(`${API_URL}/api/audits/${tenantIdValue}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD AUDITS:', json);
        setAudits([]);
        return;
      }

      setAudits(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD AUDITS:', err);
      setAudits([]);
    } finally {
      setLoadingAudits(false);
    }
  };

  const loadAuditSummary = async (tenantIdValue: string, tkn: string) => {
    try {
      setLoadingAuditSummary(true);

      const params = new URLSearchParams();
      if (iso) params.append('iso', iso);

      const url = `${API_URL}/api/audits/summary/${tenantIdValue}${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tkn}` },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        console.error('ERROR LOAD AUDIT SUMMARY:', json);
        setAuditSummary(null);
        return;
      }

      setAuditSummary(json);
    } catch (err) {
      console.error('ERROR LOAD AUDIT SUMMARY:', err);
      setAuditSummary(null);
    } finally {
      setLoadingAuditSummary(false);
    }
  };

  const loadRelations = async (
    tenantIdValue: string,
    tkn: string,
    selectedIso: string
  ) => {
    try {
      setLoadingRelations(true);

      if (!selectedIso) {
        setFindings([]);
        setActions([]);
        return;
      }

      if (!operationalStandardCodes.has(selectedIso)) {
        setFindings([]);
        setActions([]);
        return;
      }

      const [findingsRes, actionsRes] = await Promise.all([
        fetch(`${API_URL}/api/findings/${tenantIdValue}?iso=${encodeURIComponent(selectedIso)}`, {
          headers: { Authorization: `Bearer ${tkn}` },
        }),
        fetch(
          `${API_URL}/api/action-plans/${tenantIdValue}?iso=${encodeURIComponent(selectedIso)}`,
          {
            headers: { Authorization: `Bearer ${tkn}` },
          }
        ),
      ]);

      const findingsJson = await findingsRes.json();
      const actionsJson = await actionsRes.json();

      if (!findingsRes.ok) {
        console.error('ERROR LOAD AUDIT FINDINGS:', findingsJson);
        setFindings([]);
      } else {
        setFindings(Array.isArray(findingsJson) ? findingsJson : []);
      }

      if (!actionsRes.ok) {
        console.error('ERROR LOAD AUDIT ACTIONS:', actionsJson);
        setActions([]);
      } else {
        setActions(Array.isArray(actionsJson) ? actionsJson : []);
      }
    } catch (err) {
      console.error('ERROR LOAD AUDIT RELATIONS:', err);
      setFindings([]);
      setActions([]);
    } finally {
      setLoadingRelations(false);
    }
  };

  useEffect(() => {
    if (!token || !tenantId) return;
    void loadScope(tenantId, token);
  }, [token, tenantId]);

  useEffect(() => {
    if (!token || !tenantId || loadingStandards) return;
    void loadAudits(tenantId, token);
  }, [token, tenantId, iso, loadingStandards]);

  useEffect(() => {
    if (!token || !tenantId || loadingStandards) return;
    void loadAuditSummary(tenantId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, iso, loadingStandards]);

  useEffect(() => {
    if (!token || !tenantId || !iso || loadingStandards) {
      if (!loadingStandards) setLoadingRelations(false);
      return;
    }

    void loadRelations(tenantId, token, iso);
  }, [token, tenantId, iso, loadingStandards, operationalStandardCodes]);

  const refreshAll = async () => {
    if (!token || !tenantId) return;

    await Promise.all([
      loadAudits(tenantId, token),
      loadAuditSummary(tenantId, token),
      iso ? loadRelations(tenantId, token, iso) : Promise.resolve(),
    ]);
  };

  const save = async () => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    if (!iso) {
      alert(t('audits.selectIsoRequired'));
      return;
    }

    if (!operationalStandardCodes.has(iso)) {
      alert(t('audits.invalidOperationalStandard'));
      return;
    }

    if (!form.start || !form.end || !form.requester || !form.type || !form.auditor) {
      alert(t('audits.completeFields'));
      return;
    }

    const res = await fetch(`${API_URL}/api/audits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        iso,
        start_date: form.start,
        end_date: form.end,
        requester_name: form.requester,
        auditor_type: form.type,
        auditor_name: form.auditor,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || t('audits.saveError'));
      return;
    }

    setForm({ start: '', end: '', requester: '', type: '', auditor: '' });
    await refreshAll();
    setExpandedAuditId(data?.id || '');
    setFocusedAuditId(data?.id || '');
    alert(t('audits.saved'));
  };

  const startAudit = async (id: string) => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    const res = await fetch(`${API_URL}/api/audits/start/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || t('audits.startError'));
      return;
    }

    await refreshAll();
  };

  const uploadReport = async (id: string, file: File) => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch(`${API_URL}/api/audits/upload/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || t('audits.uploadReportError'));
      return;
    }

    await refreshAll();
  };

  const completeAudit = async (id: string) => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    const res = await fetch(`${API_URL}/api/audits/complete/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || t('audits.completeError'));
      return;
    }

    await refreshAll();
  };

  const createFindingFromAudit = async (
    audit: AuditRow,
    defaultType:
      | 'observacion'
      | 'no conformidad'
      | 'oportunidad de mejora'
      | 'fortaleza' = 'observacion'
  ) => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    const title = window.prompt(
      `${t('audits.findingPromptTitle')} ${audit.iso}`,
      defaultType === 'no conformidad'
        ? `${t('audits.nonconformityDefaultTitle')} ${audit.iso}`
        : `${t('audits.findingDefaultTitle')} ${audit.iso}`
    );

    if (!title) return;

    const description =
      window.prompt(
        t('audits.findingPromptDescription'),
        `Hallazgo levantado durante auditoría ${audit.iso} del período ${audit.start_date} a ${audit.end_date}`
      ) || '';

    const findingType =
      window.prompt(
        t('audits.findingPromptType'),
        defaultType
      ) || defaultType;

    const severity =
      window.prompt(t('audits.findingPromptSeverity'), 'media') || 'media';

    try {
      setActionLoading(`finding-${audit.id}`);

      const res = await fetch(`${API_URL}/api/findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: audit.iso,
          title,
          description,
          finding_type: findingType,
          severity,
          source_type: 'audit',
          audit_id: audit.id,
          detected_by: audit.auditor_name || '',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('audits.createFindingError'));
        return;
      }

      await refreshAll();
      setExpandedAuditId(audit.id);
      alert(t('audits.findingCreated'));
    } catch (err) {
      console.error('ERROR CREATE FINDING FROM AUDIT:', err);
      alert(t('audits.createFindingError'));
    } finally {
      setActionLoading('');
    }
  };

  const createActionFromAudit = async (audit: AuditRow) => {
    if (!token || !tenantId) return;

    if (isReadOnly) {
      alert(readOnlyMessage);
      return;
    }

    const title = window.prompt(
      `${t('audits.actionPromptTitle')} ${audit.iso}`,
      `${t('audits.actionDefaultTitle')} ${audit.iso}`
    );

    if (!title) return;

    const description =
      window.prompt(
        t('audits.actionPromptDescription'),
        `Acción derivada de auditoría ${audit.iso} del período ${audit.start_date} a ${audit.end_date}`
      ) || '';

    const owner = window.prompt(t('audits.actionPromptOwner'), '') || '';
    const priority =
      window.prompt(t('audits.actionPromptPriority'), 'media') || 'media';

    try {
      setActionLoading(`action-${audit.id}`);

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: audit.iso,
          title,
          description,
          priority,
          owner,
          source_type: 'audit',
          audit_id: audit.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('audits.createActionError'));
        return;
      }

      await refreshAll();
      setExpandedAuditId(audit.id);
      alert(t('audits.actionCreated'));
    } catch (err) {
      console.error('ERROR CREATE ACTION FROM AUDIT:', err);
      alert(t('audits.createActionError'));
    } finally {
      setActionLoading('');
    }
  };

  const applyFocus = (audit: AuditRow) => {
    setFocusedAuditId(audit.id);
    setExpandedAuditId(audit.id);
    setFocusMessage(
      `${t('audits.directOpen')}: ${t('audits.auditLabel').toLowerCase()} ${audit.iso} (${audit.start_date} → ${audit.end_date})`
    );
    setViewStep('workspace');
    focusAppliedRef.current = true;

    setTimeout(() => {
      const el = document.getElementById(`audit-${audit.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  useEffect(() => {
    if (loadingStandards || !operationalStandards.length) return;

    if (focusISO) {
      const exists = operationalStandards.some((s) => s.code === focusISO);
      if (exists) {
        setIso(focusISO);
        setViewStep('workspace');
      }
    }
  }, [focusISO, operationalStandards, loadingStandards]);

  useEffect(() => {
    if (!focusId || loadingAudits || !audits.length || focusAppliedRef.current) return;

    const match = audits.find((a) => a.id === focusId);

    if (match) {
      if (match.iso && iso !== match.iso) {
        setIso(match.iso);
      }
      applyFocus(match);
    }
  }, [focusId, audits, loadingAudits, iso]);

  const filteredAudits = useMemo(() => {
    const base = iso ? audits.filter((a) => a.iso === iso) : audits;

    if (!statusFilter) return base;

    return base.filter((a) => normalizeAuditStatus(a.status) === statusFilter);
  }, [audits, iso, statusFilter]);

  const findingsByAudit = useMemo(() => {
    const map: Record<string, FindingRow[]> = {};

    findings.forEach((item) => {
      if (!item.audit_id) return;
      if (!map[item.audit_id]) map[item.audit_id] = [];
      map[item.audit_id].push(item);
    });

    return map;
  }, [findings]);

  const actionsByAudit = useMemo(() => {
    const map: Record<string, ActionPlanRow[]> = {};

    actions.forEach((item) => {
      if (!item.audit_id) return;
      if (!map[item.audit_id]) map[item.audit_id] = [];
      map[item.audit_id].push(item);
    });

    return map;
  }, [actions]);

  const nextUpcomingAudit = useMemo(() => {
    const pendingOrRunning = filteredAudits.filter(
      (a) => normalizeAuditStatus(a.status) !== 'completada'
    );

    const sorted = [...pendingOrRunning].sort((a, b) => {
      const da = new Date(a.start_date).getTime();
      const db = new Date(b.start_date).getTime();
      return da - db;
    });

    return sorted[0] || null;
  }, [filteredAudits]);

  const metrics = useMemo(() => {
    const backend = auditSummary?.summary || null;

    const withReport = filteredAudits.filter((a) => Boolean(a.report_file)).length;
    const withoutReport = filteredAudits.length - withReport;

    const localHallazgos = filteredAudits.reduce(
      (acc, audit) => acc + (findingsByAudit[audit.id]?.length || 0),
      0
    );

    const localAcciones = filteredAudits.reduce(
      (acc, audit) => acc + (actionsByAudit[audit.id]?.length || 0),
      0
    );

    return {
      total: Number(backend?.total ?? filteredAudits.length),
      pendientes: Number(
        backend?.pendientes ??
          filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'pendiente').length
      ),
      ejecucion: Number(
        backend?.en_ejecucion ??
          filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'en_ejecucion').length
      ),
      completadas: Number(
        backend?.completadas ??
          filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'completada').length
      ),
      hallazgos: Number(backend?.hallazgos ?? localHallazgos),
      acciones: Number(backend?.acciones ?? localAcciones),
      conInforme: Number(backend?.con_informe ?? withReport),
      sinInforme: Number(backend?.sin_informe ?? withoutReport),
    };
  }, [filteredAudits, findingsByAudit, actionsByAudit, auditSummary]);

  const auditSummaryNote = useMemo(() => {
    const note = String(auditSummary?.note || '').trim();

    if (
      note ===
      'Las auditorías en ejecución son trazabilidad operativa y no deterioran KPI hasta existir resultado formal.'
    ) {
      return t('audits.summaryNoteInProgress');
    }

    return note;
  }, [auditSummary?.note, t]);

  const getAuditStatusColor = (status?: string) => {
    const normalized = normalizeAuditStatus(status);

    if (normalized === 'completada') {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (normalized === 'en_ejecucion') {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }

    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getAuditStatusLabel = (status?: string | null) => {
    const normalized = normalizeAuditStatus(status);
    if (normalized === 'completada') return t('audits.statusLabels.completed');
    if (normalized === 'en_ejecucion') return t('audits.statusLabels.inExecution');
    return t('audits.statusLabels.pending');
  };

  const getFindingTypeColor = (type?: string | null) => {
    if (type === 'no conformidad') return 'bg-red-100 text-red-700 border-red-200';
    if (type === 'oportunidad de mejora') {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (type === 'fortaleza') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  const getActionStatusColor = (status?: string | null) => {
    const raw = String(status || '').toLowerCase().trim();

    if (['completado', 'completed', 'closed', 'cerrado'].includes(raw)) {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (['bloqueado', 'blocked'].includes(raw)) {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    if (['en progreso', 'in progress', 'in_progress'].includes(raw)) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const goToFinding = (finding: FindingRow) => {
    const params = new URLSearchParams();
    params.append('id', finding.id);

    if (finding.iso_code) {
      params.append('iso', finding.iso_code);
    }

    window.location.href = `/hallazgos?${params.toString()}`;
  };

  const goToAction = (action: ActionPlanRow) => {
    const params = new URLSearchParams();
    params.append('id', action.id);

    if (action.iso_code) {
      params.append('iso', action.iso_code);
    }

    window.location.href = `/plan-accion?${params.toString()}`;
  };

  const goToAuditChecklist = (audit: AuditRow) => {
    window.location.href = `/auditorias/ejecucion?id=${audit.id}`;
  };

  const goToAuditAi = (audit: AuditRow) => {
    window.location.href = `/auditorias/ia?id=${audit.id}`;
  };

  if (loadingStandards) {
    return (
      <div className="mx-auto max-w-[1800px] p-6">{t('audits.loadingStandards')}</div>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <div className="mx-auto max-w-[1800px] space-y-4 p-6">
        <h1 className="text-2xl font-bold">{t('audits.title')}</h1>

        <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">
            {t('audits.noOperationalStandards')}
          </h2>

          <p className="text-sm text-gray-700">
            {t('audits.noOperationalStandardsHelp')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  {t('audits.eyebrow')}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('audits.badge')}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t('audits.title')}
              </h1>

              {isReadOnly && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  {t('audits.readOnly.banner')}
                </div>
              )}

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                {t('audits.subtitle')}
              </p>

              {auditSummaryNote && (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                  {auditSummaryNote}
                </div>
              )}
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title={t('audits.metrics.active')} value={metrics.pendientes + metrics.ejecucion} color="blue" />
              <MetricCard title={t('audits.metrics.withoutReport')} value={metrics.sinInforme} color="amber" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-8">
            <MetricCard title={t('audits.metrics.total')} value={metrics.total} color="slate" />
            <MetricCard title={t('audits.metrics.pending')} value={metrics.pendientes} color="amber" />
            <MetricCard title={t('audits.metrics.inExecution')} value={metrics.ejecucion} color="blue" />
            <MetricCard title={t('audits.metrics.completed')} value={metrics.completadas} color="green" />
            <MetricCard title={t('audits.metrics.findings')} value={metrics.hallazgos} color="red" />
            <MetricCard title={t('audits.metrics.actions')} value={metrics.acciones} color="violet" />
            <MetricCard title={t('audits.metrics.withReport')} value={metrics.conInforme} color="green" />
            <MetricCard title={t('audits.metrics.withoutReport')} value={metrics.sinInforme} color="amber" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_420px]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FilterCard label={t('audits.filters.standard')}>
                  <select
                    value={iso}
                    onChange={(e) => {
                      setIso(e.target.value);
                      if (e.target.value) setViewStep('workspace');
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="">{t('audits.filters.selectIso')}</option>
                    {operationalStandards.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </FilterCard>

                <FilterCard label={t('audits.filters.status')}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="">{t('common.all')}</option>
                    <option value="pendiente">{t('audits.statusLabels.pending')}</option>
                    <option value="en_ejecucion">{t('audits.statusLabels.inExecution')}</option>
                    <option value="completada">{t('audits.statusLabels.completed')}</option>
                  </select>
                </FilterCard>

                <FilterCard label={t('audits.filters.view')}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setViewStep('intro')}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${
                        viewStep === 'intro'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {t('audits.views.summary')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewStep('workspace')}
                      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${
                        viewStep === 'workspace'
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {t('audits.views.management')}
                    </button>
                  </div>
                </FilterCard>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('audits.nextAudit')}
              </div>

              {nextUpcomingAudit ? (
                <div className="mt-3 space-y-2">
                  <div className="text-lg font-bold text-slate-900">
                    {nextUpcomingAudit.iso}
                  </div>
                  <div className="text-sm text-slate-600">
                    {formatDate(nextUpcomingAudit.start_date)} → {formatDate(nextUpcomingAudit.end_date)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {t('audits.auditor')}: {nextUpcomingAudit.auditor_name || t('audits.unassigned')}
                  </div>
                  <div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditStatusColor(
                        nextUpcomingAudit.status
                      )}`}
                    >
                      {getAuditStatusLabel(nextUpcomingAudit.status)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  {t('audits.noUpcoming')}
                </div>
              )}
            </div>
          </div>
        </section>

        <AiAuditorAuditCta t={t} iso={iso} />

        {errorMessage && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {focusMessage && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
            <div className="font-semibold">{t('audits.directOpen')}</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        {viewStep === 'intro' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard title={t('audits.intro.planningTitle')}>
              <p className="text-sm leading-6 text-slate-600">
                {t('audits.intro.planningBody')}
              </p>
            </SectionCard>

            <SectionCard title={t('audits.intro.executionTitle')}>
              <p className="text-sm leading-6 text-slate-600">
                {t('audits.intro.executionBody')}
              </p>
            </SectionCard>

            <SectionCard title={t('audits.intro.closureTitle')}>
              <p className="text-sm leading-6 text-slate-600">
                {t('audits.intro.closureBody')}
              </p>
            </SectionCard>
          </div>
        )}


        {viewStep === 'workspace' && (
          <div className="space-y-6">
            {!isReadOnly && (
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="mb-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {t('audits.createTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('audits.createHelp')}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    <FieldBlock label={t('audits.fields.startDate')}>
                      <input
                        type="date"
                        value={form.start}
                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <FieldBlock label={t('audits.fields.endDate')}>
                      <input
                        type="date"
                        value={form.end}
                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <FieldBlock label={t('audits.fields.requester')}>
                      <input
                        placeholder={t('audits.placeholders.requester')}
                        value={form.requester}
                        onChange={(e) => setForm({ ...form, requester: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>
                  </div>

                  <div className="space-y-4">
                    <FieldBlock label={t('audits.fields.auditorType')}>
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3 bg-white"
                      >
                        <option value="">{t('audits.select')}</option>
                        <option value="interno">{t('audits.auditorTypes.internal')}</option>
                        <option value="externo">{t('audits.auditorTypes.external')}</option>
                      </select>
                    </FieldBlock>

                    <FieldBlock label={t('audits.fields.auditorName')}>
                      <input
                        placeholder={t('audits.placeholders.auditor')}
                        value={form.auditor}
                        onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700">
                      {t('audits.selectedStandard')}: <strong>{iso || t('audits.notSelected')}</strong>
                    </div>

                    <button
                      onClick={save}
                      className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      {t('audits.saveAudit')}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {t('audits.registeredTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {iso ? t('audits.showingFor', { iso }) : t('audits.showingOperational')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshAll}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('common.refresh')}
                </button>
              </div>

              {loadingAudits || loadingRelations ? (
                <div className="text-gray-500">{t('audits.loading')}</div>
              ) : filteredAudits.length === 0 ? (
                <div className="text-gray-500">
                  {t('audits.empty')}
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredAudits.map((audit) => {
                    const linkedFindings = findingsByAudit[audit.id] || [];
                    const linkedActions = actionsByAudit[audit.id] || [];
                    const linkedEvidenceCount = linkedActions.reduce(
                      (acc, item) => acc + Number(item.evidence_count || 0),
                      0
                    );
                    const linkedApprovedEvidenceCount = linkedActions.reduce(
                      (acc, item) => acc + Number(item.approved_evidence_count || 0),
                      0
                    );

                    const isExpanded = expandedAuditId === audit.id;
                    const normalizedStatus = normalizeAuditStatus(audit.status);
                    const hasReport = Boolean(audit.report_file);

                    return (
                      <article
                        key={audit.id}
                        id={`audit-${audit.id}`}
                        className={`rounded-[30px] border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all ${
                          focusedAuditId === audit.id
                            ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/30'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <InfoPill tone="slate">{translateStandardLabel(audit.iso, locale)}</InfoPill>
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditStatusColor(
                                  audit.status
                                )}`}
                              >
                                {getAuditStatusLabel(audit.status)}
                              </span>
                              <InfoPill tone={hasReport ? 'green' : 'amber'}>
                                {hasReport ? t('audits.reportUploaded') : t('audits.withoutReport')}
                              </InfoPill>
                              <InfoPill tone="blue">{t('audits.metrics.findings')} {linkedFindings.length}</InfoPill>
                              <InfoPill tone="violet">{t('audits.metrics.actions')} {linkedActions.length}</InfoPill>
                            </div>

                            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                              {t('audits.auditLabel')} {translateDisplayText(audit.auditor_type || t('audits.noType'), locale, 'audit')} · {formatDate(audit.start_date)} → {formatDate(audit.end_date)}
                            </h3>

                            <div className="mt-2 text-sm text-slate-500">
                              {t('audits.requester')}: {audit.requester_name || t('audits.notReported')} · {t('audits.auditor')}:{' '}
                              {audit.auditor_name || t('audits.unassigned')}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
                            <InfoBox label={t('audits.auditor')} value={audit.auditor_name || '-'} />
                            <InfoBox label={t('audits.fields.auditorTypeShort')} value={translateDisplayText(audit.auditor_type || '-', locale, 'audit')} />
                            <InfoBox label={t('audits.report')} value={hasReport ? t('common.yes') : t('common.no')} />
                            <InfoBox
                              label={t('audits.lastUpdated')}
                              value={formatDate(audit.updated_at || audit.created_at)}
                            />
                          </div>
                        </div>

                        <div className="mt-5">
                          <AuditStepper
                            status={normalizedStatus}
                            hasReport={hasReport}
                          />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                          <MiniStat label={t('audits.metrics.findings')} value={linkedFindings.length} />
                          <MiniStat label={t('audits.metrics.actions')} value={linkedActions.length} />
                          <MiniStat label={t('audits.metrics.evidence')} value={linkedEvidenceCount} />
                          <MiniStat label={t('audits.metrics.approved')} value={linkedApprovedEvidenceCount} />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => goToAuditChecklist(audit)}
                            className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                          >
                            {t('audits.openChecklist')}
                          </button>

                          <button
                            type="button"
                            onClick={() => goToAuditAi(audit)}
                            className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
                          >
                            {t('audits.aiAuditor')}
                          </button>

                          {!isReadOnly && normalizedStatus === 'pendiente' && (
                            <button
                              onClick={() => startAudit(audit.id)}
                              className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-white"
                            >
                              {t('audits.start')}
                            </button>
                          )}

                          {!isReadOnly && normalizedStatus === 'en_ejecucion' && (
                            <>
                              <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                {t('audits.uploadReport')}
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadReport(audit.id, file);
                                  }}
                                />
                              </label>

                              {hasReport && (
                                <button
                                  onClick={() => completeAudit(audit.id)}
                                  className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
                                >
                                  {t('audits.completeAudit')}
                                </button>
                              )}
                            </>
                          )}

                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => createFindingFromAudit(audit, 'observacion')}
                                disabled={isReadOnly || actionLoading === `finding-${audit.id}`}
                                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `finding-${audit.id}` ? t('audits.creating') : t('audits.createFinding')}
                              </button>

                              <button
                                onClick={() => createFindingFromAudit(audit, 'no conformidad')}
                                disabled={isReadOnly || actionLoading === `finding-${audit.id}`}
                                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `finding-${audit.id}` ? t('audits.creating') : t('audits.createNonconformity')}
                              </button>

                              <button
                                onClick={() => createActionFromAudit(audit)}
                                disabled={isReadOnly || actionLoading === `action-${audit.id}`}
                                className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `action-${audit.id}` ? t('audits.creating') : t('audits.createAction')}
                              </button>
                            </>
                          )}

                          {hasReport && (
                            <button
                              type="button"
                              onClick={() =>
                                openAuthorizedFile(`${API_URL}/api/audits/report/${audit.id}`, token)
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t('audits.viewReport')}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAuditId((prev) => (prev === audit.id ? '' : audit.id))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {isExpanded ? t('audits.hideDetail') : t('common.viewDetails')}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-5 grid gap-4 xl:grid-cols-3">
                            <SectionCard title={t('audits.detail.summary')}>
                              <DetailRow label="ISO" value={translateStandardLabel(audit.iso, locale)} />
                              <DetailRow label={t('audits.fields.startDateShort')} value={formatDateTime(audit.start_date)} />
                              <DetailRow label={t('audits.fields.endDateShort')} value={formatDateTime(audit.end_date)} />
                              <DetailRow label={t('audits.requester')} value={audit.requester_name || '-'} />
                              <DetailRow label={t('audits.auditor')} value={audit.auditor_name || '-'} />
                              <DetailRow label={t('audits.fields.auditorTypeShort')} value={translateDisplayText(audit.auditor_type || '-', locale, 'audit')} />
                              <DetailRow label={t('common.status')} value={getAuditStatusLabel(audit.status)} />
                              <DetailRow label={t('audits.report')} value={hasReport ? t('audits.loaded') : t('statuses.controls.pendiente')} />
                            </SectionCard>

                            <SectionCard title={t('audits.detail.derivedFindings')}>
                              {linkedFindings.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                  {t('audits.detail.noFindings')}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {linkedFindings.map((finding) => (
                                    <div
                                      key={finding.id}
                                      className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getFindingTypeColor(
                                            finding.finding_type
                                          )}`}
                                        >
                                          {translateDisplayText(finding.finding_type || 'observacion', locale, 'finding')}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          {translateSeverityLabel(finding.severity || 'media', locale)}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          {translateStatusLabel(finding.status || 'abierto', locale)}
                                        </span>
                                      </div>

                                      <div className="mt-2 text-sm font-semibold text-slate-900">
                                          {translateDisplayText(finding.title || t('audits.detail.untitledFinding'), locale, 'finding')}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-500">
                                        {formatDateTime(finding.created_at)}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => goToFinding(finding)}
                                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        {t('audits.openFinding')}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </SectionCard>

                            <SectionCard title={t('audits.detail.derivedActions')}>
                              {linkedActions.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                  {t('audits.detail.noActions')}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {linkedActions.map((action) => (
                                    <div
                                      key={action.id}
                                      className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getActionStatusColor(
                                            action.status
                                          )}`}
                                        >
                                          {translateStatusLabel(action.status || 'abierto', locale)}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          {t('audits.priority')} {translatePriorityLabel(action.priority || 'media', locale)}
                                        </span>
                                      </div>

                                      <div className="mt-2 text-sm font-semibold text-slate-900">
                                        {translateDisplayText(action.title || t('audits.detail.untitledAction'), locale, 'actionPlan')}
                                      </div>

                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                        <div>{t('audits.progress')}: {action.latest_progress_percent || 0}%</div>
                                        <div>{t('audits.metrics.evidence')}: {action.evidence_count || 0}</div>
                                        <div>{t('audits.metrics.approved')}: {action.approved_evidence_count || 0}</div>
                                        <div>{t('audits.metrics.pending')}: {action.pending_evidence_count || 0}</div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => goToAction(action)}
                                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        {t('audits.openAction')}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </SectionCard>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
    </div>
  );
}

function FilterCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'slate' | 'amber' | 'blue' | 'green' | 'red' | 'violet';
}) {
  const styles =
    color === 'amber'
      ? 'bg-yellow-100 text-yellow-700'
      : color === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : color === 'green'
      ? 'bg-green-100 text-green-700'
      : color === 'red'
      ? 'bg-red-100 text-red-700'
      : color === 'violet'
      ? 'bg-violet-100 text-violet-700'
      : 'bg-slate-100 text-slate-700';

  return (
    <div className={`rounded-[24px] p-4 shadow-sm ${styles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value || '-'}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1 text-sm">
      <div className="font-semibold text-slate-600">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function InfoPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'slate' | 'amber' | 'green' | 'blue' | 'violet';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function AuditStepper({
  status,
  hasReport,
}: {
  status: string;
  hasReport: boolean;
}) {
  const { t } = useTranslation();
  const stepDone = {
    planned: true,
    running: status === 'en_ejecucion' || status === 'completada',
    report: hasReport || status === 'completada',
    done: status === 'completada',
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StepChip label={t('audits.stepper.planned')} active={stepDone.planned} />
      <StepChip label={t('audits.stepper.inExecution')} active={stepDone.running} />
      <StepChip label={t('audits.stepper.reportUploaded')} active={stepDone.report} />
      <StepChip label={t('audits.stepper.completed')} active={stepDone.done} />
    </div>
  );
}

function StepChip({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold ${
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      {label}
    </div>
  );
}
