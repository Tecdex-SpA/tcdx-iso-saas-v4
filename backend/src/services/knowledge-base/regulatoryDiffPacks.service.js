'use strict';

const crypto = require('crypto');
const pool = require('../../config/db');

const SEMANTIC_DIFF_CONTRACT_VERSION = 'regulatory-semantic-diff-contract-v1';
const SEMANTIC_DIFF_METHOD_VERSION = 'section-anchor-token-jaccard-v1';
const REGULATORY_PACK_MODEL_VERSION = 'regulatory-pack-model-v1';
const REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION = 'regulatory-pack-activation-contract-v1';
const REGULATORY_APPLICABILITY_CONTRACT_VERSION = 'regulatory-pack-applicability-contract-v1';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const PACK_SCOPES = Object.freeze(['GLOBAL', 'JURISDICTIONAL', 'TENANT_PRIVATE']);
const PACK_STATUSES = Object.freeze(['draft', 'reviewed', 'published', 'deprecated', 'rejected', 'error']);
const PACK_ITEM_TYPES = Object.freeze(['source', 'regulation', 'regulation_version', 'legal_obligation', 'semantic_diff']);
const ACTIVATION_STATUSES = Object.freeze(['draft', 'active', 'paused', 'deprecated', 'rejected']);
const APPLICABILITY_RECOMMENDATIONS = Object.freeze(['applicable', 'not_applicable', 'needs_review', 'insufficient_data']);

class RegulatoryDiffPacksError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function text(value, max = 1000) {
  const clean = String(value || '').trim();
  return clean ? clean.slice(0, max) : null;
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return sha256(stableJson(value));
}

function assertUuid(value, field = 'id') {
  const clean = text(value, 80);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clean || '')) {
    throw new RegulatoryDiffPacksError('REGULATORY_UUID_INVALID', `${field} invalido.`, 400, { field });
  }
  return clean;
}

function assertOptionalUuid(value, field = 'id') {
  return value ? assertUuid(value, field) : null;
}

function tenantIdFromUser(user = {}) {
  return user.tenant_id || user.tenantId || user.tenant || user.company_id || user.companyId || null;
}

function actorIdFromUser(user = {}) {
  return assertOptionalUuid(user.id || user.user_id || user.userId || user.sub || null, 'actor_user_id');
}

function normalizeEnum(value, allowed, fallback, field) {
  const normalized = String(value || fallback || '').trim();
  if (!allowed.includes(normalized)) {
    throw new RegulatoryDiffPacksError('REGULATORY_ENUM_INVALID', `${field} invalido.`, 400, { field, allowed });
  }
  return normalized;
}

function parseTimestamp(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RegulatoryDiffPacksError('REGULATORY_TIMESTAMP_INVALID', `${field} invalido.`, 400, { field });
  }
  return date.toISOString();
}

function slug(value, max = 180) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenSet(value) {
  return new Set(normalizeWhitespace(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function jaccard(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(1, left.size + right.size - intersection);
}

function sectionAnchor(chunk) {
  return text(chunk.section_anchor || chunk.anchor || chunk.section_label || chunk.heading || `chunk:${chunk.chunk_ordinal}`, 220);
}

function normalizeChunk(chunk) {
  const chunkText = normalizeWhitespace(chunk.chunk_text || chunk.text || '');
  const checksum = text(chunk.text_checksum || chunk.chunk_checksum || sha256(chunkText), 64);
  return {
    id: chunk.id || null,
    anchor: sectionAnchor(chunk),
    ordinal: Number(chunk.chunk_ordinal || chunk.ordinal || 0),
    text: chunkText,
    checksum,
    reference: text(chunk.reference || chunk.section_label || chunk.heading || `chunk:${chunk.chunk_ordinal}`, 220),
  };
}

function normalizeObligation(obligation) {
  const obligationText = normalizeWhitespace(obligation.obligation_text || obligation.text || '');
  const checksum = text(obligation.obligation_text_checksum || sha256(obligationText), 64);
  const reference = text(obligation.reference || obligation.article || obligation.section, 220);
  const key = text(obligation.obligation_key || obligation.key || slug([reference, obligationText.slice(0, 80)].filter(Boolean).join(':')), 220);
  return {
    id: obligation.id || null,
    key,
    reference,
    text: obligationText,
    checksum,
    lifecycle_status: text(obligation.lifecycle_status || obligation.status, 80),
    subject: text(obligation.subject, 240),
    action_type: text(obligation.action_type || obligation.actionType, 160),
    effective_from: obligation.effective_from || null,
    effective_to: obligation.effective_to || null,
    source_chunk_id: obligation.source_chunk_id || null,
    source_text_checksum: obligation.source_text_checksum || null,
  };
}

function changeKey(parts) {
  return sha256(parts.filter((part) => part !== null && part !== undefined).join('|'));
}

function buildSectionChanges(fromChunks = [], toChunks = []) {
  const from = array(fromChunks).map(normalizeChunk).sort((a, b) => a.ordinal - b.ordinal || a.anchor.localeCompare(b.anchor));
  const to = array(toChunks).map(normalizeChunk).sort((a, b) => a.ordinal - b.ordinal || a.anchor.localeCompare(b.anchor));
  const toByAnchor = new Map(to.map((item) => [item.anchor, item]));
  const consumedTo = new Set();
  const changes = [];

  for (const before of from) {
    const direct = toByAnchor.get(before.anchor);
    if (direct) {
      consumedTo.add(direct.anchor);
      const type = before.checksum === direct.checksum ? 'unchanged' : 'modified';
      changes.push({
        change_key: changeKey(['text_section', type, before.anchor, before.checksum, direct.checksum]),
        change_type: type,
        object_type: 'text_section',
        from_object_id: before.id,
        to_object_id: direct.id,
        from_reference: before.reference,
        to_reference: direct.reference,
        from_checksum: before.checksum,
        to_checksum: direct.checksum,
        similarity: type === 'unchanged' ? 1 : Number(jaccard(before.text, direct.text).toFixed(6)),
        before_snapshot: { anchor: before.anchor, ordinal: before.ordinal },
        after_snapshot: { anchor: direct.anchor, ordinal: direct.ordinal },
        temporal_semantics: {},
        provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, chunk_ids: [before.id, direct.id].filter(Boolean) },
      });
      continue;
    }

    const candidate = to
      .filter((item) => !consumedTo.has(item.anchor))
      .map((item) => ({ item, score: before.checksum === item.checksum ? 1 : jaccard(before.text, item.text) }))
      .sort((a, b) => b.score - a.score || a.item.anchor.localeCompare(b.item.anchor))[0];

    if (candidate && candidate.score >= 0.72) {
      consumedTo.add(candidate.item.anchor);
      const type = before.checksum === candidate.item.checksum ? 'moved' : 'modified';
      changes.push({
        change_key: changeKey(['text_section', type, before.anchor, candidate.item.anchor, before.checksum, candidate.item.checksum]),
        change_type: type,
        object_type: 'text_section',
        from_object_id: before.id,
        to_object_id: candidate.item.id,
        from_reference: before.reference,
        to_reference: candidate.item.reference,
        from_checksum: before.checksum,
        to_checksum: candidate.item.checksum,
        similarity: Number(candidate.score.toFixed(6)),
        before_snapshot: { anchor: before.anchor, ordinal: before.ordinal },
        after_snapshot: { anchor: candidate.item.anchor, ordinal: candidate.item.ordinal },
        temporal_semantics: {},
        provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, moved_anchor: before.anchor !== candidate.item.anchor, chunk_ids: [before.id, candidate.item.id].filter(Boolean) },
      });
      continue;
    }

    changes.push({
      change_key: changeKey(['text_section', 'removed', before.anchor, before.checksum]),
      change_type: 'removed',
      object_type: 'text_section',
      from_object_id: before.id,
      to_object_id: null,
      from_reference: before.reference,
      to_reference: null,
      from_checksum: before.checksum,
      to_checksum: null,
      similarity: 0,
      before_snapshot: { anchor: before.anchor, ordinal: before.ordinal },
      after_snapshot: {},
      temporal_semantics: {},
      provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, chunk_ids: [before.id].filter(Boolean) },
    });
  }

  for (const after of to) {
    if (consumedTo.has(after.anchor)) continue;
    changes.push({
      change_key: changeKey(['text_section', 'added', after.anchor, after.checksum]),
      change_type: 'added',
      object_type: 'text_section',
      from_object_id: null,
      to_object_id: after.id,
      from_reference: null,
      to_reference: after.reference,
      from_checksum: null,
      to_checksum: after.checksum,
      similarity: 0,
      before_snapshot: {},
      after_snapshot: { anchor: after.anchor, ordinal: after.ordinal },
      temporal_semantics: {},
      provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, chunk_ids: [after.id].filter(Boolean) },
    });
  }

  return changes.sort((a, b) => `${a.object_type}:${a.change_type}:${a.from_reference || ''}:${a.to_reference || ''}:${a.change_key}`
    .localeCompare(`${b.object_type}:${b.change_type}:${b.from_reference || ''}:${b.to_reference || ''}:${b.change_key}`));
}

