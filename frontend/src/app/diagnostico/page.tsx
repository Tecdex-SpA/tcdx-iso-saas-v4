'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { getComplianceStatusLabel } from '@/i18n/statusLabels';
import { translateDisplayText, translateClauseLabel } from '@/i18n/displayText';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean;
  active_operations_count?: number;
  active_operation_ids?: string[];
};

type OperationItem = {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  operation_type?: string;
  is_active?: boolean;
  is_default?: boolean;
  sort_order?: number;
};

type ScopeResponse = {
  operations?: OperationItem[];
  standards?: ScopeStandard[];
};

type DiagnosticItem = {
  id: string;
  tenant_id: string;
  control_id: string;
  catalog_control_id?: string;
  iso: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  applicability?: string | null;
  source_type?: string | null;
  has_open_nonconformity?: boolean;
  operation_id?: string | null;
  operation_name?: string | null;
  operation_code?: string | null;
  operation_type?: string | null;
};

const ui = {
  es: {
    title: 'Diagnóstico',
    loadingScope: 'Cargando alcance operativo...',
    loadingDiagnostic: 'Cargando diagnóstico...',
    scopeLoadError: 'No fue posible cargar el alcance operativo.',
    scopeGenericError: 'Error cargando el alcance operativo.',
    diagnosticLoadError: 'No fue posible cargar el diagnóstico.',
    diagnosticGenericError: 'Error cargando diagnóstico.',
    updateError: 'Error actualizando diagnóstico',
    noOperationalStandardsTitle: 'No hay normas operativas para esta empresa',
    noOperationalStandardsHelp:
      'Primero debes dejar una norma activa con al menos una operación activa asignada.',
    noOperationsTitle: 'La norma seleccionada no tiene operaciones activas',
    noOperationsHelp: 'Activa una operación para esta norma desde el alcance del tenant.',
    compliance: 'Cumplimiento',
    compliant: 'Cumple',
    partial: 'Parcial',
    nonCompliant: 'No cumple',
    pending: 'Pendiente',
    notApplicable: 'No aplica',
    noControls: 'Esta combinación de norma y operación no tiene controles disponibles aún.',
    operation: 'Operación',
    noOperation: 'Sin operación',
    hasOpenNc: 'Tiene no conformidad abierta',
    creating: 'Creando...',
    createFinding: 'Crear hallazgo',
    createAction: 'Crear acción',
    openNc: 'Abrir NC',
    findingTitlePrompt: (clause: string) => `Título del hallazgo para ${clause}`,
    findingTitleDefault: (clause: string) => `Hallazgo en control ${clause}`.trim(),
    findingDescriptionPrompt: 'Descripción del hallazgo',
    findingCreateError: 'Error creando hallazgo',
    findingDuplicate:
      'Ya existía un hallazgo reciente equivalente. Se reutilizó el existente.',
    findingCreated: 'Hallazgo creado correctamente',
    actionTitlePrompt: (clause: string) => `Título del plan de acción para ${clause}`,
    actionTitleDefault: (clause: string) => `Acción para control ${clause}`.trim(),
    actionDescriptionPrompt: 'Descripción del plan de acción',
    actionOwnerPrompt: 'Responsable del plan de acción',
    actionCreateError: 'Error creando plan de acción',
    actionCreated: 'Plan de acción creado correctamente',
    ncAlreadyOpen:
      'Este control ya está en "no cumple". Si no existe una NC abierta, el backend la controlará en el flujo normal.',
    ncConfirm:
      'Esto cambiará el estado del control a "no cumple" y abrirá o reutilizará una no conformidad abierta. ¿Continuar?',
  },
  en: {
    title: 'Assessment',
    loadingScope: 'Loading operational scope...',
    loadingDiagnostic: 'Loading assessment...',
    scopeLoadError: 'The operational scope could not be loaded.',
    scopeGenericError: 'Error loading the operational scope.',
    diagnosticLoadError: 'The assessment could not be loaded.',
    diagnosticGenericError: 'Error loading assessment.',
    updateError: 'Error updating assessment',
    noOperationalStandardsTitle: 'No operational standards are available for this company',
    noOperationalStandardsHelp:
      'You first need an active standard with at least one active assigned operation.',
    noOperationsTitle: 'The selected standard has no active operations',
    noOperationsHelp: 'Activate an operation for this standard from the tenant scope.',
    compliance: 'Compliance',
    compliant: 'Compliant',
    partial: 'Partial',
    nonCompliant: 'Non-compliant',
    pending: 'Pending',
    notApplicable: 'Not applicable',
    noControls: 'This standard and operation combination does not have available controls yet.',
    operation: 'Operation',
    noOperation: 'No operation',
    hasOpenNc: 'Has an open nonconformity',
    creating: 'Creating...',
    createFinding: 'Create finding',
    createAction: 'Create action',
    openNc: 'Open NC',
    findingTitlePrompt: (clause: string) => `Finding title for ${clause}`,
    findingTitleDefault: (clause: string) => `Finding for control ${clause}`.trim(),
    findingDescriptionPrompt: 'Finding description',
    findingCreateError: 'Error creating finding',
    findingDuplicate:
      'An equivalent recent finding already existed. The existing record was reused.',
    findingCreated: 'Finding created successfully',
    actionTitlePrompt: (clause: string) => `Action plan title for ${clause}`,
    actionTitleDefault: (clause: string) => `Action for control ${clause}`.trim(),
    actionDescriptionPrompt: 'Action plan description',
    actionOwnerPrompt: 'Action plan owner',
    actionCreateError: 'Error creating action plan',
    actionCreated: 'Action plan created successfully',
    ncAlreadyOpen:
      'This control is already non-compliant. If there is no open NC, the backend will handle it in the normal flow.',
    ncConfirm:
      'This will change the control status to non-compliant and open or reuse an open nonconformity. Continue?',
  },
} as const;

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
    s?.is_active === true &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function translateKnownSystemText(value: string | null | undefined, locale: 'es' | 'en') {
  const original = String(value || '').trim();
  if (!original || locale !== 'en') return original;

  const dictionary: Record<string, string> = {
    'sin operacion': 'No operation',
    'sin operación': 'No operation',
    operaciones: 'Operations',
    operacion: 'Operation',
    operación: 'Operation',
    general: 'General',
    cumplimiento: 'Compliance',
    seguridad: 'Security',
    continuidad: 'Continuity',
    calidad: 'Quality',
    evidencia: 'Evidence',
    riesgo: 'Risk',
    riesgos: 'Risks',
    control: 'Control',
    controles: 'Controls',
    auditoria: 'Audit',
    auditoría: 'Audit',
    hallazgo: 'Finding',
    hallazgos: 'Findings',
    'no conformidad': 'Nonconformity',
    'no conformidades': 'Nonconformities',
  };

  return dictionary[original.toLowerCase()] || original;
}

