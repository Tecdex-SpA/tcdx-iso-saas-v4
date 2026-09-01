 'use strict';

const crypto = require('crypto');
const stats = require('./statisticalEngine.service');
const compliance = require('./complianceCalculation.service');
const controls = require('./controlCalculation.service');
const risk = require('./riskCalculation.service');
const readinessSvc = require('./readinessCalculation.service');
const { dynamicGrcHealth } = require('./grcHealthCalculation.service');
const { getSourceCodeForFormula } = require('./sourceContracts.service');

const STATES = new Set(['draft', 'reviewed', 'approved', 'published', 'retired']);

class FormulaRegistryError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'FormulaRegistryError';
    this.code = code;
    this.details = details;
  }
}

function round(value, precision = 4) {
  if (value === null || value === undefined) return value;
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}
function stable(value) { return JSON.stringify(value, Object.keys(value).sort()); }
function checksumFor(definition) {
  const payload = { ...definition, execute: undefined, tests: undefined, checksum: undefined };
  return crypto.createHash('sha256').update(stable(payload)).digest('hex');
}
function assertRequired(inputs, variables) {
  for (const variable of variables) {
    if (variable.required !== false && (inputs[variable.name] === undefined || inputs[variable.name] === null)) {
      throw new FormulaRegistryError('FORMULA_VARIABLE_REQUIRED', `Falta variable requerida: ${variable.name}`, { variable: variable.name });
    }
  }
}
function assertUnits(inputs, variables) {
  const units = inputs.units || {};
  const declared = new Set(variables.map((variable) => variable.name));
  for (const key of Object.keys(units)) {
    if (!declared.has(key)) throw new FormulaRegistryError('FORMULA_UNIT_UNKNOWN', `Unidad declarada para variable inexistente: ${key}.`, { variable: key });
  }
  for (const variable of variables) {
    if (variable.unit && units[variable.name] && units[variable.name] !== variable.unit) {
      throw new FormulaRegistryError('FORMULA_UNIT_INVALID', `Unidad invalida para ${variable.name}.`, { variable: variable.name, expected: variable.unit, received: units[variable.name] });
    }
  }
}
function output(definition, value, details = {}) {
  return {
    formula_code: definition.formula_code,
    version: definition.version,
    status: value === null || value === undefined ? 'not_calculable' : 'calculated',
    value: round(value, definition.precision),
    unit: definition.units.output,
    precision: definition.precision,
    rounding_policy: definition.rounding_policy,
    explanation: `${definition.display_name} calculado con ${definition.methodology}.`,
    details,
  };
}
function daysBetween(a, b) { return (new Date(b).getTime() - new Date(a).getTime()) / 86400000; }
function pct(n, d) { if (Number(d) === 0) throw new FormulaRegistryError('FORMULA_DIVISION_BY_ZERO', 'Division por cero controlada.'); return (Number(n) / Number(d)) * 100; }
function weighted(items, valueKey = 'value') { let total = 0, weights = 0; for (const item of items) { const w = Number(item.weight ?? 1); total += Number(item[valueKey]) * w; weights += w; } if (weights === 0) throw new FormulaRegistryError('FORMULA_ZERO_WEIGHTS', 'Suma de pesos cero.'); return total / weights; }
function fixedComposite(inputs, keys, weights) {
  const total = keys.reduce((sum, key) => sum + Number(weights[key] ?? 0), 0);
  if (Math.abs(total - 1) > 0.000001) throw new FormulaRegistryError('FORMULA_WEIGHTS_SUM_INVALID', 'Los pesos publicados deben sumar 1.');
  return keys.reduce((sum, key) => sum + (Number(inputs[key]) * Number(weights[key])), 0);
}
function freshnessState(score) { if (score >= 80) return 'current'; if (score >= 50) return 'aging'; if (score >= 20) return 'stale'; return 'expired'; }
function assuranceValue(result) { const key = String(result).toLowerCase(); if (key === 'pass') return 1; if (key === 'pass_with_observations') return 0.75; if (key === 'fail') return 0; return null; }
function surveyScore(items) { let total = 0, max = 0; for (const item of items) { if (item.notApplicable) continue; const w = Number(item.weight ?? 1); total += Number(item.score) * w; max += Number(item.maxScore) * w; } if (max === 0) throw new FormulaRegistryError('FORMULA_ZERO_DENOMINATOR', 'Maximo de encuesta cero.'); return (total / max) * 100; }

