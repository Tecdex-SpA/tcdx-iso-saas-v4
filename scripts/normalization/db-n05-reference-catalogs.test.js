#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const loaderPath = path.join(root, 'scripts/normalization/load-production-reference-catalogs.js');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const kbPath = path.join(root, 'database/seeds/knowledge/knowledge_base_seed_v2.jsonl');
const isoManifestPath = path.join(root, 'database/reference/iso/manifest.json');
const qaAuditPath = path.join(root, 'artifacts/db-n05/qa-catalog-audit/DB-N05_CATALOG_AUDIT_RESULT.txt');
const { FORMULAS } = require(path.join(root, 'backend/src/services/math-governance/formulaRegistry.service'));
const { listSourceContracts } = require(path.join(root, 'backend/src/services/math-governance/sourceContracts.service'));
const { FUNCTIONAL_INDICATORS } = require(path.join(root, 'backend/src/services/indicators/functionalIndicatorCatalog'));
const {
  approvedIsoReferenceSources,
  controlRowsFromKnowledge,
  readIsoReferenceManifest,
} = require(loaderPath);

const loader = fs.readFileSync(loaderPath, 'utf8');
const seed = fs.readFileSync(seedPath, 'utf8');
const manifest = readIsoReferenceManifest({ required: true });
const qaAudit = fs.readFileSync(qaAuditPath, 'utf8');
const bundles = fs.readFileSync(kbPath, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));

const { validatedIsoReferenceSources } = require(loaderPath);
const crypto = require('crypto');
const sources = validatedIsoReferenceSources(manifest);
const expected = [
  ['ISO27001','2022',21,19,'approved_for_loader'],
  ['ISO42001','2023',16,14,'approved_for_loader'],
  ['ISO9001','2015',16,13,'approved_for_loader'],
  ['ISO9001','2026_FDIS',8,8,'transition_only'],
];
assert.deepEqual(sources.map(s => [s.standard_code,s.version_code,s.row_count,s.evidence_row_count,s.status]),expected);
assert.equal(approvedIsoReferenceSources(manifest).length,3);
const exportPath = path.join(root,manifest.source_audit);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(exportPath)).digest('hex'),manifest.source_sha256);
for (const source of sources) {
  assert.equal(source.certifiable,source.status === 'approved_for_loader');
  assert.equal(source.loader_status,source.status);
  if (source.status === 'transition_only') assert.equal(source.product_standard_code,null);
}
const current = sources.find(s => s.standard_code==='ISO9001' && s.version_code==='2015');
const fdis = sources.find(s => s.version_code==='2026_FDIS');
assert.notEqual(current.controls_file,fdis.controls_file);
assert.equal(fdis.publication_status,'transition_prep');
assert.equal(fdis.certifiable,false);
assert.doesNotMatch(JSON.stringify(manifest), /ISO_27701|ISO_27017|ISO_27018/);
assert.match(loader, /loadProductionReferenceCatalogs/, 'production loader must export orchestrator');
assert.match(loader, /syncMathGovernanceCatalog/, 'loader must reuse official formula/source-contract bootstrap');
assert.match(loader, /bootstrapSemanticRegistry/, 'loader must reuse semantic registry bootstrap');
assert.match(loader, /bootstrapIndicators/, 'loader must reuse functional indicator bootstrap');
assert.match(loader, /loadKnowledgeBaseSeed/, 'loader must reuse KB v2 loader');
assert.match(loader, /ON CONFLICT/g, 'loader must be idempotent through natural-key upserts');
assert.match(loader, /database\/reference\/iso/, 'loader must support versioned ISO reference files');
assert.match(loader, /approvedIsoReferenceSources/, 'loader must gate migrated QA references through manifest approval');

assert.doesNotMatch(loader, /192\.168\.2\.40|tecdex_saas|example\.com|Fresh Tenant/i, 'production loader must not embed QA/demo/runtime host data');
assert.doesNotMatch(seed, /example\.com|Fresh Tenant|192\.168\.2\.40/i, 'production seed must not embed QA/demo/runtime host data');
assert.match(seed, /TEST_FIXTURE_ONLY/, 'three-control compatibility seed must be explicitly classified as test-only');

const standardSources = new Set(bundles.map((bundle) => bundle.source_key));
for (const required of ['iso_9001_2015', 'iso_27001_2022', 'nist_csf_2_0', 'nist_ai_rmf_1_0']) {
  assert.ok(standardSources.has(required), `KB v2 must include supported standard source ${required}`);
}

const controls = controlRowsFromKnowledge(bundles);
const sourceCodes = [...new Set(bundles.filter(b => b.source_key === 'iso_27001_2022').map(b => String(b.clause_or_control || '').trim()).filter(c => /^A\.\d+(?:\.\d+)?$/.test(c)))].sort();
assert.deepEqual(controls.map(c => c.code).sort(), sourceCodes, 'loader must cover every eligible code in the versioned source');
assert.ok(controls.some((control) => control.code === 'A.5'), 'ISO 27001 Annex A control family must be present');
assert.ok(controls.some((control) => /^A\.5\.\d+$/.test(control.code)), 'ISO 27001 Annex A child controls must be present');
assert.equal(new Set(controls.map((control) => control.code)).size, controls.length, 'control natural keys must be unique');

const permissionRows = Array.from(seed.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*true\)/g))
  .map((match) => ({ key: match[1], group: match[2], name: match[3] }));
for (const required of ['data.semantic_layer', 'metrics.indicators.read', 'metrics.data_trust', 'knowledge.read', 'knowledge.ingest', 'regulatory.read', 'grc.connectors.manage', 'grc.escalations.manage', 'grc.gaps.manage', 'ai.view']) {
  assert.ok(permissionRows.some((row) => row.key === required), `permission catalog missing ${required}`);
}
assert.equal(new Set(permissionRows.map((row) => row.key)).size, permissionRows.length, 'permission natural keys must be unique');

assert.ok(Array.isArray(FORMULAS) && FORMULAS.length > 1, 'formula catalog must be loadable from runtime registry');
assert.ok(listSourceContracts().length > 1, 'source contracts must be loadable from runtime registry');
assert.ok(Array.isArray(FUNCTIONAL_INDICATORS) && FUNCTIONAL_INDICATORS.length > 1, 'functional indicators must be loadable from runtime catalog');
assert.ok(bundles.length >= 1000, 'KB v2 source must be present as governed reproducible catalog');

assert.match(loader, /regulatory.*schema.*ready|regulatory_authoritative_sources|STANDARD_KEY_BY_SOURCE/is, 'regulatory posture must remain governed metadata/schema ready');
assert.doesNotMatch(loader, /INSERT INTO legal_obligations/i, 'loader must not invent legal obligations without governed authoritative source content');

console.log(`REFERENCE_SOURCE_COVERAGE PASS kb=${bundles.length} iso_codes=${controls.length}`);
console.log('VERSIONED_ISO_SOURCES PASS controls=61 evidence=54 approved=3 TRANSITION_ONLY=ISO9001:2026_FDIS');
console.log('PRODUCTION_REFERENCE_CATALOGS PASS reviewed-export-coverage=PASS; final ISO9001:2026 not represented as certifiable');
