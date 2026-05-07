'use strict';

const { sanitizePdfText } = require('./reportTextSanitizer.helpers');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStandardCode(value) {
  const raw = sanitizePdfText(value)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/ISO\/IEC/g, 'ISO')
    .replace(/ISO-/g, 'ISO')
    .replace(/:/g, '');

  if (raw.includes('27001')) return 'ISO27001';
  if (raw.includes('9001')) return 'ISO9001';
  if (raw.includes('42001')) return 'ISO42001';
  if (raw.includes('14001')) return 'ISO14001';
  if (raw.includes('20000')) return 'ISO20000';
  if (raw.includes('27017')) return 'ISO27017';
  if (raw.includes('27018')) return 'ISO27018';

  return raw || '';
}

function getStandardContext(data = {}) {
  const metadata = asObject(data.metadata);
  const standardContext = data.standard_context || null;
  const profileContext =
    data.profile_context ||
    metadata.profile_context ||
    standardContext?.profile_context ||
    null;

  const metrics = standardContext?.metrics || metadata.coverage_metrics || {};

  const standardCode = normalizeStandardCode(
    standardContext?.standard_code ||
    metadata.standard_code ||
    data.standard_code ||
    profileContext?.standard_code ||
    ''
  );

  const versionCode = sanitizePdfText(
    standardContext?.version_code ||
    metadata.version_code ||
    data.version_code ||
    profileContext?.version_code ||
    ''
  );

  const displayName =
    sanitizePdfText(
      standardContext?.display_name ||
      metadata.standard_label ||
      profileContext?.display_name ||
      ''
    ) ||
    (standardCode && versionCode ? `${standardCode}:${versionCode}` : 'Norma ISO');

  return {
    standardCode,
    versionCode,
    displayName,
    coverageStatus: standardContext?.coverage_status || metadata.coverage_status || '',
    coverageLabel: standardContext?.coverage_label || metadata.coverage_label || '',
    coverageSeverity: standardContext?.coverage_severity || metadata.coverage_severity || '',
    profileContext,
    metrics,
    warnings: asArray(standardContext?.warnings).length
      ? asArray(standardContext.warnings)
      : asArray(metadata.coverage_warnings),
  };
}

function itemStandardCode(item = {}) {
  return normalizeStandardCode(
    item.standard_code ||
    item.iso_code ||
    item.iso ||
    item.standard ||
    item.norma ||
    item.standard_name ||
    item.name ||
    item.code ||
    ''
  );
}

function matchesSelectedStandard(item, selectedStandardCode) {
  const selected = normalizeStandardCode(selectedStandardCode);

  if (!selected) return true;

  const itemCode = itemStandardCode(item);

  if (!itemCode) return true;

  return itemCode === selected;
}

function filterBySelectedStandard(items, data) {
  const selected = getStandardContext(data).standardCode;
  return asArray(items).filter((item) => matchesSelectedStandard(item, selected));
}

function getScopedArray(data, keys = []) {
  for (const key of keys) {
    const direct = data?.[key];
    if (Array.isArray(direct)) return filterBySelectedStandard(direct, data);

    const filtered = data?.filtered?.[key];
    if (Array.isArray(filtered)) return filterBySelectedStandard(filtered, data);

    const scoped = data?.standard_scoped?.[key];
    if (Array.isArray(scoped)) return filterBySelectedStandard(scoped, data);
  }

  return [];
}

