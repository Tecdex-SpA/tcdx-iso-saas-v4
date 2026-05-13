const pool = require('../../config/db');
const { renderAiAuditorPremiumTemplate } = require('../../reports/templates/aiAuditorPremium.template');

const AI_ENGINE_URL =
  process.env.AI_ENGINE_URL || 'http://192.168.100.140:8001';

function getAiInternalToken() {
  const token = process.env.AI_INTERNAL_TOKEN || process.env.AI_TOKEN || '';

  if (!token) {
    throw new Error('AI_INTERNAL_TOKEN no configurado');
  }

  return token;
}

async function safeQuery(sql, params = [], fallback = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows || fallback;
  } catch (error) {
    console.error('REPORT SAFE QUERY ERROR:', error.message);
    return fallback;
  }
}

async function safeAiCall(path, payload = {}, fallback = null, timeoutMs = 18000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AI_ENGINE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Token': getAiInternalToken(),
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal,
    });

    const text = await response.text();

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta inválida desde AI Engine (${response.status})`);
    }

    if (!response.ok || !json || json.ok === false) {
      throw new Error(json?.detail || json?.error || 'Error llamando AI Engine');
    }

    return json;
  } catch (error) {
    console.error(`REPORT AI CALL ERROR [${path}]:`, error.message);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return asString(value).toLowerCase();
}

function clampPercent(value) {
  const n = toNumber(value, 0);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 10) / 10;
}

function percent(value, total) {
  const safeTotal = toNumber(total, 0);
  if (!safeTotal) return 0;
  return Math.round((toNumber(value, 0) / safeTotal) * 1000) / 10;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const safe = asString(value);
    if (safe) return safe;
  }
  return '';
}

function dedupeStrings(items = [], limit = 12) {
  const seen = new Set();
  const result = [];

  for (const item of items.flat(Infinity)) {
    const value = asString(item);
    const key = normalizeText(value);

    if (!value || seen.has(key)) continue;

    seen.add(key);
    result.push(value);

    if (result.length >= limit) break;
  }

  return result;
}

function maybeRepairUtf8(value) {
  const raw = asString(value);
  if (!raw) return '';

  const suspicious = /Ã|Â|Ê|Ì|Ñ|ð|�/;
  if (!suspicious.test(raw)) {
    return raw;
  }

  try {
    const repaired = Buffer.from(raw, 'latin1').toString('utf8');
    if (repaired && repaired !== raw) {
      return repaired;
    }
  } catch {
    // ignore
  }

  return raw;
}

function cleanDisplayText(value) {
  return maybeRepairUtf8(value)
    .replace(/[\u0000-\u001F\u007F-\u009F\uFFFE\uFFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanKpiCode(value) {
  const normalized = cleanDisplayText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) return '-';

  const match = normalized.match(/^(KPI)-?(HLT)-?(\d+)$/i);
  if (match) {
    return `KPI-HLT-${String(match[3]).padStart(3, '0')}`;
  }

  return normalized.toUpperCase();
}

function cleanKpiName(value) {
  return cleanDisplayText(value) || 'KPI sin nombre';
}

function normalizeConfidence(value) {
  const normalized = normalizeText(value);
  if (['alta', 'high'].includes(normalized)) return 'alta';
  if (['baja', 'low'].includes(normalized)) return 'baja';
  return normalized || 'media';
}

function normalizePriority(value) {
  const normalized = normalizeText(value);

  if (['alta', 'high', 'critical', 'critica', 'crítica'].includes(normalized)) {
    return 'alta';
  }

  if (['baja', 'low'].includes(normalized)) {
    return 'baja';
  }

  return 'media';
}

function getGeneralStatus(score) {
  const value = toNumber(score, 0);
  if (value >= 85) return 'Saludable';
  if (value >= 65) return 'Atención';
  return 'Crítico';
}

function getAudience(reportTypeCode, role) {
  const normalizedRole = normalizeText(role);

  if (reportTypeCode === 'executive_summary') return 'gerencia';
  if (reportTypeCode === 'audit_report') return 'auditoria';
  if (reportTypeCode === 'control_status') return 'control_estado';
  if (reportTypeCode === 'platform_client_monthly') return 'plataforma_cliente';

  if (normalizedRole === 'auditor') return 'auditoria';
  if (normalizedRole === 'dealer') return 'plataforma_cliente';

  if (
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin'
  ) {
    return 'plataforma_cliente';
  }

  return 'gerencia';
}

function severityRank(value) {
  const normalized = normalizeText(value);

  if (['critical', 'critico', 'crítico'].includes(normalized)) return 1;
  if (['alta', 'alto', 'high'].includes(normalized)) return 2;
  if (['media', 'medio', 'medium'].includes(normalized)) return 3;
  return 4;
}

function shouldKeepInsight(text) {
  const value = normalizeText(text);

  if (!value) return false;
  if (/^iso[\w/.-]*\s*\(\d+([.,]\d+)?%\)$/.test(value)) return false;
  if (/^regularizar 0 /.test(value)) return false;
  if (/^tratar 0 /.test(value)) return false;
  if (/^disminuir 0 /.test(value)) return false;
  if (/^sin riesgos destacados/.test(value)) return false;
  if (/^sin decisiones sugeridas/.test(value)) return false;
  if (/^sin prioridades sugeridas/.test(value)) return false;
  return true;
}

function filterInsights(items = [], limit = 6) {
  return dedupeStrings(asArray(items), limit)
    .map(cleanDisplayText)
    .filter(shouldKeepInsight)
    .slice(0, limit);
}

function normalizeKnowledgeSources(items = []) {
  const seen = new Set();
  const result = [];

  for (const item of asArray(items)) {
    const recordId = asString(item?.record_id);
    const norma = cleanDisplayText(item?.norma);
    const clause = cleanDisplayText(item?.clausula_o_control);
    const title = cleanDisplayText(item?.titulo);
    const key = recordId || `${norma}__${clause}__${title}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);

    result.push({
      record_id: recordId || null,
      norma: norma || null,
      clausula_o_control: clause || null,
      titulo: title || null,
      is_draft: item?.is_draft === true,
    });
  }

  return result;
}

function mergeKnowledgeSources(...lists) {
  return normalizeKnowledgeSources(lists.flat());
}

function isTruthyEnv(value) {
  return ['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(
    normalizeText(value)
  );
}

function getStandardCodes(standards = []) {
  return asArray(standards)
    .map((item) => item?.code || item?.standard_code || item?.iso_code || item)
    .map(asString)
    .filter(Boolean);
}

function getAuditorWebContextTopics(standards = [], reportTypeCode = '') {
  const codes = getStandardCodes(standards).join(' ').toLowerCase();
  const topics = ['iso_best_practices', 'risk_management'];

  if (
    codes.includes('27001') ||
    codes.includes('22301') ||
    normalizeText(reportTypeCode).includes('audit')
  ) {
    topics.push('cybersecurity_threats', 'business_continuity');
  }

  return dedupeStrings(topics, 6);
}

function buildSeniorAuditorPayloadForReport({
  tenantId,
  tenant,
  period,
  reportTypeCode,
  standards,
  stats,
  latestKpis,
}) {
  const controls = stats?.controls || {};
  const controlHealth = stats?.control_health || {};
  const evidences = stats?.evidences || {};
  const findings = stats?.findings || {};
  const risks = stats?.risks || {};
  const audits = stats?.audits || {};
  const actionPlans = stats?.action_plans || {};
  const redKpis = asArray(latestKpis).filter(
    (item) => normalizeText(item?.status_color) === 'red'
  ).length;

  const allowWebContext = isTruthyEnv(
    process.env.AI_AUDITOR_WEB_CONTEXT || process.env.AI_REPORT_WEB_CONTEXT
  );

  return {
    tenant_context: {
      tenant_id: tenantId,
      tenant_name: tenant?.name || 'Cliente',
      period: period || 'Periodo actual',
    },
    active_standards: getStandardCodes(standards),
    controls_summary: {
      total_controls: toNumber(controls.total_controls, 0),
      healthy_controls: toNumber(controls.healthy_controls, 0),
      attention_controls: toNumber(controls.warning_controls, 0),
      deteriorated_controls: toNumber(controls.critical_controls, 0),
      overdue_controls: toNumber(controls.overdue_controls, 0),
      controls_without_evidence: toNumber(
        controlHealth.pending_evidence_count || evidences.pending_evidences,
        0
      ),
      average_score: toNumber(controls.average_score, 0),
    },
    evidence_summary: {
      total_evidences: toNumber(evidences.total_evidences, 0),
      pending_evidence_count: toNumber(evidences.pending_evidences, 0),
      expired_evidence_count: toNumber(evidences.expired_evidences, 0),
      old_evidence_count: toNumber(evidences.expired_evidences, 0),
    },
    risks_summary: {
      total_risks: toNumber(risks.total_risks, 0),
      high_residual_risks: toNumber(risks.critical_risks, 0),
      medium_risks: toNumber(risks.medium_risks, 0),
    },
    findings_summary: {
      open_findings: toNumber(findings.open_findings, 0),
      critical_findings: toNumber(findings.critical_findings, 0),
      overdue_findings: toNumber(findings.overdue_findings, 0),
    },
    action_plans_summary: {
      open_action_plans: toNumber(actionPlans.open_actions, 0),
      overdue_action_plans: toNumber(actionPlans.overdue_actions, 0),
      high_priority_action_plans: toNumber(actionPlans.high_priority_actions, 0),
    },
    kpi_summary: {
      red_kpis: redKpis,
      total_kpis: asArray(latestKpis).length,
    },
    audit_context: {
      active_audits: toNumber(audits.active_audits, 0),
      audits_last_30_days: toNumber(audits.audits_last_30_days, 0),
    },
    requested_output:
      reportTypeCode === 'audit_report' ? 'audit_preparation' : 'report',
    allow_web_context: allowWebContext,
    web_context_topics: allowWebContext
      ? getAuditorWebContextTopics(standards, reportTypeCode)
      : [],
  };
}