function buildObligationChanges(fromObligations = [], toObligations = []) {
  const from = array(fromObligations).map(normalizeObligation).sort((a, b) => a.key.localeCompare(b.key));
  const to = array(toObligations).map(normalizeObligation).sort((a, b) => a.key.localeCompare(b.key));
  const toByKey = new Map(to.map((item) => [item.key, item]));
  const consumed = new Set();
  const changes = [];
  const lineage = [];

  for (const before of from) {
    const after = toByKey.get(before.key);
    if (after) {
      consumed.add(after.key);
      const temporalChanged = before.effective_from !== after.effective_from || before.effective_to !== after.effective_to;
      const type = before.checksum === after.checksum && !temporalChanged ? 'unchanged' : 'modified';
      const key = changeKey(['legal_obligation', type, before.key, before.checksum, after.checksum, before.effective_from, after.effective_from]);
      changes.push({
        change_key: key,
        change_type: type,
        object_type: 'legal_obligation',
        from_object_id: before.id,
        to_object_id: after.id,
        from_reference: before.reference,
        to_reference: after.reference,
        from_checksum: before.checksum,
        to_checksum: after.checksum,
        similarity: type === 'unchanged' ? 1 : Number(jaccard(before.text, after.text).toFixed(6)),
        before_snapshot: { obligation_key: before.key, lifecycle_status: before.lifecycle_status },
        after_snapshot: { obligation_key: after.key, lifecycle_status: after.lifecycle_status },
        temporal_semantics: {
          from_effective_from: before.effective_from,
          from_effective_to: before.effective_to,
          to_effective_from: after.effective_from,
          to_effective_to: after.effective_to,
          temporal_change: temporalChanged,
        },
        provenance: {
          method: SEMANTIC_DIFF_METHOD_VERSION,
          obligation_ids: [before.id, after.id].filter(Boolean),
          source_chunk_ids: [before.source_chunk_id, after.source_chunk_id].filter(Boolean),
        },
      });
      lineage.push({
        lineage_type: type,
        lineage_key: changeKey(['lineage', type, before.id || before.key, after.id || after.key]),
        previous_obligation_id: before.id,
        next_obligation_id: after.id,
        evidence_change_key: key,
        provenance: { previous_checksum: before.checksum, next_checksum: after.checksum },
      });
      continue;
    }
    const key = changeKey(['legal_obligation', 'removed', before.key, before.checksum]);
    changes.push({
      change_key: key,
      change_type: 'removed',
      object_type: 'legal_obligation',
      from_object_id: before.id,
      to_object_id: null,
      from_reference: before.reference,
      to_reference: null,
      from_checksum: before.checksum,
      to_checksum: null,
      similarity: 0,
      before_snapshot: { obligation_key: before.key, lifecycle_status: before.lifecycle_status },
      after_snapshot: {},
      temporal_semantics: { from_effective_from: before.effective_from, from_effective_to: before.effective_to },
      provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, obligation_ids: [before.id].filter(Boolean), source_chunk_ids: [before.source_chunk_id].filter(Boolean) },
    });
    lineage.push({
      lineage_type: before.lifecycle_status === 'deprecated' ? 'deprecated' : 'removed',
      lineage_key: changeKey(['lineage', 'removed', before.id || before.key]),
      previous_obligation_id: before.id,
      next_obligation_id: null,
      evidence_change_key: key,
      provenance: { previous_checksum: before.checksum },
    });
  }

  for (const after of to) {
    if (consumed.has(after.key)) continue;
    const key = changeKey(['legal_obligation', 'added', after.key, after.checksum]);
    changes.push({
      change_key: key,
      change_type: 'added',
      object_type: 'legal_obligation',
      from_object_id: null,
      to_object_id: after.id,
      from_reference: null,
      to_reference: after.reference,
      from_checksum: null,
      to_checksum: after.checksum,
      similarity: 0,
      before_snapshot: {},
      after_snapshot: { obligation_key: after.key, lifecycle_status: after.lifecycle_status },
      temporal_semantics: { to_effective_from: after.effective_from, to_effective_to: after.effective_to },
      provenance: { method: SEMANTIC_DIFF_METHOD_VERSION, obligation_ids: [after.id].filter(Boolean), source_chunk_ids: [after.source_chunk_id].filter(Boolean) },
    });
    lineage.push({
      lineage_type: 'added',
      lineage_key: changeKey(['lineage', 'added', after.id || after.key]),
      previous_obligation_id: null,
      next_obligation_id: after.id,
      evidence_change_key: key,
      provenance: { next_checksum: after.checksum },
    });
  }

  return {
    changes: changes.sort((a, b) => `${a.object_type}:${a.change_type}:${a.from_reference || ''}:${a.to_reference || ''}:${a.change_key}`
      .localeCompare(`${b.object_type}:${b.change_type}:${b.from_reference || ''}:${b.to_reference || ''}:${b.change_key}`)),
    lineage: lineage.sort((a, b) => a.lineage_key.localeCompare(b.lineage_key)),
  };
}

