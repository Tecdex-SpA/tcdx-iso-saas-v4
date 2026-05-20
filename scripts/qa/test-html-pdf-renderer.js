#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(repoRoot, 'backend');

if (!process.env.PUPPETEER_EXECUTABLE_PATH && !process.env.CHROME_PATH) {
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(macChrome)) {
    process.env.CHROME_PATH = macChrome;
  }
}

const { renderHtmlToPdf } = require(path.join(
  backendRoot,
  'src',
  'reports',
  'services',
  'htmlPdfRenderer.service.js'
));
const { renderIaAuditorHistoricTemplate } = require(path.join(
  backendRoot,
  'src',
  'reports',
  'templates',
  'iaAuditorHistoric.template.js'
));
const { renderExecutivePremiumTemplate } = require(path.join(
  backendRoot,
  'src',
  'reports',
  'templates',
  'executivePremium.template.js'
));

const now = new Date().toISOString();

const aiAuditorAnalysis = {
  id: 'layout-test-history-id',
  standard_code: 'ISO9001',
  audit_focus: 'certification_readiness',
  depth: 'deep',
  score: 62,
  readiness_level: 'not_ready',
  ai_engine_used: true,
  human_review_required: true,
  can_create_records: false,
  db_write: false,
  summary: {
    score: 62,
    confidence_score: 84,
    readiness_level: 'not_ready',
    executive_summary:
      'IA Auditor Senior reviso el alcance seleccionado y detecto brechas relevantes de evidencia, trazabilidad y cierre. La postura auditora requiere tratamiento antes de declarar preparacion formal.',
    auditor_opinion:
      'La organizacion no debe declararse lista para auditoria formal hasta regularizar evidencias criticas, responsables y criterios de cierre.',
  },
  coverage: {
    controls_reviewed: 18,
    evidences_reviewed: 12,
    findings_reviewed: 4,
    actions_reviewed: 6,
    controls_with_alert: 5,
    evidences_with_alert: 6,
  },
  structured_result: {
    executive_summary:
      'La evaluacion ejecutiva identifica debilidad de evidencia, trazabilidad incompleta y necesidad de revision humana obligatoria.',
    diagnosis:
      'La preparacion presenta brechas de evidencia objetiva, planes vencidos y preguntas auditoras abiertas.',
    risk_impact:
      'Riesgo de observaciones mayores si controles clave no cuentan con evidencia oficial, vigente y vinculada al requisito.',
    limitations: [
      'El analisis no reemplaza juicio auditor humano.',
      'RAG y LLM se usan como apoyo; los datos internos del tenant son la fuente principal.',
    ],
    gaps: Array.from({ length: 5 }, (_, index) => ({
      iso: 'ISO9001',
      clause: String(index + 4),
      severity: index < 2 ? 'alta' : 'media',
      title: `Brecha prioritaria ${index + 1}: evidencia objetiva insuficiente`,
      description:
        'El control revisado no demuestra ejecucion vigente, responsable formal, periodo cubierto ni resultado verificable.',
      business_impact:
        'Puede afectar la capacidad de sostener conformidad ante auditoria externa y debilita trazabilidad de cierre.',
      recommendation:
        'Solicitar evidencia oficial, validar criterio de aceptacion y registrar responsable de cierre.',
    })),
    documents_to_request: [
      'Procedimiento vigente aprobado',
      'Registro operacional del periodo auditado',
      'Evidencia de revision por responsable',
      'Matriz de seguimiento de acciones',
      'Acta de comite o aprobacion formal',
      'Evidencia de eficacia posterior al cierre',
    ],
    recommended_actions: Array.from({ length: 5 }, (_, index) => ({
      priority: index < 2 ? 'alta' : 'media',
      title: `Regularizar brecha auditora ${index + 1}`,
      description:
        'Cargar evidencia objetiva, revisar trazabilidad, definir responsable y cerrar con criterio verificable.',
      suggested_owner_role: 'Responsable ISO / auditor interno',
      due_days: index < 2 ? 15 : 30,
      acceptance_criteria: [
        'Evidencia oficial cargada y validada',
        'Responsable y periodo documentados',
        'Criterio de cierre aprobado por revision humana',
      ],
      target_module: index % 2 === 0 ? 'evidencias' : 'plan-accion',
    })),
  },
  evidence_requests: [
    { title: 'Procedimiento vigente aprobado', priority: 'alta', reason: 'Permite validar control documental y version aplicable.' },
    { title: 'Registro operacional del periodo', priority: 'alta', reason: 'Demuestra operacion real y trazabilidad temporal.' },
    { title: 'Evidencia de revision responsable', priority: 'media', reason: 'Acredita supervision y aceptacion humana.' },
    { title: 'Plan de accion actualizado', priority: 'media', reason: 'Permite verificar tratamiento y plazo.' },
    { title: 'Acta de comite', priority: 'media', reason: 'Sustenta decisiones ejecutivas.' },
    { title: 'Prueba de eficacia', priority: 'alta', reason: 'Demuestra que la accion correctiva resolvio la causa.' },
  ],
  action_plan_suggestions: Array.from({ length: 5 }, (_, index) => ({
    priority: index < 2 ? 'alta' : 'media',
    title: `Accion de cierre ${index + 1}`,
    recommended_action:
      'Formalizar evidencia, revisar causa, aprobar responsable y documentar resultado de eficacia.',
    suggested_owner_role: 'Responsable del proceso',
    due_days: 20,
  })),
  trace: {
    history_run_id: 'layout-test-history-id',
    request_id: 'qa-layout-test-request',
    source: 'ai_engine_senior_auditor_v2',
    ai_engine_used: true,
    used_llm: true,
    llm_provider: 'ollama',
    model_name: 'qwen2.5:14b',
    selected_model: 'qwen2.5:14b',
    model_mode: 'deep',
    used_rag: true,
    used_web: false,
    used_drive: false,
    duration_ms: 481000,
    generated_at: now,
    db_write: false,
    history_saved: true,
  },
};

