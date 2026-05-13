const pool = require('../config/db');

const CONTEXT_VERSION = 'ai_context_v2.0.0';

function compactRows(rows, limit = 20) {
  return Array.isArray(rows) ? rows.slice(0, limit) : [];
}

function sourceItem(reference, usedFor) {
  return {
    source: 'internal_db',
    reference,
    used_for: usedFor,
  };
}

function buildBaseContext({ tenantId, moduleOrigin = 'ia-auditor', standardCode = null, operationId = null }) {
  return {
    tenant: {
      tenant_id: tenantId,
      name: '',
      active_standards: [],
      active_operations: [],
    },
    scope: {
      standard_code: standardCode || '',
      operation_id: operationId || '',
      operation_name: '',
      module_origin: moduleOrigin,
      context_version: CONTEXT_VERSION,
    },
    effective_health_summary: [],
    priority_controls: [],
    recent_evidences: [],
    recent_findings: [],
    recent_nonconformities: [],
    recent_action_plans: [],
    risks: [],
    assets: [],
    audits: [],
    documents: [],
    kpis: [],
    source_trace: [],
    limitations: [],
  };
}

async function safeQuery(context, label, sql, params, usedFor) {
  try {
    const result = await pool.query(sql, params);
    context.source_trace.push(sourceItem(label, usedFor));
    if (!result.rows.length) {
      context.limitations.push(`${label}: sin registros disponibles para el tenant consultado`);
    }
    return result.rows;
  } catch (error) {
    context.limitations.push(`${label}: fuente no disponible o esquema distinto (${error.code || error.message})`);
    return [];
  }
}

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

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );
  return result.rowCount > 0;
}

function normalizeSearchToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.áéíóúñü\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDocumentSearchTerms({ standardCode = null, operationId = null, controls = [], summaries = [] }) {
  const terms = new Set();
  const add = (value) => {
    const normalized = normalizeSearchToken(value);
    if (normalized && normalized.length >= 3) terms.add(normalized.slice(0, 80));
  };

  add(standardCode);
  add(operationId);

  for (const summary of compactRows(summaries, 5)) {
    add(summary.iso);
    add(summary.operation_name);
    add(summary.operation_code);
  }

  for (const control of compactRows(controls, 8)) {
    add(control.iso);
    add(control.clause);
    add(control.category);
    const words = normalizeSearchToken(control.control_description)
      .split(' ')
      .filter((word) => word.length >= 5)
      .slice(0, 8);
    words.forEach(add);
  }

  ['politica', 'política', 'procedimiento', 'informe', 'registro', 'evidencia', 'plan', 'matriz'].forEach(add);
  return Array.from(terms).slice(0, 24);
}

