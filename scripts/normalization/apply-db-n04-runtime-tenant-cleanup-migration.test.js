#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260907_dbn04_runtime_tenant_and_legacy_cleanup.sql');
const preflightPath = path.join(root, 'scripts/normalization/db-n04-readonly-preflight.sql');

const sql = fs.readFileSync(migrationPath, 'utf8');
const withoutComments = sql.replace(/--.*$/gm, '');
const preflight = fs.readFileSync(preflightPath, 'utf8');
const preflightWithoutCommentsAndStrings = preflight
  .replace(/--.*$/gm, '')
  .replace(/'(?:''|[^'])*'/g, "''");

assert.match(sql, /BEGIN;/, 'DB-N04 migration must be transactional');
assert.match(sql, /COMMIT;/, 'DB-N04 migration must be transactional');
assert.match(sql, /pg_try_advisory_xact_lock\(844332,\s*2026090704\)/, 'DB-N04 migration must use advisory lock');
assert.match(sql, /DB-N01 -> DB-N02 -> DB-N03 -> DB-N04/, 'DB-N04 must document apply order');
assert.match(sql, /DB-N04 preflight failed; DB-N03 RLS prerequisites missing/, 'DB-N04 must require DB-N03 context functions');
assert.match(sql, /tcdx_security\.current_tenant_id\(\)/, 'DB-N04 must preserve DB-N03 tenant context function');
assert.match(sql, /tcdx_security\.platform_scope_enabled\(\)/, 'DB-N04 must preserve DB-N03 platform context function');
assert.match(sql, /tcdx_security\.tenant_visible\(uuid\)/, 'DB-N04 must preserve DB-N03 visibility helper');
assert.match(sql, /tcdx_security\.tenant_write_allowed\(uuid\)/, 'DB-N04 must preserve DB-N03 write helper');
assert.match(sql, /dbn04_rls_runtime_readiness/, 'DB-N04 must expose RLS runtime readiness view');
assert.match(sql, /tenant_controls/, 'DB-N04 must retain tenant_controls pilot readiness');
assert.match(sql, /findings/, 'DB-N04 must retain findings pilot readiness');
assert.match(sql, /evidences/, 'DB-N04 must retain evidences pilot readiness');
assert.match(sql, /action_plans/, 'DB-N04 must retain action_plans pilot readiness');
assert.match(sql, /control_health_scores/, 'DB-N04 must retain control_health_scores pilot readiness');
assert.match(sql, /No safe DROP is executed in DB-N04/, 'DB-N04 must document no safe destructive cleanup');
assert.match(sql, /public\.controls remains compatibility-required after DB-N01/, 'DB-N04 must preserve DB-N01 controls compatibility');
assert.match(sql, /KPI-HLT definitions\/snapshots remain compatibility-only after DB-N02/, 'DB-N04 must preserve DB-N02 KPI-HLT compatibility');
assert.match(sql, /qa_audit schema is QA-only/, 'DB-N04 must preserve QA-only audit schema');
assert.match(sql, /duplicate index cleanup requires exact pg_get_indexdef equality/, 'DB-N04 must defer unsafe duplicate index cleanup');
assert.match(sql, /unexpected RLS enabled; this package must not enable RLS on db-v4/, 'DB-N04 must guard against unexpected RLS enablement');

assert.doesNotMatch(withoutComments, /\bALTER\s+TABLE\s+[^;]+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'DB-N04 must not enable RLS');
assert.doesNotMatch(withoutComments, /\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'DB-N04 must not force RLS');
assert.doesNotMatch(withoutComments, /\bDROP\s+(TABLE|VIEW|INDEX|SCHEMA|FUNCTION)\b/i, 'DB-N04 must not drop objects');
assert.doesNotMatch(withoutComments, /\bTRUNCATE\b/i, 'DB-N04 must not truncate data');
assert.doesNotMatch(withoutComments, /\bDELETE\s+FROM\b/i, 'DB-N04 must not delete data');
assert.doesNotMatch(withoutComments, /\bGRANT\s+BYPASSRLS\b/i, 'DB-N04 must not grant BYPASSRLS');
assert.doesNotMatch(withoutComments, /192\.168\.2\.40/, 'DB-N04 must not target db-v4 directly');
assert.doesNotMatch(withoutComments, /70000000-0000-[0-9a-f-]{23}/i, 'DB-N04 must not hardcode tenant IDs');

assert.match(preflight, /DB-N04 read-only preflight/, 'DB-N04 preflight must be present');
assert.match(preflight, /BEGIN READ ONLY;/, 'DB-N04 preflight must explicitly run read-only');
assert.match(preflight, /COMMIT;/, 'DB-N04 preflight must close the read-only transaction');
assert.match(preflight, /legacy object presence/, 'DB-N04 preflight must report legacy object presence');
assert.match(preflight, /exactly duplicated indexes/, 'DB-N04 preflight must report duplicate indexes');
assert.match(preflight, /RLS readiness for pilot tables/, 'DB-N04 preflight must report RLS readiness');
assert.match(preflight, /tenant context prerequisites/, 'DB-N04 preflight must report tenant context prerequisites');
assert.match(preflight, /AI reader grants/, 'DB-N04 preflight must report ai_reader posture');
assert.doesNotMatch(preflightWithoutCommentsAndStrings, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i, 'DB-N04 preflight must not write');

console.log('DB-N04 runtime tenant cleanup migration static checks: OK');
