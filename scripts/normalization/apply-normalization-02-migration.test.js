'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const runner = fs.readFileSync(path.join(__dirname, 'apply-normalization-02-migration.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'database/migrations/20260901_normalization02_kpi_health_ui.sql'), 'utf8');

assert.match(runner, /20260901_normalization02_kpi_health_ui/);
assert.match(runner, /--checksum/);
assert.match(runner, /--preflight/);
assert.match(runner, /--apply/);
assert.match(runner, /--postconditions/);
assert.match(runner, /--rollback/);
assert.match(runner, /pg_try_advisory_xact_lock/);
assert.match(runner, /schema_migrations/);
assert.match(runner, /current_user/);
assert.match(runner, /checksum differs from applied ledger entry/);

assert.match(sql, /official_formula_versions/);
assert.match(sql, /version_number,\s*methodology/);
assert.match(sql, /partial_available_components_with_coverage_threshold/);
assert.match(sql, /metric_source_bindings/);
assert.match(sql, /metric_calculation_policies/);
assert.match(sql, /EVIDENCE-COVERAGE=compatibility_alias_only/);
assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\b(delete\s+from|truncate\s+|update\s+users|update\s+permissions|commercial_plans|tenant_subscriptions)\b/i);

process.stdout.write('NORMALIZATION02_RUNNER_CONTRACT_PASS\n');
