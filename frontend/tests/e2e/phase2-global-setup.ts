import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateEnvironment } = require(path.join(root, 'scripts/phase2/check-phase2-runtime-env.js'));

export default async function phase2GlobalSetup() {
  validateEnvironment(process.env);
}