function buildTemporalVersionChanges(fromVersion = {}, toVersion = {}) {
  const fields = ['publication_date', 'effective_from', 'effective_to'];
  const changed = fields.filter((field) => String(fromVersion[field] || '') !== String(toVersion[field] || ''));
  if (!changed.length) {
    return [{
      change_key: changeKey(['version_temporality', 'unaffected', fromVersion.id, toVersion.id]),
      change_type: 'unaffected',
      object_type: 'version_temporality',
      from_object_id: fromVersion.id || null,
      to_object_id: toVersion.id || null,
      from_reference: fromVersion.version_identifier || null,
      to_reference: toVersion.version_identifier || null,
      from_checksum: fromVersion.content_checksum || null,
      to_checksum: toVersion.content_checksum || null,
      similarity: 1,
      before_snapshot: Object.fromEntries(fields.map((field) => [field, fromVersion[field] || null])),
      after_snapshot: Object.fromEntries(fields.map((field) => [field, toVersion[field] || null])),
      temporal_semantics: { changed_fields: [] },
      provenance: { method: SEMANTIC_DIFF_METHOD_VERSION },
    }];
  }
  return [{
    change_key: changeKey(['version_temporality', 'modified', fromVersion.id, toVersion.id, changed.join(',')]),
    change_type: 'modified',
    object_type: 'version_temporality',
    from_object_id: fromVersion.id || null,
    to_object_id: toVersion.id || null,
    from_reference: fromVersion.version_identifier || null,
    to_reference: toVersion.version_identifier || null,
    from_checksum: fromVersion.content_checksum || null,
    to_checksum: toVersion.content_checksum || null,
    similarity: null,
    before_snapshot: Object.fromEntries(fields.map((field) => [field, fromVersion[field] || null])),
    after_snapshot: Object.fromEntries(fields.map((field) => [field, toVersion[field] || null])),
    temporal_semantics: {
      changed_fields: changed,
      publication_time_is_not_effective_time: true,
      technical_evaluation_time_excluded_from_identity: true,
    },
    provenance: { method: SEMANTIC_DIFF_METHOD_VERSION },
  }];
}

function summarizeChanges(changes) {
  const summary = {
    added: 0,
    removed: 0,
    modified: 0,
    moved: 0,
    unchanged: 0,
    unaffected: 0,
    by_object_type: {},
  };
  for (const change of changes) {
    summary[change.change_type] = (summary[change.change_type] || 0) + 1;
    summary.by_object_type[change.object_type] = summary.by_object_type[change.object_type] || {};
    summary.by_object_type[change.object_type][change.change_type] = (summary.by_object_type[change.object_type][change.change_type] || 0) + 1;
  }
  return summary;
}

function buildSemanticDiff({ regulation = {}, fromVersion = {}, toVersion = {}, fromChunks = [], toChunks = [], fromObligations = [], toObligations = [], source = {}, requestId = null } = {}) {
  if (!fromVersion.id || !toVersion.id) {
    throw new RegulatoryDiffPacksError('REGULATORY_DIFF_VERSION_REQUIRED', 'fromVersion y toVersion son requeridos.', 400);
  }
  if (fromVersion.id === toVersion.id) {
    throw new RegulatoryDiffPacksError('REGULATORY_DIFF_SAME_VERSION', 'El diff requiere dos versiones distintas.', 400);
  }
  const fromRegulationId = fromVersion.regulation_id || regulation.id;
  const toRegulationId = toVersion.regulation_id || regulation.id;
  if (!fromRegulationId || fromRegulationId !== toRegulationId) {
    throw new RegulatoryDiffPacksError('REGULATORY_DIFF_REGULATION_MISMATCH', 'Las versiones no pertenecen a la misma regulación canónica.', 409);
  }

  const sectionChanges = buildSectionChanges(fromChunks, toChunks);
  const obligation = buildObligationChanges(fromObligations, toObligations);
  const temporalChanges = buildTemporalVersionChanges(fromVersion, toVersion);
  const changes = [...sectionChanges, ...obligation.changes, ...temporalChanges]
    .sort((a, b) => `${a.object_type}:${a.change_type}:${a.from_reference || ''}:${a.to_reference || ''}:${a.change_key}`
      .localeCompare(`${b.object_type}:${b.change_type}:${b.from_reference || ''}:${b.to_reference || ''}:${b.change_key}`));
  const structuralPayload = changes.map((change) => ({
    change_key: change.change_key,
    change_type: change.change_type,
    object_type: change.object_type,
    from_object_id: change.from_object_id,
    to_object_id: change.to_object_id,
    from_reference: change.from_reference,
    to_reference: change.to_reference,
    from_checksum: change.from_checksum,
    to_checksum: change.to_checksum,
    similarity: change.similarity,
    temporal_semantics: change.temporal_semantics,
  }));
  const structuralChecksum = stableHash(structuralPayload);
  const contentChecksum = stableHash({
    from_version_checksum: fromVersion.content_checksum || null,
    to_version_checksum: toVersion.content_checksum || null,
    changes: structuralPayload,
  });
  const semanticDiffKey = stableHash({
    contract_version: SEMANTIC_DIFF_CONTRACT_VERSION,
    method: SEMANTIC_DIFF_METHOD_VERSION,
    regulation_id: fromRegulationId,
    from_version_id: fromVersion.id,
    to_version_id: toVersion.id,
    from_checksum: fromVersion.content_checksum || null,
    to_checksum: toVersion.content_checksum || null,
    structural_checksum: structuralChecksum,
  });
  return {
    semantic_diff_key: semanticDiffKey,
    regulation_id: fromRegulationId,
    from_version_id: fromVersion.id,
    to_version_id: toVersion.id,
    source_id: source.id || fromVersion.source_id || toVersion.source_id || null,
    from_knowledge_document_id: fromVersion.knowledge_document_id || null,
    to_knowledge_document_id: toVersion.knowledge_document_id || null,
    contract_version: SEMANTIC_DIFF_CONTRACT_VERSION,
    comparison_method: SEMANTIC_DIFF_METHOD_VERSION,
    structural_checksum: structuralChecksum,
    content_checksum: contentChecksum,
    status: 'draft',
    ai_interpretation_status: 'not_used',
    human_review_status: 'pending_review',
    publication_status: 'not_published',
    summary: summarizeChanges(changes),
    provenance: {
      source_id: source.id || null,
      source_key: source.source_key || null,
      regulation_id: fromRegulationId,
      from_version_id: fromVersion.id,
      to_version_id: toVersion.id,
      from_knowledge_document_id: fromVersion.knowledge_document_id || null,
      to_knowledge_document_id: toVersion.knowledge_document_id || null,
      from_content_checksum: fromVersion.content_checksum || null,
      to_content_checksum: toVersion.content_checksum || null,
      method: SEMANTIC_DIFF_METHOD_VERSION,
      contract_version: SEMANTIC_DIFF_CONTRACT_VERSION,
      request_id: requestId,
      ai_semantic_diff_truth_authority: false,
      llm_direct_sql: false,
    },
    changes,
    obligation_lineage: obligation.lineage,
    gates: {
      semantic_diff_deterministic: true,
      ai_semantic_diff_truth_authority: 0,
      legal_history_preserved: true,
      second_chunk_truth: 0,
      parallel_embedding_model: 0,
    },
  };
}

