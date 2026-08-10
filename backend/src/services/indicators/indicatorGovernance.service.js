'use strict';

const pool = require('../../config/db');
const asyncJobs = require('../asyncJob.service');
const orchestrator = require('../math-governance/officialCalculationOrchestrator.service');
const {
  IndicatorContractError, checksum, calculateDataTrust, evaluateFreshness, evaluateSufficiency,
  buildInterpretation, buildSnapshotPayload, compareSnapshots, actionProposalKey,
} = require('./indicatorCore');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOB_TYPES = new Set(['metric.calculate','metric.snapshot','metric.compare','metric.freshness','metric.alert','metric.reconcile','metric.retention']);

class IndicatorGovernanceError extends Error {
  constructor(code,message,status=422,details=null){ super(message);this.name='IndicatorGovernanceError';this.code=code;this.status=status;this.details=details; }
}
function tenantId(scope){ const value=scope?.tenant_id||scope?.tenantId; if(!UUID_RE.test(String(value||''))) throw new IndicatorGovernanceError('INDICATOR_TENANT_REQUIRED','Se requiere tenant autenticado.',403); return String(value); }
function actorId(scope){ const value=scope?.user?.user_id||scope?.user?.userId||scope?.user?.id||null; return UUID_RE.test(String(value||''))?String(value):null; }
function code(value){ const normalized=String(value||'').trim().toUpperCase(); if(!/^[A-Z0-9][A-Z0-9-]{2,79}$/.test(normalized)) throw new IndicatorGovernanceError('INDICATOR_CODE_INVALID','Código funcional inválido.',422); return normalized; }
function uuid(value,label='id'){ if(!UUID_RE.test(String(value||''))) throw new IndicatorGovernanceError('INDICATOR_UUID_INVALID',`${label} inválido.`,422); return String(value); }
function limit(value,fallback=100,max=250){ const parsed=Number(value); return Number.isInteger(parsed)&&parsed>0?Math.min(parsed,max):fallback; }
function period(input={}){
  const start=input.start||input.period_start||null; const end=input.end||input.period_end||null;
  if(start&&Number.isNaN(new Date(start).getTime())||end&&Number.isNaN(new Date(end).getTime())) throw new IndicatorGovernanceError('INDICATOR_PERIOD_INVALID','Período inválido.',422);
  if(start&&end&&new Date(start)>new Date(end)) throw new IndicatorGovernanceError('INDICATOR_PERIOD_INVALID','Inicio posterior al fin.',422);
  return { key:String(input.key||input.period_key||`${start||'open'}:${end||'open'}`),start,end,timezone:String(input.timezone||'America/Santiago') };
}
function serializeError(error){ return String(error?.message||'indicator error').replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted-database-url]').slice(0,300); }

async function audit(client,scope,eventType,entityType,entityId,requestId,metadata={}){
  await client.query(`INSERT INTO commercial_events(tenant_id,actor_user_id,event_type,entity_type,entity_id,after_state,request_id)
    VALUES($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb,$7)`,[tenantId(scope),actorId(scope),eventType,entityType,entityId,JSON.stringify(metadata),requestId||null]);
}
async function resourceLimit(client,scope,resourceKey,currentCount,increment=1){
  const result=await client.query(`SELECT COALESCE(tul.limit_value,uld.default_limit) AS limit_value
    FROM usage_limit_definitions uld LEFT JOIN tenant_usage_limits tul ON tul.resource_key=uld.resource_key AND tul.tenant_id=$1::uuid AND tul.status='active'
    WHERE uld.resource_key=$2 AND uld.status='active' LIMIT 1`,[tenantId(scope),resourceKey]);
  const ceiling=result.rows[0]?.limit_value===null||result.rows[0]?.limit_value===undefined?null:Number(result.rows[0].limit_value);
  if(ceiling!==null&&Number(currentCount)+Number(increment)>ceiling) throw new IndicatorGovernanceError('INDICATOR_LIMIT_EXHAUSTED','Se alcanzó el límite comercial de indicadores.',429,{resource_key:resourceKey,limit:ceiling,usage:Number(currentCount)});
  return ceiling;
}

async function resolveIndicator(scope,metricCode,client=pool){
  const row=(await client.query(`SELECT md.*,mdv.id AS definition_version_id,mdv.version_number AS definition_version,mdv.functional_code,
      mdv.display_name AS functional_display_name,mdv.business_definition AS functional_business_definition,mdv.unit AS functional_unit,
      mdv.favorable_direction AS functional_direction,mdv.frequency AS functional_frequency,mdv.domain,mdv.objective,
      mdv.population_definition,mdv.numerator_definition,mdv.denominator_definition,mdv.methodology,mdv.semantic_contract_code,mdv.checksum AS definition_checksum,
      msb.id AS binding_id,msb.formula_code,msb.official_formula_version_id,msb.semantic_contract_version_id,msb.mapping_id,msb.version_number AS binding_version,
      msb.methodology_version,msb.metadata AS binding_metadata,msb.checksum AS binding_checksum,mcp.id AS calculation_policy_id,mcp.version_number AS calculation_policy_version,
      mcp.calculation_frequency,mcp.minimum_sample_size,mcp.timeout_ms,mcp.max_attempts,mcp.retry_backoff_seconds,mcp.retention_periods,mcp.failure_policy,mcp.metadata AS calculation_policy_metadata,mcp.checksum AS calculation_policy_checksum
    FROM metric_definitions md JOIN metric_definition_versions mdv ON mdv.metric_definition_id=md.id AND mdv.status='published'
    JOIN metric_source_bindings msb ON msb.metric_definition_id=md.id AND msb.definition_version_id=mdv.id AND msb.binding_status='published'
    JOIN metric_calculation_policies mcp ON mcp.metric_key=mdv.functional_code AND mcp.formula_code=msb.formula_code AND mcp.status='published' AND (mcp.tenant_id=$1::uuid OR mcp.tenant_id IS NULL)
    WHERE mdv.functional_code=$2 AND (mdv.tenant_id=$1::uuid OR mdv.tenant_id IS NULL) AND (msb.tenant_id=$1::uuid OR msb.tenant_id IS NULL)
    ORDER BY mdv.tenant_id DESC NULLS LAST,mdv.version_number DESC,msb.tenant_id DESC NULLS LAST,msb.version_number DESC,mcp.tenant_id DESC NULLS LAST,mcp.version_number DESC LIMIT 1`,[tenantId(scope),code(metricCode)])).rows[0];
  if(!row) throw new IndicatorGovernanceError('INDICATOR_NOT_FOUND','Indicador oficial no encontrado.',404);
  return row;
}

async function thresholdFor(client,scope,definitionId){
  const rows=(await client.query(`SELECT * FROM metric_thresholds WHERE metric_definition_id=$2::uuid AND status='published' AND (tenant_id=$1::uuid OR tenant_id IS NULL)
    ORDER BY tenant_id DESC NULLS LAST,version_number DESC,threshold_key`,[tenantId(scope),definitionId])).rows;
  if(!rows.length) return null;
  const version=rows[0].version_number; const selected=rows.filter((row)=>row.version_number===version&&String(row.tenant_id||'')===String(rows[0].tenant_id||''));
  return { version:Number(version),unit:selected[0].unit,direction:selected[0].direction,checksum:checksum(selected.map((row)=>row.checksum)),bands:selected.map((row)=>({code:row.threshold_key,label:row.label,min:row.value_min===null?null:Number(row.value_min),max:row.value_max===null?null:Number(row.value_max),positive:row.metadata?.positive===true})) };
}
async function trustPolicyFor(client,scope,definitionId){
  const row=(await client.query(`SELECT * FROM metric_trust_policies WHERE status='published' AND (tenant_id=$1::uuid OR tenant_id IS NULL) AND (metric_definition_id=$2::uuid OR metric_definition_id IS NULL)
    ORDER BY tenant_id DESC NULLS LAST,metric_definition_id DESC NULLS LAST,version_number DESC LIMIT 1`,[tenantId(scope),definitionId])).rows[0];
  if(!row) throw new IndicatorGovernanceError('INDICATOR_TRUST_POLICY_MISSING','No existe política Data Trust publicada.',409);
  return row;
}
async function sufficiencyRuleFor(client,scope,indicator){
  return (await client.query(`SELECT * FROM metric_sufficiency_rules WHERE status='published' AND (tenant_id=$1::uuid OR tenant_id IS NULL)
    AND (metric_definition_id=$2::uuid OR formula_code=$3) ORDER BY tenant_id DESC NULLS LAST,metric_definition_id DESC NULLS LAST,version_number DESC LIMIT 1`,[tenantId(scope),indicator.id,indicator.formula_code])).rows[0]||{minimum_sample_size:1,minimum_coverage:Number(indicator.calculation_policy_metadata?.minimum_coverage||0),required_inputs:[]};
}

