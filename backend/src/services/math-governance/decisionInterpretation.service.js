'use strict';

const DOMAIN_ACTIONS = Object.freeze({
  compliance: { route: '/cumplimiento', label: 'Revisar cumplimiento', recommendation: 'Priorizar controles no conformes, evaluaciones pendientes y evidencia faltante.' },
  readiness: { route: '/grc', label: 'Revisar readiness', recommendation: 'Cerrar las dimensiones con menor puntuación antes de la siguiente revisión de gestión.' },
  risk: { route: '/riesgos', label: 'Revisar riesgos', recommendation: 'Revisar riesgos altos y críticos, confirmar responsables y actualizar tratamientos.' },
  control: { route: '/cumplimiento', label: 'Revisar controles', recommendation: 'Validar diseño, implementación, operación y evidencia de los controles con menor efectividad.' },
  assurance: { route: '/auditorias', label: 'Revisar assurance', recommendation: 'Analizar pruebas fallidas y generar acciones correctivas con responsable y fecha objetivo.' },
  findings: { route: '/planes-accion', label: 'Revisar hallazgos', recommendation: 'Atender primero hallazgos críticos, altos y vencidos.' },
  actions: { route: '/planes-accion', label: 'Gestionar planes', recommendation: 'Reasignar acciones atrasadas y confirmar fechas objetivo realistas.' },
  loss: { route: '/eventos-perdida', label: 'Revisar pérdidas', recommendation: 'Analizar eventos de mayor severidad y reforzar controles preventivos y de recuperación.' },
  continuity: { route: '/continuidad', label: 'Revisar continuidad', recommendation: 'Corregir brechas de RTO/RPO y repetir pruebas que no alcanzaron los objetivos.' },
  supplier: { route: '/proveedores', label: 'Revisar terceros', recommendation: 'Priorizar proveedores críticos con baja evaluación o alta dependencia.' },
  survey: { route: '/encuestas', label: 'Revisar encuestas', recommendation: 'Mejorar cobertura y consistencia antes de usar el resultado para decisiones.' },
  data: { route: '/datos', label: 'Revisar datos', recommendation: 'Corregir completitud, vigencia, consistencia y trazabilidad de los datos fuente.' },
  health: { route: '/dashboard', label: 'Abrir dashboard', recommendation: 'Actuar sobre los dominios que más reducen la salud GRC general.' },
  maturity: { route: '/grc', label: 'Revisar madurez', recommendation: 'Definir iniciativas para avanzar al siguiente nivel de madurez verificable.' },
  general: { route: '/dashboard', label: 'Abrir dashboard', recommendation: 'Revisar los registros que explican el indicador y asignar una acción cuando corresponda.' },
});

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedPercent(value, unit) {
  const number = numeric(value);
  if (number === null) return null;
  if (unit === '%') return number;
  if (unit === 'ratio') return number <= 1 ? number * 100 : number;
  return null;
}

function directionFor(formulaCode, domain) {
  const negativeTokens = ['RISK', 'LOSS', 'FAILURE', 'OVERDUE', 'AGE', 'MTTC', 'MTTR', 'GAP', 'DROPOUT', 'SEVERITY', 'RPN'];
  if (negativeTokens.some((token) => String(formulaCode).includes(token))) return 'lower_is_better';
  if (['risk', 'loss', 'findings'].includes(domain)) return 'lower_is_better';
  return 'higher_is_better';
}

function bandFor({ value, unit, formulaCode, domain }) {
  const n = numeric(value);
  if (n === null) return { code: 'unavailable', label: 'Sin resultado', severity: 'gray' };
  const direction = directionFor(formulaCode, domain);
  const percent = normalizedPercent(n, unit);
  if (percent !== null) {
    if (direction === 'lower_is_better') {
      if (percent <= 10) return { code: 'controlled', label: 'Controlado', severity: 'green' };
      if (percent <= 25) return { code: 'attention', label: 'Atención', severity: 'amber' };
      return { code: 'critical', label: 'Crítico', severity: 'red' };
    }
    if (percent >= 80) return { code: 'healthy', label: 'Saludable', severity: 'green' };
    if (percent >= 60) return { code: 'attention', label: 'Requiere atención', severity: 'amber' };
    return { code: 'critical', label: 'Crítico', severity: 'red' };
  }
  if (domain === 'risk') {
    if (n >= 15) return { code: 'critical', label: 'Alto o crítico', severity: 'red' };
    if (n >= 8) return { code: 'attention', label: 'Medio', severity: 'amber' };
    return { code: 'controlled', label: 'Bajo', severity: 'green' };
  }
  return { code: 'informative', label: 'Informativo', severity: 'blue' };
}

function trend(previousValue, currentValue, direction) {
  const previous = numeric(previousValue);
  const current = numeric(currentValue);
  if (previous === null || current === null) return { previous_value: previous, delta: null, direction: 'unknown', label: 'Sin período comparable' };
  const delta = current - previous;
  if (Math.abs(delta) < 0.000001) return { previous_value: previous, delta: 0, direction: 'stable', label: 'Sin variación' };
  const improved = direction === 'lower_is_better' ? delta < 0 : delta > 0;
  return { previous_value: previous, delta, direction: improved ? 'improving' : 'worsening', label: improved ? 'Mejora' : 'Deterioro' };
}

function buildDecision({ formula, value, unit, source, previousValue = null, details = {} }) {
  const domain = formula.category || 'general';
  const action = DOMAIN_ACTIONS[domain] || DOMAIN_ACTIONS.general;
  const band = bandFor({ value, unit, formulaCode: formula.formula_code, domain });
  const direction = directionFor(formula.formula_code, domain);
  const received = Number(source?.counts?.received || 0);
  const usable = Number(source?.counts?.usable || 0);
  const excluded = Number(source?.counts?.excluded || 0);
  const coverage = received > 0 ? Math.round((usable / received) * 10000) / 100 : null;
  const cause = usable > 0
    ? `El resultado utiliza ${usable} de ${received} registros disponibles${excluded ? ` y excluye ${excluded}` : ''}.`
    : 'No existen registros utilizables para sustentar una decisión.';
  const impact = band.severity === 'red'
    ? 'La condición puede afectar objetivos, cumplimiento, exposición al riesgo o continuidad del negocio y requiere tratamiento prioritario.'
    : band.severity === 'amber'
      ? 'La condición requiere seguimiento y acciones preventivas para evitar deterioro.'
      : band.severity === 'green'
        ? 'La condición está dentro de un rango controlado, pero debe mantenerse bajo seguimiento.'
        : 'El resultado es informativo y debe interpretarse junto con su contexto operacional.';

  return {
    result: { value: numeric(value), unit: unit || '', display: numeric(value) === null ? 'Sin resultado' : `${value}${unit ? ` ${unit}` : ''}` },
    interpretation: { ...band, direction },
    cause,
    impact,
    recommendation: action.recommendation,
    action: { route: action.route, label: action.label, can_create_plan: ['red', 'amber'].includes(band.severity) },
    data_quality: { received, usable, excluded, coverage_pct: coverage, physical_sources: source?.physical_sources || [] },
    trend: trend(previousValue, value, direction),
    owner: details.owner || null,
    target_date: details.target_date || null,
  };
}

module.exports = { DOMAIN_ACTIONS, numeric, directionFor, bandFor, buildDecision };
