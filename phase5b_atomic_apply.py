#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fase 5B — Atomic language enforcement for AI/backend narratives.

Purpose:
- Enforce visual English consistency for AI/backend narrative responses when locale=en.
- Avoid touching DB, .env, migrations, credentials, payload values sent by frontend, or tenant data.
- Apply changes atomically: if validation fails, restore all touched files.

Run from repo root:
  python3 phase5b_atomic_apply.py
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable

ROOT = Path.cwd()
TS = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_DIR = ROOT / "qa-results"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / f"phase5b-atomic-apply-{TS}.log"

TARGETS = [
    ROOT / "backend/src/app.js",
    ROOT / "backend/src/utils/aiLocaleText.js",
    ROOT / "backend/src/middleware/aiLocaleResponseGuard.js",
    ROOT / "ai-engine/app/services/language_service.py",
    ROOT / "scripts/qa-ai-locale-consistency.sh",
    ROOT / "docs/i18n-db-display-layer.md",
]

CREATED: list[Path] = []
SNAPSHOT: dict[Path, str | None] = {}


def log(msg: str) -> None:
    print(msg)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")


def run(cmd: list[str], cwd: Path | None = None, allow_fail: bool = False) -> subprocess.CompletedProcess:
    log(f"$ {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=str(cwd or ROOT), text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if proc.stdout:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(proc.stdout)
        print(proc.stdout, end="")
    if proc.returncode != 0 and not allow_fail:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}")
    return proc


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        CREATED.append(path)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    log(f"[OK] escrito {path.relative_to(ROOT)}")


def snapshot(paths: Iterable[Path]) -> None:
    for path in paths:
        if path.exists():
            SNAPSHOT[path] = path.read_text(encoding="utf-8")
        else:
            SNAPSHOT[path] = None


