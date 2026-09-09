#!/usr/bin/env node
'use strict';

const path = require('path');
const { Pool } = require('../../backend/node_modules/pg');
const { syncMathGovernanceCatalog } = require('../../backend/src/services/math-governance/formulaBootstrap.service');
const { bootstrapSemanticRegistry } = require('../../backend/src/services/semantic/semanticBootstrap.service');
const { bootstrapIndicators } = require('../../backend/src/services/indicators/indicatorBootstrap.service');
const { loadKnowledgeBaseSeed, readJsonl } = require('../../backend/scripts/load-knowledge-base-seed');

const { COMMERCIAL_PLAN_CAPABILITIES, planAllowsCapability } = require('../../backend/src/services/commercial/commercialPlanMatrix.service');
const { INITIAL_MODULES } = require('../../backend/src/services/commercial/commercialCatalog');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const KNOWLEDGE_JSONL = path.join(REPO_ROOT, 'database/seeds/knowledge/knowledge_base_seed_v2.jsonl');
const ISO_REFERENCE_DIR = path.join(REPO_ROOT, 'database/reference/iso');
const ISO_REFERENCE_MANIFEST = path.join(ISO_REFERENCE_DIR, 'manifest.json');

const STANDARD_KEY_BY_SOURCE = Object.freeze({
  iso_9001_2015: 'ISO_9001_2015',
  iso_27001_2022: 'ISO_27001_2022',
  nist_csf_2_0: 'NIST_CSF_2_0',
  nist_ai_rmf_1_0: 'NIST_AI_RMF_1_0',
});

const FAMILY_BY_SOURCE = Object.freeze({
  iso_9001_2015: 'ISO_9001',
  iso_27001_2022: 'ISO_27001',
  nist_csf_2_0: 'NIST_CSF',
  nist_ai_rmf_1_0: 'NIST_AI_RMF',
});

const VERSION_BY_SOURCE = Object.freeze({
  iso_9001_2015: '2015 + AMD 1:2024',
  iso_27001_2022: '2022',
  nist_csf_2_0: '2.0',
  nist_ai_rmf_1_0: '1.0',
});

function displayNameForSource(sourceKey, bundle) {
  const raw = bundle?.standard_code || sourceKey;
  return raw.replace(/\s*\+\s*Amd/i, ' + AMD');
}

function controlRowsFromKnowledge(bundles) {
  const byCode = new Map();
  for (const bundle of bundles) {
    if (bundle.source_key !== 'iso_27001_2022') continue;
    const code = String(bundle.clause_or_control || '').trim();
    if (!/^A\.\d+(?:\.\d+)?$/.test(code)) continue;
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        title: bundle.domain || bundle.title || code,
        domain: bundle.domain || null,
        description: bundle.intent_summary || null,
        source_record_id: bundle.source_record_id || null,
      });
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

function readIsoReferenceManifest({ required = false } = {}) {
  const fs = require('fs');
  if (!fs.existsSync(ISO_REFERENCE_MANIFEST)) {
    if (required) throw new Error(`Missing ISO reference manifest: ${ISO_REFERENCE_MANIFEST}`);
    return { schema: 'tcdx.iso_reference_manifest', version: 1, standards: [] };
  }
  return JSON.parse(fs.readFileSync(ISO_REFERENCE_MANIFEST, 'utf8'));
}

function approvedIsoReferenceSources(manifest = readIsoReferenceManifest()) {
  return (manifest.standards || []).filter(entry => entry.source_type === 'migrated_reference_from_qa'
    && entry.status === 'approved_for_loader' && entry.loader_status === 'approved_for_loader');
}

