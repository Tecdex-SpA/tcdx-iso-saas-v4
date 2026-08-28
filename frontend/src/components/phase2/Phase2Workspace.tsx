'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  EnterpriseBadge,
  EnterpriseButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterprisePageHeader,
  EnterpriseSection,
} from '@/components/ui/enterprise';
import Phase2Nav from './Phase2Nav';
import { phase2DownloadReport, phase2Mutation, phase2Request } from './phase2Api';

type Row = Record<string, unknown>;

export type Phase2View =
  | 'executive'
  | 'privacy-overview'
  | 'processing'
  | 'processing-detail'
  | 'dpias'
  | 'requests'
  | 'breaches'
  | 'incidents'
  | 'incident-detail'
  | 'suppliers'
  | 'supplier-detail'
  | 'assessments'
  | 'questionnaires'
  | 'connectors'
  | 'connector-detail'
  | 'sync-history'
  | 'integration-health';

type Config = {
  title: string;
  eyebrow: string;
  description: string;
  endpoint: string;
  collectionKey?: string;
  detailBase?: string;
  create?: 'processing' | 'request' | 'breach' | 'incident' | 'supplier' | 'questionnaire' | 'connector';
};

const configs: Record<Phase2View, Config> = {
  executive: {
    title: 'Vista ejecutiva GRC global',
    eyebrow: 'Vista global GRC',
    description: 'Exposición transversal de privacidad, incidentes, terceros, controles, remediales, obligaciones e integraciones.',
    endpoint: '/executive',
  },
  'privacy-overview': {
    title: 'Resumen de privacidad',
    eyebrow: 'Gobierno de datos personales',
    description: 'Actividades, DPIA, solicitudes, brechas y brechas operacionales derivadas de reglas explicables.',
    endpoint: '/privacy/overview',
  },
  processing: {
    title: 'Actividades de tratamiento',
    eyebrow: 'Registro operativo',
    description: 'Inventario versionado con base jurídica, retención, sistemas, activos, encargados y riesgo.',
    endpoint: '/privacy/processing-activities',
    detailBase: '/privacidad/actividades',
    create: 'processing',
  },
  'processing-detail': {
    title: 'Actividad de tratamiento 360',
    eyebrow: 'Privacidad 360',
    description: 'Relaciones, DPIA, encargados, solicitudes, brechas, historia y alertas de una actividad.',
    endpoint: '/privacy/processing-activities',
  },
  dpias: {
    title: 'DPIA',
    eyebrow: 'Evaluación de impacto',
    description: 'Screening, necesidad, proporcionalidad, riesgos residuales, consulta y aprobación.',
    endpoint: '/privacy/dpias',
  },
  requests: {
    title: 'Solicitudes de titulares',
    eyebrow: 'Derechos y plazos',
    description: 'Verificación de identidad, fuente normativa, responsables, vencimientos, respuesta y evidencia.',
    endpoint: '/privacy/requests',
    create: 'request',
  },
  breaches: {
    title: 'Brechas de privacidad',
    eyebrow: 'Respuesta regulatoria',
    description: 'Impacto, notificación, obligaciones, evidencia, remediales y bloqueo de cierre.',
    endpoint: '/privacy/breaches',
    create: 'breach',
  },
  incidents: {
    title: 'Panel de incidentes',
    eyebrow: 'Gestión de incidentes',
    description: 'Severidad explicable, contención, recuperación, causa raíz, postmortem y eficacia.',
    endpoint: '/incidents/workspace',
    collectionKey: 'incidents',
    detailBase: '/incidentes',
    create: 'incident',
  },
  'incident-detail': {
    title: 'Incidente 360',
    eyebrow: 'Respuesta y aprendizaje',
    description: 'Timeline, impactos, obligaciones, notificaciones, evidencias, causas y cierre eficaz.',
    endpoint: '/incidents',
  },
  suppliers: {
    title: 'Portafolio de terceros',
    eyebrow: 'TPRM',
    description: 'Criticidad, acceso a datos, riesgo, evaluación vigente, monitoreo, incidentes y salida.',
    endpoint: '/suppliers/workspace',
    collectionKey: 'suppliers',
    detailBase: '/proveedores',
    create: 'supplier',
  },
  'supplier-detail': {
    title: 'Tercero 360',
    eyebrow: 'Riesgo de terceros',
    description: 'Servicios, contratos, dependencias, evaluaciones, incidentes, remediales y evidencia de salida.',
    endpoint: '/suppliers',
  },
  assessments: {
    title: 'Evaluaciones de proveedores',
    eyebrow: 'Due diligence',
    description: 'Cuestionarios, evidencia, scoring orientativo, revisión humana, riesgo residual y vigencia.',
    endpoint: '/assessments',
  },
  questionnaires: {
    title: 'Cuestionarios',
    eyebrow: 'Plantillas versionadas',
    description: 'Secciones, condicionales, scoring, evidencia, riesgos y controles asociados.',
    endpoint: '/questionnaires',
    create: 'questionnaire',
  },
  connectors: {
    title: 'Catálogo de conectores',
    eyebrow: 'Integraciones prioritarias',
    description: 'Microsoft, Google Workspace, Jira/Confluence y GitHub con sandbox determinista o autorización live.',
    endpoint: '/connectors',
    detailBase: '/conectores',
    create: 'connector',
  },
  'connector-detail': {
    title: 'Conector 360',
    eyebrow: 'Procedencia y operación',
    description: 'Configuración segura, salud, ejecuciones, registros normalizados, alertas y dead-letter.',
    endpoint: '/connectors',
  },
  'sync-history': {
    title: 'Historial de sincronización',
    eyebrow: 'Trazabilidad de ejecución',
    description: 'Intentos, cursores, idempotencia, registros, fallos, retry y resultados.',
    endpoint: '/connectors/runs',
  },
  'integration-health': {
    title: 'Salud de integraciones',
    eyebrow: 'Salud y frescura',
    description: 'Última sincronización, tasa de fallo, normalización, errores y alertas generadas.',
    endpoint: '/connectors/health',
  },
};

