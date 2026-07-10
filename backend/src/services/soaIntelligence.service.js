const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const { isoQueryAliases, normalizeIsoCode } = require('../utils/isoStandards');
const { validateSoAState } = require('../utils/soaValidation');

const IMPLEMENTATION_STATUSES = ['pendiente', 'implementado', 'parcial', 'no aplica'];
const SOA_AI_ASSESSMENT_TIMEOUT_MS = Math.min(
  Math.max(Number.parseInt(process.env.AI_SOA_ASSESSMENT_TIMEOUT_MS || '12000', 10) || 12000, 1000),
  15000
);

const toNumber = (value) => Number(value || 0);
const boolText = (value) => (value === null || value === undefined ? null : String(value));

function confidenceLevel(score) {
  if (score >= 80) return 'alta';
  if (score >= 50) return 'media';
  return 'baja';
}

function normalizeImplementationStatus(value, fallback = 'pendiente') {
  const normalized = String(value || '').trim().toLowerCase();
  return IMPLEMENTATION_STATUSES.includes(normalized) ? normalized : fallback;
}

function buildRecommendedAction(type, priority, title) {
  return { type, priority, title, human_review_required: true };
}

function evaluateSoARules(context) {
  const official = context.official_soa || {};
  const signals = context.signals || {};
  const evidence = signals.evidence || {};
  const risks = signals.risks || {};
  const findings = signals.findings || {};
  const nonconformities = signals.nonconformities || {};
  const actions = signals.actions || {};
  const health = signals.health || {};

  const evidenceCount = toNumber(evidence.evidence_count);
  const validEvidenceCount = toNumber(evidence.valid_evidence_count || evidence.official_evidence_count || evidence.approved_evidence_count);
  const rejectedEvidenceCount = toNumber(evidence.rejected_evidence_count);
  const expiredEvidenceCount = toNumber(evidence.expired_evidence_count || evidence.expired_or_stale_count);
  const openFindings = toNumber(findings.open_findings_count);
  const highFindings = toNumber(findings.high_findings_count) + toNumber(findings.critical_findings_count);
  const openNc = toNumber(nonconformities.open_nonconformities_count);
  const majorNc = toNumber(nonconformities.major_nonconformities_count);
  const overdueActions = toNumber(actions.overdue_actions_count);
  const highRisk = toNumber(risks.high_risk_count) + toNumber(risks.critical_risk_count) + toNumber(risks.residual_high_count);
  const ownerMissing = !String(official.owner || '').trim();
  const reviewMissing = !official.review_date;
  const healthStatus = String(health.health_status || '').toLowerCase();
  const healthGreen = ['verde', 'green', 'saludable', 'healthy', 'ok'].includes(healthStatus) || toNumber(health.health_score) >= 80;

  let suggestedApplicable = true;
  let suggestedImplementationStatus = 'pendiente';
  let confidence = 45;
  const recommendedActions = [];
  const reasons = [];

  if (official.applicable === false) {
    suggestedApplicable = false;
    suggestedImplementationStatus = 'no aplica';
    confidence = String(official.justification || '').trim() ? 65 : 35;
    reasons.push('El SoA oficial marca el control como no aplicable. Se conserva esa decisión como sugerencia hasta revisión humana.');
  } else {
    suggestedApplicable = true;
    if (validEvidenceCount > 0 && openFindings === 0 && openNc === 0 && overdueActions === 0 && highRisk === 0 && healthGreen) {
      suggestedImplementationStatus = 'implementado';
      confidence = 82;
      reasons.push('Hay evidencia valida y no se observan hallazgos, no conformidades, riesgos altos ni acciones vencidas asociadas.');
    } else if (evidenceCount > 0 || rejectedEvidenceCount > 0 || expiredEvidenceCount > 0) {
      suggestedImplementationStatus = 'parcial';
      confidence = 64;
      reasons.push('Existe evidencia, pero no toda es valida o hay señales pendientes para concluir implementacion completa.');
    } else if (highFindings > 0 || majorNc > 0 || highRisk > 0) {
      suggestedImplementationStatus = 'pendiente';
      confidence = 58;
      reasons.push('No hay evidencia suficiente y existen señales de riesgo, hallazgos o no conformidades relevantes.');
    } else {
      suggestedImplementationStatus = 'pendiente';
      confidence = 46;
      reasons.push('No hay señales suficientes para afirmar implementación. Requiere revisión y evidencia.');
    }
  }

  if (validEvidenceCount === 0) {
    confidence -= 8;
    recommendedActions.push(buildRecommendedAction('update_evidence', 'media', 'Registrar o vincular evidencia del control'));
  }
  if (rejectedEvidenceCount > 0) {
    confidence -= 6;
    recommendedActions.push(buildRecommendedAction('replace_rejected_evidence', 'alta', 'Reemplazar evidencia rechazada asociada'));
  }
  if (expiredEvidenceCount > 0) {
    confidence -= 6;
    recommendedActions.push(buildRecommendedAction('refresh_expired_evidence', 'alta', 'Actualizar evidencia vencida asociada'));
  }
  if (ownerMissing) {
    confidence -= 5;
    recommendedActions.push(buildRecommendedAction('assign_owner', 'media', 'Asignar responsable del control'));
  }
  if (reviewMissing) {
    confidence -= 5;
    recommendedActions.push(buildRecommendedAction('review_control', 'media', 'Programar revisión del control'));
  }
  if (openFindings > 0 || openNc > 0) {
    confidence -= 8;
    recommendedActions.push(buildRecommendedAction('resolve_findings', 'alta', 'Cerrar hallazgos o no conformidades abiertas'));
  }
  if (overdueActions > 0) {
    confidence -= 6;
    recommendedActions.push(buildRecommendedAction('recover_overdue_actions', 'alta', 'Regularizar acciones vencidas asociadas'));
  }
  if (highRisk > 0) {
    confidence -= 6;
    recommendedActions.push(buildRecommendedAction('treat_high_risk', 'alta', 'Revisar tratamiento de riesgos altos asociados'));
  }
  if (official.applicable === false && highRisk > 0) {
    confidence -= 10;
    reasons.push('Existen riesgos altos o criticos asociados a un control marcado como no aplicable; requiere revision humana.');
  }
  if (official.applicable === false && !String(official.justification || '').trim()) {
    recommendedActions.push(buildRecommendedAction('justify_exclusion', 'alta', 'Documentar justificación de no aplicabilidad'));
  }

  confidence = Math.max(10, Math.min(95, Math.round(confidence)));

  return {
    suggested_applicable: suggestedApplicable,
    suggested_implementation_status: suggestedImplementationStatus,
    confidence_score: confidence,
    confidence_level: confidenceLevel(confidence),
    suggested_justification: reasons.join(' '),
    rule_results: {
      evidence_present: evidenceCount > 0,
      official_evidence_present: validEvidenceCount > 0,
      rejected_evidence: rejectedEvidenceCount > 0,
      expired_evidence: expiredEvidenceCount > 0,
      open_findings: openFindings > 0,
      open_nonconformities: openNc > 0,
      high_risk: highRisk > 0,
      overdue_actions: overdueActions > 0,
      owner_missing: ownerMissing,
      review_missing: reviewMissing,
      human_review_required: true,
    },
    recommended_actions: recommendedActions,
  };
}