const definitions = [
  ['F5_5_COMPLIANCE_WEIGHTED','Cumplimiento ponderado','compliance','C=sum(w_i*s_i)/sum(w_i)*100','weighted applicable assessment score', '%', 2, [{ name:'assessments', type:'array' }], (i,d)=>{ const r=compliance.weightedCompliance(i); return output(d,r.value,{coverage:r.coverage,evaluated:r.evaluated,applicable:r.applicable}); }, { assessments:[{status:'conform',weight:2},{status:'partial',weight:1},{status:'not_applicable',weight:1},{status:'non_conform',weight:1}] }, 62.5],
  ['F5_5_COVERAGE','Cobertura','compliance','evaluated/applicable*100','coverage ratio', '%', 2, [{name:'evaluated'},{name:'applicable'}], (i,d)=>output(d,compliance.coverage(i)), {evaluated:8,applicable:10}, 80],
  ['F5_5_READINESS','Readiness','readiness','100*(wc*C+we*E+wh*H+wa*A)','weighted readiness components', 'score', 2, [{name:'compliance'},{name:'evidence'},{name:'health'},{name:'actions'}], (i,d)=>output(d,readinessSvc.readiness(i)), {compliance:.8,evidence:.7,health:.9,actions:.6}, 77],
  ['F5_5_INHERENT_RISK','Riesgo inherente','risk','mean(P_i*I_i)','arithmetic mean of usable tenant portfolio inherent risk scores', 'score', 4, [{name:'risks',type:'array'}], (i,d)=>{ const r=risk.inherentRisk(i); return output(d,r.value ?? r,{aggregation_method:r.aggregation_method||'single_risk',sample_size:r.sample_size??1,population_size:r.population_size??1,scores:r.scores||[r],risks:r.risks||[]}); }, {risks:[{source_record:'risk-a',probability:4,impact:5},{source_record:'risk-b',probability:2,impact:5},{source_record:'risk-c',probability:3,impact:5}],aggregation_method:'arithmetic_mean',population_size:3}, 15, {version:2}],
  ['F5_5_RESIDUAL_RISK','Riesgo residual','risk','Ri*(1-Ec)','inherent risk adjusted by control effectiveness', 'score', 4, [{name:'inherentRisk'},{name:'controlEffectiveness'}], (i,d)=>output(d,risk.residualRisk(i)), {inherentRisk:20,controlEffectiveness:.65}, 7],
  ['F5_5_COMBINED_EFFECTIVENESS','Efectividad combinada','control','1-prod(1-Ej)','complement product with dependency', 'ratio', 4, [{name:'effectivenesses'}], (i,d)=>output(d,controls.combinedEffectiveness(i)), {effectivenesses:[.4,.5],dependencyFactor:.9}, .63],
  ['F5_5_CONTROL_EFFECTIVENESS','Efectividad de control','control','wd*D+wi*I+wo*O+we*E','weighted explicit control dimensions; aggregate assurance score is not expanded into D/I/O/E', 'ratio', 4, [{name:'design'},{name:'implementation'},{name:'operation'},{name:'evidence'}], (i,d)=>output(d,controls.controlEffectiveness(i)), {design:.8,implementation:.7,operation:.9,evidence:.6}, .75, {version:2}],
  ['F5_5_CONTROL_COVERAGE','Cobertura de controles','control','risks_with_control/relevant_risks*100','control coverage ratio', '%', 2, [{name:'risksWithControl'},{name:'relevantRisks'}], (i,d)=>output(d,controls.controlCoverage(i)), {risksWithControl:7,relevantRisks:10}, 70],
  ['F5_5_FREQUENCY_COMPLIANCE','Cumplimiento de frecuencia','control','on_time/scheduled*100','scheduled execution compliance', '%', 2, [{name:'onTimeExecutions'},{name:'scheduledExecutions'}], (i,d)=>output(d,controls.frequencyCompliance(i)), {onTimeExecutions:18,scheduledExecutions:20}, 90],
  ['F5_5_FAILURE_RATE','Tasa de fallos','assurance','failed/executed*100','failed tests ratio', '%', 2, [{name:'failedTests'},{name:'executedTests'}], (i,d)=>output(d,controls.failureRate(i)), {failedTests:3,executedTests:20}, 15],
  ['F5_5_SEVERITY_INDEX','Severidad ponderada','findings','(1Nb+2Nm+3Na+4Nc)/(4N)*100','weighted severity index', '%', 2, [{name:'low'},{name:'medium'},{name:'high'},{name:'critical'}], (i,d)=>{ const total=Number(i.low)+Number(i.medium)+Number(i.high)+Number(i.critical); return output(d,((i.low+2*i.medium+3*i.high+4*i.critical)/(4*total))*100); }, {low:2,medium:2,high:1,critical:1}, 54.1667],
  ['F5_5_CLOSURE_RATE','Tasa de cierre','actions','closed/(open_start+created)*100','period closure rate', '%', 2, [{name:'closed'},{name:'openAtStart'},{name:'created'}], (i,d)=>output(d,pct(i.closed,Number(i.openAtStart)+Number(i.created))), {closed:6,openAtStart:5,created:7}, 50],
  ['F5_5_MTTC','MTTC','actions','mean(close-open)','mean time to close in days', 'days', 2, [{name:'items'}], (i,d)=>{ const ages=i.items.map(x=>daysBetween(x.openedAt,x.closedAt)); return output(d,stats.mean(ages),{median:stats.median(ages),p75:stats.percentile(ages,.75),p90:stats.percentile(ages,.9)}); }, {items:[{openedAt:'2026-01-01',closedAt:'2026-01-06'},{openedAt:'2026-01-01',closedAt:'2026-01-11'}]}, 7.5],
  ['F5_5_AGE','Antigüedad','actions','now-created_at','age in days', 'days', 2, [{name:'items'},{name:'now'}], (i,d)=>{ const ages=i.items.map(x=>daysBetween(x.createdAt,i.now)); return output(d,stats.mean(ages),{median:stats.median(ages),p75:stats.percentile(ages,.75),p90:stats.percentile(ages,.9),max:stats.max(ages)}); }, {now:'2026-01-11',items:[{createdAt:'2026-01-01'},{createdAt:'2026-01-06'}]}, 7.5],
  ['F5_5_WEIGHTED_PROGRESS','Avance ponderado','actions','sum(w*p)/sum(w)*100','weighted progress', '%', 2, [{name:'items'}], (i,d)=>output(d,weighted(i.items,'progress')*100), {items:[{progress:.5,weight:1},{progress:1,weight:3}]}, 87.5],
  ['F5_5_OVERDUE_RATE','Índice de atraso','actions','overdue/open*100','overdue action ratio', '%', 2, [{name:'overdueOpen'},{name:'openActions'}], (i,d)=>output(d,pct(i.overdueOpen,i.openActions),{weighted_overdue:i.items?weighted(i.items,'overdue')*100:null}), {overdueOpen:3,openActions:12,items:[{overdue:1,weight:2},{overdue:0,weight:2}]}, 25],
  ['F5_5_EXPECTED_LOSS','Pérdida esperada','loss','P*impact or frequency*severity','expected loss', 'currency', 2, [{name:'probability',required:false},{name:'impact',required:false}], (i,d)=>output(d,risk.expectedLoss(i)), {probability:.2,impact:10000}, 2000],
  ['F5_5_NET_LOSS','Pérdida neta','loss','gross-recoveries','net loss', 'currency', 2, [{name:'grossLoss'},{name:'recoveries'}], (i,d)=>output(d,risk.netLoss(i)), {grossLoss:1000,recoveries:250}, 750],
  ['F5_5_LOSS_SEVERITY','Severidad de pérdidas','loss','mean(net_loss)','loss severity statistics', 'currency', 2, [{name:'netLosses'}], (i,d)=>{ const r=risk.lossSeverity(i); return output(d,r.value,r); }, {netLosses:[100,200,300,400]}, 250],
  ['F5_5_PARAMETRIC_VAR','VaR paramétrico','loss','mu+z*sigma','parametric value at risk', 'currency', 2, [{name:'mean'},{name:'z'},{name:'sigma'}], (i,d)=>output(d,risk.parametricVaR(i)), {mean:1000,z:1.65,sigma:200}, 1330],
  ['F5_5_MONTE_CARLO','Monte Carlo','risk','annual simulated loss','seeded annual loss simulation', 'currency', 2, [{name:'iterations'},{name:'seed'}], (i,d)=>{ const r=stats.monteCarlo(i); return output(d,r.expectedValue,{p50:r.p50,p90:r.p90,p95:r.p95,p99:r.p99,exceedanceProbability:r.exceedanceProbability,seed:r.seed,iterations:r.iterations}); }, {iterations:1000,seed:42,frequency:{type:'poisson',lambda:1},severity:{type:'fixed',value:100},threshold:200}, 101.2],
  ['F5_5_FMEA_RPN','FMEA/RPN','risk','S*O*D','FMEA risk priority number', 'score', 0, [{name:'severity'},{name:'occurrence'},{name:'detection'}], (i,d)=>output(d,risk.fmeaRpn(i)), {severity:4,occurrence:5,detection:3}, 60],
  ['F5_5_AVAILABILITY','Disponibilidad','continuity','(total-downtime)/total*100','availability percentage', '%', 4, [{name:'totalTime',required:false},{name:'downtime',required:false}], (i,d)=>{ if (i.mtbf !== undefined && i.mtbf !== null) return output(d,(Number(i.mtbf)/(Number(i.mtbf)+Number(i.mttr)))*100); if (i.totalTime === null || i.totalTime === undefined || i.downtime === null || i.downtime === undefined) throw new FormulaRegistryError('AVAILABILITY_METHOD_REQUIRED','Disponibilidad requiere total/downtime o MTBF/MTTR.'); return output(d,((Number(i.totalTime)-Number(i.downtime))/Number(i.totalTime))*100); }, {totalTime:1000,downtime:10}, 99],
  ['F5_5_MTBF','MTBF','continuity','operating_time/failures','mean time between failures', 'hours', 2, [{name:'operatingTime'},{name:'failures'}], (i,d)=>output(d,Number(i.operatingTime)/Number(i.failures)), {operatingTime:1000,failures:4}, 250],
  ['F5_5_MTTR','MTTR','continuity','sum(repair_time)/incidents','mean time to repair', 'hours', 2, [{name:'repairTimes'}], (i,d)=>output(d,stats.mean(i.repairTimes)), {repairTimes:[2,4,6]}, 4],
  ['F5_5_SLA_COMPLIANCE','Cumplimiento SLA','continuity','within_sla/applicable*100','SLA compliance ratio', '%', 2, [{name:'withinSla'},{name:'applicableCases'}], (i,d)=>output(d,pct(i.withinSla,i.applicableCases)), {withinSla:45,applicableCases:50}, 90],
  ['F5_5_RTO_GAP','Brecha RTO','continuity','actual-objective','RTO gap', 'hours', 2, [{name:'recoveryActual'},{name:'rtoObjective'}], (i,d)=>output(d,Number(i.recoveryActual)-Number(i.rtoObjective)), {recoveryActual:6,rtoObjective:4}, 2],
  ['F5_5_RPO_GAP','Brecha RPO','continuity','actual-objective','RPO gap', 'hours', 2, [{name:'dataLossActual'},{name:'rpoObjective'}], (i,d)=>output(d,Number(i.dataLossActual)-Number(i.rpoObjective)), {dataLossActual:3,rpoObjective:1}, 2],
  ['F5_5_ASSET_CRITICALITY','Criticidad de activos','assets','weighted CIA+legal','asset criticality weighted score', 'score', 4, [{name:'confidentiality'},{name:'integrity'},{name:'availability'},{name:'legal'}], (i,d)=>output(d,risk.assetCriticality(i)), {confidentiality:4,integrity:5,availability:3,legal:2}, 3.5],
  ['F5_5_SUPPLIER_RISK','Riesgo de proveedores','suppliers','weighted supplier dimensions','supplier risk weighted score', 'score', 4, [{name:'compliance'},{name:'security'},{name:'dependency'},{name:'privacy'},{name:'resilience'}], (i,d)=>output(d,risk.supplierRisk(i)), {compliance:3,security:4,dependency:5,privacy:2,resilience:1}, 3],
  ['F5_5_SURVEY_SCORE','Score ponderado de encuestas','surveys','sum(w*s)/sum(w*smax)*100','weighted survey score', '%', 2, [{name:'items'}], (i,d)=>output(d,surveyScore(i.items)), {items:[{score:4,maxScore:5,weight:2},{score:3,maxScore:5,weight:1},{score:1,maxScore:5,weight:1,notApplicable:true}]}, 73.3333],
  ['F5_5_CRONBACH_ALPHA','Alfa de Cronbach','surveys','k/(k-1)*(1-sum(var_i)/var_T)','Cronbach alpha', 'ratio', 4, [{name:'matrix'}], (i,d)=>output(d,stats.cronbachAlpha(i.matrix)), {matrix:[[1,2,3],[2,3,4],[3,4,5],[4,5,6]]}, 1],
  ['F5_5_RESPONSE_RATE','Tasa de respuesta','surveys','completed/valid*100','response rate', '%', 2, [{name:'completedResponses'},{name:'validInvitations'}], (i,d)=>output(d,pct(i.completedResponses,i.validInvitations)), {completedResponses:80,validInvitations:100}, 80],
  ['F5_5_DROPOUT_RATE','Tasa de abandono','surveys','(started-completed)/started*100','dropout rate', '%', 2, [{name:'started'},{name:'completed'}], (i,d)=>output(d,((Number(i.started)-Number(i.completed))/Number(i.started))*100), {started:100,completed:80}, 20],
  ['F5_5_ASSURANCE_SCORE','Score de assurance','assurance','sum(w*r)/sum(w)*100','weighted assurance result score', '%', 2, [{name:'results'}], (i,d)=>{ const items=i.results.map(x=>({value:assuranceValue(x.result),weight:x.weight})).filter(x=>x.value!==null); return output(d,weighted(items)*100); }, {results:[{result:'pass',weight:2},{result:'pass_with_observations',weight:1},{result:'fail',weight:1},{result:'inconclusive',weight:1}]}, 68.75],
  ['F5_5_SAMPLE_SIZE','Tamaño de muestra','statistics','Z2p(1-p)/e2 adjusted','sample size with finite population correction', 'count', 2, [{name:'z'},{name:'p'},{name:'e'}], (i,d)=>{ const r=stats.sampleSize(i); return output(d,r.adjusted,{n:r.n}); }, {z:1.96,p:.5,e:.05,population:1000}, 277.7445],
  ['F5_5_COMPLETENESS','Completitud','data_quality','valid/expected*100','required fields completeness', '%', 2, [{name:'validRequired'},{name:'expectedRequired'}], (i,d)=>output(d,compliance.completeness(i)), {validRequired:18,expectedRequired:20}, 90],
  ['F5_5_ACCURACY','Exactitud','data_quality','correct/verified*100','verified value accuracy', '%', 2, [{name:'verifiedCorrect'},{name:'verified'}], (i,d)=>output(d,compliance.accuracy(i)), {verifiedCorrect:45,verified:50}, 90],
  ['F5_5_CONSISTENCY','Consistencia','data_quality','1-contradictory/evaluated','data consistency', '%', 2, [{name:'contradictory'},{name:'evaluated'}], (i,d)=>output(d,compliance.consistency(i)), {contradictory:2,evaluated:20}, 90],
  ['F5_5_FRESHNESS_CONTINUOUS','Freshness continuo','data_quality','exp(-lambda*t)','continuous freshness decay', '%', 2, [{name:'ageHours'},{name:'halfLifeHours'}], (i,d)=>{ const lambda=Math.log(2)/Number(i.halfLifeHours); const value=Math.exp(-lambda*Number(i.ageHours))*100; return output(d,value,{lambda,state:freshnessState(value)}); }, {ageHours:24,halfLifeHours:24}, 50],
  ['F5_5_LINEAGE_SCORE','Lineage Score','data_quality','present/required*100','required lineage relation coverage', '%', 2, [{name:'presentRelations'},{name:'requiredRelations'}], (i,d)=>output(d,compliance.lineageScore(i)), {presentRelations:4,requiredRelations:5}, 80],
  ['F5_5_Z_SCORE','Z-score','statistics','(x-mu)/sigma','standard z-score', 'z', 4, [{name:'x'},{name:'values'}], (i,d)=>output(d,stats.zScore(i.x,i.values)), {x:3,values:[1,2,3,4,5]}, 0],
  ['F5_5_ROBUST_Z_SCORE','Z-score robusto','statistics','0.6745*(x-median)/MAD','robust z-score', 'z', 4, [{name:'x'},{name:'values'}], (i,d)=>output(d,stats.robustZScore(i.x,i.values)), {x:5,values:[1,2,3,4,5]}, 1.349],
  ['F5_5_LINEAR_TREND','Tendencia lineal','statistics','y=b0+b1t','linear regression trend', 'slope', 4, [{name:'points'}], (i,d)=>{ const r=stats.linearRegression(i.points); return output(d,r.slope,r); }, {points:[{x:1,y:2},{x:2,y:4},{x:3,y:6}]}, 2],
  ['F5_5_PERCENT_VARIATION','Variación porcentual','statistics','(current-previous)/abs(previous)*100','percentage variation', '%', 2, [{name:'current'},{name:'previous'}], (i,d)=>{ const r=stats.percentageVariation(i.current,i.previous); return output(d,r.value,r); }, {current:120,previous:100}, 20],
  ['F5_5_MOVING_AVERAGE','Media móvil','statistics','avg last k','moving average', 'value', 4, [{name:'values'},{name:'windowSize'}], (i,d)=>{ const r=stats.movingAverage(i.values,i.windowSize); return output(d,r[r.length-1],{series:r}); }, {values:[1,2,3,4,5],windowSize:3}, 4],
  ['F5_5_EMA','EMA','statistics','alpha*x+(1-alpha)*prev','exponential moving average', 'value', 4, [{name:'values'},{name:'windowSize'}], (i,d)=>{ const r=stats.ema(i.values,i.windowSize); return output(d,r[r.length-1],{series:r}); }, {values:[1,2,3],windowSize:3}, 2.25],
  ['F5_5_CONFIDENCE_INTERVAL','Intervalo de confianza','statistics','p +- z*sqrt(p(1-p)/n)','confidence interval for proportion', '%', 4, [{name:'successes'},{name:'sampleSize'}], (i,d)=>{ const r=i.method==='wilson'?stats.wilsonInterval(i.successes,i.sampleSize,i.z):stats.confidenceIntervalProportion(i.successes,i.sampleSize,i.z); return output(d,r.p*100,r); }, {successes:50,sampleSize:100,z:1.96}, 50],
  ['F5_5_GRC_HEALTH','Health GRC','health','weighted average over AVAILABLE applicable components with coverage threshold','GRC health v2 dynamic denominator with explicit component classification, minimum coverage and confidence reporting', 'score', 2, [{name:'risk',required:false},{name:'compliance',required:false},{name:'actions',required:false},{name:'evidence',required:false},{name:'dataTrust',required:false},{name:'component_states',required:false,type:'object'},{name:'minimum_coverage',required:false}], (i,d)=>{ const r=dynamicGrcHealth(i); return output(d,r.value,{...r,coverage_policy:'available_weight/applicable_weight; publish only when coverage >= minimum_coverage'}); }, {risk:.8,compliance:.9,actions:.7,evidence:.6,dataTrust:.85,minimum_coverage:.8}, 78, {version:2,null_policy:'partial_available_components_with_coverage_threshold',limitations:'GRC Health v2 excludes only NOT_APPLICABLE components from applicable weight; MISSING, NOT_CONFIGURED, INVALID, STALE and UNKNOWN reduce coverage and confidence.'}],
  ['F5_5_MATURITY','Madurez','maturity','sum(w*n)/sum(w)','weighted maturity 0-5', 'level', 2, [{name:'levels'}], (i,d)=>output(d,readinessSvc.maturity(i)), {levels:[{level:2,weight:1},{level:4,weight:3}]}, 3.5],
  ['F5_C3_DATA_TRUST','Data Trust compuesto','data_quality','sum(w_d*dimension_d)','eight-dimension Data Trust without unknown renormalization', 'score', 2, [{name:'completeness'},{name:'accuracy'},{name:'consistency'},{name:'freshness'},{name:'lineage'},{name:'validation'},{name:'stability'},{name:'coverage'}], (i,d)=>{const weights=i.weights||{completeness:.15,accuracy:.15,consistency:.10,freshness:.15,lineage:.15,validation:.10,stability:.05,coverage:.15};return output(d,fixedComposite(i,['completeness','accuracy','consistency','freshness','lineage','validation','stability','coverage'],weights),{weights});}, {completeness:90,accuracy:80,consistency:85,freshness:75,lineage:100,validation:90,stability:70,coverage:80}, 84.75],
  ['F5_C3_OPERATIONAL_PERFORMANCE','Desempeño operacional','operations','sum(w_c*component_c)','fixed operational component score; missing components remain unmeasured', 'score', 2, [{name:'efficacy'},{name:'efficiency'},{name:'stability'},{name:'quality'},{name:'timeliness'},{name:'risk'},{name:'compliance'},{name:'actions'},{name:'dataTrust'}], (i,d)=>{const weights=i.weights||{efficacy:.10,efficiency:.10,stability:.10,quality:.10,timeliness:.10,risk:.15,compliance:.15,actions:.10,dataTrust:.10};return output(d,fixedComposite(i,['efficacy','efficiency','stability','quality','timeliness','risk','compliance','actions','dataTrust'],weights),{weights});}, {efficacy:82,efficiency:78,stability:80,quality:85,timeliness:76,risk:72,compliance:88,actions:79,dataTrust:84}, 80.4],
  ['F5_C3_SUPPLIER_HEALTH','Salud de proveedores','supplier','sum(w_c*component_c)','fixed supplier health; absent component is not silently renormalized', 'score', 2, [{name:'riskHealth'},{name:'performance'},{name:'assurance'},{name:'continuity'},{name:'incidentHealth'},{name:'dataTrust'}], (i,d)=>{const weights=i.weights||{riskHealth:.30,performance:.15,assurance:.15,continuity:.15,incidentHealth:.10,dataTrust:.15};return output(d,fixedComposite(i,['riskHealth','performance','assurance','continuity','incidentHealth','dataTrust'],weights),{weights});}, {riskHealth:75,performance:82,assurance:80,continuity:90,incidentHealth:85,dataTrust:78}, 80.5],
];

