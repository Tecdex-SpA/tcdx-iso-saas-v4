'use strict';

const { checksum } = require('./indicatorCore');

const RAW_CATALOG = [
  ['GRC-HEALTH','Salud GRC','health','Síntesis de exposición GRC, cumplimiento, acciones, controles, evidencia y confianza.','Controlar la exposición GRC con una lectura reproducible.','score','higher_is_better','monthly','Componentes GRC con snapshot oficial.','F5_5_GRC_HEALTH','operational',0.80],
  ['ISO-READINESS','Preparación del sistema ISO','readiness','Preparación documentada para evaluación, sin afirmar certificación.','Priorizar brechas materiales de preparación.','%','higher_is_better','monthly','Requisitos aplicables, evaluaciones, evidencia, hallazgos y acciones.','F5_5_READINESS','compliance',0.85],
  ['COMPLIANCE','Cumplimiento evaluado','compliance','Proporción ponderada de requisitos aplicables evaluados como conformes.','Gestionar brechas de cumplimiento con evidencia.','%','higher_is_better','monthly','Requisitos aplicables con evaluación válida.','F5_5_COMPLIANCE_WEIGHTED','compliance',0.80],
  ['COVERAGE','Cobertura de evaluación','compliance','Proporción del universo aplicable que cuenta con evaluación válida.','Evitar conclusiones sobre universos insuficientemente evaluados.','%','higher_is_better','weekly','Universo aplicable validado, excluyendo no aplica aprobado.','F5_5_COVERAGE','kqi',0.80],
  ['RISK-INHERENT','Riesgo inherente','risk','Exposición anterior a controles bajo metodología publicada.','Mantener la exposición base dentro del apetito definido.','score','lower_is_better','monthly','Riesgos con probabilidad e impacto válidos.','F5_5_INHERENT_RISK','kri',1],
  ['RISK-RESIDUAL','Riesgo residual','risk','Exposición remanente después de efectividad de controles demostrada.','Confirmar que la mitigación reduce el riesgo dentro del apetito.','score','lower_is_better','monthly','Riesgos con controles y efectividad oficial.','F5_5_RESIDUAL_RISK','kri',0.80],
  ['CONTROL-EFFECT','Efectividad de controles','control','Efectividad de diseño, implementación, operación y evidencia.','Fortalecer controles degradados y verificar su operación.','%','higher_is_better','monthly','Controles activos con evidencia y assurance aplicables.','F5_5_CONTROL_EFFECTIVENESS','kci',0.80],
  ['EVIDENCE-FRESH','Evidencia vigente','evidence','Cobertura y vigencia de la evidencia requerida.','Mantener evidencia aprobada y vigente.','%','higher_is_better','daily','Relaciones de evidencia requeridas y su fecha efectiva.','F5_5_FRESHNESS_CONTINUOUS','kqi',0.90],
  ['REMEDIATION','Remediación efectiva','actions','Progreso ponderado y verificado de remediaciones.','Reducir brechas dentro de plazo y con re-test.','%','higher_is_better','weekly','Acciones con owner, plazo, evidencia y verificación.','F5_5_WEIGHTED_PROGRESS','operational',1],
  ['FINDINGS','Exposición por hallazgos','findings','Severidad y exposición asociada a hallazgos vigentes.','Eliminar hallazgos críticos vencidos.','index','lower_is_better','weekly','Hallazgos clasificados con fechas y estado.','F5_5_SEVERITY_INDEX','kri',1],
  ['ACTIONS','Ejecución de acciones','actions','Progreso ponderado de acciones con cierre verificable.','Ejecutar y cerrar acciones oportunamente.','%','higher_is_better','weekly','Acciones con owner, fechas, estado y evidencia.','F5_5_WEIGHTED_PROGRESS','operational',1],
  ['AUDIT-ASSURANCE','Cobertura de assurance','assurance','Resultado ponderado de pruebas con muestra, excepciones y evidencia.','Aumentar confianza en la operación de controles.','%','higher_is_better','on_demand','Ejecuciones de assurance concluyentes y revisadas.','F5_5_ASSURANCE_SCORE','audit',1],
  ['SUPPLIER-RISK','Riesgo de proveedores','supplier','Exposición de terceros por criticidad, seguridad, privacidad y resiliencia.','Mantener terceros dentro del apetito aprobado.','score','lower_is_better','monthly','Proveedores críticos con evaluación vigente.','F5_5_SUPPLIER_RISK','supplier',0.80],
  ['CONTINUITY','Resiliencia operativa','continuity','Cumplimiento de objetivos de servicio y recuperación.','Demostrar recuperación dentro de SLA, RTO y RPO.','%','higher_is_better','monthly','Servicios con objetivos, incidentes y pruebas vigentes.','F5_5_SLA_COMPLIANCE','continuity',0.80],
  ['INCIDENTS','Gestión de incidentes','incidents','Exposición por severidad de incidentes durante el período.','Contener incidentes críticos y prevenir reincidencia.','index','lower_is_better','daily','Incidentes clasificados con owner, timeline y estado.','F5_5_SEVERITY_INDEX','security',1],
  ['LOSSES','Exposición por pérdidas','loss','Pérdida neta confirmada por moneda y período.','Reducir pérdida neta y concentración de eventos.','currency','lower_is_better','monthly','Eventos confirmados y recuperaciones de una misma moneda.','F5_5_NET_LOSS','kri',0.90],
  ['DATA-TRUST','Confianza del dato','data_quality','Confianza compuesta desde ocho dimensiones verificables.','Habilitar decisiones sustentadas por evidencia trazable.','score','higher_is_better','on_demand','Evaluaciones por dimensión con evidencia y política publicada.','F5_C3_DATA_TRUST','data_quality',1],
  ['MATURITY','Madurez de gestión','maturity','Nivel de institucionalización de prácticas y evidencia.','Avanzar capacidades prioritarias bajo modelo publicado.','level','higher_is_better','quarterly','Assessments vigentes con evidencia suficiente.','F5_5_MATURITY','operational',0.80],
  ['OP-PERFORMANCE','Desempeño operacional','operations','Desempeño compuesto oficial de eficacia, estabilidad, calidad, riesgo y cumplimiento.','Actuar sobre el componente causal de degradación.','score','higher_is_better','monthly','Componentes operacionales oficiales compatibles.','F5_C3_OPERATIONAL_PERFORMANCE','operational',0.80],
  ['CONTROL-COVERAGE','Cobertura de controles','control','Riesgos y requisitos relevantes con control activo aplicable.','Eliminar exposición sin mitigación asignada.','%','higher_is_better','monthly','Universo de riesgos/requisitos y controles vinculados.','F5_5_CONTROL_COVERAGE','kci',0.95],
  ['SLA-COMPLIANCE','Cumplimiento de SLA','continuity','Casos aplicables resueltos dentro del compromiso y timezone publicados.','Cumplir compromisos de servicio.','%','higher_is_better','daily','Casos con objetivo, calendario, timezone y resolución.','F5_5_SLA_COMPLIANCE','sla',1],
  ['SUPPLIER-HEALTH','Salud de proveedores','supplier','Salud del portafolio de terceros desde componentes oficiales disponibles.','Mantener el portafolio de terceros estable y controlado.','score','higher_is_better','monthly','Proveedores con riesgo, desempeño y assurance compatibles.','F5_C3_SUPPLIER_HEALTH','supplier',0.80],
];

