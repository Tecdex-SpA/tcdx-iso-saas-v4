const pool = require('../config/db');

const CONTEXT_VERSION = 'ai_context_v2.0.0';
const schemaCache = new Map();

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
      context.limitations.push(cleanLimitation(label, 'empty'));
    }
    return result.rows;
  } catch (error) {
    console.warn('AI_CONTEXT_SOURCE_SKIPPED', {
      label,
      code: error?.code,
      message: error?.message,
    });
    context.source_trace.push(sourceItem(label, 'consulta omitida: fuente no disponible'));
    context.limitations.push(cleanLimitation(label, 'unavailable'));
    return [];
  }
}

function cleanLimitation(label, reason = 'unavailable') {
  const names = {
    findings: 'hallazgos',
    tenant_nonconformities: 'no conformidades',
    nonconformities: 'no conformidades',
    evidences: 'evidencias',
    action_plans: 'planes de acción',
    audits: 'auditorías',
    assets: 'activos',
    risks: 'riesgos',
    iso_risk_matrix_items: 'matriz de riesgos',
    asset_risks: 'riesgos de activos',
    kpis: 'KPIs',
    kpi_snapshots: 'KPIs',
    document_index: 'documentos indexados',
    'document_index.google_drive': 'documentos Google Drive indexados',
  };
  const readable = names[label] || label;
  if (reason === 'empty') {
    return `No se encontraron ${readable} disponibles para este tenant.`;
  }
  if (reason === 'missing') {
    return `La fuente de ${readable} aún no está habilitada en este entorno.`;
  }
  return `No se encontraron ${readable} disponibles para este tenant o la fuente aún no está habilitada.`;
}

