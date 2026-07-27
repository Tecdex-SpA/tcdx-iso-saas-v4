import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { validateEnvironment } = require(path.join(root, 'scripts/phase1/check-phase1-runtime-env.js'));

export default async function phase1GlobalSetup() {
  validateEnvironment(process.env);
}
