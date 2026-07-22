#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const directory = 'scripts/phase0';
const files = fs.readdirSync(directory)
  .map(name => path.join(directory, name))
  .filter(file => fs.statSync(file).isFile() && /\.(js|sh)$/.test(file) && !file.endsWith('check-phase0-scripts.js'));
const forbidden = [
  { pattern: /continue-on-error/, label: 'continue-on-error' },
  { pattern: /\|\|\s*true/, label: '|| true' },
  { pattern: /\.skip\s*\(/, label: 'test skip' },
  { pattern: /FIXME/, label: 'FIXME' },
];
const errors = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) errors.push(`${file}: forbidden ${rule.label}`);
  }
  try {
    execFileSync(file.endsWith('.js') ? process.execPath : 'bash', file.endsWith('.js') ? ['--check', file] : ['-n', file], { stdio: 'pipe' });
  } catch (error) {
    errors.push(`${file}: syntax check failed`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`phase0 scripts VERIFIED files=${files.length} forbidden=0`);