const privacyLinks = [
  ['/privacidad', 'Resumen'],
  ['/privacidad/actividades', 'Actividades'],
  ['/privacidad/dpia', 'DPIA'],
  ['/privacidad/solicitudes', 'Solicitudes'],
  ['/privacidad/brechas', 'Brechas'],
];
const supplierLinks = [
  ['/proveedores', 'Portafolio'],
  ['/proveedores/evaluaciones', 'Evaluaciones'],
  ['/proveedores/cuestionarios', 'Cuestionarios'],
  ['/portal-proveedor', 'Portal externo'],
];
const connectorLinks = [
  ['/conectores', 'Catálogo'],
  ['/conectores/sincronizaciones', 'Sincronizaciones'],
  ['/conectores/salud', 'Salud'],
];

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function label(key: string) {
  const normalized = String(key || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    generated_at: 'Generado el',
    active_activities: 'Actividades activas',
    activities_without_legal_basis: 'Actividades sin base jurídica',
    activities_without_retention: 'Actividades sin retención',
    dpia_required: 'DPIA requerido',
    open_requests: 'Solicitudes abiertas',
    overdue_requests: 'Solicitudes vencidas',
    privacy: 'Privacidad',
    incidents: 'Incidentes',
    suppliers: 'Terceros',
    connectors: 'Integraciones',
    sync_history: 'Historial de sincronización',
    integration_health: 'Salud de integraciones',
    supplier_assessments: 'Evaluaciones de terceros',
    supplier_evidence: 'Evidencia de terceros',
    privacy_inventory: 'Inventario de privacidad',
    privacy_risk: 'Riesgo de privacidad',
    privacy_requests: 'Solicitudes de titulares',
    postmortem: 'Postmortem',
    executive_phase2: 'Resumen ejecutivo GRC',
  };
  if (labels[normalized]) return labels[normalized];
  return key
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, value => value.toUpperCase());
}

function tone(value: unknown): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = String(value || '').toLowerCase();
  if (['active', 'approved', 'completed', 'closed', 'healthy', 'effective'].includes(normalized)) return 'success';
  if (['failed', 'critical', 'rejected', 'expired', 'ineffective'].includes(normalized)) return 'danger';
  if (['high', 'degraded', 'overdue', 'remediation_required', 'review_required'].includes(normalized)) return 'warning';
  return 'neutral';
}

function visibleEntries(row: Row) {
  return Object.entries(row)
    .filter(([key, value]) => !key.includes('token') && !key.includes('credential') && value !== null && value !== undefined)
    .slice(0, 8);
}

