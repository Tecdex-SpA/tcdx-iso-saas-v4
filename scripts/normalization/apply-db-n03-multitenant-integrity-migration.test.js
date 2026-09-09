#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260907_dbn03_multitenant_integrity_rls.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const withoutComments = sql.replace(/--.*$/gm, '');

assert.match(sql, /BEGIN;/, 'DB-N03 migration must be transactional');
assert.match(sql, /COMMIT;/, 'DB-N03 migration must be transactional');
assert.match(sql, /pg_try_advisory_xact_lock\(844332,\s*2026090703\)/, 'DB-N03 migration must use advisory lock');
assert.match(sql, /DB-N01 -> DB-N02 -> DB-N03/, 'DB-N03 must document DB-N01/DB-N02 order');
assert.match(sql, /dbn03_relation_preflight/, 'DB-N03 must preflight same-tenant relation violations');
assert.match(sql, /fk_dbn03_findings_tenant_control_same_tenant/, 'findings composite FK must be present');
assert.match(sql, /FOREIGN KEY \(tenant_id, %I\) REFERENCES public\.%I \(tenant_id, id\)/, 'DB-N03 must add composite tenant FKs');
assert.match(sql, /fk_dbn03_evidences_tenant_control_same_tenant/, 'evidences composite FK must be present');
assert.match(sql, /fk_dbn03_action_plans_tenant_control_same_tenant/, 'action_plans composite FK must be present');
assert.match(sql, /fk_dbn03_control_health_scores_tenant_control_same_tenant/, 'control_health_scores composite FK must be present');
assert.match(sql, /fk_dbn03_action_plans_finding_same_tenant/, 'action_plans finding composite FK must be present');
assert.match(sql, /uq_dbn03_tenant_controls_tenant_id_id/, 'tenant_controls must expose tenant/id candidate key');
assert.match(sql, /tcdx_security\.current_tenant_id/, 'RLS tenant context prerequisite must be present');
assert.match(sql, /tcdx_security\.tenant_visible/, 'RLS tenant visibility helper must be present');
assert.match(sql, /tcdx_security\.tenant_write_allowed/, 'RLS tenant write helper must be present');
assert.match(sql, /dbn03_tenant_isolation_findings/, 'pilot policy for findings must be staged');
assert.match(sql, /CREATE POLICY %I ON public\.%I USING \(tcdx_security\.tenant_visible\(tenant_id\)\) WITH CHECK \(tcdx_security\.tenant_write_allowed\(tenant_id\)\)/, 'policies must use tenant context helpers');
assert.match(sql, /unexpected RLS enabled before runtime context rollout/, 'DB-N03 must not enable RLS before runtime context rollout');
assert.doesNotMatch(withoutComments, /\bALTER\s+TABLE\s+[^;]+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'DB-N03 must defer ENABLE RLS');
assert.doesNotMatch(withoutComments, /\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'DB-N03 must defer FORCE RLS');
assert.doesNotMatch(withoutComments, /\bDROP\s+(TABLE|VIEW)\b/i, 'DB-N03 must not drop legacy tables/views');
assert.doesNotMatch(withoutComments, /\bTRUNCATE\b/i, 'DB-N03 must not truncate data');
assert.doesNotMatch(withoutComments, /\bDELETE\s+FROM\b/i, 'DB-N03 must not delete data');
assert.doesNotMatch(withoutComments, /192\.168\.2\.40/, 'DB-N03 must not target db-v4 directly');
assert.doesNotMatch(withoutComments, /70000000-0000-0000-0000-00000000070[0-9]/, 'DB-N03 must not hardcode demo tenant IDs');

const preflightPath = path.join(root, 'scripts/normalization/db-n03-readonly-preflight.sql');
const preflight = fs.readFileSync(preflightPath, 'utf8');
assert.match(preflight, /BEGIN READ ONLY;/, 'DB-N03 preflight must be read-only');
assert.match(preflight, /findings_tenant_control/, 'DB-N03 preflight must detect critical cross-tenant control links');
assert.match(preflight, /rls_enabled_table_count/, 'DB-N03 preflight must report RLS state');
assert.doesNotMatch(preflight.replace(/--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i, 'DB-N03 preflight must not write');

console.log('DB-N03 multi-tenant integrity migration static checks: OK');