function validatedIsoReferenceSources(manifest = readIsoReferenceManifest({ required: true })) {
  const fs = require('fs');
  const crypto = require('crypto');
  if (manifest.schema !== 'tcdx.iso_reference_manifest' || manifest.version !== 2 || !Array.isArray(manifest.standards)) {
    throw new Error('Invalid ISO reference manifest');
  }
  const seenVersions = new Set();
  function readFile(source, field, checksumKey, jsonl = false) {
    const relative = source[field];
    if (typeof relative !== 'string' || !relative) throw new Error(`Missing ISO reference file: ${field}`);
    const filename = path.resolve(ISO_REFERENCE_DIR, relative);
    if (!filename.startsWith(`${ISO_REFERENCE_DIR}${path.sep}`) || !fs.existsSync(filename)
        || !fs.realpathSync(filename).startsWith(`${fs.realpathSync(ISO_REFERENCE_DIR)}${path.sep}`)) {
      throw new Error(`ISO reference file missing or outside reference directory: ${relative}`);
    }
    const bytes = fs.readFileSync(filename);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.sha256?.[checksumKey]) throw new Error(`ISO reference checksum mismatch: ${relative}`);
    const text = bytes.toString('utf8');
    return jsonl ? text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : JSON.parse(text);
  }
  return manifest.standards.map(source => {
    const key = `${source.standard_code}:${source.version_code}`;
    if (seenVersions.has(key)) throw new Error(`Duplicate ISO reference version: ${key}`);
    seenVersions.add(key);
    if (source.source_type !== 'migrated_reference_from_qa' || source.source_audit !== manifest.source_audit
        || source.status !== source.loader_status || !['approved_for_loader', 'transition_only'].includes(source.status)) {
      throw new Error(`Unapproved ISO reference source: ${key}`);
    }
    const transition = source.status === 'transition_only';
    if (transition ? (source.certifiable !== false || source.publication_status !== 'transition_prep' || source.product_standard_code !== null)
      : (source.certifiable !== true || source.publication_status !== 'published' || !source.product_standard_code)) {
      throw new Error(`Invalid certification/transition policy: ${key}`);
    }
    const controls = readFile(source, 'controls_file', 'controls', true);
    const evidence = readFile(source, 'evidence_expectations_file', 'evidence_expectations', true);
    const metadata = readFile(source, 'metadata_file', 'metadata');
    if (!Number.isInteger(source.row_count) || source.row_count <= 0 || controls.length !== source.row_count
        || !Number.isInteger(source.evidence_row_count) || source.evidence_row_count < 0 || evidence.length !== source.evidence_row_count) {
      throw new Error(`ISO reference row_count mismatch: ${key}`);
    }
    for (const field of ['standard_code', 'version_code', 'publication_status', 'certifiable', 'status', 'source_audit']) {
      if (metadata[field] !== source[field]) throw new Error(`ISO reference metadata mismatch: ${key}:${field}`);
    }
    if (metadata.standard.standard_code !== source.standard_code || metadata.source_sha256 !== manifest.source_sha256) {
      throw new Error(`ISO reference provenance mismatch: ${key}`);
    }
    const codes = new Set();
    for (const row of controls) {
      if (row.standard_code !== source.standard_code || row.version_code !== source.version_code) throw new Error(`ISO control version mismatch: ${key}`);
      if (typeof row.control_code !== 'string' || !row.control_code.trim() || row.control_code !== row.control_code.trim()) throw new Error(`ISO reference row without code: ${key}`);
      if (codes.has(row.control_code)) throw new Error(`Duplicate ISO reference control code: ${key}:${row.control_code}`);
      if (typeof row.title !== 'string' || !row.title.trim()) throw new Error(`ISO reference row without title: ${key}`);
      if (typeof row.is_active !== 'boolean') throw new Error(`ISO reference invalid is_active: ${key}`);
      codes.add(row.control_code);
    }
    const evidenceKeys = new Set();
    for (const row of evidence) {
      if (row.standard_code !== source.standard_code || row.version_code !== source.version_code || !codes.has(row.control_code)) throw new Error(`Unresolved ISO evidence control/version: ${key}`);
      if (!row.evidence_name?.trim() || !row.evidence_type?.trim()) throw new Error(`Invalid ISO evidence identity: ${key}`);
      const evidenceKey = JSON.stringify([row.control_code, row.evidence_type, row.evidence_name]);
      if (evidenceKeys.has(evidenceKey)) throw new Error(`Duplicate ISO evidence identity: ${key}`);
      evidenceKeys.add(evidenceKey);
    }
    return { ...source, controls, evidence, metadata };
  });
}