function normalizeSeniorAuditorResponse(raw) {
  const response = raw?.ai || raw?.analysis || raw;

  if (!response || typeof response !== 'object') {
    return null;
  }

  return response;
}

function getSeniorAuditorRecommendationText(item) {
  return firstNonEmptyString(
    item?.recommended_action,
    item?.summary,
    item?.title,
    item?.observation
  );
}

function extractSeniorAuditorRecommendations(seniorAuditor) {
  const tasks = asArray(seniorAuditor?.suggested_tasks).map(
    getSeniorAuditorRecommendationText
  );
  const insights = asArray(seniorAuditor?.insights).map(
    getSeniorAuditorRecommendationText
  );

  return filterInsights([...tasks, ...insights], 6);
}

function rankFindingsForAi(rows) {
  return [...asArray(rows)].sort((a, b) => {
    const severityDiff = severityRank(a?.severity) - severityRank(b?.severity);
    if (severityDiff !== 0) return severityDiff;

    const aDue = a?.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b?.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreated - aCreated;
  });
}

function buildWeakestStandardsList(rows) {
  return [...asArray(rows)]
    .sort((a, b) => toNumber(a?.score, 999) - toNumber(b?.score, 999))
    .slice(0, 3)
    .map((row) => `${row.code} (${toNumber(row.score, 0).toFixed(1)}%)`);
}

function summarizeWeakestStandards(rows, max = 3) {
  const weakest = [...asArray(rows)]
    .sort((a, b) => toNumber(a?.score, 999) - toNumber(b?.score, 999))
    .slice(0, max);

  if (weakest.length === 0) return '';

  return weakest
    .map((row) => `${row.code} (${toNumber(row.score, 0).toFixed(1)}%)`)
    .join(', ');
}

function summarizeTopRisk(topRisks) {
  const risk = asArray(topRisks)[0];
  if (!risk) return '';

  const parts = [];
  if (risk.title) parts.push(cleanDisplayText(risk.title));
  if (risk.asset_name) parts.push(`sobre activo ${cleanDisplayText(risk.asset_name)}`);
  if (risk.level) parts.push(`con nivel ${cleanDisplayText(risk.level)}`);

  return parts.join(' ');
}

function summarizeAuditFocusControl(rows) {
  const row = asArray(rows)[0];
  if (!row) return '';

  return `${cleanDisplayText(row.code || '')} ${cleanDisplayText(
    row.name || 'Control'
  )} (${toNumber(row.score, 0).toFixed(1)}%)`.trim();
}

function summarizeFindingTitle(rows) {
  const row = asArray(rows)[0];
  if (!row) return '';
  return cleanDisplayText(row.title || '');
}

function buildExecutiveFallbackSummary({
  tenant,
  period,
  stats,
  complianceByStandard,
  topRisks,
}) {
  const weakest = summarizeWeakestStandards(complianceByStandard);
  const topRisk = summarizeTopRisk(topRisks);
  const controls = stats.controls || {};
  const findings = stats.findings || {};
  const evidences = stats.evidences || {};

  const parts = [
    `Durante ${period || 'el periodo actual'}, ${tenant?.name || 'el cliente'} mantiene ${toNumber(
      controls.total_controls,
      0
    )} controles dentro del alcance activo.`,
    `Se observan ${toNumber(
      controls.warning_controls,
      0
    )} controles en atención y ${toNumber(
      controls.critical_controls,
      0
    )} deteriorados.`,
  ];

  if (weakest) {
    parts.push(`Las normas con menor salud son ${weakest}.`);
  }

  if (toNumber(findings.critical_findings, 0) > 0) {
    parts.push(
      `Persisten ${toNumber(findings.critical_findings, 0)} hallazgo(s) crítico(s).`
    );
  }

  if (toNumber(evidences.pending_evidences, 0) > 0) {
    parts.push(
      `Existen ${toNumber(evidences.pending_evidences, 0)} evidencia(s) pendiente(s).`
    );
  }

  if (topRisk) {
    parts.push(`El riesgo más sensible del periodo es ${topRisk}.`);
  }

  return parts.join(' ');
}

function buildAuditFallbackSummary({
  tenant,
  period,
  stats,
  auditFocusControls,
}) {
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const focus = summarizeAuditFocusControl(auditFocusControls);

  const parts = [
    `Durante ${period || 'el periodo actual'}, ${
      tenant?.name || 'el cliente'
    } presenta un escenario de preparación de auditoría con ${toNumber(
      controls.total_controls,
      0
    )} controles evaluados y ${toNumber(
      evidences.total_evidences,
      0
    )} evidencias disponibles.`,
  ];

  if (focus) {
    parts.push(`La muestra sugerida debiera iniciar por ${focus}.`);
  }

  parts.push(
    `Hoy existen ${toNumber(
      controls.critical_controls,
      0
    )} controles deteriorados y ${toNumber(
      findings.open_findings,
      0
    )} hallazgo(s) abierto(s).`
  );

  return parts.join(' ');
}

function buildControlFallbackSummary({
  tenant,
  period,
  stats,
  complianceByStandard,
}) {
  const controls = stats.controls || {};
  const actions = stats.action_plans || {};
  const weakest = summarizeWeakestStandards(complianceByStandard);

  const parts = [
    `Durante ${period || 'el periodo actual'}, ${tenant?.name || 'el cliente'} mantiene ${toNumber(
      controls.total_controls,
      0
    )} controles vigentes.`,
    `El backlog operativo concentra ${toNumber(
      controls.warning_controls,
      0
    )} controles en atención y ${toNumber(
      controls.critical_controls,
      0
    )} deteriorados.`,
  ];

  if (toNumber(actions.overdue_actions, 0) > 0) {
    parts.push(
      `Además existen ${toNumber(actions.overdue_actions, 0)} acciones vencidas.`
    );
  }

  if (weakest) {
    parts.push(`Las normas más comprometidas son ${weakest}.`);
  }

  return parts.join(' ');
}

function buildPlatformFallbackSummary({
  tenant,
  period,
  stats,
  platformMonthlyStats,
}) {
  const controls = stats.controls || {};
  const findings = stats.findings || {};
  const platform = platformMonthlyStats || {};

  return [
    `Durante ${period || 'el periodo actual'}, ${tenant?.name || 'el cliente'} registra ${toNumber(
      platform.total_users,
      0
    )} usuario(s) y ${toNumber(platform.enabled_modules, 0)} módulo(s) activo(s).`,
    `A nivel de cumplimiento, mantiene ${toNumber(
      controls.total_controls,
      0
    )} controles con score consolidado de ${toNumber(
      controls.average_score,
      0
    ).toFixed(1)}% y ${toNumber(findings.open_findings, 0)} hallazgo(s) abierto(s).`,
  ].join(' ');
}

function buildExecutivePrioritiesFromData({
  reportTypeCode,
  complianceByStandard,
  topRisks,
  auditFocusControls,
  openFindings,
  stats,
}) {
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const actions = stats.action_plans || {};
  const weakest = summarizeWeakestStandards(complianceByStandard);
  const topRisk = summarizeTopRisk(topRisks);
  const topAuditControl = summarizeAuditFocusControl(auditFocusControls);
  const topFinding = summarizeFindingTitle(openFindings);

  const priorities = [];

  if (reportTypeCode === 'audit_report') {
    if (topAuditControl) {
      priorities.push(`Concentrar la muestra de auditoría en ${topAuditControl}.`);
    }

    if (toNumber(evidences.pending_evidences, 0) > 0) {
      priorities.push(
        `Cerrar ${toNumber(
          evidences.pending_evidences,
          0
        )} evidencia(s) pendiente(s) antes de la revisión formal.`
      );
    }

    if (toNumber(findings.open_findings, 0) > 0) {
      priorities.push(
        `Documentar tratamiento y evidencia objetiva para ${toNumber(
          findings.open_findings,
          0
        )} hallazgo(s) abierto(s).`
      );
    }

    if (toNumber(controls.critical_controls, 0) > 0) {
      priorities.push(
        `Preparar respaldo reforzado para ${toNumber(
          controls.critical_controls,
          0
        )} control(es) deteriorado(s).`
      );
    }
  } else if (reportTypeCode === 'control_status') {
    if (weakest) {
      priorities.push(`Priorizar remediación por norma, comenzando por ${weakest}.`);
    }

    if (toNumber(controls.warning_controls, 0) > 0) {
      priorities.push(
        `Reducir el backlog de ${toNumber(
          controls.warning_controls,
          0
        )} controles en atención con responsables y fechas comprometidas.`
      );
    }

    if (toNumber(actions.overdue_actions, 0) > 0) {
      priorities.push(
        `Escalar ${toNumber(actions.overdue_actions, 0)} acción(es) vencida(s).`
      );
    }

    if (toNumber(controls.critical_controls, 0) > 0) {
      priorities.push(
        `Tratar de inmediato ${toNumber(
          controls.critical_controls,
          0
        )} control(es) deteriorado(s).`
      );
    }
  } else if (reportTypeCode === 'platform_client_monthly') {
    if (weakest) {
      priorities.push(`Acompañar al cliente primero en ${weakest}.`);
    }

    if (toNumber(findings.open_findings, 0) > 0) {
      priorities.push(
        `Revisar con el cliente ${toNumber(
          findings.open_findings,
          0
        )} hallazgo(s) abierto(s) y su plan de cierre.`
      );
    }

    if (toNumber(evidences.pending_evidences, 0) > 0) {
      priorities.push(
        `Regularizar ${toNumber(
          evidences.pending_evidences,
          0
        )} evidencia(s) pendiente(s) del cliente.`
      );
    }
  } else {
    if (weakest) {
      priorities.push(`Focalizar la remediación en ${weakest}.`);
    }

    if (toNumber(controls.warning_controls, 0) > 0) {
      priorities.push(
        `Transformar ${toNumber(
          controls.warning_controls,
          0
        )} controles en atención en un plan trimestral de normalización.`
      );
    }

    if (toNumber(controls.critical_controls, 0) > 0) {
      priorities.push(
        `Asignar responsable y fecha de cierre al ${toNumber(
          controls.critical_controls,
          0
        )} control deteriorado del periodo.`
      );
    }

    if (topRisk) {
      priorities.push(`Validar tratamiento ejecutivo para ${topRisk}.`);
    }

    if (topFinding) {
      priorities.push(`Dar seguimiento gerencial al hallazgo "${topFinding}".`);
    }
  }

  return filterInsights(priorities, 6);
}