function publicDefinition(row){ return { id:row.id,code:row.functional_code,name:row.functional_display_name||row.display_name,definition:row.functional_business_definition||row.business_definition,domain:row.domain,objective:row.objective,unit:row.functional_unit||row.unit,direction:row.functional_direction||row.direction,frequency:row.functional_frequency||row.frequency,population:row.population_definition,version:Number(row.definition_version),status:'published' }; }
function publicSnapshot(row){
  if(!row) return null; const payload=row.snapshot_payload||{};
  return { snapshot_id:row.snapshot_id||row.id,period:payload.period||{key:row.period_key},effective_at:payload.effective_at||row.effective_at,result:payload.result||null,value:payload.result?.status==='calculated'?payload.result.value:null,unit:payload.unit||null,state:payload.result?.status||'unmeasured',target:payload.target??null,coverage:payload.coverage??null,trust:payload.trust||{score:null,status:'unknown'},freshness:payload.freshness||{status:'unknown'},sufficiency:payload.sufficiency||{status:'source_unavailable'},threshold:payload.threshold||null,interpretation:payload.interpretation||null,updated_at:row.published_at||row.created_at,checksum:row.content_hash };
}

async function latestSnapshot(client,scope,definitionId){ return (await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND snapshot_status='published' ORDER BY effective_at DESC NULLS LAST,published_at DESC LIMIT 1`,[tenantId(scope),definitionId])).rows[0]||null; }
async function listCatalog(scope,filters={}){
  const rows=(await pool.query(`SELECT md.id,md.metric_code,md.display_name,md.business_definition,md.metric_type,md.unit,md.direction,md.frequency,
      mdv.functional_code,mdv.display_name AS functional_display_name,mdv.business_definition AS functional_business_definition,
      mdv.unit AS functional_unit,mdv.favorable_direction AS functional_direction,mdv.frequency AS functional_frequency,
      mdv.domain,mdv.objective,mdv.population_definition,mdv.version_number AS definition_version,
      ms.id AS snapshot_id,ms.snapshot_payload,ms.content_hash,ms.period_key,ms.effective_at,ms.published_at,ms.created_at
    FROM metric_definitions md JOIN LATERAL(SELECT candidate.* FROM metric_definition_versions candidate
      WHERE candidate.metric_definition_id=md.id AND candidate.status='published' AND (candidate.tenant_id=$1::uuid OR candidate.tenant_id IS NULL)
      ORDER BY candidate.tenant_id DESC NULLS LAST,candidate.version_number DESC LIMIT 1) mdv ON true
    LEFT JOIN LATERAL(SELECT s.* FROM metric_snapshots s WHERE s.tenant_id=$1::uuid AND s.metric_definition_id=md.id AND s.snapshot_status='published' ORDER BY s.effective_at DESC NULLS LAST,s.published_at DESC LIMIT 1) ms ON true
    WHERE ($2::text IS NULL OR mdv.domain=$2) AND ($3::text IS NULL OR mdv.display_name ILIKE '%'||$3||'%' OR mdv.functional_code ILIKE '%'||$3||'%')
    ORDER BY mdv.domain,mdv.display_name LIMIT $4`,[tenantId(scope),filters.domain||null,filters.search||null,limit(filters.limit,100,250)])).rows;
  return rows.map((row)=>({ definition:publicDefinition(row),latest_snapshot:publicSnapshot(row) }));
}
function dashboardColor(snapshot){
  if(!snapshot||snapshot.state!=='calculated') return 'gray';
  const classification=snapshot.interpretation?.classification||{};
  if(classification.positive===true) return 'green';
  if(['critical','unacceptable','non_compliant'].includes(String(classification.code||'').toLowerCase())) return 'red';
  return 'yellow';
}
async function dashboard(scope){
  const catalog=await listCatalog(scope,{limit:250});
  const items=catalog.map(({definition,latest_snapshot})=>({
    id:definition.id,code:definition.code,name:definition.name,description:definition.definition,
    category:definition.domain,kpi_type:'official_indicator',unit:definition.unit,frequency:definition.frequency,
    direction:definition.direction,target_value:latest_snapshot?.target??null,applicable_standards:[],is_enabled:true,
    is_health_kpi:['GRC-HEALTH','EVIDENCE-COVERAGE','DATA-TRUST'].includes(definition.code),
    latest_snapshot:latest_snapshot?{id:latest_snapshot.snapshot_id,value:latest_snapshot.value,status_color:dashboardColor(latest_snapshot),
      period_type:definition.frequency,period_start:latest_snapshot.period?.start||null,period_end:latest_snapshot.period?.end||null,
      calculated_at:latest_snapshot.updated_at,breakdown_json:{state:latest_snapshot.state,coverage:latest_snapshot.coverage,
        trust:latest_snapshot.trust,freshness:latest_snapshot.freshness,sufficiency:latest_snapshot.sufficiency,
        interpretation:latest_snapshot.interpretation,snapshot_id:latest_snapshot.snapshot_id}}:null,
  }));
  const counts={green:0,yellow:0,red:0,gray:0};
  for(const item of items) counts[item.latest_snapshot?.status_color||'gray']+=1;
  const measured=counts.green+counts.yellow+counts.red;
  const coverageValues=catalog.map((item)=>item.latest_snapshot?.coverage).filter((value)=>Number.isFinite(value));
  const averageCoverage=coverageValues.length?coverageValues.reduce((sum,value)=>sum+Number(value),0)/coverageValues.length:null;
  const health=catalog.find((item)=>item.definition.code==='GRC-HEALTH')?.latest_snapshot;
  return {summary:{total_kpis:items.length,...counts,measured_kpis:measured,
    data_coverage_pct:averageCoverage===null?null:Math.round(averageCoverage*(averageCoverage<=1?100:1)*100)/100,
    official_score:health?.state==='calculated'?health.value:null,health_kpis:items.filter((item)=>item.is_health_kpi).length},items};
}
async function recalculateCatalog(scope,body={},requestId=null){
  const catalog=await listCatalog(scope,{limit:250}); const results=[];
  for(const item of catalog){
    try{
      const result=await calculateIndicator(scope,item.definition.code,body,requestId);
      const entry={metric_code:item.definition.code,status:'completed',result};
      if(body.publish_snapshots!==false&&result.measurement?.id){
        try{
          const snapshotResult=await createSnapshot(scope,item.definition.code,{measurement_id:result.measurement.id,timezone:body.period?.timezone||body.timezone||'America/Santiago'},requestId);
          const snapshotId=snapshotResult?.snapshot?.snapshot_id;
          if(snapshotId){
            const published=await publishSnapshot(scope,snapshotId,requestId);
            entry.snapshot={status:published.status,snapshot:published.snapshot};
          }else{
            entry.snapshot={status:'failed',error_code:'INDICATOR_SNAPSHOT_ID_MISSING',message:'Snapshot sin identificador publicable.'};
          }
        }catch(snapshotError){
          entry.snapshot={status:'failed',error_code:snapshotError.code||'INDICATOR_SNAPSHOT_FAILED',message:serializeError(snapshotError)};
        }
      }
      results.push(entry);
    }
    catch(error){results.push({metric_code:item.definition.code,status:'failed',error_code:error.code||'INDICATOR_CALCULATION_FAILED',message:serializeError(error)});}
  }
  const snapshotResults=results.map((item)=>item.snapshot).filter(Boolean);
  return {recalculated:results.filter((item)=>item.status==='completed').length,failed:results.filter((item)=>item.status==='failed').length,
    snapshots_created:snapshotResults.filter((item)=>['published','already_published'].includes(item.status)).length,
    snapshots_failed:snapshotResults.filter((item)=>item.status==='failed').length,results};
}
async function getIndicator(scope,metricCode,{technical=false}={}){
  const definition=await resolveIndicator(scope,metricCode); const snapshot=await latestSnapshot(pool,scope,definition.id);
  const result={ definition:publicDefinition(definition),latest_snapshot:publicSnapshot(snapshot) };
  if(technical){
    const [threshold,trustPolicy,lineage]=await Promise.all([thresholdFor(pool,scope,definition.id),trustPolicyFor(pool,scope,definition.id),snapshot?pool.query(`SELECT * FROM data_lineage_edges WHERE tenant_id=$1::uuid AND (from_id=$2::uuid OR to_id=$2::uuid) ORDER BY created_at LIMIT 100`,[tenantId(scope),snapshot.id]):Promise.resolve({rows:[]})]);
    result.technical={ formula:{code:definition.formula_code,version_id:definition.official_formula_version_id},definition_version:definition.definition_version,binding:{id:definition.binding_id,version:definition.binding_version,checksum:definition.binding_checksum,semantic_contract_version_id:definition.semantic_contract_version_id,mapping_id:definition.mapping_id},calculation_policy:{id:definition.calculation_policy_id,version:definition.calculation_policy_version,checksum:definition.calculation_policy_checksum,timeout_ms:definition.timeout_ms,max_attempts:definition.max_attempts},threshold,trust_policy:{id:trustPolicy.id,version:trustPolicy.version_number,weights:trustPolicy.weights,checksum:trustPolicy.checksum},lineage:lineage.rows };
  }
  return result;
}

function mappedState(item){
  if(item?.status==='calculated') return 'calculated';
  if(item?.status==='source_unavailable') return 'source_unavailable';
  if(item?.status==='dependency_pending') return 'dependency_pending';
  if(item?.status==='source_incompatible') return 'source_incompatible';
  if(item?.failure_type==='technical_error'||item?.status==='failed') return 'technical_error';
  return 'insufficient_data';
}
function buildOfficialMeasurementPersistence(finalState,value){
  if(finalState==='calculated') return {value_numeric:Number(value),value_text:null};
  return {value_numeric:null,value_text:null};
}
function reconcileSufficiencyWithOfficialState(officialState,sufficiency,item={}){
  if(officialState==='calculated'||sufficiency.status!=='sufficient') return sufficiency;
  const requirements=item.data_requirements||{};
  const missingInputs=Array.isArray(requirements.missing_fields)?requirements.missing_fields:[];
  return {...sufficiency,status:'insufficient',reason:missingInputs.length?'missing_inputs':officialState,missing_inputs:missingInputs};
}
async function buildTrustEvidence(client,scope,indicator,item,runId,periodValue,sourceSnapshotIds){
  const counts=item?.source_counts||{}; const received=Number(counts.received||0); const usable=Number(counts.usable||0); const excluded=Number(counts.excluded||Math.max(0,received-usable));
  const coverage=received>0?usable/received:null;
  const freshness=evaluateFreshness({ effectiveAt:periodValue.end,frequency:indicator.frequency,timezone:periodValue.timezone });
  const validationRows=runId?(await client.query(`SELECT severity FROM calculation_validations WHERE tenant_id=$1::uuid AND run_id=$2::uuid`,[tenantId(scope),runId])).rows:[];
  const hasValidationFailure=validationRows.some((row)=>['error','critical'].includes(row.severity));
  const history=(await client.query(`SELECT (snapshot_payload->'result'->>'value')::numeric AS value FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND snapshot_status='published' AND snapshot_payload->'result'->>'status'='calculated' ORDER BY effective_at DESC LIMIT 6`,[tenantId(scope),indicator.id])).rows.map((row)=>Number(row.value)).filter(Number.isFinite);
  let stability=null;
  if(history.length>=3){ const mean=history.reduce((a,b)=>a+b,0)/history.length; const variance=history.reduce((a,b)=>a+(b-mean)**2,0)/history.length; stability=Math.max(0,100-Math.min(100,(Math.sqrt(variance)/(Math.abs(mean)||1))*100)); }
  const score=(ratio)=>ratio===null?null:Math.max(0,Math.min(100,ratio*100));
  const itemDimension=(value,evidence,rule,numerator=null,denominator=null,warnings=[])=>({score:value,evidence,rule,numerator,denominator,warnings,evaluated_at:new Date().toISOString(),version:1});
  return {
    coverage,
    freshness,
    dimensions:{
      completeness:itemDimension(score(coverage),{received,usable,excluded},'usable_rows/received_rows',usable,received),
      accuracy:itemDimension(null,{validation_records:validationRows.length},'requires_explicit_accuracy_validation',null,null,['Exactitud no inferida sin validación específica.']),
      consistency:itemDimension(received>0?score((received-excluded)/received):null,{received,excluded},'non_excluded_rows/received_rows',received-excluded,received),
      freshness:itemDimension(freshness.status==='fresh'?100:freshness.status==='aging'?70:freshness.status==='stale'?30:null,freshness,'effective_date_vs_frequency_sla'),
      lineage:itemDimension(sourceSnapshotIds.length?100:null,{source_snapshot_ids:sourceSnapshotIds},'source_snapshot_required',sourceSnapshotIds.length,1),
      validation:itemDimension(runId?(hasValidationFailure?0:100):null,{calculation_run_id:runId,validation_records:validationRows.length},'official_run_without_error_validation',hasValidationFailure?0:1,1),
      stability:itemDimension(stability,{history_points:history.length},'coefficient_of_variation_last_6',history.length,6,history.length<3?['Historia insuficiente para estabilidad.']:[]),
      coverage:itemDimension(score(coverage),{received,usable},'usable_population_coverage',usable,received),
    },
  };
}

async function calculateIndicator(scope,metricCode,body={},requestId=null){
  const indicator=await resolveIndicator(scope,metricCode); const currentPeriod=period(body.period||body); const client=await pool.connect();
  try{
    const bindingSourceCode=indicator.binding_metadata?.source_code||null;
    const orchestration=await orchestrator.recalculateOfficialAnalytics(scope,{formula_codes:[indicator.formula_code],period:currentPeriod,source_overrides:bindingSourceCode?{[indicator.formula_code]:bindingSourceCode}:{}},requestId);
    const item=orchestration.results.find((entry)=>entry.formula_code===indicator.formula_code); if(!item) throw new IndicatorGovernanceError('INDICATOR_OFFICIAL_OUTPUT_MISSING','El motor oficial no devolvió el binding solicitado.',502);
    const officialState=mappedState(item); const value=officialState==='calculated'?Number(item.value):null;
    const sourceSnapshotIds=item.snapshot_id?[item.snapshot_id]:[];
    const [trustPolicy,sufficiencyRule]=await Promise.all([trustPolicyFor(client,scope,indicator.id),sufficiencyRuleFor(client,scope,indicator)]);
    const evidence=await buildTrustEvidence(client,scope,indicator,item,item.calculation_run_id||null,currentPeriod,sourceSnapshotIds);
    let sufficiency=evaluateSufficiency({sourceStatus:officialState==='source_unavailable'?'source_unavailable':officialState==='mapping_required'?'mapping_required':officialState==='source_incompatible'?'source_incompatible':'source_ready',requiredInputs:sufficiencyRule.required_inputs||[],availableInputs:officialState==='calculated'?{value}:{},sampleSize:Number(item.source_counts?.usable||0),populationSize:Number(item.source_counts?.received||0)||null,coverage:evidence.coverage,rule:sufficiencyRule});
    sufficiency=reconcileSufficiencyWithOfficialState(officialState,sufficiency,item);
    let finalState=officialState;
    if(officialState==='calculated'&&sufficiency.status==='insufficient') finalState=sufficiency.reason==='minimum_coverage'?'insufficient_coverage':'insufficient_data';
    if(officialState==='calculated'&&evidence.freshness.status==='stale') finalState='stale_source';
    const trust=calculateDataTrust({dimensions:evidence.dimensions,weights:trustPolicy.weights,policyVersion:trustPolicy.version_number,policyChecksum:trustPolicy.checksum});
    const persistedValue=buildOfficialMeasurementPersistence(finalState,value);
    await client.query('BEGIN');
    const trustRow=(await client.query(`INSERT INTO metric_trust_assessments(tenant_id,metric_definition_id,calculation_run_id,trust_policy_id,score,trust_status,dimensions,evidence_checksum,assessment_checksum,correlation_id,created_by,metadata)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::jsonb,$8,$9,$10,$11::uuid,$12::jsonb) ON CONFLICT(tenant_id,metric_definition_id,correlation_id,assessment_checksum) DO UPDATE SET metadata=metric_trust_assessments.metadata RETURNING *`,[tenantId(scope),indicator.id,item.calculation_run_id||null,trustPolicy.id,trust.score,trust.status,JSON.stringify(trust.dimensions),checksum(evidence),trust.checksum,requestId||checksum({metricCode,currentPeriod,item:item.calculation_run_id}),actorId(scope),JSON.stringify({known_weight:trust.known_weight,unknown_dimensions:trust.unknown_dimensions})])).rows[0];
    const measurement=(await client.query(`INSERT INTO metric_measurements(tenant_id,metric_definition_id,period_key,period_start,period_end,value_numeric,value_text,unit,source_timestamp,calculated_at,quality_status,freshness_status,trust_score,trust_status,validation_status,correlation_id,created_by,metadata,official_state,coverage_ratio,sample_size,population_size,sufficiency_status,source_snapshot_ids,calculation_run_id,official_formula_version_id,trust_assessment_id)
      VALUES($1::uuid,$2::uuid,$3,$4::timestamptz,$5::timestamptz,$6,NULL,$7,$5::timestamptz,now(),$8,$9,$10,$11,$12,$13,$14::uuid,$15::jsonb,$16,$17,$18,$19,$20,$21::uuid[],$22::uuid,$23::uuid,$24::uuid)
      ON CONFLICT(tenant_id,metric_definition_id,period_key,COALESCE(correlation_id,'manual')) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,value_text=NULL,calculated_at=now(),quality_status=EXCLUDED.quality_status,freshness_status=EXCLUDED.freshness_status,trust_score=EXCLUDED.trust_score,trust_status=EXCLUDED.trust_status,validation_status=EXCLUDED.validation_status,metadata=EXCLUDED.metadata,official_state=EXCLUDED.official_state,coverage_ratio=EXCLUDED.coverage_ratio,sample_size=EXCLUDED.sample_size,population_size=EXCLUDED.population_size,sufficiency_status=EXCLUDED.sufficiency_status,source_snapshot_ids=EXCLUDED.source_snapshot_ids,calculation_run_id=EXCLUDED.calculation_run_id,official_formula_version_id=EXCLUDED.official_formula_version_id,trust_assessment_id=EXCLUDED.trust_assessment_id RETURNING *`,
      [tenantId(scope),indicator.id,currentPeriod.key,currentPeriod.start,currentPeriod.end,persistedValue.value_numeric,indicator.unit,finalState==='calculated'?'valid':finalState==='technical_error'?'rejected':'unknown',evidence.freshness.status==='fresh'?'current':evidence.freshness.status,trust.score,trust.status,finalState==='validation_failed'?'rejected':finalState==='calculated'?'valid':'pending',requestId||checksum({metricCode,currentPeriod}),actorId(scope),JSON.stringify({warnings:item.warnings||[],trust_checksum:trust.checksum}),finalState,evidence.coverage,Number(item.source_counts?.usable||0),Number(item.source_counts?.received||0),sufficiency.status,sourceSnapshotIds,item.calculation_run_id||null,indicator.official_formula_version_id,trustRow.id])).rows[0];
    await client.query('UPDATE metric_trust_assessments SET measurement_id=$3::uuid WHERE tenant_id=$1::uuid AND id=$2::uuid',[tenantId(scope),trustRow.id,measurement.id]);
    await audit(client,scope,'metric.indicator.calculated','metric_measurement',measurement.id,requestId,{metric_code:indicator.functional_code,state:finalState,calculation_run_id:item.calculation_run_id||null});
    await client.query('COMMIT');
    return {definition:publicDefinition(indicator),measurement:{...measurement,value_numeric:measurement.value_numeric===null?null:Number(measurement.value_numeric)},trust,freshness:evidence.freshness,sufficiency,official_run:{id:item.calculation_run_id||null,source_snapshot_ids:sourceSnapshotIds},warnings:item.warnings||[]};
  }catch(error){ await client.query('ROLLBACK').catch(()=>null); throw error; }finally{client.release();}
}

async function createSnapshot(scope,metricCode,body={},requestId=null){
  const indicator=await resolveIndicator(scope,metricCode); const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const countRow=(await client.query(`SELECT count(*)::int AS count FROM metric_snapshots WHERE tenant_id=$1::uuid AND created_at>=date_trunc('month',now())`,[tenantId(scope)])).rows[0];
    await resourceLimit(client,scope,'indicator_snapshots_monthly',Number(countRow.count),1);
    const retainedRow=(await client.query(`SELECT count(*)::int AS count FROM metric_snapshots WHERE tenant_id=$1::uuid`,[tenantId(scope)])).rows[0];
    await resourceLimit(client,scope,'indicator_snapshots_retained',Number(retainedRow.count),1);
    const measurement=body.measurement_id?(await client.query(`SELECT * FROM metric_measurements WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND id=$3::uuid`,[tenantId(scope),indicator.id,uuid(body.measurement_id,'measurement_id')])).rows[0]:(await client.query(`SELECT * FROM metric_measurements WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid ORDER BY period_end DESC,created_at DESC LIMIT 1`,[tenantId(scope),indicator.id])).rows[0];
    if(!measurement) throw new IndicatorGovernanceError('INDICATOR_MEASUREMENT_MISSING','No existe medición para crear snapshot.',409);
    const [trustRow,threshold]=await Promise.all([client.query(`SELECT * FROM metric_trust_assessments WHERE tenant_id=$1::uuid AND id=$2::uuid`,[tenantId(scope),measurement.trust_assessment_id]),thresholdFor(client,scope,indicator.id)]);
    const trustAssessment=trustRow.rows[0]; if(!trustAssessment) throw new IndicatorGovernanceError('INDICATOR_TRUST_ASSESSMENT_MISSING','La medición no tiene Data Trust verificable.',409);
    const previous=await latestSnapshot(client,scope,indicator.id);
    const sourceEvidence={causes:body.causes||[],impacts:body.impacts||[],recommendation:body.recommendation||null,proposed_action:body.proposed_action||null,priority:body.priority||null,suggested_owner:body.suggested_owner||null,warnings:measurement.metadata?.warnings||[],limitations:body.limitations||[]};
    const provisional={metric_code:indicator.functional_code,result:{status:measurement.official_state,value:measurement.official_state==='calculated'?Number(measurement.value_numeric):null,warnings:measurement.metadata?.warnings||[]},unit:measurement.unit,trust:{score:trustAssessment.score===null?null:Number(trustAssessment.score),status:trustAssessment.trust_status,dimensions:trustAssessment.dimensions,checksum:trustAssessment.assessment_checksum},coverage:measurement.coverage_ratio===null?null:Number(measurement.coverage_ratio)};
    const priorComparison=previous?compareSnapshots(previous.snapshot_payload,{...provisional,formula_code:indicator.formula_code,formula_version:indicator.official_formula_version_id,methodology_version:indicator.methodology_version,checksum:'pending'}):null;
    const interpretation=buildInterpretation({definition:{owner:indicator.owner_user_id},result:provisional.result,threshold,comparison:priorComparison,evidence:sourceEvidence});
    const payload=buildSnapshotPayload({tenant_id:tenantId(scope),metric_code:indicator.functional_code,metric_definition_id:indicator.id,definition_version:indicator.definition_version,formula_code:indicator.formula_code,formula_version:indicator.official_formula_version_id,semantic_contract:{version_id:indicator.semantic_contract_version_id},mapping:indicator.mapping_id?{id:indicator.mapping_id}:null,calculation_policy:{id:indicator.calculation_policy_id,version:indicator.calculation_policy_version,checksum:indicator.calculation_policy_checksum},methodology_version:indicator.methodology_version,period:{key:measurement.period_key,start:measurement.period_start,end:measurement.period_end,timezone:body.timezone||'America/Santiago'},effective_at:measurement.source_timestamp||measurement.period_end,result:provisional.result,unit:measurement.unit,target:body.target??null,coverage:provisional.coverage,trust:provisional.trust,freshness:{status:measurement.freshness_status==='current'?'fresh':measurement.freshness_status},sufficiency:{status:measurement.sufficiency_status,sample_size:measurement.sample_size,population_size:measurement.population_size},threshold,interpretation,source_snapshot_ids:measurement.source_snapshot_ids||[],lineage:body.lineage||[],calculation_run_id:measurement.calculation_run_id,correlation_id:requestId||measurement.correlation_id});
    const inserted=(await client.query(`INSERT INTO metric_snapshots(tenant_id,metric_definition_id,measurement_id,formula_version_id,period_key,snapshot_payload,content_hash,created_by,metadata,definition_version_id,calculation_run_id,official_formula_version_id,trust_assessment_id,threshold_version,methodology_version,effective_at,source_snapshot_ids,correlation_id,snapshot_status)
      VALUES($1::uuid,$2::uuid,$3::uuid,NULL,$4,$5::jsonb,$6,$7::uuid,$8::jsonb,$9::uuid,$10::uuid,$11::uuid,$12::uuid,$13,$14,$15::timestamptz,$16::uuid[],$17,'draft')
      ON CONFLICT(tenant_id,metric_definition_id,period_key,content_hash) DO NOTHING RETURNING *`,[tenantId(scope),indicator.id,measurement.id,measurement.period_key,JSON.stringify(payload),payload.checksum,actorId(scope),JSON.stringify({functional_code:indicator.functional_code}),indicator.definition_version_id,measurement.calculation_run_id,indicator.official_formula_version_id,trustAssessment.id,threshold?.version||null,indicator.methodology_version,payload.effective_at,payload.source_snapshot_ids,requestId||measurement.correlation_id])).rows[0];
    const snapshot=inserted||(await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND period_key=$3 AND content_hash=$4`,[tenantId(scope),indicator.id,measurement.period_key,payload.checksum])).rows[0];
    await client.query(`INSERT INTO metric_interpretations(tenant_id,metric_snapshot_id,interpretation_version,result_status,trend,comparison,cause,impact,recommendation,proposed_action,priority,suggested_owner,warnings,limitations,source_evidence,checksum,created_by)
      VALUES($1::uuid,$2::uuid,1,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16::uuid) ON CONFLICT(tenant_id,metric_snapshot_id,interpretation_version) DO NOTHING`,[tenantId(scope),snapshot.id,measurement.official_state,JSON.stringify({direction:interpretation.trend}),JSON.stringify(priorComparison||{}),interpretation.cause,interpretation.impact,interpretation.recommendation,interpretation.proposed_action,interpretation.priority,interpretation.suggested_owner,JSON.stringify(interpretation.warnings),JSON.stringify(interpretation.limitations),JSON.stringify(sourceEvidence),checksum(interpretation),actorId(scope)]);
    if(inserted)await audit(client,scope,'metric.snapshot.created','metric_snapshot',snapshot.id,requestId,{metric_code:indicator.functional_code,checksum:payload.checksum,status:'draft'});
    await client.query('COMMIT'); return {snapshot:{...publicSnapshot(snapshot),status:snapshot.snapshot_status},payload,idempotent:!inserted};
  }catch(error){await client.query('ROLLBACK').catch(()=>null);throw error;}finally{client.release();}
}
async function publishSnapshot(scope,snapshotId,requestId=null){
  const client=await pool.connect(); try{await client.query('BEGIN');const row=(await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE`,[tenantId(scope),uuid(snapshotId,'snapshot_id')])).rows[0];if(!row)throw new IndicatorGovernanceError('INDICATOR_SNAPSHOT_NOT_FOUND','Snapshot no encontrado.',404);if(row.snapshot_status==='published'){await client.query('COMMIT');return {snapshot:publicSnapshot(row),status:'already_published'};}if(row.snapshot_status!=='draft')throw new IndicatorGovernanceError('INDICATOR_SNAPSHOT_STATE_INVALID','Solo un snapshot draft puede publicarse.',409);
    const updated=(await client.query(`UPDATE metric_snapshots SET snapshot_status='published',published_by=$3::uuid,published_at=now() WHERE tenant_id=$1::uuid AND id=$2::uuid RETURNING *`,[tenantId(scope),row.id,actorId(scope)])).rows[0];
    await audit(client,scope,'metric.snapshot.published','metric_snapshot',row.id,requestId,{checksum:row.content_hash});await client.query('COMMIT');return {snapshot:publicSnapshot(updated),status:'published'};
  }catch(error){await client.query('ROLLBACK').catch(()=>null);throw error;}finally{client.release();}}

async function history(scope,metricCode,filters={}){const indicator=await resolveIndicator(scope,metricCode);const rows=(await pool.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND snapshot_status='published' ORDER BY effective_at DESC NULLS LAST,published_at DESC LIMIT $3`,[tenantId(scope),indicator.id,limit(filters.limit,24,240)])).rows;return rows.map(publicSnapshot);}
async function createComparison(scope,metricCode,body={},requestId=null){
  const indicator=await resolveIndicator(scope,metricCode);const client=await pool.connect();
  try{await client.query('BEGIN');const type=String(body.comparison_type||'period');const windowPeriods=Math.max(1,Math.min(Number(body.window_periods||1),24));const current=body.current_snapshot_id?(await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND id=$3::uuid AND snapshot_status='published'`,[tenantId(scope),indicator.id,uuid(body.current_snapshot_id)])).rows[0]:await latestSnapshot(client,scope,indicator.id);if(!current)throw new IndicatorGovernanceError('INDICATOR_CURRENT_SNAPSHOT_MISSING','Snapshot actual no encontrado.',404);
    let base=null;let targetValue=null;let comparison;
    if(type==='target'){
      targetValue=Number(body.target_value);if(!Number.isFinite(targetValue))throw new IndicatorGovernanceError('INDICATOR_TARGET_REQUIRED','La comparación objetivo requiere target_value numérico.',422);
      const targetPayload={...current.snapshot_payload,result:{status:'calculated',value:targetValue},checksum:checksum({targetValue,metric_code:indicator.functional_code})};comparison=compareSnapshots(targetPayload,current.snapshot_payload,'target');
    }else{
      base=body.baseline_snapshot_id?(await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND id=$3::uuid AND snapshot_status='published'`,[tenantId(scope),indicator.id,uuid(body.baseline_snapshot_id)])).rows[0]:(await client.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND snapshot_status='published' AND id<>$3::uuid ORDER BY effective_at DESC NULLS LAST OFFSET $4 LIMIT 1`,[tenantId(scope),indicator.id,current.id,windowPeriods-1])).rows[0];if(!base)throw new IndicatorGovernanceError('INDICATOR_BASELINE_SNAPSHOT_MISSING',`No existe historia suficiente para ${windowPeriods} períodos.`,409);comparison=compareSnapshots(base.snapshot_payload,current.snapshot_payload,type);
    }
    const monthly=Number((await client.query(`SELECT count(*)::int AS count FROM data_comparisons WHERE tenant_id=$1::uuid AND created_at>=date_trunc('month',now())`,[tenantId(scope)])).rows[0].count);await resourceLimit(client,scope,'indicator_comparisons_monthly',monthly,1);const status=comparison.status==='comparable'?(comparison.direction==='unchanged'?'stable':(indicator.direction==='lower_is_better'&&comparison.direction==='decrease')||(indicator.direction!=='lower_is_better'&&comparison.direction==='increase')?'improved':'degraded'):'not_comparable';
    const values=[tenantId(scope),type,base?.id||null,current.id,comparison.base_value??null,comparison.current_value??null,comparison.absolute_change??null,comparison.relative_change===null||comparison.relative_change===undefined?null:comparison.relative_change*100,comparison.direction,status,JSON.stringify(comparison),base?[base.id,current.id]:[current.id],actorId(scope),JSON.stringify({window_periods:windowPeriods}),indicator.id,comparison.status==='comparable',comparison.reason||null,windowPeriods,comparison.checksum||checksum(comparison),targetValue];
    const row=(await client.query(`INSERT INTO data_comparisons(tenant_id,comparison_type,baseline_snapshot_id,current_snapshot_id,baseline_metric_snapshot_id,current_metric_snapshot_id,baseline_value,current_value,absolute_change,percentage_change,direction,status,explanation_inputs,source_snapshot_ids,created_by,metadata,metric_definition_id,methodology_compatible,compatibility_reason,period_distance,comparison_checksum,target_value) VALUES($1::uuid,$2,NULL,NULL,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::uuid[],$13::uuid,$14::jsonb,$15::uuid,$16,$17,$18,$19,$20) RETURNING *`,values)).rows[0];
    await audit(client,scope,'metric.comparison.created','data_comparison',row.id,requestId,{metric_code:indicator.functional_code,status:comparison.status,type,window_periods:windowPeriods});await client.query('COMMIT');return {...row,result:comparison};
  }catch(error){if(error?.code==='23505'){await client.query('ROLLBACK').catch(()=>null);return {status:'already_exists',metric_code:indicator.functional_code};}await client.query('ROLLBACK').catch(()=>null);throw error;}finally{client.release();}
}
async function comparisons(scope,metricCode,filters={}){const indicator=await resolveIndicator(scope,metricCode);return (await pool.query(`SELECT * FROM data_comparisons WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid ORDER BY created_at DESC LIMIT $3`,[tenantId(scope),indicator.id,limit(filters.limit,24,240)])).rows;}

async function methodology(scope,metricCode){
  const indicator=await resolveIndicator(scope,metricCode);
  const [versions,bindings,policies,thresholds,trustPolicies]=await Promise.all([
    pool.query(`SELECT id,tenant_id,version_number,functional_code,display_name,business_definition,domain,objective,unit,favorable_direction,frequency,population_definition,numerator_definition,denominator_definition,methodology,status,effective_from,effective_until,checksum,created_by,reviewed_by,published_by,created_at,reviewed_at,published_at FROM metric_definition_versions WHERE metric_definition_id=$2::uuid AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY version_number DESC`,[tenantId(scope),indicator.id]),
    pool.query(`SELECT id,tenant_id,metric_key,formula_code,definition_version_id,official_formula_version_id,semantic_contract_version_id,mapping_id,version_number,methodology_version,unit,binding_status,checksum,effective_from,effective_until FROM metric_source_bindings WHERE metric_definition_id=$2::uuid AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY version_number DESC`,[tenantId(scope),indicator.id]),
    pool.query(`SELECT id,tenant_id,metric_key,formula_code,calculation_frequency,minimum_sample_size,failure_policy,status,version_number,timeout_ms,max_attempts,retry_backoff_seconds,retention_periods,checksum,metadata FROM metric_calculation_policies WHERE metric_key=$2 AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY version_number DESC`,[tenantId(scope),indicator.functional_code]),
    pool.query(`SELECT id,tenant_id,version_number,threshold_key,label,operator,value_min,value_max,status_result,direction,unit,justification,status,checksum,effective_from,effective_until FROM metric_thresholds WHERE metric_definition_id=$2::uuid AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY version_number DESC,threshold_key`,[tenantId(scope),indicator.id]),
    pool.query(`SELECT id,tenant_id,policy_code,version_number,weights,critical_dimensions,status,effective_from,effective_until,checksum FROM metric_trust_policies WHERE (metric_definition_id=$2::uuid OR metric_definition_id IS NULL) AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY metric_definition_id DESC NULLS LAST,version_number DESC`,[tenantId(scope),indicator.id]),
  ]);
  return {metric_code:indicator.functional_code,versions:versions.rows,bindings:bindings.rows,policies:policies.rows,thresholds:thresholds.rows,trust_policies:trustPolicies.rows};
}

function validateWeights(weights){
  const expected=['completeness','accuracy','consistency','freshness','lineage','validation','stability','coverage'];
  if(!weights||typeof weights!=='object'||Array.isArray(weights)||expected.some((key)=>!Number.isFinite(Number(weights[key]))||Number(weights[key])<0)) throw new IndicatorGovernanceError('INDICATOR_TRUST_WEIGHTS_INVALID','Los ocho pesos Data Trust deben ser numéricos y no negativos.',422);
  const total=expected.reduce((sum,key)=>sum+Number(weights[key]),0);
  if(Math.abs(total-1)>0.000001) throw new IndicatorGovernanceError('INDICATOR_TRUST_WEIGHTS_INVALID','Los pesos Data Trust deben sumar 1.',422,{total});
  return Object.fromEntries(expected.map((key)=>[key,Number(weights[key])]));
}
function validateBands(bands){
  const operators=new Set(['greater_than','greater_or_equal','less_than','less_or_equal','between','equals']);
  const results=new Set(['good','warning','critical','informational']);
  if(!Array.isArray(bands)||bands.length===0) throw new IndicatorGovernanceError('INDICATOR_THRESHOLDS_REQUIRED','Debe existir al menos una banda de threshold.',422);
  const keys=new Set();
  return bands.map((band)=>{const key=String(band.key||band.threshold_key||'').trim();if(!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(key)||keys.has(key)||!operators.has(band.operator)||!results.has(band.result||band.status_result))throw new IndicatorGovernanceError('INDICATOR_THRESHOLD_INVALID','Banda de threshold inválida o duplicada.',422);keys.add(key);const min=band.min??band.value_min??null;const max=band.max??band.value_max??null;if(min!==null&&!Number.isFinite(Number(min))||max!==null&&!Number.isFinite(Number(max))||min!==null&&max!==null&&Number(min)>Number(max))throw new IndicatorGovernanceError('INDICATOR_THRESHOLD_INVALID','Rango de threshold inválido.',422);return {key,label:String(band.label||key),operator:band.operator,min:min===null?null:Number(min),max:max===null?null:Number(max),result:band.result||band.status_result,positive:band.positive===true};});
}

async function createMethodologyDraft(scope,metricCode,body={},requestId=null){
  const current=await resolveIndicator(scope,metricCode);const client=await pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${current.id}:methodology`]);
    const count=Number((await client.query(`SELECT count(*)::int AS count FROM metric_definition_versions WHERE tenant_id=$1::uuid`,[tenantId(scope)])).rows[0].count);await resourceLimit(client,scope,'indicator_versions_active',count,1);
    const version=Number((await client.query(`SELECT COALESCE(max(version_number),0)::int+1 AS version FROM metric_definition_versions WHERE metric_definition_id=$1::uuid`,[current.id])).rows[0].version);
    const rawThresholds=(await client.query(`SELECT * FROM metric_thresholds WHERE metric_definition_id=$2::uuid AND status='published' AND (tenant_id=$1::uuid OR tenant_id IS NULL) ORDER BY tenant_id DESC NULLS LAST,version_number DESC,threshold_key`,[tenantId(scope),current.id])).rows;const selectedVersion=rawThresholds[0]?.version_number;const selectedTenant=rawThresholds[0]?.tenant_id||null;
    const defaultBands=rawThresholds.filter((row)=>row.version_number===selectedVersion&&String(row.tenant_id||'')===String(selectedTenant||'')).map((row)=>({key:row.threshold_key,label:row.label,operator:row.operator,min:row.value_min,max:row.value_max,result:row.status_result,positive:row.metadata?.positive===true}));
    const bands=validateBands(body.threshold_bands||defaultBands);const currentTrust=await trustPolicyFor(client,scope,current.id);const weights=validateWeights(body.trust_weights||currentTrust.weights);
    const definitionPayload={functional_code:current.functional_code,display_name:String(body.display_name||current.functional_display_name||current.display_name),business_definition:String(body.business_definition||current.functional_business_definition||current.business_definition),domain:String(body.domain||current.domain),objective:String(body.objective||current.objective),unit:String(body.unit||current.functional_unit||current.unit),favorable_direction:String(body.favorable_direction||current.functional_direction||current.direction),frequency:String(body.frequency||current.functional_frequency||current.frequency),population_definition:String(body.population_definition||current.population_definition),numerator_definition:body.numerator_definition??current.numerator_definition,denominator_definition:body.denominator_definition??current.denominator_definition,methodology:String(body.methodology||current.methodology),semantic_contract_code:body.semantic_contract_code??current.semantic_contract_code,version_number:version,effective_from:body.effective_from||new Date().toISOString()};
    const definitionChecksum=checksum(definitionPayload);const definition=(await client.query(`INSERT INTO metric_definition_versions(tenant_id,metric_definition_id,version_number,functional_code,display_name,business_definition,domain,objective,unit,favorable_direction,frequency,population_definition,numerator_definition,denominator_definition,methodology,semantic_contract_code,owner_user_id,reviewer_user_id,status,effective_from,checksum,created_by,metadata) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::uuid,$18::uuid,'draft',$19::timestamptz,$20,$17::uuid,$21::jsonb) RETURNING *`,[tenantId(scope),current.id,version,definitionPayload.functional_code,definitionPayload.display_name,definitionPayload.business_definition,definitionPayload.domain,definitionPayload.objective,definitionPayload.unit,definitionPayload.favorable_direction,definitionPayload.frequency,definitionPayload.population_definition,definitionPayload.numerator_definition,definitionPayload.denominator_definition,definitionPayload.methodology,definitionPayload.semantic_contract_code,actorId(scope),body.reviewer_user_id||null,definitionPayload.effective_from,definitionChecksum,JSON.stringify({reason:String(body.reason||'Nueva versión metodológica')})])).rows[0];
    const bindingPayload={metric_code:current.functional_code,version,formula_code:current.formula_code,official_formula_version_id:current.official_formula_version_id,semantic_contract_version_id:current.semantic_contract_version_id,mapping_id:current.mapping_id||null,unit:definitionPayload.unit,methodology_version:version};
    await client.query(`INSERT INTO metric_source_bindings(tenant_id,metric_key,formula_code,source_contract_id,binding_status,effective_from,created_by,metadata,metric_definition_id,definition_version_id,official_formula_version_id,semantic_contract_version_id,mapping_id,version_number,methodology_version,unit,checksum) SELECT $1::uuid,$2,formula_code,source_contract_id,'draft',$3::timestamptz,$4::uuid,$5::jsonb,$6::uuid,$7::uuid,official_formula_version_id,semantic_contract_version_id,mapping_id,$8,$8,$9,$10 FROM metric_source_bindings WHERE id=$11::uuid`,[tenantId(scope),current.functional_code,definitionPayload.effective_from,actorId(scope),JSON.stringify({immutable_official_binding:true}),current.id,definition.id,version,definitionPayload.unit,checksum(bindingPayload),current.binding_id]);
    const policyPayload={frequency:body.calculation_frequency||current.calculation_frequency,minimum_sample_size:Number(body.minimum_sample_size??current.minimum_sample_size??1),minimum_coverage:Number(body.minimum_coverage??current.calculation_policy_metadata?.minimum_coverage??0),failure_policy:body.failure_policy||current.failure_policy,timeout_ms:Number(body.timeout_ms??current.timeout_ms),max_attempts:Number(body.max_attempts??current.max_attempts),retry_backoff_seconds:Number(body.retry_backoff_seconds??current.retry_backoff_seconds),retention_periods:Number(body.retention_periods??current.retention_periods)};
    await client.query(`INSERT INTO metric_calculation_policies(tenant_id,metric_key,formula_code,calculation_frequency,stale_after,minimum_sample_size,failure_policy,status,created_by,metadata,version_number,timeout_ms,max_attempts,retry_backoff_seconds,retention_periods,checksum) VALUES($1::uuid,$2,$3,$4,NULL,$5,$6,'draft',$7::uuid,$8::jsonb,$9,$10,$11,$12,$13,$14)`,[tenantId(scope),current.functional_code,current.formula_code,policyPayload.frequency,policyPayload.minimum_sample_size,policyPayload.failure_policy,actorId(scope),JSON.stringify({minimum_coverage:policyPayload.minimum_coverage}),version,policyPayload.timeout_ms,policyPayload.max_attempts,policyPayload.retry_backoff_seconds,policyPayload.retention_periods,checksum(policyPayload)]);
    for(const band of bands)await client.query(`INSERT INTO metric_thresholds(metric_definition_id,threshold_key,label,operator,value_min,value_max,status_result,effective_from,created_by,metadata,tenant_id,version_number,direction,unit,justification,status,checksum) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::uuid,$10::jsonb,$11::uuid,$12,$13,$14,$15,'draft',$16)`,[current.id,band.key,band.label,band.operator,band.min,band.max,band.result,definitionPayload.effective_from,actorId(scope),JSON.stringify({positive:band.positive}),tenantId(scope),version,definitionPayload.favorable_direction,definitionPayload.unit,String(body.threshold_justification||'Versión metodológica gobernada.'),checksum({metric_code:current.functional_code,version,band,unit:definitionPayload.unit,direction:definitionPayload.favorable_direction})]);
    await client.query(`INSERT INTO metric_trust_policies(tenant_id,metric_definition_id,policy_code,version_number,weights,critical_dimensions,status,effective_from,checksum,created_by,metadata) VALUES($1::uuid,$2::uuid,'official_data_trust',$3,$4::jsonb,$5::text[],'draft',$6::timestamptz,$7,$8::uuid,$9::jsonb)`,[tenantId(scope),current.id,version,JSON.stringify(weights),body.critical_dimensions||currentTrust.critical_dimensions,definitionPayload.effective_from,checksum({metric_code:current.functional_code,version,weights,critical_dimensions:body.critical_dimensions||currentTrust.critical_dimensions}),actorId(scope),JSON.stringify({definition_version_id:definition.id})]);
    await audit(client,scope,'metric.methodology.draft_created','metric_definition_version',definition.id,requestId,{metric_code:current.functional_code,version,formula_unchanged:true});await client.query('COMMIT');return {definition_version_id:definition.id,metric_code:current.functional_code,version,status:'draft',checksum:definitionChecksum};
  }catch(error){await client.query('ROLLBACK').catch(()=>null);throw error;}finally{client.release();}
}