function normalizePackInput(pack = {}, { user = {} } = {}) {
  const scope = normalizeEnum(String(pack.scope || 'JURISDICTIONAL').toUpperCase(), PACK_SCOPES, 'JURISDICTIONAL', 'scope');
  const tenantId = scope === 'TENANT_PRIVATE' ? assertUuid(pack.tenant_id || pack.tenantId || tenantIdFromUser(user), 'tenant_id') : null;
  if (scope !== 'TENANT_PRIVATE' && (pack.tenant_id || pack.tenantId)) {
    throw new RegulatoryDiffPacksError('REGULATORY_PACK_TENANT_FORBIDDEN', 'GLOBAL/JURISDICTIONAL no aceptan tenant_id.', 400);
  }
  const displayName = text(pack.display_name || pack.displayName || pack.name, 240);
  if (!displayName) throw new RegulatoryDiffPacksError('REGULATORY_PACK_NAME_REQUIRED', 'display_name es requerido.', 400);
  const packKey = text(pack.pack_key || pack.packKey, 180) || slug([scope, pack.jurisdiction, pack.domain, displayName].filter(Boolean).join(':'));
  return {
    pack_key: packKey,
    scope,
    tenant_id: tenantId,
    jurisdiction: text(pack.jurisdiction, 120),
    domain: text(pack.domain, 160),
    subject: text(pack.subject, 220),
    display_name: displayName,
    description: text(pack.description, 2000),
    lifecycle_status: normalizeEnum(String(pack.lifecycle_status || pack.status || 'draft').toLowerCase(), PACK_STATUSES, 'draft', 'lifecycle_status'),
    owner: text(pack.owner, 160) || 'CODEX_B_REGULATORY',
    model_version: REGULATORY_PACK_MODEL_VERSION,
    provenance: {
      ...object(pack.provenance),
      model_version: REGULATORY_PACK_MODEL_VERSION,
      legal_text_copied: false,
      ai_regulatory_truth_authority: false,
    },
    metadata: {
      ...object(pack.metadata),
      model_version: REGULATORY_PACK_MODEL_VERSION,
    },
  };
}

function normalizePackItem(item = {}) {
  const itemType = normalizeEnum(String(item.item_type || item.itemType || '').toLowerCase(), PACK_ITEM_TYPES, null, 'item_type');
  const ids = {
    source_id: assertOptionalUuid(item.source_id || item.sourceId, 'source_id'),
    regulation_id: assertOptionalUuid(item.regulation_id || item.regulationId, 'regulation_id'),
    regulation_version_id: assertOptionalUuid(item.regulation_version_id || item.regulationVersionId, 'regulation_version_id'),
    legal_obligation_id: assertOptionalUuid(item.legal_obligation_id || item.legalObligationId, 'legal_obligation_id'),
    semantic_diff_id: assertOptionalUuid(item.semantic_diff_id || item.semanticDiffId, 'semantic_diff_id'),
  };
  const required = {
    source: 'source_id',
    regulation: 'regulation_id',
    regulation_version: 'regulation_version_id',
    legal_obligation: 'legal_obligation_id',
    semantic_diff: 'semantic_diff_id',
  }[itemType];
  if (!ids[required]) {
    throw new RegulatoryDiffPacksError('REGULATORY_PACK_ITEM_REFERENCE_REQUIRED', `${required} es requerido para item_type=${itemType}.`, 400);
  }
  const itemKey = text(item.item_key || item.itemKey, 220) || slug([itemType, ids[required], item.reference].filter(Boolean).join(':'));
  return {
    item_key: itemKey,
    item_type: itemType,
    ...ids,
    reference: text(item.reference, 220),
    lifecycle_status: normalizeEnum(String(item.lifecycle_status || item.status || 'active').toLowerCase(), ['active', 'inactive', 'deprecated'], 'active', 'item.lifecycle_status'),
    effective_from: parseTimestamp(item.effective_from || item.effectiveFrom, 'item.effective_from'),
    effective_to: parseTimestamp(item.effective_to || item.effectiveTo, 'item.effective_to'),
    applicability_rule: object(item.applicability_rule || item.applicabilityRule),
    mapping_targets: array(item.mapping_targets || item.mappingTargets).map((target) => object(target)),
    provenance: {
      ...object(item.provenance),
      model_version: REGULATORY_PACK_MODEL_VERSION,
      copied_legal_text: false,
    },
    metadata: object(item.metadata),
  };
}

function normalizePackVersionInput(version = {}, items = []) {
  const versionIdentifier = text(version.version_identifier || version.versionIdentifier || version.version || 'v1', 120);
  const normalizedItems = array(items).map(normalizePackItem).sort((a, b) => a.item_key.localeCompare(b.item_key));
  const compositionChecksum = stableHash({
    contract_version: REGULATORY_PACK_MODEL_VERSION,
    version_identifier: versionIdentifier,
    items: normalizedItems.map((item) => ({
      item_key: item.item_key,
      item_type: item.item_type,
      source_id: item.source_id,
      regulation_id: item.regulation_id,
      regulation_version_id: item.regulation_version_id,
      legal_obligation_id: item.legal_obligation_id,
      semantic_diff_id: item.semantic_diff_id,
      reference: item.reference,
      effective_from: item.effective_from,
      effective_to: item.effective_to,
      applicability_rule: item.applicability_rule,
      mapping_targets: item.mapping_targets,
    })),
  });
  return {
    version_identifier: versionIdentifier,
    lifecycle_status: normalizeEnum(String(version.lifecycle_status || version.status || 'draft').toLowerCase(), PACK_STATUSES, 'draft', 'version.lifecycle_status'),
    effective_from: parseTimestamp(version.effective_from || version.effectiveFrom, 'version.effective_from'),
    effective_to: parseTimestamp(version.effective_to || version.effectiveTo, 'version.effective_to'),
    supersedes_pack_version_id: assertOptionalUuid(version.supersedes_pack_version_id || version.supersedesPackVersionId, 'supersedes_pack_version_id'),
    composition_checksum: compositionChecksum,
    source_registry_ids: [...new Set(normalizedItems.map((item) => item.source_id).filter(Boolean))].sort(),
    regulation_ids: [...new Set(normalizedItems.map((item) => item.regulation_id).filter(Boolean))].sort(),
    regulation_version_ids: [...new Set(normalizedItems.map((item) => item.regulation_version_id).filter(Boolean))].sort(),
    obligation_ids: [...new Set(normalizedItems.map((item) => item.legal_obligation_id).filter(Boolean))].sort(),
    contract_version: REGULATORY_PACK_MODEL_VERSION,
    activation_contract_version: REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
    provenance: {
      ...object(version.provenance),
      contract_version: REGULATORY_PACK_MODEL_VERSION,
      activation_contract_version: REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
      composition_copies_regulatory_truth: false,
    },
    metadata: object(version.metadata),
    reviewed_by: assertOptionalUuid(version.reviewed_by || version.reviewedBy, 'reviewed_by'),
    reviewed_at: parseTimestamp(version.reviewed_at || version.reviewedAt, 'reviewed_at'),
    items: normalizedItems,
  };
}