function buildScopedStats(data = {}) {
  const standard = getStandardContext(data);
  const m = standard.metrics || {};
  const stats = data.stats || {};

  const controls = {
    ...(stats.controls || {}),
    total_controls: toNumber(m.tenant_controls_count, stats.controls?.total_controls || 0),
    evaluated_controls: toNumber(m.health_records_count, stats.controls?.evaluated_controls || stats.controls?.total_controls || 0),
    average_score: toNumber(m.avg_health_score, stats.controls?.average_score || stats.controls?.score || 0),
    score: toNumber(m.avg_health_score, stats.controls?.score || 0),
    healthy_controls: toNumber(m.healthy_controls_count, stats.controls?.healthy_controls || 0),
    warning_controls: toNumber(m.attention_controls_count, stats.controls?.warning_controls || 0),
    critical_controls: toNumber(m.deteriorated_controls_count, stats.controls?.critical_controls || 0),
  };

  const evidences = {
    ...(stats.evidences || {}),
    total_evidences: toNumber(m.evidence_count, stats.evidences?.total_evidences || 0),
    approved_evidences: toNumber(m.approved_evidence_count, stats.evidences?.approved_evidences || 0),
    pending_evidences: toNumber(m.pending_evidence_count, stats.evidences?.pending_evidences || 0),
    expired_evidences: toNumber(m.expired_evidence_count, stats.evidences?.expired_evidences || 0),
    expected_evidences: toNumber(m.expected_evidence_count, stats.evidences?.expected_evidences || 0),
  };

  return {
    ...stats,
    controls,
    evidences,
    findings: {
      ...(stats.findings || {}),
      open_findings: filterBySelectedStandard(
        asArray(data.findings || data.open_findings || data.recent_findings),
        data
      ).length || toNumber(stats.findings?.open_findings, 0),
    },
    actions: {
      ...(stats.action_plans || stats.actions || {}),
      open_actions: toNumber(stats.action_plans?.open_actions || stats.actions?.open_actions, 0),
      overdue_actions: toNumber(stats.action_plans?.overdue_actions || stats.actions?.overdue_actions, 0),
    },
    risks: {
      ...(stats.risks || {}),
      total_risks: toNumber(stats.risks?.total_risks, 0),
      critical_risks: toNumber(stats.risks?.critical_risks, 0),
      high_risks: toNumber(stats.risks?.high_risks, 0),
    },
  };
}