def rollback() -> None:
    log("\n[ROLLBACK] Restaurando archivos por fallo de validación...")
    for path, content in SNAPSHOT.items():
        if content is None:
            if path.exists():
                path.unlink()
                log(f"[ROLLBACK] eliminado {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            log(f"[ROLLBACK] restaurado {path.relative_to(ROOT)}")
    for path in CREATED:
        if path.exists() and SNAPSHOT.get(path) is None:
            path.unlink()
            log(f"[ROLLBACK] eliminado creado {path.relative_to(ROOT)}")


def assert_repo() -> None:
    required = [
        ROOT / "frontend",
        ROOT / "backend",
        ROOT / "ai-engine",
        ROOT / "backend/src/app.js",
        ROOT / "ai-engine/app/services/language_service.py",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.exists()]
    if missing:
        raise RuntimeError("No parece repo raíz o faltan archivos: " + ", ".join(missing))

    branch = run(["git", "branch", "--show-current"]).stdout.strip()
    if branch != "main":
        raise RuntimeError(f"Branch actual '{branch}'. Ejecutar en main.")

    # Hard safety: do not continue if tracked files are already modified, except qa-results/untracked.
    status = run(["git", "status", "--porcelain"], allow_fail=False).stdout.splitlines()
    dirty_tracked = [line for line in status if line and not line.startswith("?? ")]
    if dirty_tracked:
        raise RuntimeError(
            "Hay cambios tracked pendientes. Commit/stash antes de aplicar Fase 5B:\n" + "\n".join(dirty_tracked)
        )

    sensitive = [line for line in status if re.search(r"(^|/)\.env($|\.)|\.dump$|\.tar\.gz$|bak_", line)]
    if sensitive:
        raise RuntimeError("Hay archivos sensibles/no deseados en git status:\n" + "\n".join(sensitive))


def ai_locale_text_js() -> str:
    return r"""
'use strict';

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeLocale(locale) {
  const raw = String(locale || '').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  return 'es';
}

function normalizeText(value) {
  return stripAccents(String(value || '').trim())
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksTechnical(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  if (/^[A-Z0-9_./:-]{3,}$/.test(raw) && !/\s/.test(raw)) return true;
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(raw)) return true;
  return false;
}

const EXACT_EN = new Map(Object.entries({
  'pendiente definir': 'To be defined',
  'pendiente de definir': 'To be defined',
  'sin definir': 'To be defined',
  'estado de implementacion': 'Implementation status',
  'responsable del control': 'Control owner',
  'fecha revision': 'Review date',
  'fecha de revision': 'Review date',
  'justificacion': 'Justification',
  'justificacion de aplicabilidad o exclusion': 'Applicability or exclusion justification',
  'notas': 'Notes',
  'notas complementarias': 'Additional notes',
  'crear accion': 'Create action',
  'crear accion correctiva': 'Create corrective action',
  'estado diagnostic actual': 'Current diagnostic status',
  'estado diagnostico actual': 'Current diagnostic status',
  'estado diagnostico': 'Diagnostic status',
  'alcance': 'Scope',
  'contexto de la organizacion': 'Context of the organization',
  'liderazgo': 'Leadership',
  'planificacion': 'Planning',
  'apoyo': 'Support',
  'operacion': 'Operation',
  'evaluacion del desempeno': 'Performance evaluation',
  'mejora': 'Improvement',
  'evidencias sugeridas': 'Suggested evidence',
  'evidencia sugerida': 'Suggested evidence',
  'evidencia requerida': 'Required evidence',
  'evidencia objetiva': 'Objective evidence',
  'riesgos detectados': 'Detected risks',
  'riesgo detectado': 'Detected risk',
  'proximo paso': 'Next step',
  'siguiente paso': 'Next step',
  'pasos siguientes': 'Next steps',
  'resumen central ia': 'Central AI summary',
  'resumen de salud': 'Health summary',
  'senal relevante': 'Relevant signal',
  'senales relevantes': 'Relevant signals',
  'prioridades recomendadas': 'Recommended priorities',
  'prioridad recomendada': 'Recommended priority',
  'recomendaciones': 'Recommendations',
  'recomendacion': 'Recommendation',
  'redaccion propuesta': 'Proposed wording',
  'narrativa': 'Narrative',
  'brecha': 'Gap',
  'brechas': 'Gaps',
  'ajuste sugerido': 'Suggested adjustment',
  'acciones sugeridas': 'Suggested actions',
  'accion sugerida': 'Suggested action',
  'plan de accion sugerido': 'Suggested action plan',
  'responsable sugerido': 'Suggested owner',
  'fecha objetivo': 'Target date',
  'cumple': 'Compliant',
  'no cumple': 'Non-compliant',
  'parcial': 'Partial',
  'no aplicable': 'Not applicable',
  'aplica': 'Applicable',
  'no aplica': 'Not applicable',
  'implementado': 'Implemented',
  'no implementado': 'Not implemented',
  'pendiente': 'Pending',
  'en progreso': 'In progress',
  'borrador': 'Draft',
  'abierto': 'Open',
  'cerrado': 'Closed',
  'resuelta': 'Resolved',
  'resuelto': 'Resolved',
  'critico': 'Critical',
  'critica': 'Critical',
  'alto': 'High',
  'alta': 'High',
  'medio': 'Medium',
  'media': 'Medium',
  'bajo': 'Low',
  'baja': 'Low'
}));

const FRAGMENTS_EN = [
  [/\bSe recomienda\b/gi, 'It is recommended to'],
  [/\bSe recomienda revisar\b/gi, 'It is recommended to review'],
  [/\bSe encontraron\b/gi, 'The following were found'],
  [/\bSe detectaron\b/gi, 'The following were detected'],
  [/\bSe debe\b/gi, 'The organization should'],
  [/\bDebe existir\b/gi, 'There should be'],
  [/\bDebe evidenciarse\b/gi, 'Evidence should show'],
  [/\bDebe revisarse\b/gi, 'This should be reviewed'],
  [/\bDebe actualizarse\b/gi, 'This should be updated'],
  [/\bNo se evidencia\b/gi, 'There is no evidence of'],
  [/\bNo se observan\b/gi, 'No items are observed'],
  [/\bNo se encontraron\b/gi, 'No items were found'],
  [/\bExiste evidencia\b/gi, 'Evidence exists'],
  [/\bEvidencia disponible\b/gi, 'Available evidence'],
  [/\bEvidencia pendiente\b/gi, 'Pending evidence'],
  [/\bcontrol asociado\b/gi, 'associated control'],
  [/\bcontrol vinculado\b/gi, 'linked control'],
  [/\bacción correctiva\b/gi, 'corrective action'],
  [/\baccion correctiva\b/gi, 'corrective action'],
  [/\bplan de acción\b/gi, 'action plan'],
  [/\bplan de accion\b/gi, 'action plan'],
  [/\bhallazgo\b/gi, 'finding'],
  [/\bhallazgos\b/gi, 'findings'],
  [/\bno conformidad\b/gi, 'nonconformity'],
  [/\bno conformidades\b/gi, 'nonconformities'],
  [/\bevidencia\b/gi, 'evidence'],
  [/\bevidencias\b/gi, 'evidence'],
  [/\briesgo\b/gi, 'risk'],
  [/\briesgos\b/gi, 'risks'],
  [/\bproveedores\b/gi, 'suppliers'],
  [/\bprivilegiados\b/gi, 'privileged'],
  [/\baccesos\b/gi, 'access'],
  [/\bgestión documental\b/gi, 'document management'],
  [/\bgestion documental\b/gi, 'document management'],
  [/\bgestión de riesgos\b/gi, 'risk management'],
  [/\bgestion de riesgos\b/gi, 'risk management'],
  [/\bgestión de incidentes\b/gi, 'incident management'],
  [/\bgestion de incidentes\b/gi, 'incident management'],
  [/\bseguridad de la información\b/gi, 'information security'],
  [/\bseguridad de la informacion\b/gi, 'information security'],
  [/\bsistema de gestión\b/gi, 'management system'],
  [/\bsistema de gestion\b/gi, 'management system'],
  [/\bestado diagnostic actual\b/gi, 'current diagnostic status'],
  [/\bestado diagnostico actual\b/gi, 'current diagnostic status'],
  [/\bestado de implementación\b/gi, 'implementation status'],
  [/\bestado de implementacion\b/gi, 'implementation status'],
  [/\bfecha revisión\b/gi, 'review date'],
  [/\bfecha revision\b/gi, 'review date'],
  [/\bjustificación\b/gi, 'justification'],
  [/\bjustificacion\b/gi, 'justification'],
  [/\bnotas complementarias\b/gi, 'additional notes'],
  [/\bpendiente definir\b/gi, 'to be defined'],
  [/\bpendiente de definir\b/gi, 'to be defined'],
  [/\bcrear acción\b/gi, 'create action'],
  [/\bcrear accion\b/gi, 'create action'],
  [/\bdetected risks\s*:\s*/gi, 'Detected risks: '],
  [/\bnext steps?\s*:\s*/gi, 'Next steps: '],
  [/\bsummary\s+de\s+salud\b/gi, 'Health summary'],
  [/\bredacción propuesta\b/gi, 'Proposed wording'],
  [/\bredaccion propuesta\b/gi, 'Proposed wording'],
  [/\bprioridades recomendadas\b/gi, 'Recommended priorities'],
  [/\bseñales relevantes\b/gi, 'Relevant signals'],
  [/\bsenales relevantes\b/gi, 'Relevant signals']
];

function translateAiLocaleText(value, locale = 'es') {
  const target = normalizeLocale(locale);
  const original = String(value ?? '');
  if (target !== 'en') return original;
  const trimmed = original.trim();
  if (!trimmed || looksTechnical(trimmed)) return original;

  const exact = EXACT_EN.get(normalizeText(trimmed));
  if (exact) return exact;

  let output = original;
  for (const [pattern, replacement] of FRAGMENTS_EN) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function buildAiLocaleInstruction(locale = 'es') {
  return normalizeLocale(locale) === 'en'
    ? [
        'LANGUAGE REQUIREMENT: Respond only in English.',
        'Do not mix Spanish and English.',
        'Translate system labels, recommendations, risks, evidence summaries, action-plan wording and audit narratives into English.',
        'Keep technical identifiers, ISO codes, UUIDs, URLs, emails, enum values and internal codes unchanged.'
      ].join(' ')
    : [
        'REQUISITO DE IDIOMA: Responde solo en español.',
        'No mezcles español e inglés.',
        'Mantén identificadores técnicos, códigos ISO, UUIDs, URLs, emails, enums y códigos internos sin cambios.'
      ].join(' ');
}

function shouldSkipKey(key) {
  return /(^|_)(id|uuid|token|jwt|url|email|file|path|code|key|slug|hash|password|signature|storage|deep_link|href|src)$/i.test(String(key || ''));
}

function translatePayload(value, locale = 'es', key = '') {
  if (normalizeLocale(locale) !== 'en') return value;
  if (value === null || value === undefined) return value;
  if (shouldSkipKey(key)) return value;

  if (typeof value === 'string') return translateAiLocaleText(value, locale);
  if (Array.isArray(value)) return value.map((item) => translatePayload(item, locale, key));
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = translatePayload(childValue, locale, childKey);
    }
    return output;
  }
  return value;
}

module.exports = {
  normalizeLocale,
  translateAiLocaleText,
  translatePayload,
  buildAiLocaleInstruction
};
"""


def ai_locale_response_guard_js() -> str:
    return r"""
'use strict';

const { normalizeLocale, translatePayload } = require('../utils/aiLocaleText');

const AI_LOCALE_PATHS = [
  '/api/ai-compliance',
  '/api/ai-auditor',
  '/api/evidences',
  '/api/action-plans',
  '/api/reports'
];

function resolveRequestLocale(req) {
  return normalizeLocale(
    req.headers['x-tcdx-locale']
    || req.headers['x-locale']
    || req.query?.locale
    || req.body?.locale
    || 'es'
  );
}

function shouldGuardPath(pathname) {
  const raw = String(pathname || '');
  return AI_LOCALE_PATHS.some((prefix) => raw.startsWith(prefix));
}

function aiLocaleResponseGuard(req, res, next) {
  const locale = resolveRequestLocale(req);

  if (locale !== 'en' || !shouldGuardPath(req.path || req.originalUrl)) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function jsonWithLocaleGuard(payload) {
    try {
      return originalJson(translatePayload(payload, locale));
    } catch (error) {
      return originalJson(payload);
    }
  };

  return next();
}

module.exports = {
  aiLocaleResponseGuard,
  resolveRequestLocale
};
"""


def patch_app_js() -> None:
    path = ROOT / "backend/src/app.js"
    s = read(path)

    require_line = "const { aiLocaleResponseGuard } = require('./middleware/aiLocaleResponseGuard');"
    if require_line not in s:
        lines = s.splitlines()
        insert_idx = 0
        # Put after initial require/import block.
        for i, line in enumerate(lines):
            if line.startswith('const ') or line.startswith('let ') or line.startswith('var '):
                insert_idx = i + 1
                continue
            if insert_idx:
                break
        lines.insert(insert_idx, require_line)
        s = "\n".join(lines) + "\n"
        log("[OK] app.js: import aiLocaleResponseGuard agregado")
    else:
        log("[OK] app.js: import ya existía")

    use_line = "app.use(aiLocaleResponseGuard);"
    if use_line not in s:
        pattern = re.compile(r"(const\s+app\s*=\s*express\s*\(\s*\)\s*;)")
        if pattern.search(s):
            s = pattern.sub(r"\1\n" + use_line, s, count=1)
            log("[OK] app.js: middleware montado después de express()")
        else:
            raise RuntimeError("No se encontró 'const app = express();' en backend/src/app.js")
    else:
        log("[OK] app.js: middleware ya montado")

    write(path, s)


def patch_language_service_py() -> None:
    path = ROOT / "ai-engine/app/services/language_service.py"
    s = read(path)
    marker = "# TCDX_PHASE5B_LANGUAGE_ENFORCEMENT"
    if marker in s:
        log("[OK] language_service.py: bloque Fase 5B ya existe")
        return

    block = r'''

# TCDX_PHASE5B_LANGUAGE_ENFORCEMENT
# Non-destructive language helpers for AI-generated narratives.
# These helpers do not mutate database values or internal enum/code values.
def normalize_tcdx_locale(locale: str | None = None) -> str:
    raw = str(locale or "").lower()
    return "en" if raw.startswith("en") else "es"


def build_tcdx_language_instruction(locale: str | None = None) -> str:
    resolved = normalize_tcdx_locale(locale)
    if resolved == "en":
        return (
            "LANGUAGE REQUIREMENT: Respond only in English. "
            "Do not mix Spanish and English. "
            "Translate system labels, recommendations, detected risks, evidence summaries, "
            "action-plan wording and audit narratives into English. "
            "Keep technical identifiers, ISO codes, UUIDs, URLs, emails, enum values and internal codes unchanged."
        )
    return (
        "REQUISITO DE IDIOMA: Responde solo en español. "
        "No mezcles español e inglés. "
        "Mantén identificadores técnicos, códigos ISO, UUIDs, URLs, emails, enums y códigos internos sin cambios."
    )
'''
    write(path, s.rstrip() + block)
    log("[OK] language_service.py: helpers de idioma Fase 5B agregados")


def qa_script() -> str:
    return r"""
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date '+%Y%m%d_%H%M%S')"
OUT_DIR="qa-results"
OUT_TXT="$OUT_DIR/qa-ai-locale-consistency-$TS.txt"
OUT_JSON="$OUT_DIR/qa-ai-locale-consistency-$TS.json"
OUT_MD="$OUT_DIR/qa-ai-locale-consistency-$TS.md"
mkdir -p "$OUT_DIR"

PASS=0
WARN=0
FAIL=0
pass(){ PASS=$((PASS+1)); echo "[PASS] $1"; }
warn(){ WARN=$((WARN+1)); echo "[WARN] $1"; }
fail(){ FAIL=$((FAIL+1)); echo "[FAIL] $1"; }

{
echo "======================================"
echo " TCDX QA AI LOCALE CONSISTENCY"
echo "======================================"
echo "Fecha: $(date)"
echo ""

[ -f backend/src/utils/aiLocaleText.js ] && pass "aiLocaleText.js existe" || fail "falta aiLocaleText.js"
[ -f backend/src/middleware/aiLocaleResponseGuard.js ] && pass "aiLocaleResponseGuard.js existe" || fail "falta aiLocaleResponseGuard.js"

grep -q "aiLocaleResponseGuard" backend/src/app.js && pass "app.js monta aiLocaleResponseGuard" || fail "app.js no monta aiLocaleResponseGuard"
grep -q "buildAiLocaleInstruction" backend/src/utils/aiLocaleText.js && pass "buildAiLocaleInstruction existe" || fail "falta buildAiLocaleInstruction"
grep -q "translatePayload" backend/src/utils/aiLocaleText.js && pass "translatePayload existe" || fail "falta translatePayload"
grep -q "build_tcdx_language_instruction" ai-engine/app/services/language_service.py && pass "ai-engine language instruction helper existe" || warn "helper ai-engine no detectado"

node -c backend/src/app.js && pass "node app.js sintaxis OK" || fail "node app.js sintaxis FAIL"
node -c backend/src/utils/aiLocaleText.js && pass "node aiLocaleText.js sintaxis OK" || fail "node aiLocaleText.js sintaxis FAIL"
node -c backend/src/middleware/aiLocaleResponseGuard.js && pass "node aiLocaleResponseGuard.js sintaxis OK" || fail "node aiLocaleResponseGuard.js sintaxis FAIL"

python3 -m py_compile ai-engine/app/services/language_service.py && pass "py_compile language_service.py OK" || fail "py_compile language_service.py FAIL"

node <<'NODE'
const { translateAiLocaleText, translatePayload, buildAiLocaleInstruction } = require('./backend/src/utils/aiLocaleText');
const checks = [
  ['Se recomienda revisar la evidencia', 'It is recommended'],
  ['Riesgos detectados', 'Detected risks'],
  ['Próximo paso', 'Next step'],
  ['Resumen de salud', 'Health summary'],
  ['Prioridades recomendadas', 'Recommended priorities'],
  ['Pendiente definir', 'To be defined']
];
let fail = 0;
for (const [input, expected] of checks) {
  const out = translateAiLocaleText(input, 'en');
  if (!out.includes(expected)) {
    console.error(`[FAIL] ${input} => ${out} expected ${expected}`);
    fail += 1;
  }
}
const payload = translatePayload({ ok: true, summary: 'Se recomienda revisar la evidencia', id: 'ABC123' }, 'en');
if (!payload.summary.includes('It is recommended')) fail += 1;
if (payload.id !== 'ABC123') fail += 1;
if (!buildAiLocaleInstruction('en').includes('Respond only in English')) fail += 1;
process.exit(fail ? 1 : 0);
NODE
[ "$?" -eq 0 ] && pass "runtime locale translation smoke OK" || fail "runtime locale translation smoke FAIL"

if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|\.dump$|\.tar\.gz$|bak_' >/dev/null 2>&1; then
  fail "hay .env reales/backups/dumps/tar.gz en cambios"
else
  pass "sin .env reales/backups/dumps/tar.gz en cambios"
fi

echo ""
echo "Resumen:"
echo "PASS=$PASS"
echo "WARN=$WARN"
echo "FAIL=$FAIL"
echo "TXT=$OUT_TXT"
echo "JSON=$OUT_JSON"
echo "MD=$OUT_MD"
echo "======================================"
} | tee "$OUT_TXT"

cat > "$OUT_JSON" <<JSON
{"qa":"ai-locale-consistency","timestamp":"$TS","pass":$PASS,"warn":$WARN,"fail":$FAIL}
JSON

cat > "$OUT_MD" <<MD
# QA AI Locale Consistency

- Timestamp: $TS
- PASS: $PASS
- WARN: $WARN
- FAIL: $FAIL

Detalle: \`$OUT_TXT\`
MD

test "$FAIL" -eq 0
"""


def update_docs() -> None:
    path = ROOT / "docs/i18n-db-display-layer.md"
    if not path.exists():
        return
    s = read(path)
    marker = "## Fase 5B — Language enforcement IA/backend"
    if marker in s:
        log("[OK] docs: sección 5B ya existe")
        return
    addition = r"""

## Fase 5B — Language enforcement IA/backend

Esta fase agrega una capa no destructiva en backend para mejorar consistencia de idioma en respuestas narrativas provenientes de IA, evidencias, planes de acción, reportes y módulos relacionados.

Reglas:

- Solo actúa cuando `locale=en` o `x-tcdx-locale: en`.
- No modifica BD.
- No modifica `.env`.
- No cambia códigos internos, UUIDs, URLs, emails, tokens ni enums.
- No altera payloads enviados desde frontend.
- Traduce visualmente/narrativamente respuestas JSON antes de enviarlas al frontend.
- Agrega helpers de instrucción de idioma para ai-engine.

Archivos principales:

- `backend/src/utils/aiLocaleText.js`
- `backend/src/middleware/aiLocaleResponseGuard.js`
- `ai-engine/app/services/language_service.py`
- `scripts/qa-ai-locale-consistency.sh`

QA:

```bash
bash scripts/qa-ai-locale-consistency.sh
```

Límite conocido: la traducción sigue siendo determinística. Texto libre no reconocido o respuestas IA muy variables pueden requerir una fase posterior con prompts específicos por endpoint o traducción IA controlada con caché/revisión humana.
"""
    write(path, s.rstrip() + addition)
    log("[OK] docs: sección 5B agregada")


def validate() -> None:
    # Syntax / targeted QA. Avoid full deploy. Frontend build included because AppLayout/frontend guards have been touched in prior phase.
    run(["node", "-c", "backend/src/app.js"])
    run(["node", "-c", "backend/src/utils/aiLocaleText.js"])
    run(["node", "-c", "backend/src/middleware/aiLocaleResponseGuard.js"])
    for file in [
        "backend/src/routes/ai-compliance.routes.js",
        "backend/src/routes/ai-auditor.routes.js",
        "backend/src/utils/locale.js",
        "backend/src/utils/errorResponse.js",
        "backend/src/utils/errorCodes.js",
    ]:
        if (ROOT / file).exists():
            run(["node", "-c", file])
    run(["python3", "-m", "py_compile", "ai-engine/app/services/language_service.py"])
    run(["bash", "-n", "scripts/qa-ai-locale-consistency.sh"])
    run(["bash", "scripts/qa-ai-locale-consistency.sh"])
    if (ROOT / "scripts/qa-i18n-db-display.sh").exists():
        run(["bash", "-n", "scripts/qa-i18n-db-display.sh"])
        run(["bash", "scripts/qa-i18n-db-display.sh"])
    if (ROOT / "frontend/package.json").exists():
        run(["npm", "run", "build"], cwd=ROOT / "frontend")
    run(["git", "diff", "--check"])


def main() -> int:
    log("======================================")
    log(" APPLY FASE 5B ATOMIC — AI LANGUAGE ENFORCEMENT")
    log("======================================")
    log(f"ROOT={ROOT}")
    log(f"LOG={LOG_FILE}")

    try:
        assert_repo()
        snapshot(TARGETS)

        write(ROOT / "backend/src/utils/aiLocaleText.js", ai_locale_text_js())
        write(ROOT / "backend/src/middleware/aiLocaleResponseGuard.js", ai_locale_response_guard_js())
        patch_app_js()
        patch_language_service_py()
        write(ROOT / "scripts/qa-ai-locale-consistency.sh", qa_script())
        os.chmod(ROOT / "scripts/qa-ai-locale-consistency.sh", 0o755)
        update_docs()

        validate()

        log("\n======================================")
        log(" FASE 5B ATOMIC APLICADA OK")
        log("======================================")
        log("Archivos esperados modificados/creados:")
        for path in TARGETS:
            if path.exists():
                log(f"- {path.relative_to(ROOT)}")
        log("\nSiguiente paso:")
        log("git status -sb")
        log("git diff --stat")
        log("git add backend/src/utils/aiLocaleText.js backend/src/middleware/aiLocaleResponseGuard.js backend/src/app.js ai-engine/app/services/language_service.py scripts/qa-ai-locale-consistency.sh docs/i18n-db-display-layer.md")
        log("git commit -m \"Enforce English locale in AI and backend narratives\"")
        log("git push origin main")
        return 0
    except Exception as exc:
        log(f"\n[ERROR] {exc}")
        rollback()
        log("\nFASE 5B NO APLICADA. Repo restaurado al estado previo.")
        log(f"Revisar log: {LOG_FILE}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