function buildRiskLinesFromData({ topRisks, complianceByStandard }) {
  const lines = [];
  const risk = asArray(topRisks)[0];

  if (risk) {
    lines.push(
      `Riesgo principal: ${cleanDisplayText(risk.title)} sobre ${
        cleanDisplayText(risk.asset_name) || 'activo relevante'
      } con criticidad ${cleanDisplayText(risk.level || 'no definida')}.`
    );
  }

  const weakest = [...asArray(complianceByStandard)]
    .sort((a, b) => toNumber(a?.score, 999) - toNumber(b?.score, 999))
    .slice(0, 2);

  if (weakest.length > 0) {
    lines.push(
      `Mayor exposición normativa en ${weakest
        .map((item) => `${item.code} (${toNumber(item.score, 0).toFixed(1)}%)`)
        .join(' y ')}.`
    );
  }

  return filterInsights(lines, 4);
}

function buildDecisionLinesFromData({ reportTypeCode, stats, auditFocusControls }) {
  const controls = stats.controls || {};
  const actions = stats.action_plans || {};
  const findings = stats.findings || {};
  const focus = summarizeAuditFocusControl(auditFocusControls);

  const lines = [];

  if (reportTypeCode === 'audit_report') {
    if (focus) {
      lines.push(`Definir la muestra inicial sobre ${focus}.`);
    }
    lines.push('Validar trazabilidad entre requisito, control, evidencia y cierre correctivo.');
  } else if (reportTypeCode === 'control_status') {
    lines.push('Instalar seguimiento semanal sobre controles en atención y deteriorados.');
    if (toNumber(actions.overdue_actions, 0) > 0) {
      lines.push(`Escalar ${toNumber(actions.overdue_actions, 0)} acciones vencidas a nivel jefatura.`);
    }
  } else if (reportTypeCode === 'platform_client_monthly') {
    lines.push('Usar este informe para customer success y seguimiento de adopción + cumplimiento.');
    if (toNumber(findings.open_findings, 0) > 0) {
      lines.push(`Alinear con el cliente el cierre de ${toNumber(findings.open_findings, 0)} hallazgo(s) abierto(s).`);
    }
  } else {
    lines.push('Priorizar decisiones sobre remediación, responsables y fechas de cierre por norma.');
    if (toNumber(controls.critical_controls, 0) > 0) {
      lines.push(`Escalar el control deteriorado del periodo con seguimiento gerencial.`);
    }
  }

  return filterInsights(lines, 4);
}

function normalizeExecutiveBrief(raw, fallback = {}) {
  const ai = raw?.ai || raw || {};

  return {
    ok: !!raw,
    headline: cleanDisplayText(firstNonEmptyString(ai.headline, ai.title, ai.summary)),
    summary: cleanDisplayText(
      firstNonEmptyString(ai.summary, ai.executive_summary, ai.brief, fallback.summary)
    ),
    priorities: filterInsights(
      [
        ...(ai.top_priorities || []),
        ...(ai.priorities || []),
        ...(ai.suggestions || []),
        ...(ai.recommended_actions || []),
        ...(fallback.priorities || []),
      ],
      6
    ),
    risks: filterInsights([...(ai.key_risks || []), ...(ai.risks || []), ...(fallback.risks || [])], 4),
    decisions: filterInsights(
      [
        ...(ai.decisions || []),
        ...(ai.management_implications || []),
        ...(ai.business_impact || []),
        ...(fallback.decisions || []),
      ],
      4
    ),
    recommendations: filterInsights(
      [
        ...(ai.recommended_actions || []),
        ...(ai.suggestions || []),
        ...(ai.actions || []),
        ...(fallback.priorities || []),
      ],
      6
    ),
    confidence: normalizeConfidence(ai.confidence),
    source: firstNonEmptyString(ai.source, 'ai-engine-knowledge'),
    knowledge_context: cleanDisplayText(firstNonEmptyString(ai.knowledge_context)),
    knowledge_sources: normalizeKnowledgeSources(ai.knowledge_sources),
  };
}

function normalizeHealthSummary(raw, fallback = {}) {
  const ai = raw?.ai || raw || {};

  return {
    ok: !!raw,
    summary: cleanDisplayText(firstNonEmptyString(ai.summary, fallback.summary)),
    suggestions: filterInsights(
      [
        ...(ai.suggestions || []),
        ...(ai.recommended_actions || []),
        ...(fallback.suggestions || []),
      ],
      6
    ),
    confidence: normalizeConfidence(ai.confidence),
    source: firstNonEmptyString(ai.source, 'ai-engine-knowledge'),
    knowledge_context: cleanDisplayText(firstNonEmptyString(ai.knowledge_context)),
    knowledge_sources: normalizeKnowledgeSources(ai.knowledge_sources),
  };
}

function normalizeFindingAnalysis(raw, finding = null) {
  const ai = raw?.ai || raw || {};

  return {
    finding_id: finding?.id || null,
    iso_code: finding?.iso_code || null,
    title: cleanDisplayText(firstNonEmptyString(finding?.title, ai.title)),
    severity: firstNonEmptyString(finding?.severity, ai.priority),
    summary: cleanDisplayText(firstNonEmptyString(ai.summary)),
    impact: cleanDisplayText(firstNonEmptyString(ai.impact)),
    priority: firstNonEmptyString(ai.priority, finding?.severity),
    likely_causes: filterInsights(ai.likely_causes || [], 4),
    recommended_actions: filterInsights(ai.recommended_actions || [], 5),
    confidence: normalizeConfidence(ai.confidence),
    source: firstNonEmptyString(ai.source, 'ai-engine-knowledge'),
    knowledge_context: cleanDisplayText(firstNonEmptyString(ai.knowledge_context)),
    knowledge_sources: normalizeKnowledgeSources(ai.knowledge_sources),
  };
}