function getIsoNormativeProfile(data = {}) {
  const standard = getStandardContext(data);
  const code = standard.standardCode;

  if (code === 'ISO27001') {
    return {
      label: 'ISO/IEC 27001:2022',
      managementSystem: 'Sistema de Gestión de Seguridad de la Información',
      auditCriteria: [
        'Alcance del SGSI',
        'Evaluación y tratamiento de riesgos',
        'Declaración de Aplicabilidad (SoA)',
        'Controles Anexo A',
        'Inventario y propiedad de activos',
        'Control de accesos',
        'Continuidad operacional',
        'Incidentes y proveedores',
      ],
      maturityFocus:
        'La madurez debe medirse por capacidad de controlar riesgos de confidencialidad, integridad y disponibilidad con SoA vigente, evidencias técnicas y tratamiento trazable.',
      riskFallbacks: [
        {
          id: 'R-01',
          title: 'Acceso no autorizado a información crítica',
          asset: 'Identidades, accesos y datos sensibles',
          probability: 4,
          impact: 5,
          inherent: 20,
          residual: 15,
          level: 'Alto',
          treatment: 'Mitigar',
          owner: 'Responsable de Seguridad',
        },
        {
          id: 'R-02',
          title: 'Indisponibilidad de servicios críticos',
          asset: 'Infraestructura y continuidad',
          probability: 3,
          impact: 5,
          inherent: 15,
          residual: 12,
          level: 'Alto',
          treatment: 'Mitigar',
          owner: 'TI / Continuidad',
        },
        {
          id: 'R-03',
          title: 'Evidencia insuficiente para controles Anexo A',
          asset: 'SoA y controles técnicos',
          probability: 4,
          impact: 4,
          inherent: 16,
          residual: 12,
          level: 'Alto',
          treatment: 'Mitigar',
          owner: 'Responsable SGSI',
        },
      ],
      actionFallbacks: [
        'Actualizar Declaración de Aplicabilidad (SoA) y justificar controles aplicables/no aplicables.',
        'Revisar propietarios de activos críticos y evidencias técnicas asociadas.',
        'Actualizar matriz de riesgos de seguridad de la información.',
        'Verificar controles de acceso, backups, continuidad, incidentes y proveedores.',
        'Cerrar evidencias pendientes del Anexo A con responsable y periodo cubierto.',
      ],
      auditKpis: [
        'Controles Anexo A revisados',
        'Evidencias técnicas revisadas',
        'Riesgos con tratamiento',
        'No conformidades SGSI',
      ],
    };
  }

  if (code === 'ISO9001') {
    return {
      label: 'ISO 9001:2015',
      managementSystem: 'Sistema de Gestión de la Calidad',
      auditCriteria: [
        'Contexto de la organización',
        'Liderazgo',
        'Planificación',
        'Soporte',
        'Operación',
        'Evaluación del desempeño',
        'Mejora',
        'Satisfacción del cliente',
        'No conformidades y acciones correctivas',
      ],
      maturityFocus:
        'La madurez debe medirse por control de procesos, objetivos de calidad, satisfacción del cliente, no conformidades, acciones correctivas y mejora continua.',
      riskFallbacks: [
        {
          id: 'R-01',
          title: 'Incumplimiento de requisitos del cliente',
          asset: 'Procesos de entrega y satisfacción',
          probability: 4,
          impact: 4,
          inherent: 16,
          residual: 12,
          level: 'Alto',
          treatment: 'Mitigar',
          owner: 'Responsable de Calidad',
        },
        {
          id: 'R-02',
          title: 'Proceso crítico sin control o medición suficiente',
          asset: 'Procesos operacionales',
          probability: 4,
          impact: 3,
          inherent: 12,
          residual: 9,
          level: 'Medio',
          treatment: 'Mitigar',
          owner: 'Dueño de proceso',
        },
        {
          id: 'R-03',
          title: 'No conformidad recurrente sin acción correctiva eficaz',
          asset: 'Mejora continua',
          probability: 3,
          impact: 4,
          inherent: 12,
          residual: 9,
          level: 'Medio',
          treatment: 'Mitigar',
          owner: 'Responsable SGC',
        },
      ],
      actionFallbacks: [
        'Actualizar matriz de procesos, responsables e indicadores de desempeño.',
        'Revisar objetivos de calidad y evidencia de seguimiento.',
        'Cerrar no conformidades abiertas con análisis de causa y acción correctiva.',
        'Medir satisfacción del cliente y documentar resultados.',
        'Actualizar control documental del SGC y registros críticos.',
      ],
      auditKpis: [
        'Procesos auditados',
        'Registros de calidad revisados',
        'No conformidades',
        'Acciones correctivas',
      ],
    };
  }

  return {
    label: standard.displayName,
    managementSystem: standard.profileContext?.management_system || 'Sistema de Gestión',
    auditCriteria: [
      'Alcance del sistema de gestión',
      'Requisitos aplicables',
      'Controles definidos',
      'Evidencia objetiva',
      'Seguimiento y mejora',
    ],
    maturityFocus:
      'La madurez debe evaluarse según requisitos aplicables, controles definidos, evidencia objetiva y mejora continua.',
    riskFallbacks: [
      {
        id: 'R-01',
        title: 'Riesgo de incumplimiento de requisitos aplicables',
        asset: 'Sistema de gestión',
        probability: 3,
        impact: 4,
        inherent: 12,
        residual: 9,
        level: 'Medio',
        treatment: 'Mitigar',
        owner: 'Responsable ISO',
      },
    ],
    actionFallbacks: [
      'Regularizar evidencias pendientes.',
      'Asignar responsables por control.',
      'Actualizar plan de acción y fechas de cierre.',
    ],
    auditKpis: [
      'Controles revisados',
      'Evidencias revisadas',
      'Hallazgos',
      'Acciones de cierre',
    ],
  };
}

function getScopedEvidences(data) {
  return getScopedArray(data, ['evidences', 'recent_evidences', 'evidence_rows']);
}

function getScopedFindings(data) {
  return getScopedArray(data, ['findings', 'open_findings', 'recent_findings']);
}

function getScopedActions(data) {
  return getScopedArray(data, ['action_plans', 'actions', 'recommended_actions', 'open_actions']);
}

function getScopedAudits(data) {
  return getScopedArray(data, ['audits', 'audit_rows', 'recent_audits']);
}

function getScopedLifecycle(data) {
  return getScopedArray(data, ['lifecycle', 'lifecycle_rows', 'lifecycle_events']);
}

module.exports = {
  asArray,
  asObject,
  toNumber,
  normalizeStandardCode,
  getStandardContext,
  itemStandardCode,
  matchesSelectedStandard,
  filterBySelectedStandard,
  getScopedArray,
  getScopedEvidences,
  getScopedFindings,
  getScopedActions,
  getScopedAudits,
  getScopedLifecycle,
  buildScopedStats,
  getIsoNormativeProfile,
};