async function loadTenantProfile(context, tenantId) {
  const tenants = await safeQuery(
    context,
    'tenants',
    `
    SELECT id AS tenant_id, name
    FROM tenants
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId],
    'identificar tenant de análisis'
  );

  if (tenants[0]) {
    context.tenant.name = tenants[0].name || '';
  }

  const standards = await safeQuery(
    context,
    'tenant_standards',
    `
    SELECT standard_code
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_active, true) = true
    ORDER BY standard_code
    LIMIT 20
    `,
    [tenantId],
    'normas activas del tenant'
  );

  context.tenant.active_standards = standards
    .map((row) => row.standard_code)
    .filter(Boolean);

  const operations = await safeQuery(
    context,
    'tenant_operations',
    `
    SELECT id AS operation_id, name, code
    FROM tenant_operations
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_active, true) = true
    ORDER BY name NULLS LAST
    LIMIT 20
    `,
    [tenantId],
    'operaciones activas del tenant'
  );

  context.tenant.active_operations = operations.map((row) => ({
    operation_id: row.operation_id,
    name: row.name || '',
    code: row.code || '',
  }));
}

function standardFilterClause(baseParamIndex = 2) {
  return `AND ($${baseParamIndex}::text IS NULL OR iso = $${baseParamIndex}::text)`;
}

function operationFilterClause(paramIndex = 3) {
  return `AND ($${paramIndex}::uuid IS NULL OR operation_id = $${paramIndex}::uuid)`;
}

async function loadEffectiveHealth(context, { tenantId, standardCode = null, operationId = null, tenantControlId = null }) {
  const params = [tenantId, standardCode || null, operationId || null];
  let controlFilter = '';

  if (tenantControlId) {
    params.push(tenantControlId);
    controlFilter = `AND tenant_control_id = $${params.length}::uuid`;
  }

  context.effective_health_summary = await safeQuery(
    context,
    'public.v_iso_effective_kpi_summary',
    `
    SELECT *
    FROM public.v_iso_effective_kpi_summary
    WHERE tenant_id = $1::uuid
      ${standardFilterClause(2)}
      ${operationFilterClause(3)}
      AND COALESCE(active_scope_controls, 0) > 0
    ORDER BY
      CASE
        WHEN kpi_health_status = 'critico' THEN 1
        WHEN kpi_health_status = 'deteriorado' THEN 2
        WHEN kpi_health_status = 'atencion' THEN 3
        WHEN kpi_health_status = 'saludable' THEN 4
        ELSE 5
      END,
      COALESCE(overdue_action_plans_count, 0) DESC,
      COALESCE(compliance_percentage, 0) ASC
    LIMIT 20
    `,
    [tenantId, standardCode || null, operationId || null],
    'resumen efectivo por norma y operación'
  );

  context.priority_controls = await safeQuery(
    context,
    'public.v_iso_control_effective_health',
    `
    SELECT
      tenant_control_id,
      tenant_id,
      catalog_control_id,
      operation_id,
      operation_name,
      operation_code,
      iso,
      clause,
      category,
      control_description,
      evidence_count,
      approved_evidence_count,
      official_evidence_count,
      open_findings_count,
      open_nonconformities_count,
      open_action_plans_count,
      overdue_action_plans_count,
      is_in_active_operational_scope,
      effective_health_score,
      effective_health_status,
      compliance_bucket,
      evidence_quality_status,
      health_trace_json
    FROM public.v_iso_control_effective_health
    WHERE tenant_id = $1::uuid
      ${standardFilterClause(2)}
      ${operationFilterClause(3)}
      ${controlFilter}
      AND COALESCE(is_in_active_operational_scope, false) = true
    ORDER BY
      COALESCE(effective_health_score, 0) ASC,
      CASE WHEN COALESCE(evidence_count, 0) = 0 THEN 0 ELSE 1 END ASC,
      COALESCE(overdue_action_plans_count, 0) DESC,
      COALESCE(open_nonconformities_count, 0) DESC
    LIMIT 40
    `,
    params,
    'controles efectivos prioritarios'
  );
}

async function loadRecentEntities(context, { tenantId, standardCode = null }) {
  context.recent_evidences = await safeQuery(
    context,
    'evidences',
    `
    SELECT *
    FROM evidences
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') <> 'deleted'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId],
    'evidencias recientes del tenant'
  );

  context.recent_findings = await safeQuery(
    context,
    'findings',
    `
    SELECT *
    FROM findings
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
      AND ($2::text IS NULL OR COALESCE(iso_code, iso, '') = $2::text)
    ORDER BY
      CASE
        WHEN severity IN ('critical','critica','crítica','alta','high') THEN 1
        WHEN severity IN ('media','medium') THEN 2
        ELSE 3
      END,
      created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId, standardCode || null],
    'hallazgos abiertos relevantes'
  );

  context.recent_nonconformities = await safeQuery(
    context,
    'tenant_nonconformities',
    `
    SELECT *
    FROM tenant_nonconformities
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
    ORDER BY created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId],
    'no conformidades abiertas'
  );

  context.recent_action_plans = await safeQuery(
    context,
    'action_plans',
    `
    SELECT *
    FROM action_plans
    WHERE tenant_id = $1::uuid
      AND COALESCE(status, '') NOT IN ('cerrado','cerrada','closed','completado','completada','resolved')
    ORDER BY
      CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 0 ELSE 1 END,
      due_date ASC NULLS LAST,
      created_at DESC NULLS LAST
    LIMIT 10
    `,
    [tenantId],
    'planes de acción abiertos y vencidos'
  );

  context.audits = await safeQuery(
    context,
    'audits',
    `
    SELECT *
    FROM audits
    WHERE tenant_id = $1::uuid
    ORDER BY created_at DESC NULLS LAST
    LIMIT 3
    `,
    [tenantId],
    'auditorías recientes'
  );
}

