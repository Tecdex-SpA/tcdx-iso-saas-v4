#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

const roots = [
  'backend/src',
  'ai-engine',
  'frontend/src',
  'database/baseline',
  'scripts',
];

const patterns = [
  { name: 'control_health_scores', re: /\bcontrol_health_scores\b/i },
  { name: 'refresh_control_health_scores_v2_1', re: /\brefresh_control_health_scores_v2_1\b/i },
  { name: 'v_latest_health_kpi_snapshots', re: /\bv_latest_health_kpi_snapshots\b/i },
  { name: 'KPI-HLT', re: /\bKPI-HLT-/i },
  { name: 'legacy_control_id', re: /\blegacy_control_id\b/i },
  { name: 'controls_id_legacy', re: /\bcontrols_id_legacy\b/i },
  { name: 'legacy_runtime_prefer_default', re: /\blegacy_runtime_prefer_default\b/i },
  { name: 'FROM controls', re: /\bFROM\s+controls\b/i },
  { name: 'JOIN controls', re: /\b(?:LEFT\s+)?JOIN\s+controls\b/i },
  { name: 'evidences.control_id', re: /\bevidences\.control_id\b|\be\.control_id\b/i },
  { name: 'active _legacy route', re: /(?:backend\/src\/routes\/_legacy\/|['"`][^'"`]*_legacy[^'"`]*['"`])/i },
];

const allowedAbsenceTestFiles = new Set([
  'scripts/normalization/db-integral-zero-legacy.test.js',
  'scripts/normalization/db-integral-zero-legacy.postgres.test.js',
  'scripts/normalization/apply-db-n05-production-baseline.test.js',
  'scripts/normalization/db-n05-runtime-schema-contract.test.js',
  'scripts/normalization/db-n05-fresh-production.postgres.test.js',
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function classify(relativePath, lineText, patternName) {
  if (allowedAbsenceTestFiles.has(relativePath)) return 'TEST_ASSERTING_ABSENCE';
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relativePath)) return 'TEST_ASSERTING_ABSENCE';
  if (/^scripts\/normalization\/(?:apply-)?db-n0[1-4]/.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^scripts\/normalization\/db-n0[1-4]-readonly-preflight\.sql$/.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^scripts\/(?:qa|demo|phase5|phase5-c3|rbac02)\//.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^scripts\/.*(?:readonly-qa|applicability|db-objects|patch_)/.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^scripts\/test-/.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^database\/migrations\//.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (/^docs\/|^artifacts\//.test(relativePath)) return 'HISTORICAL_DOC_ONLY';
  if (/^backend\/src\/routes\/_legacy\//.test(relativePath)) return 'MIGRATION_HISTORY_ONLY';
  if (
    patternName === 'active _legacy route'
    && (
      relativePath === 'backend/src/services/auth/roleCompatibility.service.js'
      || relativePath === 'frontend/src/utils/mvpPermissions.ts'
      || relativePath.startsWith('ai-engine/')
    )
  ) {
    return 'NON_LEGACY_FALSE_POSITIVE';
  }
  if (patternName === 'evidences.control_id' && /\biso_evidence_expectations\b/.test(lineText)) return 'NON_LEGACY_FALSE_POSITIVE';
  return 'ACTIVE_RUNTIME_LEGACY';
}

const hits = [];

for (const rootDir of roots) {
  for (const file of walk(path.join(root, rootDir))) {
    const relativePath = path.relative(root, file);
    if (relativePath.endsWith('.map') || relativePath.includes('/node_modules/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.re.test(line)) {
          hits.push({
            classification: classify(relativePath, line, pattern.name),
            pattern: pattern.name,
            file: relativePath,
            line: index + 1,
            text: line.trim(),
          });
        }
      }
    });
  }
}

const counts = hits.reduce((acc, hit) => {
  acc[hit.classification] = (acc[hit.classification] || 0) + 1;
  return acc;
}, {});

for (const classification of [
  'ACTIVE_RUNTIME_LEGACY',
  'HISTORICAL_DOC_ONLY',
  'MIGRATION_HISTORY_ONLY',
  'TEST_ASSERTING_ABSENCE',
  'NON_LEGACY_FALSE_POSITIVE',
]) {
  console.log(`${classification}=${counts[classification] || 0}`);
}

for (const hit of hits.filter((item) => item.classification === 'ACTIVE_RUNTIME_LEGACY')) {
  console.log(`ACTIVE_RUNTIME_LEGACY ${hit.file}:${hit.line} ${hit.pattern} ${hit.text}`);
}

assert.equal(counts.ACTIVE_RUNTIME_LEGACY || 0, 0, 'ACTIVE_RUNTIME_LEGACY must be zero before tcdx_saasv2 creation');
console.log('ZERO_LEGACY_STATIC PASS');