function formValue(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) || '').trim();
}

export default function Phase2Workspace({ view, id }: { view: Phase2View; id?: string }) {
  const config = configs[view];
  const [data, setData] = useState<unknown>(null);
  const [meta, setMeta] = useState<Row | null>(null);
  const [catalog, setCatalog] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const endpoint = `${config.endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`;
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [payload, metaPayload] = await Promise.all([
        phase2Request<unknown>(endpoint),
        phase2Request<Row>('/meta'),
      ]);
      setData(payload);
      setMeta(metaPayload);
      if (view === 'connectors') {
        setCatalog(await phase2Request<Row[]>('/connectors/catalog'));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar la vista.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (Array.isArray(data)) return data as Row[];
    if (config.collectionKey && data && typeof data === 'object') {
      const collection = (data as Row)[config.collectionKey];
      return Array.isArray(collection) ? collection as Row[] : [];
    }
    return [];
  }, [config.collectionKey, data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config.create) return;
    const form = event.currentTarget;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let path = '';
      let body: Record<string, unknown> = {};
      if (config.create === 'processing') {
        path = '/privacy/processing-activities';
        body = {
          code: formValue(form, 'code'),
          name: formValue(form, 'name'),
          description: formValue(form, 'description'),
          legal_basis: formValue(form, 'legal_basis'),
          legal_basis_source: formValue(form, 'legal_basis_source'),
          retention_period: formValue(form, 'retention_period'),
          retention_basis: formValue(form, 'retention_basis'),
          deletion_method: formValue(form, 'deletion_method'),
          purposes: formValue(form, 'purposes').split(',').map(value => value.trim()).filter(Boolean),
          data_categories: formValue(form, 'data_categories').split(',').map(value => value.trim()).filter(Boolean),
          sensitive_data_categories: formValue(form, 'sensitive_data_categories').split(',').map(value => value.trim()).filter(Boolean),
          systems: formValue(form, 'systems').split(',').map(value => ({ name: value.trim() })).filter(value => value.name),
        };
      }
      if (config.create === 'request') {
        path = '/privacy/requests';
        body = {
          request_number: formValue(form, 'request_number'),
          request_type: formValue(form, 'request_type'),
          subject_reference: formValue(form, 'subject_reference'),
          due_days: Number(formValue(form, 'due_days')),
          normative_source: formValue(form, 'normative_source'),
          systems: formValue(form, 'systems').split(',').map(value => value.trim()).filter(Boolean),
        };
      }
      if (config.create === 'breach') {
        path = '/privacy/breaches';
        body = {
          breach_number: formValue(form, 'breach_number'),
          impact_summary: formValue(form, 'impact_summary'),
          severity: formValue(form, 'severity'),
          affected_subjects_estimate: Number(formValue(form, 'affected_subjects_estimate')) || 0,
          data_categories: formValue(form, 'data_categories').split(',').map(value => value.trim()).filter(Boolean),
          notification_due_at: formValue(form, 'notification_due_at') || null,
        };
      }
      if (config.create === 'incident') {
        path = '/incidents';
        const severity = formValue(form, 'impact');
        const privacyImpact = formValue(form, 'privacy_impact') === 'true';
        const regulatoryImpact = formValue(form, 'regulatory_impact') === 'true';
        body = {
          incident_number: formValue(form, 'incident_number'),
          title: formValue(form, 'title'),
          description: formValue(form, 'description'),
          category: formValue(form, 'category'),
          priority: formValue(form, 'priority'),
          recurrence_key: formValue(form, 'recurrence_key') || null,
          privacy_impact: privacyImpact,
          regulatory_impact: regulatoryImpact,
          severity_inputs: {
            service_criticality: severity,
            process_criticality: severity,
            asset_criticality: severity,
            supplier_criticality: severity,
            privacy_impact: privacyImpact,
            regulatory_impact: regulatoryImpact,
            customer_impact: severity,
            duration_impact: severity,
            financial_impact: severity,
          },
        };
      }
      if (config.create === 'supplier') {
        path = '/suppliers';
        body = {
          code: formValue(form, 'code'),
          legal_name: formValue(form, 'legal_name'),
          trade_name: formValue(form, 'trade_name'),
          tax_identifier: formValue(form, 'tax_identifier'),
          country_code: formValue(form, 'country_code'),
          criticality: formValue(form, 'criticality'),
          data_access_level: formValue(form, 'data_access_level'),
          access_summary: formValue(form, 'access_summary'),
          inherent_risk_score: Number(formValue(form, 'inherent_risk_score')),
        };
      }
      if (config.create === 'questionnaire') {
        path = '/questionnaires';
        body = {
          code: formValue(form, 'code'),
          name: formValue(form, 'name'),
          domain: formValue(form, 'domain'),
          scoring_model: { scale: '0-100', approval: 'human' },
          sections: [{
            code: formValue(form, 'section_code'),
            title: formValue(form, 'section_title'),
            questions: [{
              code: formValue(form, 'question_code'),
              prompt: formValue(form, 'question_prompt'),
              answer_type: formValue(form, 'answer_type'),
              required: true,
              weight: Number(formValue(form, 'weight')) || 1,
              evidence_required: formValue(form, 'evidence_required') === 'true',
            }],
          }],
        };
      }
      if (config.create === 'connector') {
        path = '/connectors';
        body = {
          provider: formValue(form, 'provider'),
          display_name: formValue(form, 'display_name'),
          execution_mode: 'sandbox',
          schedule: { enabled: false },
        };
      }
      await phase2Mutation(path, body);
      form.reset();
      setNotice('Registro guardado y reglas GRC evaluadas.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No fue posible guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function transition(form: HTMLFormElement) {
    if (!id) return;
    const toStatus = formValue(form, 'to_status');
    const reason = formValue(form, 'reason');
    const confirmedSeverity = formValue(form, 'confirmed_severity');
    const paths: Partial<Record<Phase2View, string>> = {
      'processing-detail': `/privacy/processing-activities/${id}/transitions`,
      'incident-detail': `/incidents/${id}/transitions`,
      'supplier-detail': `/suppliers/${id}/transitions`,
    };
    const path = paths[view];
    if (!path) return;
    setSaving(true);
    setError('');
    try {
      await phase2Mutation(path, {
        to_status: toStatus,
        reason,
        note: reason,
        closure_summary: reason,
        ...(confirmedSeverity ? { confirmed_severity: confirmedSeverity } : {}),
      });
      setNotice(`Estado actualizado a ${toStatus}.`);
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'No fue posible cambiar el estado.');
    } finally {
      setSaving(false);
    }
  }

  const localLinks = view.startsWith('privacy') || ['processing', 'dpias', 'requests', 'breaches'].includes(view)
    ? privacyLinks
    : ['suppliers', 'supplier-detail', 'assessments', 'questionnaires'].includes(view)
      ? supplierLinks
      : ['connectors', 'connector-detail', 'sync-history', 'integration-health'].includes(view)
        ? connectorLinks
        : [];
  const metrics = (() => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const value = (data as Row).metrics;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
  })();

  return (
    <AppLayout>
      <div className="space-y-6">
        <Phase2Nav />
        <EnterprisePageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          subtitle={config.description}
        />
        {localLinks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {localLinks.map(([href, linkLabel]) => (
              <Link key={href} href={href} className="rounded-lg border border-[var(--tcdx-color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--tcdx-color-text-primary)] hover:border-[var(--tcdx-color-primary)]">
                {linkLabel}
              </Link>
            ))}
          </div>
        )}

        {meta && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tcdx-color-text-secondary)]">
            <EnterpriseBadge tone={(meta.module as Row)?.is_enabled ? 'success' : 'warning'}>
              {(meta.module as Row)?.is_enabled ? 'Módulo habilitado' : 'Módulo deshabilitado'}
            </EnterpriseBadge>
            <span>Las acciones visibles se validan nuevamente por RBAC y tenant en backend.</span>
          </div>
        )}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {config.create && config.create !== 'connector' && (
          <EnterpriseSection>
            <SectionHeading title="Crear registro" description="Los campos se validan en backend y la operación queda auditada." />
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <CreateFields kind={config.create} catalog={catalog} />
              <div className="flex items-end">
                <EnterpriseButton type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</EnterpriseButton>
              </div>
            </form>
          </EnterpriseSection>
        )}

        {view === 'connectors' && (
          <EnterpriseSection>
            <SectionHeading
              title="Estado real de conectores"
              description="No hay conectores externos habilitados para tenants en esta fase. No se solicitan credenciales ni se ofrece una conexión simulada."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {catalog.map(item => (
                <article key={String(item.provider)} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-bold text-[var(--tcdx-color-text-primary)]">{text(item.display_name)}</h3>
                  <p className="mt-1 text-sm font-semibold text-amber-900">No disponible</p>
                  <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
                    {text(item.availability_message)}
                  </p>
                </article>
              ))}
            </div>
          </EnterpriseSection>
        )}

        {loading ? (
          <div aria-live="polite" className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map(item => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-4">
            {metrics && <ObjectDashboard data={metrics} />}
            <div className="grid gap-4 xl:grid-cols-2">
              {rows.map(row => (
                <RecordCard key={String(row.id || JSON.stringify(row))} row={row} detailBase={config.detailBase} />
              ))}
            </div>
          </div>
        ) : data && !Array.isArray(data) ? (
          <ObjectDashboard data={data as Row} />
        ) : (
          <EnterpriseEmptyState title="Sin registros" description="No hay datos para los filtros actuales. Usa una acción autorizada para iniciar el ciclo." />
        )}

        {id && ['processing-detail', 'incident-detail', 'supplier-detail'].includes(view) && (
          <EnterpriseSection>
            <SectionHeading title="Transición controlada" description="El backend aplica workflow, precondiciones, evidencia, aprobaciones y eficacia." />
            <form
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_1fr_auto]"
              onSubmit={event => {
                event.preventDefault();
                void transition(event.currentTarget);
              }}
            >
              <Field name="to_status" label="Estado destino" required />
              {view === 'incident-detail' ? (
                <Select name="confirmed_severity" label="Severidad confirmada" options={[['', 'Sin cambio'], ...['low', 'medium', 'high', 'critical'].map(value => [value, value] as [string, string])]} />
              ) : <span className="hidden xl:block" />}
              <Field name="reason" label="Razón / resumen verificable" required />
              <div className="flex items-end"><EnterpriseButton type="submit" disabled={saving}>Cambiar estado</EnterpriseButton></div>
            </form>
          </EnterpriseSection>
        )}

        {view === 'connector-detail' && id && (
          <EnterpriseSection>
            <SectionHeading title="No disponible" description="La sincronización externa permanece deshabilitada para tenants hasta su certificación productiva en Fase 6." />
          </EnterpriseSection>
        )}

        {view === 'executive' && <ReportPanel disabled={saving} onError={setError} />}
      </div>
    </AppLayout>
  );
}