async function getTenantInfo(tenantId) {
  const rows = await safeQuery(
    `
    SELECT *
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId],
    []
  );

  const tenant = rows[0];

  if (!tenant) {
    return {
      id: tenantId,
      name: 'Cliente',
      logo_url: null,
      logo: null,
      rut: null,
      address: null,
      business: null,
      branches: null,
      report_primary_color: '#0B2F4F',
      report_secondary_color: '#22C55E',
      report_rights_message: null,
      report_privacy_message: null,
      report_footer_text: null,
      report_logo_url: null,
    };
  }

  return {
    ...tenant,
    name: cleanDisplayText(tenant.name) || 'Cliente',
    logo_url: tenant.logo_url || tenant.logo || null,
    report_logo_url:
      tenant.report_logo_url || tenant.logo_url || tenant.logo || tenant.brand_logo_url || null,
    report_primary_color: tenant.report_primary_color || '#0B2F4F',
    report_secondary_color: tenant.report_secondary_color || '#22C55E',
  };
}

async function getActiveStandards(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      ts.standard_code AS code,
      COALESCE(s.name, ts.standard_code) AS name
    FROM tenant_standards ts
    LEFT JOIN standards s
      ON s.code = ts.standard_code
    WHERE ts.tenant_id = $1::uuid
      AND ts.is_active = TRUE
    ORDER BY ts.standard_code ASC
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    code: cleanDisplayText(row.code),
    name: cleanDisplayText(row.name || row.code),
  }));
}

async function getControlStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_controls,
      SUM(CASE WHEN effective_health_status = 'saludable' THEN 1 ELSE 0 END)::int AS healthy_controls,
      SUM(CASE WHEN effective_health_status = 'atencion' THEN 1 ELSE 0 END)::int AS warning_controls,
      SUM(CASE WHEN effective_health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END)::int AS critical_controls,
      SUM(COALESCE(overdue_action_plans_count, 0))::int AS overdue_controls,
      ROUND(AVG(COALESCE(effective_health_score, 0))::numeric, 1) AS average_score
    FROM public.v_iso_control_effective_health
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_in_active_operational_scope, false) = true
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  const totalControls = toNumber(row.total_controls, 0);
  const healthyControls = toNumber(row.healthy_controls, 0);
  const warningControls = toNumber(row.warning_controls, 0);
  const criticalControls = toNumber(row.critical_controls, 0);
  const overdueControls = toNumber(row.overdue_controls, 0);
  const averageScore = toNumber(row.average_score, 0);

  return {
    total_controls: totalControls,
    healthy_controls: healthyControls,
    warning_controls: warningControls,
    critical_controls: criticalControls,
    overdue_controls: overdueControls,
    average_score: averageScore,
    healthy_percent: percent(healthyControls, totalControls),
    warning_percent: percent(warningControls, totalControls),
    critical_percent: percent(criticalControls, totalControls),
    overdue_percent: percent(overdueControls, totalControls),
    general_status: getGeneralStatus(averageScore),
  };
}

async function getControlHealthStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_health_rows,
      ROUND(AVG(COALESCE(effective_health_score, 0))::numeric, 1) AS avg_health_score,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(official_evidence_count, 0) > 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS avg_evidence_score,
      ROUND((COUNT(*) FILTER (WHERE compliance_bucket = 'cumple')::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS avg_compliance_score,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(open_findings_count, 0) = 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS avg_findings_score,
      ROUND(AVG(COALESCE(effective_health_score, 0))::numeric, 1) AS avg_risk_score,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(overdue_action_plans_count, 0) = 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS avg_action_score,
      ROUND(AVG(COALESCE(effective_health_score, 0))::numeric, 1) AS avg_review_score,
      SUM(evidence_count)::int AS evidence_count,
      SUM(approved_evidence_count)::int AS approved_evidence_count,
      SUM(pending_evidence_count)::int AS pending_evidence_count,
      SUM(rejected_evidence_count)::int AS rejected_evidence_count,
      SUM(open_findings_count)::int AS open_findings_count,
      SUM(open_action_plans_count)::int AS open_actions_count,
      SUM(overdue_action_plans_count)::int AS overdue_actions_count,
      SUM(CASE WHEN effective_health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END)::int AS high_risks_count
    FROM public.v_iso_control_effective_health
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_in_active_operational_scope, false) = true
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_health_rows: toNumber(row.total_health_rows, 0),
    avg_health_score: toNumber(row.avg_health_score, 0),
    avg_evidence_score: toNumber(row.avg_evidence_score, 0),
    avg_compliance_score: toNumber(row.avg_compliance_score, 0),
    avg_findings_score: toNumber(row.avg_findings_score, 0),
    avg_risk_score: toNumber(row.avg_risk_score, 0),
    avg_action_score: toNumber(row.avg_action_score, 0),
    avg_review_score: toNumber(row.avg_review_score, 0),
    evidence_count: toNumber(row.evidence_count, 0),
    approved_evidence_count: toNumber(row.approved_evidence_count, 0),
    pending_evidence_count: toNumber(row.pending_evidence_count, 0),
    rejected_evidence_count: toNumber(row.rejected_evidence_count, 0),
    open_findings_count: toNumber(row.open_findings_count, 0),
    open_actions_count: toNumber(row.open_actions_count, 0),
    overdue_actions_count: toNumber(row.overdue_actions_count, 0),
    high_risks_count: toNumber(row.high_risks_count, 0),
  };
}

async function getEvidenceStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_evidences,

      SUM(
        CASE
          WHEN COALESCE(validated, FALSE) = TRUE
            OR LOWER(COALESCE(status, '')) IN ('approved', 'aprobada', 'aprobado', 'validada', 'validado')
          THEN 1 ELSE 0
        END
      )::int AS approved_evidences,

      SUM(
        CASE
          WHEN COALESCE(validated, FALSE) = FALSE
            AND LOWER(COALESCE(status, 'active')) NOT IN ('deleted', 'eliminada', 'eliminado')
          THEN 1 ELSE 0
        END
      )::int AS pending_evidences,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('rejected', 'rechazada', 'rechazado')
          THEN 1 ELSE 0
        END
      )::int AS rejected_evidences,

      SUM(
        CASE
          WHEN expires_at IS NOT NULL AND expires_at < CURRENT_DATE
          THEN 1 ELSE 0
        END
      )::int AS expired_evidences,

      SUM(
        CASE
          WHEN created_at >= NOW() - INTERVAL '30 days'
          THEN 1 ELSE 0
        END
      )::int AS evidences_last_30_days
    FROM evidences
    WHERE tenant_id = $1::uuid
      AND LOWER(COALESCE(status, 'active')) NOT IN ('deleted', 'eliminada', 'eliminado')
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_evidences: toNumber(row.total_evidences, 0),
    approved_evidences: toNumber(row.approved_evidences, 0),
    pending_evidences: toNumber(row.pending_evidences, 0),
    rejected_evidences: toNumber(row.rejected_evidences, 0),
    expired_evidences: toNumber(row.expired_evidences, 0),
    evidences_last_30_days: toNumber(row.evidences_last_30_days, 0),
  };
}

async function getFindingStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_findings,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, 'open')) IN ('open', 'abierto', 'pendiente', 'en curso')
          THEN 1 ELSE 0
        END
      )::int AS open_findings,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
          THEN 1 ELSE 0
        END
      )::int AS closed_findings,

      SUM(
        CASE
          WHEN LOWER(COALESCE(severity, '')) IN ('critical', 'critico', 'crítico', 'alta', 'alto', 'high')
          THEN 1 ELSE 0
        END
      )::int AS critical_findings,

      SUM(
        CASE
          WHEN due_date IS NOT NULL
            AND due_date < CURRENT_DATE
            AND LOWER(COALESCE(status, 'open')) NOT IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
          THEN 1 ELSE 0
        END
      )::int AS overdue_findings,

      SUM(
        CASE
          WHEN created_at >= NOW() - INTERVAL '30 days'
          THEN 1 ELSE 0
        END
      )::int AS findings_last_30_days
    FROM findings
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_findings: toNumber(row.total_findings, 0),
    open_findings: toNumber(row.open_findings, 0),
    closed_findings: toNumber(row.closed_findings, 0),
    critical_findings: toNumber(row.critical_findings, 0),
    overdue_findings: toNumber(row.overdue_findings, 0),
    findings_last_30_days: toNumber(row.findings_last_30_days, 0),
  };
}

async function getRiskStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(ar.id)::int AS total_risks,
      SUM(
        CASE
          WHEN LOWER(COALESCE(ar.level, '')) IN ('critical', 'critico', 'crítico', 'alto', 'alta', 'high')
          THEN 1 ELSE 0
        END
      )::int AS critical_risks,
      SUM(
        CASE
          WHEN LOWER(COALESCE(ar.level, '')) IN ('medio', 'media', 'medium')
          THEN 1 ELSE 0
        END
      )::int AS medium_risks,
      SUM(
        CASE
          WHEN LOWER(COALESCE(ar.level, '')) IN ('bajo', 'baja', 'low')
          THEN 1 ELSE 0
        END
      )::int AS low_risks
    FROM asset_risks ar
    INNER JOIN assets a
      ON a.id = ar.asset_id
    WHERE a.tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_risks: toNumber(row.total_risks, 0),
    critical_risks: toNumber(row.critical_risks, 0),
    medium_risks: toNumber(row.medium_risks, 0),
    low_risks: toNumber(row.low_risks, 0),
  };
}

async function getTopRisks(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      ar.id,
      ar.risk,
      ar.impact,
      ar.probability,
      ar.level,
      ar.created_at,
      a.name AS asset_name,
      a.type AS asset_type,
      a.criticality AS asset_criticality,
      a.owner AS asset_owner
    FROM asset_risks ar
    INNER JOIN assets a
      ON a.id = ar.asset_id
    WHERE a.tenant_id = $1::uuid
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(ar.level, '')) IN ('critical', 'critico', 'crítico') THEN 1
        WHEN LOWER(COALESCE(ar.level, '')) IN ('high', 'alto', 'alta') THEN 2
        WHEN LOWER(COALESCE(ar.level, '')) IN ('medium', 'medio', 'media') THEN 3
        WHEN LOWER(COALESCE(ar.level, '')) IN ('low', 'bajo', 'baja') THEN 4
        ELSE 5
      END ASC,
      ar.created_at DESC
    LIMIT 10
    `,
    [tenantId],
    []
  );

  return rows.map((row, index) => ({
    id: row.id,
    code: `R-${String(index + 1).padStart(2, '0')}`,
    title: cleanDisplayText(row.risk || 'Riesgo identificado'),
    description: cleanDisplayText(row.impact || 'Sin impacto documentado'),
    probability: cleanDisplayText(row.probability || 'No definida'),
    level: cleanDisplayText(row.level || 'No definido'),
    asset_name: cleanDisplayText(row.asset_name || 'Activo no informado'),
    asset_type: cleanDisplayText(row.asset_type || ''),
    asset_criticality: cleanDisplayText(row.asset_criticality || ''),
    asset_owner: cleanDisplayText(row.asset_owner || ''),
  }));
}

async function getAssetStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_assets,
      SUM(
        CASE
          WHEN LOWER(COALESCE(criticality, '')) IN ('critical', 'critico', 'crítico', 'alto', 'alta', 'high')
          THEN 1 ELSE 0
        END
      )::int AS critical_assets
    FROM assets
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_assets: toNumber(row.total_assets, 0),
    critical_assets: toNumber(row.critical_assets, 0),
  };
}