async function transitionMethodology(scope,versionId,target,requestId=null){
  if(!['reviewed','published'].includes(target))throw new IndicatorGovernanceError('INDICATOR_METHODOLOGY_STATE_INVALID','Transición metodológica inválida.',422);const client=await pool.connect();
  try{await client.query('BEGIN');const row=(await client.query(`SELECT * FROM metric_definition_versions WHERE tenant_id=$1::uuid AND id=$2::uuid FOR UPDATE`,[tenantId(scope),uuid(versionId,'definition_version_id')])).rows[0];if(!row)throw new IndicatorGovernanceError('INDICATOR_METHODOLOGY_NOT_FOUND','Versión metodológica no encontrada.',404);const expected=target==='reviewed'?'draft':'reviewed';if(row.status!==expected)throw new IndicatorGovernanceError('INDICATOR_METHODOLOGY_STATE_INVALID',`La versión debe estar ${expected}.`,409);
    const actor=actorId(scope);await client.query(`UPDATE metric_definition_versions SET status=$3,reviewed_by=CASE WHEN $3='reviewed' THEN $4::uuid ELSE reviewed_by END,reviewed_at=CASE WHEN $3='reviewed' THEN now() ELSE reviewed_at END,published_by=CASE WHEN $3='published' THEN $4::uuid ELSE published_by END,published_at=CASE WHEN $3='published' THEN now() ELSE published_at END WHERE tenant_id=$1::uuid AND id=$2::uuid`,[tenantId(scope),row.id,target,actor]);
    await client.query(`UPDATE metric_source_bindings SET binding_status=$4,reviewed_by=CASE WHEN $4='reviewed' THEN $5::uuid ELSE reviewed_by END,published_by=CASE WHEN $4='published' THEN $5::uuid ELSE published_by END,published_at=CASE WHEN $4='published' THEN now() ELSE published_at END WHERE tenant_id=$1::uuid AND definition_version_id=$2::uuid AND binding_status=$3`,[tenantId(scope),row.id,expected,target,actor]);
    await client.query(`UPDATE metric_calculation_policies SET status=$4,reviewed_by=CASE WHEN $4='reviewed' THEN $5::uuid ELSE reviewed_by END,published_by=CASE WHEN $4='published' THEN $5::uuid ELSE published_by END,published_at=CASE WHEN $4='published' THEN now() ELSE published_at END WHERE tenant_id=$1::uuid AND metric_key=$2 AND version_number=$3 AND status=$6`,[tenantId(scope),row.functional_code,row.version_number,target,actor,expected]);
    await client.query(`UPDATE metric_thresholds SET status=$4,reviewed_by=CASE WHEN $4='reviewed' THEN $5::uuid ELSE reviewed_by END,reviewed_at=CASE WHEN $4='reviewed' THEN now() ELSE reviewed_at END,published_by=CASE WHEN $4='published' THEN $5::uuid ELSE published_by END,published_at=CASE WHEN $4='published' THEN now() ELSE published_at END WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND version_number=$3 AND status=$6`,[tenantId(scope),row.metric_definition_id,row.version_number,target,actor,expected]);
    await client.query(`UPDATE metric_trust_policies SET status=$4,reviewed_by=CASE WHEN $4='reviewed' THEN $5::uuid ELSE reviewed_by END,published_by=CASE WHEN $4='published' THEN $5::uuid ELSE published_by END,published_at=CASE WHEN $4='published' THEN now() ELSE published_at END WHERE tenant_id=$1::uuid AND metric_definition_id=$2::uuid AND version_number=$3 AND status=$6`,[tenantId(scope),row.metric_definition_id,row.version_number,target,actor,expected]);
    await audit(client,scope,`metric.methodology.${target}`,'metric_definition_version',row.id,requestId,{metric_code:row.functional_code,version:row.version_number});await client.query('COMMIT');return {definition_version_id:row.id,metric_code:row.functional_code,version:Number(row.version_number),status:target};
  }catch(error){await client.query('ROLLBACK').catch(()=>null);throw error;}finally{client.release();}
}

