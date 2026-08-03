'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');
const asyncJobs = require('../asyncJob.service');
const { applyMappings, TRANSFORMATIONS } = require('./typedTransformations');
const { stableHash, evaluateQuality, evaluateFreshness, evaluateSufficiency } = require('./semanticEvaluation.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;
const JOB_TYPES = new Set(['semantic_source.ingest','semantic_source.validate','semantic_source.snapshot','semantic_source.freshness','semantic_source.reconcile']);
const PLATFORM_ROLES = new Set(['superadmin','super_admin','platform_admin','admin_global','global_admin','owner']);

class SemanticError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'SemanticError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function tenantId(scope) {
  const value = String(
    scope?.tenant_id || scope?.tenantId || scope?.user?.tenant_id || scope?.user?.tenantId ||
    scope?.user?.tenant || scope?.user?.company_id || scope?.user?.companyId || ''
  ).trim();
  if (!UUID_RE.test(value)) throw new SemanticError('TENANT_REQUIRED', 'Se requiere contexto de empresa.', 403);
  return value;
}

function actorId(scope) {
  const value = scope?.user?.user_id || scope?.user?.userId || scope?.user?.id || null;
  return UUID_RE.test(String(value || '')) ? value : null;
}

function isPlatform(scope) {
  return PLATFORM_ROLES.has(String(scope?.user?.role || scope?.user?.user_role || '').toLowerCase());
}

function uuid(value, label = 'id') {
  if (!UUID_RE.test(String(value || ''))) throw new SemanticError('SEMANTIC_UUID_INVALID', `${label} no es UUID válido.`, 422);
  return String(value);
}

function text(value, fallback = null) {
  const normalized = value === null || value === undefined ? '' : String(value).trim();
  return normalized || fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function limit(value, fallback = 50, maximum = 100) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, maximum)) : fallback;
}

function identifier(value, label) {
  const normalized = text(value);
  if (!normalized || !IDENTIFIER_RE.test(normalized)) throw new SemanticError('SEMANTIC_IDENTIFIER_INVALID', `${label} no es un identificador permitido.`, 422);
  return normalized;
}

function quoteIdentifier(value, label) {
  return `"${identifier(value, label)}"`;
}

function sanitizeError(error) {
  return String(error?.message || 'semantic layer error')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/password\s*=\s*\S+/gi, 'password=[redacted]')
    .replace(/token\s*=\s*\S+/gi, 'token=[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 300);
}

async function audit(client, scope, eventType, entityType, entityId, requestId, metadata = {}) {
  await client.query(`INSERT INTO commercial_events (tenant_id,actor_user_id,event_type,entity_type,entity_id,after_state,reason,request_id)
    VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb,'phase5_c2_semantic',$7)`,
  [tenantId(scope), actorId(scope), eventType, entityType, entityId || null, JSON.stringify(metadata), requestId || null]);
}