const reportDomains: [string, string][] = [
  ['privacy_inventory', 'Inventario de tratamiento'],
  ['privacy_risk', 'Riesgo de privacidad'],
  ['dpia_status', 'Estado DPIA'],
  ['privacy_requests', 'Solicitudes de titulares'],
  ['incidents', 'Registro de incidentes'],
  ['postmortem', 'Postmortem'],
  ['suppliers', 'Registro de proveedores'],
  ['supplier_assessments', 'Evaluaciones de proveedor'],
  ['supplier_evidence', 'Evidencia de proveedor'],
  ['connectors_health', 'Salud de conectores'],
  ['executive_phase2', 'Resumen ejecutivo'],
];

function ReportPanel({ disabled, onError }: { disabled: boolean; onError: (message: string) => void }) {
  const [domain, setDomain] = useState(reportDomains[0][0]);
  const [downloading, setDownloading] = useState(false);
  return (
    <EnterpriseSection>
      <SectionHeading title="Reportes auditados" description="Exportación CSV tenant-scoped con filtros, versión, fecha, hash y registro de auditoría." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-72 space-y-1 text-sm font-medium">
          <span>Reporte</span>
          <select value={domain} onChange={event => setDomain(event.target.value)} className="w-full rounded-lg border border-[var(--tcdx-color-border)] bg-white px-3 py-2">
            {reportDomains.map(([value, reportLabel]) => <option key={value} value={value}>{reportLabel}</option>)}
          </select>
        </label>
        <EnterpriseButton
          type="button"
          disabled={disabled || downloading}
          onClick={() => {
            setDownloading(true);
            onError('');
            void phase2DownloadReport(domain)
              .catch(downloadError => onError(downloadError instanceof Error ? downloadError.message : 'No fue posible exportar.'))
              .finally(() => setDownloading(false));
          }}
        >
          {downloading ? 'Generando…' : 'Exportar CSV'}
        </EnterpriseButton>
      </div>
    </EnterpriseSection>
  );
}