async function exportCatalog(scope,filters={},requestId=null){
  const monthly=Number((await pool.query(`SELECT count(*)::int AS count FROM commercial_events WHERE tenant_id=$1::uuid AND event_type='metric.indicators.exported' AND created_at>=date_trunc('month',now())`,[tenantId(scope)])).rows[0].count);await resourceLimit(pool,scope,'indicator_exports_monthly',monthly,1);const catalog=await listCatalog(scope,filters);const rows=catalog.map(({definition,latest_snapshot})=>({metric_code:definition.code,name:definition.name,definition:definition.definition,unit:definition.unit,period:latest_snapshot?.period||null,state:latest_snapshot?.state||'unmeasured',value:latest_snapshot?.state==='calculated'?latest_snapshot.value:null,target:latest_snapshot?.target??null,coverage:latest_snapshot?.coverage??null,trust:latest_snapshot?.trust||{score:null,status:'unknown'},freshness:latest_snapshot?.freshness||{status:'unknown'},sufficiency:latest_snapshot?.sufficiency||{status:'source_unavailable'},interpretation:latest_snapshot?.interpretation||null,snapshot_id:latest_snapshot?.snapshot_id||null,checksum:latest_snapshot?.checksum||null}));await audit(pool,scope,'metric.indicators.exported','metric_definition',null,requestId,{format:'json',row_count:rows.length});return {format:'json',generated_at:new Date().toISOString(),rows};
}

