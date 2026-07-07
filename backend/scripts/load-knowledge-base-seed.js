#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

require('dotenv').config({ path: path.join(REPO_ROOT, 'backend/.env'), quiet: true });

const pool = require('../src/config/db');
const {
  assertAllowedLicense,
  normalizeText,
} = require('../src/services/knowledge-base/knowledge.guardrails');
const {
  KNOWLEDGE_SEED_VERSION,
  KNOWLEDGE_SOURCE_FILE,
} = require('../src/services/knowledge-base/knowledge.types');

const DEFAULT_JSONL_INPUT = path.join(REPO_ROOT, 'database/seeds/knowledge/knowledge_base_seed_v2.jsonl');
const DEFAULT_SUMMARY_INPUT = path.join(REPO_ROOT, 'database/seeds/knowledge/knowledge_base_seed_v2.summary.json');
const REQUIRED_BUNDLE_FIELDS = [
  'item_key',
  'source_key',
  'intent_summary',
  'evidence_expectation',
  'audit_question',
  'common_gap',
  'recommended_action',
  'use_in_system',
  'license_class',
];
const DEFAULT_STATEMENT_TIMEOUT_MS = 120000;
const MAPPING_ENTITY_TYPES = ['control', 'soa_item', 'evidence', 'risk', 'audit_finding', 'action_plan'];

function logProgress(message, details = null, logger = console) {
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  logger.log(`[knowledge-loader] ${message}${suffix}`);
}

function resolveInputPath(inputPath = DEFAULT_JSONL_INPUT) {
  if (!inputPath) return DEFAULT_JSONL_INPUT;
  return path.resolve(process.cwd(), inputPath);
}

function deriveSummaryPath(jsonlInput) {
  const candidate = jsonlInput.replace(/\.jsonl$/i, '.summary.json');
  return fs.existsSync(candidate) ? candidate : DEFAULT_SUMMARY_INPUT;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonlInput: DEFAULT_JSONL_INPUT,
    summaryInput: null,
    dryRun: false,
    skipMappings: false,
    statementTimeoutMs: DEFAULT_STATEMENT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--skip-mappings') {
      options.skipMappings = true;
      continue;
    }
    if (arg === '--summary') {
      options.summaryInput = resolveInputPath(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--statement-timeout-ms') {
      options.statementTimeoutMs = Math.max(1000, Number(argv[index + 1] || DEFAULT_STATEMENT_TIMEOUT_MS));
      index += 1;
      continue;
    }
    if (!arg.startsWith('--')) {
      options.jsonlInput = resolveInputPath(arg);
      continue;
    }
    const error = new Error(`Opcion no soportada: ${arg}`);
    error.code = 'KNOWLEDGE_LOADER_BAD_ARG';
    throw error;
  }

  if (!options.summaryInput) {
    options.summaryInput = deriveSummaryPath(options.jsonlInput);
  }

  return options;
}

function validateBundle(bundle, index) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    const error = new Error(`Registro JSONL invalido en linea ${index + 1}`);
    error.code = 'KNOWLEDGE_BUNDLE_INVALID';
    throw error;
  }

  for (const field of REQUIRED_BUNDLE_FIELDS) {
    const value = bundle[field];
    const missingArray = Array.isArray(value) && value.length === 0;
    if (missingArray || (!Array.isArray(value) && !normalizeText(value))) {
      const error = new Error(`Registro ${bundle.item_key || index + 1} sin campo obligatorio ${field}`);
      error.code = 'KNOWLEDGE_REQUIRED_FIELD_MISSING';
      error.field = field;
      error.item_key = bundle.item_key || null;
      throw error;
    }
  }

  assertAllowedLicense(bundle.license_class);
  return bundle;
}

function readJsonl(filePath = DEFAULT_JSONL_INPUT) {
  const resolvedPath = resolveInputPath(filePath);
  return fs.readFileSync(resolvedPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return validateBundle(JSON.parse(line), index);
      } catch (error) {
        if (!error.message.includes('linea')) {
          error.message = `JSONL invalido linea ${index + 1}: ${error.message}`;
        }
        throw error;
      }
    });
}

