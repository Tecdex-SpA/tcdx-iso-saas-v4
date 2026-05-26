#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CONFIG_DIR = path.join(os.homedir(), '.tcdx-sync-agent');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'txt', 'md', 'png', 'jpg', 'jpeg']);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const key = item.slice(2).replace(/-/g, '_');
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else {
      args._.push(item);
    }
  }
  return args;
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function extensionOf(fileName) {
  return path.extname(String(fileName || '')).replace('.', '').toLowerCase();
}

function shouldIgnore(fileName) {
  const name = path.basename(String(fileName || ''));
  return !name || IGNORED_NAMES.has(name) || name.startsWith('~$') || name.endsWith('.tmp');
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || json.message || `HTTP ${response.status}`);
  }
  return json;
}

async function walk(folder, includeSubfolders = true) {
  const root = path.resolve(folder);
  const files = [];

  async function visit(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || shouldIgnore(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      const stat = await fs.promises.lstat(absolute);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (includeSubfolders) await visit(absolute);
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = extensionOf(entry.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      files.push({
        file_name: entry.name,
        relative_path: relative,
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
        hash: await hashFile(absolute),
        mime_type: null,
      });
    }
  }

  await visit(root);
  return files;
}

async function register(args) {
  const baseUrl = String(args.base_url || '').replace(/\/$/, '');
  const pairingCode = String(args.pairing_code || '').trim();
  const folder = args.folder ? path.resolve(String(args.folder)) : '';
  if (!baseUrl || !pairingCode || !folder) {
    throw new Error('Uso: node agent.js register --base-url <url> --pairing-code <code> --folder <path>');
  }
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    throw new Error('La carpeta local no existe o no es directorio');
  }

  const json = await fetchJson(`${baseUrl}/api/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pairing_code: pairingCode,
      device_name: os.hostname(),
      device_fingerprint: crypto.createHash('sha256').update(`${os.hostname()}|${os.platform()}|${os.arch()}`).digest('hex'),
      agent_version: '0.1.0',
    }),
  });

  writeConfig({
    base_url: baseUrl,
    agent_token: json.agent_token,
    source_id: json.agent?.source_id,
    folder_path: folder,
    device_name: os.hostname(),
    registered_at: new Date().toISOString(),
  });

  console.log(`Agente vinculado. Source: ${json.agent?.source_id}`);
}

async function sync() {
  const config = readConfig();
  if (!config?.base_url || !config?.agent_token || !config?.folder_path) {
    throw new Error('Agente no registrado. Use register primero.');
  }

  const remoteConfig = await fetchJson(`${config.base_url}/api/agent/config`, {
    headers: { Authorization: `Bearer ${config.agent_token}` },
  });

  if (remoteConfig.sync_enabled === false) {
    console.log('Sincronización deshabilitada por servidor.');
    return;
  }

  const files = await walk(config.folder_path, remoteConfig.include_subfolders !== false);
  const result = await fetchJson(`${config.base_url}/api/agent/documents/index`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.agent_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  await fetchJson(`${config.base_url}/api/agent/heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.agent_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: '0.1.0' }),
  });

  console.log(`Sync OK. Indexados: ${result.indexed}. Omitidos: ${result.skipped}.`);
}

async function status() {
  const config = readConfig();
  if (!config) {
    console.log('Agente no registrado.');
    return;
  }
  console.log(JSON.stringify({
    base_url: config.base_url,
    source_id: config.source_id,
    folder_path: config.folder_path,
    device_name: config.device_name,
    registered_at: config.registered_at,
    token_configured: Boolean(config.agent_token),
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === 'register') return register(args);
  if (command === 'sync') return sync();
  if (command === 'status') return status();
  throw new Error('Comando no soportado. Use register, sync o status.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
