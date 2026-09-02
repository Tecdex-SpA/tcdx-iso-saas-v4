'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJson, apiRequestJsonSingleFlight, buildTenantHeaders, getApiBaseUrl, isUuid } from '@/utils/apiClient';
import { getUserIdFromToken } from '@/utils/auth';
import { presentationLabel, presentationOptionLabel } from '@/utils/presentationLabels';

type BuilderKind = 'metric' | 'dashboard' | 'report' | 'survey' | 'assurance' | 'loss';

type OfficialResult = {
  result_code?: string;
  analytical_result_code?: string;
  metric_key?: string;
  metric_code?: string;
  functional_code?: string;
  display_name?: string;
  formula_code?: string;
  formula_version?: number;
  domain?: string;
  unit?: string | null;
  source_status?: string;
};

type OperationLog = {
  step: string;
  status: 'completed' | 'failed' | 'pending';
  message: string;
  at: string;
};

type OperationalBuilderProps = {
  kind: BuilderKind;
  title: string;
  description: string;
  domain?: string;
  defaultResultCode?: string;
  testId?: string;
};

type Entity = Record<string, unknown> & { id?: string };

type BuilderForm = {
  code: string;
  name: string;
  type: string;
  unit: string;
  frequency: string;
  resultCode: string;
  sourceContract: string;
  thresholdWarning: string;
  thresholdCritical: string;
  numerator: string;
  denominator: string;
  periodStart: string;
  periodEnd: string;
  dimension: string;
  format: 'pdf' | 'docx' | 'xlsx';
};

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

const DEFAULT_PERIOD = currentMonthRange();

const DEFAULT_FORM: BuilderForm = {
  code: '',
  name: '',
  type: 'kpi',
  unit: '%',
  frequency: 'monthly',
  resultCode: 'compliance.weighted',
  sourceContract: 'official_source_contract',
  thresholdWarning: '70',
  thresholdCritical: '50',
  numerator: '8',
  denominator: '10',
  periodStart: DEFAULT_PERIOD.start,
  periodEnd: DEFAULT_PERIOD.end,
  dimension: 'general',
  format: 'pdf',
};

const REPORT_CONTENT_LABELS: Record<string, string> = {
  'health.grc': 'Salud GRC',
  'compliance.weighted': 'Cumplimiento',
  'risk.residual': 'Riesgos',
  'actions.progress': 'Planes de acción',
  'evidence.coverage': 'Evidencias',
  'controls.effectiveness': 'Controles',
  'audit.assurance': 'Auditorías',
};

function dataOf<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: T }).data;
  return payload as T;
}

function compact(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 220);
  return String(value);
}

function shortDate(value: string) {
  if (!value) return 'Sin dato';
  return value.slice(0, 10);
}

function selectedResultCode(item: OfficialResult | undefined, fallback = '') {
  return item?.result_code || item?.analytical_result_code || fallback;
}

function reportContentLabel(item: OfficialResult | undefined, fallback: string) {
  const code = selectedResultCode(item, fallback);
  if (REPORT_CONTENT_LABELS[code]) return REPORT_CONTENT_LABELS[code];
  if (!item) return presentationLabel(fallback, fallback);
  return item.display_name || presentationLabel(item.domain, code);
}

function availabilityLabel(item: OfficialResult | undefined) {
  if (!item) return 'Selecciona contenido';
  return presentationLabel(item.source_status || 'available');
}

function reportStatus(result: Entity | null, preview: Entity | null) {
  return (result?.generation as Entity | undefined)?.status || result?.status || preview?.status || 'Sin generar';
}

function reportDownloadHref(result: Entity | null) {
  const generation = result?.generation as Entity | undefined;
  const generationId = generation?.id || result?.id;
  if (!generationId) return null;
  return `/api/report-generations/${encodeURIComponent(String(generationId))}/download`;
}

function hasGeneratedReportArtifact(result: Entity | null) {
  if (!result) return false;
  const status = String((result.generation as Entity | undefined)?.status || result.status || '').toLowerCase();
  return status === 'generated' && Boolean(reportDownloadHref(result));
}

function safeDownloadName(value: string) {
  const base = String(value || 'informe-generado')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'informe-generado';
}