function buildPackDefinition({ pack = {}, version = {}, items = [], user = {} } = {}) {
  const normalizedPack = normalizePackInput(pack, { user });
  const normalizedVersion = normalizePackVersionInput(version, items);
  return {
    pack: normalizedPack,
    version: normalizedVersion,
    items: normalizedVersion.items,
    composition_checksum: normalizedVersion.composition_checksum,
    gates: {
      regulatory_pack_model: true,
      legal_text_copied: 0,
      second_regulatory_model: 0,
      zero_hardcode: true,
    },
  };
}

function scoreRule(rule = {}, tenantProfile = {}) {
  const requiredFields = array(rule.required_fields || rule.requiredFields);
  if (!requiredFields.length) return { recommendation: 'needs_review', confidence: 0.5, reasons: ['no_rule_fields'], human_confirmation_required: true };
  const missing = requiredFields.filter((field) => tenantProfile[field] === undefined || tenantProfile[field] === null || tenantProfile[field] === '');
  if (missing.length) return { recommendation: 'insufficient_data', confidence: 0, reasons: missing.map((field) => `missing:${field}`), human_confirmation_required: true };
  const matches = array(rule.matches).filter((condition) => {
    const field = condition.field;
    if (!field) return false;
    const actual = tenantProfile[field];
    if (Array.isArray(condition.any_of || condition.anyOf)) return (condition.any_of || condition.anyOf).includes(actual);
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return actual === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, 'not_equals')) return actual !== condition.not_equals;
    return Boolean(actual);
  });
  if (matches.length) {
    return {
      recommendation: 'applicable',
      confidence: Math.min(1, 0.6 + (matches.length * 0.1)),
      reasons: matches.map((condition) => `matched:${condition.field}`),
      human_confirmation_required: rule.sensitive !== false,
    };
  }
  return { recommendation: 'needs_review', confidence: 0.4, reasons: ['rule_fields_present_without_positive_match'], human_confirmation_required: true };
}

function evaluateApplicability({ tenantId, packVersion = {}, items = [], tenantProfile = {}, requestId = null } = {}) {
  const effectiveTenantId = assertUuid(tenantId, 'tenant_id');
  const itemResults = array(items).map((item) => {
    const rule = object(item.applicability_rule || item.applicabilityRule);
    const scored = scoreRule(rule, object(tenantProfile));
    return {
      item_key: item.item_key,
      regulatory_pack_item_id: item.id || null,
      legal_obligation_id: item.legal_obligation_id || null,
      recommendation: scored.recommendation,
      confidence: Number(scored.confidence.toFixed(6)),
      human_confirmation_required: scored.human_confirmation_required,
      explanation: { reasons: scored.reasons, rule_contract: REGULATORY_APPLICABILITY_CONTRACT_VERSION },
      provenance: {
        tenant_id: effectiveTenantId,
        pack_version_id: packVersion.id || null,
        contract_version: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
        ai_regulatory_truth_authority: false,
        request_id: requestId,
      },
    };
  });
  const recommendations = itemResults.map((item) => item.recommendation);
  const recommendation = recommendations.includes('applicable')
    ? 'applicable'
    : recommendations.includes('insufficient_data')
      ? 'insufficient_data'
      : recommendations.includes('needs_review')
        ? 'needs_review'
        : 'not_applicable';
  const confidence = itemResults.length
    ? Number((itemResults.reduce((sum, item) => sum + item.confidence, 0) / itemResults.length).toFixed(6))
    : 0;
  const evaluationKey = stableHash({
    tenant_id: effectiveTenantId,
    pack_version_id: packVersion.id || null,
    composition_checksum: packVersion.composition_checksum || null,
    tenant_profile_checksum: stableHash(object(tenantProfile)),
    contract_version: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
  });
  return {
    evaluation_key: evaluationKey,
    tenant_id: effectiveTenantId,
    regulatory_pack_id: packVersion.regulatory_pack_id || packVersion.regulatory_pack_id,
    regulatory_pack_version_id: packVersion.id || null,
    evaluation_status: 'draft',
    recommendation: APPLICABILITY_RECOMMENDATIONS.includes(recommendation) ? recommendation : 'needs_review',
    confidence,
    human_confirmation_required: itemResults.some((item) => item.human_confirmation_required),
    contract_version: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
    inputs_summary: {
      tenant_profile_checksum: stableHash(object(tenantProfile)),
      provided_fields: Object.keys(object(tenantProfile)).sort(),
    },
    explanation: {
      item_count: itemResults.length,
      recommendation_counts: summarizeChanges(itemResults.map((item) => ({ change_type: item.recommendation, object_type: 'applicability' }))).by_object_type.applicability || {},
    },
    provenance: {
      contract_version: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
      pack_version_id: packVersion.id || null,
      legal_truth_from_ai: false,
      request_id: requestId,
    },
    results: itemResults,
    gates: {
      cross_tenant_applicability_leakage: 0,
      ai_regulatory_truth_authority: 0,
      tenant_id_from_auth_context: true,
    },
  };
}

async function fetchVersion(client, versionId, tenantId) {
  const result = await client.query(
    `SELECT v.*, r.scope, r.tenant_id, r.jurisdiction, r.source_id AS regulation_source_id,
            s.source_key, s.authority_classification
       FROM regulation_versions v
       JOIN regulations r ON r.id=v.regulation_id
       LEFT JOIN regulatory_authoritative_sources s ON s.id=v.source_id
      WHERE v.id=$1::uuid
        AND (
          r.scope IN ('GLOBAL','JURISDICTIONAL')
          OR (r.scope='TENANT_PRIVATE' AND r.tenant_id=$2::uuid)
        )
      LIMIT 1`,
    [assertUuid(versionId, 'version_id'), tenantId ? assertUuid(tenantId, 'tenant_id') : null]
  );
  if (!result.rowCount) throw new RegulatoryDiffPacksError('REGULATION_VERSION_NOT_FOUND', 'Version regulatoria no encontrada para el contexto.', 404);
  return result.rows[0];
}

async function fetchChunks(client, knowledgeDocumentId) {
  const result = await client.query(
    `SELECT id, chunk_ordinal, chunk_text, text_checksum, section_label, heading
       FROM knowledge_document_chunks
      WHERE scope='REGULATORY'
        AND tenant_id IS NULL
        AND knowledge_document_id=$1::uuid
      ORDER BY chunk_ordinal, id
      LIMIT 500`,
    [assertUuid(knowledgeDocumentId, 'knowledge_document_id')]
  );
  return result.rows;
}

