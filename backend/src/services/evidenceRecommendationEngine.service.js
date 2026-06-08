'use strict';

const { CATALOG } = require('./evidenceRecommendationCatalog');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function confidenceFromScore(score) {
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSearchText(input = {}) {
  return normalizeText([
    input.standard_code,
    input.standard,
    input.clause,
    input.control_code,
    input.control_description,
    input.process_name,
    input.process,
    input.operation_name,
    input.operation,
    input.area,
    input.industry,
    ...asArray(input.existing_evidences).map((item) => item.name || item.file_name || item.description),
    ...asArray(input.existing_gaps).map((item) => item.title || item.description || item.control_description),
    ...asArray(input.existing_risks).map((item) => item.title || item.description || item.risk_title || item.risk_description),
    ...asArray(input.existing_actions).map((item) => item.title || item.description),
  ].filter(Boolean).join(' | '));
}

function catalogScore(entry, searchText, input = {}) {
  let score = 0;
  for (const keyword of entry.keywords || []) {
    if (searchText.includes(normalizeText(keyword))) score += 2;
  }

  const standard = normalizeText(input.standard_code || input.standard);
  if (entry.id === 'information_security' && standard.includes('27001')) score += 3;
  if (entry.id === 'ai_management_system' && standard.includes('42001')) score += 4;
  if (entry.id === 'document_control' && /4\.?4|7\.?5/.test(String(input.clause || ''))) score += 1;
  if (entry.id === 'customer_support_incidents' && /8\.?2|9\.?1|10\.?2/.test(String(input.clause || ''))) score += 1;
  if (entry.id === 'supplier_evaluation' && /8\.?4/.test(String(input.clause || ''))) score += 2;
  if (entry.id === 'internal_audit' && /9\.?2/.test(String(input.clause || ''))) score += 2;
  if (entry.id === 'nonconformity_corrective_action' && /10\.?2/.test(String(input.clause || ''))) score += 2;

  return score;
}

function selectCatalogEntries(input = {}, limit = 3) {
  const searchText = buildSearchText(input);
  const scored = CATALOG
    .map((entry) => ({
      entry,
      score: catalogScore(entry, searchText, input),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return scored.slice(0, limit);

  const standard = normalizeText(input.standard_code || input.standard);
  if (standard.includes('27001')) {
    return [{ entry: CATALOG.find((entry) => entry.id === 'information_security'), score: 2 }].filter((item) => item.entry);
  }
  if (standard.includes('42001')) {
    return [{ entry: CATALOG.find((entry) => entry.id === 'ai_management_system'), score: 2 }].filter((item) => item.entry);
  }

  return [{ entry: CATALOG.find((entry) => entry.id === 'document_control'), score: 1 }].filter((item) => item.entry);
}

function existingEvidenceNames(input = {}) {
  return unique(asArray(input.existing_evidences).map((item) => (
    item.name ||
    item.file_name ||
    item.description ||
    item.source_label ||
    null
  )));
}

function missingReason(input = {}) {
  const activeCount = Number(input.active_evidence_count || 0);
  const candidateCount = Number(input.candidate_evidence_count || 0);

  if (activeCount === 0 && candidateCount === 0) {
    return 'No se encontraron documentos indexados activos ni evidencias asociadas suficientes.';
  }

  if (activeCount === 0 && candidateCount > 0) {
    return 'Existen evidencias candidatas o sugeridas, pero aun no hay asociacion activa revisada por una persona.';
  }

  return 'La evidencia existente requiere revision para confirmar suficiencia, vigencia y trazabilidad.';
}

function buildGapSummary(input = {}, primaryContext = null) {
  if (input.gap_summary) return String(input.gap_summary);

  const process = input.process_name || input.process || input.operation_name || input.operation || 'el proceso evaluado';
  const context = primaryContext?.context || 'la evidencia esperada';

  if (Number(input.active_evidence_count || 0) === 0) {
    return `No existe trazabilidad suficiente para demostrar ${context} en ${process}.`;
  }

  return `La cobertura documental para ${context} en ${process} es parcial y requiere evidencia complementaria.`;
}

function buildRecommendationPayload(input = {}) {
  const selected = selectCatalogEntries(input, Number(input.limit || 3));
  const existingNames = existingEvidenceNames(input);
  const recommended = [];

  for (const { entry, score } of selected) {
    for (const evidence of entry.recommendedEvidence || []) {
      recommended.push({
        ...evidence,
        related_process: evidence.related_process || input.process_name || input.operation_name || null,
        confidence: confidenceFromScore(score),
        reasoning_summary: missingReason(input),
        source: {
          type: 'deterministic_catalog',
          catalog_context: entry.context,
          control_clause: input.clause || null,
          control_id: input.control_id || input.tenant_control_id || null,
          document_related: null,
          fragment: Number(input.active_evidence_count || 0) > 0
            ? `Evidencias existentes detectadas: ${existingNames.join(', ')}`
            : 'No se encontraron documentos indexados o evidencias asociadas suficientes.',
        },
      });
    }
  }

  return {
    gap_summary: buildGapSummary(input, selected[0]?.entry || null),
    existing_evidence_summary: existingNames,
    recommended_evidence: recommended.slice(0, Number(input.max_recommendations || 5)),
    suggested_gap: {
      title: input.suggested_gap_title || 'Evidencia insuficiente para demostrar trazabilidad del control',
      description: buildGapSummary(input, selected[0]?.entry || null),
      severity: input.criticality || input.priority || 'media',
      requires_human_acceptance: true,
    },
    suggested_action: {
      title: input.suggested_action_title || 'Cargar evidencia recomendada y asociarla al control',
      description: recommended[0]?.suggested_action || 'Revisar evidencia disponible, cargar respaldo vigente y asociarlo al control correspondiente.',
      owner_role: recommended[0]?.owner_role || null,
      frequency: recommended[0]?.frequency || null,
      requires_human_acceptance: true,
    },
    governance_notice: 'Salida deterministica de apoyo. No aprueba cumplimiento, no certifica y requiere revision humana.',
  };
}

module.exports = {
  buildRecommendationPayload,
  selectCatalogEntries,
};
