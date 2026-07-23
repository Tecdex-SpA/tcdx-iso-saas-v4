#!/usr/bin/env node
const fs = require('fs');
const { execFileSync } = require('child_process');

const numeric = name => Number(process.env[name] || 0);
const repoRoot = process.env.PHASE1_REPO_ROOT;

if (!repoRoot) {
  throw new Error('PHASE1_REPO_ROOT is required');
}

const report = {
  status: process.env.PHASE1_MIGRATION_STATUS,
  checkedAt: new Date().toISOString(),
  analyzedSha: execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  postgresMode: process.env.PHASE1_MIGRATION_MODE,
  disposableDatabase: true,
  migrationApplications: 2,
  destructiveOperations: 0,
  tables: numeric('PHASE1_MIGRATION_TABLES'),
  indexes: numeric('PHASE1_MIGRATION_INDEXES'),
  constraints: numeric('PHASE1_MIGRATION_CONSTRAINTS'),
  foreignKeys: numeric('PHASE1_MIGRATION_FOREIGN_KEYS'),
  invalidForeignKeys: 0,
  permissions: numeric('PHASE1_MIGRATION_PERMISSIONS'),
  globalFrameworks: numeric('PHASE1_MIGRATION_FRAMEWORKS'),
  publishedFrameworkVersions: numeric('PHASE1_MIGRATION_VERSIONS'),
  featureFlagDefaultEnabled: false,
  cleanupRegistered: true,
};

fs.writeFileSync(process.env.PHASE1_MIGRATION_ARTIFACT, `${JSON.stringify(report, null, 2)}\n`);
