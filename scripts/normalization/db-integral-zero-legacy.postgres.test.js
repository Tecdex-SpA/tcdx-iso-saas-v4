#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/baseline/production_schema_v1.sql');
const seedPath = path.join(root, 'database/baseline/production_seed_v1.sql');
const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const pg = createPostgres();

try {
  psqlExec(pg, fs.readFileSync(schemaPath, 'utf8'));
  psqlExec(pg, fs.readFileSync(seedPath, 'utf8'));

  const legacyCount = psqlExec(pg, `
WITH forbidden_relations AS (
  SELECT n.nspname || '.' || c.relname AS name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_audit')
    AND (
      c.relname IN ('controls', 'control_health_scores', 'v_latest_health_kpi_snapshots')
      OR c.relname ~* '(backup_before_|cleanup_backup|backup_history|v2_preview|qa_|preview)'
    )
),
forbidden_functions AS (
  SELECT n.nspname || '.' || p.proname AS name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'refresh_control_health_scores_v2_1'
),
forbidden_columns AS (
  SELECT table_schema || '.' || table_name || '.' || column_name AS name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      column_name IN ('legacy_control_id', 'controls_id_legacy')
      OR (table_name = 'evidences' AND column_name = 'control_id')
    )
),
forbidden_metric_codes AS (
  SELECT 'metric_definitions.' || metric_code AS name
  FROM metric_definitions
  WHERE metric_code LIKE 'KPI-HLT-%'
)
SELECT count(*)::int
FROM (
  SELECT name FROM forbidden_relations
  UNION ALL SELECT name FROM forbidden_functions
  UNION ALL SELECT name FROM forbidden_columns
  UNION ALL SELECT name FROM forbidden_metric_codes
) forbidden;
  `).stdout.trim();

  assert.equal(legacyCount, '0');
  console.log(`LEGACY_OBJECT_COUNT=${legacyCount}`);
  console.log('ZERO_LEGACY_POSTGRES PASS');
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  console.log('ZERO_LEGACY_POSTGRES FAIL');
  process.exitCode = 1;
} finally {
  stopPostgres(pg);
}
