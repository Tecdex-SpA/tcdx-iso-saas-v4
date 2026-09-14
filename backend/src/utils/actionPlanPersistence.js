const OPTIONAL_ACTION_PLAN_COLUMNS = Object.freeze([
  'description',
  'priority',
  'owner',
  'created_by',
  'approval_status',
  'approval_requested_at',
  'approval_requested_by',
  'approval_reviewed_at',
  'approval_reviewed_by',
  'approval_comment',
  'ai_trace_id',
  'ai_source_level',
  'ai_source_label',
  'ai_confidence',
  'ai_confidence_score',
  'ai_orchestration_json',
  'ai_enhanced_answer_json',
]);

const REQUIRED_ACTION_PLAN_COLUMNS = Object.freeze([
  'id',
  'tenant_id',
  'tenant_control_id',
  'finding_id',
  'audit_id',
  'asset_id',
  'nonconformity_id',
  'title',
  'status',
  'iso_code',
  'source_type',
  'source_id',
  'due_date',
  'completed_at',
  'owner_user_id',
  'metadata',
  'created_at',
  'updated_at',
]);

const OPTIONAL_COLUMN_SET = new Set(OPTIONAL_ACTION_PLAN_COLUMNS);
const REQUIRED_COLUMN_SET = new Set(REQUIRED_ACTION_PLAN_COLUMNS);
let cachedColumns = null;

async function getActionPlanColumns(client) {
  if (cachedColumns) return cachedColumns;

  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ANY (current_schemas(false))
      AND table_name = 'action_plans'
    `
  );

  cachedColumns = new Set(result.rows.map((row) => row.column_name));
  return cachedColumns;
}

function definedEntries(values) {
  return Object.entries(values || {}).filter(([, value]) => value !== undefined);
}

function metadataValue(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function addMetadataFallback(metadata, key, value) {
  if (value === undefined) return;
  metadata[key] = metadataValue(value);
}

function createContractError(code, field) {
  const error = new Error(`${code}:${field}`);
  error.code = code;
  error.field = field;
  return error;
}

function assertKnownActionPlanField(columns, key) {
  if (REQUIRED_COLUMN_SET.has(key)) {
    if (columns.has(key)) return 'physical';
    throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', key);
  }
  if (OPTIONAL_COLUMN_SET.has(key)) {
    if (columns.has(key)) return 'physical';
    if (columns.has('metadata')) return 'optional_metadata';
    throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', 'metadata');
  }
  throw createContractError('ACTION_PLAN_UNKNOWN_COLUMN', key);
}

async function insertActionPlan(client, values, { returning = '*' } = {}) {
  const columns = await getActionPlanColumns(client);
  const insertColumns = [];
  const params = [];
  const metadata = { ...(values.metadata || {}) };

  if (values?.metadata !== undefined && !columns.has('metadata')) {
    throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', 'metadata');
  }

  for (const [key, value] of definedEntries(values)) {
    if (key === 'metadata') continue;

    const fieldType = assertKnownActionPlanField(columns, key);

    if (fieldType === 'optional_metadata') {
      if (!columns.has('metadata')) {
        throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', 'metadata');
      }
      addMetadataFallback(metadata, key, value);
      continue;
    }

    insertColumns.push(key);
    params.push(value);
  }

  if (columns.has('metadata')) {
    insertColumns.push('metadata');
    params.push(JSON.stringify(metadata));
  }

  if (!insertColumns.length) {
    throw new Error('ACTION_PLAN_INSERT_WITHOUT_COLUMNS');
  }

  const placeholders = params.map((_, index) => `$${index + 1}`);
  return client.query(
    `
    INSERT INTO action_plans (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning}
    `,
    params
  );
}

async function updateActionPlan(client, id, values, { whereTenantId = null, returning = null } = {}) {
  const columns = await getActionPlanColumns(client);
  const assignments = [];
  const params = [];
  const metadataPatch = {};

  for (const [key, value] of definedEntries(values)) {
    if (key === 'metadata') {
      if (!columns.has('metadata')) {
        throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', 'metadata');
      }
      Object.assign(metadataPatch, value || {});
      continue;
    }

    const fieldType = assertKnownActionPlanField(columns, key);

    if (fieldType === 'optional_metadata') {
      if (!columns.has('metadata')) {
        throw createContractError('ACTION_PLAN_REQUIRED_COLUMN_MISSING', 'metadata');
      }
      addMetadataFallback(metadataPatch, key, value);
      continue;
    }

    params.push(value);
    assignments.push(`${key} = $${params.length}`);
  }

  if (Object.keys(metadataPatch).length && columns.has('metadata')) {
    params.push(JSON.stringify(metadataPatch));
    assignments.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${params.length}::jsonb`);
  }

  if (!assignments.length) {
    return { rowCount: 0, rows: [] };
  }

  params.push(id);
  const idParam = `$${params.length}`;
  let where = `id = ${idParam}`;

  if (whereTenantId) {
    params.push(whereTenantId);
    where += ` AND tenant_id = $${params.length}`;
  }

  return client.query(
    `
    UPDATE action_plans
    SET ${assignments.join(',\n        ')}
    WHERE ${where}
    ${returning ? `RETURNING ${returning}` : ''}
    `,
    params
  );
}

function actionPlanRuntimeProjection(alias = 'ap') {
  const row = `to_jsonb(${alias})`;
  const metadata = `COALESCE(${alias}.metadata, '{}'::jsonb)`;

  return `
    COALESCE(NULLIF(${row}->>'description', ''), NULLIF(${metadata}->>'description', ''), ${alias}.title) AS description,
    COALESCE(NULLIF(${row}->>'priority', ''), NULLIF(${metadata}->>'priority', ''), 'media') AS priority,
    COALESCE(NULLIF(${row}->>'owner', ''), NULLIF(${metadata}->>'owner', '')) AS owner,
    COALESCE(NULLIF(${row}->>'approval_status', ''), NULLIF(${metadata}->>'approval_status', ''), 'no_requerida') AS approval_status
  `;
}

function actionPlanDescriptionSql(alias = 'ap') {
  const row = `to_jsonb(${alias})`;
  const metadata = `COALESCE(${alias}.metadata, '{}'::jsonb)`;
  return `COALESCE(NULLIF(${row}->>'description', ''), NULLIF(${metadata}->>'description', ''), ${alias}.title)`;
}

module.exports = {
  actionPlanDescriptionSql,
  actionPlanRuntimeProjection,
  getActionPlanColumns,
  insertActionPlan,
  updateActionPlan,
  _private: {
    OPTIONAL_ACTION_PLAN_COLUMNS,
    REQUIRED_ACTION_PLAN_COLUMNS,
    assertKnownActionPlanField,
  },
};