function documentRelation(row, terms = []) {
  const haystack = normalizeSearchToken(
    [
      row.file_name,
      row.mime_type,
      row.file_extension,
      JSON.stringify(row.metadata_json || {}),
    ].join(' ')
  );
  const matched = terms.filter((term) => haystack.includes(normalizeSearchToken(term))).slice(0, 8);

  return {
    ...row,
    document_id: row.id,
    title: row.file_name || row.title || 'Documento Google Drive',
    type: row.file_extension || row.mime_type || 'documento',
    source: row.provider || 'google_drive',
    date: row.modified_at || row.indexed_at || row.created_at || null,
    relation: matched.length
      ? `Coincide con ${matched.join(', ')}`
      : 'Documento indexado reciente del tenant para contraste documental',
    matched_by: matched,
    summary: row.metadata_json?.summary || row.metadata_json?.description || '',
    link: row.web_view_url || row.file_url || '',
  };
}

async function loadOptionalEntities(context, { tenantId, standardCode = null, operationId = null }) {
  const optionalSources = [
    { table: 'risks', target: 'risks', usedFor: 'riesgos del tenant' },
    { table: 'assets', target: 'assets', usedFor: 'activos del tenant' },
    { table: 'kpis', target: 'kpis', usedFor: 'KPIs del tenant' },
  ];

  for (const item of optionalSources) {
    try {
      if (!(await tableExists(item.table))) {
        context.limitations.push(`${item.table}: tabla no disponible en este entorno`);
        continue;
      }

      context[item.target] = await safeQuery(
        context,
        item.table,
        `
        SELECT *
        FROM ${item.table}
        WHERE tenant_id = $1::uuid
        LIMIT 10
        `,
        [tenantId],
        item.usedFor
      );
    } catch (error) {
      context.limitations.push(`${item.table}: no fue posible consultar (${error.code || error.message})`);
    }
  }

  if (await tableExists('document_index')) {
    const hasMetadata = await columnExists('document_index', 'metadata_json');
    const hasWebView = await columnExists('document_index', 'web_view_url');
    const hasFileUrl = await columnExists('document_index', 'file_url');
    const hasModifiedAt = await columnExists('document_index', 'modified_at');
    const searchTerms = buildDocumentSearchTerms({
      standardCode,
      operationId,
      controls: context.priority_controls,
      summaries: context.effective_health_summary,
    });
    const metadataExpression = hasMetadata ? 'metadata_json' : `'{}'::jsonb`;
    const webViewExpression = hasWebView ? 'web_view_url' : `NULL::text`;
    const fileUrlExpression = hasFileUrl ? 'file_url' : `NULL::text`;
    const modifiedExpression = hasModifiedAt ? 'modified_at' : `NULL::timestamp`;

    context.documents = await safeQuery(
      context,
      'document_index.google_drive',
      `
      SELECT
        id,
        provider,
        file_name,
        mime_type,
        file_extension,
        ${webViewExpression} AS web_view_url,
        ${fileUrlExpression} AS file_url,
        ${modifiedExpression} AS modified_at,
        indexed_at,
        status,
        ${metadataExpression} AS metadata_json
      FROM document_index
      WHERE tenant_id = $1::uuid
        AND provider = 'google_drive'
        AND COALESCE(status, '') NOT IN ('deleted','error')
        AND (
          cardinality($2::text[]) = 0
          OR EXISTS (
            SELECT 1
            FROM unnest($2::text[]) AS term
            WHERE LOWER(COALESCE(file_name, '')) LIKE '%' || LOWER(term) || '%'
              OR LOWER(COALESCE(mime_type, '')) LIKE '%' || LOWER(term) || '%'
              OR LOWER(COALESCE(file_extension, '')) LIKE '%' || LOWER(term) || '%'
              OR LOWER(COALESCE(${metadataExpression}::text, '')) LIKE '%' || LOWER(term) || '%'
          )
        )
      ORDER BY modified_at DESC NULLS LAST, indexed_at DESC NULLS LAST
      LIMIT 10
      `,
      [tenantId, searchTerms],
      'documentos Google Drive indexados para contraste documental'
    );
    context.documents = context.documents.map((row) => documentRelation(row, searchTerms));
  } else {
    context.limitations.push('document_index: índice documental no disponible para Google Drive');
  }
}