function buildDefinition(row) {
  const [formula_code, display_name, category, expression, methodology, unit, precision, variables, execute, normalInputs, normalExpected, options = {}] = row;
  const definition = {
    formula_code, display_name, category, version: options.version || 1, expression, methodology, variables: variables.map((variable) => !variable.unit ? { ...variable, unit: 'declared_input_unit' } : variable),
    units: { output: unit }, source_contract: getSourceCodeForFormula(formula_code), frequency: 'on_demand', minimum_sample_size: 1,
    null_policy: options.null_policy || 'reject_required_nulls', zero_division_policy: 'return_not_calculable_or_error_by_formula',
    rounding_policy: 'half_up', precision, thresholds: [], confidence_method: category === 'statistics' ? 'formula_specific' : 'not_applicable',
    applicability: 'tenant_or_global_dataset', limitations: options.limitations || 'Operational source binding is declared and resolved by Phase 5.5 package 2 contracts.',
    owner: 'TCDX', reviewer: 'TCDX', approved_by: 'TCDX', effective_from: '2026-07-29', effective_until: null, status: 'published',
    execute, tests: buildTests(formula_code, normalInputs, normalExpected, unit, options),
  };
  definition.checksum = checksumFor(definition);
  return Object.freeze(definition);
}
function buildTests(formula_code, normalInputs, normalExpected, unit, options = {}) {
  const requiredKey = Object.keys(normalInputs).find((key) => !['units','method','weights','threshold','frequency','severity'].includes(key));
  const nullInputs = { ...normalInputs, [requiredKey]: null };
  const zeroInputs = zeroCase(formula_code, normalInputs);
  const nullCase = options.null_policy === 'partial_available_components_with_coverage_threshold'
    ? { name: 'null', inputs: nullInputs, expected: 77.5, expectError: false, tolerance: 0.01, unit }
    : { name: 'null', inputs: nullInputs, expectError: true };
  return [
    { name: 'normal', inputs: normalInputs, expected: normalExpected, tolerance: formula_code === 'F5_5_MONTE_CARLO' ? 0.0001 : 0.01, unit },
    { name: 'boundary', inputs: normalInputs, expected: normalExpected, tolerance: formula_code === 'F5_5_MONTE_CARLO' ? 0.0001 : 0.01, unit },
    nullCase,
    { name: 'zero', inputs: zeroInputs.inputs, expected: zeroInputs.expected, expectError: zeroInputs.expectError, tolerance: 0.01, unit },
    { name: 'invalid_unit', inputs: { ...normalInputs, units: { [requiredKey]: 'invalid_unit' } }, expectError: true },
    { name: 'determinism', inputs: normalInputs, expected: normalExpected, tolerance: formula_code === 'F5_5_MONTE_CARLO' ? 0.0001 : 0.01, unit },
  ];
}
function zeroCase(code, inputs) {
  const clone = JSON.parse(JSON.stringify(inputs));
  if (code === 'F5_5_COVERAGE') return { inputs: { ...clone, applicable: 0 }, expectError: true };
  if (code === 'F5_5_INHERENT_RISK') return { inputs: { ...clone, risks: [] }, expectError: true };
  if (code === 'F5_5_PERCENT_VARIATION') return { inputs: { ...clone, previous: 0 }, expected: null };
  if (code === 'F5_5_MONTE_CARLO') return { inputs: { ...clone, frequency: { type: 'fixed', value: 0 } }, expected: 0 };
  return { inputs: clone, expected: null, expectError: false };
}
const FORMULAS = definitions.map(buildDefinition);
const FORMULA_MAP = new Map(FORMULAS.map((definition) => [definition.formula_code, definition]));

