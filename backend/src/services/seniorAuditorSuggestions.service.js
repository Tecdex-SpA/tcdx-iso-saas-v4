const pool = require('../config/db');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return asString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    asString(value)
  );
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }

  return '';
}

function getSeniorSuggestionTitle(item) {
  return firstNonEmptyString(
    item?.title,
    item?.recommended_action,
    item?.summary,
    item?.observation,
    'Sugerencia de auditor senior'
  ).slice(0, 220);
}

function getSeniorSuggestionType(item) {
  const type = normalizeText(item?.type);

  if (type === 'risk_alert') return 'senior_auditor_risk_alert';
  if (type === 'evidence_gap') return 'senior_auditor_evidence_gap';
  if (type === 'audit_observation') return 'senior_auditor_observation';
  if (type === 'report_insight') return 'senior_auditor_insight';

  return 'senior_auditor_task';
}

function shouldPersistSeniorSuggestion(item) {
  if (!item || typeof item !== 'object') return false;

  const type = normalizeText(item.type);
  const priority = normalizeText(item.priority);

  return (
    item.should_create_task === true ||
    ['task', 'risk_alert', 'evidence_gap'].includes(type) ||
    ['critica', 'critical', 'alta', 'high'].includes(priority)
  );
}

function getRelatedEntity(item, fallbackType, fallbackId) {
  const entity = asArray(item?.related_entities).find(
    (entry) => entry && typeof entry === 'object'
  );
  const entityType = firstNonEmptyString(entity?.entity_type);

  return {
    sourceEntityType: firstNonEmptyString(entityType, fallbackType),
    sourceEntityId: isUuid(entity?.entity_id)
      ? entity.entity_id
      : !entityType && isUuid(fallbackId)
      ? fallbackId
      : null,
  };
}

function buildSeniorSuggestionItems(seniorAuditor) {
  const candidates = [
    ...asArray(seniorAuditor?.suggested_tasks),
    ...asArray(seniorAuditor?.insights),
  ];

  const seen = new Set();
  const result = [];

  for (const item of candidates) {
    if (!shouldPersistSeniorSuggestion(item)) continue;

    const title = getSeniorSuggestionTitle(item);
    const key = `${getSeniorSuggestionType(item)}::${normalizeText(title)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      item,
      title,
      suggestionType: getSeniorSuggestionType(item),
    });
  }

  return result;
}

async function findExistingSuggestion({
  db,
  tenantId,
  suggestionType,
  title,
  sourceEntityType,
  sourceEntityId,
}) {
  const result = await db.query(
    `
    SELECT *
    FROM ai_suggestions
    WHERE tenant_id = $1::uuid
      AND suggestion_type = $2
      AND LOWER(TRIM(COALESCE(title, ''))) = LOWER(TRIM($3::text))
      AND status IN ('draft', 'pending')
      AND (
        $4::text IS NULL
        OR source_entity_type = $4
      )
      AND (
        $5::uuid IS NULL
        OR source_entity_id = $5::uuid
      )
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [
      tenantId,
      suggestionType,
      title,
      sourceEntityType || null,
      sourceEntityId || null,
    ]
  );

  return result.rows[0] || null;
}

async function insertSeniorSuggestion({
  db,
  tenantId,
  suggestionType,
  sourceModule,
  sourceEntityType,
  sourceEntityId,
  title,
  inputPayload,
  outputPayload,
  confidence,
  createdBy,
}) {
  const result = await db.query(
    `
    INSERT INTO ai_suggestions (
      tenant_id,
      suggestion_type,
      source_module,
      source_entity_type,
      source_entity_id,
      title,
      input_payload,
      output_payload,
      confidence,
      created_by
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5::uuid,
      $6,
      $7::jsonb,
      $8::jsonb,
      $9,
      $10::uuid
    )
    RETURNING *
    `,
    [
      tenantId,
      suggestionType,
      sourceModule,
      sourceEntityType || null,
      sourceEntityId || null,
      title,
      JSON.stringify(inputPayload || {}),
      JSON.stringify(outputPayload || {}),
      confidence || null,
      createdBy || null,
    ]
  );

  return result.rows[0];
}

async function persistSeniorAuditorSuggestions({
  tenantId,
  seniorAuditor,
  sourceModule = 'senior_auditor',
  sourceEntityType = 'tenant',
  sourceEntityId = null,
  inputPayload = {},
  createdBy = null,
  db = pool,
}) {
  const created = [];
  const reused = [];
  const skipped = [];

  if (!tenantId || !seniorAuditor || typeof seniorAuditor !== 'object') {
    return { created, reused, skipped };
  }

  const confidence = firstNonEmptyString(
    seniorAuditor?.summary?.confidence,
    'medium'
  );
  const externalContext = seniorAuditor?.external_context || {};
  const items = buildSeniorSuggestionItems(seniorAuditor);

  for (const draft of items) {
    const related = getRelatedEntity(
      draft.item,
      sourceEntityType,
      sourceEntityId
    );

    const existing = await findExistingSuggestion({
      db,
      tenantId,
      suggestionType: draft.suggestionType,
      title: draft.title,
      sourceEntityType: related.sourceEntityType,
      sourceEntityId: related.sourceEntityId,
    });

    if (existing) {
      reused.push(existing);
      continue;
    }

    const outputPayload = {
      ...draft.item,
      source: 'senior_auditor',
      senior_auditor_summary: seniorAuditor.summary || null,
      external_context: {
        used: externalContext.used === true,
        provider: externalContext.provider || null,
        sources: asArray(externalContext.sources).map((source) => ({
          title: source?.title || null,
          url: source?.url || null,
          source: source?.source || null,
          retrieved_at: source?.retrieved_at || null,
        })),
      },
    };

    const row = await insertSeniorSuggestion({
      db,
      tenantId,
      suggestionType: draft.suggestionType,
      sourceModule,
      sourceEntityType: related.sourceEntityType,
      sourceEntityId: related.sourceEntityId,
      title: draft.title,
      inputPayload,
      outputPayload,
      confidence: draft.item?.confidence || confidence,
      createdBy,
    });

    created.push(row);
  }

  return { created, reused, skipped };
}

function summarizeSeniorSuggestionSync(syncResult) {
  return {
    created: asArray(syncResult?.created).length,
    reused: asArray(syncResult?.reused).length,
    skipped: asArray(syncResult?.skipped).length,
    created_ids: asArray(syncResult?.created)
      .map((item) => item?.id)
      .filter(Boolean),
    reused_ids: asArray(syncResult?.reused)
      .map((item) => item?.id)
      .filter(Boolean),
  };
}

module.exports = {
  persistSeniorAuditorSuggestions,
  summarizeSeniorSuggestionSync,
};