function standardLabel(code?: string | null, name?: string | null) {
  const standardCode = String(code || '').replace(/\s+/g, '').toUpperCase();
  const normalizedName = String(name || '').trim();

  if (standardCode === 'ISO9001') return normalizedName || 'ISO 9001';
  if (standardCode === 'ISO27001') return normalizedName || 'ISO 27001';
  if (standardCode === 'ISO22301') return normalizedName || 'ISO 22301';
  if (standardCode === 'ISO14001') return normalizedName || 'ISO 14001';
  if (standardCode === 'ISO20000-1' || standardCode === 'ISO200001') {
    return normalizedName || 'ISO 20000-1';
  }

  return normalizedName ? `${code} - ${normalizedName}` : String(code || '');
}

export default function DiagnosticoPage() {
  const { locale, t } = useTranslation();
  const lang = locale === 'en' ? 'en' : 'es';
  const copy = ui[lang];

  const [data, setData] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScope, setLoadingScope] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const [scope, setScope] = useState<ScopeResponse>({
    operations: [],
    standards: [],
  });

  const [selectedISO, setSelectedISO] = useState('');
  const [selectedOperationId, setSelectedOperationId] = useState('');

  const tenantId = resolveTenantId(user);
  const role = resolveRole(user);
  const isReadOnly = role === 'auditor';

  const diagnosticStatusLabel = (status?: string | null) => {
    if (status === 'pendiente') return copy.pending;
    return getComplianceStatusLabel(status, t);
  };

  const loadScope = async (tenant_id: string, authToken: string) => {
    try {
      setLoadingScope(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/tenant-standards/scope/${tenant_id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json: ScopeResponse = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD DIAGNOSTIC SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setSelectedISO('');
        setSelectedOperationId('');
        setErrorMessage(copy.scopeLoadError);
        return;
      }

      const standards = Array.isArray(json?.standards) ? json.standards : [];
      const operations = Array.isArray(json?.operations) ? json.operations : [];

      setScope({ standards, operations });
    } catch (err) {
      console.error('ERROR LOAD DIAGNOSTIC SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setSelectedISO('');
      setSelectedOperationId('');
      setErrorMessage(copy.scopeGenericError);
    } finally {
      setLoadingScope(false);
    }
  };

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const availableOperations = useMemo(() => {
    const selectedStandard = operationalStandards.find((s) => s.code === selectedISO);

    if (!selectedStandard) return [];

    const allowedOperationIds = new Set(selectedStandard.active_operation_ids || []);

    return (scope.operations || []).filter(
      (op) => op.is_active === true && allowedOperationIds.has(op.id)
    );
  }, [scope.operations, operationalStandards, selectedISO]);

  useEffect(() => {
    try {
      const authToken = localStorage.getItem('token');
      const u = getUserFromToken();

      if (!authToken || !resolveTenantId(u)) {
        setLoading(false);
        setLoadingScope(false);
        return;
      }

      setToken(authToken);
      setUser(u);
      void loadScope(resolveTenantId(u), authToken);
    } catch (err) {
      console.error('ERROR GENERAL DIAGNOSTICO:', err);
      setLoading(false);
      setLoadingScope(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (operationalStandards.length === 0) {
      setSelectedISO('');
      return;
    }

    setSelectedISO((prev) => {
      const exists = operationalStandards.some((s) => s.code === prev);
      return exists ? prev : operationalStandards[0].code;
    });
  }, [operationalStandards]);

  useEffect(() => {
    if (!selectedISO) {
      setSelectedOperationId('');
      return;
    }

    if (availableOperations.length === 0) {
      setSelectedOperationId('');
      return;
    }

    setSelectedOperationId((prev) => {
      const exists = availableOperations.some((op) => op.id === prev);
      return exists ? prev : availableOperations[0].id;
    });
  }, [selectedISO, availableOperations]);

  const loadDiagnostic = async (
    tenant_id: string,
    authToken: string,
    iso: string,
    operationId: string
  ) => {
    try {
      setLoading(true);
      setErrorMessage('');

      const params = new URLSearchParams();
      params.append('iso', iso);
      params.append('operation_id', operationId);

      const res = await fetch(
        `${API_URL}/api/diagnostic/${tenant_id}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD DIAGNOSTIC:', json);
        setData([]);
        setErrorMessage(json?.error || copy.diagnosticLoadError);
        return;
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD DIAGNOSTIC:', err);
      setData([]);
      setErrorMessage(copy.diagnosticGenericError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !tenantId || !selectedISO || !selectedOperationId) {
      if (!loadingScope) {
        setLoading(false);
      }
      return;
    }

    void loadDiagnostic(tenantId, token, selectedISO, selectedOperationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, selectedISO, selectedOperationId, loadingScope, lang]);

  const update = async (id: string, status: string) => {
    const authToken = localStorage.getItem('token');
    const previous = [...data];

    setData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );

    try {
      const res = await fetch(`${API_URL}/api/diagnostic/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR UPDATE DIAGNOSTIC:', json);
        setData(previous);
        alert(json.error || copy.updateError);
        return;
      }

      const fresh = json?.control;
      if (fresh?.id) {
        setData((prev) =>
          prev.map((c) =>
            c.id === fresh.id
              ? {
                  ...c,
                  ...fresh,
                  has_open_nonconformity:
                    json?.nonconformity_action?.action === 'created' ||
                    json?.nonconformity_action?.action === 'reused_open'
                      ? true
                      : json?.nonconformity_action?.action === 'resolved_open'
                      ? false
                      : c.has_open_nonconformity,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('ERROR UPDATE DIAGNOSTIC:', err);
      setData(previous);
      alert(copy.updateError);
    }
  };

  const createFinding = async (control: DiagnosticItem) => {
    if (!token || !tenantId) return;

    const controlRef = control.clause || control.id;
    const title = window.prompt(
      copy.findingTitlePrompt(controlRef),
      copy.findingTitleDefault(control.clause || '')
    );

    if (!title) return;

    const description =
      window.prompt(copy.findingDescriptionPrompt, control.description || '') || '';

    const findingType =
      control.status === 'no cumple'
        ? 'no conformidad'
        : control.status === 'parcial'
        ? 'observacion'
        : 'oportunidad de mejora';

    const severity =
      control.status === 'no cumple'
        ? 'alta'
        : control.status === 'parcial'
        ? 'media'
        : 'baja';

    try {
      setActionLoading(`finding-${control.id}`);

      const res = await fetch(`${API_URL}/api/findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: selectedISO,
          title,
          description,
          finding_type: findingType,
          severity,
          source_type: 'diagnostic',
          tenant_control_id: control.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || copy.findingCreateError);
        return;
      }

      alert(
        json?.duplicate_prevented
          ? copy.findingDuplicate
          : copy.findingCreated
      );
    } catch (err) {
      console.error('ERROR CREATE FINDING:', err);
      alert(copy.findingCreateError);
    } finally {
      setActionLoading('');
    }
  };

  const createActionPlan = async (control: DiagnosticItem) => {
    if (!token || !tenantId) return;

    const controlRef = control.clause || control.id;
    const title = window.prompt(
      copy.actionTitlePrompt(controlRef),
      copy.actionTitleDefault(control.clause || '')
    );

    if (!title) return;

    const description =
      window.prompt(copy.actionDescriptionPrompt, control.description || '') || '';

    const owner = window.prompt(copy.actionOwnerPrompt, '') || '';

    const priority =
      control.status === 'no cumple'
        ? 'alta'
        : control.status === 'parcial'
        ? 'media'
        : 'baja';

    try {
      setActionLoading(`action-${control.id}`);

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: selectedISO,
          title,
          description,
          priority,
          owner,
          source_type: 'control',
          tenant_control_id: control.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || copy.actionCreateError);
        return;
      }

      alert(copy.actionCreated);
    } catch (err) {
      console.error('ERROR CREATE ACTION PLAN:', err);
      alert(copy.actionCreateError);
    } finally {
      setActionLoading('');
    }
  };

  const openNonconformity = async (control: DiagnosticItem) => {
    if (control.status === 'no cumple') {
      alert(copy.ncAlreadyOpen);
      return;
    }

    const ok = window.confirm(copy.ncConfirm);

    if (!ok) return;

    await update(control.id, 'no cumple');
  };

  const getColor = (status?: string | null) => {
    if (status === 'cumple') return 'bg-green-100 text-green-700';
    if (status === 'parcial') return 'bg-yellow-100 text-yellow-700';
    if (status === 'no cumple') return 'bg-red-100 text-red-700';
    if (status === 'pendiente') return 'bg-gray-100 text-gray-600';
    if (status === 'no aplica') return 'bg-slate-100 text-slate-600';
    return 'bg-gray-100 text-gray-500';
  };

  const total = data.length;
  const cumple = data.filter((c) => c.status === 'cumple').length;
  const parcial = data.filter((c) => c.status === 'parcial').length;
  const noCumple = data.filter((c) => c.status === 'no cumple').length;

  const cumplimiento = total > 0 ? Math.round((cumple / total) * 100) : 0;

  if (loadingScope) {
    return (
      <AppLayout>
        <div className="p-6">{copy.loadingScope}</div>
      </AppLayout>
    );
  }

  if (!loadingScope && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{copy.title}</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              {copy.noOperationalStandardsTitle}
            </h2>

            <p className="text-sm text-gray-700">
              {copy.noOperationalStandardsHelp}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (selectedISO && availableOperations.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{copy.title}</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              {copy.noOperationsTitle}
            </h2>

            <p className="text-sm text-gray-700">
              {copy.noOperationsHelp}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">{copy.loadingDiagnostic}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold">{copy.title}</h1>

          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedISO}
              onChange={(e) => setSelectedISO(e.target.value)}
              className="border p-2 rounded"
            >
              {operationalStandards.map((s) => (
                <option key={s.code} value={s.code}>
                  {standardLabel(s.code, s.name)}
                </option>
              ))}
            </select>

            <select
              value={selectedOperationId}
              onChange={(e) => setSelectedOperationId(e.target.value)}
              className="border p-2 rounded"
            >
              {availableOperations.map((op) => (
                <option key={op.id} value={op.id}>
                  {translateKnownSystemText(op.name, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">{copy.compliance}</div>
            <div className="text-2xl font-bold text-blue-600">
              {cumplimiento}%
            </div>
          </div>

          <div className="bg-green-100 p-4 rounded text-green-700">
            {copy.compliant}: {cumple}
          </div>

          <div className="bg-yellow-100 p-4 rounded text-yellow-700">
            {copy.partial}: {parcial}
          </div>

          <div className="bg-red-100 p-4 rounded text-red-700">
            {copy.nonCompliant}: {noCumple}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {data.length === 0 ? (
            <div className="p-6 text-gray-500">
              {copy.noControls}
            </div>
          ) : (
            data.map((c) => (
              <div
                key={c.id}
                className="border-b p-4 flex justify-between items-center gap-4"
              >
                <div className="flex-1">
                  <div className="font-semibold">
                    {translateClauseLabel(c.clause, locale)} — {translateDisplayText(c.category, locale, 'category')}
                  </div>

                  <div className="text-sm text-gray-600">
                    {translateDisplayText(c.description, locale, 'control')}
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    {copy.operation}: {translateDisplayText(c.operation_name, locale, 'adminSaas') || copy.noOperation}
                  </div>

                  {c.has_open_nonconformity && (
                    <div className="inline-block mt-2 text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                      {copy.hasOpenNc}
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => createFinding(c)}
                        disabled={actionLoading === `finding-${c.id}`}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      >
                        {actionLoading === `finding-${c.id}`
                          ? copy.creating
                          : copy.createFinding}
                      </button>

                      <button
                        onClick={() => createActionPlan(c)}
                        disabled={actionLoading === `action-${c.id}`}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      >
                        {actionLoading === `action-${c.id}`
                          ? copy.creating
                          : copy.createAction}
                      </button>

                      <button
                        onClick={() => openNonconformity(c)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                      >
                        {copy.openNc}
                      </button>
                    </div>
                  )}
                </div>

                <select
                  value={c.status || 'pendiente'}
                  onChange={(e) => update(c.id, e.target.value)}
                  disabled={isReadOnly}
                  className={`px-2 py-1 rounded min-w-[140px] ${getColor(c.status)} ${
                    isReadOnly ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="pendiente">{diagnosticStatusLabel('pendiente')}</option>
                  <option value="cumple">{diagnosticStatusLabel('cumple')}</option>
                  <option value="parcial">{diagnosticStatusLabel('parcial')}</option>
                  <option value="no cumple">{diagnosticStatusLabel('no cumple')}</option>
                  <option value="no aplica">{diagnosticStatusLabel('no aplica')}</option>
                </select>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
