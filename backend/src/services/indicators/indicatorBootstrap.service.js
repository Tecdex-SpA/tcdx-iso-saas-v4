'use strict';

const { FUNCTIONAL_INDICATORS } = require('./functionalIndicatorCatalog');
const { TRUST_DIMENSIONS, checksum } = require('./indicatorCore');
const { getSourceCodeForIndicator } = require('../math-governance/sourceContracts.service');

const TRUST_WEIGHTS = Object.freeze({ completeness:0.15,accuracy:0.15,consistency:0.10,freshness:0.15,lineage:0.15,validation:0.10,stability:0.05,coverage:0.15 });

async function bootstrapIndicators(client) {
  const counts = { definitions:0,versions:0,bindings:0,policies:0,thresholds:0,trust_policies:0 };
  for (const indicator of FUNCTIONAL_INDICATORS) {
    const definition = (await client.query(
      `INSERT INTO metric_definitions(tenant_id,metric_code,display_name,business_definition,technical_definition,metric_type,unit,direction,aggregation,frequency,status,metadata)
       VALUES(NULL,$1,$2,$3,$4,$5,$6,$7,'custom_declarative',$8,'published',$9::jsonb)
       ON CONFLICT (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_code) DO UPDATE
       SET display_name=EXCLUDED.display_name,business_definition=EXCLUDED.business_definition,technical_definition=EXCLUDED.technical_definition,
           metric_type=EXCLUDED.metric_type,unit=EXCLUDED.unit,direction=EXCLUDED.direction,frequency=EXCLUDED.frequency,metadata=metric_definitions.metadata||EXCLUDED.metadata,updated_at=now()
       RETURNING id`,
      [indicator.functional_code,indicator.display_name,indicator.business_definition,indicator.methodology,indicator.metric_type,indicator.unit,indicator.direction,indicator.frequency,JSON.stringify({ phase:'5-C3',functional:true,catalog_checksum:indicator.checksum })]
    )).rows[0];
    counts.definitions += 1;
    const version = (await client.query(
      `INSERT INTO metric_definition_versions(tenant_id,metric_definition_id,version_number,functional_code,display_name,business_definition,domain,objective,unit,favorable_direction,frequency,population_definition,methodology,status,effective_from,checksum,published_at,metadata)
       VALUES(NULL,$1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published','2026-08-07T00:00:00Z',$13,now(),$14::jsonb)
       ON CONFLICT(metric_definition_id,version_number) DO NOTHING RETURNING id`,
      [definition.id,indicator.version_number,indicator.functional_code,indicator.display_name,indicator.business_definition,indicator.domain,indicator.objective,indicator.unit,indicator.direction,indicator.frequency,indicator.population_definition,indicator.methodology,indicator.checksum,JSON.stringify({ formula_code:indicator.formula_code,minimum_coverage:indicator.minimum_coverage })]
    )).rows[0] || (await client.query('SELECT id FROM metric_definition_versions WHERE metric_definition_id=$1 AND version_number=$2',[definition.id,indicator.version_number])).rows[0];
    counts.versions += 1;

    const sourceCode = getSourceCodeForIndicator(indicator.functional_code, indicator.formula_code);
    const official = (await client.query(
      `SELECT ofv.id AS formula_version_id,ofsc.id AS source_contract_id
       FROM official_formula_versions ofv JOIN official_formula_definitions ofd ON ofd.id=ofv.formula_definition_id
       LEFT JOIN official_formula_source_contracts ofsc ON ofsc.source_code=$2 AND ofsc.status='published'
       WHERE ofd.formula_code=$1 AND ofv.status='published' ORDER BY ofv.version_number DESC,ofsc.version_number DESC LIMIT 1`,
      [indicator.formula_code,sourceCode]
    )).rows[0];
    if (!official?.formula_version_id) throw new Error(`Published official formula missing for ${indicator.functional_code}`);
    const semantic = (await client.query(
      `SELECT dscv.id FROM data_source_contracts dsc JOIN data_source_contract_versions dscv ON dscv.contract_id=dsc.id
       WHERE dsc.source_code=$1 AND dscv.status='published' ORDER BY dsc.tenant_id NULLS FIRST,dscv.version_number DESC LIMIT 1`,[sourceCode]
    )).rows[0];
    if (!semantic?.id) throw new Error(`Published semantic contract missing for ${indicator.functional_code}`);
    const latestBinding = (await client.query(
      `SELECT version_number,metadata->>'source_code' AS source_code,
              semantic_contract_version_id::text AS semantic_contract_version_id,
              official_formula_version_id::text AS official_formula_version_id
       FROM metric_source_bindings
       WHERE tenant_id IS NULL AND metric_key=$1 AND binding_status='published'
       ORDER BY version_number DESC LIMIT 1`,
      [indicator.functional_code]
    )).rows[0];
    const bindingChanged = Boolean(latestBinding) && (
      latestBinding.source_code !== sourceCode
      || String(latestBinding.semantic_contract_version_id || '') !== String(semantic.id)
      || String(latestBinding.official_formula_version_id || '') !== String(official.formula_version_id)
    );
    const bindingVersion = latestBinding
      ? Number(latestBinding.version_number) + (bindingChanged ? 1 : 0)
      : 1;
    const bindingChecksum = checksum({ code:indicator.functional_code,formula:indicator.formula_code,formula_version_id:official.formula_version_id,semantic_contract_version_id:semantic.id,source_code:sourceCode,unit:indicator.unit,version:bindingVersion });
    await client.query(
      `INSERT INTO metric_source_bindings(tenant_id,metric_key,formula_code,source_contract_id,binding_status,effective_from,metadata,metric_definition_id,definition_version_id,official_formula_version_id,semantic_contract_version_id,version_number,methodology_version,unit,checksum,published_at)
       VALUES(NULL,$1,$2,$3::uuid,'published','2026-08-07T00:00:00Z',$4::jsonb,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9,$9,$10,$11,now())
       ON CONFLICT (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_key,version_number) DO NOTHING`,
      [indicator.functional_code,indicator.formula_code,official.source_contract_id,JSON.stringify({ source_code:sourceCode, supersedes_source_code:latestBinding?.source_code || null }),definition.id,version.id,official.formula_version_id,semantic.id,bindingVersion,indicator.unit,bindingChecksum]
    );
    counts.bindings += 1;
    const policyPayload = { frequency:indicator.frequency,minimum_sample_size:1,minimum_coverage:indicator.minimum_coverage,failure_policy:'mark_unmeasured',timeout_ms:30000,max_attempts:3,retry_backoff_seconds:30,retention_periods:24 };
    await client.query(
      `INSERT INTO metric_calculation_policies(tenant_id,metric_key,formula_code,calculation_frequency,stale_after,minimum_sample_size,failure_policy,status,metadata,version_number,timeout_ms,max_attempts,retry_backoff_seconds,retention_periods,checksum,published_at)
       VALUES(NULL,$1,$2,$3,NULL,1,'mark_unmeasured','published',$4::jsonb,1,30000,3,30,24,$5,now())
       ON CONFLICT (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_key,version_number) DO NOTHING`,
      [indicator.functional_code,indicator.formula_code,indicator.frequency==='semiannual'?'quarterly':indicator.frequency,JSON.stringify({ minimum_coverage:indicator.minimum_coverage }),checksum(policyPayload)]
    );
    counts.policies += 1;
    for (const band of indicator.threshold_bands) {
      const thresholdChecksum = checksum({ code:indicator.functional_code,version:1,band,unit:indicator.unit,direction:indicator.direction });
      await client.query(
        `INSERT INTO metric_thresholds(metric_definition_id,threshold_key,label,operator,value_min,value_max,status_result,effective_from,metadata,tenant_id,version_number,direction,unit,justification,status,checksum,published_at)
         VALUES($1::uuid,$2,$3,$4,$5,$6,$7,'2026-08-07T00:00:00Z',$8::jsonb,NULL,1,$9,$10,'Bandas iniciales documentales; toda evolución crea nueva versión.','published',$11,now())
         ON CONFLICT (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),metric_definition_id,version_number,threshold_key) DO NOTHING`,
        [definition.id,band.key,band.label,band.operator,band.min,band.max,band.result,JSON.stringify({ positive:band.positive }),indicator.direction,indicator.unit,thresholdChecksum]
      );
      counts.thresholds += 1;
    }
  }
  const trustChecksum = checksum({ weights:TRUST_WEIGHTS,dimensions:TRUST_DIMENSIONS,critical:['freshness','lineage','validation','coverage'],version:1 });
  await client.query(
    `INSERT INTO metric_trust_policies(tenant_id,metric_definition_id,policy_code,version_number,weights,critical_dimensions,status,effective_from,checksum,published_at,metadata)
     VALUES(NULL,NULL,'official_data_trust',1,$1::jsonb,ARRAY['freshness','lineage','validation','coverage'],'published','2026-08-07T00:00:00Z',$2,now(),$3::jsonb)
     ON CONFLICT (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),policy_code,version_number) DO NOTHING`,
    [JSON.stringify(TRUST_WEIGHTS),trustChecksum,JSON.stringify({ dimensions:TRUST_DIMENSIONS })]
  );
  counts.trust_policies = 1;
  return counts;
}

module.exports = { TRUST_WEIGHTS, bootstrapIndicators };