async function buildAiTenantContext({ tenantId }) {
  const context = buildBaseContext({ tenantId });
  await loadTenantProfile(context, tenantId);
  await loadEffectiveHealth(context, { tenantId });
  await loadRecentEntities(context, { tenantId });
  await loadOptionalEntities(context, { tenantId });
  return context;
}

async function buildAiStandardContext({ tenantId, standardCode, operationId = null }) {
  const context = buildBaseContext({ tenantId, standardCode, operationId });
  await loadTenantProfile(context, tenantId);
  await loadEffectiveHealth(context, { tenantId, standardCode, operationId });
  await loadRecentEntities(context, { tenantId, standardCode });
  await loadOptionalEntities(context, { tenantId, standardCode, operationId });
  return context;
}

async function buildAiControlContext({ tenantId, tenantControlId, standardCode = null, operationId = null }) {
  const context = buildBaseContext({ tenantId, standardCode, operationId });
  context.scope.tenant_control_id = tenantControlId || '';
  await loadTenantProfile(context, tenantId);
  await loadEffectiveHealth(context, { tenantId, standardCode, operationId, tenantControlId });
  await loadRecentEntities(context, { tenantId, standardCode });
  await loadOptionalEntities(context, { tenantId, standardCode, operationId });
  return context;
}

async function buildAiEvidenceContext({ tenantId, evidenceId }) {
  // TODO: ampliar con evaluación específica de evidencia cuando se consolide el contrato Evidence Review.
  const context = await buildAiTenantContext({ tenantId });
  context.scope.evidence_id = evidenceId || '';
  context.limitations.push('buildAiEvidenceContext: stub seguro; pendiente enriquecer con evidencia específica y controles relacionados');
  return context;
}

async function buildAiFindingContext({ tenantId, findingId }) {
  // TODO: ampliar con hallazgo específico, causa raíz, evidencias y acciones vinculadas.
  const context = await buildAiTenantContext({ tenantId });
  context.scope.finding_id = findingId || '';
  context.limitations.push('buildAiFindingContext: stub seguro; pendiente enriquecer con hallazgo específico');
  return context;
}

async function buildAiActionPlanContext({ tenantId, actionPlanId }) {
  // TODO: ampliar con plan específico, criterios de cierre y evidencias requeridas.
  const context = await buildAiTenantContext({ tenantId });
  context.scope.action_plan_id = actionPlanId || '';
  context.limitations.push('buildAiActionPlanContext: stub seguro; pendiente enriquecer con plan de acción específico');
  return context;
}

async function buildAiAuditContext({ tenantId, auditId }) {
  // TODO: ampliar con checklist, hallazgos y evidencias propias de la auditoría.
  const context = await buildAiTenantContext({ tenantId });
  context.scope.audit_id = auditId || '';
  context.limitations.push('buildAiAuditContext: stub seguro; pendiente enriquecer con auditoría específica');
  return context;
}

module.exports = {
  CONTEXT_VERSION,
  buildAiTenantContext,
  buildAiStandardContext,
  buildAiControlContext,
  buildAiEvidenceContext,
  buildAiFindingContext,
  buildAiActionPlanContext,
  buildAiAuditContext,
};
