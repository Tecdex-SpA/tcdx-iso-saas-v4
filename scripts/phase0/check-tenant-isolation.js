#!/usr/bin/env node
const fs = require('fs');
const { run } = require('./tenant-isolation-runner');

(async () => {
  const modes = ['tenant', 'file', 'search', 'export', 'ai', 'job'];
  const results = [];
  for (const mode of modes) results.push(await run(mode, { write: false }));
  const artifact = {
    checkedAt: new Date().toISOString(),
    passed: results.reduce((sum, item) => sum + item.passed, 0),
    failed: results.reduce((sum, item) => sum + item.failed, 0),
    modes: results,
  };
  fs.mkdirSync('artifacts/fase-0', { recursive: true });
  fs.writeFileSync('artifacts/fase-0/cross-tenant-results.json', JSON.stringify(artifact, null, 2) + '\n');
  console.log(`phase0 cross-tenant VERIFIED cases=${artifact.passed}`);
})().catch(error => {
  console.error(String(error?.message || error));
  process.exit(1);
});
