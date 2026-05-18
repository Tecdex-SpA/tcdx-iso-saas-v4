'use client';

import { useEffect, useMemo, useState } from 'react';
import { getStoredValidToken, getTenantIdFromToken } from '@/utils/auth';
import type { JsonObject, RecommendedAction } from './types';
import {
  formatDate,
  label,
  priorityClass,
  relatedLinks,
  sourceLabel,
  statusClass,
  targetLabel,
} from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://181.212.166.187:8443';

type Props = {
  action: RecommendedAction | null;
  conversionPreview?: JsonObject | null;
  readonly?: boolean;
  busy?: boolean;
  onClose: () => void;
  onAccept: (action: RecommendedAction) => void;
  onConvert: (action: RecommendedAction) => void;
  onDismiss: (action: RecommendedAction) => void;
};

type AiInsightState = {
  loading: boolean;
  error: string;
  summary: string;
  recommendation: string;
  source: string;
};

function textValue(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function humanList(items: Array<string | null | undefined>) {
  const clean = items.map((item) => String(item || '').trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} y ${clean[clean.length - 1]}`;
}

function buildOperationalInsight(action: RecommendedAction, payload: JsonObject, trace: JsonObject) {
  const clause = textValue(payload.clause || trace.clause || action.control_clause, '');
  const category = textValue(payload.category || trace.category || action.control_category, '');
  const standard = textValue(trace.standard_code || payload.standard_code || action.standard_code, 'la norma seleccionada');
  const evidenceCount = numberValue(payload.evidence_count ?? trace.evidence_count);
  const approvedEvidenceCount = numberValue(payload.approved_evidence_count ?? trace.approved_evidence_count);
  const controlDescription = textValue(trace.control_description || action.control_description, '');
  const contextParts = [standard, clause ? `clausula ${clause}` : '', category || controlDescription].filter(Boolean);

  const evidenceSentence = evidenceCount !== null || approvedEvidenceCount !== null
    ? `El analisis detecta ${evidenceCount ?? 0} evidencia(s) registradas y ${approvedEvidenceCount ?? 0} evidencia(s) aprobadas para sostener este punto.`
    : 'La recomendacion requiere revisar si existe evidencia suficiente, vigente y aprobada antes de convertirla en trabajo operativo.';

  const focus = humanList(contextParts);

  return {
    title: 'Lectura operativa',
    body: focus
      ? `Esta recomendacion se origina en ${focus}. ${evidenceSentence}`
      : `Esta recomendacion se origina en ${sourceLabel(action.source_module)}. ${evidenceSentence}`,
  };
}

function buildTraceInsight(action: RecommendedAction, payload: JsonObject, trace: JsonObject) {
  const sourceEntity = humanList([
    action.source_entity_type || '',
    action.source_entity_id || '',
  ]);
  const tenantControl = textValue(action.tenant_control_id || trace.tenant_control_id, '');
  const operationId = textValue(action.operation_id || trace.operation_id, '');
  const expected = textValue(
    payload.expected_result || payload.impact,
    'La accion busca cerrar la brecha, reducir riesgo y dejar seguimiento auditable.'
  );
  const traceParts = [
    sourceEntity ? `fuente ${sourceEntity}` : '',
    tenantControl ? `control tenant ${tenantControl}` : '',
    operationId ? `operacion ${operationId}` : '',
  ].filter(Boolean);

  return {
    title: 'Trazabilidad explicada',
    body: traceParts.length > 0
      ? `La trazabilidad conecta esta sugerencia con ${humanList(traceParts)}. ${expected}`
      : `La trazabilidad disponible confirma el origen funcional de la sugerencia. ${expected}`,
  };
}

function buildAiQuestion(action: RecommendedAction, payload: JsonObject, trace: JsonObject) {
  const context = {
    norma: action.standard_code || trace.standard_code || payload.standard_code || 'ISO',
    titulo: action.title,
    descripcion: action.description || '',
    justificacion: action.rationale || action.source_reason || '',
    prioridad: action.priority,
    estado: action.status,
    origen: sourceLabel(action.source_module),
    destino: targetLabel(action.target_record_type),
    control: action.control_description || trace.control_description || payload.control_description || '',
    clausula: action.control_clause || trace.clause || payload.clause || '',
    categoria: action.control_category || trace.category || payload.category || '',
    evidencias_registradas: payload.evidence_count ?? trace.evidence_count ?? null,
    evidencias_aprobadas: payload.approved_evidence_count ?? trace.approved_evidence_count ?? null,
    resultado_esperado: payload.expected_result || payload.impact || '',
    riesgo_si_no_se_ejecuta: payload.risk_if_ignored || payload.risk_hint || '',
  };

  return [
    'Actua como auditor ISO senior y product manager SaaS B2B.',
    'Transforma esta accion recomendada ISO en una explicacion util para usuario final.',
    'No muestres JSON, IDs tecnicos ni nombres de campos.',
    'Entrega dos parrafos breves: primero lectura operativa, segundo recomendacion concreta y proximo paso.',
    `Contexto: ${JSON.stringify(context)}`,
  ].join(' ');
}

function extractAiInsight(json: any): Pick<AiInsightState, 'summary' | 'recommendation' | 'source'> {
  const answer = json?.answer || json?.data?.answer || json?.ai || json?.data?.ai || json?.data || json;
  const directText = typeof answer === 'string' ? answer : '';
  const candidates = [
    answer?.executive_summary,
    answer?.summary,
    answer?.answer,
    answer?.text,
    answer?.content,
    answer?.response,
    json?.answer_text,
  ].filter((value) => typeof value === 'string' && value.trim());
  const text = directText || String(candidates[0] || '').trim();
  const paragraphs = text
    .split(/\n{2,}|\r?\n-/)
    .map((part) => part.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);

  return {
    summary: paragraphs[0] || text || '',
    recommendation: paragraphs.slice(1).join(' ') || String(answer?.recommendation || answer?.next_step || '').trim(),
    source: String(answer?.source || json?.source || json?.search_trace?.source || 'ai-engine'),
  };
}

function InsightBlock({ title, body, tone = 'slate' }: { title: string; body: string; tone?: 'slate' | 'blue' }) {
  const toneClass = tone === 'blue'
    ? 'border-blue-200 bg-blue-50 text-blue-950'
    : 'border-gray-200 bg-gray-50 text-gray-900';

  return (
    <section className={`rounded-lg border p-4 ${toneClass}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-85">{body}</p>
    </section>
  );
}

