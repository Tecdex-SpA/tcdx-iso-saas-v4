#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260904_dbn01_control_identity_normalization.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const withoutComments = sql.replace(/--.*$/gm, '');

assert.match(sql, /BEGIN;/, 'DB-N01 migration must be transactional');
assert.match(sql, /COMMIT;/, 'DB-N01 migration must be transactional');
assert.match(sql, /pg_try_advisory_xact_lock\(844332,\s*2026090401\)/, 'DB-N01 migration must use advisory lock');
assert.match(sql, /dbn01_control_identity_audit/, 'DB-N01 migration must persist audit rows');
assert.match(sql, /tcdx\.dbn01_manual_decisions/, 'DB-N01 migration must support explicit manual decisions');
assert.match(sql, /CREATE TEMP TABLE dbn01_manual_decisions ON COMMIT DROP/, 'DB-N01 migration must centralize manual decisions in a transaction-scoped relation');
assert.match(sql, /selected_tenant_control_id uuid/, 'DB-N01 manual decisions must use explicit selected_tenant_control_id');
assert.match(sql, /DB-N01 manual decisions duplicate for table_name\/record_id/, 'DB-N01 migration must reject duplicate manual decisions early');
assert.match(sql, /table_name NOT IN \('findings', 'evidences'\)/, 'DB-N01 manual decisions must be limited to allowed tables');
assert.match(sql, /selected_tenant_control_id does not match expected catalog control/, 'DB-N01 migration must reject manual decisions for the wrong catalog control');
assert.match(sql, /selected_tenant_control_id belongs to another tenant/, 'DB-N01 migration must reject cross-tenant manual decisions');
assert.match(sql, /DB-N01 findings ambiguous without approved manual decision/, 'DB-N01 migration must fail on ambiguous findings');
assert.match(sql, /DB-N01 evidences legacy-only ambiguous without approved manual decision/, 'DB-N01 migration must fail on ambiguous evidences');
assert.match(sql, /fk_findings_tenant_control_canonical[\s\S]*REFERENCES tenant_controls\(id\)[\s\S]*ON DELETE RESTRICT/, 'findings FK must target tenant_controls');
assert.match(sql, /fk_evidences_tenant_control_canonical[\s\S]*REFERENCES tenant_controls\(id\)[\s\S]*ON DELETE RESTRICT/, 'evidences FK must target tenant_controls');
assert.match(sql, /fk_action_plans_tenant_control_canonical[\s\S]*REFERENCES tenant_controls\(id\)[\s\S]*ON DELETE RESTRICT/, 'action_plans FK must target tenant_controls');
assert.match(sql, /ALTER TABLE findings VALIDATE CONSTRAINT fk_findings_tenant_control_canonical/, 'findings FK must be validated');
assert.match(sql, /ALTER TABLE evidences VALIDATE CONSTRAINT fk_evidences_tenant_control_canonical/, 'evidences FK must be validated');
assert.match(sql, /ALTER TABLE action_plans VALIDATE CONSTRAINT fk_action_plans_tenant_control_canonical/, 'action plans FK must be validated');
assert.doesNotMatch(withoutComments, /\bDROP\s+TABLE\s+controls\b/i, 'DB-N01 must not drop controls');
assert.doesNotMatch(withoutComments, /\bDROP\s+COLUMN\s+control_id\b/i, 'DB-N01 must not drop evidences.control_id');
assert.doesNotMatch(withoutComments, /\bDELETE\s+FROM\b/i, 'DB-N01 must not delete history');
assert.doesNotMatch(withoutComments, /\bON\s+DELETE\s+CASCADE\b/i, 'DB-N01 must not introduce cascade delete for operational controls');
assert.doesNotMatch(withoutComments, /\bLIMIT\s+1\b/i, 'DB-N01 must not pick ambiguous control candidates with LIMIT 1');
assert.doesNotMatch(withoutComments, /\b(?:max|min)\s*\(/i, 'DB-N01 must not use max/min as control identity resolution');
assert.match(sql, /array_agg\(DISTINCT candidate_tenant_control_id\)/, 'DB-N01 singleton resolution must remain explicit and auditable');

const manualDecisionParses = (withoutComments.match(/jsonb_to_recordset\(/g) || []).length;
assert.strictEqual(manualDecisionParses, 1, 'DB-N01 migration must parse manual decisions exactly once');

console.log('DB-N01 migration static checks: OK');
