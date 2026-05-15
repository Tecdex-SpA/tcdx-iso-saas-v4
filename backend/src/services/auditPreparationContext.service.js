const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

function normalizeRole(user) {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase().trim();
}

function isPlatform(user) {
  return PLATFORM_ROLES.has(normalizeRole(user));
}

function getUserTenantId(user) {
  return user?.tenant_id || user?.tenantId || user?.tenant || user?.company_id || user?.companyId || null;
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function normalizeStandardCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace('ISO/IEC', 'ISO');
}

function buildPeriod(periodYear) {
  const year = Number(periodYear);
  return {
    year,
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
  };
}

function publicGap(source, message, severity = 'media') {
  return {
    source,
    severity,
    message,
  };
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

async function getExistingColumns(tableName) {
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

function selectExisting(columns, candidates = []) {
  return candidates
    .filter((column) => columns.has(column))
    .map((column) => `${column}`);
}

function selectExpression(alias, column) {
  if (String(column).includes(' AS ')) return column;
  return `${alias}.${column}`;
}

function dateFilterFor(columns, alias, params, periodYear) {
  const dateColumn = ['created_at', 'updated_at', 'generated_at', 'start_date', 'due_date', 'closed_at']
    .find((column) => columns.has(column));

  if (!dateColumn || !periodYear) return '';

  params.push(`${periodYear}-01-01`);
  const startParam = `$${params.length}`;
  params.push(`${periodYear}-12-31`);
  const endParam = `$${params.length}`;
  return ` AND ${alias}.${dateColumn}::date BETWEEN ${startParam}::date AND ${endParam}::date`;
}

async function safeQuerySource({
  key,
  table,
  tenantId,
  periodYear,
  auditId = null,
  standardCode = '',
  limit = 25,
  columns: requestedColumns,
  standardColumns = ['standard_code', 'iso', 'iso_code'],
  auditColumns = ['audit_id'],
  dateFilter = true,
  tenantScoped = true,
  sourceTrace,
  gaps,
}) {
  const exists = await tableExists(table);

  if (!exists) {
    sourceTrace[key] = {
      table,
      available: false,
      records_count: 0,
      reason: 'table_not_found',
      queried_at: new Date().toISOString(),
    };
    const message = key === 'risks'
      ? 'No existe tabla risks; se requiere mapear matriz de riesgos desde la estructura real del sistema o módulo equivalente.'
      : `Fuente ${key} no disponible en este entorno.`;
    gaps.push(publicGap(key, message));
    return [];
  }

  const columns = await getExistingColumns(table);

  if (tenantScoped && !columns.has('tenant_id')) {
    sourceTrace[key] = {
      table,
      available: false,
      records_count: 0,
      reason: 'tenant_id_column_unavailable',
      queried_at: new Date().toISOString(),
    };
    gaps.push(publicGap(key, `Fuente ${key} no permite filtrar por tenant de forma segura.`));
    return [];
  }

  const selected = selectExisting(columns, requestedColumns);
  if (!selected.length) selected.push(columns.has('id') ? 'id' : 'NULL::text AS source_record_id');

  const params = [];
  const where = [];

  if (tenantScoped) {
    params.push(tenantId);
    where.push(`t.tenant_id = $${params.length}::uuid`);
  }

  const standardColumn = standardColumns.find((column) => columns.has(column));
  if (standardCode && standardColumn) {
    params.push(standardCode);
    where.push(`UPPER(REPLACE(COALESCE(t.${standardColumn}::text, ''), ' ', '')) = $${params.length}`);
  } else if (standardCode && key === 'evidences') {
    gaps.push(publicGap('evidences_standard_filter_unavailable', 'Las evidencias no tienen columna directa de norma; se consultan por tenant y período.', 'baja'));
  }

  const auditColumn = auditColumns.find((column) => columns.has(column));
  if (auditId && auditColumn) {
    params.push(auditId);
    where.push(`t.${auditColumn} = $${params.length}::uuid`);
  }

  const extraDateFilter = dateFilter ? dateFilterFor(columns, 't', params, periodYear) : '';
  const orderColumn = ['updated_at', 'created_at', 'generated_at', 'due_date'].find((column) => columns.has(column));

  const sql = `
    SELECT ${selected.map((column) => selectExpression('t', column)).join(', ')}
    FROM ${table} t
    ${where.length ? `WHERE ${where.join(' AND ')}` : 'WHERE true'}
      ${extraDateFilter}
    ${orderColumn ? `ORDER BY t.${orderColumn} DESC NULLS LAST` : ''}
    LIMIT ${Math.max(1, Math.min(Number(limit || 25), 100))}
  `;

  try {
    const result = await pool.query(sql, params);
    sourceTrace[key] = {
      table,
      available: true,
      records_count: result.rowCount,
      queried_at: new Date().toISOString(),
    };

    if (result.rowCount === 0) {
      gaps.push(publicGap(key, `No se encontraron registros para ${key} en el tenant/norma/período consultado.`, 'baja'));
    }

    return result.rows;
  } catch (error) {
    sourceTrace[key] = {
      table,
      available: false,
      records_count: 0,
      reason: 'query_failed',
      queried_at: new Date().toISOString(),
    };
    gaps.push(publicGap(key, `No fue posible consultar ${key} con el esquema actual.`));
    console.warn(`AUDIT PREPARATION SAFE SOURCE WARN [${key}]:`, {
      source: key,
      table,
      code: error.code,
      message: error.message,
    });
    return [];
  }
}

async function getTenant(tenantId) {
  if (!(await tableExists('tenants'))) return {};
  const columns = await getExistingColumns('tenants');
  const selected = selectExisting(columns, [
    'id',
    'name',
    'rut',
    'address',
    'business',
    'branches',
    'logo_url',
    'service_status',
    'created_at',
    'updated_at',
  ]);
  if (!selected.length) return {};

  const result = await pool.query(
    `
    SELECT ${selected.map((column) => selectExpression('t', column)).join(', ')}
    FROM tenants t
    WHERE t.id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return result.rows[0] || {};
}

async function getStandard(tenantId, standardCode, sourceTrace, gaps) {
  const standard = {
    standard_code: standardCode,
    active_for_tenant: null,
  };

  if (await tableExists('iso_standards')) {
    const columns = await getExistingColumns('iso_standards');
    const standardColumn = ['standard_code', 'iso', 'iso_code', 'code'].find((column) => columns.has(column));
    const selected = selectExisting(columns, [
      'standard_code',
      'iso',
      'iso_code',
      'code',
      'display_name',
      'name',
      'family',
      'description',
      'is_active',
    ]);

    if (standardColumn && selected.length) {
      const result = await pool.query(
        `
        SELECT ${selected.map((column) => selectExpression('s', column)).join(', ')}
        FROM iso_standards s
        WHERE UPPER(REPLACE(COALESCE(s.${standardColumn}::text, ''), ' ', '')) = $1
        LIMIT 1
        `,
        [standardCode]
      );
      Object.assign(standard, result.rows[0] || {});
    }
  }

  if (await tableExists('tenant_standards')) {
    const columns = await getExistingColumns('tenant_standards');
    const standardColumn = ['standard_code', 'iso', 'iso_code'].find((column) => columns.has(column));
    const activeColumn = ['is_active', 'active'].find((column) => columns.has(column));

    if (standardColumn) {
      const result = await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM tenant_standards
        WHERE tenant_id = $1::uuid
          AND UPPER(REPLACE(COALESCE(${standardColumn}::text, ''), ' ', '')) = $2
          ${activeColumn ? `AND COALESCE(${activeColumn}, true) = true` : ''}
        `,
        [tenantId, standardCode]
      );
      standard.active_for_tenant = Number(result.rows[0]?.total || 0) > 0;
      sourceTrace.tenant_standards = {
        table: 'tenant_standards',
        available: true,
        records_count: Number(result.rows[0]?.total || 0),
        queried_at: new Date().toISOString(),
      };
      if (!standard.active_for_tenant) {
        gaps.push(publicGap('tenant_standards', `La norma ${standardCode} no aparece activa para este tenant.`, 'alta'));
      }
    }
  } else {
    sourceTrace.tenant_standards = {
      table: 'tenant_standards',
      available: false,
      records_count: 0,
      reason: 'source_table_unavailable',
      queried_at: new Date().toISOString(),
    };
    gaps.push(publicGap('tenant_standards', 'No fue posible validar normas activas del tenant.'));
  }

  return standard;
}