type ContentProps = Omit<Props, 'action'> & {
  action: RecommendedAction;
};

export default function RecommendedActionDetailModal(props: Props) {
  if (!props.action) return null;
  return <RecommendedActionDetailModalContent {...props} action={props.action} />;
}

function RecommendedActionDetailModalContent({
  action,
  conversionPreview = null,
  readonly = false,
  busy = false,
  onClose,
  onAccept,
  onConvert,
  onDismiss,
}: ContentProps) {
  const canAct = !readonly && action.status === 'pending';
  const links = relatedLinks(action);
  const payload = action.payload_json || {};
  const trace = action.source_trace_json || {};
  const operationalInsight = useMemo(() => buildOperationalInsight(action, payload, trace), [action, payload, trace]);
  const traceInsight = useMemo(() => buildTraceInsight(action, payload, trace), [action, payload, trace]);
  const [aiInsight, setAiInsight] = useState<AiInsightState>({
    loading: false,
    error: '',
    summary: '',
    recommendation: '',
    source: '',
  });
  const preview = conversionPreview && typeof conversionPreview.preview === 'object'
    ? conversionPreview.preview as JsonObject
    : null;
  const warnings = Array.isArray(conversionPreview?.warnings)
    ? conversionPreview.warnings.map(String)
    : [];
  const blockedReasons = Array.isArray(conversionPreview?.blocked_reasons)
    ? conversionPreview.blocked_reasons.map(String)
    : [];

  useEffect(() => {
    let cancelled = false;

    const loadAiInsight = async () => {
      const token = getStoredValidToken();
      const tenantId = action.tenant_id || getTenantIdFromToken();

      if (!token || !tenantId) {
        setAiInsight({
          loading: false,
          error: 'No hay sesion activa para generar lectura IA.',
          summary: '',
          recommendation: '',
          source: '',
        });
        return;
      }

      try {
        setAiInsight({ loading: true, error: '', summary: '', recommendation: '', source: '' });
        const response = await fetch(`${API_BASE_URL}/api/ai-compliance/answer`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            question: buildAiQuestion(action, payload, trace),
            limit: 6,
            knowledge_limit: 6,
            benchmark_limit: 0,
            force_external_lookup: false,
          }),
        });
        const json = await response.json().catch(() => null);

        if (!response.ok || json?.ok === false) {
          throw new Error(json?.error || `ai-engine no disponible (HTTP ${response.status}).`);
        }

        const next = extractAiInsight(json);
        if (!cancelled) {
          setAiInsight({
            loading: false,
            error: '',
            summary: next.summary,
            recommendation: next.recommendation,
            source: next.source,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAiInsight({
            loading: false,
            error: error instanceof Error ? error.message : 'No fue posible generar lectura IA.',
            summary: '',
            recommendation: '',
            source: '',
          });
        }
      }
    };

    void loadAiInsight();

    return () => {
      cancelled = true;
    };
  }, [action, payload, trace]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${priorityClass(action.priority)}`}>
                {label(action.priority)}
              </span>
              <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(action.status)}`}>
                {label(action.status)}
              </span>
              <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                {action.standard_code || 'Sin norma'}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-gray-950">{action.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {action.description || action.rationale || 'Sin descripcion disponible.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(92vh-168px)] overflow-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Origen</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{sourceLabel(action.source_module)}</div>
              <div className="mt-2 text-xs text-gray-500">
                {action.source_entity_type || 'Sin entidad'} {action.source_entity_id ? `· ${action.source_entity_id}` : ''}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Destino operativo</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{targetLabel(action.target_record_type)}</div>
              <div className="mt-2 text-xs text-gray-500">
                {action.created_record_type ? `${targetLabel(action.created_record_type)} creado` : 'Pendiente de conversion'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Responsable sugerido</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{action.suggested_owner || 'Sin asignar'}</div>
              <div className="mt-2 text-xs text-gray-500">Vence: {formatDate(action.suggested_due_date)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Justificacion</h3>
              <p className="mt-2 text-sm text-gray-600">
                {action.rationale || action.source_reason || 'La recomendacion proviene de inteligencia ISO operacional y requiere revision humana.'}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Impacto esperado</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.expected_result || payload.impact,
                  'Reducir brechas, ordenar evidencia y convertir hallazgos ISO en trabajo gestionable.'
                )}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Riesgo si no se ejecuta</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.risk_if_ignored || payload.risk_hint,
                  'La brecha puede persistir y afectar auditorias, controles, evidencia o seguimiento operativo.'
                )}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Proximo paso</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.next_step || payload.recommendation,
                  'Revisar el detalle, validar responsable y convertir solo si corresponde.'
                )}
              </p>
            </section>
          </div>

          {links.length > 0 && (
            <section className="mt-5 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Entidades relacionadas</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {conversionPreview && (
            <section className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-950">Preview de conversion</h3>
              <div className="mt-3 grid gap-2 text-sm text-blue-900 md:grid-cols-2">
                <div><span className="font-semibold">Destino:</span> {textValue(conversionPreview.target_type, action.target_record_type)}</div>
                <div><span className="font-semibold">Tabla:</span> {textValue(preview?.table, 'Sin tabla')}</div>
                <div className="md:col-span-2"><span className="font-semibold">Titulo:</span> {textValue(preview?.title, action.title)}</div>
                <div><span className="font-semibold">Prioridad:</span> {textValue(preview?.priority, action.priority)}</div>
                <div><span className="font-semibold">Fecha:</span> {textValue(preview?.due_date, 'Sin fecha')}</div>
              </div>
              {warnings.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-blue-900">
                  {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
              {blockedReasons.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-800">
                  {blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </section>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <InsightBlock
              title={aiInsight.summary ? 'Lectura generada por IA' : operationalInsight.title}
              body={
                aiInsight.loading
                  ? 'Generando lectura operativa con ai-engine...'
                  : aiInsight.summary || operationalInsight.body
              }
              tone="blue"
            />
            <InsightBlock
              title={aiInsight.recommendation ? 'Recomendacion operativa IA' : traceInsight.title}
              body={
                aiInsight.loading
                  ? 'Preparando recomendacion concreta y proximo paso para esta accion.'
                  : aiInsight.recommendation || traceInsight.body
              }
            />
          </div>

          {aiInsight.error && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              No fue posible completar la lectura con ai-engine. Se muestra una interpretacion operativa segura basada en la trazabilidad existente.
            </div>
          )}

          {aiInsight.source && !aiInsight.error && (
            <div className="mt-3 text-xs text-gray-500">
              Fuente de lectura: {aiInsight.source}
            </div>
          )}
        </div>

        <div className="flex flex-nowrap justify-end gap-2 overflow-x-auto border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onDismiss(action)}
            disabled={!canAct || busy}
            className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-gray-50 disabled:opacity-45"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={() => onAccept(action)}
            disabled={!canAct || busy}
            className="inline-flex items-center justify-center rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 whitespace-nowrap hover:bg-emerald-100 disabled:opacity-45"
          >
            Validar dry-run
          </button>
          <button
            type="button"
            onClick={() => onConvert(action)}
            disabled={!canAct || busy}
            className="inline-flex items-center justify-center rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap hover:bg-slate-800 disabled:opacity-45"
          >
            Crear tarea / plan
          </button>
        </div>
      </div>
    </div>
  );
}