async function loadRows(tenantId, iso) {
  const canonicalIso = normalizeIsoCode(iso);
  const isoAliases = isoQueryAliases(canonicalIso);
  const result = await pool.query(
    `
    SELECT
      c.id AS tenant_control_id,
      c.tenant_id,
      c.iso_code AS iso,
      c.clause,
      c.catalog_control_id,
      COALESCE(cc.category, 'General') AS category,
      COALESCE(cc.description, 'Control ' || c.clause) AS description,
      COALESCE(NULLIF(c.status, ''), 'pendiente') AS diagnostic_status,
      COALESCE(c.score, 0) AS score,
      cs.applicable,
      cs.implementation_status,
      cs.justification,
      cs.notes,
      cs.owner,
      cs.review_date,
      COALESCE(array_remove(array_agg(DISTINCT tc.id), NULL), ARRAY[]::uuid[]) AS linked_tenant_control_ids
    FROM controls c
    LEFT JOIN control_soa cs ON cs.tenant_control_id = c.id
    LEFT JOIN controls_catalog cc ON cc.id = c.catalog_control_id
    LEFT JOIN tenant_controls tc
      ON tc.tenant_id = c.tenant_id
     AND tc.control_id = c.catalog_control_id
    WHERE c.tenant_id = $1
      AND c.iso_code = ANY($2::text[])
    GROUP BY c.id, cc.category, cc.description, cs.tenant_control_id
    ORDER BY c.clause, c.created_at
    `,
    [tenantId, isoAliases]
  );
  return result.rows;
}

function keyMap(rows, key = 'tenant_control_id') {
  const map = new Map();
  rows.forEach((row) => map.set(row[key], row));
  return map;
}