async function createProposal(scope,snapshotId,body={},requestId=null){const id=uuid(snapshotId,'snapshot_id');const snapshot=(await pool.query(`SELECT * FROM metric_snapshots WHERE tenant_id=$1::uuid AND id=$2::uuid AND snapshot_status='published'`,[tenantId(scope),id])).rows[0];if(!snapshot)throw new IndicatorGovernanceError('INDICATOR_SNAPSHOT_NOT_FOUND','Snapshot no encontrado.',404);const proposalType=String(body.proposal_type||'review_indicator');const proposalKey=actionProposalKey({tenant_id:tenantId(scope),metric_snapshot_id:id,proposal_type:proposalType,related_entity_type:body.related_entity_type||'',related_entity_id:body.related_entity_id||''});const row=(await pool.query(`INSERT INTO metric_action_proposals(tenant_id,metric_snapshot_id,interpretation_id,proposal_type,title,rationale,priority,related_entity_type,related_entity_id,proposal_key,status,proposed_by,metadata)
    VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::uuid,$10,'proposed',$11::uuid,$12::jsonb) ON CONFLICT(tenant_id,proposal_key) DO UPDATE SET metadata=metric_action_proposals.metadata RETURNING *`,[tenantId(scope),id,body.interpretation_id||null,proposalType,String(body.title||'Revisar indicador'),String(body.rationale||'El snapshot oficial requiere revisión.'),String(body.priority||'attention'),body.related_entity_type||null,body.related_entity_id||null,proposalKey,actorId(scope),JSON.stringify(body.metadata||{})])).rows[0];await audit(pool,scope,'metric.action.proposed','metric_action_proposal',row.id,requestId,{snapshot_id:id});return row;}
