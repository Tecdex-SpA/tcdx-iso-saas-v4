#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend/src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'coverage'].includes(entry.name)) walk(full, files);
    } else if (entry.isFile() && full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  let relative = path.relative(fromDir, path.join(backend, 'services/auth/roleCompatibility.service'));
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative.replace(/\\/g, '/');
}

function ensureImport(source, file, names) {
  const importPath = relImport(file);
  const requirePattern = new RegExp(`const\\s*\\{([^}]+)\\}\\s*=\\s*require\\(['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\);`);
  const existing = source.match(requirePattern);
  if (existing) {
    const current = existing[1].split(',').map((name) => name.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...names])].sort();
    return source.replace(requirePattern, `const {\n  ${merged.join(',\n  ')},\n} = require('${importPath}');`);
  }

  const insert = `const {\n  ${names.sort().join(',\n  ')},\n} = require('${importPath}');\n`;
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (
      line.startsWith('const ') ||
      line.startsWith('let ') ||
      line.startsWith('var ') ||
      line.startsWith("'use strict'") ||
      line.startsWith('"use strict"') ||
      line.trim() === ''
    ) {
      index += 1;
      continue;
    }
    break;
  }
  lines.splice(index, 0, insert.trimEnd());
  return lines.join('\n');
}

function replacePlatformSet(source) {
  return source.replace(
    /const\s+PLATFORM_ROLES\s*=\s*new\s+Set\(\s*\[[\s\S]*?['"]platform_admin['"][\s\S]*?\]\s*\);?\n?/g,
    ''
  );
}

function replaceInlinePlatformIncludes(source) {
  const aliases = String.raw`['"]superadmin['"][\s\S]*?['"]platform_admin['"][\s\S]*?(?:['"]owner['"][\s\S]*?)?`;
  const inlineArray = new RegExp(String.raw`\[\s*${aliases}\]\.includes\(([^)]+)\)`, 'g');
  return source.replace(inlineArray, 'isPlatformRole($1)');
}

function replacePlatformHas(source) {
  return source.replace(/PLATFORM_ROLES\.has\(([^)]+)\)/g, 'isPlatformRole($1)');
}

function main() {
  const touched = [];
  for (const file of walk(backend)) {
    if (file.endsWith('services/auth/roleCompatibility.service.js')) continue;
    let source = fs.readFileSync(file, 'utf8');
    const original = source;
    source = replacePlatformSet(source);
    source = replaceInlinePlatformIncludes(source);
    source = replacePlatformHas(source);
    if (source !== original) {
      source = ensureImport(source, file, ['isPlatformRole']);
      fs.writeFileSync(file, source);
      touched.push(path.relative(root, file));
    }
  }
  process.stdout.write(`CENTRALIZED_PLATFORM_ROLE_HELPERS=${touched.length}\n`);
  for (const file of touched) process.stdout.write(`${file}\n`);
}

main();