function bands(direction, unit) {
  if (direction === 'lower_is_better') return [
    { key: 'positive', label: 'Controlado', operator: 'less_or_equal', min: null, max: 25, result: 'good', positive: true },
    { key: 'attention', label: 'Requiere atención', operator: 'between', min: 25.000001, max: 60, result: 'warning', positive: false },
    { key: 'critical', label: 'Crítico', operator: 'greater_than', min: 60.000001, max: null, result: 'critical', positive: false },
  ];
  const scale = unit === 'level' ? [3.5, 2] : [80, 60];
  return [
    { key: 'critical', label: 'Crítico', operator: 'less_than', min: null, max: scale[1] - 0.000001, result: 'critical', positive: false },
    { key: 'attention', label: 'Requiere atención', operator: 'between', min: scale[1], max: scale[0] - 0.000001, result: 'warning', positive: false },
    { key: 'positive', label: 'Objetivo alcanzado', operator: 'greater_or_equal', min: scale[0], max: null, result: 'good', positive: true },
  ];
}

const FUNCTIONAL_INDICATORS = Object.freeze(RAW_CATALOG.map((row) => {
  const [functional_code,display_name,domain,business_definition,objective,unit,direction,frequency,population_definition,formula_code,metric_type,minimum_coverage] = row;
  const definition = {
    functional_code, display_name, domain, business_definition, objective, unit, direction, frequency,
    population_definition, formula_code, metric_type, minimum_coverage,
    methodology: `Resultado oficial ${formula_code}; ausencia, incompatibilidad o insuficiencia permanecen estados no numéricos.`,
    threshold_bands: bands(direction, unit), version_number: 1,
  };
  return Object.freeze({ ...definition, checksum: checksum(definition) });
}));

module.exports = { FUNCTIONAL_INDICATORS };
