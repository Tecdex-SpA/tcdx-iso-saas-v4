'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { getComplianceStatusLabel } from '@/i18n/statusLabels';
import { translateDisplayText, translateClauseLabel } from '@/i18n/displayText';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

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

type ExpressDiagnosticOption = {
  standard_code: string;
  version_code: string;
  display_name: string;
  certifiable: boolean;
  publication_status: string;
  assessment_type: string;
  catalog_coverage_pct: number;
  sync_status?: string;
  recommended?: boolean;
  warnings?: string[];
};

type ExpressDiagnosticResult = {
  assessment?: {
    id: string;
    standard_code: string;
    version_code: string;
    assessment_type: string;
    certifiable_version: boolean;
    readiness_score: string | number;
    readiness_level?: string;
    total_iso_controls?: number;
    mapped_controls_count?: number;
    evaluated_controls_count?: number;
    controls_with_evidence_count?: number;
    controls_without_evidence_count?: number;
    gaps_count?: number;
    critical_gaps_count?: number;
    high_gaps_count?: number;
    medium_gaps_count?: number;
    low_gaps_count?: number;
  };
  gaps?: Array<{
    id?: string;
    gap_type: string;
    severity: string;
    title: string;
    recommendation?: string;
    control_code?: string | null;
  }>;
  summary?: {
    display_name?: string;
    certifiable?: boolean;
    publication_status?: string;
    coverage_pct?: number;
    coverage_warning?: string | null;
    top_gaps?: Array<{
      title: string;
      severity: string;
      recommendation?: string;
      control_code?: string | null;
    }>;
  };
  plan_30?: Array<{ title: string; recommendation?: string; control_code?: string | null }>;
  plan_60?: Array<{ title: string; recommendation?: string; control_code?: string | null }>;
  plan_90?: Array<{ title: string; recommendation?: string; control_code?: string | null }>;
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
    expressTitle: 'Diagnóstico ISO Express',
    expressSubtitle: 'Evalúa preparación por norma con iso_* y mapeos gobernados.',
    expressLoading: 'Cargando opciones express...',
    expressRun: 'Ejecutar diagnóstico express',
    expressRunning: 'Calculando...',
    expressNoOptions: 'No hay normas evaluables para diagnóstico express.',
    expressError: 'No fue posible ejecutar el diagnóstico express.',
    readiness: 'Preparación',
    readinessLevel: 'Nivel',
    evaluatedControls: 'Controles evaluados',
    withEvidence: 'Con evidencia',
    gaps: 'Brechas',
    criticalHigh: 'Críticas/altas',
    plan30: '30 días',
    plan60: '60 días',
    plan90: '90 días',
    mainGaps: 'Brechas principales',
    latestExpress: 'Historial express',
    certifiable: 'Certificable',
    notCertifiable: 'No certificable',
    coverage: 'Cobertura',
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
    expressTitle: 'ISO Express Assessment',
    expressSubtitle: 'Evaluate readiness by standard with iso_* and governed mappings.',
    expressLoading: 'Loading express options...',
    expressRun: 'Run express assessment',
    expressRunning: 'Calculating...',
    expressNoOptions: 'No standards are available for express assessment.',
    expressError: 'The express assessment could not be calculated.',
    readiness: 'Readiness',
    readinessLevel: 'Level',
    evaluatedControls: 'Evaluated controls',
    withEvidence: 'With evidence',
    gaps: 'Gaps',
    criticalHigh: 'Critical/high',
    plan30: '30 days',
    plan60: '60 days',
    plan90: '90 days',
    mainGaps: 'Main gaps',
    latestExpress: 'Express history',
    certifiable: 'Certifiable',
    notCertifiable: 'Not certifiable',
    coverage: 'Coverage',
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
  const [expressOptions, setExpressOptions] = useState<ExpressDiagnosticOption[]>([]);
  const [selectedExpressKey, setSelectedExpressKey] = useState('');
  const [expressLoading, setExpressLoading] = useState(false);
  const [expressRunning, setExpressRunning] = useState(false);
  const [expressError, setExpressError] = useState('');
  const [expressResult, setExpressResult] = useState<ExpressDiagnosticResult | null>(null);
  const [expressLatest, setExpressLatest] = useState<ExpressDiagnosticResult['assessment'][]>([]);

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

  const loadExpressOptions = async (tenant_id: string, authToken: string) => {
    try {
      setExpressLoading(true);
      setExpressError('');

      const res = await fetch(
        `${API_URL}/api/iso-express-diagnostic/options/${tenant_id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ISO EXPRESS OPTIONS:', json);
        setExpressOptions([]);
        setExpressError(json?.error || copy.expressError);
        return;
      }

      const options = Array.isArray(json?.data?.options) ? json.data.options : [];
      setExpressOptions(options);
    } catch (err) {
      console.error('ERROR LOAD ISO EXPRESS OPTIONS:', err);
      setExpressOptions([]);
      setExpressError(copy.expressError);
    } finally {
      setExpressLoading(false);
    }
  };

  const loadExpressLatest = async (tenant_id: string, authToken: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/iso-express-diagnostic/${tenant_id}/latest`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ISO EXPRESS LATEST:', json);
        setExpressLatest([]);
        return;
      }

      setExpressLatest(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error('ERROR LOAD ISO EXPRESS LATEST:', err);
      setExpressLatest([]);
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
      void loadExpressOptions(resolveTenantId(u), authToken);
      void loadExpressLatest(resolveTenantId(u), authToken);
    } catch (err) {
      console.error('ERROR GENERAL DIAGNOSTICO:', err);
      setLoading(false);
      setLoadingScope(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (expressOptions.length === 0) {
      setSelectedExpressKey('');
      return;
    }

    setSelectedExpressKey((prev) => {
      const exists = expressOptions.some(
        (option) => `${option.standard_code}:${option.version_code}` === prev
      );
      if (exists) return prev;

      const preferred =
        expressOptions.find((option) => option.recommended) || expressOptions[0];
      return `${preferred.standard_code}:${preferred.version_code}`;
    });
  }, [expressOptions]);

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

  const runExpressDiagnostic = async () => {
    if (!token || !tenantId || !selectedExpressKey) return;

    const selected = expressOptions.find(
      (option) => `${option.standard_code}:${option.version_code}` === selectedExpressKey
    );

    if (!selected) return;

    try {
      setExpressRunning(true);
      setExpressError('');

      const res = await fetch(
        `${API_URL}/api/iso-express-diagnostic/${tenantId}/calculate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            standard_code: selected.standard_code,
            version_code: selected.version_code,
            assessment_type: selected.assessment_type || 'express',
            answers: [],
          }),
        }
      );
      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR RUN ISO EXPRESS:', json);
        setExpressError(json?.error || copy.expressError);
        return;
      }

      setExpressResult(json?.data || null);
      void loadExpressLatest(tenantId, token);
    } catch (err) {
      console.error('ERROR RUN ISO EXPRESS:', err);
      setExpressError(copy.expressError);
    } finally {
      setExpressRunning(false);
    }
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

  const selectedExpressOption = expressOptions.find(
    (option) => `${option.standard_code}:${option.version_code}` === selectedExpressKey
  );

  const renderPlan = (
    title: string,
    items: ExpressDiagnosticResult['plan_30'] | undefined
  ) => (
    <div className="border rounded p-3 bg-slate-50">
      <div className="font-semibold text-sm mb-2">{title}</div>
      {items && items.length > 0 ? (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.slice(0, 5).map((item, index) => (
            <li key={`${title}-${index}`}>
              <span className="font-medium">{item.title}</span>
              {item.recommendation && (
                <div className="text-xs text-gray-500">{item.recommendation}</div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-500">-</div>
      )}
    </div>
  );

  const renderExpressPanel = () => (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-xl font-semibold">{copy.expressTitle}</h2>
          <p className="text-sm text-gray-500">{copy.expressSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedExpressKey}
            onChange={(e) => setSelectedExpressKey(e.target.value)}
            disabled={expressLoading || expressOptions.length === 0}
            className="border p-2 rounded min-w-[260px]"
          >
            {expressOptions.map((option) => (
              <option
                key={`${option.standard_code}:${option.version_code}`}
                value={`${option.standard_code}:${option.version_code}`}
              >
                {option.display_name} · {Number(option.catalog_coverage_pct || 0).toFixed(2)}%
              </option>
            ))}
          </select>

          <button
            onClick={runExpressDiagnostic}
            disabled={!selectedExpressKey || expressLoading || expressRunning}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {expressRunning ? copy.expressRunning : copy.expressRun}
          </button>
        </div>
      </div>

      {expressLoading && <div className="text-sm text-gray-500">{copy.expressLoading}</div>}

      {!expressLoading && expressOptions.length === 0 && (
        <div className="text-sm text-gray-500">{copy.expressNoOptions}</div>
      )}

      {expressError && (
        <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
          {expressError}
        </div>
      )}

      {selectedExpressOption && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
            {selectedExpressOption.publication_status}
          </span>
          <span
            className={`px-2 py-1 rounded ${
              selectedExpressOption.certifiable
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {selectedExpressOption.certifiable ? copy.certifiable : copy.notCertifiable}
          </span>
          <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">
            {copy.coverage}: {Number(selectedExpressOption.catalog_coverage_pct || 0).toFixed(2)}%
          </span>
          {selectedExpressOption.warnings?.map((warning, index) => (
            <span
              key={`${selectedExpressOption.standard_code}-warning-${index}`}
              className="px-2 py-1 rounded bg-yellow-50 text-yellow-800 border border-yellow-200"
            >
              {warning}
            </span>
          ))}
        </div>
      )}

      {expressResult?.assessment && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-700">{copy.readiness}</div>
              <div className="text-2xl font-bold text-blue-800">
                {Math.round(Number(expressResult.assessment.readiness_score || 0))}%
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-gray-500">{copy.readinessLevel}</div>
              <div className="font-semibold">{expressResult.assessment.readiness_level || '-'}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-gray-500">{copy.evaluatedControls}</div>
              <div className="font-semibold">
                {expressResult.assessment.evaluated_controls_count || 0}/
                {expressResult.assessment.total_iso_controls || 0}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-gray-500">{copy.withEvidence}</div>
              <div className="font-semibold">
                {expressResult.assessment.controls_with_evidence_count || 0}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-gray-500">{copy.criticalHigh}</div>
              <div className="font-semibold">
                {(expressResult.assessment.critical_gaps_count || 0) +
                  (expressResult.assessment.high_gaps_count || 0)}
              </div>
            </div>
          </div>

          {expressResult.summary?.coverage_warning && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
              {expressResult.summary.coverage_warning}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3">
            {renderPlan(copy.plan30, expressResult.plan_30)}
            {renderPlan(copy.plan60, expressResult.plan_60)}
            {renderPlan(copy.plan90, expressResult.plan_90)}
          </div>

          <div>
            <h3 className="font-semibold mb-2">{copy.mainGaps}</h3>
            <div className="space-y-2">
              {(expressResult.summary?.top_gaps || expressResult.gaps || [])
                .slice(0, 6)
                .map((gap, index) => (
                  <div key={`express-gap-${index}`} className="border rounded p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{gap.title}</span>
                      <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                        {gap.severity}
                      </span>
                    </div>
                    {gap.recommendation && (
                      <div className="text-xs text-gray-500 mt-1">
                        {gap.recommendation}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {expressLatest.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">{copy.latestExpress}</h3>
          <div className="grid md:grid-cols-3 gap-2">
            {expressLatest.slice(0, 6).map((assessment) => (
              <div key={assessment?.id} className="border rounded p-3 text-sm">
                <div className="font-medium">
                  {assessment?.standard_code} {assessment?.version_code}
                </div>
                <div className="text-gray-500">
                  {copy.readiness}: {Math.round(Number(assessment?.readiness_score || 0))}% ·{' '}
                  {assessment?.readiness_level || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

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

          {renderExpressPanel()}
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

          {renderExpressPanel()}
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-6">{copy.loadingDiagnostic}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">
        <section className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Diagnóstico ISO</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">{copy.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Evaluación rápida de controles, brechas y preparación operativa por norma contratada.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
            <select
              value={selectedISO}
              onChange={(e) => setSelectedISO(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm"
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
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm"
            >
              {availableOperations.map((op) => (
                <option key={op.id} value={op.id}>
                  {translateKnownSystemText(op.name, lang)}
                </option>
              ))}
            </select>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
            {errorMessage}
          </div>
        )}

        {renderExpressPanel()}

        <div className="grid md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="text-sm text-gray-500">{copy.compliance}</div>
            <div className="text-2xl font-bold text-blue-600">
              {cumplimiento}%
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4 font-semibold text-green-700">
            {copy.compliant}: {cumple}
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 font-semibold text-yellow-700">
            {copy.partial}: {parcial}
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {copy.nonCompliant}: {noCumple}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
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