async function loadSignalMaps(tenantId, iso) {
  const canonicalIso = normalizeIsoCode(iso);
  const isoAliases = isoQueryAliases(canonicalIso);
  const [evidence, findings, nonconformities, actions, risks, health, audits, kpis, latestAssessments] = await Promise.all([
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        COUNT(DISTINCT e.id)::int AS evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE (
            e.validated = TRUE
            OR lower(COALESCE(e.status, '')) IN ('aprobada','aprobado','approved','validada','validated')
          )
          AND lower(COALESCE(e.status, '')) NOT IN ('rechazada','rechazado','rejected')
          AND (e.expires_at IS NULL OR e.expires_at >= CURRENT_DATE)
        )::int AS valid_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE lower(COALESCE(e.status, '')) IN ('rechazada','rechazado','rejected')
        )::int AS rejected_evidence_count,
        COUNT(DISTINCT e.id) FILTER (
          WHERE e.expires_at IS NOT NULL AND e.expires_at < CURRENT_DATE
        )::int AS expired_evidence_count,
        COUNT(DISTINCT e.id) FILTER (WHERE e.validated = TRUE OR lower(COALESCE(e.status, '')) IN ('aprobada','aprobado','approved','validada','validated'))::int AS official_evidence_count,
        COUNT(DISTINCT e.id) FILTER (WHERE e.created_at >= NOW() - INTERVAL '90 days')::int AS recent_evidence_count,
        MAX(e.created_at) AS last_evidence_date,
        COUNT(DISTINCT e.id) FILTER (WHERE e.expires_at IS NOT NULL AND e.expires_at < CURRENT_DATE)::int AS expired_or_stale_count,
        COUNT(DISTINCT e.id) FILTER (WHERE e.last_ai_analyzed_at IS NOT NULL OR e.ai_analysis_status IN ('completed','ok','analizada'))::int AS ai_assessed_count,
        COUNT(DISTINCT e.id) FILTER (WHERE lower(COALESCE(e.status, '')) IN ('aprobada','approved','validada'))::int AS sufficient_count,
        'tenant_control_id/catalog_control_id' AS relation
      FROM controls c
      LEFT JOIN tenant_controls tc ON tc.tenant_id = c.tenant_id AND tc.control_id = c.catalog_control_id
      LEFT JOIN evidences e ON e.tenant_id = c.tenant_id AND (e.tenant_control_id = tc.id OR e.control_id = c.id)
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        COUNT(DISTINCT f.id)::int AS finding_count,
        COUNT(DISTINCT f.id) FILTER (WHERE f.closed_at IS NULL AND lower(COALESCE(f.status, 'abierto')) NOT IN ('cerrado','closed','resuelto'))::int AS open_findings_count,
        COUNT(DISTINCT f.id) FILTER (WHERE lower(COALESCE(f.severity, '')) = 'alta')::int AS high_findings_count,
        COUNT(DISTINCT f.id) FILTER (WHERE lower(COALESCE(f.severity, '')) = 'critica')::int AS critical_findings_count,
        'tenant_control_id' AS relation
      FROM controls c
      LEFT JOIN findings f ON f.tenant_id = c.tenant_id AND (f.iso_code = c.iso_code OR f.iso_code = ANY($2::text[])) AND f.tenant_control_id = c.id
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        COUNT(DISTINCT nc.id)::int AS nonconformity_count,
        COUNT(DISTINCT nc.id) FILTER (WHERE nc.resolved_at IS NULL AND lower(COALESCE(nc.status, 'abierta')) NOT IN ('cerrada','closed','resuelta'))::int AS open_nonconformities_count,
        COUNT(DISTINCT nc.id) FILTER (WHERE lower(COALESCE(nc.status, '')) IN ('mayor','major','critica','crítica'))::int AS major_nonconformities_count,
        COUNT(DISTINCT nc.id) FILTER (WHERE nc.resolved_at IS NULL AND nc.detected_at < NOW() - INTERVAL '30 days')::int AS overdue_nonconformities_count,
        'control_id/tenant_control_id' AS relation
      FROM controls c
      LEFT JOIN tenant_controls tc ON tc.tenant_id = c.tenant_id AND tc.control_id = c.catalog_control_id
      LEFT JOIN tenant_nonconformities nc ON nc.tenant_id = c.tenant_id AND (nc.control_id = c.id OR nc.control_id = tc.id)
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        COUNT(DISTINCT ap.id)::int AS actions_count,
        COUNT(DISTINCT ap.id) FILTER (WHERE lower(COALESCE(ap.status, 'abierto')) NOT IN ('cerrado','closed','completado','completed'))::int AS open_actions_count,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE AND lower(COALESCE(ap.status, 'abierto')) NOT IN ('cerrado','closed','completado','completed'))::int AS overdue_actions_count,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.completed_at IS NOT NULL OR lower(COALESCE(ap.status, '')) IN ('cerrado','closed','completado','completed'))::int AS completed_actions_count,
        'tenant_controls' AS relation
      FROM controls c
      LEFT JOIN tenant_controls tc ON tc.tenant_id = c.tenant_id AND tc.control_id = c.catalog_control_id
      LEFT JOIN action_plans ap ON ap.tenant_id = c.tenant_id AND (ap.iso_code = c.iso_code OR ap.iso_code = ANY($2::text[])) AND ap.tenant_control_id = tc.id
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        COUNT(DISTINCT ri.id)::int AS risk_count,
        COUNT(DISTINCT ri.id) FILTER (WHERE lower(COALESCE(ri.inherent_risk_level, '')) = 'alto')::int AS high_risk_count,
        COUNT(DISTINCT ri.id) FILTER (WHERE lower(COALESCE(ri.inherent_risk_level, '')) IN ('critico','crítico'))::int AS critical_risk_count,
        COUNT(DISTINCT ri.id) FILTER (WHERE lower(COALESCE(ri.status, '')) NOT IN ('closed','cerrado','mitigado'))::int AS open_treatment_count,
        COUNT(DISTINCT ri.id) FILTER (WHERE lower(COALESCE(ri.residual_risk_level, '')) IN ('alto','critico','crítico'))::int AS residual_high_count,
        'catalog_control_id/tenant_control_id' AS relation
      FROM controls c
      LEFT JOIN tenant_controls tc ON tc.tenant_id = c.tenant_id AND tc.control_id = c.catalog_control_id
      LEFT JOIN iso_risk_matrix_items ri ON ri.tenant_id = c.tenant_id AND (ri.standard_code = c.iso_code OR ri.standard_code = ANY($2::text[])) AND (ri.catalog_control_id = c.catalog_control_id OR ri.tenant_control_id = tc.id)
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT c.id AS tenant_control_id,
        ROUND(AVG(chs.health_score), 2) AS health_score,
        COALESCE((array_agg(chs.health_status ORDER BY chs.calculated_at DESC))[1], 'sin_datos') AS health_status,
        SUM(COALESCE(chs.evidence_count, 0))::int AS evidence_count,
        SUM(COALESCE(chs.open_findings_count, 0))::int AS open_findings_count,
        SUM(COALESCE(chs.open_actions_count, 0))::int AS open_actions_count,
        SUM(COALESCE(chs.overdue_actions_count, 0))::int AS overdue_actions_count,
        SUM(COALESCE(chs.high_risks_count, 0))::int AS high_risks_count,
        'control_health_scores' AS relation
      FROM controls c
      LEFT JOIN tenant_controls tc ON tc.tenant_id = c.tenant_id AND tc.control_id = c.catalog_control_id
      LEFT JOIN control_health_scores chs ON chs.tenant_id = c.tenant_id AND (chs.standard_code = c.iso_code OR chs.standard_code = ANY($2::text[])) AND (chs.tenant_control_id = tc.id OR chs.catalog_control_id = c.catalog_control_id)
      WHERE c.tenant_id = $1 AND c.iso_code = ANY($2::text[])
      GROUP BY c.id
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT COUNT(*)::int AS audit_mentions_count,
        MAX(COALESCE(a.end_date, a.start_date)) AS last_audit_date,
        COUNT(*) FILTER (WHERE lower(COALESCE(a.audit_result, '')) LIKE '%observ%')::int AS audit_observations_count
      FROM audits a
      WHERE a.tenant_id = $1 AND a.iso = ANY($2::text[])
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT COUNT(*)::int AS kpi_count,
        COUNT(*) FILTER (WHERE status_color::text IN ('red','yellow'))::int AS bad_kpi_count,
        ROUND(AVG(value), 2) AS avg_value
      FROM v_latest_health_kpi_snapshots
      WHERE tenant_id = $1 AND standard_code = ANY($2::text[])
      `,
      [tenantId, isoAliases]
    ),
    pool.query(
      `
      SELECT DISTINCT ON (tenant_control_id)
        *
      FROM control_soa_assessments
      WHERE tenant_id = $1 AND iso_code = ANY($2::text[])
      ORDER BY tenant_control_id, created_at DESC
      `,
      [tenantId, isoAliases]
    ),
  ]);

  return {
    evidence: keyMap(evidence.rows),
    findings: keyMap(findings.rows),
    nonconformities: keyMap(nonconformities.rows),
    actions: keyMap(actions.rows),
    risks: keyMap(risks.rows),
    health: keyMap(health.rows),
    audit: audits.rows[0] || {},
    kpi: kpis.rows[0] || {},
    latestAssessments: keyMap(latestAssessments.rows),
  };
}

function buildContext(row, maps) {
  return {
    control: {
      tenant_control_id: row.tenant_control_id,
      iso: row.iso,
      clause: row.clause,
      category: row.category,
      description: row.description,
      diagnostic_status: row.diagnostic_status,
      score: toNumber(row.score),
      catalog_control_id: row.catalog_control_id,
      linked_tenant_control_ids: row.linked_tenant_control_ids || [],
    },
    official_soa: {
      applicable: row.applicable,
      implementation_status: row.implementation_status || 'pendiente',
      justification: row.justification,
      notes: row.notes,
      owner: row.owner,
      review_date: row.review_date,
    },
    signals: {
      evidence: maps.evidence.get(row.tenant_control_id) || {},
      risks: maps.risks.get(row.tenant_control_id) || {},
      findings: maps.findings.get(row.tenant_control_id) || {},
      nonconformities: maps.nonconformities.get(row.tenant_control_id) || {},
      actions: maps.actions.get(row.tenant_control_id) || {},
      audits: maps.audit || {},
      health: maps.health.get(row.tenant_control_id) || {},
      kpis: maps.kpi || {},
    },
  };
}

function differs(official, suggestion) {
  return (
    official.applicable !== suggestion.suggested_applicable ||
    normalizeImplementationStatus(official.implementation_status) !== suggestion.suggested_implementation_status
  );
}

function buildIntelligenceSummary(rows) {
  return rows.reduce((acc, row) => {
    const signals = row.signals || {};
    const suggestion = row.system_suggestion || {};
    acc.total_controls += 1;
    if (toNumber(signals.evidence?.valid_evidence_count || signals.evidence?.official_evidence_count) > 0) acc.controls_with_evidence += 1;
    if (toNumber(signals.findings?.open_findings_count) > 0) acc.controls_with_open_findings += 1;
    if (toNumber(signals.nonconformities?.open_nonconformities_count) > 0) acc.controls_with_open_nc += 1;
    if ((toNumber(signals.risks?.high_risk_count) + toNumber(signals.risks?.critical_risk_count) + toNumber(signals.risks?.residual_high_count)) > 0) acc.controls_with_high_risk += 1;
    if (toNumber(signals.actions?.overdue_actions_count) > 0) acc.controls_with_overdue_actions += 1;
    if (suggestion.suggested_implementation_status) acc.controls_with_suggestions += 1;
    if (differs(row.official, suggestion)) acc.official_vs_suggested_differences += 1;
    if (suggestion.confidence_level === 'baja') acc.low_confidence_suggestions += 1;
    return acc;
  }, {
    total_controls: 0,
    controls_with_evidence: 0,
    controls_with_open_findings: 0,
    controls_with_open_nc: 0,
    controls_with_high_risk: 0,
    controls_with_overdue_actions: 0,
    controls_with_suggestions: 0,
    official_vs_suggested_differences: 0,
    low_confidence_suggestions: 0,
  });
}

async function getSoAIntelligence({ tenantId, iso }) {
  const rows = await loadRows(tenantId, iso);
  const maps = await loadSignalMaps(tenantId, iso);
  const intelligenceRows = rows.map((row) => {
    const context = buildContext(row, maps);
    const systemSuggestion = evaluateSoARules(context);
    return {
      tenant_control_id: row.tenant_control_id,
      clause: row.clause,
      category: row.category,
      description: row.description,
      official: context.official_soa,
      signals: context.signals,
      system_suggestion: systemSuggestion,
      latest_assessment: maps.latestAssessments.get(row.tenant_control_id) || null,
    };
  });
  return {
    tenant_id: tenantId,
    iso,
    generated_at: new Date().toISOString(),
    summary: buildIntelligenceSummary(intelligenceRows),
    rows: intelligenceRows,
  };
}

async function getSoAControlContext({ tenantId, iso, tenantControlId }) {
  const rows = await loadRows(tenantId, iso);
  const row = rows.find((item) => item.tenant_control_id === tenantControlId);
  if (!row) return null;
  const maps = await loadSignalMaps(tenantId, iso);
  const context = buildContext(row, maps);
  return {
    ...context,
    system_suggestion: evaluateSoARules(context),
    latest_assessment: maps.latestAssessments.get(row.tenant_control_id) || null,
  };
}

async function saveAssessment({ tenantId, iso, context, suggestion, source = 'system', aiResult = {}, userId = null }) {
  const result = await pool.query(
    `
    INSERT INTO control_soa_assessments (
      tenant_id, tenant_control_id, iso_code, source, status,
      suggested_applicable, suggested_implementation_status, suggested_justification,
      confidence_score, confidence_level,
      evidence_summary, risk_summary, finding_summary, nonconformity_summary,
      action_summary, audit_summary, health_summary, kpi_summary,
      rule_results, ai_result, recommended_actions, ai_model, ai_prompt_version,
      reviewed_by, reviewed_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'draft',
      $5, $6, $7,
      $8, $9,
      $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
      $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
      $18::jsonb, $19::jsonb, $20::jsonb, $21, $22,
      $23, CASE WHEN $23::uuid IS NULL THEN NULL ELSE NOW() END, NOW()
    ) RETURNING *
    `,
    [
      tenantId,
      context.control.tenant_control_id,
      iso,
      source,
      suggestion.suggested_applicable,
      suggestion.suggested_implementation_status,
      suggestion.suggested_justification,
      suggestion.confidence_score,
      suggestion.confidence_level,
      JSON.stringify(context.signals.evidence || {}),
      JSON.stringify(context.signals.risks || {}),
      JSON.stringify(context.signals.findings || {}),
      JSON.stringify(context.signals.nonconformities || {}),
      JSON.stringify(context.signals.actions || {}),
      JSON.stringify(context.signals.audits || {}),
      JSON.stringify(context.signals.health || {}),
      JSON.stringify(context.signals.kpis || {}),
      JSON.stringify(suggestion.rule_results || {}),
      JSON.stringify(aiResult || {}),
      JSON.stringify(suggestion.recommended_actions || []),
      aiResult?.model || aiResult?.engine?.model || null,
      aiResult?.prompt_version || aiResult?.engine?.prompt_version || null,
      userId,
    ]
  );
  return result.rows[0];
}

function mergeAiSuggestion(systemSuggestion, aiResult) {
  const structured = aiResult?.structured_result || aiResult || {};
  const confidence = Number(structured.confidence_score ?? systemSuggestion.confidence_score);
  return {
    ...systemSuggestion,
    suggested_applicable: typeof structured.suggested_applicable === 'boolean' ? structured.suggested_applicable : systemSuggestion.suggested_applicable,
    suggested_implementation_status: normalizeImplementationStatus(structured.suggested_implementation_status, systemSuggestion.suggested_implementation_status),
    suggested_justification: String(structured.suggested_justification || systemSuggestion.suggested_justification || '').slice(0, 2000),
    confidence_score: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : systemSuggestion.confidence_score,
    confidence_level: ['alta', 'media', 'baja'].includes(structured.confidence_level) ? structured.confidence_level : confidenceLevel(confidence),
    recommended_actions: Array.isArray(structured.recommended_actions) && structured.recommended_actions.length
      ? structured.recommended_actions
      : systemSuggestion.recommended_actions,
  };
}

function normalizeAiFallbackReason(aiResult, error = null, defaultReason = 'AI_ENGINE_TIMEOUT') {
  const errorType = String(
    error?.code ||
      aiResult?.engine?.error_type ||
      aiResult?.code ||
      aiResult?.error_type ||
      ''
  );
  const message = String(error?.message || aiResult?.engine?.error_message || aiResult?.error || '').toLowerCase();
  if (errorType === 'AI_ENGINE_TIMEOUT' || errorType === 'AI_AUDITOR_TIMEOUT' || message.includes('timeout')) {
    return 'AI_ENGINE_TIMEOUT';
  }
  return defaultReason;
}

function buildSoAAiFallbackResult({ systemSuggestion, aiResult = {}, error = null, reason = null, timeoutMs = SOA_AI_ASSESSMENT_TIMEOUT_MS }) {
  const fallbackReason = reason || normalizeAiFallbackReason(aiResult, error, 'SOA_AI_TIMEOUT');
  return {
    suggestion: {
      ...systemSuggestion,
      rule_results: {
        ...(systemSuggestion.rule_results || {}),
        ai_used: false,
        fallback_used: true,
        fallback_reason: fallbackReason,
        human_review_required: true,
      },
    },
    aiResult: {
      ...(aiResult || {}),
      ok: false,
      ai_used: false,
      fallback_used: true,
      fallback_reason: fallbackReason,
      human_review_required: true,
      engine: {
        ...(aiResult?.engine || {}),
        ai_engine_used: false,
        fallback_used: true,
        error_type: fallbackReason,
        timeout_ms: aiResult?.engine?.timeout_ms || error?.timeout_ms || timeoutMs,
      },
    },
  };
}

async function runSystemAssessment({ tenantId, iso, tenantControlId, userId = null, useAi = false, forceAiFallbackReason = null }) {
  const context = await getSoAControlContext({ tenantId, iso, tenantControlId });
  if (!context) return null;
  const systemSuggestion = context.system_suggestion || evaluateSoARules(context);
  let source = 'system';
  let aiResult = {};
  let finalSuggestion = systemSuggestion;
  if (useAi || forceAiFallbackReason) {
    if (forceAiFallbackReason) {
      const fallback = buildSoAAiFallbackResult({
        systemSuggestion,
        reason: forceAiFallbackReason,
      });
      finalSuggestion = fallback.suggestion;
      aiResult = fallback.aiResult;
    } else {
      try {
        aiResult = await aiEngineClient.assessSoAControl({
          tenant_id: tenantId,
          iso,
          control: context.control,
          official_soa: context.official_soa,
          signals: context.signals,
          system_suggestion: systemSuggestion,
          request_metadata: { source: 'soa_intelligence' },
        }, { timeoutMs: SOA_AI_ASSESSMENT_TIMEOUT_MS });
        if (aiResult?.ok !== false && !aiResult?.engine?.fallback_used) {
          finalSuggestion = mergeAiSuggestion(systemSuggestion, aiResult);
          source = 'hybrid';
        } else {
          const fallback = buildSoAAiFallbackResult({
            systemSuggestion,
            aiResult,
            reason: normalizeAiFallbackReason(aiResult, null, 'SOA_AI_TIMEOUT'),
          });
          finalSuggestion = fallback.suggestion;
          aiResult = fallback.aiResult;
        }
      } catch (error) {
        const fallback = buildSoAAiFallbackResult({
          systemSuggestion,
          error,
          reason: normalizeAiFallbackReason(null, error, 'SOA_AI_TIMEOUT'),
        });
        finalSuggestion = fallback.suggestion;
        aiResult = fallback.aiResult;
      }
    }
  }
  return saveAssessment({ tenantId, iso, context, suggestion: finalSuggestion, source, aiResult, userId });
}

async function runSystemAssessmentBatch({ tenantId, iso, limit = 50, userId = null, useAi = false }) {
  const rows = await loadRows(tenantId, iso);
  const maps = await loadSignalMaps(tenantId, iso);
  const scoredRows = rows
    .map((row) => {
      const context = buildContext(row, maps);
      const signals = context.signals || {};
      const score =
        toNumber(signals.risks?.critical_risk_count) * 50 +
        toNumber(signals.risks?.high_risk_count) * 35 +
        toNumber(signals.risks?.residual_high_count) * 30 +
        toNumber(signals.nonconformities?.open_nonconformities_count) * 25 +
        toNumber(signals.findings?.open_findings_count) * 15 +
        toNumber(signals.actions?.overdue_actions_count) * 12 +
        toNumber(signals.evidence?.rejected_evidence_count) * 10 +
        toNumber(signals.evidence?.expired_evidence_count) * 8 +
        (row.applicable === false && !String(row.justification || '').trim() ? 20 : 0) +
        (row.applicable === true && normalizeImplementationStatus(row.implementation_status) === 'implementado' && toNumber(signals.evidence?.valid_evidence_count) === 0 ? 18 : 0);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score || String(a.row.clause || '').localeCompare(String(b.row.clause || '')));
  const capped = scoredRows.slice(0, Math.max(1, Math.min(Number(limit) || 50, 100))).map((item) => item.row);
  const created = [];
  const batchFallbackReason = useAi ? 'SOA_AI_TIMEOUT' : null;
  for (const row of capped) {
    const assessment = await runSystemAssessment({
      tenantId,
      iso,
      tenantControlId: row.tenant_control_id,
      userId,
      useAi: useAi && !batchFallbackReason,
      forceAiFallbackReason: batchFallbackReason,
    });
    if (assessment) created.push(assessment);
  }
  return {
    ok: true,
    tenant_id: tenantId,
    iso,
    requested: capped.length,
    created_count: created.length,
    ai_fallback_forced: Boolean(batchFallbackReason),
    fallback_reason: batchFallbackReason,
    assessments: created,
  };
}

async function listAssessments({ tenantId, iso }) {
  const isoAliases = isoQueryAliases(iso);
  const result = await pool.query(
    `
    SELECT a.*, c.clause, COALESCE(cc.category, 'General') AS category, COALESCE(cc.description, 'Control ' || c.clause) AS description
    FROM control_soa_assessments a
    JOIN controls c ON c.id = a.tenant_control_id AND c.tenant_id = a.tenant_id
    LEFT JOIN controls_catalog cc ON cc.id = c.catalog_control_id
    WHERE a.tenant_id = $1 AND a.iso_code = ANY($2::text[])
    ORDER BY a.created_at DESC
    LIMIT 500
    `,
    [tenantId, isoAliases]
  );
  return result.rows;
}

async function applyAssessment({ tenantId, assessmentId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assessmentResult = await client.query(
      `
      SELECT a.*
      FROM control_soa_assessments a
      JOIN controls c ON c.id = a.tenant_control_id AND c.tenant_id = a.tenant_id
      WHERE a.id = $1 AND a.tenant_id = $2
      FOR UPDATE OF a
      `,
      [assessmentId, tenantId]
    );
    if (!assessmentResult.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const assessment = assessmentResult.rows[0];
    if (['applied', 'rejected'].includes(assessment.status)) {
      await client.query('ROLLBACK');
      const error = new Error('Assessment ya fue aplicado o rechazado');
      error.code = 'ASSESSMENT_CLOSED';
      throw error;
    }

    const nextApplicable = assessment.suggested_applicable;
    const nextStatus = normalizeImplementationStatus(assessment.suggested_implementation_status);
    const nextJustification = assessment.suggested_justification || null;
    const validation = validateSoAState({
      applicable: nextApplicable,
      implementation_status: nextStatus,
      justification: nextJustification,
    });

    if (!validation.ok) {
      await client.query('ROLLBACK');
      const error = new Error(`Assessment SoA invalido: ${validation.errors.join('; ')}`);
      error.code = 'ASSESSMENT_INVALID_SUGGESTION';
      error.status = 400;
      throw error;
    }

    const currentResult = await client.query(
      `
      SELECT applicable, implementation_status, justification
      FROM control_soa
      WHERE tenant_control_id = $1
      FOR UPDATE
      `,
      [assessment.tenant_control_id]
    );
    const currentSoA = currentResult.rows[0] || {};

    await client.query(
      `
      INSERT INTO control_soa (tenant_control_id, applicable, implementation_status, justification, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (tenant_control_id)
      DO UPDATE SET
        applicable = EXCLUDED.applicable,
        implementation_status = EXCLUDED.implementation_status,
        justification = EXCLUDED.justification,
        updated_at = NOW()
      `,
      [assessment.tenant_control_id, nextApplicable, nextStatus, nextJustification]
    );

    const changes = [
      ['applicable', boolText(currentSoA.applicable), boolText(nextApplicable)],
      ['implementation_status', currentSoA.implementation_status || 'pendiente', nextStatus],
      ['justification', currentSoA.justification || null, nextJustification],
    ].filter(([, oldValue, newValue]) => String(oldValue || '') !== String(newValue || ''));

    for (const [field, oldValue, newValue] of changes) {
      await client.query(
        `
        INSERT INTO control_soa_change_log (
          tenant_id, tenant_control_id, assessment_id, source, field_changed,
          old_value, new_value, reason, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [tenantId, assessment.tenant_control_id, assessmentId, assessment.source === 'hybrid' || assessment.source === 'ai' ? 'ai_suggestion_applied' : 'system_suggestion_applied', field, oldValue, newValue, assessment.suggested_justification || 'Sugerencia SoA aprobada por usuario autorizado', userId]
      );
    }

    const updateResult = await client.query(
      `
      UPDATE control_soa_assessments
      SET status = 'applied', applied_by = $3, applied_at = NOW(), reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
      `,
      [assessmentId, tenantId, userId]
    );
    await client.query('COMMIT');
    return { assessment: updateResult.rows[0], changes };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function rejectAssessment({ tenantId, assessmentId, userId }) {
  const result = await pool.query(
    `
    UPDATE control_soa_assessments
    SET status = 'rejected', rejected_by = $3, rejected_at = NOW(), reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('applied','rejected')
    RETURNING *
    `,
    [assessmentId, tenantId, userId]
  );
  return result.rows[0] || null;
}

async function getChangeLog({ tenantId, iso }) {
  const isoAliases = isoQueryAliases(iso);
  const result = await pool.query(
    `
    SELECT l.*, c.clause, COALESCE(cc.category, 'General') AS category
    FROM control_soa_change_log l
    JOIN controls c ON c.id = l.tenant_control_id AND c.tenant_id = l.tenant_id
    LEFT JOIN controls_catalog cc ON cc.id = c.catalog_control_id
    WHERE l.tenant_id = $1 AND c.iso_code = ANY($2::text[])
    ORDER BY l.changed_at DESC
    LIMIT 500
    `,
    [tenantId, isoAliases]
  );
  return result.rows;
}

module.exports = {
  evaluateSoARules,
  getSoAControlContext,
  getSoAIntelligence,
  runSystemAssessment,
  runSystemAssessmentBatch,
  listAssessments,
  applyAssessment,
  rejectAssessment,
  getChangeLog,
};
