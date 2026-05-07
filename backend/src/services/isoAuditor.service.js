const pool = require('../config/db');
const isoCommandCenter = require('./isoCommandCenter.service');

async function tableExists(tableName) {
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [tableName]
  );

  return result.rowCount > 0;
}

function normalizeStandardCode(value) {
  return String(value || '').trim().toUpperCase();
}

function fallbackQuestions(standard) {
  const base = [
    {
      question_code: `${standard.standard_code}-READY-01`,
      question_text: 'Que evidencia objetiva demuestra que las brechas principales estan controladas?',
      category: 'brechas',
      clause_code: null,
    },
    {
      question_code: `${standard.standard_code}-RISK-01`,
      question_text: 'Como se revisan los riesgos altos y las acciones de tratamiento pendientes?',
      category: 'riesgos',
      clause_code: null,
    },
    {
      question_code: `${standard.standard_code}-ACTION-01`,
      question_text: 'Que acciones recomendadas siguen abiertas y quien es responsable de cerrarlas?',
      category: 'acciones',
      clause_code: null,
    },
  ];

  if (standard.standard_code === 'ISO42001') {
    base.push({
      question_code: 'ISO42001-GOV-01',
      question_text: 'Existe inventario de sistemas IA, responsables y criterios de supervision humana?',
      category: 'gobierno_ia',
      clause_code: null,
    });
  }

  if (standard.standard_code === 'ISO27001') {
    base.push({
      question_code: 'ISO27001-SEC-01',
      question_text: 'Los activos criticos, accesos y evidencias de seguridad estan revisados contra riesgos vigentes?',
      category: 'seguridad',
      clause_code: null,
    });
  }

  return base;
}

async function loadAuditQuestions(standards, notes) {
  if (!standards.length || !(await tableExists('iso_audit_questions'))) {
    return [];
  }

  const codes = [...new Set(standards.map((standard) => standard.standard_code).filter(Boolean))];

  try {
    const result = await pool.query(
      `
      SELECT
        standard_code,
        version_code,
        question_code,
        question_text,
        clause_code,
        category
      FROM iso_audit_questions
      WHERE standard_code = ANY($1::text[])
        AND is_active IS DISTINCT FROM false
      ORDER BY standard_code, version_code, question_code
      LIMIT 120
      `,
      [codes]
    );

    return result.rows;
  } catch (error) {
    notes.push(`No se pudo consultar iso_audit_questions: ${error.code || error.message}`);
    return [];
  }
}

function buildAreasOfReview(standards, priorities) {
  const areas = [];

  standards.forEach((standard) => {
    if (Number(standard.readiness_score || 0) < 70) {
      areas.push({
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        severity: standard.readiness_score < 50 ? 'alta' : 'media',
        title: 'Readiness bajo para preauditoria',
        recommendation: 'Revisar brechas abiertas, evidencias esperadas y responsables antes de auditoria.',
        route: '/acciones-recomendadas',
      });
    }

    if (Number(standard.critical_risks || 0) + Number(standard.high_risks || 0) > 0) {
      areas.push({
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        severity: Number(standard.critical_risks || 0) > 0 ? 'critica' : 'alta',
        title: 'Riesgos altos pendientes',
        recommendation: 'Validar tratamiento, evidencia y seguimiento ejecutivo de riesgos.',
        route: '/matriz-riesgo',
      });
    }

    if (Number(standard.recommended_actions_open || 0) > 0) {
      areas.push({
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        severity: 'media',
        title: 'Acciones recomendadas abiertas',
        recommendation: 'Convertir, iniciar o descartar acciones recomendadas para cerrar el ciclo operativo.',
        route: '/acciones-recomendadas',
      });
    }
  });

  priorities.slice(0, 6).forEach((priority) => {
    areas.push({
      standard_code: priority.standard_code,
      version_code: priority.version_code,
      severity: priority.priority,
      title: priority.title,
      recommendation: priority.reason,
      route: priority.route,
    });
  });

  return areas.slice(0, 10);
}

async function getPreview(user, filters = {}) {
  const unified = await isoCommandCenter.getUnified(user, filters);
  const notes = [...(unified.data_quality?.notes || [])];
  const standardCode = filters.standard_code ? normalizeStandardCode(filters.standard_code) : null;
  const standards = standardCode
    ? unified.standard_cards.filter((standard) => standard.standard_code === standardCode)
    : unified.standard_cards;
  const questionsFromDb = await loadAuditQuestions(standards, notes);

  const questionsByStandard = standards.map((standard) => {
    const dbQuestions = questionsFromDb
      .filter((question) =>
        question.standard_code === standard.standard_code &&
        (!question.version_code || question.version_code === standard.version_code)
      )
      .slice(0, 8);

    return {
      standard_code: standard.standard_code,
      version_code: standard.version_code,
      questions: (dbQuestions.length ? dbQuestions : fallbackQuestions(standard)).slice(0, 8),
    };
  });

  return {
    tenant_id: unified.tenant_id,
    standards,
    summary: {
      readiness_score: unified.summary.readiness_score,
      readiness_label: unified.summary.readiness_label,
      contracted_standards: unified.summary.contracted_standards,
      open_actions: unified.summary.recommended_actions_open,
      converted_actions: unified.summary.recommended_actions_converted,
      high_risks: unified.summary.high_risks,
      open_findings: unified.summary.open_findings,
      open_nonconformities: unified.summary.open_nonconformities,
    },
    areas_of_review: buildAreasOfReview(standards, unified.priorities),
    audit_questions: questionsByStandard,
    evidence_focus: standards
      .filter((standard) => Number(standard.gaps_count || 0) > 0 || Number(standard.unlinked_iso_controls || 0) > 0)
      .map((standard) => ({
        standard_code: standard.standard_code,
        version_code: standard.version_code,
        gaps_count: standard.gaps_count,
        unlinked_iso_controls: standard.unlinked_iso_controls,
        recommendation: 'Priorizar evidencia trazable para brechas y controles sin mapeo operativo.',
      })),
    warnings: unified.alerts,
    quick_links: unified.quick_links,
    data_quality: {
      ...unified.data_quality,
      notes,
    },
  };
}

module.exports = {
  getPreview,
};
