#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
GENERATED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
OUT_DIR="$ROOT/qa-results/sprint1-audit-$TIMESTAMP"
SUMMARY_FILE="$OUT_DIR/summary.md"
SSH_USER="${TCDX_SSH_USER:-tecdex}"
BACKEND_HOST="${TCDX_BACKEND_HOST:-bk.tcdx.int}"
FRONTEND_HOST="${TCDX_FRONTEND_HOST:-www.tcdx.int}"
BACKEND_DIR="${TCDX_BACKEND_DIR:-/home/tecdex/backend}"
FRONTEND_DIR="${TCDX_FRONTEND_DIR:-/home/tecdex/frontend}"
SSH_CONNECT_TIMEOUT="${TCDX_SSH_CONNECT_TIMEOUT:-10}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "node no esta disponible."
command -v ssh >/dev/null 2>&1 || fail "ssh no esta disponible."

[[ "$SSH_USER" =~ ^[a-zA-Z0-9._-]+$ ]] || fail "TCDX_SSH_USER contiene caracteres no permitidos."
[[ "$BACKEND_HOST" =~ ^[a-zA-Z0-9._:-]+$ ]] || fail "TCDX_BACKEND_HOST contiene caracteres no permitidos."
[[ "$FRONTEND_HOST" =~ ^[a-zA-Z0-9._:-]+$ ]] || fail "TCDX_FRONTEND_HOST contiene caracteres no permitidos."
[[ "$BACKEND_DIR" =~ ^/[a-zA-Z0-9._/-]+$ ]] || fail "TCDX_BACKEND_DIR no es una ruta remota valida."
[[ "$FRONTEND_DIR" =~ ^/[a-zA-Z0-9._/-]+$ ]] || fail "TCDX_FRONTEND_DIR no es una ruta remota valida."

mkdir -p "$OUT_DIR" || fail "No se pudo crear $OUT_DIR."

run_audit() {
  local layer="$1"
  local host="$2"
  local remote_dir="$3"
  local json_file="$OUT_DIR/$layer-npm-audit.json"
  local stderr_file="$OUT_DIR/.$layer-npm-audit.stderr"
  local audit_rc=0

  ssh \
    -o BatchMode=yes \
    -o ConnectTimeout="$SSH_CONNECT_TIMEOUT" \
    "${SSH_USER}@${host}" \
    "test -f '$remote_dir/package.json' && cd '$remote_dir' && npm audit --omit=dev --json" \
    >"$json_file" 2>"$stderr_file" || audit_rc=$?

  if [ ! -s "$json_file" ]; then
    rm -f "$stderr_file"
    fail "La VM de $layer no genero JSON de npm audit (exit $audit_rc)."
  fi

  if ! node -e '
    const fs = require("fs");
    JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  ' "$json_file"; then
    rm -f "$stderr_file"
    fail "npm audit genero JSON invalido para $layer (exit $audit_rc)."
  fi

  rm -f "$stderr_file"
}

run_audit backend "$BACKEND_HOST" "$BACKEND_DIR"
run_audit frontend "$FRONTEND_HOST" "$FRONTEND_DIR"

set +e
GENERATED_AT="$GENERATED_AT" \
BACKEND_SOURCE="${SSH_USER}@${BACKEND_HOST}:${BACKEND_DIR}" \
FRONTEND_SOURCE="${SSH_USER}@${FRONTEND_HOST}:${FRONTEND_DIR}" \
node - "$OUT_DIR" "$SUMMARY_FILE" <<'NODE'
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
const summaryFile = process.argv[3];
const layers = ['backend', 'frontend'];
const severities = ['critical', 'high', 'moderate', 'low', 'info'];

function markdown(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function formatVia(via) {
  if (!Array.isArray(via) || via.length === 0) return 'directa/no informada';

  return via.map((item) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item);

    const source = item.source ? `advisory ${item.source}` : null;
    const title = item.title || item.name || null;
    const dependency = item.dependency ? `dependencia ${item.dependency}` : null;
    return [source, title, dependency].filter(Boolean).join(': ') || 'via no informada';
  }).join(', ');
}