function codePrefix(kind: BuilderKind) {
  return {
    metric: 'METRIC',
    dashboard: 'DASH',
    report: 'REPORT',
    survey: 'SURVEY',
    assurance: 'ASSURANCE',
    loss: 'LOSS',
  }[kind];
}

function reportHistoryLabel(item: Entity) {
  return compact(item.display_name || item.name || 'Configuración guardada');
}

function officialMetricCode(item: OfficialResult | undefined, fallback: string) {
  const raw = item?.functional_code || item?.metric_code || item?.metric_key || fallback;
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listEndpoint(kind: BuilderKind) {
  return {
    metric: '/api/metrics',
    dashboard: '/api/dashboards',
    report: '/api/reports',
    survey: '/api/surveys',
    assurance: '/api/assurance-tests',
    loss: '/api/loss-events',
  }[kind];
}

function defaultType(kind: BuilderKind) {
  return {
    metric: 'kpi',
    dashboard: 'custom',
    report: 'custom',
    survey: 'supplier_assessment',
    assurance: 'effectiveness_test',
    loss: 'operational',
  }[kind];
}

function validate(kind: BuilderKind, form: BuilderForm, currentUserId: string | null = null) {
  const failures: string[] = [];
  if (!form.code.trim()) failures.push('Código requerido.');
  if (!form.name.trim()) failures.push('Nombre requerido.');
  if (!form.resultCode.trim()) failures.push('Resultado oficial requerido.');
  if (kind === 'metric' && !form.sourceContract.trim()) failures.push('Contrato de fuente requerido.');
  if (['metric', 'survey', 'assurance', 'loss'].includes(kind)) {
    const numerator = Number(form.numerator);
    const denominator = Number(form.denominator);
    if (!Number.isFinite(numerator)) failures.push('Numerador debe ser numérico.');
    if (!Number.isFinite(denominator) || denominator <= 0) failures.push('Denominador debe ser mayor a cero.');
  }
  if (kind === 'loss' && Number(form.numerator) < Number(form.denominator)) failures.push('Recuperación no puede superar pérdida bruta.');
  if (['metric', 'assurance'].includes(kind) && !isUuid(currentUserId)) failures.push('Sesión de usuario requerida para propietario y revisor.');
  return failures;
}

function formulaExpression() {
  return {
    op: 'percentage',
    args: [
      { op: 'input', name: 'numerator' },
      { op: 'input', name: 'denominator' },
    ],
  };
}

function officialPreviewPayload(kind: BuilderKind, form: BuilderForm) {
  const numerator = Number(form.numerator);
  const denominator = Number(form.denominator);
  const common = {
    period: { start: form.periodStart, end: form.periodEnd, timezone: 'America/Santiago' },
    warnings: [],
    source: { status: 'preview', source_contract: form.sourceContract },
  };
  if (kind === 'survey') return { ...common, items: [{ score: numerator, maxScore: denominator, weight: 1, dimension: form.dimension, section: 'general' }], validInvitations: denominator, completedResponses: numerator, started: denominator, completed: numerator };
  if (kind === 'assurance') return { ...common, results: [{ result: numerator / denominator >= 0.8 ? 'pass' : 'pass_with_observations', weight: 1 }], populationSize: denominator, confidence: 0.95, marginError: 0.05 };
  if (kind === 'loss') return { ...common, grossLoss: numerator, recoveries: denominator, expectedFrequency: 2, meanSeverity: Math.max(1, numerator - denominator), events: [{ grossLoss: numerator, recoveries: denominator, currency: 'CLP' }] };
  return { ...common, value: denominator > 0 ? (numerator / denominator) * 100 : null, inputs: { numerator, denominator }, include_trend: true };
}

function previewValue(kind: BuilderKind, form: BuilderForm) {
  const numerator = Number(form.numerator);
  const denominator = Number(form.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  if (kind === 'loss') return Math.max(0, numerator - denominator);
  return (numerator / denominator) * 100;
}

function createPayload(kind: BuilderKind, form: BuilderForm) {
  const code = form.code.trim();
  const name = form.name.trim();
  const currentUserId = getUserIdFromToken();
  if (['metric', 'assurance'].includes(kind) && !isUuid(currentUserId)) {
    throw new ApiClientError('USER_REQUIRED', 'Sesión de usuario requerida para propietario y revisor.', 401);
  }
  if (kind === 'metric') {
    return {
      metric_code: code,
      display_name: name,
      business_definition: `Métrica gobernada ${name}`,
      technical_definition: `Resultado oficial ${form.resultCode} con contrato de fuente ${form.sourceContract}`,
      metric_type: form.type,
      unit: form.unit,
      direction: 'higher_is_better',
      aggregation: 'latest',
      frequency: form.frequency,
      status: 'draft',
      owner_user_id: currentUserId,
      reviewer_user_id: currentUserId,
      metadata: {
        source_contract: form.sourceContract,
        result_code: form.resultCode,
        dimensions: [form.dimension],
        thresholds: { warning: Number(form.thresholdWarning), critical: Number(form.thresholdCritical) },
      },
    };
  }
  if (kind === 'dashboard') {
    return {
      dashboard_key: code,
      display_name: name,
      description: `Dashboard operacional con resultado oficial ${form.resultCode}`,
      dashboard_type: form.type,
      layout_config: { columns: 12, responsive: true },
      filter_config: { period: { start: form.periodStart, end: form.periodEnd }, dimensions: [form.dimension] },
      status: 'draft',
      widgets: [{
        widget_key: `${code}_widget_1`,
        display_name: name,
        widget_type: 'kpi_card',
        data_source_type: 'metric',
        data_source_ref: form.resultCode,
        position_row: 1,
        position_col: 1,
        width: 4,
        height: 2,
        config: { result_code: form.resultCode, trend: true, comparison: true, dimension: form.dimension },
      }],
      metadata: { builder: 'phase5_5_operational_builder' },
    };
  }
  if (kind === 'report') {
    return {
      report_key: code,
      display_name: name,
      report_type: form.type,
      classification: 'internal',
      filter_config: { period: { start: form.periodStart, end: form.periodEnd }, dimensions: [form.dimension] },
      section_config: [{ section_key: 'official_result', title: name, result_code: form.resultCode, chart_type: 'kpi_table' }],
      recipient_config: [],
      approval_required: true,
      status: 'draft',
      metadata: { builder: 'phase5_5_operational_builder' },
    };
  }
  if (kind === 'survey') {
    return {
      survey_key: code,
      display_name: name,
      survey_type: form.type,
      description: `Encuesta operacional ${name}`,
      status: 'draft',
      metadata: { result_code: form.resultCode, dimension: form.dimension },
    };
  }
  const effectiveOccurredAt = () => {
    const end = new Date(form.periodEnd).getTime();
    const now = Date.now();
    if (!Number.isFinite(end)) return new Date(now).toISOString();
    return new Date(Math.min(end, now)).toISOString();
  };
  if (kind === 'assurance') {
    return {
      test_code: code,
      display_name: name,
      test_type: form.type,
      objective: `Validar ${name}`,
      procedure: `Muestra ${form.denominator}, resultado esperado ${form.numerator}`,
      target_entity_type: 'control',
      status: 'active',
      owner_user_id: currentUserId,
      reviewer_user_id: currentUserId,
      metadata: { result_code: form.resultCode, sample_method: 'risk_based' },
    };
  }
  return {
    event_code: code,
    event_type: form.type,
    occurred_at: effectiveOccurredAt(),
    cause: `Evento registrado desde ${name}`,
    impact_description: `Pérdida operacional ${name}`,
    gross_loss: Number(form.numerator),
    recoveries: Number(form.denominator),
    currency: 'CLP',
    status: 'draft',
    metadata: { result_code: form.resultCode, dimension: form.dimension },
  };
}

export default function OperationalBuilder({ kind, title, description, domain, defaultResultCode, testId }: OperationalBuilderProps) {
  const testKey = testId || kind;
  const [form, setForm] = useState<BuilderForm>(() => ({
    ...DEFAULT_FORM,
    type: defaultType(kind),
    resultCode: defaultResultCode || DEFAULT_FORM.resultCode,
    code: `${codePrefix(kind)}_${Date.now()}`,
    name: `${title} QA`,
    numerator: kind === 'loss' ? '1000' : DEFAULT_FORM.numerator,
    denominator: kind === 'loss' ? '100' : DEFAULT_FORM.denominator,
    unit: kind === 'loss' ? 'CLP' : DEFAULT_FORM.unit,
  }));
  const [catalog, setCatalog] = useState<OfficialResult[]>([]);
  const [history, setHistory] = useState<Entity[]>([]);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [secondaryEntity, setSecondaryEntity] = useState<Entity | null>(null);
  const [preview, setPreview] = useState<Entity | null>(null);
  const [result, setResult] = useState<Entity | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [log, setLog] = useState<OperationLog[]>([]);
  const [busy, setBusy] = useState(false);

  const visibleCatalog = useMemo(() => catalog.filter((item) => !domain || item.domain === domain), [catalog, domain]);
  const isReportBuilder = kind === 'report';
  const selectedDefinition = visibleCatalog.find((item) => selectedResultCode(item) === form.resultCode);
  const hasReportSource = !isReportBuilder || Boolean(selectedDefinition);
  const typeOptions = isReportBuilder
    ? ['executive_grc', 'audit', 'compliance', 'risks', 'actions', 'data_quality', 'custom']
    : ['kpi', 'kri', 'kci', 'kqi', 'operational', 'custom', 'supplier_assessment', 'effectiveness_test'];

  const pushLog = (step: string, status: OperationLog['status'], message: string) => {
    setLog((items) => [{ step, status, message, at: new Date().toLocaleString('es-CL') }, ...items].slice(0, 12));
  };

  const patch = (key: keyof BuilderForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const loadHistory = async () => {
    const payload = await apiRequestJsonSingleFlight(listEndpoint(kind), { fallbackMessage: `No fue posible cargar historial de ${title}.` });
    const rows = dataOf<Entity[]>(payload);
    setHistory(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    let cancelled = false;
    apiRequestJsonSingleFlight<{ data?: OfficialResult[] }>('/api/grc/official/analytics/catalog', { fallbackMessage: 'No fue posible cargar resultados oficiales.' })
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setCatalog(rows);
        const first = rows.find((item) => !domain || item.domain === domain);
        if (first && !defaultResultCode) patch('resultCode', first.result_code || first.analytical_result_code || form.resultCode);
      })
      .catch((error) => pushLog('catalog', 'failed', error instanceof Error ? error.message : 'Catálogo no disponible.'));
    loadHistory().catch((error) => pushLog('history', 'failed', error instanceof Error ? error.message : 'Historial no disponible.'));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, domain, defaultResultCode]);

  const runStep = async (step: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const value = await action();
      pushLog(step, 'completed', 'Operación completada.');
      return value;
    } catch (error) {
      const message = error instanceof ApiClientError || error instanceof Error ? error.message : 'Operación fallida.';
      pushLog(step, 'failed', message);
      setErrors([message]);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const validateForm = () => {
    const failures = validate(kind, form, getUserIdFromToken());
    if (isReportBuilder) {
      const codeIndex = failures.indexOf('Código requerido.');
      if (codeIndex >= 0) failures.splice(codeIndex, 1);
      if (!selectedDefinition) failures.push('No hay un resultado oficial disponible para este informe.');
    }
    setErrors(failures);
    pushLog('validación', failures.length ? 'failed' : 'completed', failures.length ? failures.join(' ') : 'Configuración válida.');
    return failures.length === 0;
  };

  const previewConfig = async () => {
    if (!validateForm()) return;
    if (isReportBuilder) {
      setPreview({
        status: 'configuration_reviewed',
        report_key: form.code,
        result_code: form.resultCode,
        format: form.format,
        period: { start: form.periodStart, end: form.periodEnd },
      });
      pushLog('revisión', 'completed', 'Configuración revisada en cliente. La vista previa de definición no existe como endpoint backend.');
      return;
    }
    const payload = await runStep('preview', () => apiRequestJson(`/api/grc/official/analytics/${encodeURIComponent(form.resultCode)}`, {
      method: 'POST',
      body: JSON.stringify(officialPreviewPayload(kind, form)),
      fallbackMessage: 'Vista previa oficial no disponible.',
    }));
    const data = dataOf<Entity>(payload);
    if (data?.value === null || data?.value === undefined) {
      const value = previewValue(kind, form);
      setPreview({ ...data, value, source_status: data?.source_status || 'preview', warnings: [...((data?.warnings as unknown[]) || []), 'preview_uses_form_inputs_until_official_run_exists'] });
      return;
    }
    setPreview(data);
  };

  const saveDraft = async () => {
    if (!validateForm()) return;
    const saved = dataOf<Entity>(await runStep('guardar', () => apiRequestJson(listEndpoint(kind), {
      method: 'POST',
      body: JSON.stringify(createPayload(kind, form)),
      fallbackMessage: 'No fue posible persistir la configuración.',
    })));
    setEntity(saved);
    if (kind === 'metric' && saved.id) {
      const formula = dataOf<Entity>(await runStep('fórmula', () => apiRequestJson(`/api/metrics/${saved.id}/formulas`, {
        method: 'POST',
        body: JSON.stringify({
          expression: formulaExpression(),
          inputs: [{ name: 'numerator', unit: form.unit }, { name: 'denominator', unit: form.unit }],
          status: 'draft',
          metadata: { result_code: form.resultCode, source_contract: form.sourceContract, thresholds: { warning: form.thresholdWarning, critical: form.thresholdCritical } },
        }),
        fallbackMessage: 'No fue posible guardar la fórmula.',
      })));
      setSecondaryEntity(formula);
    }
    if (kind === 'survey' && saved.id) {
      const version = dataOf<Entity>(await runStep('versión encuesta', () => apiRequestJson(`/api/surveys/${saved.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          scoring_definition: { result_code: form.resultCode, max_score: Number(form.denominator), weights: { [form.dimension]: 1 } },
          branching_definition: { allow_not_applicable: true },
          sections: [{
            section_key: 'general',
            title: 'General',
            questions: [{
              question_key: 'q_score',
              question_text: 'Puntaje operacional',
              question_type: 'number',
              required: true,
              allow_not_applicable: true,
              weight: 1,
              scoring_definition: { max_score: Number(form.denominator), dimension: form.dimension },
            }],
          }],
        }),
        fallbackMessage: 'No fue posible crear versión de encuesta.',
      })));
      setSecondaryEntity(version);
    }
    await loadHistory();
  };

  const publish = async () => {
    if (!entity?.id) return setErrors(['Primero guarda un draft.']);
    const endpoint = kind === 'metric' ? `/api/metrics/${entity.id}/publish`
      : kind === 'dashboard' ? `/api/dashboards/${entity.id}/publish`
        : kind === 'survey' ? `/api/surveys/${entity.id}/publish`
          : null;
    if (!endpoint) return pushLog('publicación', 'pending', 'Este flujo usa revisión/aprobación en la etapa de ejecución.');
    const published = dataOf<Entity>(await runStep('publicar', () => apiRequestJson(endpoint, { method: 'POST', body: JSON.stringify({}), fallbackMessage: 'No fue posible publicar.' })));
    setEntity(published);
    await loadHistory();
  };

  const execute = async () => {
    let targetEntity = entity;
    if (isReportBuilder && !targetEntity?.id) {
      if (!validateForm()) return;
      targetEntity = dataOf<Entity>(await runStep('guardar configuración', () => apiRequestJson(listEndpoint(kind), {
        method: 'POST',
        body: JSON.stringify(createPayload(kind, form)),
        fallbackMessage: 'No fue posible preparar el informe.',
      })));
      setEntity(targetEntity);
      await loadHistory();
    }
    if (!targetEntity?.id) return setErrors(['Primero guarda un draft.']);
    let endpoint = '';
    let payload: Record<string, unknown> = {};
    if (kind === 'metric') {
      const metricCode = officialMetricCode(selectedDefinition, form.resultCode);
      endpoint = `/api/metrics/official/${encodeURIComponent(metricCode)}/calculate`;
      payload = {
        period: { start: form.periodStart, end: form.periodEnd, timezone: 'America/Santiago' },
        inputs: { numerator: Number(form.numerator), denominator: Number(form.denominator) },
        unit: form.unit,
        metadata: { builder_entity_id: targetEntity.id, result_code: form.resultCode, source_contract: form.sourceContract },
      };
    } else if (kind === 'dashboard') {
      endpoint = `/api/dashboards/${targetEntity.id}/snapshot`;
    } else if (kind === 'report') {
      endpoint = `/api/reports/${targetEntity.id}/generate`;
      payload = { format: form.format, result_codes: [form.resultCode], period: { start: form.periodStart, end: form.periodEnd } };
    } else if (kind === 'survey') {
      endpoint = '/api/survey-campaigns';
      payload = { survey_definition_id: targetEntity.id, campaign_key: `${form.code}_campaign`, display_name: `${form.name} campaña`, status: 'draft', target_population: { expected: Number(form.denominator) } };
    } else if (kind === 'assurance') {
      endpoint = `/api/assurance-tests/${targetEntity.id}/execute`;
      payload = { execution_code: `${form.code}_exec`, population_description: `Población ${form.denominator}`, sample_method: 'risk_based', metadata: { sample_size: Number(form.numerator) } };
    } else {
      endpoint = `/api/loss-events/${targetEntity.id}/confirm`;
    }
    const executed = dataOf<Entity>(await runStep(isReportBuilder ? 'generar informe' : 'ejecutar', () => apiRequestJson(endpoint, { method: 'POST', body: JSON.stringify(payload), fallbackMessage: isReportBuilder ? 'No fue posible generar el informe.' : 'No fue posible ejecutar.' })));
    setResult(executed);
    if (kind === 'assurance' && executed.id) {
      await runStep('cerrar assurance', () => apiRequestJson(`/api/assurance-tests/executions/${executed.id}/complete`, { method: 'POST', body: JSON.stringify({ result: 'pass_with_observations', conclusion: 'Resultado registrado desde builder operacional.' }) }));
      await runStep('revisar assurance', () => apiRequestJson(`/api/assurance-tests/executions/${executed.id}/review`, { method: 'POST', body: JSON.stringify({ status: 'reviewed' }) }));
    }
    await loadHistory();
  };

  const downloadReportOutput = async () => {
    const href = reportDownloadHref(result);
    if (!href) {
      setErrors(['Genera el reporte antes de descargar la salida.']);
      return;
    }
    await runStep('descarga', async () => {
      const { headers } = buildTenantHeaders();
      const requestHeaders = new Headers(headers);
      requestHeaders.delete('Content-Type');
      const response = await fetch(`${getApiBaseUrl()}${href}`, { headers: requestHeaders });
      if (!response.ok) throw new ApiClientError(`HTTP_${response.status}`, 'No fue posible descargar la salida del reporte.', response.status);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${safeDownloadName(form.name)}.${form.format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      return true;
    });
  };

  const runId = (preview?.calculation_run_id || result?.calculation_run_id || (result?.generation as Entity | undefined)?.id) as string | undefined;

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" data-operational-builder={kind} data-testid={`operational-builder-${testKey}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">{isReportBuilder ? 'Flujo guiado' : 'Constructor operacional'}</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
        </div>
        <div className="rounded-md border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-3 py-2 text-xs">
          Capability/RBAC: se valida por backend en cada endpoint.
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      )}

      {isReportBuilder && (
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {[
            ['1', 'Seleccionar contenido', selectedDefinition ? reportContentLabel(selectedDefinition, form.resultCode) : 'Elige una fuente real'],
            ['2', 'Configurar informe', `${shortDate(form.periodStart)} a ${shortDate(form.periodEnd)} · ${form.format.toUpperCase()}`],
            ['3', 'Revisar', preview ? 'Configuración revisada' : 'Pendiente'],
            ['4', 'Generar y descargar', hasGeneratedReportArtifact(result) ? 'Archivo disponible' : 'Pendiente'],
          ].map(([step, label, value]) => (
            <div key={step} className="rounded-md border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-muted)]">Paso {step}</div>
              <div className="mt-1 text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{label}</div>
              <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{value}</div>
            </div>
          ))}
        </div>
      )}

      {isReportBuilder && !hasReportSource && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">No hay resultados disponibles para este informe.</div>
          <p className="mt-1 leading-6">Carga indicadores oficiales o completa datos antes de generar. No se usa información ficticia ni preview simulado.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/indicadores" className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">Ver indicadores</Link>
            <Link href="/datos" className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">Completar datos</Link>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {!isReportBuilder && <label className="text-sm font-semibold">Código
          <input data-testid={`builder-${testKey}-code`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.code} onChange={(event) => patch('code', event.target.value)} />
        </label>}
        {isReportBuilder && <label className="text-sm font-semibold md:col-span-2">Contenido del informe
          <select data-testid={`builder-${testKey}-result`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.resultCode} onChange={(event) => patch('resultCode', event.target.value)}>
            {visibleCatalog.map((item) => {
              const code = selectedResultCode(item);
              return <option key={code} value={code}>{reportContentLabel(item, code)}</option>;
            })}
            {!visibleCatalog.length && <option value={form.resultCode}>Sin resultados disponibles</option>}
          </select>
        </label>}
        <label className="text-sm font-semibold">{isReportBuilder ? 'Nombre del informe' : 'Nombre'}
          <input data-testid={`builder-${testKey}-name`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.name} onChange={(event) => patch('name', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">{isReportBuilder ? 'Tipo de informe' : 'Tipo'}
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.type} onChange={(event) => patch('type', event.target.value)}>
            {typeOptions.map((option) => <option key={option} value={option}>{presentationOptionLabel(option)}</option>)}
          </select>
        </label>
        {!isReportBuilder && <label className="text-sm font-semibold">Resultado oficial
          <select data-testid={`builder-${testKey}-result`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.resultCode} onChange={(event) => patch('resultCode', event.target.value)}>
            {visibleCatalog.map((item) => {
              const code = item.result_code || item.analytical_result_code || '';
              return <option key={code} value={code}>{item.display_name || code}</option>;
            })}
            {!visibleCatalog.length && <option value={form.resultCode}>{form.resultCode}</option>}
          </select>
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Contrato de fuente
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.sourceContract} onChange={(event) => patch('sourceContract', event.target.value)} />
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Unidad
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.unit} onChange={(event) => patch('unit', event.target.value)} />
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Frecuencia
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.frequency} onChange={(event) => patch('frequency', event.target.value)}>
            {['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on_demand'].map((option) => <option key={option} value={option}>{presentationOptionLabel(option)}</option>)}
          </select>
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Dimensión
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.dimension} onChange={(event) => patch('dimension', event.target.value)} />
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Valor / muestra
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.numerator} onChange={(event) => patch('numerator', event.target.value)} />
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Base / recuperación
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.denominator} onChange={(event) => patch('denominator', event.target.value)} />
        </label>}
        {!isReportBuilder && <label className="text-sm font-semibold">Threshold warning
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.thresholdWarning} onChange={(event) => patch('thresholdWarning', event.target.value)} />
        </label>}
        {isReportBuilder && <label className="text-sm font-semibold">Formato
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.format} onChange={(event) => patch('format', event.target.value as BuilderForm['format'])}>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>}
        {isReportBuilder && <label className="text-sm font-semibold">Desde
          <input type="date" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={shortDate(form.periodStart)} onChange={(event) => patch('periodStart', `${event.target.value}T00:00:00.000Z`)} />
        </label>}
        {isReportBuilder && <label className="text-sm font-semibold">Hasta
          <input type="date" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={shortDate(form.periodEnd)} onChange={(event) => patch('periodEnd', `${event.target.value}T23:59:59.999Z`)} />
        </label>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isReportBuilder && <button type="button" data-testid={`builder-${testKey}-validate`} disabled={busy} onClick={validateForm} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">Validar</button>}
        <button type="button" data-testid={`builder-${testKey}-preview`} disabled={busy} onClick={previewConfig} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">{isReportBuilder ? 'Revisar configuración' : 'Previsualizar'}</button>
        <button type="button" data-testid={`builder-${testKey}-save`} disabled={busy} onClick={saveDraft} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">{isReportBuilder ? 'Guardar configuración' : 'Guardar draft'}</button>
        {!isReportBuilder && <button type="button" data-testid={`builder-${testKey}-publish`} disabled={busy || !entity?.id} onClick={publish} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">Publicar / aprobar</button>}
        <button type="button" data-testid={`builder-${testKey}-execute`} disabled={busy || (!isReportBuilder && !entity?.id)} onClick={execute} className="rounded-md bg-[var(--tcdx-color-action-primary)] px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300 disabled:text-slate-700">{isReportBuilder ? 'Generar informe' : 'Ejecutar'}</button>
        {isReportBuilder && <Link href="/reportes/generaciones" className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface)]">Ver informes generados</Link>}
        <button type="button" disabled={busy} onClick={() => loadHistory()} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-500">{isReportBuilder ? 'Actualizar historial' : 'Actualizar historial'}</button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">{isReportBuilder ? 'Revisión del informe' : 'Resultado / vista previa'}</div>
          {isReportBuilder && !result && (
            <p className="mt-2 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">
              Todavía no has generado este informe.
            </p>
          )}
          <dl className="mt-2 space-y-1 text-xs text-[var(--tcdx-color-text-secondary)]">
            {!isReportBuilder && <div className="flex justify-between gap-3"><dt>Entidad</dt><dd data-testid={`builder-${testKey}-entity`} className="text-right">{compact(entity?.id)}</dd></div>}
            {!isReportBuilder && <div className="flex justify-between gap-3"><dt>Secundario</dt><dd className="text-right">{compact(secondaryEntity?.id)}</dd></div>}
            <div className="flex justify-between gap-3"><dt>{isReportBuilder ? 'Estado' : 'Valor'}</dt><dd data-testid={`builder-${testKey}-value`} className="text-right">{isReportBuilder ? presentationLabel(reportStatus(result, preview)) : compact(preview?.value ?? result?.value ?? (result?.measurement as Entity | undefined)?.value_numeric)}</dd></div>
            {isReportBuilder ? (
              <>
                <div className="flex justify-between gap-3"><dt>Contenido</dt><dd className="text-right">{compact(reportContentLabel(selectedDefinition, form.resultCode))}</dd></div>
                <div className="flex justify-between gap-3"><dt>Periodo</dt><dd className="text-right">{shortDate(form.periodStart)} a {shortDate(form.periodEnd)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Formato</dt><dd className="text-right">{form.format.toUpperCase()}</dd></div>
                <div className="flex justify-between gap-3"><dt>Disponibilidad</dt><dd className="text-right">{availabilityLabel(selectedDefinition)}</dd></div>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3"><dt>Fórmula</dt><dd className="text-right">{compact(selectedDefinition?.formula_code || preview?.formula_code || (preview?.formula as Entity | undefined)?.code)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Versión</dt><dd className="text-right">{compact(selectedDefinition?.formula_version || (preview?.formula as Entity | undefined)?.version)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Fuente</dt><dd className="text-right">{presentationLabel(preview?.source_status || selectedDefinition?.source_status, compact(preview?.source_status || selectedDefinition?.source_status))}</dd></div>
                <div className="flex justify-between gap-3"><dt>Confianza</dt><dd className="text-right">{presentationLabel((preview?.trust as Entity | undefined)?.status || selectedDefinition?.source_status, compact((preview?.trust as Entity | undefined)?.status || selectedDefinition?.source_status))}</dd></div>
              </>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--tcdx-color-primary)]">
            {(preview?.explanation_url as string | undefined) && <Link href={preview?.explanation_url as string}>Explicación</Link>}
            {(preview?.lineage_url as string | undefined) && <Link href={preview?.lineage_url as string}>Lineage</Link>}
            {isReportBuilder && hasGeneratedReportArtifact(result) ? (
              <button type="button" onClick={downloadReportOutput} className="font-semibold text-[var(--tcdx-color-primary)]">
                Descargar
              </button>
            ) : null}
            {isReportBuilder && hasGeneratedReportArtifact(result) && <Link href="/reportes/generaciones">Ver informe generado</Link>}
            {!isReportBuilder && runId && <span>Run {String(runId).slice(0, 8)}</span>}
          </div>
        </article>
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">{isReportBuilder ? 'Configuraciones guardadas' : 'Historial'}</div>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs" tabIndex={0} aria-label="Historial de operaciones">
            {history.slice(0, 8).map((item, index) => <div key={String(item.id || index)} className="rounded border border-[var(--tcdx-color-border)] p-2">{isReportBuilder ? reportHistoryLabel(item) : compact(item.display_name || item.metric_code || item.dashboard_key || item.report_key || item.survey_key || item.test_code || item.event_code || item.generation_key || item.id)}</div>)}
            {!history.length && <div className="text-[var(--tcdx-color-text-secondary)]">Sin historial cargado.</div>}
          </div>
        </article>
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">Bitácora</div>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs" tabIndex={0} aria-label="Bitácora de operaciones">
            {log.map((item) => <div key={`${item.at}-${item.step}`} className="rounded border border-[var(--tcdx-color-border)] p-2"><span className="font-semibold">{item.step}</span> · {presentationLabel(item.status)}<br />{item.message}</div>)}
            {!log.length && <div className="text-[var(--tcdx-color-text-secondary)]">Sin operaciones ejecutadas.</div>}
          </div>
        </article>
      </div>
    </section>
  );
}