async function contract(client, scope, contractId, lock = false) {
  const result = await client.query(`SELECT * FROM data_source_contracts
    WHERE id=$1::uuid AND (tenant_id=$2::uuid OR tenant_id IS NULL)${lock ? ' FOR UPDATE' : ''}`,
  [uuid(contractId, 'contract_id'), tenantId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_CONTRACT_NOT_FOUND', 'Contrato semántico no encontrado.', 404);
  return result.rows[0];
}

async function version(client, scope, versionId, lock = false) {
  const result = await client.query(`SELECT version.*,contract.tenant_id,contract.source_code,contract.entity_type,contract.adapter_key
    FROM data_source_contract_versions version JOIN data_source_contracts contract ON contract.id=version.contract_id
    WHERE version.id=$1::uuid AND (contract.tenant_id=$2::uuid OR contract.tenant_id IS NULL)${lock ? ' FOR UPDATE OF version' : ''}`,
  [uuid(versionId, 'version_id'), tenantId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_VERSION_NOT_FOUND', 'Versión semántica no encontrada.', 404);
  return result.rows[0];
}

async function assertLimit(client, scope, resourceKey, currentCount, increment = 1) {
  const result = await client.query(`SELECT COALESCE(tenant_limit.limit_value,definition.default_limit) AS allowed
    FROM usage_limit_definitions definition
    LEFT JOIN tenant_usage_limits tenant_limit ON tenant_limit.resource_key=definition.resource_key AND tenant_limit.tenant_id=$1::uuid AND tenant_limit.status='active'
    WHERE definition.resource_key=$2`, [tenantId(scope), resourceKey]);
  const allowed = result.rows[0]?.allowed;
  if (allowed !== null && allowed !== undefined && currentCount + increment > Number(allowed)) {
    throw new SemanticError('LIMIT_REACHED', 'Se alcanzó el límite contratado para esta operación.', 429, { resource_key: resourceKey });
  }
}

async function listContracts(scope, filters = {}) {
  const result = await pool.query(`SELECT contract.*,
      version.version_number AS current_version_number,
      version.minimum_coverage,
      version.maximum_age_seconds
    FROM data_source_contracts contract
    LEFT JOIN data_source_contract_versions version ON version.id=contract.current_version_id
    WHERE (contract.tenant_id=$1::uuid OR contract.tenant_id IS NULL)
      AND ($2::text IS NULL OR contract.status=$2)
      AND ($3::text IS NULL OR contract.source_code ILIKE '%'||$3||'%' OR contract.display_name ILIKE '%'||$3||'%')
    ORDER BY contract.tenant_id NULLS FIRST,contract.updated_at DESC LIMIT $4`,
  [tenantId(scope), text(filters.status), text(filters.search), limit(filters.limit)]);
  return result.rows;
}

async function reconcileLegacyContracts(scope) {
  const result = await pool.query(`SELECT legacy.source_code,legacy.version_number AS legacy_version,legacy.checksum AS legacy_checksum,
      contract.id AS semantic_contract_id,version.version_number AS semantic_version,version.checksum AS semantic_checksum,
      COALESCE(mapping.mapping_count,0)::int AS mapping_count,
      CASE WHEN contract.id IS NULL THEN 'missing'
           WHEN version.id IS NULL THEN 'version_missing'
           WHEN COALESCE(mapping.mapping_count,0)=0 THEN 'mapping_required'
           WHEN version.checksum=legacy.checksum THEN 'equivalent'
           ELSE 'adapted' END AS reconciliation_status
    FROM official_formula_source_contracts legacy
    LEFT JOIN data_source_contracts contract ON contract.source_code=legacy.source_code AND contract.tenant_id IS NULL
    LEFT JOIN data_source_contract_versions version ON version.id=contract.current_version_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS mapping_count
      FROM data_source_field_mappings field_mapping
      WHERE field_mapping.contract_version_id=version.id
        AND field_mapping.tenant_id=$1::uuid
        AND field_mapping.status='active'
    ) mapping ON true
    WHERE legacy.status='published'
    ORDER BY legacy.source_code`, [tenantId(scope)]);
  const rows = result.rows;
  return {
    status: rows.every((row) => row.reconciliation_status === 'equivalent') ? 'equivalent' : 'compatible_with_adapters',
    total: rows.length,
    equivalent: rows.filter((row) => row.reconciliation_status === 'equivalent').length,
    adapted: rows.filter((row) => !['equivalent','missing','version_missing'].includes(row.reconciliation_status)).length,
    missing: rows.filter((row) => row.reconciliation_status.includes('missing')).length,
    contracts: rows,
    tenant_id: tenantId(scope),
  };
}

async function createContract(scope, body = {}, requestId = null) {
  const tenant = body.global === true ? null : tenantId(scope);
  if (tenant === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'Solo administración de plataforma puede crear catálogos globales.', 403);
  const sourceCode = text(body.source_code);
  const adapterKey = text(body.adapter_key);
  if (!/^[a-z0-9][a-z0-9._-]{2,119}$/.test(sourceCode || '') || !/^[a-z0-9][a-z0-9._-]{2,119}$/.test(adapterKey || '')) {
    throw new SemanticError('SEMANTIC_CONTRACT_INVALID', 'Código de fuente o adaptador inválido.', 422);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const count = await client.query('SELECT COUNT(*)::int AS count FROM data_source_contracts WHERE tenant_id=$1::uuid AND status<>\'retired\'', [tenantId(scope)]);
    await assertLimit(client, scope, 'semantic_contracts', Number(count.rows[0].count));
    const result = await client.query(`INSERT INTO data_source_contracts
      (tenant_id,source_code,display_name,entity_type,adapter_key,status,owner_user_id,created_by,updated_by,metadata)
      VALUES ($1::uuid,$2,$3,$4,$5,'draft',$6::uuid,$7::uuid,$7::uuid,$8::jsonb) RETURNING *`,
    [tenant, sourceCode, text(body.display_name), text(body.entity_type), adapterKey, body.owner_user_id || null, actorId(scope), JSON.stringify(body.metadata || {})]);
    await audit(client, scope, 'semantic.contract.created', 'data_source_contract', result.rows[0].id, requestId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new SemanticError('SEMANTIC_CONTRACT_DUPLICATE', 'Ya existe un contrato con ese código.', 409);
    throw error;
  } finally {
    client.release();
  }
}

async function updateContract(scope, contractId, body = {}, requestId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await contract(client, scope, contractId, true);
    if (current.tenant_id === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'El catálogo global es administrado por plataforma.', 403);
    if (current.status === 'published' && (body.source_code || body.entity_type || body.adapter_key)) {
      throw new SemanticError('SEMANTIC_PUBLISHED_IMMUTABLE', 'La definición técnica publicada cambia mediante una nueva versión.', 409);
    }
    if (body.adapter_key !== undefined && !/^[a-z0-9][a-z0-9._-]{2,119}$/.test(text(body.adapter_key) || '')) {
      throw new SemanticError('SEMANTIC_CONTRACT_INVALID', 'El adaptador no cumple el formato permitido.', 422);
    }
    const result = await client.query(`UPDATE data_source_contracts SET
      display_name=COALESCE($2,display_name),entity_type=COALESCE($3,entity_type),adapter_key=COALESCE($4,adapter_key),
      owner_user_id=COALESCE($5::uuid,owner_user_id),metadata=metadata||$6::jsonb,updated_by=$7::uuid,updated_at=now()
      WHERE id=$1::uuid RETURNING *`, [current.id, text(body.display_name), text(body.entity_type), text(body.adapter_key), body.owner_user_id || null, JSON.stringify(body.metadata || {}), actorId(scope)]);
    await audit(client, scope, 'semantic.contract.updated', 'data_source_contract', current.id, requestId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getContract(scope, contractId) {
  const item = await contract(pool, scope, contractId);
  const versions = await pool.query(`SELECT version.*,
      COALESCE(jsonb_agg(to_jsonb(mapping) ORDER BY mapping.priority, mapping.canonical_field)
        FILTER (WHERE mapping.id IS NOT NULL), '[]'::jsonb) AS mappings
    FROM data_source_contract_versions version
    LEFT JOIN data_source_field_mappings mapping ON mapping.contract_version_id=version.id AND mapping.tenant_id=$2::uuid
    WHERE version.contract_id=$1::uuid
    GROUP BY version.id
    ORDER BY version.version_number DESC`, [item.id, tenantId(scope)]);
  return { ...item, versions: versions.rows };
}

function versionPayload(body) {
  return {
    physical_tables: list(body.physical_tables),
    allowed_joins: list(body.allowed_joins),
    tenant_key_candidates: list(body.tenant_key_candidates).length ? body.tenant_key_candidates : ['tenant_id'],
    timestamp_candidates: list(body.timestamp_candidates),
    required_fields: list(body.required_fields),
    optional_fields: list(body.optional_fields),
    field_equivalences: body.field_equivalences || {},
    unit_policy: body.unit_policy || {},
    period_policy: body.period_policy || {},
    exclusion_policy: list(body.exclusion_policy),
    fallback_policy: body.fallback_policy || {},
    minimum_coverage: Number(body.minimum_coverage || 0),
    maximum_age_seconds: body.maximum_age_seconds ? Number(body.maximum_age_seconds) : null,
  };
}

function validateAllowedJoins(payload) {
  const tables = new Set(payload.physical_tables.map((entry) => typeof entry === 'string' ? entry : entry?.table || entry?.name).map((entry) => identifier(entry, 'physical_table')));
  payload.allowed_joins.forEach((join) => {
    if (!join || !['inner', 'left'].includes(join.type)) throw new SemanticError('SEMANTIC_JOIN_INVALID', 'El tipo de join no está permitido.', 422);
    const leftTable = identifier(join.left_table, 'left_table');
    const rightTable = identifier(join.right_table, 'right_table');
    identifier(join.left_column, 'left_column');
    identifier(join.right_column, 'right_column');
    if (!tables.has(leftTable) || !tables.has(rightTable)) throw new SemanticError('SEMANTIC_JOIN_INVALID', 'El join referencia una tabla fuera del contrato.', 422);
  });
}

async function createVersion(scope, contractId, body = {}, requestId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await contract(client, scope, contractId, true);
    if (current.tenant_id === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'El catálogo global es administrado por plataforma.', 403);
    const latest = await client.query('SELECT COALESCE(MAX(version_number),0)::int AS version FROM data_source_contract_versions WHERE contract_id=$1::uuid', [current.id]);
    const payload = versionPayload(body);
    if (!payload.physical_tables.length || !payload.required_fields.length) throw new SemanticError('SEMANTIC_VERSION_INVALID', 'La versión requiere tablas permitidas y campos obligatorios.', 422);
    validateAllowedJoins(payload);
    const checksum = stableHash(payload);
    const result = await client.query(`INSERT INTO data_source_contract_versions
      (contract_id,version_number,physical_tables,allowed_joins,tenant_key_candidates,
       timestamp_candidates,required_fields,optional_fields,field_equivalences,unit_policy,
       period_policy,exclusion_policy,fallback_policy,minimum_coverage,maximum_age_seconds,
       status,checksum,created_by,metadata)
      VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,
       $9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,'draft',$16,$17::uuid,
       $18::jsonb) RETURNING *`,
    [current.id, Number(latest.rows[0].version) + 1, JSON.stringify(payload.physical_tables), JSON.stringify(payload.allowed_joins), JSON.stringify(payload.tenant_key_candidates), JSON.stringify(payload.timestamp_candidates), JSON.stringify(payload.required_fields), JSON.stringify(payload.optional_fields), JSON.stringify(payload.field_equivalences), JSON.stringify(payload.unit_policy), JSON.stringify(payload.period_policy), JSON.stringify(payload.exclusion_policy), JSON.stringify(payload.fallback_policy), payload.minimum_coverage, payload.maximum_age_seconds, checksum, actorId(scope), JSON.stringify(body.metadata || {})]);
    await audit(client, scope, 'semantic.contract.version_created', 'data_source_contract_version', result.rows[0].id, requestId, { contract_id: current.id });
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getVersion(scope, versionId) {
  const item = await version(pool, scope, versionId);
  const mappings = await listMappings(scope, item.id);
  return { ...item, mappings };
}

async function updateVersion(scope, versionId, body = {}, requestId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await version(client, scope, versionId, true);
    if (current.status !== 'draft') throw new SemanticError('SEMANTIC_PUBLISHED_IMMUTABLE', 'Solo una versión en borrador puede editarse.', 409);
    if (current.tenant_id === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'El catálogo global es administrado por plataforma.', 403);
    const payload = versionPayload({ ...current, ...body });
    if (!payload.physical_tables.length || !payload.required_fields.length) throw new SemanticError('SEMANTIC_VERSION_INVALID', 'La versión requiere tablas permitidas y campos obligatorios.', 422);
    validateAllowedJoins(payload);
    const result = await client.query(`UPDATE data_source_contract_versions SET
      physical_tables=$2::jsonb,allowed_joins=$3::jsonb,tenant_key_candidates=$4::jsonb,timestamp_candidates=$5::jsonb,
      required_fields=$6::jsonb,optional_fields=$7::jsonb,field_equivalences=$8::jsonb,unit_policy=$9::jsonb,
      period_policy=$10::jsonb,exclusion_policy=$11::jsonb,fallback_policy=$12::jsonb,minimum_coverage=$13,
      maximum_age_seconds=$14,checksum=$15,metadata=metadata||$16::jsonb WHERE id=$1::uuid RETURNING *`,
    [current.id, JSON.stringify(payload.physical_tables), JSON.stringify(payload.allowed_joins), JSON.stringify(payload.tenant_key_candidates), JSON.stringify(payload.timestamp_candidates), JSON.stringify(payload.required_fields), JSON.stringify(payload.optional_fields), JSON.stringify(payload.field_equivalences), JSON.stringify(payload.unit_policy), JSON.stringify(payload.period_policy), JSON.stringify(payload.exclusion_policy), JSON.stringify(payload.fallback_policy), payload.minimum_coverage, payload.maximum_age_seconds, stableHash(payload), JSON.stringify(body.metadata || {})]);
    await audit(client, scope, 'semantic.contract.version_updated', 'data_source_contract_version', current.id, requestId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function transitionVersion(scope, versionId, nextStatus, requestId = null) {
  const transitions = { draft: ['reviewed'], reviewed: ['approved'], approved: ['published'] };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await version(client, scope, versionId, true);
    if (current.tenant_id === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'El catálogo global es administrado por plataforma.', 403);
    if (!transitions[current.status]?.includes(nextStatus)) throw new SemanticError('SEMANTIC_TRANSITION_INVALID', `No se puede pasar de ${current.status} a ${nextStatus}.`, 409);
    if (nextStatus === 'published') {
      const validation = await validateVersionConfiguration(client, scope, current.id);
      if (!validation.valid) {
        throw new SemanticError('SEMANTIC_VERSION_INVALID', 'La versión no puede publicarse porque su fuente o mappings son incompatibles.', 422, validation.errors);
      }
    }
    const actor = actorId(scope);
    const actorColumn = nextStatus === 'reviewed' ? 'reviewed_by' : nextStatus === 'approved' ? 'approved_by' : 'published_by';
    const timeColumn = nextStatus === 'reviewed' ? 'reviewed_at' : nextStatus === 'approved' ? 'approved_at' : 'published_at';
    const result = await client.query(`UPDATE data_source_contract_versions SET status=$2,${actorColumn}=$3::uuid,${timeColumn}=now() WHERE id=$1::uuid RETURNING *`, [current.id, nextStatus, actor]);
    if (nextStatus === 'published') await client.query(`UPDATE data_source_contracts SET current_version_id=$2::uuid,status='published',updated_by=$3::uuid,updated_at=now() WHERE id=$1::uuid`, [current.contract_id, current.id, actor]);
    await audit(client, scope, `semantic.contract.${nextStatus}`, 'data_source_contract_version', current.id, requestId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listMappings(scope, versionId) {
  await version(pool, scope, versionId);
  const result = await pool.query('SELECT * FROM data_source_field_mappings WHERE tenant_id=$1::uuid AND contract_version_id=$2::uuid ORDER BY priority,canonical_field', [tenantId(scope), uuid(versionId)]);
  return result.rows;
}

async function upsertMapping(scope, versionId, body = {}, requestId = null) {
  const current = await version(pool, scope, versionId);
  if (current.status === 'published') throw new SemanticError('SEMANTIC_PUBLISHED_IMMUTABLE', 'Una versión publicada es inmutable.', 409);
  const table = identifier(body.physical_table, 'physical_table');
  const column = identifier(body.physical_column, 'physical_column');
  const transform = text(body.transformation_type, 'direct');
  if (!TRANSFORMATIONS.has(transform)) throw new SemanticError('SEMANTIC_TRANSFORMATION_NOT_ALLOWED', 'Transformación no permitida.', 422);
  const allowedTables = list(current.physical_tables).map((entry) => typeof entry === 'string' ? entry : entry?.table || entry?.name);
  if (!allowedTables.includes(table)) throw new SemanticError('SEMANTIC_TABLE_NOT_ALLOWED', 'La tabla no está permitida por la versión.', 422);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const count = await client.query('SELECT COUNT(*)::int AS count FROM data_source_field_mappings WHERE tenant_id=$1::uuid AND status<>\'retired\'', [tenantId(scope)]);
    await assertLimit(client, scope, 'semantic_mappings', Number(count.rows[0].count));
    const result = await client.query(`INSERT INTO data_source_field_mappings
      (tenant_id,contract_version_id,physical_table,physical_column,canonical_field,transformation_type,transformation_config,priority,required,status,created_by,updated_by,metadata)
      VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8,$9,'active',$10::uuid,$10::uuid,$11::jsonb)
      ON CONFLICT (tenant_id,contract_version_id,canonical_field,priority) DO UPDATE SET physical_table=EXCLUDED.physical_table,physical_column=EXCLUDED.physical_column,transformation_type=EXCLUDED.transformation_type,transformation_config=EXCLUDED.transformation_config,required=EXCLUDED.required,status='active',updated_by=EXCLUDED.updated_by,updated_at=now(),metadata=EXCLUDED.metadata RETURNING *`,
    [tenantId(scope), current.id, table, column, text(body.canonical_field), transform, JSON.stringify(body.transformation_config || {}), Number(body.priority || 100), body.required === true, actorId(scope), JSON.stringify(body.metadata || {})]);
    await audit(client, scope, 'semantic.mapping.upserted', 'data_source_field_mapping', result.rows[0].id, requestId);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function validateVersionConfiguration(client, scope, versionId) {
  const current = await version(client, scope, versionId);
  const mappings = await client.query('SELECT * FROM data_source_field_mappings WHERE tenant_id=$1::uuid AND contract_version_id=$2::uuid AND status=\'active\'', [tenantId(scope), current.id]);
  const errors = [];
  const tables = list(current.physical_tables).map((entry) => typeof entry === 'string' ? entry : entry?.table || entry?.name).filter(Boolean);
  const availableByTable = new Map();
  for (const table of tables) {
    identifier(table, 'physical_table');
    const columns = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
    if (!columns.rowCount) errors.push({ code: 'SOURCE_TABLE_MISSING', table });
    const available = new Set(columns.rows.map((row) => row.column_name));
    availableByTable.set(table, available);
    mappings.rows.filter((mapping) => mapping.physical_table === table).forEach((mapping) => {
      if (!available.has(mapping.physical_column)) errors.push({ code: 'SOURCE_COLUMN_MISSING', table, column: mapping.physical_column });
    });
  }
  try {
    validateAllowedJoins(current);
    list(current.allowed_joins).forEach((join) => {
      if (!availableByTable.get(join.left_table)?.has(join.left_column)) {
        errors.push({ code: 'SOURCE_JOIN_COLUMN_MISSING', table: join.left_table, column: join.left_column });
      }
      if (!availableByTable.get(join.right_table)?.has(join.right_column)) {
        errors.push({ code: 'SOURCE_JOIN_COLUMN_MISSING', table: join.right_table, column: join.right_column });
      }
    });
  } catch (error) {
    errors.push({ code: error.code || 'SEMANTIC_JOIN_INVALID', message: error.message });
  }
  const canonical = new Set(mappings.rows.map((mapping) => mapping.canonical_field));
  list(current.required_fields).forEach((field) => {
    if (!canonical.has(field)) errors.push({ code: 'REQUIRED_MAPPING_MISSING', field });
  });
  return { valid: errors.length === 0, errors, mappings: mappings.rows };
}

async function validateMapping(scope, mappingId) {
  const result = await pool.query(`SELECT mapping.* FROM data_source_field_mappings mapping
    JOIN data_source_contract_versions version ON version.id=mapping.contract_version_id
    JOIN data_source_contracts contract ON contract.id=version.contract_id
    WHERE mapping.id=$1::uuid AND mapping.tenant_id=$2::uuid AND (contract.tenant_id=$2::uuid OR contract.tenant_id IS NULL)`,
  [uuid(mappingId, 'mapping_id'), tenantId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_MAPPING_NOT_FOUND', 'Mapping no encontrado.', 404);
  const row = result.rows[0];
  const column = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [row.physical_table, row.physical_column]);
  return { valid: column.rowCount === 1, status: column.rowCount ? 'source_ready' : 'schema_incompatible', mapping_id: row.id };
}

async function updateMapping(scope, mappingId, body = {}, requestId = null) {
  const existing = await pool.query(`SELECT mapping.*,version.status AS version_status FROM data_source_field_mappings mapping
    JOIN data_source_contract_versions version ON version.id=mapping.contract_version_id
    JOIN data_source_contracts contract ON contract.id=version.contract_id
    WHERE mapping.id=$1::uuid AND mapping.tenant_id=$2::uuid AND (contract.tenant_id=$2::uuid OR contract.tenant_id IS NULL)`,
  [uuid(mappingId, 'mapping_id'), tenantId(scope)]);
  if (!existing.rowCount) throw new SemanticError('SEMANTIC_MAPPING_NOT_FOUND', 'Mapping no encontrado.', 404);
  if (existing.rows[0].version_status !== 'draft') throw new SemanticError('SEMANTIC_PUBLISHED_IMMUTABLE', 'El mapping de una versión revisada o publicada es inmutable.', 409);
  return upsertMapping(scope, existing.rows[0].contract_version_id, { ...existing.rows[0], ...body }, requestId);
}

async function fetchSourceRows(client, scope, current, mappings, requestedLimit = 25) {
  const tables = list(current.physical_tables).map((entry) => typeof entry === 'string' ? entry : entry?.table || entry?.name).filter(Boolean).map((entry) => identifier(entry, 'physical_table'));
  if (!tables.length) throw new SemanticError('SOURCE_UNAVAILABLE', 'El contrato no tiene una fuente física disponible.', 409);
  validateAllowedJoins(current);
  const availableByTable = new Map();
  for (const table of tables) {
    const available = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]);
    if (!available.rowCount) throw new SemanticError('SCHEMA_INCOMPATIBLE', 'Una tabla declarada no existe.', 409, { table });
    availableByTable.set(table, new Set(available.rows.map((row) => row.column_name)));
  }
  const tenantCandidates = list(current.tenant_key_candidates).map((candidate) => text(candidate)).filter((candidate) => IDENTIFIER_RE.test(candidate || ''));
  const tenantKeyByTable = new Map(tables.map((table) => [table, tenantCandidates.find((candidate) => availableByTable.get(table).has(candidate)) || null]));
  const baseTable = tables[0];
  const baseTenantKey = tenantKeyByTable.get(baseTable);
  if (!baseTenantKey || !availableByTable.get(baseTable).has('id')) {
    throw new SemanticError('SCHEMA_INCOMPATIBLE', 'La fuente principal requiere identidad y tenant scope verificables.', 409);
  }
  const aliases = new Map([[baseTable, 't0']]);
  const joins = [];
  for (const join of list(current.allowed_joins)) {
    const leftAlias = aliases.get(join.left_table);
    if (!leftAlias || aliases.has(join.right_table)) throw new SemanticError('SEMANTIC_JOIN_INVALID', 'El orden de joins no forma una cadena determinista.', 422);
    const rightAlias = `t${aliases.size}`;
    const leftColumns = availableByTable.get(join.left_table);
    const rightColumns = availableByTable.get(join.right_table);
    if (!leftColumns.has(join.left_column) || !rightColumns.has(join.right_column)) {
      throw new SemanticError('SCHEMA_INCOMPATIBLE', 'Una columna de join no existe en la fuente.', 409);
    }
    const rightTenantKey = tenantKeyByTable.get(join.right_table);
    if (!rightTenantKey) throw new SemanticError('SCHEMA_INCOMPATIBLE', 'Una tabla relacionada no tiene tenant scope verificable.', 409);
    aliases.set(join.right_table, rightAlias);
    joins.push(`${join.type.toUpperCase()} JOIN ${quoteIdentifier(join.right_table, 'join_table')} ${rightAlias} ON ${leftAlias}.${quoteIdentifier(join.left_column, 'join_column')}=${rightAlias}.${quoteIdentifier(join.right_column, 'join_column')} AND ${rightAlias}.${quoteIdentifier(rightTenantKey, 'tenant_key')}=$1::uuid`);
  }
  if (aliases.size !== tables.length) throw new SemanticError('SEMANTIC_JOIN_INVALID', 'Todas las tablas declaradas deben estar conectadas por joins permitidos.', 422);
  const runtimeMappings = mappings.map((mapping, index) => {
    const tableAlias = aliases.get(mapping.physical_table);
    const column = identifier(mapping.physical_column, 'physical_column');
    if (!tableAlias || !availableByTable.get(mapping.physical_table)?.has(column)) {
      throw new SemanticError('SCHEMA_INCOMPATIBLE', 'Un mapping referencia una columna no disponible.', 409);
    }
    return { ...mapping, source_alias: `__semantic_${index}` };
  });
  const timestamp = list(current.timestamp_candidates).map((candidate) => text(candidate)).find((candidate) => IDENTIFIER_RE.test(candidate || '') && availableByTable.get(baseTable).has(candidate));
  const select = [
    `t0.${quoteIdentifier('id', 'source_id')} AS ${quoteIdentifier('__source_id', 'source_alias')}`,
    ...(timestamp ? [`t0.${quoteIdentifier(timestamp, 'timestamp')} AS ${quoteIdentifier('__source_timestamp', 'source_alias')}`] : []),
    ...runtimeMappings.map((mapping) => `${aliases.get(mapping.physical_table)}.${quoteIdentifier(mapping.physical_column, 'source_column')} AS ${quoteIdentifier(mapping.source_alias, 'source_alias')}`),
  ].join(',');
  const order = timestamp ? `t0.${quoteIdentifier(timestamp, 'timestamp')}` : `t0.${quoteIdentifier('id', 'source_id')}`;
  const sql = `SELECT ${select} FROM ${quoteIdentifier(baseTable, 'source_table')} t0 ${joins.join(' ')} WHERE t0.${quoteIdentifier(baseTenantKey, 'tenant_key')}=$1::uuid ORDER BY ${order} DESC LIMIT $2`;
  const result = await client.query(sql, [tenantId(scope), limit(requestedLimit, 25, 100)]);
  return {
    table: baseTable,
    timestamp: timestamp ? '__source_timestamp' : null,
    mappings: runtimeMappings,
    rows: result.rows.map((row) => ({ ...row, id: row.__source_id })),
  };
}

async function previewVersion(scope, versionId, body = {}) {
  const current = await version(pool, scope, versionId);
  const validation = await validateVersionConfiguration(pool, scope, current.id);
  if (!validation.valid) return { status: 'schema_incompatible', valid: false, errors: validation.errors, rows: [] };
  const source = body.rows ? { table: validation.mappings[0]?.physical_table, timestamp: null, rows: list(body.rows).slice(0, 100) } : await fetchSourceRows(pool, scope, current, validation.mappings, body.limit);
  const effectiveMappings = source.mappings || validation.mappings;
  const transformed = source.rows.map((row) => ({ source: row, ...applyMappings(row, effectiveMappings) }));
  const normalized = transformed.map((row) => row.output);
  const quality = evaluateQuality(normalized, list(current.required_fields));
  const latestObserved = normalized.map((row) => row.observed_at).filter(Boolean).sort().at(-1) || source.rows[0]?.[source.timestamp];
  const freshness = evaluateFreshness(latestObserved, current.maximum_age_seconds);
  const sufficiency = evaluateSufficiency({ rows: normalized, requiredInputs: list(current.required_fields), minimumCoverage: Number(current.minimum_coverage), quality, freshness });
  return {
    status: sufficiency.status === 'sufficient' ? (quality.status === 'valid' ? 'source_ready' : 'source_ready_with_warnings') : sufficiency.status,
    valid: sufficiency.sufficient,
    rows: normalized,
    warnings: transformed.flatMap((row) => row.warnings),
    quality,
    freshness,
    sufficiency,
    input_hash: stableHash(normalized),
    source: { table: source.table, count: source.rows.length },
  };
}

async function createSourceSnapshot(client, scope, current, preview, requestId) {
  const sourceHash = stableHash({ version: current.id, input_hash: preview.input_hash, quality: preview.quality, freshness: preview.freshness });
  const result = await client.query(`INSERT INTO data_snapshots
    (tenant_id,snapshot_type,entity_type,entity_id,period_key,snapshot_payload,source_hash,created_by,correlation_id,metadata)
    VALUES ($1::uuid,'semantic_source','source_contract_version',$2::uuid,$3,$4::jsonb,$5,$6::uuid,$7,$8::jsonb)
    ON CONFLICT (tenant_id,snapshot_type,entity_type,entity_id,COALESCE(period_key,''),source_hash) DO UPDATE SET source_hash=EXCLUDED.source_hash
    RETURNING *`, [tenantId(scope), current.id, null, JSON.stringify({ source: preview.source, quality: preview.quality, freshness: preview.freshness, sufficiency: preview.sufficiency, input_hash: preview.input_hash }), sourceHash, actorId(scope), requestId || crypto.randomUUID(), JSON.stringify({ phase: '5-C2' })]);
  return result.rows[0];
}

async function snapshotVersion(scope, versionId, body = {}, requestId = null) {
  const current = await version(pool, scope, versionId);
  if (current.status !== 'published') throw new SemanticError('SEMANTIC_VERSION_NOT_PUBLISHED', 'Solo se generan snapshots de versiones publicadas.', 409);
  const preview = await previewVersion(scope, current.id, body);
  if (!preview.valid) throw new SemanticError(preview.status.toUpperCase(), 'La fuente no cumple la suficiencia requerida.', 422, preview);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const snapshot = await createSourceSnapshot(client, scope, current, preview, requestId);
    await audit(client, scope, 'semantic.source.snapshot_created', 'data_snapshot', snapshot.id, requestId, { version_id: current.id });
    await client.query('COMMIT');
    return { status: 'completed', snapshot_id: snapshot.id, input_hash: preview.input_hash };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function observationValue(row) {
  const value = row.value ?? row.numeric_value ?? row.text_value ?? row.boolean_value ?? null;
  if (typeof value === 'number') return { numeric: value, text: null, boolean: null };
  if (typeof value === 'boolean') return { numeric: null, text: null, boolean: value };
  return { numeric: null, text: value === null ? null : String(value), boolean: null };
}

async function ingestVersion(scope, versionId, body = {}, requestId = null) {
  const current = await version(pool, scope, versionId);
  if (current.status !== 'published') throw new SemanticError('SEMANTIC_VERSION_NOT_PUBLISHED', 'Solo se pueden ingerir versiones publicadas.', 409);
  const preview = await previewVersion(scope, current.id, body);
  if (!preview.valid) throw new SemanticError(preview.status.toUpperCase(), 'La fuente no cumple la suficiencia requerida.', 422, preview);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const monthly = await client.query(`SELECT COUNT(*)::int AS count FROM grc_observations WHERE tenant_id=$1::uuid AND created_at>=date_trunc('month',now())`, [tenantId(scope)]);
    await assertLimit(client, scope, 'semantic_observations_monthly', Number(monthly.rows[0].count), preview.rows.length);
    const snapshot = await createSourceSnapshot(client, scope, current, preview, requestId);
    const mappings = await client.query('SELECT * FROM data_source_field_mappings WHERE tenant_id=$1::uuid AND contract_version_id=$2::uuid AND status=\'active\' ORDER BY priority', [tenantId(scope), current.id]);
    const source = body.rows ? { table: mappings.rows[0]?.physical_table, rows: list(body.rows).slice(0, 100), timestamp: null } : await fetchSourceRows(client, scope, current, mappings.rows, body.limit);
    const inserted = [];
    const unchanged = [];
    for (let index = 0; index < source.rows.length; index += 1) {
      const raw = source.rows[index];
      const mapped = applyMappings(raw, source.mappings || mappings.rows).output;
      const sourceRecordId = text(raw.id, stableHash(raw));
      const identityHash = stableHash({ tenant_id: tenantId(scope), version_id: current.id, table: source.table, source_record_id: sourceRecordId });
      const contentHash = stableHash(mapped);
      const previous = await client.query(`SELECT * FROM grc_observations WHERE tenant_id=$1::uuid AND contract_version_id=$2::uuid AND source_identity_hash=$3 AND is_current=true FOR UPDATE`, [tenantId(scope), current.id, identityHash]);
      if (previous.rows[0]?.metadata?.content_hash === contentHash) {
        unchanged.push(previous.rows[0].id);
        continue;
      }
      const newId = crypto.randomUUID();
      if (previous.rowCount) await client.query('UPDATE grc_observations SET is_current=false,superseded_by_id=$2::uuid WHERE id=$1::uuid', [previous.rows[0].id, newId]);
      const value = observationValue(mapped);
      const observedAt = mapped.observed_at || (source.timestamp ? raw[source.timestamp] : null) || new Date().toISOString();
      const freshness = evaluateFreshness(observedAt, current.maximum_age_seconds);
      const result = await client.query(`INSERT INTO grc_observations
        (id,tenant_id,observation_type,entity_type,entity_id,contract_id,contract_version_id,source_table,source_record_id,source_identity_hash,observed_at,period_start,period_end,status_value,severity_value,numeric_value,text_value,boolean_value,unit,quality_status,quality_score,freshness_status,freshness_age_seconds,trust_score,owner_user_id,evidence_id,correlation_id,source_snapshot_id,supersedes_observation_id,is_current,created_by,metadata)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13::timestamptz,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::uuid,$26::uuid,$27,$28::uuid,$29::uuid,true,$30::uuid,$31::jsonb) RETURNING *`,
      [newId, tenantId(scope), text(mapped.observation_type, current.entity_type), text(mapped.entity_type, current.entity_type), mapped.entity_id || null, current.contract_id, current.id, source.table, sourceRecordId, identityHash, observedAt, mapped.period_start || null, mapped.period_end || null, mapped.status || null, mapped.severity || null, value.numeric, value.text, value.boolean, mapped.unit || current.unit_policy?.unit || null, preview.quality.status, preview.quality.score, freshness.status, freshness.age_seconds, mapped.trust_score || null, mapped.owner_user_id || null, mapped.evidence_id || null, requestId || crypto.randomUUID(), snapshot.id, previous.rows[0]?.id || null, actorId(scope), JSON.stringify({ content_hash: contentHash })]);
      await client.query(`INSERT INTO data_lineage_edges (tenant_id,from_type,from_id,to_type,to_id,relation_type,transformation,created_by,correlation_id,metadata)
        VALUES ($1::uuid,'source_contract_version',$2::uuid,'grc_observation',$3::uuid,'derived_from','typed_mapping',$4::uuid,$5,$6::jsonb)
        ON CONFLICT DO NOTHING`, [tenantId(scope), current.id, result.rows[0].id, actorId(scope), requestId, JSON.stringify({ snapshot_id: snapshot.id })]);
      inserted.push(result.rows[0]);
    }
    await audit(client, scope, 'semantic.observations.ingested', 'data_source_contract_version', current.id, requestId, { inserted: inserted.length, unchanged: unchanged.length, snapshot_id: snapshot.id });
    await client.query('COMMIT');
    return { status: 'completed', inserted: inserted.length, unchanged: unchanged.length, observations: inserted, snapshot_id: snapshot.id, input_hash: preview.input_hash };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listObservations(scope, filters = {}) {
  const result = await pool.query(`SELECT observation.* FROM grc_observations observation
    WHERE observation.tenant_id=$1::uuid
      AND ($2::uuid IS NULL OR observation.contract_id=$2::uuid)
      AND ($3::text IS NULL OR observation.observation_type=$3)
      AND ($4::boolean IS NULL OR observation.is_current=$4)
    ORDER BY observation.observed_at DESC LIMIT $5`,
  [tenantId(scope), filters.contract_id || null, text(filters.observation_type), filters.current === undefined ? true : String(filters.current) !== 'false', limit(filters.limit)]);
  return result.rows;
}

async function getObservation(scope, observationId) {
  const result = await pool.query('SELECT * FROM grc_observations WHERE id=$1::uuid AND tenant_id=$2::uuid', [uuid(observationId, 'observation_id'), tenantId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_OBSERVATION_NOT_FOUND', 'Observación no encontrada.', 404);
  return result.rows[0];
}

async function observationLineage(scope, observationId) {
  await getObservation(scope, observationId);
  const edges = await pool.query(`SELECT * FROM data_lineage_edges WHERE tenant_id=$1::uuid AND ((from_type='grc_observation' AND from_id=$2::uuid) OR (to_type='grc_observation' AND to_id=$2::uuid)) ORDER BY created_at`, [tenantId(scope), uuid(observationId)]);
  const relations = await pool.query('SELECT * FROM grc_observation_relations WHERE tenant_id=$1::uuid AND observation_id=$2::uuid ORDER BY created_at', [tenantId(scope), uuid(observationId)]);
  return { observation_id: observationId, edges: edges.rows, relations: relations.rows };
}

async function observationAssessment(scope, observationId) {
  const row = await getObservation(scope, observationId);
  return { observation_id: row.id, quality: { status: row.quality_status, score: row.quality_score }, freshness: { status: row.freshness_status, age_seconds: row.freshness_age_seconds }, trust: { score: row.trust_score }, source_snapshot_id: row.source_snapshot_id };
}

async function createObservationRelation(scope, observationId, body = {}, requestId = null) {
  const observation = await getObservation(scope, observationId);
  const relationType = text(body.relation_type);
  if (!['describes','supports','evidences','affects','measures','owned_by','derived_from','related_to'].includes(relationType)) throw new SemanticError('SEMANTIC_RELATION_INVALID', 'Tipo de relación no permitido.', 422);
  const result = await pool.query(`INSERT INTO grc_observation_relations
    (tenant_id,observation_id,related_entity_type,related_entity_id,relation_type,confidence,valid_from,valid_until,created_by,metadata)
    VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7::timestamptz,$8::timestamptz,$9::uuid,$10::jsonb)
    ON CONFLICT (tenant_id,observation_id,related_entity_type,related_entity_id,relation_type)
    DO UPDATE SET confidence=EXCLUDED.confidence,valid_until=EXCLUDED.valid_until,metadata=EXCLUDED.metadata RETURNING *`,
  [tenantId(scope), observation.id, text(body.related_entity_type), uuid(body.related_entity_id, 'related_entity_id'), relationType, Number(body.confidence ?? 1), body.valid_from || new Date().toISOString(), body.valid_until || null, actorId(scope), JSON.stringify(body.metadata || {})]);
  await audit(pool, scope, 'semantic.observation.relation_created', 'grc_observation_relation', result.rows[0].id, requestId);
  return result.rows[0];
}

async function versionAssessment(scope, versionId, body = {}) {
  const preview = await previewVersion(scope, versionId, body);
  return { status: preview.status, source_status: preview.status, quality: preview.quality, freshness: preview.freshness, sufficiency: preview.sufficiency, warnings: preview.warnings, input_hash: preview.input_hash };
}

async function listSufficiencyRules(scope, filters = {}) {
  const result = await pool.query(`SELECT * FROM metric_sufficiency_rules WHERE (tenant_id=$1::uuid OR tenant_id IS NULL) AND ($2::text IS NULL OR status=$2) ORDER BY tenant_id NULLS FIRST,rule_code,version_number DESC LIMIT $3`, [tenantId(scope), text(filters.status), limit(filters.limit)]);
  return result.rows;
}

async function getSufficiencyRule(scope, ruleId) {
  const result = await pool.query(`SELECT * FROM metric_sufficiency_rules WHERE id=$1::uuid AND (tenant_id=$2::uuid OR tenant_id IS NULL)`, [uuid(ruleId, 'rule_id'), tenantId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_SUFFICIENCY_NOT_FOUND', 'Regla de suficiencia no encontrada.', 404);
  return result.rows[0];
}

async function createSufficiencyRule(scope, body = {}, requestId = null) {
  const tenant = body.global === true ? null : tenantId(scope);
  if (tenant === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'Solo plataforma puede crear reglas globales.', 403);
  const payload = {
    required_inputs: list(body.required_inputs), optional_inputs: list(body.optional_inputs),
    minimum_sample_size: Number(body.minimum_sample_size || 1), minimum_coverage: Number(body.minimum_coverage || 0),
    maximum_age_seconds: body.maximum_age_seconds ? Number(body.maximum_age_seconds) : null,
    allowed_quality_statuses: list(body.allowed_quality_statuses).length ? body.allowed_quality_statuses : ['valid','attention'],
    allowed_freshness_statuses: list(body.allowed_freshness_statuses).length ? body.allowed_freshness_statuses : ['fresh','attention'],
    allowed_units: list(body.allowed_units), period_policy: body.period_policy || {}, exclusions: list(body.exclusions),
  };
  const latest = await pool.query(`SELECT COALESCE(MAX(version_number),0)::int AS version FROM metric_sufficiency_rules WHERE rule_code=$1 AND tenant_id IS NOT DISTINCT FROM $2::uuid`, [text(body.rule_code), tenant]);
  const result = await pool.query(`INSERT INTO metric_sufficiency_rules
    (tenant_id,metric_definition_id,formula_code,rule_code,version_number,required_inputs,optional_inputs,minimum_sample_size,minimum_coverage,maximum_age_seconds,allowed_quality_statuses,allowed_freshness_statuses,allowed_units,period_policy,exclusions,status,checksum,created_by,metadata)
    VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::text[],$12::text[],$13::text[],$14::jsonb,$15::jsonb,'draft',$16,$17::uuid,$18::jsonb) RETURNING *`,
  [tenant, body.metric_definition_id || null, text(body.formula_code), text(body.rule_code), Number(latest.rows[0].version) + 1, JSON.stringify(payload.required_inputs), JSON.stringify(payload.optional_inputs), payload.minimum_sample_size, payload.minimum_coverage, payload.maximum_age_seconds, payload.allowed_quality_statuses, payload.allowed_freshness_statuses, payload.allowed_units, JSON.stringify(payload.period_policy), JSON.stringify(payload.exclusions), stableHash(payload), actorId(scope), JSON.stringify(body.metadata || {})]);
  await audit(pool, scope, 'semantic.sufficiency.created', 'metric_sufficiency_rule', result.rows[0].id, requestId);
  return result.rows[0];
}

async function publishSufficiencyRule(scope, ruleId, requestId = null) {
  const result = await pool.query(`UPDATE metric_sufficiency_rules SET status='published',published_by=$3::uuid,published_at=now()
    WHERE id=$1::uuid AND (tenant_id=$2::uuid OR tenant_id IS NULL) AND status='approved' RETURNING *`, [uuid(ruleId, 'rule_id'), tenantId(scope), actorId(scope)]);
  if (!result.rowCount) throw new SemanticError('SEMANTIC_SUFFICIENCY_NOT_PUBLISHABLE', 'La regla no existe o ya es inmutable.', 409);
  await audit(pool, scope, 'semantic.sufficiency.published', 'metric_sufficiency_rule', result.rows[0].id, requestId);
  return result.rows[0];
}

async function transitionSufficiencyRule(scope, ruleId, nextStatus, requestId = null) {
  const transitions = { draft: ['reviewed'], reviewed: ['approved'] };
  const current = await pool.query(`SELECT * FROM metric_sufficiency_rules WHERE id=$1::uuid AND (tenant_id=$2::uuid OR tenant_id IS NULL)`, [uuid(ruleId, 'rule_id'), tenantId(scope)]);
  if (!current.rowCount) throw new SemanticError('SEMANTIC_SUFFICIENCY_NOT_FOUND', 'Regla de suficiencia no encontrada.', 404);
  if (!transitions[current.rows[0].status]?.includes(nextStatus)) throw new SemanticError('SEMANTIC_TRANSITION_INVALID', 'Transición de suficiencia no permitida.', 409);
  if (current.rows[0].tenant_id === null && !isPlatform(scope)) throw new SemanticError('SEMANTIC_GLOBAL_FORBIDDEN', 'El catálogo global es administrado por plataforma.', 403);
  const actorColumn = nextStatus === 'reviewed' ? 'reviewed_by' : 'approved_by';
  const result = await pool.query(`UPDATE metric_sufficiency_rules SET status=$2,${actorColumn}=$3::uuid WHERE id=$1::uuid RETURNING *`, [current.rows[0].id, nextStatus, actorId(scope)]);
  await audit(pool, scope, `semantic.sufficiency.${nextStatus}`, 'metric_sufficiency_rule', current.rows[0].id, requestId);
  return result.rows[0];
}

async function runJob(scope, jobType, body = {}, requestId = null) {
  if (!JOB_TYPES.has(jobType)) throw new SemanticError('SEMANTIC_JOB_INVALID', 'Tipo de job semántico no permitido.', 422);
  const idempotencyKey = text(body.idempotency_key);
  if (!idempotencyKey) throw new SemanticError('SEMANTIC_IDEMPOTENCY_REQUIRED', 'El job requiere idempotency_key.', 422);
  const existing = await pool.query(`SELECT * FROM tcdx_async_jobs WHERE tenant_id=$1::uuid AND job_type=$2 AND request_payload_json->>'idempotency_key'=$3 ORDER BY created_at DESC LIMIT 1`, [tenantId(scope), jobType, idempotencyKey]);
  if (existing.rowCount) return existing.rows[0];
  const job = await asyncJobs.createJob({ tenant_id: tenantId(scope), user_id: actorId(scope), job_type: jobType, source_module: 'phase5_c2_semantic', payload: { ...body, idempotency_key: idempotencyKey, correlation_id: requestId }, request_id: requestId });
  await audit(pool, scope, 'semantic.job.queued', 'tcdx_async_job', job.id, requestId, { job_type: jobType });
  return job;
}

async function executeJob(scope, jobId) {
  const job = await asyncJobs.getJobScoped(uuid(jobId, 'job_id'), { tenant_id: tenantId(scope), is_platform: false });
  if (!job || !JOB_TYPES.has(job.job_type)) throw new SemanticError('SEMANTIC_JOB_NOT_FOUND', 'Job semántico no encontrado.', 404);
  if (job.status === 'completed') return job;
  const payload = job.request_payload_json || {};
  const maxAttempts = Math.max(1, Math.min(Number(payload.max_attempts || 3), 5));
  const timeoutMs = Math.max(1000, Math.min(Number(payload.timeout_ms || 30000), 60000));
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await asyncJobs.markRunning(job.id);
      let operation;
      if (job.job_type === 'semantic_source.ingest') operation = ingestVersion(scope, payload.version_id, payload, job.request_id);
      else if (job.job_type === 'semantic_source.snapshot') operation = snapshotVersion(scope, payload.version_id, payload, job.request_id);
      else if (job.job_type === 'semantic_source.reconcile') operation = reconcileLegacyContracts(scope);
      else operation = versionAssessment(scope, payload.version_id, payload);
      let timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new SemanticError('SEMANTIC_JOB_TIMEOUT', 'El job semántico excedió su tiempo máximo.', 504)), timeoutMs);
      });
      const result = await Promise.race([operation, timeoutPromise]).finally(() => clearTimeout(timeout));
      return asyncJobs.markCompleted(job.id, { result_json: { ...result, attempts: attempt, correlation_id: job.request_id } });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
  await asyncJobs.markFailed(job.id, { error_json: { code: lastError?.code || 'SEMANTIC_JOB_FAILED', message: sanitizeError(lastError), attempts: maxAttempts } });
  throw lastError;
}

async function listJobs(scope, filters = {}) {
  return asyncJobs.listJobsScoped({ tenant_id: tenantId(scope), is_platform: false }, { job_type: text(filters.job_type), status: text(filters.status), limit: limit(filters.limit, 25) });
}

module.exports = {
  SemanticError, sanitizeError, validateAllowedJoins,
  listContracts, reconcileLegacyContracts, createContract, updateContract, getContract, createVersion, getVersion, updateVersion, transitionVersion,
  listMappings, upsertMapping, updateMapping, validateMapping, validateVersionConfiguration, previewVersion, versionAssessment, snapshotVersion, ingestVersion,
  listObservations, getObservation, observationLineage, observationAssessment, createObservationRelation,
  listSufficiencyRules, getSufficiencyRule, createSufficiencyRule, transitionSufficiencyRule, publishSufficiencyRule,
  runJob, executeJob, listJobs,
};
