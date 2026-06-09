'use strict';

const pool = require('../config/db');

const schemaCache = new Map();
const EXCLUDED_DOCUMENT_STATUSES = new Set(['excluded', 'ignored', 'missing', 'deleted', 'error']);

function asString(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value) {
  return asString(value).toLowerCase();
}

async function relationExists(name) {
  const key = `relation:${name}`;
  if (schemaCache.has(key)) return schemaCache.get(key);

  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = $1
    UNION ALL
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = $1
    LIMIT 1
    `,
    [name]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(key, exists);
  return exists;
}

async function columnExists(table, column) {
  const key = `column:${table}.${column}`;
  if (schemaCache.has(key)) return schemaCache.get(key);

  const result = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [table, column]
  );
  const exists = result.rowCount > 0;
  schemaCache.set(key, exists);
  return exists;
}

function normalizeSource(input = {}) {
  const sourceId = input.source_id || input.id || input.reference?.id || null;
  const sourceType = input.source_type || input.type || input.reference?.table || 'internal';

  if (!sourceId && !['health', 'diagnostic'].includes(sourceType)) {
    return null;
  }

  const status = input.status || 'active';
  const normalizedStatus = normalizeStatus(status);
  const usedFor = input.used_for || 'context';

  return {
    source_id: sourceId,
    source_type: sourceType,
    title: input.title || input.name || input.file_name || 'Fuente interna',
    provider: input.provider || 'internal',
    status,
    related_standard_id: input.related_standard_id || input.standard_id || null,
    related_process_id: input.related_process_id || input.process_id || null,
    related_control_id: input.related_control_id || input.control_id || input.tenant_control_id || null,
    evidence_strength: input.evidence_strength || input.strength || 'contextual',
    used_for: EXCLUDED_DOCUMENT_STATUSES.has(normalizedStatus) && usedFor === 'coverage'
      ? 'excluded_reference'
      : usedFor,
    visibility: input.visibility || 'operational',
    reference: input.reference || {
      table: sourceType === 'document_index' ? 'document_index' : sourceType,
      id: sourceId,
    },
  };
}

function dedupeSources(items = []) {
  const seen = new Set();
  const output = [];

  for (const raw of items) {
    const item = normalizeSource(raw);
    if (!item) continue;
    const key = `${item.source_type}:${item.source_id || item.title}:${item.used_for}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function sourcesFromDiagnostics(diagnostics = []) {
  const sources = [];

  for (const diagnostic of diagnostics) {
    sources.push({
      source_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
      source_type: 'diagnostic',
      title: `Diagnóstico ${diagnostic.standard?.standard_code || 'ISO'}`,
      status: 'active',
      related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
      used_for: 'diagnostic',
      visibility: 'operational',
      reference: {
        table: 'diagnostic_runtime',
        id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
      },
    });

    for (const control of diagnostic.controls || []) {
      sources.push({
        source_id: control.tenant_control_id,
        source_type: 'control',
        title: control.description || control.category || control.clause || 'Control',
        status: control.status || 'active',
        related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
        related_process_id: control.process?.id || null,
        related_control_id: control.tenant_control_id,
        used_for: 'coverage',
        visibility: 'operational',
        reference: {
          table: 'tenant_controls',
          id: control.tenant_control_id,
        },
      });

      for (const evidence of control.evidence?.existing || []) {
        sources.push({
          source_id: evidence.source_id || evidence.id,
          source_type: evidence.source_type || 'evidence',
          title: evidence.name || evidence.file_name || evidence.description || 'Evidencia',
          provider: evidence.provider || (evidence.source_type === 'document_index' ? 'internal' : 'internal'),
          status: evidence.status || 'active',
          related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          related_process_id: control.process?.id || null,
          related_control_id: control.tenant_control_id,
          evidence_strength: evidence.strength || (evidence.validated ? 'primary' : 'secondary'),
          used_for: evidence.active === false ? 'excluded_reference' : 'coverage',
          visibility: 'operational',
          reference: {
            table: evidence.source_type === 'document_index' ? 'document_index' : 'evidences',
            id: evidence.source_id || evidence.id,
          },
        });
      }

      for (const finding of control.gaps?.findings || []) {
        sources.push({
          source_id: finding.id,
          source_type: 'gap',
          title: finding.title || finding.description || 'Hallazgo',
          status: finding.status || (finding.open ? 'open' : 'closed'),
          related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          related_process_id: control.process?.id || null,
          related_control_id: control.tenant_control_id,
          used_for: 'gap',
          visibility: 'operational',
          reference: { table: 'findings', id: finding.id },
        });
      }

      for (const nonconformity of control.gaps?.nonconformities || []) {
        sources.push({
          source_id: nonconformity.id,
          source_type: 'gap',
          title: nonconformity.title || nonconformity.description || 'No conformidad',
          status: nonconformity.status || (nonconformity.open ? 'open' : 'closed'),
          related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          related_process_id: control.process?.id || null,
          related_control_id: control.tenant_control_id,
          used_for: 'gap',
          visibility: 'auditor',
          reference: { table: 'nonconformities', id: nonconformity.id },
        });
      }

      for (const action of control.actions?.existing || []) {
        sources.push({
          source_id: action.id,
          source_type: 'action_plan',
          title: action.title || action.description || 'Plan de acción',
          status: action.status || (action.open ? 'open' : 'closed'),
          related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          related_process_id: control.process?.id || null,
          related_control_id: control.tenant_control_id,
          used_for: 'action',
          visibility: 'operational',
          reference: { table: 'action_plans', id: action.id },
        });
      }

      for (const risk of control.risks?.existing || []) {
        sources.push({
          source_id: risk.id,
          source_type: 'risk',
          title: risk.risk_title || risk.title || risk.risk_description || 'Riesgo',
          status: risk.status || 'active',
          related_standard_id: diagnostic.standard?.id || diagnostic.standard?.standard_id || null,
          related_process_id: control.process?.id || null,
          related_control_id: control.tenant_control_id,
          used_for: 'risk',
          visibility: 'operational',
          reference: { table: 'iso_risk_matrix_items', id: risk.id },
        });
      }
    }
  }

  return dedupeSources(sources);
}

async function loadDocumentSources({ tenantId, includeExcluded = false, limit = 80 } = {}) {
  if (!(await relationExists('document_index'))) return [];

  const hasRelativePath = await columnExists('document_index', 'relative_path');
  const hasMetadata = await columnExists('document_index', 'metadata_json');
  const pathExpr = hasRelativePath ? 'relative_path' : 'NULL';
  const metadataExpr = hasMetadata ? 'metadata_json' : "'{}'::jsonb";

  const result = await pool.query(
    `
    SELECT
      id,
      provider,
      file_name,
      ${pathExpr} AS relative_path,
      status,
      ${metadataExpr} AS metadata_json,
      indexed_at,
      modified_at
    FROM document_index
    WHERE tenant_id = $1::uuid
      AND (
        $2::boolean = TRUE
        OR COALESCE(status, 'indexed') NOT IN ('excluded', 'ignored', 'missing', 'deleted', 'error')
      )
    ORDER BY
      CASE WHEN COALESCE(status, 'indexed') IN ('excluded', 'ignored', 'missing', 'deleted', 'error') THEN 1 ELSE 0 END,
      COALESCE(modified_at, indexed_at) DESC NULLS LAST
    LIMIT $3
    `,
    [tenantId, includeExcluded, limit]
  ).catch(() => ({ rows: [] }));

  return dedupeSources(result.rows.map((row) => ({
    source_id: row.id,
    source_type: 'document_index',
    title: row.file_name || row.relative_path || 'Documento indexado',
    provider: row.provider || 'internal',
    status: row.status || 'indexed',
    evidence_strength: EXCLUDED_DOCUMENT_STATUSES.has(normalizeStatus(row.status)) ? 'contextual' : 'secondary',
    used_for: EXCLUDED_DOCUMENT_STATUSES.has(normalizeStatus(row.status)) ? 'excluded_reference' : 'coverage',
    visibility: EXCLUDED_DOCUMENT_STATUSES.has(normalizeStatus(row.status)) ? 'auditor' : 'operational',
    reference: { table: 'document_index', id: row.id },
  })));
}

async function loadStandaloneSources({ tenantId, standardCode = null, periodFrom = null, periodTo = null } = {}) {
  const sources = [];
  const periodSql = [];
  const periodParams = [];

  if (periodFrom) {
    periodParams.push(periodFrom);
    periodSql.push(`created_at >= $${periodParams.length + 1}::date`);
  }
  if (periodTo) {
    periodParams.push(periodTo);
    periodSql.push(`created_at < ($${periodParams.length + 1}::date + INTERVAL '1 day')`);
  }
  const periodWhere = periodSql.length ? `AND ${periodSql.join(' AND ')}` : '';

  if (await relationExists('audits')) {
    const hasIso = await columnExists('audits', 'iso');
    const hasIsoCode = await columnExists('audits', 'iso_code');
    const isoExpr = hasIsoCode ? 'iso_code' : hasIso ? 'iso' : 'NULL';
    const hasTitle = await columnExists('audits', 'title');
    const hasName = await columnExists('audits', 'name');
    const titleExpr = hasTitle ? 'title' : hasName ? 'name' : "'Auditoría'";
    const params = [tenantId, ...periodParams];
    let standardWhere = '';
    if (standardCode && (hasIso || hasIsoCode)) {
      params.push(standardCode);
      standardWhere = `AND ${isoExpr} = $${params.length}`;
    }
    const result = await pool.query(
      `
      SELECT id, ${isoExpr} AS standard_code, status, ${titleExpr} AS title, created_at
      FROM audits
      WHERE tenant_id = $1::uuid
        ${periodWhere}
        ${standardWhere}
      ORDER BY created_at DESC NULLS LAST
      LIMIT 30
      `,
      params
    ).catch(() => ({ rows: [] }));
    for (const row of result.rows) {
      sources.push({
        source_id: row.id,
        source_type: 'audit',
        title: row.title || 'Auditoría',
        status: row.status || 'active',
        used_for: 'audit',
        visibility: 'auditor',
        reference: { table: 'audits', id: row.id },
      });
    }
  }

  if (await relationExists('lifecycle_transitions')) {
    const params = [tenantId, ...periodParams];
    let standardWhere = '';
    if (standardCode && await columnExists('lifecycle_transitions', 'standard_code')) {
      params.push(standardCode);
      standardWhere = `AND standard_code = $${params.length}`;
    }
    const result = await pool.query(
      `
      SELECT id, standard_code, status, from_stage, to_stage, created_at
      FROM lifecycle_transitions
      WHERE tenant_id = $1::uuid
        ${periodWhere}
        ${standardWhere}
      ORDER BY created_at DESC NULLS LAST
      LIMIT 30
      `,
      params
    ).catch(() => ({ rows: [] }));
    for (const row of result.rows) {
      sources.push({
        source_id: row.id,
        source_type: 'lifecycle',
        title: `${row.standard_code || 'ISO'} ${row.from_stage || ''} -> ${row.to_stage || ''}`.trim(),
        status: row.status || 'active',
        used_for: 'lifecycle',
        visibility: 'auditor',
        reference: { table: 'lifecycle_transitions', id: row.id },
      });
    }
  }

  return dedupeSources(sources);
}

async function buildSources({ tenantId, diagnostics = [], filters = {}, includeExcludedDocuments = false } = {}) {
  const [diagnosticSources, documentSources, standaloneSources] = await Promise.all([
    Promise.resolve(sourcesFromDiagnostics(diagnostics)),
    loadDocumentSources({ tenantId, includeExcluded: includeExcludedDocuments }),
    loadStandaloneSources({
      tenantId,
      standardCode: filters.standard_code || null,
      periodFrom: filters.period_from || null,
      periodTo: filters.period_to || null,
    }),
  ]);

  return dedupeSources([
    ...diagnosticSources,
    ...documentSources,
    ...standaloneSources,
  ]);
}

module.exports = {
  relationExists,
  columnExists,
  normalizeSource,
  dedupeSources,
  sourcesFromDiagnostics,
  loadDocumentSources,
  loadStandaloneSources,
  buildSources,
};
