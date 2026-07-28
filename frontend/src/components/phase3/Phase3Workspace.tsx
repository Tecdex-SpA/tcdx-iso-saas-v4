'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Phase3Nav from './Phase3Nav';
import {
  Phase3Entity360,
  Phase3Meta,
  Phase3Record,
  phase3Mutation,
  phase3Request,
} from './phase3Api';

type ViewKey =
  | 'operations'
  | 'organizations'
  | 'processes'
  | 'services'
  | 'bia'
  | 'continuity'
  | 'continuity_tests'
  | 'crisis'
  | 'metrics'
  | 'quantitative_risks';

type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'select';
  options?: { value: string; label: string }[];
};

type ViewConfig = {
  title: string;
  description: string;
  endpoint: string;
  detailBase?: string;
  readPermission: string;
  managePermission?: string;
  entityType?: string;
  fields?: Field[];
  columns?: string[];
  overview?: boolean;
};

const statusOptions = {
  criticality: [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
    { value: 'critical', label: 'Crítica' },
  ],
};

const configs: Record<ViewKey, ViewConfig> = {
  operations: {
    title: 'Operación integrada al GRC',
    description: 'Contexto operacional, brechas activas e impacto trazable en readiness.',
    endpoint: '/operations-overview',
    readPermission: 'operations.dashboard.read',
    overview: true,
  },
  organizations: {
    title: 'Unidades organizacionales',
    description: 'Responsabilidad, jerarquía y exposición GRC por unidad.',
    endpoint: '/organizations',
    detailBase: '/unidades',
    readPermission: 'organizations.read',
    managePermission: 'organizations.manage',
    entityType: 'organization',
    columns: ['code', 'name', 'unit_type', 'status', 'next_review_at'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      {
        key: 'unit_type',
        label: 'Tipo',
        required: true,
        type: 'select',
        options: [
          { value: 'division', label: 'División' },
          { value: 'department', label: 'Departamento' },
          { value: 'area', label: 'Área' },
          { value: 'team', label: 'Equipo' },
          { value: 'location', label: 'Ubicación' },
        ],
      },
      { key: 'location_reference', label: 'Ubicación' },
      { key: 'next_review_at', label: 'Próxima revisión', type: 'datetime-local' },
    ],
  },
  processes: {
    title: 'Procesos',
    description: 'Criticidad, continuidad y cobertura GRC de procesos operacionales.',
    endpoint: '/processes',
    detailBase: '/procesos',
    readPermission: 'processes.read',
    managePermission: 'processes.manage',
    entityType: 'process',
    columns: ['code', 'name', 'process_type', 'criticality_score', 'lifecycle_status'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'process_type', label: 'Tipo', required: true },
      { key: 'objective', label: 'Objetivo', type: 'textarea' },
      { key: 'scope', label: 'Alcance', type: 'textarea' },
      { key: 'organizational_unit_id', label: 'ID de unidad' },
      { key: 'owner_user_id', label: 'ID de responsable' },
      { key: 'criticality_score', label: 'Criticidad calculada', type: 'number', required: true },
      {
        key: 'criticality',
        label: 'Criticidad confirmada',
        type: 'select',
        options: statusOptions.criticality,
      },
      { key: 'review_due_at', label: 'Próxima revisión', type: 'datetime-local' },
    ],
  },
  services: {
    title: 'Servicios operacionales',
    description: 'Niveles mínimos, dependencias y objetivos de recuperación.',
    endpoint: '/services',
    detailBase: '/servicios',
    readPermission: 'services.read',
    managePermission: 'services.manage',
    entityType: 'service',
    columns: ['code', 'name', 'criticality', 'rto_minutes', 'rpo_minutes', 'status'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'organizational_unit_id', label: 'ID de unidad' },
      { key: 'primary_process_id', label: 'ID de proceso principal' },
      { key: 'minimum_service_level', label: 'Nivel mínimo aceptable', required: true },
      { key: 'critical_schedule', label: 'Horario crítico' },
      {
        key: 'criticality',
        label: 'Criticidad',
        required: true,
        type: 'select',
        options: statusOptions.criticality,
      },
      { key: 'rto_minutes', label: 'RTO (minutos)', type: 'number' },
      { key: 'rpo_minutes', label: 'RPO (minutos)', type: 'number' },
      { key: 'mtpd_minutes', label: 'MTPD/MAO (minutos)', type: 'number' },
      { key: 'next_review_at', label: 'Próxima revisión', type: 'datetime-local' },
    ],
  },
  bia: {
    title: 'Análisis de impacto al negocio',
    description: 'Impacto, tolerancias y recursos requeridos para procesos y servicios.',
    endpoint: '/bia',
    detailBase: '/bia',
    readPermission: 'bia.read',
    managePermission: 'bia.manage',
    entityType: 'bia',
    columns: ['code', 'assessment_date', 'mtpd_minutes', 'rto_minutes', 'rpo_minutes', 'status'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'process_id', label: 'ID de proceso' },
      { key: 'service_id', label: 'ID de servicio' },
      { key: 'assessment_date', label: 'Fecha de evaluación', type: 'date' },
      { key: 'assumptions', label: 'Supuestos', type: 'textarea', required: true },
      { key: 'estimated_financial_impact', label: 'Impacto financiero estimado', type: 'number' },
      { key: 'mtpd_minutes', label: 'MTPD/MAO (minutos)', type: 'number', required: true },
      { key: 'rto_minutes', label: 'RTO (minutos)', type: 'number', required: true },
      { key: 'rpo_minutes', label: 'RPO (minutos)', type: 'number', required: true },
      { key: 'minimum_service_level', label: 'Nivel mínimo aceptable' },
      { key: 'required_people', label: 'Personas requeridas', type: 'number' },
      { key: 'alternative_resources', label: 'Recursos alternativos', type: 'textarea' },
      { key: 'next_review_at', label: 'Próxima revisión', type: 'datetime-local', required: true },
    ],
  },
  continuity: {
    title: 'Continuidad operacional',
    description: 'Planes, vigencia, activaciones y cobertura de recuperación.',
    endpoint: '/continuity/plans',
    detailBase: '/continuidad/planes',
    readPermission: 'continuity.read',
    managePermission: 'continuity.manage',
    entityType: 'continuity_plan',
    columns: ['code', 'name', 'status', 'valid_until', 'next_review_at'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'scope', label: 'Alcance', type: 'textarea', required: true },
      { key: 'process_id', label: 'ID de proceso' },
      { key: 'service_id', label: 'ID de servicio' },
      { key: 'bia_id', label: 'ID de BIA' },
      { key: 'activation_criteria', label: 'Criterios de activación', type: 'textarea', required: true },
      { key: 'procedures', label: 'Procedimientos', type: 'textarea', required: true },
      { key: 'recovery_sequence', label: 'Secuencia de recuperación', type: 'textarea', required: true },
      { key: 'communication_plan', label: 'Comunicaciones', type: 'textarea' },
      {
        key: 'return_to_operation_criteria',
        label: 'Criterios de retorno',
        type: 'textarea',
        required: true,
      },
      { key: 'valid_from', label: 'Vigente desde', type: 'date' },
      { key: 'valid_until', label: 'Vigente hasta', type: 'date' },
      { key: 'next_review_at', label: 'Próxima revisión', type: 'datetime-local', required: true },
    ],
  },
  continuity_tests: {
    title: 'Pruebas de continuidad',
    description: 'Ejecución, resultados observados y cumplimiento de RTO/RPO.',
    endpoint: '/continuity/tests',
    detailBase: '/continuidad/pruebas',
    readPermission: 'continuity.read',
    managePermission: 'continuity.tests.manage',
    entityType: 'continuity_test',
    columns: ['test_type', 'scheduled_at', 'status', 'target_rto_minutes', 'observed_rto_minutes'],
    fields: [
      { key: 'plan_id', label: 'ID de plan', required: true },
      {
        key: 'test_type',
        label: 'Tipo',
        required: true,
        type: 'select',
        options: [
          { value: 'tabletop', label: 'Mesa' },
          { value: 'walkthrough', label: 'Recorrido' },
          { value: 'technical_recovery', label: 'Recuperación técnica' },
          { value: 'supplier_test', label: 'Proveedor' },
          { value: 'communication_test', label: 'Comunicaciones' },
          { value: 'partial_simulation', label: 'Simulación parcial' },
          { value: 'full_simulation', label: 'Simulación completa' },
        ],
      },
      { key: 'objective', label: 'Objetivo', type: 'textarea', required: true },
      { key: 'scenario', label: 'Escenario', type: 'textarea', required: true },
      { key: 'scope', label: 'Alcance', type: 'textarea', required: true },
      { key: 'scheduled_at', label: 'Fecha programada', type: 'datetime-local', required: true },
      { key: 'expected_result', label: 'Resultado esperado', type: 'textarea', required: true },
      { key: 'target_rto_minutes', label: 'RTO objetivo', type: 'number' },
      { key: 'target_rpo_minutes', label: 'RPO objetivo', type: 'number' },
    ],
  },
  crisis: {
    title: 'Gestión de crisis',
    description: 'Activaciones, recuperación y decisiones registradas.',
    endpoint: '/crisis',
    detailBase: '/crisis',
    readPermission: 'crisis.read',
    managePermission: 'crisis.manage',
    entityType: 'crisis',
    columns: ['code', 'crisis_level', 'status', 'recovery_status', 'activated_at'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'plan_id', label: 'ID de plan' },
      { key: 'incident_id', label: 'ID de incidente' },
      {
        key: 'crisis_level',
        label: 'Nivel',
        required: true,
        type: 'select',
        options: [
          { value: 'level_1', label: 'Nivel 1' },
          { value: 'level_2', label: 'Nivel 2' },
          { value: 'level_3', label: 'Nivel 3' },
          { value: 'critical', label: 'Crítico' },
        ],
      },
      { key: 'activation_reason', label: 'Motivo de activación', type: 'textarea', required: true },
    ],
  },
  metrics: {
    title: 'Indicadores KPI/KRI',
    description: 'Definiciones, umbrales, mediciones e impacto en operación y GRC.',
    endpoint: '/metrics',
    detailBase: '/indicadores',
    readPermission: 'metrics.read',
    managePermission: 'metrics.manage',
    entityType: 'metric',
    columns: ['code', 'name', 'metric_type', 'entity_type', 'status'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'name', label: 'Nombre', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      {
        key: 'metric_type',
        label: 'Tipo',
        required: true,
        type: 'select',
        options: [
          { value: 'kpi', label: 'KPI' },
          { value: 'kri', label: 'KRI' },
        ],
      },
      {
        key: 'entity_type',
        label: 'Entidad',
        required: true,
        type: 'select',
        options: [
          { value: 'organization', label: 'Unidad' },
          { value: 'process', label: 'Proceso' },
          { value: 'service', label: 'Servicio' },
          { value: 'risk', label: 'Riesgo' },
          { value: 'control', label: 'Control' },
          { value: 'supplier', label: 'Proveedor' },
          { value: 'continuity_plan', label: 'Plan' },
        ],
      },
      { key: 'entity_id', label: 'ID de entidad', required: true },
      { key: 'formula_definition', label: 'Fórmula declarativa', type: 'textarea', required: true },
      { key: 'source_description', label: 'Fuente', required: true },
      { key: 'frequency', label: 'Frecuencia', required: true },
      { key: 'unit', label: 'Unidad de medida', required: true },
      {
        key: 'expected_direction',
        label: 'Dirección esperada',
        required: true,
        type: 'select',
        options: [
          { value: 'higher_is_better', label: 'Mayor es mejor' },
          { value: 'lower_is_better', label: 'Menor es mejor' },
          { value: 'target_range', label: 'Rango objetivo' },
        ],
      },
      { key: 'target_value', label: 'Objetivo', type: 'number', required: true },
      { key: 'warning_threshold', label: 'Umbral advertencia', type: 'number', required: true },
      { key: 'critical_threshold', label: 'Umbral crítico', type: 'number', required: true },
      { key: 'measurement_window', label: 'Ventana de medición', required: true },
    ],
  },
  quantitative_risks: {
    title: 'Riesgo cuantitativo',
    description: 'Exposición anualizada y comparación económica de tratamientos.',
    endpoint: '/quantitative-risks',
    detailBase: '/riesgo-cuantitativo',
    readPermission: 'quantitative_risk.read',
    managePermission: 'quantitative_risk.manage',
    entityType: 'quantitative_risk',
    columns: ['code', 'scenario', 'expected_impact', 'annualized_loss', 'net_expected_benefit', 'status'],
    fields: [
      { key: 'code', label: 'Código', required: true },
      { key: 'risk_id', label: 'ID de riesgo', required: true },
      { key: 'process_id', label: 'ID de proceso' },
      { key: 'service_id', label: 'ID de servicio' },
      { key: 'scenario', label: 'Escenario', type: 'textarea', required: true },
      { key: 'minimum_impact', label: 'Impacto mínimo', type: 'number', required: true },
      { key: 'most_likely_impact', label: 'Impacto más probable', type: 'number', required: true },
      { key: 'maximum_impact', label: 'Impacto máximo', type: 'number', required: true },
      { key: 'estimated_frequency', label: 'Frecuencia anual', type: 'number', required: true },
      { key: 'control_cost', label: 'Costo de control', type: 'number', required: true },
      { key: 'expected_reduction', label: 'Reducción esperada', type: 'number', required: true },
      { key: 'assumptions', label: 'Supuestos', type: 'textarea', required: true },
      { key: 'source_description', label: 'Fuente', required: true },
      { key: 'treatment_comparison', label: 'Comparación de tratamientos', type: 'textarea' },
      { key: 'sensitivity_notes', label: 'Sensibilidad', type: 'textarea' },
    ],
  },
};

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin registro';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('es-CL').format(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(text));
  }
  return text.replaceAll('_', ' ');
}