async function reviewProposal(scope,proposalId,decision,body={},requestId=null){if(!['accepted','rejected'].includes(decision))throw new IndicatorGovernanceError('INDICATOR_PROPOSAL_DECISION_INVALID','Decisión inválida.',422);const row=(await pool.query(`UPDATE metric_action_proposals SET status=$3,reviewed_by=$4::uuid,reviewed_at=now(),decision_reason=$5 WHERE tenant_id=$1::uuid AND id=$2::uuid AND status='proposed' RETURNING *`,[tenantId(scope),uuid(proposalId,'proposal_id'),decision,actorId(scope),String(body.reason||'Decisión registrada')])).rows[0];if(!row)throw new IndicatorGovernanceError('INDICATOR_PROPOSAL_NOT_FOUND','Propuesta no encontrada o ya revisada.',404);await audit(pool,scope,`metric.action.${decision}`,'metric_action_proposal',row.id,requestId,{execution:'not_automatic'});return row;}

async function createJob(scope,jobType,body={},requestId=null){if(!JOB_TYPES.has(jobType))throw new IndicatorGovernanceError('INDICATOR_JOB_TYPE_INVALID','Tipo de job no permitido.',422);const active=(await pool.query(`SELECT count(*)::int AS count FROM tcdx_async_jobs WHERE tenant_id=$1::uuid AND source_module='phase5_c3_indicators' AND status IN ('queued','running')`,[tenantId(scope)])).rows[0].count;await resourceLimit(pool,scope,'indicator_jobs_concurrent',active,1);const key=String(body.idempotency_key||checksum({jobType,metric_code:body.metric_code,period:body.period||{},requestId}));const existing=(await pool.query(`SELECT id FROM tcdx_async_jobs WHERE tenant_id=$1::uuid AND source_module='phase5_c3_indicators' AND job_type=$2 AND request_payload_json->>'idempotency_key'=$3 AND status IN ('queued','running','completed') ORDER BY created_at DESC LIMIT 1`,[tenantId(scope),jobType,key])).rows[0];if(existing)return asyncJobs.getJobScoped(existing.id,{tenant_id:tenantId(scope),is_platform:false});return asyncJobs.createJob({tenant_id:tenantId(scope),user_id:actorId(scope),job_type:jobType,source_module:'phase5_c3_indicators',payload:{...body,idempotency_key:key,correlation_id:requestId},request_id:requestId});}
async function executeJob(scope,jobId){const job=await asyncJobs.getJobScoped(uuid(jobId,'job_id'),{tenant_id:tenantId(scope),is_platform:false});if(!job||job.source_module!=='phase5_c3_indicators')throw new IndicatorGovernanceError('INDICATOR_JOB_NOT_FOUND','Job no encontrado.',404);if(job.status==='completed')return job;const policy=(await pool.query('SELECT * FROM metric_job_policies WHERE job_type=$1 AND status=\'active\'',[job.job_type])).rows[0];if(!policy)throw new IndicatorGovernanceError('INDICATOR_JOB_POLICY_MISSING','Política de job no encontrada.',409);await asyncJobs.markRunning(job.id);let lastError=null;for(let attempt=1;attempt<=Number(policy.max_attempts);attempt+=1){try{const payload=job.request_payload_json||{};const operation=async()=>{if(job.job_type==='metric.calculate')return calculateIndicator(scope,payload.metric_code,payload,job.request_id);if(job.job_type==='metric.snapshot')return createSnapshot(scope,payload.metric_code,payload,job.request_id);if(job.job_type==='metric.compare')return createComparison(scope,payload.metric_code,payload,job.request_id);if(job.job_type==='metric.freshness'){const item=await getIndicator(scope,payload.metric_code);return {metric_code:payload.metric_code,freshness:item.latest_snapshot?.freshness||{status:'unknown'}};}if(job.job_type==='metric.alert'){const latest=await getIndicator(scope,payload.metric_code);const positive=latest.latest_snapshot?.interpretation?.classification?.positive===true;if(!latest.latest_snapshot||latest.latest_snapshot.state==='calculated'&&positive)return {created:0};return {created:1,proposal:await createProposal(scope,latest.latest_snapshot.snapshot_id,{title:'Revisar alerta de indicador',rationale:'El snapshot oficial requiere atención.',priority:'attention'},job.request_id)};}if(job.job_type==='metric.reconcile'){const catalog=await listCatalog(scope);return {catalog_count:catalog.length,without_snapshot:catalog.filter((item)=>!item.latest_snapshot).length};}if(job.job_type==='metric.retention'){const count=(await pool.query(`SELECT count(*)::int AS count FROM metric_snapshots WHERE tenant_id=$1::uuid AND snapshot_status='published'`,[tenantId(scope)])).rows[0].count;await resourceLimit(pool,scope,'indicator_snapshots_retained',count,0);return {retained_published_snapshots:count,deleted:0,reason:'published_immutable'};}throw new Error('unsupported');};let timeoutId;const timeout=new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new IndicatorGovernanceError('INDICATOR_JOB_TIMEOUT','Job excedió timeout.',504)),Number(policy.timeout_ms));});let result;try{result=await Promise.race([operation(),timeout]);}finally{clearTimeout(timeoutId);}return asyncJobs.markCompleted(job.id,{result_json:{...result,attempts:attempt,correlation_id:job.request_id}});}catch(error){lastError=error;if(attempt<Number(policy.max_attempts)){const delay=Math.min(Number(policy.retry_backoff_seconds)*1000*(2**(attempt-1)),Number(policy.timeout_ms));await pool.query(`UPDATE tcdx_async_jobs SET error_json=$2::jsonb,updated_at=now() WHERE tenant_id=$1::uuid AND id=$3::uuid`,[tenantId(scope),JSON.stringify({code:error.code||'INDICATOR_JOB_RETRY',message:serializeError(error),attempt,next_retry_after_ms:delay}),job.id]);await new Promise((resolve)=>setTimeout(resolve,delay));}}}
  return asyncJobs.markFailed(job.id,{error_json:{code:lastError?.code||'INDICATOR_JOB_FAILED',message:serializeError(lastError),attempts:Number(policy.max_attempts)}});
}
async function listJobs(scope,filters={}){return asyncJobs.listJobsScoped({tenant_id:tenantId(scope),is_platform:false},{job_type:filters.job_type||null,status:filters.status||null,limit:limit(filters.limit,25,100)});}

module.exports={ IndicatorGovernanceError, resolveIndicator, listCatalog, dashboard, recalculateCatalog, getIndicator, calculateIndicator, createSnapshot, publishSnapshot, history, createComparison, comparisons, methodology, createMethodologyDraft, transitionMethodology, exportCatalog, createProposal, reviewProposal, createJob, executeJob, listJobs, buildOfficialMeasurementPersistence, reconcileSufficiencyWithOfficialState };