function Field({ name, label: fieldLabel, required = false, type = 'text', defaultValue }: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string | number;
}) {
  return (
    <label className="space-y-1 text-sm font-medium text-[var(--tcdx-color-text-primary)]">
      <span>{fieldLabel}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-[var(--tcdx-color-border)] bg-white px-3 py-2 outline-none focus:border-[var(--tcdx-color-primary)]"
      />
    </label>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-[var(--tcdx-color-text-primary)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
    </div>
  );
}

function Select({ name, label: fieldLabel, options, defaultValue }: {
  name: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <label className="space-y-1 text-sm font-medium text-[var(--tcdx-color-text-primary)]">
      <span>{fieldLabel}</span>
      <select name={name} defaultValue={defaultValue || options[0]?.[0]} className="w-full rounded-lg border border-[var(--tcdx-color-border)] bg-white px-3 py-2">
        {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function CreateFields({ kind, catalog }: { kind: NonNullable<Config['create']>; catalog: Row[] }) {
  if (kind === 'processing') return (
    <>
      <Field name="code" label="Código" required />
      <Field name="name" label="Nombre" required />
      <Field name="description" label="Descripción" />
      <Field name="legal_basis" label="Base jurídica" required />
      <Field name="legal_basis_source" label="Fuente normativa" required />
      <Field name="retention_period" label="Retención" required />
      <Field name="retention_basis" label="Fundamento de retención" />
      <Field name="deletion_method" label="Método de eliminación" />
      <Field name="purposes" label="Finalidades (separadas por coma)" required />
      <Field name="data_categories" label="Categorías de datos" required />
      <Field name="sensitive_data_categories" label="Datos sensibles" />
      <Field name="systems" label="Sistemas" required />
    </>
  );
  if (kind === 'request') return (
    <>
      <Field name="request_number" label="Número" required />
      <Select name="request_type" label="Tipo" options={['access', 'rectification', 'deletion', 'restriction', 'objection', 'portability'].map(value => [value, value])} />
      <Field name="subject_reference" label="Referencia del titular" required />
      <Field name="due_days" label="Plazo (días)" type="number" defaultValue={30} required />
      <Field name="normative_source" label="Fuente normativa" required />
      <Field name="systems" label="Sistemas involucrados" required />
    </>
  );
  if (kind === 'breach') return (
    <>
      <Field name="breach_number" label="Número" required />
      <Select name="severity" label="Severidad" options={['low', 'medium', 'high', 'critical'].map(value => [value, value])} defaultValue="high" />
      <Field name="affected_subjects_estimate" label="Titulares estimados" type="number" defaultValue={0} />
      <Field name="data_categories" label="Categorías de datos" required />
      <Field name="notification_due_at" label="Plazo de notificación" type="datetime-local" />
      <Field name="impact_summary" label="Impacto" required />
    </>
  );
  if (kind === 'incident') return (
    <>
      <Field name="incident_number" label="Número" required />
      <Field name="title" label="Título" required />
      <Field name="description" label="Descripción" required />
      <Field name="category" label="Clasificación" required />
      <Select name="priority" label="Prioridad" options={['low', 'medium', 'high', 'urgent'].map(value => [value, value])} defaultValue="high" />
      <Select name="impact" label="Impacto transversal" options={['low', 'medium', 'high', 'critical'].map(value => [value, value])} defaultValue="medium" />
      <Select name="privacy_impact" label="Impacto privacidad" options={[['false', 'No'], ['true', 'Sí']]} />
      <Select name="regulatory_impact" label="Impacto regulatorio" options={[['false', 'No'], ['true', 'Sí']]} />
      <Field name="recurrence_key" label="Clave de recurrencia" />
    </>
  );
  if (kind === 'supplier') return (
    <>
      <Field name="code" label="Código" required />
      <Field name="legal_name" label="Razón social" required />
      <Field name="trade_name" label="Nombre comercial" />
      <Field name="tax_identifier" label="Identificador tributario" />
      <Field name="country_code" label="País ISO" defaultValue="CL" />
      <Select name="criticality" label="Criticidad" options={['low', 'medium', 'high', 'critical'].map(value => [value, value])} />
      <Select name="data_access_level" label="Acceso a datos" options={['none', 'internal', 'confidential', 'personal', 'sensitive'].map(value => [value, value])} />
      <Field name="access_summary" label="Resumen de acceso" />
      <Field name="inherent_risk_score" label="Riesgo inherente 0-100" type="number" defaultValue={50} />
    </>
  );
  if (kind === 'questionnaire') return (
    <>
      <Field name="code" label="Código de plantilla" required />
      <Field name="name" label="Nombre" required />
      <Field name="domain" label="Dominio" required />
      <Field name="section_code" label="Código de sección" required />
      <Field name="section_title" label="Título de sección" required />
      <Field name="question_code" label="Código de pregunta" required />
      <Field name="question_prompt" label="Pregunta" required />
      <Select name="answer_type" label="Tipo de respuesta" options={['boolean', 'text', 'number', 'single_choice', 'multiple_choice', 'date'].map(value => [value, value])} />
      <Field name="weight" label="Peso" type="number" defaultValue={1} />
      <Select name="evidence_required" label="Evidencia obligatoria" options={[['false', 'No'], ['true', 'Sí']]} />
    </>
  );
  return (
    <>
      <label className="space-y-1 text-sm font-medium">
        <span>Proveedor</span>
        <select name="provider" required className="w-full rounded-lg border border-[var(--tcdx-color-border)] bg-white px-3 py-2">
          <option value="">Selecciona</option>
          {catalog.map(item => <option key={String(item.provider)} value={String(item.provider)}>{text(item.display_name)}</option>)}
        </select>
      </label>
      <Field name="display_name" label="Nombre de instancia" required />
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Se crea en sandbox determinista. El modo live requiere scopes y credenciales autorizadas.
      </div>
    </>
  );
}

function RecordCard({ row, detailBase }: { row: Row; detailBase?: string }) {
  const badgeValue = row.status || row.health_status || row.criticality;
  return (
    <EnterpriseCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tcdx-color-text-secondary)]">{text(row.code || row.incident_number || row.request_number || row.breach_number || row.provider || 'Registro')}</p>
          <h3 className="mt-1 text-lg font-bold text-[var(--tcdx-color-text-primary)]">{text(row.name || row.title || row.legal_name || row.display_name || row.questionnaire_name || row.supplier_name)}</h3>
        </div>
        {Boolean(badgeValue) && <EnterpriseBadge tone={tone(badgeValue)}>{text(badgeValue)}</EnterpriseBadge>}
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {visibleEntries(row).slice(0, 6).map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-[var(--tcdx-color-text-secondary)]">{label(key)}</dt>
            <dd className="truncate text-sm font-medium text-[var(--tcdx-color-text-primary)]" title={text(value)}>{text(value)}</dd>
          </div>
        ))}
      </dl>
      {detailBase && Boolean(row.id) && <Link href={`${detailBase}/${String(row.id)}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--tcdx-color-primary)]">Abrir vista 360 →</Link>}
    </EnterpriseCard>
  );
}

function ObjectDashboard({ data }: { data: Row }) {
  const entries = Object.entries(data);
  const scalarEntries = entries.filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value));
  const objectEntries = entries.filter(([, value]) => value && typeof value === 'object');
  return (
    <div className="space-y-4">
      {scalarEntries.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {scalarEntries.map(([key, value]) => (
            <EnterpriseCard key={key}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tcdx-color-text-secondary)]">{label(key)}</p>
              <p className="mt-2 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">{text(value)}</p>
            </EnterpriseCard>
          ))}
        </div>
      )}
      {objectEntries.map(([key, value]) => {
        const values = Array.isArray(value) ? value as Row[] : [value as Row];
        return (
          <EnterpriseSection key={key}>
            <SectionHeading title={label(key)} description={`${values.length} registro(s) relacionados`} />
            {values.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {values.slice(0, 50).map((item, index) => <RecordCard key={String(item.id || index)} row={item} />)}
              </div>
            ) : <EnterpriseEmptyState title="Sin relaciones" description="No existen elementos relacionados en esta sección." />}
          </EnterpriseSection>
        );
      })}
    </div>
  );
}