function sourceName(sourceKey) {
  const names = {
    iso_9001_2015: 'ISO 9001:2015 + Amd 1:2024',
    iso_27001_2022: 'ISO/IEC 27001:2022',
    nist_csf_2_0: 'NIST Cybersecurity Framework 2.0',
    nist_ai_rmf_1_0: 'NIST AI Risk Management Framework 1.0',
    tecdex_internal_methodology: 'Metodologia interna Tecdex ISO/GRC',
  };
  return names[sourceKey] || sourceKey;
}

function uniqueSources(bundles) {
  const byKey = new Map();
  for (const bundle of bundles) {
    if (!byKey.has(bundle.source_key)) {
      byKey.set(bundle.source_key, {
        source_key: bundle.source_key,
        source_name: sourceName(bundle.source_key),
        source_type: bundle.standard_family,
        license_class: bundle.license_class,
        use_in_system: bundle.use_in_system || [],
        source_file: bundle.source_file || KNOWLEDGE_SOURCE_FILE,
        seed_version: bundle.seed_version || KNOWLEDGE_SEED_VERSION,
        metadata_json: { standard_code: bundle.standard_code },
      });
    }
  }
  return Array.from(byKey.values());
}

function hasMappingData(bundle) {
  return Boolean(
    normalizeText(bundle.item_key) &&
      (normalizeText(bundle.standard_family) ||
        normalizeText(bundle.standard_code) ||
        normalizeText(bundle.clause_or_control) ||
        normalizeText(bundle.domain))
  );
}

async function setLocalStatementTimeout(client, timeoutMs) {
  if (!timeoutMs) return;
  await client.query('SELECT set_config($1, $2, true)', [
    'statement_timeout',
    String(Math.max(1000, Number(timeoutMs))),
  ]);
}

async function createImportRun(client, { jsonlInput, sourceSha256, summary }) {
  const result = await client.query(
    `
    INSERT INTO knowledge_import_runs (source_file, seed_version, source_sha256, status, summary_json)
    VALUES ($1, $2, $3, 'running', $4::jsonb)
    RETURNING id
    `,
    [path.basename(jsonlInput), KNOWLEDGE_SEED_VERSION, sourceSha256, JSON.stringify(summary)]
  );
  return result.rows[0]?.id;
}

async function upsertSources(client, bundles, logger) {
  const sources = uniqueSources(bundles);
  for (const source of sources) {
    await client.query(
      `
      INSERT INTO knowledge_sources (
        source_key, source_name, source_type, license_class, use_in_system,
        source_file, seed_version, metadata_json, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::jsonb, now())
      ON CONFLICT (source_key) DO UPDATE SET
        source_name = EXCLUDED.source_name,
        source_type = EXCLUDED.source_type,
        license_class = EXCLUDED.license_class,
        use_in_system = EXCLUDED.use_in_system,
        source_file = EXCLUDED.source_file,
        seed_version = EXCLUDED.seed_version,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = now()
      `,
      [
        source.source_key,
        source.source_name,
        source.source_type,
        source.license_class,
        source.use_in_system,
        source.source_file,
        source.seed_version,
        JSON.stringify(source.metadata_json),
      ]
    );
  }
  logProgress('sources upserted', { count: sources.length }, logger);
  return sources.length;
}