// Identifiers below are internal constants, never manifest-provided SQL identifiers.
async function upsertIsoRow(client, table, fields, values, keys) {
  const updates = fields.filter(field => !keys.includes(field)).map(field => `${field}=EXCLUDED.${field}`).join(',');
  return (await client.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((_, i) => `$${i+1}`).join(',')})
    ON CONFLICT (${keys.join(',')}) DO UPDATE SET ${updates} RETURNING id`, values)).rows[0].id;
}

async function loadVersionedIsoReferenceCatalogs(client, { manifest = readIsoReferenceManifest({ required: true }) } = {}) {
  const sources = validatedIsoReferenceSources(manifest); // Validate every file before any write.
  let controls = 0;
  let evidenceExpectations = 0;
  for (const source of sources) {
    const meta = source.metadata;
    const provenance = { source: 'database/reference/iso', source_type: source.source_type, source_audit: source.source_audit,
      source_sha256: manifest.source_sha256, sha256: source.sha256, publication_status: source.publication_status,
      certifiable: source.certifiable, status: source.status, version_code: source.version_code };
    if (source.status === 'approved_for_loader') {
      await client.query(`INSERT INTO standards (standard_code,family,display_name,version_label,is_active,metadata)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (standard_code) DO UPDATE SET family=EXCLUDED.family,
        display_name=EXCLUDED.display_name,version_label=EXCLUDED.version_label,is_active=EXCLUDED.is_active,
        metadata=standards.metadata || EXCLUDED.metadata`,
      [source.product_standard_code,meta.standard.family,meta.display_name,source.version_code,meta.is_active,provenance]);
    }
    const standardFields = ['standard_code','display_name','family','description','is_active'];
    const standardId = await upsertIsoRow(client,'iso_standards',[...standardFields,'metadata'],[...standardFields.map(k=>meta.standard[k]),{source_audit:source.source_audit,source_sha256:manifest.source_sha256}],['standard_code']);
    const versionFields = ['standard_code','version_code','display_name','publication_status','certifiable','replaces_version','effective_from','transition_until','source_policy','notes','is_active','status'];
    const versionId = await upsertIsoRow(client,'iso_standard_versions',['standard_id','product_standard_code',...versionFields,'metadata'],[standardId,source.product_standard_code,...versionFields.map(k=>meta[k]),provenance],['standard_code','version_code']);
    const controlIds = new Map();
    const controlFields = ['standard_code','version_code','control_code','title','description','control_type','domain','default_priority','default_frequency','owner_role_suggested','copyright_safe_summary','is_active'];
    for (const row of source.controls) {
      const id = await upsertIsoRow(client,'iso_controls',['standard_version_id',...controlFields,'metadata'],[versionId,...controlFields.map(k=>row[k]),provenance],['standard_code','version_code','control_code']);
      controlIds.set(row.control_code,id);
      if (source.status === 'approved_for_loader') {
        const result = await client.query(`INSERT INTO controls_catalog (code,clause,title,iso,domain,category,description,source_type,is_active,metadata)
          VALUES ($1,$1,$2,$3,$4,$5,$6,'migrated_reference_from_qa',$7,$8)
          ON CONFLICT (iso,code) DO UPDATE SET clause=EXCLUDED.clause,title=EXCLUDED.title,domain=EXCLUDED.domain,
          category=EXCLUDED.category,description=EXCLUDED.description,source_type=EXCLUDED.source_type,
          is_active=EXCLUDED.is_active,metadata=controls_catalog.metadata || EXCLUDED.metadata RETURNING id`,
        [row.control_code,row.title,source.product_standard_code,row.domain,row.control_type,row.description,row.is_active,{...provenance,source_table:'iso_controls',control_code:row.control_code}]);
        await client.query(`INSERT INTO controls_catalog_standards(control_id,standard_code,is_primary) VALUES($1,$2,true)
          ON CONFLICT(control_id,standard_code) DO UPDATE SET is_primary=EXCLUDED.is_primary`,[result.rows[0].id,source.product_standard_code]);
      }
      controls++;
    }
    const evidenceFields = ['standard_code','version_code','control_code','evidence_name','evidence_type','description','required_level','freshness_days','validation_criteria','ai_review_guidance'];
    for (const row of source.evidence) {
      await upsertIsoRow(client,'iso_evidence_expectations',['standard_version_id','control_id',...evidenceFields,'metadata'],[versionId,controlIds.get(row.control_code),...evidenceFields.map(k=>row[k]),provenance],['standard_code','version_code','control_code','evidence_type','evidence_name']);
      evidenceExpectations++;
    }
  }
  return { standards: new Set(sources.map(s=>s.standard_code)).size, versions:sources.length, controls, evidenceExpectations, sources:sources.length };
}

async function loadStandardsFromKnowledge(client, bundles) {
  const bySource = new Map();
  for (const bundle of bundles) {
    const standardCode = STANDARD_KEY_BY_SOURCE[bundle.source_key];
    if (!standardCode || bySource.has(bundle.source_key)) continue;
    bySource.set(bundle.source_key, bundle);
  }
  for (const [sourceKey, bundle] of bySource.entries()) {
    await client.query(
      `
      INSERT INTO standards (standard_code, family, display_name, version_label, is_active, metadata)
      VALUES ($1, $2, $3, $4, true, $5::jsonb)
      ON CONFLICT (standard_code) DO UPDATE SET
        family = EXCLUDED.family,
        display_name = EXCLUDED.display_name,
        version_label = EXCLUDED.version_label,
        is_active = true,
        metadata = standards.metadata || EXCLUDED.metadata
      `,
      [
        STANDARD_KEY_BY_SOURCE[sourceKey],
        FAMILY_BY_SOURCE[sourceKey],
        displayNameForSource(sourceKey, bundle),
        VERSION_BY_SOURCE[sourceKey],
        JSON.stringify({ source: 'knowledge_base_seed_v2', source_key: sourceKey, production_reference: true }),
      ]
    );
  }
  return bySource.size;
}

async function loadControlsFromKnowledge(client, bundles) {
  const controls = controlRowsFromKnowledge(bundles);
  const authoritative = approvedIsoReferenceSources().some(s => s.product_standard_code === 'ISO_27001_2022');
  for (const control of controls) {
    const result = await client.query(
      `
      INSERT INTO controls_catalog (code, clause, title, iso, domain, category, description, source_type, is_active, metadata)
      VALUES ($1, $1, $2, 'ISO_27001_2022', $3, $3, $4, 'knowledge_base_seed_v2', true, $5::jsonb)
      ON CONFLICT (iso, code) DO UPDATE SET
        clause = EXCLUDED.clause,
        title = EXCLUDED.title,
        domain = EXCLUDED.domain,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        source_type = EXCLUDED.source_type,
        is_active = EXCLUDED.is_active,
        metadata = controls_catalog.metadata || EXCLUDED.metadata
      RETURNING id
      `,
      [
        control.code,
        control.title,
        control.domain,
        control.description,
        JSON.stringify({ source: 'knowledge_base_seed_v2', source_record_id: control.source_record_id, production_reference: true, compatibility_only: authoritative }),
      ]
    );
    await client.query(
      `
      INSERT INTO controls_catalog_standards (control_id, standard_code, is_primary)
      VALUES ($1, 'ISO_27001_2022', true)
      ON CONFLICT (control_id, standard_code) DO UPDATE SET is_primary = true
      `,
      [result.rows[0].id]
    );
  }
  return controls.length;
}

async function loadCommercialReferences(client) {
  for (const [key, displayName] of INITIAL_MODULES) {
    await client.query(`INSERT INTO saas_modules(module_key,display_name,is_active) VALUES($1,$2,true)
      ON CONFLICT(module_key) DO UPDATE SET display_name=EXCLUDED.display_name,is_active=true`, [key, displayName]);
  }
  for (const cap of COMMERCIAL_PLAN_CAPABILITIES) {
    if (cap.required_permission) {
      // Register referenced permission identity without granting it to any role.
      await client.query(`INSERT INTO permissions(permission_key,permission_group,display_name,description,is_active)
        VALUES($1,$2,$3,$3,true) ON CONFLICT(permission_key) DO NOTHING`,
      [cap.required_permission, cap.module_key, cap.functional_capability]);
    }
    await client.query(`INSERT INTO commercial_technical_capabilities
      (capability_key,module_key,display_name,description,classification,required_permission,status,is_active)
      VALUES($1,$2,$3,$3,$4,$5,'active',true) ON CONFLICT(capability_key) DO UPDATE SET
      module_key=EXCLUDED.module_key,display_name=EXCLUDED.display_name,description=EXCLUDED.description,
      classification=EXCLUDED.classification,required_permission=EXCLUDED.required_permission,status='active',is_active=true`,
    [cap.capability_key,cap.module_key,cap.functional_capability,cap.classification,cap.required_permission]);
  }
  const versions = await client.query("SELECT id,plan_key FROM commercial_plan_versions WHERE status='published'");
  for (const version of versions.rows) {
    for (const cap of COMMERCIAL_PLAN_CAPABILITIES) {
      await client.query(`INSERT INTO plan_version_capabilities(plan_version_id,capability_key,is_included)
        VALUES($1,$2,$3) ON CONFLICT(plan_version_id,capability_key) DO UPDATE SET is_included=EXCLUDED.is_included`,
      [version.id,cap.capability_key,planAllowsCapability(version.plan_key,cap.capability_key)]);
    }
  }
  return { modules: INITIAL_MODULES.length, capabilities: COMMERCIAL_PLAN_CAPABILITIES.length };
}

async function loadProductionReferenceCatalogs({ db, logger = console, closePool = false } = {}) {
  validatedIsoReferenceSources();
  const pool = db || new Pool({ connectionString: process.env.DATABASE_URL || process.env.MIGRATION_DATABASE_URL });
  const bundles = readJsonl(KNOWLEDGE_JSONL);
  const summary = {
    standards: 0,
    controls: 0,
    formulas: null,
    semantic: null,
    indicators: null,
    knowledge: null,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    summary.commercial = await loadCommercialReferences(client);
    summary.standards = await loadStandardsFromKnowledge(client, bundles);
    summary.controls = await loadControlsFromKnowledge(client, bundles);
    summary.isoReference = await loadVersionedIsoReferenceCatalogs(client);
    summary.formulas = await syncMathGovernanceCatalog(client);
    summary.semantic = await bootstrapSemanticRegistry(client);
    summary.indicators = await bootstrapIndicators(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  summary.knowledge = await loadKnowledgeBaseSeed({
    db: pool,
    jsonlInput: KNOWLEDGE_JSONL,
    skipMappings: false,
    closePool: false,
    logger,
  });

  if (closePool && pool && typeof pool.end === 'function') {
    await pool.end();
  }

  return {
    ok: true,
    status: 'PRODUCTION_REFERENCE_CATALOGS_LOADED',
    source: 'database/seeds/knowledge/knowledge_base_seed_v2.jsonl + database/reference/iso/manifest.json',
    ...summary,
  };
}

if (require.main === module) {
  loadProductionReferenceCatalogs({ closePool: true })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({
        ok: false,
        status: 'PRODUCTION_REFERENCE_CATALOGS_FAILED',
        error: error.message,
        code: error.code || null,
      }, null, 2));
      process.exitCode = 1;
    });
}

module.exports = {
  KNOWLEDGE_JSONL,
  ISO_REFERENCE_MANIFEST,
  approvedIsoReferenceSources,
  validatedIsoReferenceSources,
  controlRowsFromKnowledge,
  loadVersionedIsoReferenceCatalogs,
  readIsoReferenceManifest,
  loadProductionReferenceCatalogs,
};
