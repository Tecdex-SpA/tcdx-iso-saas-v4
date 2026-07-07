const assert = require('node:assert/strict');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') {
    return {
      Pool: class {
        async query() {
          return { rows: [], rowCount: 0 };
        }
        async connect() {
          return {
            async query() {
              return { rows: [], rowCount: 0 };
            },
            release() {},
          };
        }
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { convertKnowledgeMarkdown } = require('../../../scripts/convert-knowledge-md-to-jsonl');
const { loadKnowledgeBaseSeed, parseArgs } = require('../../../scripts/load-knowledge-base-seed');
const repository = require('./knowledge.repository');

const repoRoot = path.resolve(__dirname, '../../../..');
const sourceMd = path.join(repoRoot, 'database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md');

function classifySql(sql) {
  if (/^BEGIN/.test(sql)) return 'begin';
  if (/set_config/.test(sql)) return 'statement_timeout';
  if (/^COMMIT/.test(sql)) return 'commit';
  if (/^ROLLBACK/.test(sql)) return 'rollback';
  if (/INSERT INTO knowledge_import_runs/.test(sql)) return 'import_run_insert';
  if (/UPDATE knowledge_import_runs/.test(sql)) return 'import_run_update';
  if (/INSERT INTO knowledge_sources/.test(sql)) return 'source';
  if (/INSERT INTO knowledge_items/.test(sql)) return 'item';
  if (/DELETE FROM knowledge_evidence_expectations/.test(sql)) return 'delete_children';
  if (/INSERT INTO knowledge_evidence_expectations/.test(sql)) return 'child_evidence';
  if (/INSERT INTO knowledge_audit_questions/.test(sql)) return 'child_audit';
  if (/INSERT INTO knowledge_common_gaps/.test(sql)) return 'child_gap';
  if (/INSERT INTO knowledge_recommended_actions/.test(sql)) return 'child_action';
  if (/INSERT INTO knowledge_rules/.test(sql)) return 'child_rule';
  if (/INSERT INTO knowledge_rule_hints/.test(sql)) return 'child_hint';
  if (/DELETE FROM knowledge_mappings/.test(sql)) return 'delete_mappings';
  if (/INSERT INTO knowledge_mappings/.test(sql)) return 'mapping';
  return 'other';
}

function createFakeDb({ failOn = null } = {}) {
  const state = {
    importRuns: [],
    itemKeys: new Set(),
    commits: 0,
    rollbacks: 0,
    connections: 0,
    releases: 0,
    operations: [],
    queries: [],
  };
  const client = {
    async query(sql, params = []) {
      const operation = classifySql(sql);
      state.operations.push(operation);
      state.queries.push({ operation, sql, params });
      if (failOn && operation === failOn) {
        throw new Error(`forced failure on ${failOn}`);
      }
      if (operation === 'begin' || operation === 'statement_timeout') return { rows: [], rowCount: 0 };
      if (operation === 'commit') {
        state.commits += 1;
        return { rows: [], rowCount: 0 };
      }
      if (operation === 'rollback') {
        state.rollbacks += 1;
        return { rows: [], rowCount: 0 };
      }
      if (operation === 'import_run_insert') {
        state.importRuns.push({ source_file: params[0], status: 'running' });
        return { rows: [{ id: `run-${state.importRuns.length}` }], rowCount: 1 };
      }
      if (operation === 'item') {
        const itemKey = params[0];
        const inserted = !state.itemKeys.has(itemKey);
        state.itemKeys.add(itemKey);
        return { rows: [{ inserted }], rowCount: 1 };
      }
      if (operation === 'import_run_update') {
        state.importRuns[state.importRuns.length - 1].status = 'success';
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      state.releases += 1;
    },
  };
  return {
    state,
    async connect() {
      state.connections += 1;
      return client;
    },
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };
}

async function runTests() {
  const converted = convertKnowledgeMarkdown({ inputFile: sourceMd, writeFiles: false });
  assert.ok(converted.bundles.length >= 950);
  assert.equal(converted.bundles.length, 1000);
  assert.equal(converted.summary.total_records, 1000);
  assert.ok(converted.summary.by_license.derived_summary >= 950);
  assert.ok(converted.bundles[0].item_key);
  assert.ok(converted.bundles[0].evidence_expectation);
  assert.ok(converted.bundles[0].recommended_action);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-v2-test-'));
  const jsonlPath = path.join(tmp, 'knowledge.jsonl');
  const summaryPath = path.join(tmp, 'knowledge.summary.json');
  fs.writeFileSync(jsonlPath, `${converted.bundles.map((bundle) => JSON.stringify(bundle)).join('\n')}\n`);
  fs.writeFileSync(summaryPath, JSON.stringify({ total_records: converted.bundles.length, warnings: [] }));
  const quietLogger = { log() {} };

  const parsedArgs = parseArgs([jsonlPath, '--dry-run', '--skip-mappings']);
  assert.equal(parsedArgs.jsonlInput, jsonlPath);
  assert.equal(parsedArgs.dryRun, true);
  assert.equal(parsedArgs.skipMappings, true);

  const dryRunDb = {
    async connect() {
      throw new Error('dry-run must not connect to db');
    },
  };
  const dryRun = await loadKnowledgeBaseSeed({
    jsonlInput: jsonlPath,
    summaryInput: summaryPath,
    db: dryRunDb,
    dryRun: true,
    logger: quietLogger,
  });
  assert.equal(dryRun.dry_run, true);
  assert.equal(dryRun.valid_records, 1000);
  assert.equal(dryRun.mapping_rows_planned, 6000);

  const fakeDb = createFakeDb();
  const firstLoad = await loadKnowledgeBaseSeed({ jsonlInput: jsonlPath, summaryInput: summaryPath, db: fakeDb, logger: quietLogger });
  const secondLoad = await loadKnowledgeBaseSeed({ jsonlInput: jsonlPath, summaryInput: summaryPath, db: fakeDb, logger: quietLogger });
  assert.equal(firstLoad.valid_records, 1000);
  assert.equal(firstLoad.inserted_items, 1000);
  assert.equal(firstLoad.mapping_rows, 6000);
  assert.equal(secondLoad.valid_records, 1000);
  assert.equal(secondLoad.updated_items, 1000);
  assert.equal(fakeDb.state.commits, 2);
  assert.equal(fakeDb.state.releases, 2);

  const firstSource = fakeDb.state.operations.indexOf('source');
  const firstItem = fakeDb.state.operations.indexOf('item');
  const firstChild = fakeDb.state.operations.indexOf('child_evidence');
  const firstMapping = fakeDb.state.operations.indexOf('mapping');
  assert.ok(firstSource > fakeDb.state.operations.indexOf('import_run_insert'));
  assert.ok(firstItem > firstSource);
  assert.ok(firstChild > firstItem);
  assert.ok(firstMapping > firstChild);
  assert.equal(fakeDb.state.operations.filter((item) => item === 'source').length, 10);
  assert.equal(fakeDb.state.operations.filter((item) => item === 'item').length, 2000);
  assert.equal(fakeDb.state.operations.filter((item) => item === 'mapping').length, 12000);

  const importRunSql = fakeDb.state.queries
    .filter((query) => query.operation === 'import_run_insert' || query.operation === 'import_run_update')
    .map((query) => query.sql)
    .join('\n');
  assert.match(importRunSql, /valid_records/);
  assert.match(importRunSql, /inserted_items/);
  assert.match(importRunSql, /updated_items/);
  assert.match(importRunSql, /warning_count/);
  assert.match(importRunSql, /error_message/);
  assert.match(importRunSql, /summary_json/);
  assert.doesNotMatch(importRunSql, /total_rows|inserted_rows|updated_rows|skipped_rows|error_count/);

  const skipMappingsDb = createFakeDb();
  const skipMappings = await loadKnowledgeBaseSeed({
    jsonlInput: jsonlPath,
    summaryInput: summaryPath,
    db: skipMappingsDb,
    skipMappings: true,
    logger: quietLogger,
  });
  assert.equal(skipMappings.mapping_rows, 0);
  assert.equal(skipMappingsDb.state.operations.includes('mapping'), false);
  assert.equal(skipMappingsDb.state.commits, 1);

  const rollbackDb = createFakeDb({ failOn: 'child_gap' });
  await assert.rejects(
    () => loadKnowledgeBaseSeed({
      jsonlInput: jsonlPath,
      summaryInput: summaryPath,
      db: rollbackDb,
      logger: quietLogger,
    }),
    /forced failure/
  );
  assert.equal(rollbackDb.state.rollbacks, 1);
  assert.equal(rollbackDb.state.commits, 0);
  assert.equal(rollbackDb.state.releases, 1);

  repository.searchItems = async (filters) => {
    const rows = converted.bundles
      .filter((bundle) => {
        if (filters.item_type && bundle.item_type !== filters.item_type) return false;
        if (filters.standard_family && bundle.standard_family !== filters.standard_family) return false;
        if (filters.clause_or_control && bundle.clause_or_control !== filters.clause_or_control) return false;
        if (filters.domain && !bundle.domain.toLowerCase().includes(String(filters.domain).toLowerCase())) return false;
        if (filters.q && !bundle.search_text.toLowerCase().includes(String(filters.q).toLowerCase())) return false;
        return true;
      })
      .slice(0, 10);
    return rows.map((bundle) => ({
      item_key: bundle.item_key,
      source_key: bundle.source_key,
      standard_family: bundle.standard_family,
      standard_code: bundle.standard_code,
      clause_or_control: bundle.clause_or_control,
      domain: bundle.domain,
      item_type: bundle.item_type,
      title: bundle.title,
      intent_summary: bundle.intent_summary,
      severity_default: bundle.severity_default,
      license_class: bundle.license_class,
      use_in_system: bundle.use_in_system,
      tags: bundle.tags,
    }));
  };
  repository.countAvailableItems = async () => converted.bundles.length;
  repository.getChildRows = async () => [];

  const knowledge = require('./knowledge.service');
  const searchRows = await knowledge.searchKnowledge({ q: 'Contexto de la organización' }, { limit: 5 });
  assert.ok(searchRows.length > 0);

  const controlMatch = await knowledge.matchKnowledgeToTenantEntity({
    entityType: 'control',
    standardFamily: 'ISO_9001',
    standardCode: 'ISO 9001:2015 + Amd 1:2024',
    clauseOrControl: '4',
    domain: 'Contexto de la organización',
    title: 'Contexto de la organización',
  });
  assert.ok(controlMatch.matches.length > 0);
  assert.ok(controlMatch.coverage_score > 0);

  const riskMatch = await knowledge.matchKnowledgeToTenantEntity({
    entityType: 'risk',
    standardFamily: 'ISO_9001',
    domain: 'Contexto de la organización',
    title: 'Riesgo de gobernanza debil',
  });
  assert.ok(riskMatch.matches.length > 0);

  console.log('knowledge.service tests OK');
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