async function getAuditStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_audits,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('active', 'en curso', 'open', 'abierta', 'abierto', 'programada')
          THEN 1 ELSE 0
        END
      )::int AS active_audits,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('closed', 'cerrada', 'cerrado', 'finalizada', 'finalizado')
          THEN 1 ELSE 0
        END
      )::int AS closed_audits,

      SUM(
        CASE
          WHEN created_at >= NOW() - INTERVAL '30 days'
          THEN 1 ELSE 0
        END
      )::int AS audits_last_30_days
    FROM audits
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_audits: toNumber(row.total_audits, 0),
    active_audits: toNumber(row.active_audits, 0),
    closed_audits: toNumber(row.closed_audits, 0),
    audits_last_30_days: toNumber(row.audits_last_30_days, 0),
  };
}

async function getActionPlanStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_actions,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('open', 'abierto', 'pendiente', 'en curso')
          THEN 1 ELSE 0
        END
      )::int AS open_actions,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('closed', 'cerrado', 'cerrada', 'completed', 'completado', 'completada')
          THEN 1 ELSE 0
        END
      )::int AS completed_actions,

      SUM(
        CASE
          WHEN due_date IS NOT NULL
            AND due_date < CURRENT_DATE
            AND LOWER(COALESCE(status, '')) NOT IN ('closed', 'cerrado', 'cerrada', 'completed', 'completado', 'completada')
          THEN 1 ELSE 0
        END
      )::int AS overdue_actions,

      SUM(
        CASE
          WHEN LOWER(COALESCE(priority, '')) IN ('critical', 'critico', 'crítico', 'alta', 'alto', 'high')
          THEN 1 ELSE 0
        END
      )::int AS high_priority_actions
    FROM action_plans
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_actions: toNumber(row.total_actions, 0),
    open_actions: toNumber(row.open_actions, 0),
    completed_actions: toNumber(row.completed_actions, 0),
    overdue_actions: toNumber(row.overdue_actions, 0),
    high_priority_actions: toNumber(row.high_priority_actions, 0),
  };
}

async function getNonconformityStats(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_nonconformities,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('open', 'abierto', 'pendiente', 'en curso')
          THEN 1 ELSE 0
        END
      )::int AS open_nonconformities,

      SUM(
        CASE
          WHEN LOWER(COALESCE(status, '')) IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
          THEN 1 ELSE 0
        END
      )::int AS closed_nonconformities
    FROM tenant_nonconformities
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const row = rows[0] || {};

  return {
    total_nonconformities: toNumber(row.total_nonconformities, 0),
    open_nonconformities: toNumber(row.open_nonconformities, 0),
    closed_nonconformities: toNumber(row.closed_nonconformities, 0),
  };
}

async function getComplianceByStandard(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      v.iso AS standard_code,
      COALESCE(s.name, v.iso) AS standard_name,
      ROUND(
        (
          SUM(COALESCE(v.avg_effective_health_score, 0) * GREATEST(COALESCE(v.active_scope_controls, 0), 1)) /
          NULLIF(SUM(GREATEST(COALESCE(v.active_scope_controls, 0), 1)), 0)
        )::numeric,
        1
      ) AS score,
      SUM(COALESCE(v.active_scope_controls, 0))::int AS controls_count,
      SUM(COALESCE(v.healthy_controls, 0))::int AS healthy_controls,
      SUM(COALESCE(v.attention_controls, 0))::int AS warning_controls,
      SUM(COALESCE(v.deteriorated_controls, 0))::int AS critical_controls,
      ROUND(AVG(COALESCE(v.official_evidence_percentage, 0))::numeric, 1) AS evidence_score,
      ROUND(AVG(COALESCE(v.compliance_percentage, 0))::numeric, 1) AS compliance_score,
      SUM(COALESCE(v.open_findings_count, 0))::int AS open_findings_count_raw,
      100 AS risk_score,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(v.overdue_action_plans_count, 0) = 0)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS action_score,
      ROUND(AVG(COALESCE(v.avg_effective_health_score, 0))::numeric, 1) AS review_score,
      0::int AS pending_evidence_count,
      SUM(COALESCE(v.open_findings_count, 0))::int AS open_findings_count,
      SUM(COALESCE(v.open_action_plans_count, 0))::int AS open_actions_count,
      SUM(COALESCE(v.overdue_action_plans_count, 0))::int AS overdue_actions_count,
      SUM(CASE WHEN v.kpi_health_status IN ('deteriorado', 'critico') THEN COALESCE(v.active_scope_controls, 0) ELSE 0 END)::int AS high_risks_count
    FROM public.v_iso_effective_kpi_summary v
    LEFT JOIN standards s
      ON s.code = v.iso
    WHERE v.tenant_id = $1::uuid
      AND COALESCE(v.active_scope_controls, 0) > 0
    GROUP BY v.iso, s.name
    ORDER BY v.iso ASC
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    code: cleanDisplayText(row.standard_code),
    name: cleanDisplayText(row.standard_name || row.standard_code),
    score: toNumber(row.score, 0),
    controls_count: toNumber(row.controls_count, 0),
    healthy_controls: toNumber(row.healthy_controls, 0),
    warning_controls: toNumber(row.warning_controls, 0),
    critical_controls: toNumber(row.critical_controls, 0),
    evidence_score: toNumber(row.evidence_score, 0),
    compliance_score: toNumber(row.compliance_score, 0),
    findings_score: toNumber(row.open_findings_count_raw, 0) > 0 ? 0 : 100,
    risk_score: toNumber(row.risk_score, 0),
    action_score: toNumber(row.action_score, 0),
    review_score: toNumber(row.review_score, 0),
    pending_evidence_count: toNumber(row.pending_evidence_count, 0),
    open_findings_count: toNumber(row.open_findings_count, 0),
    open_actions_count: toNumber(row.open_actions_count, 0),
    overdue_actions_count: toNumber(row.overdue_actions_count, 0),
    high_risks_count: toNumber(row.high_risks_count, 0),
  }));
}

async function getAuditFocusControls(tenantId) {
  const rows = await safeQuery(
    `
    WITH latest_health AS (
      SELECT
        tenant_control_id,
        iso AS standard_code,
        COALESCE(effective_health_score, 0) AS health_score,
        CASE WHEN COALESCE(official_evidence_count, 0) > 0 THEN 100 ELSE 0 END AS evidence_score,
        CASE WHEN compliance_bucket = 'cumple' THEN 100 WHEN compliance_bucket = 'parcial' THEN 60 ELSE 0 END AS compliance_score,
        CASE WHEN COALESCE(open_findings_count, 0) = 0 THEN 100 ELSE 0 END AS findings_score,
        COALESCE(effective_health_score, 0) AS risk_score,
        CASE WHEN COALESCE(overdue_action_plans_count, 0) = 0 THEN 100 ELSE 0 END AS action_score,
        COALESCE(effective_health_score, 0) AS review_score,
        COALESCE(evidence_count, 0) AS evidence_count,
        COALESCE(approved_evidence_count, 0) AS approved_evidence_count,
        COALESCE(pending_evidence_count, 0) AS pending_evidence_count,
        COALESCE(rejected_evidence_count, 0) AS rejected_evidence_count,
        COALESCE(open_findings_count, 0) AS open_findings_count,
        COALESCE(open_action_plans_count, 0) AS open_actions_count,
        COALESCE(overdue_action_plans_count, 0) AS overdue_actions_count,
        CASE WHEN effective_health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END AS high_risks_count,
        COALESCE(effective_health_status, 'sin_datos') AS derived_health_status,
        NULL::timestamp AS calculated_at
      FROM public.v_iso_control_effective_health
      WHERE tenant_id = $1::uuid
        AND COALESCE(is_in_active_operational_scope, false) = true
    ),
    ranked AS (
      SELECT
        lh.tenant_control_id,
        lh.standard_code,
        cc.clause,
        cc.category,
        COALESCE(cc.description, 'Control sin descripción') AS control_description,
        COALESCE(tc.status, 'sin_estado') AS control_status,
        tc.priority,
        tc.applicability,
        tc.due_date,
        lh.health_score,
        lh.derived_health_status AS health_status,
        lh.evidence_score,
        lh.compliance_score,
        lh.findings_score,
        lh.risk_score,
        lh.action_score,
        lh.review_score,
        lh.evidence_count,
        lh.approved_evidence_count,
        lh.pending_evidence_count,
        lh.rejected_evidence_count,
        lh.open_findings_count,
        lh.open_actions_count,
        lh.overdue_actions_count,
        lh.high_risks_count,
        lh.calculated_at,
        ROW_NUMBER() OVER (
          PARTITION BY lh.standard_code
          ORDER BY
            lh.health_score ASC,
            lh.pending_evidence_count DESC,
            lh.open_findings_count DESC,
            lh.high_risks_count DESC,
            lh.calculated_at DESC NULLS LAST
        ) AS standard_rank
      FROM latest_health lh
      LEFT JOIN tenant_controls tc
        ON tc.id = lh.tenant_control_id
      LEFT JOIN controls_catalog cc
        ON cc.id = tc.control_id
    )
    SELECT
      tenant_control_id,
      standard_code,
      clause,
      category,
      control_description,
      control_status,
      priority,
      applicability,
      due_date,
      health_score,
      health_status,
      evidence_score,
      compliance_score,
      findings_score,
      risk_score,
      action_score,
      review_score,
      evidence_count,
      approved_evidence_count,
      pending_evidence_count,
      rejected_evidence_count,
      open_findings_count,
      open_actions_count,
      overdue_actions_count,
      high_risks_count,
      calculated_at
    FROM ranked
    WHERE standard_rank <= 2
    ORDER BY
      standard_rank ASC,
      health_score ASC,
      pending_evidence_count DESC,
      open_findings_count DESC,
      high_risks_count DESC
    LIMIT 12
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    id: row.tenant_control_id,
    code: cleanDisplayText(`${row.standard_code || 'ISO'} ${row.clause || ''}`.trim()),
    name: cleanDisplayText(row.control_description || 'Control sin descripción'),
    standard_code: cleanDisplayText(row.standard_code),
    clause: cleanDisplayText(row.clause),
    category: cleanDisplayText(row.category),
    status: cleanDisplayText(row.control_status || 'sin_estado'),
    priority: cleanDisplayText(row.priority || ''),
    applicability: cleanDisplayText(row.applicability || ''),
    due_date: row.due_date || null,
    score: toNumber(row.health_score, 0),
    health_status: cleanDisplayText(row.health_status || 'sin_estado'),
    evidence_score: toNumber(row.evidence_score, 0),
    compliance_score: toNumber(row.compliance_score, 0),
    findings_score: toNumber(row.findings_score, 0),
    risk_score: toNumber(row.risk_score, 0),
    action_score: toNumber(row.action_score, 0),
    review_score: toNumber(row.review_score, 0),
    evidence_count: toNumber(row.evidence_count, 0),
    approved_evidence_count: toNumber(row.approved_evidence_count, 0),
    pending_evidence_count: toNumber(row.pending_evidence_count, 0),
    rejected_evidence_count: toNumber(row.rejected_evidence_count, 0),
    open_findings_count: toNumber(row.open_findings_count, 0),
    open_actions_count: toNumber(row.open_actions_count, 0),
    overdue_actions_count: toNumber(row.overdue_actions_count, 0),
    high_risks_count: toNumber(row.high_risks_count, 0),
    calculated_at: row.calculated_at || null,
  }));
}

async function getControlStatusRows(tenantId) {
  const rows = await safeQuery(
    `
    SELECT
      COALESCE(effective_health_status, 'sin_datos') AS health_status,
      COUNT(*)::int AS total,
      ROUND(AVG(COALESCE(effective_health_score, 0))::numeric, 1) AS average_score,
      SUM(pending_evidence_count)::int AS pending_evidence_count,
      SUM(open_findings_count)::int AS open_findings_count,
      SUM(open_action_plans_count)::int AS open_actions_count,
      SUM(overdue_action_plans_count)::int AS overdue_actions_count,
      SUM(CASE WHEN effective_health_status IN ('deteriorado', 'critico') THEN 1 ELSE 0 END)::int AS high_risks_count
    FROM public.v_iso_control_effective_health
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_in_active_operational_scope, false) = true
    GROUP BY COALESCE(effective_health_status, 'sin_datos')
    ORDER BY
      CASE
        WHEN COALESCE(effective_health_status, 'sin_datos') IN ('critico', 'deteriorado') THEN 1
        WHEN COALESCE(effective_health_status, 'sin_datos') = 'atencion' THEN 2
        WHEN COALESCE(effective_health_status, 'sin_datos') = 'saludable' THEN 3
        ELSE 4
      END ASC
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    health_status: cleanDisplayText(row.health_status),
    total: toNumber(row.total, 0),
    average_score: toNumber(row.average_score, 0),
    pending_evidence_count: toNumber(row.pending_evidence_count, 0),
    open_findings_count: toNumber(row.open_findings_count, 0),
    open_actions_count: toNumber(row.open_actions_count, 0),
    overdue_actions_count: toNumber(row.overdue_actions_count, 0),
    high_risks_count: toNumber(row.high_risks_count, 0),
  }));
}