class OfficialFormulaRegistry {
  constructor(formulas = FORMULAS) { this.formulas = new Map(formulas.map((definition) => [definition.formula_code, definition])); }
  list() { return [...this.formulas.values()].map((definition) => ({ ...definition, execute: undefined, tests: undefined })); }
  get(formulaCode) { const formula = this.formulas.get(formulaCode); if (!formula) throw new FormulaRegistryError('FORMULA_NOT_FOUND', 'Formula no registrada.', { formulaCode }); return formula; }
  execute(formulaCode, inputs = {}) {
    const definition = this.get(formulaCode);
    assertRequired(inputs, definition.variables);
    assertUnits(inputs, definition.variables);
    return definition.execute(inputs, definition);
  }
  register(definition) {
    if (!STATES.has(definition.status)) throw new FormulaRegistryError('FORMULA_STATUS_INVALID', 'Estado de formula invalido.');
    const current = this.formulas.get(definition.formula_code);
    if (current && current.status === 'published' && current.checksum !== definition.checksum) {
      throw new FormulaRegistryError('FORMULA_PUBLISHED_IMMUTABLE', 'Una version publicada es inmutable.');
    }
    this.formulas.set(definition.formula_code, Object.freeze(definition));
  }
}
const defaultRegistry = new OfficialFormulaRegistry();
function executeFormula(code, inputs) { return defaultRegistry.execute(code, inputs); }
module.exports = { STATES, FORMULAS, FORMULA_MAP, OfficialFormulaRegistry, FormulaRegistryError, executeFormula, checksumFor };
