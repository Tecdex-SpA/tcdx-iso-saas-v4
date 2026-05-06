const pool = require('../config/db');

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

const ALLOWED_TARGETS = new Set([
  'action_plan',
  'finding',
  'nonconformity',
  'evidence_request',
]);

const ALLOWED_REJECT_STATUSES = new Set(['rejected', 'archived']);

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeRole(role) {
  return String(role || '').toLowerCase().trim();
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.has(normalizeRole(role));
}

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null;
}

function normalizeStandardCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('ISO/IEC', 'ISO')
    .replace('ISO-', 'ISO');
}

function normalizePriority(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (['critica', 'critico', 'critical'].includes(normalized)) return 'critica';
  if (['alta', 'alto', 'high'].includes(normalized)) return 'alta';
  if (['baja', 'bajo', 'low'].includes(normalized)) return 'baja';
  return 'media';
}

function actionPlanPriority(priority) {
  const normalized = normalizePriority(priority);
  return normalized === 'critica' ? 'alta' : normalized;
}

function findingSeverity(priority) {
  const normalized = normalizePriority(priority);
  return normalized === 'critica' ? 'alta' : normalized;
}

function dueDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString().slice(0, 10);
}

function resolveTenantId(user, requestedTenantId) {
  const role = user?.role || user?.user_role || user?.userRole;
  const userTenantId = getUserTenantId(user);

  if (requestedTenantId && isPlatformRole(role)) return requestedTenantId;

  return userTenantId;
}