const executiveReportData = {
  locale: 'es',
  report_type_code: 'executive_iso_status',
  period: 'Mayo 2026',
  generated_at: now,
  tenant: {
    name: 'Rieltec QA',
    report_primary_color: '#0B2F4F',
    report_secondary_color: '#22C55E',
  },
  stats: {
    controls: {
      total_controls: 65,
      average_score: 64,
      healthy_controls: 28,
      warning_controls: 12,
      overdue_controls: 8,
    },
    evidences: {
      total_evidences: 164,
      approved_evidences: 120,
      pending_evidences: 12,
      expired_evidences: 8,
    },
    findings: {
      open_findings: 3,
      overdue_findings: 2,
    },
    action_plans: {
      open_actions: 6,
      overdue_actions: 2,
    },
  },
  standards: [
    { code: 'ISO9001', name: 'Gestion de calidad' },
    { code: 'ISO27001', name: 'Seguridad de la informacion' },
  ],
  compliance_by_standard: [
    { code: 'ISO9001', score: 72, evidence_score: 66, controls_count: 20 },
    { code: 'ISO27001', score: 58, evidence_score: 49, controls_count: 45 },
  ],
  executive_summary:
    'La organizacion presenta avance operativo, pero debe cerrar brechas de evidencia y trazabilidad antes de una auditoria formal.',
  recommendations: [
    'Priorizar controles sin evidencia objetiva.',
    'Cerrar acciones vencidas con responsable y plazo.',
    'Validar eficacia de correcciones con revision humana.',
  ],
  ai: {
    executive_summary: 'Lectura IA de soporte para priorizacion ejecutiva.',
    ai_metrics: {
      model_mode: 'deep',
      selected_model: 'qwen2.5:14b',
      used_llm: true,
      used_rag: true,
      used_web: false,
      used_drive: false,
      fallback_used: false,
    },
  },
};

async function assertPdf(outputPath, label) {
  const stats = fs.statSync(outputPath);
  const minimumBytes = 20 * 1024;
  if (stats.size < minimumBytes) {
    throw new Error(`${label} demasiado pequeno: ${stats.size} bytes en ${outputPath}`);
  }
  console.log(`OK ${label}: ${outputPath} ${stats.size} bytes`);
}

async function main() {
  const outputs = [
    {
      label: 'IA Auditor historico',
      outputPath: '/tmp/tcdx-html-pdf-ia-auditor.pdf',
      html: renderIaAuditorHistoricTemplate({
        locale: 'es',
        tenant: { name: 'Rieltec QA', logo_url: null },
        analysis: aiAuditorAnalysis,
      }),
      templateName: 'iaAuditorHistoric',
    },
    {
      label: 'Executive ISO status',
      outputPath: '/tmp/tcdx-html-pdf-executive-iso-status.pdf',
      html: renderExecutivePremiumTemplate(executiveReportData),
      templateName: 'executivePremium',
    },
  ];

  for (const item of outputs) {
    await renderHtmlToPdf({
      html: item.html,
      outputPath: item.outputPath,
      requestId: 'qa-html-pdf-renderer',
      metadata: { templateName: item.templateName },
      minBytes: 20 * 1024,
    });
    await assertPdf(item.outputPath, item.label);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
