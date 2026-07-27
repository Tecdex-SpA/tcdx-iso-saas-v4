import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
// Playwright loads this TypeScript file through its CommonJS transform on the
// runtime VM, so use the transformed module's dirname rather than import.meta.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateEnvironment } = require(path.join(root, 'scripts/phase1/check-phase1-runtime-env.js'));

export default async function phase1GlobalSetup() {
  validateEnvironment(process.env);
}