function assertTenantAccess(user, tenantId) {
  const role = user?.role || user?.user_role || user?.userRole;
  if (isPlatformRole(role)) return;

  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildDedupe(parts) {
  return parts
    .map((part) => String(part || 'none').trim().toLowerCase())
    .join(':')
    .replace(/\s+/g, '_')
    .slice(0, 500);
}

function suggestion({
  tenantId,
  standardCode,
  operationId = null,
  tenantControlId = null,
  sourceModule,
  sourceEntityType,
  sourceEntityId = null,
  sourceReason,
  suggestionType,
  targetRecordType = 'action_plan',
  title,
  description,
  rationale,
  priority = 'media',
  suggestedOwner = null,
  suggestedDueDate = null,
  payload = {},
  trace = {},
  createdBy = null,
}) {
  return {
    tenant_id: tenantId,
    standard_code: standardCode || null,
    operation_id: operationId || null,
    tenant_control_id: tenantControlId || null,
    source_module: sourceModule,
    source_entity_type: sourceEntityType,
    source_entity_id: sourceEntityId || null,
    source_reason: sourceReason || null,
    suggestion_type: suggestionType,
    target_record_type: targetRecordType,
    title: safeText(title, 'Accion operativa sugerida'),
    description: description || null,
    rationale: rationale || null,
    priority: normalizePriority(priority),
    dedupe_key: buildDedupe([
      sourceModule,
      sourceEntityType,
      sourceEntityId,
      standardCode,
      tenantControlId,
      suggestionType,
      targetRecordType,
      title,
    ]),
    suggested_owner: suggestedOwner || null,
    suggested_due_date: suggestedDueDate || dueDate(priority === 'critica' || priority === 'alta' ? 30 : 60),
    payload_json: payload,
    source_trace_json: trace,
    created_by: createdBy,
  };
}

async function getSuggestionOrThrow(client, id, tenantId) {
  const result = await client.query(
    `
    SELECT *
    FROM iso_operational_suggestions
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [id, tenantId]
  );

  if (!result.rowCount) {
    throw publicError(404, 'SUGGESTION_NOT_FOUND', 'Sugerencia no encontrada');
  }

  return result.rows[0];
}

async function tenantStandardActive(client, tenantId, standardCode) {
  if (!standardCode) return true;

  const result = await client.query(
    `
    SELECT 1
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND standard_code = $2
      AND is_active IS DISTINCT FROM false
    LIMIT 1
    `,
    [tenantId, standardCode]
  );

  return result.rowCount > 0;
}

async function resolveTenantControlContext(client, tenantId, tenantControlId) {
  if (!tenantControlId) return null;

  const result = await client.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      tc.status AS tenant_control_status,
      cc.iso,
      cc.clause,
      cc.category,
      cc.description AS control_description,
      c.id AS legacy_control_id
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN LATERAL (
      SELECT c1.id
      FROM controls c1
      WHERE c1.catalog_control_id = tc.control_id
      ORDER BY c1.id ASC
      LIMIT 1
    ) c ON TRUE
    WHERE tc.tenant_id = $1::uuid
      AND tc.id = $2::uuid
    LIMIT 1
    `,
    [tenantId, tenantControlId]
  );

  return result.rows[0] || null;
}

async function fetchExpressGapSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      g.id,
      g.tenant_id,
      g.standard_code,
      g.version_code,
      g.iso_control_id,
      g.control_code,
      g.gap_type,
      g.severity,
      g.title,
      g.description,
      g.recommendation,
      g.suggested_owner_role,
      g.suggested_due_days,
      i.tenant_control_id,
      i.catalog_control_id,
      tc.operation_id
    FROM iso_express_assessment_gaps g
    JOIN iso_express_assessments a
      ON a.id = g.assessment_id
     AND a.tenant_id = g.tenant_id
    LEFT JOIN iso_express_assessment_items i
      ON i.assessment_id = g.assessment_id
     AND i.iso_control_id = g.iso_control_id
    LEFT JOIN tenant_controls tc
      ON tc.id = i.tenant_control_id
    WHERE g.tenant_id = $1::uuid
      AND a.assessment_status IS DISTINCT FROM 'archived'
      AND g.created_at >= NOW() - INTERVAL '90 days'
    ORDER BY
      CASE g.severity
        WHEN 'critica' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
      END,
      g.created_at DESC
    LIMIT 80
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    operationId: row.operation_id,
    tenantControlId: row.tenant_control_id,
    sourceModule: 'iso_express_diagnostic',
    sourceEntityType: 'iso_express_assessment_gap',
    sourceEntityId: row.id,
    sourceReason: row.gap_type,
    suggestionType: row.gap_type === 'missing_evidence' ? 'solicitud_evidencia' : 'accion_correctiva',
    targetRecordType: 'action_plan',
    title: row.title,
    description: row.recommendation || row.description,
    rationale: `Brecha ${row.severity || 'media'} detectada en diagnostico express.`,
    priority: row.severity,
    suggestedOwner: row.suggested_owner_role,
    suggestedDueDate: dueDate(row.suggested_due_days || 30),
    payload: {
      version_code: row.version_code,
      control_code: row.control_code,
      catalog_control_id: row.catalog_control_id,
      suggested_action_type: row.gap_type,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchRiskMatrixSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      a.id AS action_id,
      a.run_id,
      a.risk_item_id,
      a.tenant_id,
      a.action_title,
      a.action_description,
      a.suggested_owner_role,
      a.suggested_due_days,
      a.priority,
      a.action_type,
      i.standard_code,
      i.version_code,
      i.tenant_control_id,
      i.asset_id,
      i.risk_title,
      i.residual_risk_level,
      i.residual_risk_score,
      tc.operation_id
    FROM iso_risk_matrix_actions a
    JOIN iso_risk_matrix_items i
      ON i.id = a.risk_item_id
    LEFT JOIN tenant_controls tc
      ON tc.id = i.tenant_control_id
    WHERE a.tenant_id = $1::uuid
      AND a.status = 'suggested'
      AND i.status IN ('suggested', 'accepted', 'needs_review')
      AND a.created_at >= NOW() - INTERVAL '90 days'
    ORDER BY
      CASE a.priority
        WHEN 'critica' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
      END,
      i.residual_risk_score DESC,
      a.created_at DESC
    LIMIT 100
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    operationId: row.operation_id,
    tenantControlId: row.tenant_control_id,
    sourceModule: 'iso_risk_matrix',
    sourceEntityType: 'iso_risk_matrix_action',
    sourceEntityId: row.action_id,
    sourceReason: row.action_type,
    suggestionType: 'tarea_riesgo',
    targetRecordType: 'action_plan',
    title: row.action_title,
    description: row.action_description || `Tratamiento sugerido para ${row.risk_title}.`,
    rationale: `Riesgo residual ${row.residual_risk_level} (${row.residual_risk_score}).`,
    priority: row.priority,
    suggestedOwner: row.suggested_owner_role,
    suggestedDueDate: dueDate(row.suggested_due_days || 30),
    payload: {
      version_code: row.version_code,
      risk_item_id: row.risk_item_id,
      asset_id: row.asset_id,
      residual_risk_level: row.residual_risk_level,
      residual_risk_score: row.residual_risk_score,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchControlHealthSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    WITH latest_health AS (
      SELECT DISTINCT ON (chs.tenant_control_id)
        chs.tenant_control_id,
        chs.standard_code,
        chs.health_status,
        chs.health_score,
        chs.calculated_at
      FROM control_health_scores chs
      WHERE chs.tenant_id = $1::uuid
      ORDER BY chs.tenant_control_id, chs.calculated_at DESC NULLS LAST
    )
    SELECT
      lh.*,
      tc.operation_id,
      cc.clause,
      cc.category,
      cc.description AS control_description
    FROM latest_health lh
    JOIN tenant_controls tc
      ON tc.id = lh.tenant_control_id
    LEFT JOIN controls_catalog cc
      ON cc.id = tc.control_id
    WHERE COALESCE(lh.health_score, 0) < 80
    ORDER BY lh.health_score ASC NULLS FIRST, lh.calculated_at DESC
    LIMIT 80
    `,
    [tenantId]
  );

  return result.rows.map((row) => {
    const critical = Number(row.health_score || 0) < 50 || String(row.health_status || '').toLowerCase() === 'deteriorado';
    return suggestion({
      tenantId,
      standardCode: row.standard_code,
      operationId: row.operation_id,
      tenantControlId: row.tenant_control_id,
      sourceModule: 'control_health',
      sourceEntityType: 'tenant_control',
      sourceEntityId: row.tenant_control_id,
      sourceReason: row.health_status || 'health_score_bajo',
      suggestionType: critical ? 'accion_correctiva' : 'revision_control',
      targetRecordType: critical ? 'finding' : 'action_plan',
      title: critical
        ? `Revisar control deteriorado: ${row.control_description || row.tenant_control_id}`
        : `Mejorar salud del control: ${row.control_description || row.tenant_control_id}`,
      description: 'La salud del control esta bajo el umbral esperado y requiere seguimiento operativo.',
      rationale: `Health score actual: ${row.health_score || 0}.`,
      priority: critical ? 'alta' : 'media',
      suggestedOwner: 'Responsable del control',
      suggestedDueDate: dueDate(critical ? 30 : 60),
      payload: {
        health_score: row.health_score,
        health_status: row.health_status,
        clause: row.clause,
        category: row.category,
      },
      trace: row,
      createdBy,
    });
  });
}

async function fetchEvidenceSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.operation_id,
      cc.iso AS standard_code,
      cc.clause,
      cc.category,
      cc.description AS control_description,
      COUNT(e.id)::integer AS evidence_count,
      COUNT(e.id) FILTER (
        WHERE LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
           OR e.validated = true
      )::integer AS approved_evidence_count
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
    LEFT JOIN evidences e
      ON e.tenant_id = tc.tenant_id
     AND (
       e.tenant_control_id = tc.id
       OR (
         e.tenant_control_id IS NULL
         AND e.control_id = tc.control_id
       )
     )
     AND COALESCE(e.status, '') <> 'deleted'
    WHERE tc.tenant_id = $1::uuid
      AND tc.status IN ('parcial', 'no cumple', 'pendiente')
    GROUP BY tc.id, tc.operation_id, cc.iso, cc.clause, cc.category, cc.description
    HAVING COUNT(e.id) FILTER (
      WHERE LOWER(COALESCE(e.status, '')) IN ('aprobada', 'aprobado', 'approved')
         OR e.validated = true
    ) = 0
    ORDER BY
      CASE tc.status WHEN 'no cumple' THEN 1 WHEN 'parcial' THEN 2 ELSE 3 END,
      cc.iso,
      cc.clause NULLS LAST
    LIMIT 80
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    operationId: row.operation_id,
    tenantControlId: row.tenant_control_id,
    sourceModule: 'evidence',
    sourceEntityType: 'tenant_control',
    sourceEntityId: row.tenant_control_id,
    sourceReason: 'missing_approved_evidence',
    suggestionType: 'solicitud_evidencia',
    targetRecordType: 'action_plan',
    title: `Solicitar evidencia para ${row.control_description || row.tenant_control_id}`,
    description: 'No hay evidencia aprobada asociada al control.',
    rationale: 'La falta de evidencia aprobada impide sostener cumplimiento operativo.',
    priority: 'alta',
    suggestedOwner: 'Responsable de evidencia',
    suggestedDueDate: dueDate(30),
    payload: {
      evidence_count: row.evidence_count,
      approved_evidence_count: row.approved_evidence_count,
      clause: row.clause,
      category: row.category,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchFindingSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      f.id,
      f.tenant_id,
      f.iso_code AS standard_code,
      f.title,
      f.description,
      f.finding_type,
      f.severity,
      f.status,
      f.owner,
      f.due_date,
      tc.id AS tenant_control_id,
      tc.operation_id
    FROM findings f
    LEFT JOIN controls c
      ON c.id = f.tenant_control_id
    LEFT JOIN tenant_controls tc
      ON tc.tenant_id = f.tenant_id
     AND tc.control_id = c.catalog_control_id
    WHERE f.tenant_id = $1::uuid
      AND LOWER(COALESCE(f.status, '')) NOT IN ('cerrado', 'closed')
      AND NOT EXISTS (
        SELECT 1
        FROM action_plans ap
        WHERE ap.tenant_id = f.tenant_id
          AND (
            ap.finding_id = f.id
            OR (ap.source_type = 'finding' AND ap.source_id = f.id)
          )
      )
    ORDER BY
      CASE f.severity WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      f.created_at DESC
    LIMIT 60
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    operationId: row.operation_id,
    tenantControlId: row.tenant_control_id,
    sourceModule: 'findings',
    sourceEntityType: 'finding',
    sourceEntityId: row.id,
    sourceReason: row.finding_type,
    suggestionType: 'accion_correctiva',
    targetRecordType: 'action_plan',
    title: `Crear plan para hallazgo: ${row.title}`,
    description: row.description,
    rationale: 'Hallazgo abierto sin plan de accion vinculado.',
    priority: row.severity,
    suggestedOwner: row.owner || 'Responsable de cumplimiento',
    suggestedDueDate: row.due_date || dueDate(30),
    payload: {
      finding_id: row.id,
      finding_type: row.finding_type,
      status: row.status,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchNonconformitySuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      nc.id,
      nc.tenant_id,
      nc.control_id,
      nc.control_description,
      nc.status,
      nc.detected_at,
      cc.iso AS standard_code,
      tc.id AS tenant_control_id,
      tc.operation_id
    FROM tenant_nonconformities nc
    LEFT JOIN controls_catalog cc
      ON cc.id = nc.control_id
    LEFT JOIN tenant_controls tc
      ON tc.tenant_id = nc.tenant_id
     AND tc.control_id = nc.control_id
    WHERE nc.tenant_id = $1::uuid
      AND LOWER(COALESCE(nc.status, 'abierta')) NOT IN ('resuelta', 'closed', 'cerrada', 'cerrado')
      AND NOT EXISTS (
        SELECT 1
        FROM action_plans ap
        WHERE ap.tenant_id = nc.tenant_id
          AND ap.nonconformity_id = nc.id
      )
    ORDER BY nc.detected_at DESC NULLS LAST
    LIMIT 60
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    operationId: row.operation_id,
    tenantControlId: row.tenant_control_id,
    sourceModule: 'nonconformities',
    sourceEntityType: 'tenant_nonconformity',
    sourceEntityId: row.id,
    sourceReason: row.status,
    suggestionType: 'accion_correctiva',
    targetRecordType: 'action_plan',
    title: `Crear plan para no conformidad: ${row.control_description || row.id}`,
    description: 'No conformidad abierta sin plan de accion vinculado.',
    rationale: 'Una no conformidad abierta requiere tratamiento y seguimiento.',
    priority: 'alta',
    suggestedOwner: 'Responsable de calidad',
    suggestedDueDate: dueDate(30),
    payload: {
      nonconformity_id: row.id,
      control_id: row.control_id,
      status: row.status,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchAssetRiskSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      ar.id,
      ar.asset_id,
      ar.risk,
      ar.impact,
      ar.probability,
      ar.level,
      a.name AS asset_name,
      a.type AS asset_type,
      a.criticality,
      a.iso AS standard_code
    FROM asset_risks ar
    JOIN assets a
      ON a.id = ar.asset_id
    WHERE a.tenant_id = $1::uuid
      AND LOWER(COALESCE(ar.level, '')) IN ('alto', 'alta', 'high', 'critico', 'crítico', 'critical')
      AND NOT EXISTS (
        SELECT 1
        FROM action_plans ap
        WHERE ap.tenant_id = a.tenant_id
          AND ap.asset_id = a.id
          AND ap.source_type = 'risk'
          AND ap.source_id = ar.id
      )
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(ar.level, '')) IN ('critico', 'crítico', 'critical') THEN 1
        ELSE 2
      END,
      ar.created_at DESC
    LIMIT 60
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: normalizeStandardCode(row.standard_code),
    sourceModule: 'asset_risks',
    sourceEntityType: 'asset_risk',
    sourceEntityId: row.id,
    sourceReason: row.level,
    suggestionType: 'tarea_riesgo',
    targetRecordType: 'action_plan',
    title: `Tratar riesgo de activo: ${row.risk}`,
    description: row.impact,
    rationale: `Riesgo ${row.level} asociado al activo ${row.asset_name}.`,
    priority: row.level,
    suggestedOwner: 'Responsable del activo',
    suggestedDueDate: dueDate(30),
    payload: {
      asset_id: row.asset_id,
      asset_name: row.asset_name,
      asset_type: row.asset_type,
      probability: row.probability,
      impact: row.impact,
    },
    trace: row,
    createdBy,
  }));
}

async function fetchDocumentSuggestions(tenantId, createdBy) {
  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      standard_code,
      version_code,
      document_type,
      title,
      document_status,
      created_at
    FROM iso_generated_documents
    WHERE tenant_id = $1::uuid
      AND document_status IN ('draft', 'generated')
      AND created_at >= NOW() - INTERVAL '120 days'
    ORDER BY created_at DESC
    LIMIT 40
    `,
    [tenantId]
  );

  return result.rows.map((row) => suggestion({
    tenantId,
    standardCode: row.standard_code,
    sourceModule: 'iso_document_generator',
    sourceEntityType: 'iso_generated_document',
    sourceEntityId: row.id,
    sourceReason: row.document_status,
    suggestionType: 'revision_documental',
    targetRecordType: 'action_plan',
    title: `Revisar documento generado: ${row.title}`,
    description: 'Documento ISO generado pendiente de revision, ajuste y aprobacion interna.',
    rationale: 'Los documentos generados deben revisarse antes de uso formal o auditoria.',
    priority: row.version_code === '2026_FDIS' ? 'alta' : 'media',
    suggestedOwner: 'Responsable documental',
    suggestedDueDate: dueDate(30),
    payload: {
      document_id: row.id,
      document_type: row.document_type,
      version_code: row.version_code,
    },
    trace: row,
    createdBy,
  }));
}

async function buildSuggestions(tenantId, user, filters = {}) {
  const createdBy = getUserId(user);
  const include = new Set(
    String(filters.source_module || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const use = (key) => include.size === 0 || include.has(key);
  const batches = await Promise.all([
    use('iso_express_diagnostic') ? fetchExpressGapSuggestions(tenantId, createdBy) : [],
    use('iso_risk_matrix') ? fetchRiskMatrixSuggestions(tenantId, createdBy) : [],
    use('control_health') ? fetchControlHealthSuggestions(tenantId, createdBy) : [],
    use('evidence') ? fetchEvidenceSuggestions(tenantId, createdBy) : [],
    use('findings') ? fetchFindingSuggestions(tenantId, createdBy) : [],
    use('nonconformities') ? fetchNonconformitySuggestions(tenantId, createdBy) : [],
    use('asset_risks') ? fetchAssetRiskSuggestions(tenantId, createdBy) : [],
    use('iso_document_generator') ? fetchDocumentSuggestions(tenantId, createdBy) : [],
  ]);

  const seen = new Set();
  return batches
    .flat()
    .filter((item) => {
      if (filters.standard_code && item.standard_code !== normalizeStandardCode(filters.standard_code)) return false;
      if (seen.has(item.dedupe_key)) return false;
      seen.add(item.dedupe_key);
      return true;
    })
    .slice(0, 300);
}

async function insertSuggestions(client, suggestions) {
  const inserted = [];

  for (const item of suggestions) {
    const result = await client.query(
      `
      INSERT INTO iso_operational_suggestions (
        tenant_id, standard_code, operation_id, tenant_control_id,
        source_module, source_entity_type, source_entity_id, source_reason,
        suggestion_type, target_record_type, title, description, rationale,
        priority, status, dedupe_key, suggested_owner, suggested_due_date,
        payload_json, source_trace_json, ai_trace_id, created_by
      )
      VALUES (
        $1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7::uuid,$8,$9,$10,$11,$12,$13,
        $14,'pending',$15,$16,$17,$18::jsonb,$19::jsonb,$20::uuid,$21::uuid
      )
      ON CONFLICT (tenant_id, dedupe_key)
      WHERE status IN ('pending', 'approved', 'applied')
      DO UPDATE SET
        description = EXCLUDED.description,
        rationale = EXCLUDED.rationale,
        priority = EXCLUDED.priority,
        suggested_owner = EXCLUDED.suggested_owner,
        suggested_due_date = EXCLUDED.suggested_due_date,
        payload_json = iso_operational_suggestions.payload_json || EXCLUDED.payload_json,
        source_trace_json = EXCLUDED.source_trace_json,
        updated_at = NOW()
      RETURNING *
      `,
      [
        item.tenant_id,
        item.standard_code,
        item.operation_id,
        item.tenant_control_id,
        item.source_module,
        item.source_entity_type,
        item.source_entity_id,
        item.source_reason,
        item.suggestion_type,
        item.target_record_type,
        item.title,
        item.description,
        item.rationale,
        item.priority,
        item.dedupe_key,
        item.suggested_owner,
        item.suggested_due_date,
        JSON.stringify(item.payload_json || {}),
        JSON.stringify(item.source_trace_json || {}),
        item.ai_trace_id || null,
        item.created_by || null,
      ]
    );
    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function generateSuggestions({ user, tenantId, filters = {}, dryRun = false }) {
  const resolvedTenantId = resolveTenantId(user, tenantId || filters.tenant_id);
  if (!resolvedTenantId) {
    throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  }
  assertTenantAccess(user, resolvedTenantId);

  const candidates = await buildSuggestions(resolvedTenantId, user, filters);

  if (dryRun) {
    return {
      dry_run: true,
      generated_count: candidates.length,
      inserted_count: 0,
      suggestions: candidates,
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await insertSuggestions(client, candidates);
    await client.query(
      `
      INSERT INTO iso_operational_suggestion_audit_log (
        tenant_id, action, actor_user_id, new_data, metadata
      )
      VALUES ($1::uuid,'generate',$2::uuid,$3::jsonb,$4::jsonb)
      `,
      [
        resolvedTenantId,
        getUserId(user),
        JSON.stringify({ generated_count: candidates.length, inserted_count: rows.length }),
        JSON.stringify({ filters }),
      ]
    );
    await client.query('COMMIT');

    return {
      dry_run: false,
      generated_count: candidates.length,
      inserted_count: rows.length,
      suggestions: rows,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listSuggestions(user, filters = {}) {
  const tenantId = resolveTenantId(user, filters.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const params = [tenantId];
  const where = ['tenant_id = $1::uuid'];

  if (filters.standard_code) {
    params.push(normalizeStandardCode(filters.standard_code));
    where.push(`standard_code = $${params.length}`);
  }
  if (filters.status) {
    params.push(String(filters.status));
    where.push(`status = $${params.length}`);
  } else {
    where.push(`status IS DISTINCT FROM 'archived'`);
  }
  if (filters.priority) {
    params.push(normalizePriority(filters.priority));
    where.push(`priority = $${params.length}`);
  }
  if (filters.suggestion_type) {
    params.push(String(filters.suggestion_type));
    where.push(`suggestion_type = $${params.length}`);
  }
  if (filters.target_record_type) {
    params.push(String(filters.target_record_type));
    where.push(`target_record_type = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_operational_suggestions_queue
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE priority
        WHEN 'critica' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 250
    `,
    params
  );

  return result.rows;
}

async function getSummary(user, filters = {}) {
  const tenantId = resolveTenantId(user, filters.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const [summary, byType, recent] = await Promise.all([
    pool.query(
      `
      SELECT *
      FROM v_iso_operational_suggestions_summary
      WHERE tenant_id = $1::uuid
      ORDER BY standard_code NULLS LAST
      `,
      [tenantId]
    ),
    pool.query(
      `
      SELECT
        suggestion_type,
        target_record_type,
        status,
        COUNT(*)::integer AS count
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
        AND status IS DISTINCT FROM 'archived'
      GROUP BY suggestion_type, target_record_type, status
      ORDER BY count DESC, suggestion_type
      `,
      [tenantId]
    ),
    pool.query(
      `
      SELECT id, standard_code, priority, status, title, target_record_type, created_at
      FROM iso_operational_suggestions
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 12
      `,
      [tenantId]
    ),
  ]);

  return {
    tenant_id: tenantId,
    by_standard: summary.rows,
    by_type: byType.rows,
    recent: recent.rows,
    totals: summary.rows.reduce((acc, row) => ({
      total_suggestions: acc.total_suggestions + Number(row.total_suggestions || 0),
      pending_count: acc.pending_count + Number(row.pending_count || 0),
      approved_count: acc.approved_count + Number(row.approved_count || 0),
      rejected_count: acc.rejected_count + Number(row.rejected_count || 0),
      critical_count: acc.critical_count + Number(row.critical_count || 0),
      high_count: acc.high_count + Number(row.high_count || 0),
    }), {
      total_suggestions: 0,
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
      critical_count: 0,
      high_count: 0,
    }),
  };
}

async function getSuggestion(user, id, tenantIdOverride = null) {
  const tenantId = resolveTenantId(user, tenantIdOverride);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const result = await pool.query(
    `
    SELECT *
    FROM v_iso_operational_suggestions_queue
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [id, tenantId]
  );

  if (!result.rowCount) {
    throw publicError(404, 'SUGGESTION_NOT_FOUND', 'Sugerencia no encontrada');
  }

  return result.rows[0];
}

async function createActionPlan(client, suggestionRow, user, override = {}) {
  const target = { ...suggestionRow.payload_json, ...override };
  const tenantId = suggestionRow.tenant_id;
  const standardCode = normalizeStandardCode(target.standard_code || suggestionRow.standard_code);
  const tenantControl = await resolveTenantControlContext(client, tenantId, target.tenant_control_id || suggestionRow.tenant_control_id);

  if (standardCode) {
    const active = await tenantStandardActive(client, tenantId, standardCode);
    if (!active) {
      throw publicError(400, 'STANDARD_NOT_ACTIVE', 'La norma no esta activa para este tenant');
    }
  }

  const sourceType = target.source_type || (
    suggestionRow.source_module === 'findings' ? 'finding' :
    suggestionRow.source_module === 'nonconformities' ? 'nonconformity' :
    suggestionRow.source_module === 'asset_risks' || target.asset_id ? 'risk' :
    tenantControl ? 'control' :
    'ia'
  );
  const sourceId = target.source_id ||
    target.finding_id ||
    target.nonconformity_id ||
    target.asset_id ||
    suggestionRow.source_entity_id ||
    suggestionRow.id;

  const insert = await client.query(
    `
    INSERT INTO action_plans (
      tenant_id,
      iso_code,
      title,
      description,
      source_type,
      source_id,
      priority,
      status,
      owner,
      due_date,
      created_by,
      tenant_control_id,
      finding_id,
      nonconformity_id,
      audit_id,
      asset_id,
      approval_status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,'abierto',$8,$9,$10,$11,$12,$13,$14,$15,'no_requerida')
    RETURNING id
    `,
    [
      tenantId,
      standardCode || tenantControl?.iso || null,
      target.title || suggestionRow.title,
      target.description || suggestionRow.description || suggestionRow.rationale,
      sourceType,
      sourceId,
      actionPlanPriority(target.priority || suggestionRow.priority),
      target.owner || suggestionRow.suggested_owner || null,
      target.due_date || suggestionRow.suggested_due_date || null,
      getUserId(user),
      tenantControl?.tenant_control_id || null,
      target.finding_id || (suggestionRow.source_entity_type === 'finding' ? suggestionRow.source_entity_id : null),
      target.nonconformity_id || (suggestionRow.source_entity_type === 'tenant_nonconformity' ? suggestionRow.source_entity_id : null),
      target.audit_id || null,
      target.asset_id || suggestionRow.payload_json?.asset_id || null,
    ]
  );

  await client.query(
    `
    INSERT INTO action_plan_updates (
      action_plan_id,
      tenant_id,
      comment,
      progress_percent,
      status_after,
      blocked_reason,
      created_by
    )
    VALUES ($1,$2,$3,0,'abierto',NULL,$4)
    `,
    [
      insert.rows[0].id,
      tenantId,
      `Plan creado desde sugerencia ISO ${suggestionRow.id}.`,
      getUserId(user),
    ]
  );

  return insert.rows[0].id;
}

async function createFinding(client, suggestionRow, user, override = {}) {
  const target = { ...suggestionRow.payload_json, ...override };
  const tenantId = suggestionRow.tenant_id;
  const tenantControl = await resolveTenantControlContext(client, tenantId, target.tenant_control_id || suggestionRow.tenant_control_id);

  if (!tenantControl?.legacy_control_id) {
    throw publicError(400, 'CONTROL_REQUIRED_FOR_FINDING', 'Para crear un hallazgo se requiere un control operativo con equivalente legacy');
  }

  const standardCode = normalizeStandardCode(target.standard_code || suggestionRow.standard_code || tenantControl.iso);

  const insert = await client.query(
    `
    INSERT INTO findings (
      tenant_id,
      iso_code,
      title,
      description,
      finding_type,
      severity,
      status,
      source_type,
      source_id,
      owner,
      detected_by,
      due_date,
      created_by,
      tenant_control_id,
      nonconformity_id,
      audit_id,
      asset_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,'abierto',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING id
    `,
    [
      tenantId,
      standardCode,
      target.title || suggestionRow.title,
      target.description || suggestionRow.description,
      target.finding_type || 'observacion',
      findingSeverity(target.priority || suggestionRow.priority),
      target.source_type || 'ia',
      target.source_id || suggestionRow.source_entity_id || suggestionRow.id,
      target.owner || suggestionRow.suggested_owner || null,
      target.detected_by || 'Ejecucion ISO',
      target.due_date || suggestionRow.suggested_due_date || null,
      getUserId(user),
      tenantControl.legacy_control_id,
      target.nonconformity_id || null,
      target.audit_id || null,
      target.asset_id || suggestionRow.payload_json?.asset_id || null,
    ]
  );

  return insert.rows[0].id;
}

async function createNonconformity(client, suggestionRow, user, override = {}) {
  const target = { ...suggestionRow.payload_json, ...override };
  const tenantId = suggestionRow.tenant_id;
  const tenantControl = await resolveTenantControlContext(client, tenantId, target.tenant_control_id || suggestionRow.tenant_control_id);
  const catalogControlId = target.control_id || target.catalog_control_id || tenantControl?.catalog_control_id;

  if (!catalogControlId) {
    throw publicError(400, 'CONTROL_REQUIRED_FOR_NONCONFORMITY', 'Para crear no conformidad se requiere control de catalogo');
  }

  const insert = await client.query(
    `
    INSERT INTO tenant_nonconformities (
      tenant_id,
      control_id,
      control_description,
      status,
      detected_at
    )
    VALUES ($1::uuid,$2::uuid,$3,'abierta',NOW())
    RETURNING id
    `,
    [
      tenantId,
      catalogControlId,
      target.description || suggestionRow.description || suggestionRow.title,
    ]
  );

  return insert.rows[0].id;
}

async function approveSuggestion(user, id, payload = {}) {
  const tenantId = resolveTenantId(user, payload.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const row = await getSuggestionOrThrow(client, id, tenantId);

    if (!['pending', 'error'].includes(row.status)) {
      throw publicError(400, 'SUGGESTION_NOT_PENDING', 'La sugerencia no esta pendiente');
    }

    const targetRecordType = payload.target_record_type || row.target_record_type;
    if (!ALLOWED_TARGETS.has(targetRecordType)) {
      throw publicError(400, 'INVALID_TARGET_RECORD_TYPE', 'Tipo de destino invalido');
    }

    if (payload.dry_run === true) {
      await client.query('ROLLBACK');
      return {
        dry_run: true,
        would_create: targetRecordType,
        suggestion: row,
      };
    }

    let createdRecordId = null;
    if (targetRecordType === 'action_plan') {
      createdRecordId = await createActionPlan(client, row, user, payload);
    } else if (targetRecordType === 'finding') {
      createdRecordId = await createFinding(client, row, user, payload);
    } else if (targetRecordType === 'nonconformity') {
      createdRecordId = await createNonconformity(client, row, user, payload);
    } else if (targetRecordType === 'evidence_request') {
      createdRecordId = row.id;
    }

    const updated = await client.query(
      `
      UPDATE iso_operational_suggestions
      SET
        status = 'applied',
        approved_by = $3::uuid,
        approved_at = NOW(),
        created_record_type = $4,
        created_record_id = $5::uuid,
        payload_json = payload_json || $6::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      RETURNING *
      `,
      [
        id,
        tenantId,
        getUserId(user),
        targetRecordType,
        createdRecordId,
        JSON.stringify({ approve_payload: payload }),
      ]
    );

    await client.query(
      `
      INSERT INTO iso_operational_suggestion_audit_log (
        suggestion_id, tenant_id, action, actor_user_id, old_data, new_data
      )
      VALUES ($1::uuid,$2::uuid,'approve',$3::uuid,$4::jsonb,$5::jsonb)
      `,
      [
        id,
        tenantId,
        getUserId(user),
        JSON.stringify({ status: row.status }),
        JSON.stringify({
          status: 'applied',
          created_record_type: targetRecordType,
          created_record_id: createdRecordId,
        }),
      ]
    );

    await client.query('COMMIT');

    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rejectSuggestion(user, id, payload = {}) {
  const tenantId = resolveTenantId(user, payload.tenant_id);
  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'No se pudo resolver tenant_id');
  assertTenantAccess(user, tenantId);

  const status = ALLOWED_REJECT_STATUSES.has(payload.status) ? payload.status : 'rejected';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const row = await getSuggestionOrThrow(client, id, tenantId);

    if (!['pending', 'error'].includes(row.status)) {
      throw publicError(400, 'SUGGESTION_NOT_PENDING', 'Solo se pueden rechazar sugerencias pendientes');
    }

    const updated = await client.query(
      `
      UPDATE iso_operational_suggestions
      SET
        status = $3,
        rejected_by = $4::uuid,
        rejected_at = NOW(),
        rejection_comment = $5,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
      RETURNING *
      `,
      [id, tenantId, status, getUserId(user), payload.rejection_comment || null]
    );

    await client.query(
      `
      INSERT INTO iso_operational_suggestion_audit_log (
        suggestion_id, tenant_id, action, actor_user_id, old_data, new_data
      )
      VALUES ($1::uuid,$2::uuid,'reject',$3::uuid,$4::jsonb,$5::jsonb)
      `,
      [
        id,
        tenantId,
        getUserId(user),
        JSON.stringify({ status: row.status }),
        JSON.stringify({ status, rejection_comment: payload.rejection_comment || null }),
      ]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  generateSuggestions,
  listSuggestions,
  getSummary,
  getSuggestion,
  approveSuggestion,
  rejectSuggestion,
};