async function upsertItems(client, bundles, logger) {
  let insertedItems = 0;
  let updatedItems = 0;

  for (let index = 0; index < bundles.length; index += 1) {
    const bundle = bundles[index];
    const result = await client.query(
      `
      INSERT INTO knowledge_items (
        item_key, source_key, source_record_id, standard_family, standard_code,
        clause_or_control, domain, item_type, title, intent_summary,
        license_class, use_in_system, search_text, tags, severity_default,
        raw_json, is_active, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12::text[], $13, $14::text[], $15,
        $16::jsonb, true, now()
      )
      ON CONFLICT (item_key) DO UPDATE SET
        source_key = EXCLUDED.source_key,
        source_record_id = EXCLUDED.source_record_id,
        standard_family = EXCLUDED.standard_family,
        standard_code = EXCLUDED.standard_code,
        clause_or_control = EXCLUDED.clause_or_control,
        domain = EXCLUDED.domain,
        item_type = EXCLUDED.item_type,
        title = EXCLUDED.title,
        intent_summary = EXCLUDED.intent_summary,
        license_class = EXCLUDED.license_class,
        use_in_system = EXCLUDED.use_in_system,
        search_text = EXCLUDED.search_text,
        tags = EXCLUDED.tags,
        severity_default = EXCLUDED.severity_default,
        raw_json = EXCLUDED.raw_json,
        is_active = true,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted
      `,
      [
        bundle.item_key,
        bundle.source_key,
        bundle.source_record_id,
        bundle.standard_family,
        bundle.standard_code,
        bundle.clause_or_control,
        bundle.domain,
        bundle.item_type,
        bundle.title,
        bundle.intent_summary,
        bundle.license_class,
        bundle.use_in_system || [],
        bundle.search_text,
        bundle.tags || [],
        bundle.severity_default,
        JSON.stringify(bundle.raw || bundle),
      ]
    );

    if (result.rows[0]?.inserted) insertedItems += 1;
    else updatedItems += 1;

    if ((index + 1) % 100 === 0) {
      logProgress('items progress', { processed: index + 1, total: bundles.length }, logger);
    }
  }

  logProgress('items upserted', { inserted: insertedItems, updated: updatedItems }, logger);
  return { insertedItems, updatedItems };
}

async function deleteChildRows(client, itemKeys) {
  if (!itemKeys.length) return;
  await client.query('DELETE FROM knowledge_evidence_expectations WHERE item_key = ANY($1::text[])', [itemKeys]);
  await client.query('DELETE FROM knowledge_audit_questions WHERE item_key = ANY($1::text[])', [itemKeys]);
  await client.query('DELETE FROM knowledge_common_gaps WHERE item_key = ANY($1::text[])', [itemKeys]);
  await client.query('DELETE FROM knowledge_recommended_actions WHERE item_key = ANY($1::text[])', [itemKeys]);
  await client.query('DELETE FROM knowledge_rules WHERE item_key = ANY($1::text[])', [itemKeys]);
  await client.query('DELETE FROM knowledge_rule_hints WHERE item_key = ANY($1::text[])', [itemKeys]);
}

async function deleteMappingRows(client, itemKeys) {
  if (!itemKeys.length) return;
  await client.query('DELETE FROM knowledge_mappings WHERE item_key = ANY($1::text[])', [itemKeys]);
}

