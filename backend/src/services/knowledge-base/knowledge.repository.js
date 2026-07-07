const pool = require('../../config/db');
const { compactKnowledgeItem, normalizeText } = require('./knowledge.guardrails');

const schemaCache = new Map();

async function tableExists(tableName, db = pool) {
  const cacheKey = `table:${tableName}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
  const result = await db.query(
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

async function ensureKnowledgeTables(db = pool) {
  return tableExists('knowledge_items', db);
}

function buildSearchWhere(filters = {}) {
  const where = ['is_active = true'];
  const params = [];
  const add = (sql, value) => {
    if (!normalizeText(value)) return;
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  add('standard_family = ?', filters.standard_family);
  add('standard_code ILIKE ?', filters.standard_code);
  add('clause_or_control = ?', filters.clause_or_control);
  add('domain ILIKE ?', filters.domain);
  add('item_type = ?', filters.item_type);
  add('license_class = ?', filters.license_class);
  if (normalizeText(filters.use_in_system)) {
    params.push(filters.use_in_system);
    where.push(`$${params.length} = ANY(use_in_system)`);
  }
  if (normalizeText(filters.q)) {
    params.push(`%${filters.q}%`);
    where.push(`search_text ILIKE $${params.length}`);
  }
  return { where, params };
}

async function searchItems(filters = {}, options = {}, db = pool) {
  if (!(await ensureKnowledgeTables(db))) return [];
  const { where, params } = buildSearchWhere(filters);
  const limit = Math.min(Math.max(Number(options.limit || 20), 1), 100);
  params.push(limit);
  const result = await db.query(
    `
    SELECT
      item_key, source_key, source_record_id, standard_family, standard_code,
      clause_or_control, domain, item_type, title, intent_summary,
      severity_default, license_class, use_in_system, tags, search_text
    FROM knowledge_items
    WHERE ${where.join(' AND ')}
    ORDER BY item_key ASC
    LIMIT $${params.length}
    `,
    params
  );
  return result.rows.map(compactKnowledgeItem);
}

async function countAvailableItems(db = pool) {
  if (!(await ensureKnowledgeTables(db))) return 0;
  const result = await db.query('SELECT COUNT(*)::int AS total FROM knowledge_items WHERE is_active = true');
  return Number(result.rows[0]?.total || 0);
}

async function listStandards(db = pool) {
  if (!(await ensureKnowledgeTables(db))) return [];
  const result = await db.query(
    `
    SELECT
      standard_family,
      standard_code,
      COUNT(*)::int AS item_count,
      array_remove(array_agg(DISTINCT domain ORDER BY domain), NULL) AS domains
    FROM knowledge_items
    WHERE is_active = true
    GROUP BY standard_family, standard_code
    ORDER BY standard_family, standard_code
    `
  );
  return result.rows;
}

async function listRules(filters = {}, db = pool) {
  if (!(await tableExists('knowledge_rules', db))) return [];
  const itemFilters = buildSearchWhere(filters);
  const params = itemFilters.params;
  const result = await db.query(
    `
    SELECT
      r.item_key,
      r.rule_key,
      r.rule_type,
      r.rule_text,
      r.severity_default,
      i.standard_family,
      i.standard_code,
      i.clause_or_control,
      i.domain,
      i.license_class
    FROM knowledge_rules r
    JOIN knowledge_items i ON i.item_key = r.item_key
    WHERE ${itemFilters.where.map((part) => part.replace(/^is_active = true$/, 'i.is_active = true')).join(' AND ')}
    ORDER BY r.item_key, r.rule_key
    LIMIT 100
    `,
    params
  );
  return result.rows;
}

async function getChildRows(tableName, itemKeys, db = pool) {
  if (!itemKeys.length || !(await tableExists(tableName, db))) return [];
  const result = await db.query(
    `
    SELECT *
    FROM ${tableName}
    WHERE item_key = ANY($1::text[])
    ORDER BY item_key, created_at ASC
    `,
    [itemKeys]
  );
  return result.rows;
}

module.exports = {
  countAvailableItems,
  getChildRows,
  listRules,
  listStandards,
  searchItems,
  tableExists,
};