async function getRecentEvidences(tenantId) {
  const rows = await safeQuery(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    ),
    ranked AS (
      SELECT
        vet.evidence_id,
        vet.iso_code,
        vet.clause,
        vet.control_description,
        vet.file_name,
        vet.evidence_description,
        vet.evidence_type,
        vet.action,
        vet.changed_at,
        vet.event_label,
        vet.validated,
        vet.last_review_status,
        ROW_NUMBER() OVER (
          PARTITION BY
            COALESCE(vet.iso_code, ''),
            COALESCE(vet.clause, ''),
            LOWER(COALESCE(vet.file_name, '')),
            LOWER(COALESCE(vet.control_description, ''))
          ORDER BY
            vet.changed_at DESC,
            CASE WHEN COALESCE(vet.validated, FALSE) = FALSE THEN 0 ELSE 1 END,
            vet.evidence_id DESC
        ) AS rn
      FROM v_audit_evidence_timeline vet
      INNER JOIN active_standards ast
        ON ast.standard_code = vet.iso_code
      WHERE vet.tenant_id = $1::uuid
        AND vet.iso_code IS NOT NULL
        AND vet.file_name IS NOT NULL
        AND LOWER(COALESCE(vet.file_name, '')) NOT LIKE 'executive-summary-%'
        AND LOWER(COALESCE(vet.file_name, '')) NOT LIKE 'audit-report-%'
        AND LOWER(COALESCE(vet.file_name, '')) NOT LIKE 'control-status-%'
    )
    SELECT
      evidence_id,
      iso_code,
      clause,
      control_description,
      file_name,
      evidence_description,
      evidence_type,
      action,
      changed_at,
      event_label,
      validated,
      last_review_status
    FROM ranked
    WHERE rn = 1
    ORDER BY changed_at DESC
    LIMIT 24
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    id: row.evidence_id,
    iso_code: cleanDisplayText(row.iso_code),
    clause: cleanDisplayText(row.clause),
    control_description: cleanDisplayText(row.control_description),
    file_name: cleanDisplayText(row.file_name),
    description: cleanDisplayText(row.evidence_description),
    evidence_type: cleanDisplayText(row.evidence_type),
    action: cleanDisplayText(row.action),
    changed_at: row.changed_at,
    event_label: cleanDisplayText(row.event_label),
    validated: row.validated,
    last_review_status: cleanDisplayText(row.last_review_status),
  }));
}

async function getOpenFindings(tenantId) {
  const rows = await safeQuery(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    )
    SELECT
      f.id,
      f.iso_code,
      f.title,
      f.description,
      f.finding_type,
      f.severity,
      f.status,
      f.owner,
      f.detected_by,
      f.due_date,
      f.created_at,
      f.tenant_control_id,
      f.audit_id,
      f.asset_id
    FROM findings f
    INNER JOIN active_standards ast
      ON ast.standard_code = f.iso_code
    WHERE f.tenant_id = $1::uuid
      AND LOWER(COALESCE(f.status, 'open')) NOT IN ('closed', 'cerrado', 'cerrada', 'resuelto', 'resuelta')
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(f.severity, '')) IN ('critical', 'critico', 'crítico') THEN 1
        WHEN LOWER(COALESCE(f.severity, '')) IN ('alta', 'alto', 'high') THEN 2
        WHEN LOWER(COALESCE(f.severity, '')) IN ('media', 'medio', 'medium') THEN 3
        ELSE 4
      END ASC,
      f.due_date ASC NULLS LAST,
      f.created_at DESC
    LIMIT 12
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    id: row.id,
    iso_code: cleanDisplayText(row.iso_code),
    title: cleanDisplayText(row.title),
    description: cleanDisplayText(row.description),
    finding_type: cleanDisplayText(row.finding_type),
    severity: cleanDisplayText(row.severity),
    status: cleanDisplayText(row.status),
    owner: cleanDisplayText(row.owner),
    detected_by: cleanDisplayText(row.detected_by),
    due_date: row.due_date,
    created_at: row.created_at,
    tenant_control_id: row.tenant_control_id,
    audit_id: row.audit_id,
    asset_id: row.asset_id,
  }));
}

