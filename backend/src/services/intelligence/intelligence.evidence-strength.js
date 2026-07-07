function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value) {
  return String(value || '').toLowerCase().trim();
}

function hasAny(row, fields) {
  return fields.some((field) => Boolean(row?.[field]));
}

function ageDays(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function evidenceMatchesExpected(evidence = {}) {
  const expectations = asArray(evidence.expected_evidence);
  if (!expectations.length) return true;
  const text = lower([
    evidence.title,
    evidence.name,
    evidence.description,
    evidence.file_name,
    evidence.document_title,
    evidence.type,
    evidence.evidence_type,
  ].filter(Boolean).join(' '));
  if (!text) return false;
  return expectations.some((item) => {
    const expected = lower(item.expectation_text || item.intent_summary || item.title || item.domain);
    if (!expected) return false;
    return expected.split(/\s+/).filter((token) => token.length > 5).some((token) => text.includes(token));
  });
}

function calculateEvidenceStrength(evidence = {}) {
  if (!evidence || Object.keys(evidence).length === 0) {
    return {
      state: 'ausente',
      score: 0,
      reasons: ['No existe evidencia evaluable.'],
      matches_expected_evidence: false,
    };
  }

  let score = 15;
  const reasons = ['Evidencia registrada en el tenant.'];

  if (hasAny(evidence, ['tenant_control_id', 'control_id', 'control_code'])) {
    score += 20;
    reasons.push('Asociada a control.');
  }
  if (hasAny(evidence, ['process_id', 'operation_id', 'risk_id', 'audit_id'])) {
    score += 15;
    reasons.push('Asociada a proceso, riesgo u auditoria.');
  }
  if (hasAny(evidence, ['owner_id', 'owner', 'responsible_id', 'responsible'])) {
    score += 10;
    reasons.push('Tiene responsable u owner.');
  }

  const status = lower(evidence.status || evidence.approval_status || evidence.review_status);
  if (['aprobada', 'aprobado', 'approved', 'validada', 'validated'].includes(status)) {
    score += 15;
    reasons.push('Tiene aprobacion o validacion.');
  } else if (['rechazada', 'rejected', 'observada'].includes(status)) {
    score -= 15;
    reasons.push('Estado observado o rechazado.');
  }

  const days = ageDays(evidence.updated_at || evidence.reviewed_at || evidence.created_at || evidence.uploaded_at);
  if (days !== null && days <= 365) {
    score += 10;
    reasons.push('Evidencia vigente.');
  } else if (days !== null && days > 365) {
    score -= 10;
    reasons.push('Evidencia antigua o sin revision reciente.');
  }

  const matchesExpected = evidenceMatchesExpected(evidence);
  if (matchesExpected) {
    score += 15;
    reasons.push('Coincide con expected_evidence KB o no hay expectativa especifica.');
  } else {
    score -= 20;
    reasons.push('No coincide con expected_evidence KB.');
  }

  const bounded = Math.max(0, Math.min(100, score));
  const state = bounded >= 80
    ? 'fuerte'
    : bounded >= 60
      ? 'suficiente'
      : bounded > 0
        ? 'débil'
        : 'ausente';

  return {
    state,
    score: bounded,
    reasons,
    matches_expected_evidence: matchesExpected,
  };
}

function summarizeEvidenceStrength(evidences = []) {
  const results = asArray(evidences).map((evidence) => ({
    evidence,
    strength: calculateEvidenceStrength(evidence),
  }));
  if (!results.length) {
    return {
      average_score: 0,
      state: 'ausente',
      weak_count: 0,
      absent_count: 1,
      results,
    };
  }
  const average = Math.round(results.reduce((sum, item) => sum + item.strength.score, 0) / results.length);
  return {
    average_score: average,
    state: average >= 80 ? 'fuerte' : average >= 60 ? 'suficiente' : average > 0 ? 'débil' : 'ausente',
    weak_count: results.filter((item) => item.strength.state === 'débil').length,
    absent_count: results.filter((item) => item.strength.state === 'ausente').length,
    results,
  };
}

module.exports = {
  calculateEvidenceStrength,
  evidenceMatchesExpected,
  summarizeEvidenceStrength,
};
