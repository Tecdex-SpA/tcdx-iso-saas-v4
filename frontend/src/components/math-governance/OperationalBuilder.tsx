'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, apiRequestJson, apiRequestJsonSingleFlight, isUuid } from '@/utils/apiClient';
import { getUserIdFromToken } from '@/utils/auth';

type BuilderKind = 'metric' | 'dashboard' | 'report' | 'survey' | 'assurance' | 'loss';

type OfficialResult = {
  result_code?: string;
  analytical_result_code?: string;
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
  periodStart: '2026-01-01T00:00:00.000Z',
  periodEnd: '2026-01-31T23:59:59.000Z',
  dimension: 'general',
  format: 'pdf',
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
  if (kind === 'metric' && !form.sourceContract.trim()) failures.push('Source contract requerido.');
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
  return { ...common, inputs: { numerator, denominator }, include_trend: true };
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
      technical_definition: `Resultado oficial ${form.resultCode} con source contract ${form.sourceContract}`,
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
    occurred_at: form.periodEnd,
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
    setErrors(failures);
    pushLog('validación', failures.length ? 'failed' : 'completed', failures.length ? failures.join(' ') : 'Configuración válida.');
    return failures.length === 0;
  };

  const previewConfig = async () => {
    if (!validateForm()) return;
    const payload = await runStep('preview', () => apiRequestJson(`/api/grc/official/analytics/${encodeURIComponent(form.resultCode)}`, {
      method: 'POST',
      body: JSON.stringify(officialPreviewPayload(kind, form)),
      fallbackMessage: 'Preview oficial no disponible.',
    }));
    setPreview(dataOf<Entity>(payload));
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
    if (!entity?.id) return setErrors(['Primero guarda un draft.']);
    let endpoint = '';
    let payload: Record<string, unknown> = {};
    if (kind === 'metric') {
      endpoint = `/api/metrics/${entity.id}/calculate`;
      payload = { period_start: form.periodStart, period_end: form.periodEnd, inputs: { numerator: Number(form.numerator), denominator: Number(form.denominator) }, unit: form.unit };
    } else if (kind === 'dashboard') {
      endpoint = `/api/dashboards/${entity.id}/snapshot`;
    } else if (kind === 'report') {
      endpoint = `/api/reports/${entity.id}/generate`;
      payload = { format: form.format, result_codes: [form.resultCode], period: { start: form.periodStart, end: form.periodEnd } };
    } else if (kind === 'survey') {
      endpoint = '/api/survey-campaigns';
      payload = { survey_definition_id: entity.id, campaign_key: `${form.code}_campaign`, display_name: `${form.name} campaña`, status: 'draft', target_population: { expected: Number(form.denominator) } };
    } else if (kind === 'assurance') {
      endpoint = `/api/assurance-tests/${entity.id}/execute`;
      payload = { execution_code: `${form.code}_exec`, population_description: `Población ${form.denominator}`, sample_method: 'risk_based', metadata: { sample_size: Number(form.numerator) } };
    } else {
      endpoint = `/api/loss-events/${entity.id}/confirm`;
    }
    const executed = dataOf<Entity>(await runStep('ejecutar', () => apiRequestJson(endpoint, { method: 'POST', body: JSON.stringify(payload), fallbackMessage: 'No fue posible ejecutar.' })));
    setResult(executed);
    if (kind === 'report' && (executed.generation as Entity | undefined)?.id) {
      await runStep('aprobar reporte', () => apiRequestJson(`/api/report-generations/${(executed.generation as Entity).id}/approve`, { method: 'POST', body: JSON.stringify({ approval_status: 'approved', comment: 'Aprobado desde builder operacional.' }) }));
    }
    if (kind === 'assurance' && executed.id) {
      await runStep('cerrar assurance', () => apiRequestJson(`/api/assurance-tests/executions/${executed.id}/complete`, { method: 'POST', body: JSON.stringify({ result: 'pass_with_observations', conclusion: 'Resultado registrado desde builder operacional.' }) }));
      await runStep('revisar assurance', () => apiRequestJson(`/api/assurance-tests/executions/${executed.id}/review`, { method: 'POST', body: JSON.stringify({ status: 'reviewed' }) }));
    }
    await loadHistory();
  };

  const selectedDefinition = visibleCatalog.find((item) => (item.result_code || item.analytical_result_code) === form.resultCode);
  const runId = (preview?.calculation_run_id || result?.calculation_run_id || (result?.generation as Entity | undefined)?.id) as string | undefined;

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" data-operational-builder={kind} data-testid={`operational-builder-${testKey}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Constructor operacional</p>
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">Código
          <input data-testid={`builder-${testKey}-code`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.code} onChange={(event) => patch('code', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Nombre
          <input data-testid={`builder-${testKey}-name`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.name} onChange={(event) => patch('name', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Tipo
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.type} onChange={(event) => patch('type', event.target.value)}>
            {['kpi', 'kri', 'kci', 'kqi', 'operational', 'custom', 'supplier_assessment', 'effectiveness_test'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Resultado oficial
          <select data-testid={`builder-${testKey}-result`} className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.resultCode} onChange={(event) => patch('resultCode', event.target.value)}>
            {visibleCatalog.map((item) => {
              const code = item.result_code || item.analytical_result_code || '';
              return <option key={code} value={code}>{item.display_name || code}</option>;
            })}
            {!visibleCatalog.length && <option value={form.resultCode}>{form.resultCode}</option>}
          </select>
        </label>
        <label className="text-sm font-semibold">Source contract
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.sourceContract} onChange={(event) => patch('sourceContract', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Unidad
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.unit} onChange={(event) => patch('unit', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Frecuencia
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.frequency} onChange={(event) => patch('frequency', event.target.value)}>
            {['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on_demand'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Dimensión
          <input className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.dimension} onChange={(event) => patch('dimension', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Valor / muestra
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.numerator} onChange={(event) => patch('numerator', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Base / recuperación
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.denominator} onChange={(event) => patch('denominator', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Threshold warning
          <input type="number" className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.thresholdWarning} onChange={(event) => patch('thresholdWarning', event.target.value)} />
        </label>
        <label className="text-sm font-semibold">Formato reporte
          <select className="mt-1 w-full rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 font-normal" value={form.format} onChange={(event) => patch('format', event.target.value as BuilderForm['format'])}>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" data-testid={`builder-${testKey}-validate`} disabled={busy} onClick={validateForm} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Validar</button>
        <button type="button" data-testid={`builder-${testKey}-preview`} disabled={busy} onClick={previewConfig} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Preview oficial</button>
        <button type="button" data-testid={`builder-${testKey}-save`} disabled={busy} onClick={saveDraft} className="rounded-md bg-[var(--tcdx-color-action-primary)] px-3 py-2 text-sm font-semibold text-white">Guardar draft</button>
        <button type="button" data-testid={`builder-${testKey}-publish`} disabled={busy || !entity?.id} onClick={publish} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Publicar / aprobar</button>
        <button type="button" data-testid={`builder-${testKey}-execute`} disabled={busy || !entity?.id} onClick={execute} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Ejecutar</button>
        <button type="button" disabled={busy} onClick={() => loadHistory()} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Actualizar historial</button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">Resultado / preview</div>
          <dl className="mt-2 space-y-1 text-xs text-[var(--tcdx-color-text-secondary)]">
            <div className="flex justify-between gap-3"><dt>Entidad</dt><dd data-testid={`builder-${testKey}-entity`} className="text-right">{compact(entity?.id)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Secundario</dt><dd className="text-right">{compact(secondaryEntity?.id)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Valor</dt><dd data-testid={`builder-${testKey}-value`} className="text-right">{compact(preview?.value ?? result?.value ?? (result?.measurement as Entity | undefined)?.value_numeric)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Fórmula</dt><dd className="text-right">{compact(selectedDefinition?.formula_code || preview?.formula_code || (preview?.formula as Entity | undefined)?.code)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Versión</dt><dd className="text-right">{compact(selectedDefinition?.formula_version || (preview?.formula as Entity | undefined)?.version)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Fuente</dt><dd className="text-right">{compact(preview?.source_status || selectedDefinition?.source_status)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Confianza</dt><dd className="text-right">{compact((preview?.trust as Entity | undefined)?.status || selectedDefinition?.source_status)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--tcdx-color-primary)]">
            {(preview?.explanation_url as string | undefined) && <Link href={preview?.explanation_url as string}>Explicación</Link>}
            {(preview?.lineage_url as string | undefined) && <Link href={preview?.lineage_url as string}>Lineage</Link>}
            {runId && <span>Run {String(runId).slice(0, 8)}</span>}
          </div>
        </article>
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">Historial</div>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs" tabIndex={0} aria-label="Historial de operaciones">
            {history.slice(0, 8).map((item, index) => <div key={String(item.id || index)} className="rounded border border-[var(--tcdx-color-border)] p-2">{compact(item.display_name || item.metric_code || item.dashboard_key || item.report_key || item.survey_key || item.test_code || item.event_code || item.generation_key || item.id)}</div>)}
            {!history.length && <div className="text-[var(--tcdx-color-text-secondary)]">Sin historial cargado.</div>}
          </div>
        </article>
        <article className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
          <div className="font-semibold">Bitácora</div>
          <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs" tabIndex={0} aria-label="Bitácora de operaciones">
            {log.map((item) => <div key={`${item.at}-${item.step}`} className="rounded border border-[var(--tcdx-color-border)] p-2"><span className="font-semibold">{item.step}</span> · {item.status}<br />{item.message}</div>)}
            {!log.length && <div className="text-[var(--tcdx-color-text-secondary)]">Sin operaciones ejecutadas.</div>}
          </div>
        </article>
      </div>
    </section>
  );
}