function formatFixAvailable(value) {
  if (value === true) return 'true';
  if (value === false || value == null) return 'false';
  if (typeof value === 'object') {
    const name = value.name || 'paquete';
    const version = value.version || 'version no informada';
    const major = value.isSemVerMajor ? ', cambio mayor' : '';
    return `${name}@${version}${major}`;
  }
  return String(value);
}

function decisionFor(severity) {
  if (severity === 'critical' || severity === 'high') return 'BLOCKER';
  if (severity === 'moderate') return 'REVIEW';
  return 'BACKLOG';
}

function normalizedCounts(audit) {
  const metadata = audit.metadata || {};
  const source = metadata.vulnerabilities || {};
  const counts = {};

  for (const severity of severities) {
    counts[severity] = Number(source[severity] || 0);
  }

  counts.total = Number(
    source.total ??
    severities.reduce((sum, severity) => sum + counts[severity], 0)
  );

  return counts;
}

let blockerCount = 0;
const sections = [];

for (const layer of layers) {
  const jsonFile = path.join(outDir, `${layer}-npm-audit.json`);
  const audit = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const counts = normalizedCounts(audit);
  const source = layer === 'backend'
    ? process.env.BACKEND_SOURCE
    : process.env.FRONTEND_SOURCE;
  const vulnerabilities = Object.entries(audit.vulnerabilities || {})
    .map(([name, item]) => ({
      name,
      severity: String(item?.severity || 'unknown').toLowerCase(),
      via: formatVia(item?.via),
      fixAvailable: formatFixAvailable(item?.fixAvailable),
    }))
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, moderate: 2, low: 3, info: 4, unknown: 5 };
      return (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5) ||
        a.name.localeCompare(b.name);
    });

  blockerCount += vulnerabilities.filter(
    (item) => item.severity === 'critical' || item.severity === 'high'
  ).length;

  sections.push(`## ${layer}`);
  sections.push('');
  sections.push(`Origen auditado: \`${markdown(source || 'no informado')}\``);
  sections.push('');
  sections.push('| Severidad | Total |');
  sections.push('|---|---:|');
  for (const severity of severities) {
    sections.push(`| ${severity} | ${counts[severity]} |`);
  }
  sections.push(`| **total** | **${counts.total}** |`);
  sections.push('');
  sections.push('| Paquete | Severidad | Via o dependencia afectada | fixAvailable | Decision sugerida |');
  sections.push('|---|---|---|---|---|');

  if (vulnerabilities.length === 0) {
    sections.push('| Sin vulnerabilidades runtime reportadas | - | - | - | - |');
  } else {
    for (const item of vulnerabilities) {
      sections.push(
        `| ${markdown(item.name)} | ${markdown(item.severity)} | ` +
        `${markdown(item.via)} | ${markdown(item.fixAvailable)} | ` +
        `${decisionFor(item.severity)} |`
      );
    }
  }
  sections.push('');
}

const blocksSprint = blockerCount > 0;
const reason = blocksSprint
  ? `Se detectaron ${blockerCount} vulnerabilidades critical/high en dependencias runtime.`
  : 'No se detectaron vulnerabilidades critical/high en dependencias runtime.';

const document = [
  '# Sprint 1 - Resumen npm audit runtime',
  '',
  `Fecha/hora: ${process.env.GENERATED_AT || 'no informada'}`,
  '',
  'Comando aplicado por capa: `npm audit --omit=dev --json`.',
  '',
  ...sections,
  '## Conclusion',
  '',
  `- Bloquea Sprint 1: **${blocksSprint ? 'si' : 'no'}**`,
  `- Motivo: ${reason}`,
  '',
].join('\n');

fs.writeFileSync(summaryFile, document, 'utf8');
process.exit(blocksSprint ? 2 : 0);
NODE
summary_rc=$?
set -e

if [ "$summary_rc" -eq 2 ]; then
  printf 'Resumen generado: %s\n' "$SUMMARY_FILE"
  exit 2
fi

if [ "$summary_rc" -ne 0 ]; then
  fail "No se pudo generar el resumen npm audit."
fi

printf 'Resumen generado: %s\n' "$SUMMARY_FILE"
exit 0