async function getAudit(tenantId, auditId, sourceTrace, gaps) {
  if (!auditId) return {};
  if (!(await tableExists('audits'))) {
    sourceTrace.audit = {
      table: 'audits',
      available: false,
      records_count: 0,
      reason: 'source_table_unavailable',
      queried_at: new Date().toISOString(),
    };
    gaps.push(publicGap('audit', 'No se pudo consultar la auditoría asociada.'));
    return {};
  }

  const result = await pool.query(
    `
    SELECT *
    FROM audits
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [auditId, tenantId]
  );

  sourceTrace.audit = {
    table: 'audits',
    available: true,
    records_count: result.rowCount,
    queried_at: new Date().toISOString(),
  };

  if (result.rowCount === 0) {
    gaps.push(publicGap('audit', 'La auditoría indicada no existe o no pertenece al tenant.', 'alta'));
  }

  return result.rows[0] || {};
}

async function buildAuditPreparationContext({
  tenantId,
  standardCode,
  periodYear,
  auditId = null,
  userId = null,
}) {
  const normalizedStandard = normalizeStandardCode(standardCode);
  const sourceTrace = {};
  const gaps = [];
  const pendingItems = [];

  const tenant = await getTenant(tenantId);
  const standard = await getStandard(tenantId, normalizedStandard, sourceTrace, gaps);
  const audit = await getAudit(tenantId, auditId, sourceTrace, gaps);
  const period = buildPeriod(periodYear);

  sourceTrace.tenant = {
    table: 'tenants',
    available: Boolean(tenant?.id),
    records_count: tenant?.id ? 1 : 0,
    queried_at: new Date().toISOString(),
  };

  const common = {
    tenantId,
    periodYear,
    auditId,
    standardCode: normalizedStandard,
    sourceTrace,
    gaps,
  };

  const [
    templates,
    packages,
    packageDocuments,
    uploadedZipRows,
    risks,
    controls,
    evidences,
    audits,
    findings,
    nonconformities,
    actionPlans,
    kpis,
    documents,
    suppliers,
    supplierEvaluations,
    customerSatisfaction,
    jiraItems,
  ] = await Promise.all([
    safeQuerySource({ ...common, key: 'documents.templates', table: 'audit_document_templates', tenantId, tenantScoped: false, dateFilter: false, columns: ['id', 'template_key', 'document_name', 'document_type', 'output_format', 'folder_path', 'template_schema_json'], standardColumns: ['standard_code'], limit: 100 }),
    safeQuerySource({ ...common, key: 'documents.packages', table: 'audit_preparation_packages', tenantId, columns: ['id', 'audit_id', 'standard_code', 'period_year', 'package_name', 'status', 'package_source', 'summary_json', 'updated_at'], limit: 20 }),
    safeQuerySource({ ...common, key: 'documents.package_documents', table: 'audit_package_documents', tenantId, columns: ['id', 'package_id', 'audit_id', 'standard_code', 'document_name', 'folder_path', 'document_status', 'pending_items_json', 'evidence_links_json', 'updated_at'], limit: 50 }),
    safeQuerySource({ ...common, key: 'uploaded_zip', table: 'audit_uploaded_zip_files', tenantId, columns: ['id', 'package_id', 'audit_id', 'standard_code', 'period_year', 'original_filename', 'file_url', 'analysis_status', 'inventory_json', 'gaps_json', 'created_at'], limit: 10 }),
    safeQuerySource({ ...common, key: 'risks', table: 'risks', tenantId, columns: ['id', 'title', 'name', 'description', 'severity', 'risk_level', 'status', 'owner_id', 'created_at', 'updated_at'], limit: 25 }),
    safeQuerySource({ ...common, key: 'controls', table: 'v_iso_control_effective_health', tenantId, columns: ['tenant_control_id', 'catalog_control_id', 'iso', 'standard_code', 'clause', 'control_description', 'effective_health_score', 'effective_health_status', 'evidence_count', 'official_evidence_count', 'open_findings_count', 'open_nonconformities_count', 'overdue_action_plans_count', 'is_in_active_operational_scope'], standardColumns: ['standard_code', 'iso'], limit: 50 }),
    safeQuerySource({ ...common, key: 'evidences', table: 'evidences', tenantId, columns: ['id', 'title', 'name', 'description', 'file_name', 'file_path', 'status', 'validated', 'evidence_type', 'file_url', 'file_mime_type', 'file_size_bytes', 'tenant_control_id', 'control_id', 'created_at', 'reviewed_at', 'expires_at', 'updated_at'], limit: 50 }),
    safeQuerySource({ ...common, key: 'audits', table: 'audits', tenantId, columns: ['id', 'iso', 'standard_code', 'status', 'start_date', 'end_date', 'auditor_name', 'requester_name', 'created_at', 'updated_at'], standardColumns: ['standard_code', 'iso'], limit: 15 }),
    safeQuerySource({ ...common, key: 'findings', table: 'findings', tenantId, columns: ['id', 'audit_id', 'iso_code', 'standard_code', 'title', 'description', 'severity', 'status', 'created_at', 'updated_at'], standardColumns: ['standard_code', 'iso_code'], limit: 30 }),
    safeQuerySource({ ...common, key: 'nonconformities', table: 'tenant_nonconformities', tenantId, columns: ['id', 'audit_id', 'iso_code', 'standard_code', 'title', 'description', 'severity', 'status', 'created_at', 'updated_at'], standardColumns: ['standard_code', 'iso_code'], limit: 30 }),
    safeQuerySource({ ...common, key: 'action_plans', table: 'action_plans', tenantId, columns: ['id', 'audit_id', 'iso_code', 'standard_code', 'title', 'description', 'priority', 'status', 'due_date', 'created_at', 'updated_at'], standardColumns: ['standard_code', 'iso_code'], limit: 30 }),
    safeQuerySource({ ...common, key: 'kpis', table: 'v_iso_effective_kpi_summary', tenantId, columns: ['tenant_id', 'iso', 'standard_code', 'operation_id', 'effective_health_score', 'effective_health_status', 'controls_count', 'official_evidence_count', 'open_findings_count', 'open_nonconformities_count', 'overdue_action_plans_count'], standardColumns: ['standard_code', 'iso'], limit: 30 }),
    safeQuerySource({ ...common, key: 'document_control', table: 'documents', tenantId, columns: ['id', 'title', 'name', 'document_type', 'status', 'version', 'file_url', 'created_at', 'updated_at'], limit: 30 }),
    safeQuerySource({ ...common, key: 'suppliers', table: 'suppliers', tenantId, columns: ['id', 'name', 'status', 'criticality', 'created_at', 'updated_at'], limit: 30 }),
    safeQuerySource({ ...common, key: 'supplier_evaluations', table: 'supplier_evaluations', tenantId, columns: ['id', 'supplier_id', 'score', 'status', 'evaluation_date', 'created_at', 'updated_at'], limit: 30 }),
    safeQuerySource({ ...common, key: 'customer_satisfaction', table: 'customer_satisfaction', tenantId, columns: ['id', 'score', 'status', 'summary', 'survey_date', 'created_at', 'updated_at'], limit: 30 }),
    safeQuerySource({ ...common, key: 'jira_items', table: 'jira_items', tenantId, columns: ['id', 'issue_key', 'title', 'summary', 'status', 'issue_type', 'created_at', 'updated_at'], limit: 30 }),
  ]);

  const sourceEntries = Object.values(sourceTrace);
  const availableSources = sourceEntries.filter((item) => item.available);
  const recordsFound = sourceEntries.reduce((acc, item) => acc + Number(item.records_count || 0), 0);
  const criticalGaps = gaps.filter((gap) => gap.severity === 'alta' || gap.severity === 'critica');

  const documentRatio = templates.length ? Math.min(1, packageDocuments.length / templates.length) : 0;
  const evidenceRatio = Math.min(1, evidences.length / 10);
  const operationalRatio = Math.min(1, (risks.length + actionPlans.length + kpis.length) / 15);
  const criticalGapRatio = criticalGaps.length ? 0 : 1;
  const score = Math.round((documentRatio * 40) + (evidenceRatio * 30) + (operationalRatio * 20) + (criticalGapRatio * 10));

  const completionSummary = {
    total_sources_checked: sourceEntries.length,
    available_sources: availableSources.length,
    unavailable_sources: sourceEntries.length - availableSources.length,
    records_found: recordsFound,
    gaps_count: gaps.length,
    critical_gaps_count: criticalGaps.length,
    estimated_readiness_score: score,
    readiness_status:
      score >= 90 ? 'audit_ready' :
      score >= 75 ? 'advanced' :
      score >= 50 ? 'partial' :
      'insufficient',
  };

  if (!templates.length) pendingItems.push('[REQUIERE COMPLETAR CON DATO REAL] No hay plantillas documentales activas para la norma.');
  if (!evidences.length) pendingItems.push('[REQUIERE EVIDENCIA] No se encontraron evidencias para el paquete documental.');
  if (!risks.length) pendingItems.push('[PENDIENTE DE VALIDACIÓN] No se encontraron riesgos de calidad disponibles.');

  return {
    tenant,
    standard,
    period,
    audit,
    documents: {
      templates,
      packages,
      package_documents: packageDocuments,
    },
    risks,
    controls,
    evidences,
    audits,
    findings,
    nonconformities,
    corrective_actions: actionPlans,
    action_plans: actionPlans,
    suppliers,
    supplier_evaluations: supplierEvaluations,
    customer_satisfaction: customerSatisfaction,
    kpis,
    document_control: documents,
    jira_items: jiraItems,
    uploaded_zip: uploadedZipRows[0] || {},
    gaps,
    pending_items: pendingItems,
    source_trace: sourceTrace,
    completion_summary: completionSummary,
    built_by_user_id: userId || null,
    built_at: new Date().toISOString(),
  };
}

module.exports = {
  buildAuditPreparationContext,
  getUserTenantId,
  getUserId,
  isPlatform,
  normalizeStandardCode,
  tableExists,
  getExistingColumns,
};
