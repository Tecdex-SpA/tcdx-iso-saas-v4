import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const layoutPath = path.join(root, 'src/app/encuestas/layout.tsx');
const pagePath = path.join(root, 'src/app/encuestas/page.tsx');

const [layout, page] = await Promise.all([
  readFile(layoutPath, 'utf8'),
  readFile(pagePath, 'utf8'),
]);

assert.match(layout, /import AppLayout from ['"]@\/components\/AppLayout['"]/);
assert.match(layout, /<AppLayout>\{children\}<\/AppLayout>/);
assert.doesNotMatch(page, /import AppLayout from ['"]@\/components\/AppLayout['"]/);
assert.doesNotMatch(page, /<AppLayout\b/);

process.stdout.write('NESTED_ENCUESTAS_LAYOUT=0\n');