async function getOpenActionPlans(tenantId) {
  const rows = await safeQuery(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    )
    SELECT
      ap.id,
      ap.iso_code,
      ap.title,
      ap.description,
      ap.source_type,
      ap.priority,
      ap.status,
      ap.owner,
      ap.due_date,
      ap.completed_at,
      ap.tenant_control_id,
      ap.finding_id,
      ap.nonconformity_id,
      ap.audit_id,
      ap.asset_id,
      ap.approval_status,
      ap.created_at,
      ap.updated_at
    FROM action_plans ap
    INNER JOIN active_standards ast
      ON ast.standard_code = ap.iso_code
    WHERE ap.tenant_id = $1::uuid
      AND LOWER(COALESCE(ap.status, 'open')) NOT IN ('closed', 'cerrado', 'cerrada', 'completed', 'completado', 'completada')
    ORDER BY
      CASE
        WHEN ap.due_date IS NOT NULL AND ap.due_date < CURRENT_DATE THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN LOWER(COALESCE(ap.priority, '')) IN ('critical', 'critico', 'crítico') THEN 1
        WHEN LOWER(COALESCE(ap.priority, '')) IN ('alta', 'alto', 'high') THEN 2
        WHEN LOWER(COALESCE(ap.priority, '')) IN ('media', 'medio', 'medium') THEN 3
        ELSE 4
      END ASC,
      ap.due_date ASC NULLS LAST,
      ap.created_at DESC
    LIMIT 12
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    id: row.id,
    iso_code: cleanDisplayText(row.iso_code),
    title: cleanDisplayText(row.title),
    description: cleanDisplayText(row.description),
    source_type: cleanDisplayText(row.source_type),
    priority: cleanDisplayText(row.priority),
    status: cleanDisplayText(row.status),
    owner: cleanDisplayText(row.owner),
    due_date: row.due_date,
    completed_at: row.completed_at,
    tenant_control_id: row.tenant_control_id,
    finding_id: row.finding_id,
    nonconformity_id: row.nonconformity_id,
    audit_id: row.audit_id,
    asset_id: row.asset_id,
    approval_status: cleanDisplayText(row.approval_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function getLatestKpis(tenantId) {
  const rows = await safeQuery(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    ),
    ranked AS (
      SELECT
        ks.id,
        ks.kpi_id,
        kd.code,
        kd.name,
        kd.category::text AS category,
        kd.unit,
        ks.standard_code,
        ks.value,
        ks.status_color::text AS status_color,
        ks.direction::text AS direction,
        ks.target_value,
        ks.period_type::text AS period_type,
        ks.period_start,
        ks.period_end,
        ks.calculated_at,
        ROW_NUMBER() OVER (
          PARTITION BY ks.kpi_id, ks.standard_code
          ORDER BY ks.calculated_at DESC NULLS LAST, ks.created_at DESC
        ) AS rn
      FROM kpi_snapshots ks
      INNER JOIN kpi_definitions kd
        ON kd.id = ks.kpi_id
      INNER JOIN active_standards ast
        ON ast.standard_code = ks.standard_code
      WHERE ks.tenant_id = $1::uuid
        AND ks.standard_code IS NOT NULL
    )
    SELECT
      id,
      kpi_id,
      code,
      name,
      category,
      unit,
      standard_code,
      value,
      status_color,
      direction,
      target_value,
      period_type,
      period_start,
      period_end,
      calculated_at
    FROM ranked
    WHERE rn = 1
    ORDER BY calculated_at DESC NULLS LAST
    LIMIT 12
    `,
    [tenantId],
    []
  );

  return rows.map((row) => ({
    id: row.id,
    kpi_id: row.kpi_id,
    code: cleanKpiCode(row.code || '-'),
    name: cleanKpiName(row.name || row.code || 'KPI sin nombre'),
    category: cleanDisplayText(row.category),
    unit: cleanDisplayText(row.unit),
    standard_code: cleanDisplayText(row.standard_code),
    value: toNumber(row.value, 0),
    status_color: cleanDisplayText(row.status_color),
    direction: cleanDisplayText(row.direction),
    target_value: row.target_value,
    period_type: cleanDisplayText(row.period_type),
    period_start: row.period_start,
    period_end: row.period_end,
    calculated_at: row.calculated_at,
  }));
}

async function getPlatformMonthlyStats(tenantId) {
  const reportRows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS reports_generated,
      SUM(
        CASE
          WHEN generated_at >= NOW() - INTERVAL '30 days'
          THEN 1 ELSE 0
        END
      )::int AS reports_last_30_days
    FROM report_exports
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const usersRows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_users
    FROM users
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  const modulesRows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS enabled_modules
    FROM v_tenant_modules
    WHERE tenant_id = $1::uuid
      AND is_enabled = TRUE
    `,
    [tenantId],
    []
  );

  const contractsRows = await safeQuery(
    `
    SELECT
      COUNT(*)::int AS total_contracts
    FROM tenant_contracts
    WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    []
  );

  return {
    reports_generated: toNumber(reportRows[0]?.reports_generated, 0),
    reports_last_30_days: toNumber(reportRows[0]?.reports_last_30_days, 0),
    total_users: toNumber(usersRows[0]?.total_users, 0),
    enabled_modules: toNumber(modulesRows[0]?.enabled_modules, 0),
    total_contracts: toNumber(contractsRows[0]?.total_contracts, 0),
  };
}

async function getAiEnhancements({
  tenantId,
  tenant,
  period,
  reportTypeCode,
  standards,
  stats,
  complianceByStandard,
  topRisks,
  auditFocusControls,
  openFindings,
  latestKpis,
  platformMonthlyStats,
}) {
  const weakestStandards = buildWeakestStandardsList(complianceByStandard);

  const executiveBriefPayload = {
    tenant_id: tenantId,
    tenant_name: tenant?.name || 'Cliente',
    period: period || 'Periodo actual',
    standards: asArray(standards).map((item) => item.code).filter(Boolean),
    controls_total: toNumber(stats?.controls?.total_controls, 0),
    controls_warning: toNumber(stats?.controls?.warning_controls, 0),
    controls_critical: toNumber(stats?.controls?.critical_controls, 0),
    evidences_pending: toNumber(stats?.evidences?.pending_evidences, 0),
    findings_critical: toNumber(stats?.findings?.critical_findings, 0),
    weakest_standards: weakestStandards,
  };

  const healthSummaryPayload = {
    tenant_id: tenantId,
    tenant_name: tenant?.name || 'Cliente',
    standards: asArray(standards).map((item) => item.code).filter(Boolean),
    controls_total: toNumber(stats?.controls?.total_controls, 0),
    controls_warning: toNumber(stats?.controls?.warning_controls, 0),
    controls_critical: toNumber(stats?.controls?.critical_controls, 0),
    evidences_pending: toNumber(stats?.evidences?.pending_evidences, 0),
    findings_critical: toNumber(stats?.findings?.critical_findings, 0),
  };

  const seniorAuditorPayload = buildSeniorAuditorPayloadForReport({
    tenantId,
    tenant,
    period,
    reportTypeCode,
    standards,
    stats,
    latestKpis,
  });

  const [executiveBriefRaw, healthSummaryRaw, seniorAuditorRaw] = await Promise.all([
    safeAiCall('/api/ai/suggest/executive-brief', executiveBriefPayload, null),
    safeAiCall('/api/ai/suggest/health-summary', healthSummaryPayload, null),
    safeAiCall('/api/ai/auditor/analyze', seniorAuditorPayload, null, 20000),
  ]);

  const seniorAuditor = normalizeSeniorAuditorResponse(seniorAuditorRaw);

  let executiveFallbackSummary = buildExecutiveFallbackSummary({
    tenant,
    period,
    stats,
    complianceByStandard,
    topRisks,
  });

  if (reportTypeCode === 'audit_report') {
    executiveFallbackSummary = buildAuditFallbackSummary({
      tenant,
      period,
      stats,
      auditFocusControls,
    });
  } else if (reportTypeCode === 'control_status') {
    executiveFallbackSummary = buildControlFallbackSummary({
      tenant,
      period,
      stats,
      complianceByStandard,
    });
  } else if (reportTypeCode === 'platform_client_monthly') {
    executiveFallbackSummary = buildPlatformFallbackSummary({
      tenant,
      period,
      stats,
      platformMonthlyStats,
    });
  }

  const executiveFallback = {
    summary: executiveFallbackSummary,
    priorities: buildExecutivePrioritiesFromData({
      reportTypeCode,
      complianceByStandard,
      topRisks,
      auditFocusControls,
      openFindings,
      stats,
    }),
    risks: buildRiskLinesFromData({
      topRisks,
      complianceByStandard,
    }),
    decisions: buildDecisionLinesFromData({
      reportTypeCode,
      stats,
      auditFocusControls,
    }),
  };

  const healthFallback = {
    summary: `Estado de salud consolidado: ${toNumber(
      stats?.controls?.healthy_controls,
      0
    )} controles saludables, ${toNumber(
      stats?.controls?.warning_controls,
      0
    )} en atención y ${toNumber(
      stats?.controls?.critical_controls,
      0
    )} deteriorados.`,
    suggestions: executiveFallback.priorities,
  };

  const executiveBrief = normalizeExecutiveBrief(executiveBriefRaw, executiveFallback);
  const healthSummary = normalizeHealthSummary(healthSummaryRaw, healthFallback);

  if (!executiveBrief.summary) {
    executiveBrief.summary = executiveFallback.summary;
  }

  if (executiveBrief.priorities.length === 0) {
    executiveBrief.priorities = executiveFallback.priorities;
  }

  if (executiveBrief.risks.length === 0) {
    executiveBrief.risks = executiveFallback.risks;
  }

  if (executiveBrief.decisions.length === 0) {
    executiveBrief.decisions = executiveFallback.decisions;
  }

  if (executiveBrief.recommendations.length === 0) {
    executiveBrief.recommendations = executiveFallback.priorities;
  }

  if (!healthSummary.summary) {
    healthSummary.summary = healthFallback.summary;
  }

  if (healthSummary.suggestions.length === 0) {
    healthSummary.suggestions = healthFallback.suggestions;
  }

  const rankedFindings = rankFindingsForAi(openFindings);
  const findingsForAi =
    reportTypeCode === 'platform_client_monthly'
      ? rankedFindings.slice(0, 1)
      : rankedFindings.slice(0, 2);

  const topFindingAnalyses = (
    await Promise.all(
      findingsForAi.map(async (finding) => {
        const raw = await safeAiCall(
          '/api/ai/suggest/finding-analysis',
          {
            tenant_id: tenantId,
            finding_id: finding.id,
            iso_code: finding.iso_code,
            title: finding.title,
            description: finding.description || '',
            severity: finding.severity || 'media',
            status: finding.status || 'open',
            owner: finding.owner || null,
            due_date: finding.due_date || null,
          },
          null,
          15000
        );

        if (!raw) return null;
        return normalizeFindingAnalysis(raw, finding);
      })
    )
  ).filter(Boolean);

  return {
    executive_brief: executiveBrief,
    health_summary: healthSummary,
    senior_auditor: seniorAuditor,
    top_finding_analyses: topFindingAnalyses,
    knowledge_sources: mergeKnowledgeSources(
      executiveBrief.knowledge_sources,
      healthSummary.knowledge_sources,
      topFindingAnalyses.flatMap((item) => item.knowledge_sources || [])
    ),
  };
}

function buildExecutiveRecommendations(data) {
  const stats = data.stats || {};
  const controls = stats.controls || {};
  const findings = stats.findings || {};
  const evidences = stats.evidences || {};
  const actions = stats.action_plans || {};
  const compliance = asArray(data.compliance_by_standard || []);
  const topRisks = asArray(data.top_risks || []);

  const recommendations = [];

  const weakest = summarizeWeakestStandards(compliance);
  if (weakest) {
    recommendations.push(`Focalizar remediación en ${weakest}.`);
  }

  if (toNumber(controls.critical_controls, 0) > 0) {
    recommendations.push(
      `Asignar responsable y fecha de cierre al ${toNumber(
        controls.critical_controls,
        0
      )} control deteriorado del periodo.`
    );
  }

  if (toNumber(controls.warning_controls, 0) > 0) {
    recommendations.push(
      `Transformar ${toNumber(
        controls.warning_controls,
        0
      )} controles en atención en un plan trimestral de normalización.`
    );
  }

  if (toNumber(evidences.pending_evidences, 0) > 0) {
    recommendations.push(
      `Regularizar ${toNumber(
        evidences.pending_evidences,
        0
      )} evidencias pendientes antes del próximo comité.`
    );
  }

  if (toNumber(actions.overdue_actions, 0) > 0) {
    recommendations.push(
      `Escalar ${toNumber(actions.overdue_actions, 0)} acciones vencidas.`
    );
  }

  if (toNumber(findings.critical_findings, 0) > 0) {
    recommendations.push(
      `Monitorear semanalmente ${toNumber(
        findings.critical_findings,
        0
      )} hallazgo(s) crítico(s).`
    );
  }

  if (topRisks[0]) {
    recommendations.push(
      `Validar tratamiento ejecutivo del riesgo "${cleanDisplayText(
        topRisks[0].title
      )}" sobre ${cleanDisplayText(topRisks[0].asset_name)}.`
    );
  }

  recommendations.push(
    'Revisar el avance mensual del plan de acción y validar mejora efectiva en comité de cumplimiento.'
  );

  return filterInsights(recommendations, 6);
}

