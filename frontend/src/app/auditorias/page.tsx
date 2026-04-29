'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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

export default function AuditoriasPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando auditorías...</div>
        </AppLayout>
      }
    >
      <AuditoriasPageContent />
    </Suspense>
  );
}

function AuditoriasPageContent() {
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

  const isReadOnly = resolveRole(user) === 'auditor';
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
        setErrorMessage('No fue posible cargar el alcance operativo.');
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
      setErrorMessage('Error cargando el alcance operativo.');
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
      iso ? loadRelations(tenantId, token, iso) : Promise.resolve(),
    ]);
  };

  const save = async () => {
    if (!token || !tenantId) return;

    if (!iso) {
      alert('Debes seleccionar una norma ISO');
      return;
    }

    if (!operationalStandardCodes.has(iso)) {
      alert('La norma seleccionada no está dentro del alcance operativo activo.');
      return;
    }

    if (!form.start || !form.end || !form.requester || !form.type || !form.auditor) {
      alert('Completa todos los campos');
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
      alert(data.error || 'Error guardando auditoría');
      return;
    }

    setForm({ start: '', end: '', requester: '', type: '', auditor: '' });
    await refreshAll();
    setExpandedAuditId(data?.id || '');
    setFocusedAuditId(data?.id || '');
    alert('Auditoría guardada correctamente');
  };

  const startAudit = async (id: string) => {
    if (!token || !tenantId) return;

    const res = await fetch(`${API_URL}/api/audits/start/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || 'Error iniciando auditoría');
      return;
    }

    await refreshAll();
  };

  const uploadReport = async (id: string, file: File) => {
    if (!token || !tenantId) return;

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch(`${API_URL}/api/audits/upload/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || 'Error subiendo informe');
      return;
    }

    await refreshAll();
  };

  const completeAudit = async (id: string) => {
    if (!token || !tenantId) return;

    const res = await fetch(`${API_URL}/api/audits/complete/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json.error || 'Error completando auditoría');
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

    const title = window.prompt(
      `Título del hallazgo para auditoría ${audit.iso}`,
      defaultType === 'no conformidad'
        ? `No conformidad auditoría ${audit.iso}`
        : `Hallazgo auditoría ${audit.iso}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del hallazgo',
        `Hallazgo levantado durante auditoría ${audit.iso} del período ${audit.start_date} a ${audit.end_date}`
      ) || '';

    const findingType =
      window.prompt(
        'Tipo de hallazgo: no conformidad / observacion / oportunidad de mejora / fortaleza',
        defaultType
      ) || defaultType;

    const severity =
      window.prompt('Severidad: alta / media / baja', 'media') || 'media';

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
        alert(json.error || 'Error creando hallazgo');
        return;
      }

      await refreshAll();
      setExpandedAuditId(audit.id);
      alert('Hallazgo creado correctamente');
    } catch (err) {
      console.error('ERROR CREATE FINDING FROM AUDIT:', err);
      alert('Error creando hallazgo');
    } finally {
      setActionLoading('');
    }
  };

  const createActionFromAudit = async (audit: AuditRow) => {
    if (!token || !tenantId) return;

    const title = window.prompt(
      `Título del plan de acción para auditoría ${audit.iso}`,
      `Acción auditoría ${audit.iso}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del plan de acción',
        `Acción derivada de auditoría ${audit.iso} del período ${audit.start_date} a ${audit.end_date}`
      ) || '';

    const owner = window.prompt('Responsable del plan de acción', '') || '';
    const priority =
      window.prompt('Prioridad: alta / media / baja', 'media') || 'media';

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
        alert(json.error || 'Error creando plan de acción');
        return;
      }

      await refreshAll();
      setExpandedAuditId(audit.id);
      alert('Plan de acción creado correctamente');
    } catch (err) {
      console.error('ERROR CREATE ACTION FROM AUDIT:', err);
      alert('Error creando plan de acción');
    } finally {
      setActionLoading('');
    }
  };

  const applyFocus = (audit: AuditRow) => {
    setFocusedAuditId(audit.id);
    setExpandedAuditId(audit.id);
    setFocusMessage(
      `Resultado abierto desde búsqueda: auditoría ${audit.iso} (${audit.start_date} → ${audit.end_date})`
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
    const withReport = filteredAudits.filter((a) => Boolean(a.report_file)).length;
    const withoutReport = filteredAudits.length - withReport;

    return {
      total: filteredAudits.length,
      pendientes: filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'pendiente')
        .length,
      ejecucion: filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'en_ejecucion')
        .length,
      completadas: filteredAudits.filter((a) => normalizeAuditStatus(a.status) === 'completada')
        .length,
      hallazgos: filteredAudits.reduce(
        (acc, audit) => acc + (findingsByAudit[audit.id]?.length || 0),
        0
      ),
      acciones: filteredAudits.reduce(
        (acc, audit) => acc + (actionsByAudit[audit.id]?.length || 0),
        0
      ),
      conInforme: withReport,
      sinInforme: withoutReport,
    };
  }, [filteredAudits, findingsByAudit, actionsByAudit]);

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

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas operativas...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Auditorías</h1>

          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">
              No hay normas operativas para esta empresa
            </h2>

            <p className="text-sm text-gray-700">
              Primero debes dejar una norma activa con al menos una operación activa asignada.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1800px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  Auditoría interna y externa
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  planificación · ejecución · cierre
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                Auditorías
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                Programa auditorías, controla su avance, gestiona informe final y
                convierte resultados en hallazgos y planes de acción trazables.
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title="Auditorías activas" value={metrics.pendientes + metrics.ejecucion} color="blue" />
              <MetricCard title="Sin informe" value={metrics.sinInforme} color="amber" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-8">
            <MetricCard title="Total" value={metrics.total} color="slate" />
            <MetricCard title="Pendientes" value={metrics.pendientes} color="amber" />
            <MetricCard title="En ejecución" value={metrics.ejecucion} color="blue" />
            <MetricCard title="Completadas" value={metrics.completadas} color="green" />
            <MetricCard title="Hallazgos" value={metrics.hallazgos} color="red" />
            <MetricCard title="Acciones" value={metrics.acciones} color="violet" />
            <MetricCard title="Con informe" value={metrics.conInforme} color="green" />
            <MetricCard title="Sin informe" value={metrics.sinInforme} color="amber" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_420px]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FilterCard label="Norma">
                  <select
                    value={iso}
                    onChange={(e) => {
                      setIso(e.target.value);
                      if (e.target.value) setViewStep('workspace');
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="">Seleccionar ISO</option>
                    {operationalStandards.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </FilterCard>

                <FilterCard label="Estado">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_ejecucion">En ejecución</option>
                    <option value="completada">Completada</option>
                  </select>
                </FilterCard>

                <FilterCard label="Vista">
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
                      Resumen
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
                      Gestión
                    </button>
                  </div>
                </FilterCard>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Próxima auditoría
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
                    Auditor: {nextUpcomingAudit.auditor_name || 'Sin asignar'}
                  </div>
                  <div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditStatusColor(
                        nextUpcomingAudit.status
                      )}`}
                    >
                      {normalizeAuditStatus(nextUpcomingAudit.status)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  No hay auditorías activas próximas.
                </div>
              )}
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {focusMessage && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
            <div className="font-semibold">Apertura directa desde búsqueda</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        {viewStep === 'intro' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard title="1. Planificación">
              <p className="text-sm leading-6 text-slate-600">
                Define la norma, el período, el solicitante y el auditor responsable.
                Esta etapa deja la auditoría programada y visible para seguimiento.
              </p>
            </SectionCard>

            <SectionCard title="2. Ejecución">
              <p className="text-sm leading-6 text-slate-600">
                Una vez iniciada, la auditoría permite subir informe, registrar
                hallazgos y crear acciones correctivas derivadas.
              </p>
            </SectionCard>

            <SectionCard title="3. Cierre y trazabilidad">
              <p className="text-sm leading-6 text-slate-600">
                El cierre debe quedar respaldado con informe cargado y con sus
                derivados visibles: hallazgos, acciones y evidencias asociadas.
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
                    Crear nueva auditoría
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Completa el calendario y los datos del responsable para dejar la auditoría programada.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    <FieldBlock label="Fecha inicio">
                      <input
                        type="date"
                        value={form.start}
                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <FieldBlock label="Fecha término">
                      <input
                        type="date"
                        value={form.end}
                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <FieldBlock label="Solicitante">
                      <input
                        placeholder="Nombre solicitante"
                        value={form.requester}
                        onChange={(e) => setForm({ ...form, requester: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>
                  </div>

                  <div className="space-y-4">
                    <FieldBlock label="Tipo auditor">
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3 bg-white"
                      >
                        <option value="">Seleccionar</option>
                        <option value="interno">Auditor interno</option>
                        <option value="externo">Auditor externo</option>
                      </select>
                    </FieldBlock>

                    <FieldBlock label="Nombre del auditor">
                      <input
                        placeholder="Nombre del auditor"
                        value={form.auditor}
                        onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 p-3"
                      />
                    </FieldBlock>

                    <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700">
                      Norma seleccionada: <strong>{iso || 'Sin selección'}</strong>
                    </div>

                    <button
                      onClick={save}
                      className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      Guardar auditoría
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Auditorías registradas
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {iso ? `Mostrando auditorías para ${iso}` : 'Mostrando auditorías operativas'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshAll}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Refrescar
                </button>
              </div>

              {loadingAudits || loadingRelations ? (
                <div className="text-gray-500">Cargando auditorías...</div>
              ) : filteredAudits.length === 0 ? (
                <div className="text-gray-500">
                  No hay auditorías registradas para esta selección.
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
                              <InfoPill tone="slate">{audit.iso}</InfoPill>
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAuditStatusColor(
                                  audit.status
                                )}`}
                              >
                                {normalizedStatus}
                              </span>
                              <InfoPill tone={hasReport ? 'green' : 'amber'}>
                                {hasReport ? 'Informe cargado' : 'Sin informe'}
                              </InfoPill>
                              <InfoPill tone="blue">Hallazgos {linkedFindings.length}</InfoPill>
                              <InfoPill tone="violet">Acciones {linkedActions.length}</InfoPill>
                            </div>

                            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                              Auditoría {audit.auditor_type || 'sin tipo'} · {formatDate(audit.start_date)} → {formatDate(audit.end_date)}
                            </h3>

                            <div className="mt-2 text-sm text-slate-500">
                              Solicitante: {audit.requester_name || 'No informado'} · Auditor:{' '}
                              {audit.auditor_name || 'Sin asignar'}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
                            <InfoBox label="Auditor" value={audit.auditor_name || '-'} />
                            <InfoBox label="Tipo" value={audit.auditor_type || '-'} />
                            <InfoBox label="Informe" value={hasReport ? 'Sí' : 'No'} />
                            <InfoBox
                              label="Última actualización"
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
                          <MiniStat label="Hallazgos" value={linkedFindings.length} />
                          <MiniStat label="Acciones" value={linkedActions.length} />
                          <MiniStat label="Evidencias" value={linkedEvidenceCount} />
                          <MiniStat label="Aprobadas" value={linkedApprovedEvidenceCount} />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {!isReadOnly && normalizedStatus === 'pendiente' && (
                            <button
                              onClick={() => startAudit(audit.id)}
                              className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-white"
                            >
                              Iniciar auditoría
                            </button>
                          )}

                          {!isReadOnly && normalizedStatus === 'en_ejecucion' && (
                            <>
                              <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Subir informe
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
                                  Completar auditoría
                                </button>
                              )}
                            </>
                          )}

                          {hasReport && (
                            <a
                              href={`${API_URL}/uploads/${audit.report_file}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Ver informe
                            </a>
                          )}

                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => createFindingFromAudit(audit, 'observacion')}
                                disabled={actionLoading === `finding-${audit.id}`}
                                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `finding-${audit.id}` ? 'Creando...' : 'Crear hallazgo'}
                              </button>

                              <button
                                onClick={() => createFindingFromAudit(audit, 'no conformidad')}
                                disabled={actionLoading === `finding-${audit.id}`}
                                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `finding-${audit.id}` ? 'Creando...' : 'Crear NC'}
                              </button>

                              <button
                                onClick={() => createActionFromAudit(audit)}
                                disabled={actionLoading === `action-${audit.id}`}
                                className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                {actionLoading === `action-${audit.id}` ? 'Creando...' : 'Crear acción'}
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAuditId((prev) => (prev === audit.id ? '' : audit.id))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-5 grid gap-4 xl:grid-cols-3">
                            <SectionCard title="Resumen de auditoría">
                              <DetailRow label="ISO" value={audit.iso} />
                              <DetailRow label="Inicio" value={formatDateTime(audit.start_date)} />
                              <DetailRow label="Término" value={formatDateTime(audit.end_date)} />
                              <DetailRow label="Solicitante" value={audit.requester_name || '-'} />
                              <DetailRow label="Auditor" value={audit.auditor_name || '-'} />
                              <DetailRow label="Tipo" value={audit.auditor_type || '-'} />
                              <DetailRow label="Estado" value={normalizedStatus} />
                              <DetailRow label="Informe" value={hasReport ? 'Cargado' : 'Pendiente'} />
                            </SectionCard>

                            <SectionCard title="Hallazgos derivados">
                              {linkedFindings.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                  Sin hallazgos asociados.
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
                                          {finding.finding_type || 'observacion'}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          {finding.severity || 'media'}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          {finding.status || 'abierto'}
                                        </span>
                                      </div>

                                      <div className="mt-2 text-sm font-semibold text-slate-900">
                                        {finding.title || 'Hallazgo sin título'}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-500">
                                        {formatDateTime(finding.created_at)}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => goToFinding(finding)}
                                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        Abrir hallazgo
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </SectionCard>

                            <SectionCard title="Planes de acción derivados">
                              {linkedActions.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                  Sin planes de acción asociados.
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
                                          {action.status || 'abierto'}
                                        </span>

                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                          Prioridad {action.priority || 'media'}
                                        </span>
                                      </div>

                                      <div className="mt-2 text-sm font-semibold text-slate-900">
                                        {action.title || 'Acción sin título'}
                                      </div>

                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                        <div>Avance: {action.latest_progress_percent || 0}%</div>
                                        <div>Evidencias: {action.evidence_count || 0}</div>
                                        <div>Aprobadas: {action.approved_evidence_count || 0}</div>
                                        <div>Pendientes: {action.pending_evidence_count || 0}</div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => goToAction(action)}
                                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      >
                                        Abrir acción
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
    </AppLayout>
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
  const stepDone = {
    planned: true,
    running: status === 'en_ejecucion' || status === 'completada',
    report: hasReport || status === 'completada',
    done: status === 'completada',
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StepChip label="Programada" active={stepDone.planned} />
      <StepChip label="En ejecución" active={stepDone.running} />
      <StepChip label="Informe cargado" active={stepDone.report} />
      <StepChip label="Completada" active={stepDone.done} />
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