function editableValue(value: unknown, type?: Field['type']) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (type === 'date') return text.slice(0, 10);
  if (type === 'datetime-local') {
    return text.includes('T') ? text.slice(0, 16) : text;
  }
  return text;
}

function permissionAllowed(meta: Phase3Meta | null, permission?: string) {
  if (!permission || !meta) return false;
  return meta.permissions.platform === true || meta.permissions[permission] === true;
}

function severityClass(severity: string) {
  if (severity === 'critical' || severity === 'high') {
    return 'border-[var(--tcdx-color-danger)] bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-danger)]';
  }
  if (severity === 'medium') {
    return 'border-[var(--tcdx-color-warning)] bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-text-primary)]';
  }
  return 'border-[var(--tcdx-color-info)] bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-text-primary)]';
}

export default function Phase3Workspace({
  view,
  entityId,
}: {
  view: ViewKey;
  entityId?: string;
}) {
  const config = configs[view];
  const [meta, setMeta] = useState<Phase3Meta | null>(null);
  const [records, setRecords] = useState<Phase3Record[]>([]);
  const [detail, setDetail] = useState<Phase3Entity360 | null>(null);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [offset, setOffset] = useState(0);
  const pageSize = 50;
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loadedMeta = await phase3Request<Phase3Meta>('/meta');
      setMeta(loadedMeta);
      if (!loadedMeta.module.is_enabled) {
        throw new Error('La operación integrada al GRC no está habilitada para esta empresa.');
      }
      if (entityId && config.entityType) {
        const endpoint = view === 'metrics'
          ? `/metrics/${encodeURIComponent(entityId)}`
          : `${config.endpoint}/${encodeURIComponent(entityId)}`;
        setDetail(await phase3Request<Phase3Entity360>(endpoint));
      } else if (config.overview) {
        setOverview(await phase3Request<Record<string, unknown>>(config.endpoint));
      } else {
        const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
        if (search) params.set('search', search);
        setRecords(await phase3Request<Phase3Record[]>(
          `${config.endpoint}?${params.toString()}`
        ));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar la vista.');
    } finally {
      setLoading(false);
    }
  }, [config, entityId, offset, search, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = permissionAllowed(meta, config.managePermission);
  const summary = useMemo(() => {
    if (!overview || typeof overview.summary !== 'object' || !overview.summary) return [];
    return Object.entries(overview.summary as Record<string, unknown>);
  }, [overview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [...formData.entries()]
        .filter(([, value]) => String(value).trim() !== '')
        .map(([key, value]) => {
          const field = config.fields?.find(item => item.key === key);
          return [key, field?.type === 'number' ? Number(value) : value];
        })
    );
    try {
      await phase3Mutation(config.endpoint, body);
      event.currentTarget.reset();
      setFormOpen(false);
      setNotice('Registro guardado y propagado al contexto GRC.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar el registro.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="space-y-5">
        <Phase3Nav />
        <div className="h-32 animate-pulse rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-surface-alt)]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-surface-alt)]"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Phase3Nav />

      <header className="flex flex-col gap-4 border-b border-[var(--tcdx-color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--tcdx-color-primary)]">
            Operación y GRC
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">
            {config.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
            {config.description}
          </p>
        </div>
        {!entityId && !config.overview && canManage && (
          <button
            type="button"
            onClick={() => setFormOpen(value => !value)}
            aria-expanded={formOpen}
            className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tcdx-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
          >
            {formOpen ? 'Cerrar formulario' : 'Nuevo registro'}
          </button>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-danger)] bg-[var(--tcdx-color-surface-alt)] p-4 text-sm text-[var(--tcdx-color-danger)]"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-success)] bg-[var(--tcdx-color-surface-alt)] p-4 text-sm text-[var(--tcdx-color-text-primary)]"
        >
          {notice}
        </div>
      )}

      {formOpen && config.fields && (
        <form
          onSubmit={submit}
          className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-card)]"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {config.fields.map(field => (
              <label
                key={field.key}
                className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
              >
                <span className="mb-1.5 block text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
                  {field.label}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    name={field.key}
                    required={field.required}
                    rows={3}
                    className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.key}
                    required={field.required}
                    defaultValue=""
                    className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                  >
                    <option value="">Seleccione</option>
                    {field.options?.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.key}
                    required={field.required}
                    type={field.type || 'text'}
                    step={field.type === 'number' ? 'any' : undefined}
                    className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {config.overview && overview && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map(([key, value]) => (
              <article
                key={key}
                className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-4 shadow-[var(--tcdx-shadow-card)]"
              >
                <p className="text-xs font-semibold text-[var(--tcdx-color-text-secondary)]">
                  {key.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">
                  {valueLabel(value)}
                </p>
              </article>
            ))}
          </div>
          <ImpactPanels
            alerts={(overview.alerts as Phase3Entity360['alerts']) || []}
            impacts={(overview.readiness_impacts as Phase3Entity360['readiness_impacts']) || []}
          />
        </>
      )}

      {!entityId && !config.overview && (
        <>
          <form
            onSubmit={event => {
              event.preventDefault();
              setOffset(0);
              setSearch(searchDraft.trim());
            }}
            className="flex max-w-xl gap-2"
            role="search"
          >
            <label className="sr-only" htmlFor={`phase3-search-${view}`}>Buscar</label>
            <input
              id={`phase3-search-${view}`}
              value={searchDraft}
              onChange={event => setSearchDraft(event.target.value)}
              placeholder="Buscar por código o nombre"
              className="min-h-10 min-w-0 flex-1 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)]"
            >
              Buscar
            </button>
          </form>

          {records.length === 0 ? (
            <div className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-dashed border-[var(--tcdx-border-strong)] bg-white p-10 text-center">
              <p className="font-semibold text-[var(--tcdx-color-text-primary)]">
                No hay registros para los filtros actuales.
              </p>
              <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
                La vista se actualizará cuando exista información operacional registrada.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-text-secondary)]">
                  <tr>
                    {config.columns?.map(column => (
                      <th key={column} scope="col" className="px-4 py-3 font-semibold">
                        {column.replaceAll('_', ' ')}
                      </th>
                    ))}
                    {config.detailBase && <th scope="col" className="px-4 py-3 text-right">Detalle</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr
                      key={record.id}
                      className="border-t border-[var(--tcdx-color-border)] hover:bg-[var(--tcdx-color-surface-alt)]"
                    >
                      {config.columns?.map(column => (
                        <td key={column} className="max-w-xs px-4 py-3 text-[var(--tcdx-color-text-primary)]">
                          <span className="line-clamp-2" title={String(record[column] ?? '')}>
                            {valueLabel(record[column])}
                          </span>
                        </td>
                      ))}
                      {config.detailBase && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`${config.detailBase}/${record.id}`}
                            className="font-semibold text-[var(--tcdx-color-primary)] hover:underline"
                          >
                            Abrir
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(current => Math.max(0, current - pageSize))}
              className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-[var(--tcdx-color-text-secondary)]">
              Página {Math.floor(offset / pageSize) + 1}
            </span>
            <button
              type="button"
              disabled={records.length < pageSize}
              onClick={() => setOffset(current => current + pageSize)}
              className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </nav>
        </>
      )}

      {entityId && detail && (
        <EntityDetail
          detail={detail}
          config={config}
          canManage={canManage}
          permissions={meta?.permissions || {}}
          canRecordMetric={permissionAllowed(meta, 'metrics.record')}
          onReload={load}
        />
      )}
    </section>
  );
}