async function insertChildren(client, bundles, logger) {
  const itemKeys = bundles.map((bundle) => bundle.item_key);
  await deleteChildRows(client, itemKeys);

  for (let index = 0; index < bundles.length; index += 1) {
    const bundle = bundles[index];
    const metadata = JSON.stringify({ source_record_id: bundle.source_record_id });
    await client.query(
      'INSERT INTO knowledge_evidence_expectations (item_key, expectation_text, metadata_json) VALUES ($1, $2, $3::jsonb)',
      [bundle.item_key, bundle.evidence_expectation, metadata]
    );
    await client.query(
      'INSERT INTO knowledge_audit_questions (item_key, question_text, metadata_json) VALUES ($1, $2, $3::jsonb)',
      [bundle.item_key, bundle.audit_question, metadata]
    );
    await client.query(
      'INSERT INTO knowledge_common_gaps (item_key, gap_text, severity_default, metadata_json) VALUES ($1, $2, $3, $4::jsonb)',
      [bundle.item_key, bundle.common_gap, bundle.severity_default, metadata]
    );
    await client.query(
      `
      INSERT INTO knowledge_recommended_actions (item_key, action_text, action_basis, priority_default, metadata_json)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [bundle.item_key, bundle.recommended_action, bundle.action_basis, bundle.severity_default, metadata]
    );
    await client.query(
      `
      INSERT INTO knowledge_rules (item_key, rule_key, rule_type, rule_text, severity_default, metadata_json)
      VALUES ($1, $2, 'hint', $3, $4, $5::jsonb)
      ON CONFLICT (item_key, rule_key) DO UPDATE SET
        rule_text = EXCLUDED.rule_text,
        severity_default = EXCLUDED.severity_default,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = now()
      `,
      [bundle.item_key, `${bundle.item_key}.rule_hint`, bundle.rule_hint || bundle.intent_summary, bundle.severity_default, metadata]
    );
    await client.query(
      'INSERT INTO knowledge_rule_hints (item_key, hint_text, severity_default, metadata_json) VALUES ($1, $2, $3, $4::jsonb)',
      [bundle.item_key, bundle.rule_hint || bundle.intent_summary, bundle.severity_default, metadata]
    );

    if ((index + 1) % 100 === 0) {
      logProgress('children progress', { processed: index + 1, total: bundles.length }, logger);
    }
  }

  logProgress('children inserted', { items: bundles.length }, logger);
}

async function insertMappings(client, bundles, logger) {
  const mappingBundles = bundles.filter(hasMappingData);
  const itemKeys = mappingBundles.map((bundle) => bundle.item_key);
  await deleteMappingRows(client, itemKeys);

  let insertedMappings = 0;
  for (let index = 0; index < mappingBundles.length; index += 1) {
    const bundle = mappingBundles[index];
    for (const entityType of MAPPING_ENTITY_TYPES) {
      await client.query(
        `
        INSERT INTO knowledge_mappings (
          item_key, entity_type, standard_family, standard_code, clause_or_control,
          domain, match_weight, tags, metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb)
        `,
        [
          bundle.item_key,
          entityType,
          bundle.standard_family,
          bundle.standard_code,
          bundle.clause_or_control,
          bundle.domain,
          entityType === 'control' || entityType === 'soa_item' ? 1.2 : 1,
          bundle.tags || [],
          JSON.stringify({ generated_from_seed: true }),
        ]
      );
      insertedMappings += 1;
    }

    if ((index + 1) % 100 === 0) {
      logProgress('mappings progress', { processed_items: index + 1, total_items: mappingBundles.length }, logger);
    }
  }

  logProgress('mappings inserted', { items: mappingBundles.length, rows: insertedMappings }, logger);
  return insertedMappings;
}

function readSummary(summaryInput) {
  return fs.existsSync(summaryInput)
    ? JSON.parse(fs.readFileSync(summaryInput, 'utf8'))
    : {};
}

function assertDbConfigForDefaultPool(db) {
  if (db !== pool) return;
  const required = ['DB_NAME', 'DB_USER'];
  const missing = required.filter((key) => !normalizeText(process.env[key]));
  if (missing.length) {
    const error = new Error(`Variables DB requeridas no configuradas para cargar Knowledge Base: ${missing.join(', ')}`);
    error.code = 'DB_CONFIG_MISSING';
    throw error;
  }
}

function buildDryRunSummary({ bundles, summary, jsonlInput, skipMappings }) {
  return {
    ok: true,
    dry_run: true,
    source_file: path.basename(jsonlInput),
    seed_version: KNOWLEDGE_SEED_VERSION,
    valid_records: bundles.length,
    source_count: uniqueSources(bundles).length,
    mapping_rows_planned: skipMappings ? 0 : bundles.filter(hasMappingData).length * MAPPING_ENTITY_TYPES.length,
    skip_mappings: skipMappings,
    warning_count: (summary.warnings || []).length,
    summary,
  };
}

async function closeDbPool(db, shouldClosePool) {
  if (shouldClosePool && db && typeof db.end === 'function') {
    await db.end();
  }
}

async function loadKnowledgeBaseSeed({
  jsonlInput = DEFAULT_JSONL_INPUT,
  summaryInput = null,
  db = pool,
  dryRun = false,
  skipMappings = false,
  statementTimeoutMs = DEFAULT_STATEMENT_TIMEOUT_MS,
  logger = console,
  closePool = false,
} = {}) {
  const resolvedJsonlInput = resolveInputPath(jsonlInput);
  const resolvedSummaryInput = summaryInput ? resolveInputPath(summaryInput) : deriveSummaryPath(resolvedJsonlInput);

  logProgress('starting', { jsonl: resolvedJsonlInput, dry_run: dryRun, skip_mappings: skipMappings }, logger);
  const bundles = readJsonl(resolvedJsonlInput);
  const summary = readSummary(resolvedSummaryInput);
  const sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(resolvedJsonlInput)).digest('hex');
  logProgress('jsonl read', { records: bundles.length, summary: resolvedSummaryInput }, logger);

  if (dryRun) {
    const dryRunSummary = buildDryRunSummary({
      bundles,
      summary,
      jsonlInput: resolvedJsonlInput,
      skipMappings,
    });
    logProgress('dry run complete', dryRunSummary, logger);
    return dryRunSummary;
  }

  assertDbConfigForDefaultPool(db);
  const client = await db.connect();
  let runId = null;
  let insertedItems = 0;
  let updatedItems = 0;
  let committed = false;

  try {
    await client.query('BEGIN');
    await setLocalStatementTimeout(client, statementTimeoutMs);
    runId = await createImportRun(client, {
      jsonlInput: resolvedJsonlInput,
      sourceSha256,
      summary,
    });

    await upsertSources(client, bundles, logger);
    const itemResult = await upsertItems(client, bundles, logger);
    insertedItems = itemResult.insertedItems;
    updatedItems = itemResult.updatedItems;
    await insertChildren(client, bundles, logger);
    const insertedMappings = skipMappings ? 0 : await insertMappings(client, bundles, logger);
    if (skipMappings) {
      logProgress('mappings skipped', { reason: '--skip-mappings' }, logger);
    }

    await client.query(
      `
      UPDATE knowledge_import_runs
      SET finished_at = now(),
          status = 'completed',
          valid_records = $2,
          inserted_items = $3,
          updated_items = $4,
          warning_count = $5,
          error_message = NULL,
          summary_json = $6::jsonb
      WHERE id = $1
      `,
      [runId, bundles.length, insertedItems, updatedItems, (summary.warnings || []).length, JSON.stringify(summary)]
    );
    await client.query('COMMIT');
    committed = true;
    logProgress('commit complete', { run_id: runId }, logger);

    return {
      ok: true,
      run_id: runId,
      status: 'completed',
      valid_records: bundles.length,
      inserted_items: insertedItems,
      updated_items: updatedItems,
      mapping_rows: insertedMappings,
      skip_mappings: skipMappings,
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
        logProgress('rollback complete', { error: error.message }, logger);
      } catch (rollbackError) {
        logProgress('rollback failed', { error: rollbackError.message }, logger);
      }
    }
    throw error;
  } finally {
    client.release();
    await closeDbPool(db, closePool);
    logProgress('connection closed', { run_id: runId }, logger);
  }
}

if (require.main === module) {
  let cliOptions = null;
  try {
    cliOptions = parseArgs();
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error.code || 'KNOWLEDGE_LOADER_BAD_ARG',
      error: error.message,
    }, null, 2));
    process.exitCode = 1;
  }

  if (cliOptions) {
    loadKnowledgeBaseSeed({ ...cliOptions, closePool: true })
      .then((result) => {
        console.log(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        console.error(JSON.stringify({
          ok: false,
          code: error.code || 'KNOWLEDGE_LOAD_FAILED',
          error: error.message,
          item_key: error.item_key || null,
          field: error.field || null,
        }, null, 2));
        process.exitCode = 1;
      });
  }
}

module.exports = {
  buildDryRunSummary,
  loadKnowledgeBaseSeed,
  parseArgs,
  readJsonl,
  validateBundle,
};