async function tableExists(tableName) {
  const cacheKey = `table:${tableName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
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
  const exists = result.rowCount > 0;
  schemaCache.set(cacheKey, exists);
  return exists;
}

async function columnExists(tableName, columnName) {
  const columns = await getExistingColumns(tableName);
  return columns.has(columnName);
}

async function getExistingColumns(tableName) {
  const cacheKey = `columns:${tableName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  schemaCache.set(cacheKey, columns);
  return columns;
}

function hasRequiredTenantColumn(columns) {
  return columns.has('tenant_id');
}

function statusOpenClause(alias, columns, closedValues, defaultStatus = '') {
  if (!columns.has('status')) return '';
  const prefix = alias ? `${alias}.` : '';
  return `AND LOWER(COALESCE(${prefix}status, '${defaultStatus}')) NOT IN (${closedValues.map((item) => `'${item}'`).join(',')})`;
}

function orderByExisting(alias, columns, preferred, fallback = 'id') {
  const prefix = alias ? `${alias}.` : '';
  const parts = preferred
    .filter((item) => columns.has(item.column))
    .map((item) => `${prefix}${item.column} ${item.direction}`);
  if (parts.length) return parts.join(', ');
  return columns.has(fallback) ? `${prefix}${fallback}` : '1';
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
  if (await tableExists('evidences')) {
    const columns = await getExistingColumns('evidences');
    if (hasRequiredTenantColumn(columns)) {
      context.recent_evidences = await safeQuery(
        context,
        'evidences',
        `
        SELECT *
        FROM evidences
        WHERE tenant_id = $1::uuid
          ${columns.has('status') ? "AND COALESCE(status, '') <> 'deleted'" : ''}
        ORDER BY ${orderByExisting('', columns, [{ column: 'created_at', direction: 'DESC NULLS LAST' }, { column: 'uploaded_at', direction: 'DESC NULLS LAST' }])}
        LIMIT 10
        `,
        [tenantId],
        'evidencias recientes del tenant'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('evidences', 'missing'));
  }

  if (await tableExists('findings')) {
    const columns = await getExistingColumns('findings');
    if (hasRequiredTenantColumn(columns)) {
      const standardClauses = [];
      const params = [tenantId];
      if (standardCode) {
        const standardColumns = ['iso_code', 'iso', 'standard_code'].filter((column) => columns.has(column));
        if (standardColumns.length) {
          params.push(standardCode);
          standardClauses.push(`AND (${standardColumns.map((column) => `${column} = $2::text`).join(' OR ')})`);
        }
      }
      const severityOrder = columns.has('severity')
        ? `CASE WHEN severity IN ('critical','critica','crítica','alta','high') THEN 1 WHEN severity IN ('media','medium') THEN 2 ELSE 3 END,`
        : '';
      context.recent_findings = await safeQuery(
        context,
        'findings',
        `
        SELECT *
        FROM findings
        WHERE tenant_id = $1::uuid
          ${statusOpenClause('', columns, ['cerrado','cerrada','closed','completado','completada','resolved'])}
          ${standardClauses.join('\n')}
        ORDER BY
          ${severityOrder}
          ${orderByExisting('', columns, [{ column: 'created_at', direction: 'DESC NULLS LAST' }, { column: 'due_date', direction: 'ASC NULLS LAST' }])}
        LIMIT 10
        `,
        params,
        'hallazgos abiertos relevantes'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('findings', 'missing'));
  }

  if (await tableExists('tenant_nonconformities')) {
    const columns = await getExistingColumns('tenant_nonconformities');
    if (hasRequiredTenantColumn(columns)) {
      context.recent_nonconformities = await safeQuery(
        context,
        'tenant_nonconformities',
        `
        SELECT *
        FROM tenant_nonconformities
        WHERE tenant_id = $1::uuid
          ${statusOpenClause('', columns, ['cerrado','cerrada','closed','completado','completada','resolved','resuelta'])}
        ORDER BY ${orderByExisting('', columns, [{ column: 'detected_at', direction: 'DESC NULLS LAST' }, { column: 'created_at', direction: 'DESC NULLS LAST' }])}
        LIMIT 10
        `,
        [tenantId],
        'no conformidades abiertas'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('tenant_nonconformities', 'missing'));
  }

  if (await tableExists('action_plans')) {
    const columns = await getExistingColumns('action_plans');
    if (hasRequiredTenantColumn(columns)) {
      const dueSort = columns.has('due_date')
        ? 'CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 0 ELSE 1 END, due_date ASC NULLS LAST,'
        : '';
      context.recent_action_plans = await safeQuery(
        context,
        'action_plans',
        `
        SELECT *
        FROM action_plans
        WHERE tenant_id = $1::uuid
          ${statusOpenClause('', columns, ['cerrado','cerrada','closed','completado','completada','resolved','cancelado'])}
        ORDER BY
          ${dueSort}
          ${orderByExisting('', columns, [{ column: 'created_at', direction: 'DESC NULLS LAST' }])}
        LIMIT 10
        `,
        [tenantId],
        'planes de acción abiertos y vencidos'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('action_plans', 'missing'));
  }

  if (await tableExists('audits')) {
    const columns = await getExistingColumns('audits');
    if (hasRequiredTenantColumn(columns)) {
      context.audits = await safeQuery(
        context,
        'audits',
        `
        SELECT *
        FROM audits
        WHERE tenant_id = $1::uuid
        ORDER BY ${orderByExisting('', columns, [{ column: 'created_at', direction: 'DESC NULLS LAST' }, { column: 'scheduled_date', direction: 'DESC NULLS LAST' }])}
        LIMIT 3
        `,
        [tenantId],
        'auditorías recientes'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('audits', 'missing'));
  }
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
  if (await tableExists('iso_risk_matrix_items')) {
    const riskColumns = await getExistingColumns('iso_risk_matrix_items');
    if (hasRequiredTenantColumn(riskColumns)) {
      const params = [tenantId];
      const standardClause = standardCode && riskColumns.has('standard_code')
        ? (params.push(standardCode), 'AND standard_code = $2::text')
        : '';
      const riskOrder = orderByExisting('', riskColumns, [
        { column: 'residual_risk_score', direction: 'DESC NULLS LAST' },
        { column: 'inherent_risk_score', direction: 'DESC NULLS LAST' },
        { column: 'updated_at', direction: 'DESC NULLS LAST' },
        { column: 'created_at', direction: 'DESC NULLS LAST' },
      ]);

      context.risks = await safeQuery(
        context,
        'iso_risk_matrix_items',
        `
        SELECT *
        FROM iso_risk_matrix_items
        WHERE tenant_id = $1::uuid
          ${standardClause}
        ORDER BY ${riskOrder}
        LIMIT 10
        `,
        params,
        'matriz de riesgos ISO del tenant'
      );
    }
  } else if (await tableExists('asset_risks')) {
    const assetRiskColumns = await getExistingColumns('asset_risks');
    const assetColumns = await getExistingColumns('assets');
    if (
      (await tableExists('assets')) &&
      assetRiskColumns.has('asset_id') &&
      assetColumns.has('id') &&
      hasRequiredTenantColumn(assetColumns)
    ) {
      const assetRiskOrder = orderByExisting('ar', assetRiskColumns, [
        { column: 'level', direction: 'DESC NULLS LAST' },
        { column: 'created_at', direction: 'DESC NULLS LAST' },
      ]);
      context.risks = await safeQuery(
        context,
        'asset_risks',
        `
        SELECT
          ar.*,
          a.name AS asset_name,
          ${assetColumns.has('type') ? 'a.type' : 'NULL::text'} AS asset_type,
          ${assetColumns.has('criticality') ? 'a.criticality' : 'NULL::text'} AS asset_criticality,
          ${assetColumns.has('iso') ? 'a.iso' : 'NULL::text'} AS standard_code
        FROM asset_risks ar
        JOIN assets a ON a.id = ar.asset_id
        WHERE a.tenant_id = $1::uuid
        ORDER BY ${assetRiskOrder}
        LIMIT 10
        `,
        [tenantId],
        'riesgos asociados a activos del tenant'
      );
    } else {
      context.limitations.push(cleanLimitation('asset_risks', 'missing'));
    }
  } else {
    context.limitations.push(cleanLimitation('risks', 'missing'));
  }

  if (await tableExists('assets')) {
    const assetColumns = await getExistingColumns('assets');
    if (hasRequiredTenantColumn(assetColumns)) {
      context.assets = await safeQuery(
        context,
        'assets',
        `
        SELECT *
        FROM assets
        WHERE tenant_id = $1::uuid
        ORDER BY ${orderByExisting('', assetColumns, [{ column: 'created_at', direction: 'DESC NULLS LAST' }, { column: 'name', direction: 'ASC NULLS LAST' }])}
        LIMIT 10
        `,
        [tenantId],
        'activos del tenant'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('assets', 'missing'));
  }

  if (await tableExists('kpi_snapshots')) {
    const snapshotColumns = await getExistingColumns('kpi_snapshots');
    const definitionColumns = await getExistingColumns('kpi_definitions');
    if (
      (await tableExists('kpi_definitions')) &&
      hasRequiredTenantColumn(snapshotColumns) &&
      snapshotColumns.has('kpi_id') &&
      definitionColumns.has('id')
    ) {
      const standardSnapshotClause = standardCode && snapshotColumns.has('standard_code')
        ? 'AND ks.standard_code = $2::text'
        : '';
      const params = standardSnapshotClause ? [tenantId, standardCode] : [tenantId];
      context.kpis = await safeQuery(
        context,
        'kpi_snapshots',
        `
        WITH latest AS (
          SELECT
            ks.*,
            ${definitionColumns.has('code') ? 'kd.code' : 'NULL::text'} AS kpi_code,
            ${definitionColumns.has('name') ? 'kd.name' : 'NULL::text'} AS kpi_name,
            ${definitionColumns.has('category') ? 'kd.category' : 'NULL::text'} AS kpi_category,
            ROW_NUMBER() OVER (
              PARTITION BY ks.kpi_id${snapshotColumns.has('standard_code') ? ", COALESCE(NULLIF(ks.standard_code, ''), 'GLOBAL')" : ''}
              ORDER BY
                ${snapshotColumns.has('calculated_at') ? 'ks.calculated_at DESC NULLS LAST,' : ''}
                ${snapshotColumns.has('period_start') ? 'ks.period_start DESC NULLS LAST,' : ''}
                ks.kpi_id
            ) AS rn
          FROM kpi_snapshots ks
          JOIN kpi_definitions kd ON kd.id = ks.kpi_id
          WHERE ks.tenant_id = $1::uuid
            ${standardSnapshotClause}
        )
        SELECT *
        FROM latest
        WHERE rn = 1
        LIMIT 10
        `,
        params,
        'últimas mediciones KPI del tenant'
      );
    }
  } else {
    context.limitations.push(cleanLimitation('kpi_snapshots', 'missing'));
  }

  if (await tableExists('document_index')) {
    const documentColumns = await getExistingColumns('document_index');
    if (!hasRequiredTenantColumn(documentColumns)) {
      context.limitations.push(cleanLimitation('document_index', 'missing'));
      return;
    }
    const searchTerms = buildDocumentSearchTerms({
      standardCode,
      operationId,
      controls: context.priority_controls,
      summaries: context.effective_health_summary,
    });
    const metadataExpression = documentColumns.has('metadata_json') ? 'metadata_json' : `'{}'::jsonb`;
    const providerExpression = documentColumns.has('provider') ? 'provider' : `'google_drive'::text`;
    const fileNameExpression = documentColumns.has('file_name') ? 'file_name' : (documentColumns.has('title') ? 'title' : `'Documento indexado'::text`);
    const idExpression = documentColumns.has('id') ? 'id' : `NULL::uuid`;
    const mimeExpression = documentColumns.has('mime_type') ? 'mime_type' : `NULL::text`;
    const extensionExpression = documentColumns.has('file_extension') ? 'file_extension' : `NULL::text`;
    const webViewExpression = documentColumns.has('web_view_url') ? 'web_view_url' : `NULL::text`;
    const fileUrlExpression = documentColumns.has('file_url') ? 'file_url' : `NULL::text`;
    const modifiedExpression = documentColumns.has('modified_at') ? 'modified_at' : (documentColumns.has('updated_at') ? 'updated_at' : `NULL::timestamp`);
    const indexedExpression = documentColumns.has('indexed_at') ? 'indexed_at' : (documentColumns.has('created_at') ? 'created_at' : `NULL::timestamp`);
    const statusExpression = documentColumns.has('status') ? 'status' : `'active'::text`;
    const providerClause = documentColumns.has('provider') ? "AND provider = 'google_drive'" : '';
    const statusClause = documentColumns.has('status') ? "AND COALESCE(status, '') NOT IN ('deleted','error')" : '';

    context.documents = await safeQuery(
      context,
      'document_index.google_drive',
      `
      SELECT
        ${idExpression} AS id,
        ${providerExpression} AS provider,
        ${fileNameExpression} AS file_name,
        ${mimeExpression} AS mime_type,
        ${extensionExpression} AS file_extension,
        ${webViewExpression} AS web_view_url,
        ${fileUrlExpression} AS file_url,
        ${modifiedExpression} AS modified_at,
        ${indexedExpression} AS indexed_at,
        ${statusExpression} AS status,
        ${metadataExpression} AS metadata_json
      FROM document_index
      WHERE tenant_id = $1::uuid
        ${providerClause}
        ${statusClause}
        AND (
          cardinality($2::text[]) = 0
          OR EXISTS (
            SELECT 1
            FROM unnest($2::text[]) AS term
            WHERE LOWER(COALESCE(${fileNameExpression}, '')) LIKE '%' || LOWER(term) || '%'
              OR LOWER(COALESCE(${mimeExpression}, '')) LIKE '%' || LOWER(term) || '%'
              OR LOWER(COALESCE(${extensionExpression}, '')) LIKE '%' || LOWER(term) || '%'
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
    context.limitations.push(cleanLimitation('document_index', 'missing'));
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