function ImpactPanels({
  alerts,
  impacts,
}: {
  alerts: Phase3Entity360['alerts'];
  impacts: Phase3Entity360['readiness_impacts'];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
        <h2 className="text-base font-bold text-[var(--tcdx-color-text-primary)]">Alertas activas</h2>
        <div className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-[var(--tcdx-color-text-secondary)]">Sin alertas activas.</p>
          ) : alerts.map(alert => (
            <article
              key={alert.id}
              className={`rounded-[var(--tcdx-radius-tecdex-sm)] border p-3 ${severityClass(alert.severity)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{alert.title}</h3>
                <span className="text-xs font-semibold uppercase">{alert.severity}</span>
              </div>
              <p className="mt-1 text-sm">{alert.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
        <h2 className="text-base font-bold text-[var(--tcdx-color-text-primary)]">Impacto en readiness</h2>
        <div className="mt-4 space-y-3">
          {impacts.length === 0 ? (
            <p className="text-sm text-[var(--tcdx-color-text-secondary)]">Sin cambios de readiness registrados.</p>
          ) : impacts.map(impact => (
            <article
              key={impact.id}
              className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface-alt)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[var(--tcdx-color-text-primary)]">
                  {impact.dimension.replaceAll('_', ' ')}
                </span>
                <span className="font-bold text-[var(--tcdx-color-text-primary)]">
                  {impact.previous_score} → {impact.new_score}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
                {impact.explanation}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EntityDetail({
  detail,
  config, canManage, permissions, canRecordMetric, onReload,
}: {
  detail: Phase3Entity360;
  config: ViewConfig;
  canManage: boolean;
  permissions: Phase3Meta['permissions'];
  onReload: () => Promise<void>;
  canRecordMetric: boolean;
}) {
  const visibleFields = Object.entries(detail.entity).filter(
    ([key, value]) => !['metadata', 'provenance'].includes(key) && value !== null
  );
  return (
    <>
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-card)]">
        <div className="flex flex-col gap-2 border-b border-[var(--tcdx-color-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--tcdx-color-primary)]">
              Vista 360
            </p>
            <h2 className="text-xl font-bold text-[var(--tcdx-color-text-primary)]">
              {detail.entity.name || detail.entity.code || config.title}
            </h2>
          </div>
          <span className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--tcdx-color-text-secondary)]">
            {valueLabel(detail.entity.status || detail.entity.lifecycle_status)}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleFields.slice(0, 24).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs font-semibold text-[var(--tcdx-color-text-secondary)]">
                {key.replaceAll('_', ' ')}
              </dt>
              <dd
                className="mt-1 break-words text-sm text-[var(--tcdx-color-text-primary)]"
                title={String(value)}
              >
                {valueLabel(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>


      {config.entityType && (canManage || canRecordMetric) && (
        <EntityActions
          detail={detail}
          entityType={config.entityType}
          endpoint={config.endpoint}
          fields={config.fields}
          canManage={canManage}
          permissions={permissions}
          canRecordMetric={canRecordMetric}
          onReload={onReload}
        />
      )}
      <ImpactPanels alerts={detail.alerts} impacts={detail.readiness_impacts} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
          <h2 className="font-bold text-[var(--tcdx-color-text-primary)]">Relaciones GRC</h2>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {detail.relations.outgoing.length} salientes · {detail.relations.incoming.length} entrantes
          </p>
          <ul className="mt-4 divide-y divide-[var(--tcdx-color-border)]">
            {[...detail.relations.outgoing, ...detail.relations.incoming].slice(0, 20).map(relation => (
              <li key={relation.id} className="py-3 text-sm text-[var(--tcdx-color-text-primary)]">
                {valueLabel(relation.source_type)} → {valueLabel(relation.target_type)}
                <span className="ml-2 text-[var(--tcdx-color-text-secondary)]">
                  {valueLabel(relation.relation_type)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
            Dependencias operacionales
          </p>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {detail.dependencies.outgoing.length} salientes · {detail.dependencies.incoming.length} entrantes
          </p>
          <ul className="mt-3 divide-y divide-[var(--tcdx-color-border)]">
            {[...detail.dependencies.outgoing, ...detail.dependencies.incoming]
              .slice(0, 20)
              .map(dependency => (
                <li key={dependency.id} className="py-3 text-sm text-[var(--tcdx-color-text-primary)]">
                  {valueLabel(dependency.source_type)} → {valueLabel(dependency.target_type)}
                  <span className="ml-2 text-[var(--tcdx-color-text-secondary)]">
                    {valueLabel(dependency.criticality)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
        <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
          <h2 className="font-bold text-[var(--tcdx-color-text-primary)]">Historial y eventos</h2>
          <ul className="mt-4 divide-y divide-[var(--tcdx-color-border)]">
            {detail.events.slice(0, 20).map(event => (
              <li key={event.id} className="py-3">
                <p className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
                  {valueLabel(event.event_name)}
                </p>
                <p className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">
                  {valueLabel(event.occurred_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {config.entityType === 'bia' && (
        <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
          <h2 className="font-bold text-[var(--tcdx-color-text-primary)]">
            Impacto por dimensión y duración
          </h2>
          {detail.bia_impacts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--tcdx-color-text-secondary)]">
              Sin impactos registrados.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-text-secondary)]">
                  <tr>{['Dimensión', 'Duración', 'Nivel', 'Monto', 'Fundamento'].map(label => <th key={label} className="px-3 py-2">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[var(--tcdx-color-border)]">
                  {detail.bia_impacts.map(impact => (
                    <tr key={impact.id}>
                      {[impact.dimension, `${impact.duration_minutes} min`, impact.impact_level, impact.estimated_amount, impact.rationale].map((value, index) => <td key={index} className="px-3 py-2 text-[var(--tcdx-color-text-primary)]">{valueLabel(value)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

const transitionOptions: Record<string, Record<string, string[]>> = {
  organization: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
    suspended: ['active', 'retired'],
  },
  process: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
  },
  service: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'suspended', 'retired'],
    review_required: ['under_review', 'suspended', 'retired'],
  },
  bia: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['current', 'review_required'],
    current: ['review_required', 'expired', 'superseded'],
    review_required: ['under_review', 'expired', 'superseded'],
  },
  continuity_plan: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['activated', 'review_required', 'expired', 'superseded'],
    activated: ['recovery_in_progress'],
    recovery_in_progress: ['return_to_normal'],
    return_to_normal: ['closed'],
    closed: ['review_required', 'superseded'],
  },
  continuity_test: {
    planned: ['ready', 'cancelled'],
    ready: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'passed', 'passed_with_observations', 'failed'],
    completed: ['passed', 'passed_with_observations', 'failed'],
  },
  crisis: {
    active: ['stabilized', 'recovery', 'closed'],
    stabilized: ['recovery', 'closed'],
    recovery: ['closed'],
  },
  metric: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['active', 'review_required'],
    active: ['review_required', 'retired'],
  },
  quantitative_risk: {
    draft: ['under_review'],
    under_review: ['approved', 'draft'],
    approved: ['current', 'review_required'],
    current: ['review_required', 'superseded'],
  },
};

function transitionPermission(entityType: string, toStatus: string) {
  const approval = ['approved', 'current', 'active', 'passed', 'passed_with_observations']
    .includes(toStatus);
  const permissions: Record<string, string> = {
    organization: 'organizations.manage',
    process: approval ? 'processes.approve' : 'processes.manage',
    service: 'services.manage',
    bia: approval ? 'bia.approve' : 'bia.manage',
    continuity_plan: toStatus === 'activated'
      ? 'continuity.activate'
      : approval ? 'continuity.approve' : 'continuity.manage',
    continuity_test: approval ? 'continuity.approve' : 'continuity.tests.manage',
    crisis: 'crisis.manage',
    metric: approval ? 'metrics.approve' : 'metrics.manage',
    quantitative_risk: approval ? 'quantitative_risk.approve' : 'quantitative_risk.manage',
  };
  return permissions[entityType];
}

const dependencyContracts: Record<string, Array<[string, string]>> = {
  organization: [['process', 'unit_to_process']],
  process: [
    ['process', 'process_to_process'],
    ['service', 'process_to_service'],
    ['asset', 'process_to_asset'],
    ['system', 'process_to_system'],
    ['location', 'process_to_location'],
    ['supplier', 'process_to_supplier'],
  ],
  service: [
    ['asset', 'service_to_asset'],
    ['system', 'service_to_system'],
    ['supplier', 'service_to_supplier'],
    ['location', 'service_to_location'],
    ['control', 'service_to_control'],
    ['requirement', 'service_to_requirement'],
  ],
};

function EntityActions({
  detail,
  entityType,
  endpoint,
  fields,
  canManage,
  permissions,
  canRecordMetric,
  onReload,
}: {
  detail: Phase3Entity360;
  entityType: string;
  endpoint: string;
  fields?: Field[];
  canManage: boolean;
  permissions: Phase3Meta['permissions'];
  canRecordMetric: boolean;
  onReload: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const currentStatus = String(detail.entity.status || detail.entity.lifecycle_status || '');
  const allowedTransitions = (transitionOptions[entityType]?.[currentStatus] || [])
    .filter(status => {
      const requiredPermission = transitionPermission(entityType, status);
      return permissions.platform === true || permissions[requiredPermission] === true;
    });
  const editableFields = (fields || []).filter(field => field.key !== 'code');

  async function execute(path: string, form: HTMLFormElement, method = 'POST') {
    setSubmitting(true);
    setMessage('');
    const numericFields = new Set([
      'numeric_value',
      ...editableFields.filter(field => field.type === 'number').map(field => field.key),
    ]);
    const body: Record<string, unknown> = Object.fromEntries(
      [...new FormData(form).entries()]
        .filter(([, value]) => String(value).trim() !== '')
        .map(([key, value]) => [
          key,
          numericFields.has(key) ? Number(value) : value,
        ])
    );
    if (path.includes('/measurements') && body.provenance_source) {
      body.provenance = { source: body.provenance_source };
      delete body.provenance_source;
    }
    if (path === '/dependencies' && body.dependency_contract) {
      const [targetType, dependencyType] = String(body.dependency_contract).split(':');
      body.target_type = targetType;
      body.dependency_type = dependencyType;
      delete body.dependency_contract;
    }
    try {
      await phase3Mutation(path, body, method);
      form.reset();
      setMessage('Operación registrada con trazabilidad.');
      await onReload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No fue posible completar la operación.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5">
      <h2 className="font-bold text-[var(--tcdx-color-text-primary)]">Operación y relaciones</h2>
      {message && <p role="status" className="mt-2 text-sm text-[var(--tcdx-color-text-secondary)]">{message}</p>}
      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {canManage && editableFields.length > 0 && (
          <form
            onSubmit={event => {
              event.preventDefault();
              void execute(`${endpoint}/${detail.entity.id}`, event.currentTarget, 'PATCH');
            }}
            className="space-y-3 xl:col-span-2"
          >
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
              Editar información operativa
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {editableFields.map(field => (
                <label
                  key={field.key}
                  className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
                >
                  <span className="mb-1.5 block text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
                    {field.label}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea
                      name={field.key}
                      required={field.required}
                      rows={3}
                      defaultValue={editableValue(detail.entity[field.key], field.type)}
                      className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      name={field.key}
                      required={field.required}
                      defaultValue={editableValue(detail.entity[field.key], field.type)}
                      className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                    >
                      <option value="">Seleccione</option>
                      {field.options?.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      required={field.required}
                      type={field.type || 'text'}
                      step={field.type === 'number' ? 'any' : undefined}
                      defaultValue={editableValue(detail.entity[field.key], field.type)}
                      className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm text-[var(--tcdx-color-text-primary)] focus:border-[var(--tcdx-color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tcdx-color-primary)]"
                    />
                  )}
                </label>
              ))}
            </div>
            <button
              disabled={submitting}
              className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Guardar cambios
            </button>
          </form>
        )}
        {canManage && allowedTransitions.length > 0 && (
          <form onSubmit={event => {
            event.preventDefault();
            void execute(`/${entityType}/${detail.entity.id}/transitions`, event.currentTarget);
          }} className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">Cambiar estado</h3>
            <select name="to_status" required defaultValue="" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              <option value="">Seleccione estado</option>
              {allowedTransitions.map(status => <option key={status} value={status}>{valueLabel(status)}</option>)}
            </select>
            <textarea name="reason" required rows={2} placeholder="Motivo del cambio" className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <button disabled={submitting} className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Registrar cambio</button>
          </form>
        )}
        {canManage && (
          <form onSubmit={event => {
            event.preventDefault();
            void execute('/relations', event.currentTarget);
          }} className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">Vincular entidad GRC</h3>
            <input type="hidden" name="source_type" value={entityType} />
            <input type="hidden" name="source_id" value={detail.entity.id} />
            <select name="target_type" required defaultValue="" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              <option value="">Seleccione tipo</option>
              {['risk', 'control', 'requirement', 'evidence', 'supplier', 'incident', 'audit', 'finding', 'nonconformity', 'action'].map(type => <option key={type} value={type}>{valueLabel(type)}</option>)}
            </select>
            <input name="target_id" required placeholder="ID de entidad" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <input name="relation_type" required placeholder="Tipo de relación" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <button disabled={submitting} className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)] disabled:opacity-60">Crear relación</button>
          </form>
        )}
        {canManage && ['organization', 'process', 'service'].includes(entityType) && (
          <form onSubmit={event => {
            event.preventDefault();
            void execute('/dependencies', event.currentTarget);
          }} className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
              Registrar dependencia operacional
            </h3>
            <input type="hidden" name="source_type" value={entityType} />
            <input type="hidden" name="source_id" value={detail.entity.id} />
            <select name="dependency_contract" required defaultValue="" aria-label="Relación de dependencia" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              <option value="">Seleccione relación</option>
              {(dependencyContracts[entityType] || []).map(([targetType, dependencyType]) => (
                <option key={dependencyType} value={`${targetType}:${dependencyType}`}>
                  {valueLabel(dependencyType)}
                </option>
              ))}
            </select>
            <input name="target_id" required aria-label="ID de entidad dependiente" placeholder="ID de entidad dependiente" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <select name="criticality" defaultValue="medium" aria-label="Criticidad de dependencia" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              {statusOptions.criticality.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input name="max_tolerable_minutes" type="number" min="0" aria-label="Tiempo máximo tolerable" placeholder="Tiempo máximo tolerable (minutos)" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <input name="source_reference" required aria-label="Fuente de la dependencia" placeholder="Fuente o referencia" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <textarea name="alternative_description" rows={2} aria-label="Alternativa operacional" placeholder="Alternativa operacional" className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <button disabled={submitting} className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)] disabled:opacity-60">
              Guardar dependencia
            </button>
          </form>
        )}
        {entityType === 'bia' && canManage && (
          <form onSubmit={event => {
            event.preventDefault();
            void execute(`/bia/${detail.entity.id}/impacts`, event.currentTarget);
          }} className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">
              Registrar impacto BIA
            </h3>
            <select name="dimension" required defaultValue="" aria-label="Dimensión del impacto" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              <option value="">Seleccione dimensión</option>
              {['operational', 'financial', 'customer', 'legal_regulatory', 'reputational', 'security', 'privacy', 'contractual'].map(dimension => <option key={dimension} value={dimension}>{valueLabel(dimension)}</option>)}
            </select>
            <input name="duration_minutes" type="number" min="0" required aria-label="Duración del impacto" placeholder="Duración (minutos)" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <select name="impact_level" required defaultValue="" aria-label="Nivel de impacto" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
              <option value="">Seleccione nivel</option>
              {statusOptions.criticality.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input name="estimated_amount" type="number" min="0" step="any" aria-label="Monto estimado" placeholder="Monto estimado" className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <textarea name="rationale" required rows={2} aria-label="Fundamento del impacto" placeholder="Fundamento" className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            <button disabled={submitting} className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Guardar impacto
            </button>
          </form>
        )}
        {entityType === 'metric' && canRecordMetric && (
          <form onSubmit={event => {
            event.preventDefault();
            void execute(`/metrics/${detail.entity.id}/measurements`, event.currentTarget);
          }} className="space-y-3 xl:col-span-2">
            <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-primary)]">Registrar medición</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input name="period_start" type="datetime-local" required aria-label="Inicio del período" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
              <input name="period_end" type="datetime-local" required aria-label="Fin del período" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
              <input name="numeric_value" type="number" step="any" required aria-label="Valor" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
              <input name="source_description" required placeholder="Fuente" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
              <select name="quality" defaultValue="valid" aria-label="Calidad" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 py-2 text-sm">
                {['valid', 'estimated', 'incomplete', 'stale', 'rejected'].map(quality => <option key={quality} value={quality}>{valueLabel(quality)}</option>)}
              </select>
              <input name="provenance_source" required placeholder="Referencia de origen" className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] px-3 py-2 text-sm" />
            </div>
            <button disabled={submitting} className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Registrar medición</button>
          </form>
        )}
      </div>
    </section>
  );
}