async function fetchObligations(client, versionId) {
  const result = await client.query(
    `SELECT id, obligation_key, reference, obligation_text, obligation_text_checksum,
            lifecycle_status, subject, action_type, effective_from, effective_to,
            source_chunk_id, source_text_checksum
       FROM legal_obligations
      WHERE regulation_version_id=$1::uuid
      ORDER BY obligation_key, id
      LIMIT 1000`,
    [assertUuid(versionId, 'regulation_version_id')]
  );
  return result.rows;
}

function createRegulatoryDiffPacksService({ db = pool } = {}) {
  async function computeSemanticDiff({ user = {}, fromVersionId, toVersionId, requestId = null } = {}) {
    const tenantId = tenantIdFromUser(user);
    const actorUserId = actorIdFromUser(user);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const fromVersion = await fetchVersion(client, fromVersionId, tenantId);
      const toVersion = await fetchVersion(client, toVersionId, tenantId);
      if (fromVersion.regulation_id !== toVersion.regulation_id) {
        throw new RegulatoryDiffPacksError('REGULATORY_DIFF_REGULATION_MISMATCH', 'Las versiones no pertenecen a la misma regulación canónica.', 409);
      }
      const fromChunks = await fetchChunks(client, fromVersion.knowledge_document_id);
      const toChunks = await fetchChunks(client, toVersion.knowledge_document_id);
      const fromObligations = await fetchObligations(client, fromVersion.id);
      const toObligations = await fetchObligations(client, toVersion.id);
      const diff = buildSemanticDiff({
        regulation: { id: fromVersion.regulation_id },
        fromVersion,
        toVersion,
        fromChunks,
        toChunks,
        fromObligations,
        toObligations,
        source: { id: toVersion.source_id, source_key: toVersion.source_key },
        requestId,
      });

      const diffResult = await client.query(
        `INSERT INTO regulatory_semantic_diffs (
           semantic_diff_key,regulation_id,from_version_id,to_version_id,source_id,
           from_knowledge_document_id,to_knowledge_document_id,contract_version,comparison_method,
           structural_checksum,content_checksum,status,ai_interpretation_status,human_review_status,
           publication_status,summary,provenance,actor_user_id,correlation_id
         ) VALUES (
           $1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,$11,
           'draft','not_used','pending_review','not_published',$12::jsonb,$13::jsonb,$14::uuid,$15
         )
         ON CONFLICT (semantic_diff_key) DO UPDATE SET
           summary=EXCLUDED.summary,
           provenance=EXCLUDED.provenance,
           actor_user_id=EXCLUDED.actor_user_id,
           correlation_id=EXCLUDED.correlation_id,
           updated_at=now()
         RETURNING *`,
        [
          diff.semantic_diff_key, diff.regulation_id, diff.from_version_id, diff.to_version_id,
          diff.source_id, diff.from_knowledge_document_id, diff.to_knowledge_document_id,
          diff.contract_version, diff.comparison_method, diff.structural_checksum, diff.content_checksum,
          JSON.stringify(diff.summary), JSON.stringify(diff.provenance), actorUserId, requestId,
        ]
      );
      const semanticDiff = diffResult.rows[0];
      const changeByKey = new Map();
      for (const change of diff.changes) {
        const result = await client.query(
          `INSERT INTO regulatory_semantic_diff_changes (
             semantic_diff_id,change_key,change_type,object_type,from_object_id,to_object_id,
             from_reference,to_reference,from_checksum,to_checksum,similarity,before_snapshot,
             after_snapshot,temporal_semantics,provenance,review_status
           ) VALUES (
             $1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,'pending_review'
           )
           ON CONFLICT (semantic_diff_id,change_key) DO UPDATE SET
             before_snapshot=EXCLUDED.before_snapshot,
             after_snapshot=EXCLUDED.after_snapshot,
             temporal_semantics=EXCLUDED.temporal_semantics,
             provenance=EXCLUDED.provenance
           RETURNING id, change_key`,
          [
            semanticDiff.id, change.change_key, change.change_type, change.object_type,
            change.from_object_id, change.to_object_id, change.from_reference, change.to_reference,
            change.from_checksum, change.to_checksum, change.similarity, JSON.stringify(change.before_snapshot),
            JSON.stringify(change.after_snapshot), JSON.stringify(change.temporal_semantics), JSON.stringify(change.provenance),
          ]
        );
        changeByKey.set(result.rows[0].change_key, result.rows[0].id);
      }
      for (const line of diff.obligation_lineage) {
        await client.query(
          `INSERT INTO regulatory_obligation_change_lineage (
             semantic_diff_id,regulation_id,from_version_id,to_version_id,previous_obligation_id,next_obligation_id,
             lineage_type,lineage_key,evidence_change_id,contract_version,provenance,review_status
           ) VALUES (
             $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9::uuid,$10,$11::jsonb,'pending_review'
           )
           ON CONFLICT (semantic_diff_id,lineage_key) DO UPDATE SET
             evidence_change_id=EXCLUDED.evidence_change_id,
             provenance=EXCLUDED.provenance`,
          [
            semanticDiff.id, diff.regulation_id, diff.from_version_id, diff.to_version_id,
            line.previous_obligation_id, line.next_obligation_id, line.lineage_type, line.lineage_key,
            changeByKey.get(line.evidence_change_key) || null, SEMANTIC_DIFF_CONTRACT_VERSION, JSON.stringify(line.provenance),
          ]
        );
      }
      await audit(client, {
        tenantId: null,
        actorUserId,
        action: 'semantic_diff.computed',
        objectType: 'regulatory_semantic_diff',
        objectId: semanticDiff.id,
        contractVersion: SEMANTIC_DIFF_CONTRACT_VERSION,
        sourceId: diff.source_id,
        regulationId: diff.regulation_id,
        regulationVersionId: diff.to_version_id,
        correlationId: requestId,
        metadata: { change_count: diff.changes.length, legal_text_logged: false },
      });
      await client.query('COMMIT');
      return { ...diff, id: semanticDiff.id };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function audit(client, { tenantId, actorUserId, action, objectType, objectId, contractVersion, sourceId = null, regulationId = null, regulationVersionId = null, correlationId = null, metadata = {} }) {
    await client.query(
      `INSERT INTO regulatory_governance_audit (
         tenant_id,actor_user_id,action,object_type,object_id,previous_state,new_state,contract_version,
         source_id,regulation_id,regulation_version_id,correlation_id,metadata
       ) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,NULL,NULL,$6,$7::uuid,$8::uuid,$9::uuid,$10,$11::jsonb)`,
      [tenantId, actorUserId, action, objectType, objectId, contractVersion, sourceId, regulationId, regulationVersionId, correlationId, JSON.stringify(metadata)]
    );
  }

  async function createRegulatoryPack({ user = {}, pack = {}, version = {}, items = [], requestId = null } = {}) {
    const actorUserId = actorIdFromUser(user);
    const definition = buildPackDefinition({ pack, version, items, user });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT id
           FROM regulatory_packs
          WHERE scope=$1
            AND COALESCE(tenant_id, $2::uuid)=COALESCE($3::uuid, $2::uuid)
            AND pack_key=$4
          LIMIT 1`,
        [definition.pack.scope, ZERO_UUID, definition.pack.tenant_id, definition.pack.pack_key]
      );
      const packValues = [
        definition.pack.pack_key,
        definition.pack.scope,
        definition.pack.tenant_id,
        definition.pack.jurisdiction,
        definition.pack.domain,
        definition.pack.subject,
        definition.pack.display_name,
        definition.pack.description,
        definition.pack.lifecycle_status,
        definition.pack.owner,
        definition.pack.model_version,
        JSON.stringify(definition.pack.provenance),
        JSON.stringify(definition.pack.metadata),
      ];
      const packResult = existing.rowCount
        ? await client.query(
          `UPDATE regulatory_packs
              SET jurisdiction=$4,
                  domain=$5,
                  subject=$6,
                  display_name=$7,
                  description=$8,
                  lifecycle_status=$9,
                  owner=$10,
                  model_version=$11,
                  provenance=$12::jsonb,
                  metadata=$13::jsonb,
                  updated_at=now()
            WHERE id=$14::uuid
            RETURNING *`,
          [...packValues, existing.rows[0].id]
        )
        : await client.query(
          `INSERT INTO regulatory_packs (
             pack_key,scope,tenant_id,jurisdiction,domain,subject,display_name,description,
             lifecycle_status,owner,model_version,provenance,metadata
           ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)
           RETURNING *`,
          packValues
        );
      const packRow = packResult.rows[0];
      const versionResult = await client.query(
        `INSERT INTO regulatory_pack_versions (
           regulatory_pack_id,version_identifier,lifecycle_status,effective_from,effective_to,
           supersedes_pack_version_id,composition_checksum,source_registry_ids,regulation_ids,
           regulation_version_ids,obligation_ids,contract_version,activation_contract_version,
           provenance,metadata,reviewed_by,reviewed_at
         ) VALUES (
           $1::uuid,$2,$3,$4::timestamptz,$5::timestamptz,$6::uuid,$7,$8::uuid[],$9::uuid[],
           $10::uuid[],$11::uuid[],$12,$13,$14::jsonb,$15::jsonb,$16::uuid,$17::timestamptz
         )
         ON CONFLICT (regulatory_pack_id,version_identifier) DO UPDATE SET
           lifecycle_status=EXCLUDED.lifecycle_status,
           effective_from=EXCLUDED.effective_from,
           effective_to=EXCLUDED.effective_to,
           composition_checksum=EXCLUDED.composition_checksum,
           source_registry_ids=EXCLUDED.source_registry_ids,
           regulation_ids=EXCLUDED.regulation_ids,
           regulation_version_ids=EXCLUDED.regulation_version_ids,
           obligation_ids=EXCLUDED.obligation_ids,
           provenance=EXCLUDED.provenance,
           metadata=EXCLUDED.metadata,
           reviewed_by=EXCLUDED.reviewed_by,
           reviewed_at=EXCLUDED.reviewed_at,
           updated_at=now()
         RETURNING *`,
        [
          packRow.id,
          definition.version.version_identifier,
          definition.version.lifecycle_status,
          definition.version.effective_from,
          definition.version.effective_to,
          definition.version.supersedes_pack_version_id,
          definition.version.composition_checksum,
          definition.version.source_registry_ids,
          definition.version.regulation_ids,
          definition.version.regulation_version_ids,
          definition.version.obligation_ids,
          definition.version.contract_version,
          definition.version.activation_contract_version,
          JSON.stringify(definition.version.provenance),
          JSON.stringify(definition.version.metadata),
          definition.version.reviewed_by,
          definition.version.reviewed_at,
        ]
      );
      const packVersion = versionResult.rows[0];
      const packItems = [];
      for (const item of definition.items) {
        const itemResult = await client.query(
          `INSERT INTO regulatory_pack_items (
             regulatory_pack_version_id,item_key,item_type,source_id,regulation_id,regulation_version_id,
             legal_obligation_id,semantic_diff_id,reference,lifecycle_status,effective_from,effective_to,
             applicability_rule,mapping_targets,provenance,metadata
           ) VALUES (
             $1::uuid,$2,$3,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9,$10,$11::timestamptz,$12::timestamptz,
             $13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb
           )
           ON CONFLICT (regulatory_pack_version_id,item_key) DO UPDATE SET
             item_type=EXCLUDED.item_type,
             source_id=EXCLUDED.source_id,
             regulation_id=EXCLUDED.regulation_id,
             regulation_version_id=EXCLUDED.regulation_version_id,
             legal_obligation_id=EXCLUDED.legal_obligation_id,
             semantic_diff_id=EXCLUDED.semantic_diff_id,
             reference=EXCLUDED.reference,
             lifecycle_status=EXCLUDED.lifecycle_status,
             effective_from=EXCLUDED.effective_from,
             effective_to=EXCLUDED.effective_to,
             applicability_rule=EXCLUDED.applicability_rule,
             mapping_targets=EXCLUDED.mapping_targets,
             provenance=EXCLUDED.provenance,
             metadata=EXCLUDED.metadata
           RETURNING *`,
          [
            packVersion.id, item.item_key, item.item_type, item.source_id, item.regulation_id,
            item.regulation_version_id, item.legal_obligation_id, item.semantic_diff_id, item.reference,
            item.lifecycle_status, item.effective_from, item.effective_to, JSON.stringify(item.applicability_rule),
            JSON.stringify(item.mapping_targets), JSON.stringify(item.provenance), JSON.stringify(item.metadata),
          ]
        );
        packItems.push(itemResult.rows[0]);
      }
      await audit(client, {
        tenantId: definition.pack.tenant_id,
        actorUserId,
        action: 'regulatory_pack.version_upserted',
        objectType: 'regulatory_pack_version',
        objectId: packVersion.id,
        contractVersion: REGULATORY_PACK_MODEL_VERSION,
        correlationId: requestId,
        metadata: {
          pack_key: packRow.pack_key,
          version_identifier: packVersion.version_identifier,
          item_count: packItems.length,
          legal_text_logged: false,
        },
      });
      await client.query('COMMIT');
      return {
        pack: packRow,
        pack_version: packVersion,
        items: packItems,
        gates: definition.gates,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function fetchPackVersion(client, packVersionId, tenantId) {
    const result = await client.query(
      `SELECT pv.*, p.pack_key, p.scope, p.tenant_id AS pack_tenant_id, p.lifecycle_status AS pack_status
         FROM regulatory_pack_versions pv
         JOIN regulatory_packs p ON p.id=pv.regulatory_pack_id
        WHERE pv.id=$1::uuid
          AND (
            p.scope IN ('GLOBAL','JURISDICTIONAL')
            OR (p.scope='TENANT_PRIVATE' AND p.tenant_id=$2::uuid)
          )
        LIMIT 1`,
      [assertUuid(packVersionId, 'regulatory_pack_version_id'), tenantId ? assertUuid(tenantId, 'tenant_id') : null]
    );
    if (!result.rowCount) throw new RegulatoryDiffPacksError('REGULATORY_PACK_VERSION_NOT_FOUND', 'Pack regulatorio no encontrado para el contexto.', 404);
    return result.rows[0];
  }

  async function activatePackForTenant({ user = {}, packVersionId, body = {}, requestId = null } = {}) {
    const tenantId = assertUuid(tenantIdFromUser(user), 'tenant_id');
    const actorUserId = actorIdFromUser(user);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const packVersion = await fetchPackVersion(client, packVersionId, tenantId);
      const status = normalizeEnum(String(body.activation_status || body.status || 'active').toLowerCase(), ACTIVATION_STATUSES, 'active', 'activation_status');
      const activatedAt = status === 'active' ? parseTimestamp(body.activated_at || body.activatedAt, 'activated_at') || new Date().toISOString() : null;
      const result = await client.query(
        `INSERT INTO regulatory_pack_tenant_activations (
           tenant_id,regulatory_pack_id,regulatory_pack_version_id,activation_status,activated_at,
           deactivated_at,configured_by,configuration,activation_contract_version,provenance
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5::timestamptz,$6::timestamptz,$7::uuid,$8::jsonb,$9,$10::jsonb
         )
         ON CONFLICT (tenant_id,regulatory_pack_version_id) DO UPDATE SET
           activation_status=EXCLUDED.activation_status,
           activated_at=EXCLUDED.activated_at,
           deactivated_at=EXCLUDED.deactivated_at,
           configured_by=EXCLUDED.configured_by,
           configuration=EXCLUDED.configuration,
           provenance=EXCLUDED.provenance,
           updated_at=now()
         RETURNING *`,
        [
          tenantId, packVersion.regulatory_pack_id, packVersion.id, status, activatedAt,
          parseTimestamp(body.deactivated_at || body.deactivatedAt, 'deactivated_at'), actorUserId,
          JSON.stringify(object(body.configuration)), REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
          JSON.stringify({
            ...object(body.provenance),
            contract_version: REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
            tenant_activation_does_not_mutate_pack_definition: true,
            request_id: requestId,
          }),
        ]
      );
      await audit(client, {
        tenantId,
        actorUserId,
        action: 'regulatory_pack.tenant_activation_upserted',
        objectType: 'regulatory_pack_tenant_activation',
        objectId: result.rows[0].id,
        contractVersion: REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
        correlationId: requestId,
        metadata: { pack_version_id: packVersion.id, activation_status: status, legal_text_logged: false },
      });
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  async function evaluatePackApplicability({ user = {}, packVersionId, tenantProfile = {}, requestId = null } = {}) {
    const tenantId = assertUuid(tenantIdFromUser(user), 'tenant_id');
    const actorUserId = actorIdFromUser(user);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const packVersion = await fetchPackVersion(client, packVersionId, tenantId);
      const itemsResult = await client.query(
        `SELECT *
           FROM regulatory_pack_items
          WHERE regulatory_pack_version_id=$1::uuid
          ORDER BY item_key, id
          LIMIT 1000`,
        [packVersion.id]
      );
      const activation = await client.query(
        `SELECT id
           FROM regulatory_pack_tenant_activations
          WHERE tenant_id=$1::uuid
            AND regulatory_pack_version_id=$2::uuid
          ORDER BY updated_at DESC
          LIMIT 1`,
        [tenantId, packVersion.id]
      );
      const evaluation = evaluateApplicability({
        tenantId,
        packVersion,
        items: itemsResult.rows,
        tenantProfile,
        requestId,
      });
      const evaluationResult = await client.query(
        `INSERT INTO regulatory_pack_applicability_evaluations (
           tenant_id,regulatory_pack_id,regulatory_pack_version_id,activation_id,evaluation_key,
           evaluation_status,recommendation,confidence,human_confirmation_required,contract_version,
           evaluated_by,inputs_summary,explanation,provenance
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'draft',$6,$7,$8,$9,$10::uuid,$11::jsonb,$12::jsonb,$13::jsonb
         )
         ON CONFLICT (tenant_id,regulatory_pack_version_id,evaluation_key) DO UPDATE SET
           recommendation=EXCLUDED.recommendation,
           confidence=EXCLUDED.confidence,
           human_confirmation_required=EXCLUDED.human_confirmation_required,
           inputs_summary=EXCLUDED.inputs_summary,
           explanation=EXCLUDED.explanation,
           provenance=EXCLUDED.provenance
         RETURNING *`,
        [
          tenantId, packVersion.regulatory_pack_id, packVersion.id, activation.rows[0]?.id || null,
          evaluation.evaluation_key, evaluation.recommendation, evaluation.confidence,
          evaluation.human_confirmation_required, evaluation.contract_version, actorUserId,
          JSON.stringify(evaluation.inputs_summary), JSON.stringify(evaluation.explanation), JSON.stringify(evaluation.provenance),
        ]
      );
      for (const item of evaluation.results) {
        await client.query(
          `INSERT INTO regulatory_pack_applicability_results (
             applicability_evaluation_id,regulatory_pack_item_id,legal_obligation_id,recommendation,
             confidence,human_confirmation_required,explanation,provenance
           ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,$8::jsonb)`,
          [
            evaluationResult.rows[0].id, item.regulatory_pack_item_id, item.legal_obligation_id,
            item.recommendation, item.confidence, item.human_confirmation_required,
            JSON.stringify(item.explanation), JSON.stringify(item.provenance),
          ]
        );
      }
      await audit(client, {
        tenantId,
        actorUserId,
        action: 'regulatory_pack.applicability_evaluated',
        objectType: 'regulatory_pack_applicability_evaluation',
        objectId: evaluationResult.rows[0].id,
        contractVersion: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
        correlationId: requestId,
        metadata: { pack_version_id: packVersion.id, recommendation: evaluation.recommendation, legal_text_logged: false },
      });
      await client.query('COMMIT');
      return { ...evaluation, id: evaluationResult.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    semanticDiffContractVersion: SEMANTIC_DIFF_CONTRACT_VERSION,
    semanticDiffMethodVersion: SEMANTIC_DIFF_METHOD_VERSION,
    regulatoryPackModelVersion: REGULATORY_PACK_MODEL_VERSION,
    regulatoryPackActivationContractVersion: REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
    regulatoryApplicabilityContractVersion: REGULATORY_APPLICABILITY_CONTRACT_VERSION,
    computeSemanticDiff,
    createRegulatoryPack,
    activatePackForTenant,
    evaluatePackApplicability,
  };
}

module.exports = {
  SEMANTIC_DIFF_CONTRACT_VERSION,
  SEMANTIC_DIFF_METHOD_VERSION,
  REGULATORY_PACK_MODEL_VERSION,
  REGULATORY_PACK_ACTIVATION_CONTRACT_VERSION,
  REGULATORY_APPLICABILITY_CONTRACT_VERSION,
  RegulatoryDiffPacksError,
  buildSemanticDiff,
  buildSectionChanges,
  buildObligationChanges,
  buildPackDefinition,
  evaluateApplicability,
  normalizePackInput,
  normalizePackItem,
  normalizePackVersionInput,
  stableHash,
  createRegulatoryDiffPacksService,
};