function buildAuditRecommendations(data) {
  const stats = data.stats || {};
  const controls = stats.controls || {};
  const evidences = stats.evidences || {};
  const findings = stats.findings || {};
  const auditFocusControls = asArray(data.audit_focus_controls || []);
  const recommendations = [];

  const focus = summarizeAuditFocusControl(auditFocusControls);
  if (focus) {
    recommendations.push(`Iniciar la muestra de auditoría por ${focus}.`);
  }

  if (toNumber(evidences.pending_evidences, 0) > 0) {
    recommendations.push(
      `Cerrar ${toNumber(
        evidences.pending_evidences,
        0
      )} evidencia(s) pendiente(s) antes de auditoría.`
    );
  }

  if (toNumber(controls.critical_controls, 0) > 0) {
    recommendations.push(
      `Preparar evidencia reforzada para ${toNumber(
        controls.critical_controls,
        0
      )} control(es) deteriorado(s).`
    );
  }

  if (toNumber(findings.open_findings, 0) > 0) {
    recommendations.push(
      `Documentar tratamiento y trazabilidad de ${toNumber(
        findings.open_findings,
        0
      )} hallazgo(s) abierto(s).`
    );
  }

  recommendations.push(
    'Validar trazabilidad completa entre requisito, control, evidencia y CAPA antes de la revisión formal.'
  );

  return filterInsights(recommendations, 6);
}

function buildControlRecommendations(data) {
  const stats = data.stats || {};
  const controls = stats.controls || {};
  const actions = stats.action_plans || {};
  const compliance = asArray(data.compliance_by_standard || []);
  const recommendations = [];

  const weakest = summarizeWeakestStandards(compliance);
  if (weakest) {
    recommendations.push(`Priorizar remediación por norma, comenzando por ${weakest}.`);
  }

  if (toNumber(controls.warning_controls, 0) > 0) {
    recommendations.push(
      `Reducir el backlog de ${toNumber(
        controls.warning_controls,
        0
      )} controles en atención con responsables y fechas comprometidas.`
    );
  }

  if (toNumber(controls.critical_controls, 0) > 0) {
    recommendations.push(
      `Tratar de inmediato ${toNumber(
        controls.critical_controls,
        0
      )} control(es) deteriorado(s).`
    );
  }

  if (toNumber(actions.overdue_actions, 0) > 0) {
    recommendations.push(
      `Escalar ${toNumber(actions.overdue_actions, 0)} acción(es) vencida(s).`
    );
  }

  recommendations.push(
    'Mantener seguimiento semanal de controles no saludables hasta su normalización.'
  );

  return filterInsights(recommendations, 6);
}

function buildPlatformRecommendations(data) {
  const stats = data.stats || {};
  const findings = stats.findings || {};
  const evidences = stats.evidences || {};
  const compliance = asArray(data.compliance_by_standard || []);
  const platform = data.platform_monthly_stats || {};
  const recommendations = [];

  const weakest = summarizeWeakestStandards(compliance);
  if (weakest) {
    recommendations.push(`Acompañar al cliente primero en ${weakest}.`);
  }

  if (toNumber(findings.open_findings, 0) > 0) {
    recommendations.push(
      `Revisar con el cliente ${toNumber(
        findings.open_findings,
        0
      )} hallazgo(s) abierto(s) y su plan de cierre.`
    );
  }

  if (toNumber(evidences.pending_evidences, 0) > 0) {
    recommendations.push(
      `Regularizar ${toNumber(
        evidences.pending_evidences,
        0
      )} evidencia(s) pendiente(s) del cliente.`
    );
  }

  if (toNumber(platform.reports_last_30_days, 0) === 0) {
    recommendations.push(
      'Incentivar el uso recurrente de reportes ejecutivos para fortalecer seguimiento gerencial.'
    );
  }

  recommendations.push(
    'Usar este informe como base de seguimiento comercial, customer success y evolución del servicio.'
  );

  return filterInsights(recommendations, 6);
}

function mergeRecommendations(...lists) {
  return filterInsights(lists.flat(), 8);
}

async function buildReportData({
  tenantId,
  reportTypeCode,
  requestedBy,
  period,
  requesterRole,
}) {
  const audience = getAudience(reportTypeCode, requesterRole);

  const tenant = await getTenantInfo(tenantId);
  const standards = await getActiveStandards(tenantId);

  const controls = await getControlStats(tenantId);
  const controlHealth = await getControlHealthStats(tenantId);
  const evidences = await getEvidenceStats(tenantId);
  const findings = await getFindingStats(tenantId);
  const risks = await getRiskStats(tenantId);
  const assets = await getAssetStats(tenantId);
  const audits = await getAuditStats(tenantId);
  const actionPlans = await getActionPlanStats(tenantId);
  const nonconformities = await getNonconformityStats(tenantId);

  const complianceByStandard = await getComplianceByStandard(tenantId);
  const topRisks = await getTopRisks(tenantId);
  const auditFocusControls = await getAuditFocusControls(tenantId);
  const controlStatusRows = await getControlStatusRows(tenantId);
  const recentEvidences = await getRecentEvidences(tenantId);
  const openFindings = await getOpenFindings(tenantId);
  const openActionPlans = await getOpenActionPlans(tenantId);
  const latestKpis = await getLatestKpis(tenantId);
  const platformMonthlyStats = await getPlatformMonthlyStats(tenantId);

  const stats = {
    controls,
    control_health: controlHealth,
    evidences,
    findings,
    risks,
    assets,
    audits,
    action_plans: actionPlans,
    nonconformities,
  };

  const ai = await getAiEnhancements({
    tenantId,
    tenant,
    period,
    reportTypeCode,
    standards,
    stats,
    complianceByStandard,
    topRisks,
    auditFocusControls,
    openFindings,
    latestKpis,
    platformMonthlyStats,
  });

  let baseRecommendations = buildExecutiveRecommendations({
    stats,
    compliance_by_standard: complianceByStandard,
    top_risks: topRisks,
  });

  if (audience === 'auditoria') {
    baseRecommendations = buildAuditRecommendations({
      stats,
      audit_focus_controls: auditFocusControls,
    });
  } else if (audience === 'control_estado') {
    baseRecommendations = buildControlRecommendations({
      stats,
      compliance_by_standard: complianceByStandard,
    });
  } else if (audience === 'plataforma_cliente') {
    baseRecommendations = buildPlatformRecommendations({
      stats,
      compliance_by_standard: complianceByStandard,
      platform_monthly_stats: platformMonthlyStats,
    });
  }

  const recommendations = mergeRecommendations(
    baseRecommendations,
    ai.executive_brief?.priorities || [],
    ai.executive_brief?.recommendations || [],
    ai.health_summary?.suggestions || [],
    extractSeniorAuditorRecommendations(ai.senior_auditor),
    asArray(ai.top_finding_analyses).flatMap((item) => item.recommended_actions || [])
  );

  return {
    tenant,
    report_type_code: reportTypeCode,
    audience,
    requester_role: requesterRole || null,
    requested_by: requestedBy,
    period: period || 'Periodo actual',
    generated_at: new Date().toISOString(),

    standards,
    stats,

    compliance_by_standard: complianceByStandard,
    top_risks: topRisks,
    audit_focus_controls: auditFocusControls,
    control_status_rows: controlStatusRows,
    recent_evidences: recentEvidences,
    open_findings: openFindings,
    open_action_plans: openActionPlans,
    latest_kpis: latestKpis,
    platform_monthly_stats: platformMonthlyStats,

    recommendations,
    ai,
  };
}

module.exports = {
  buildReportData,
};
