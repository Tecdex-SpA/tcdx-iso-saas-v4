from pathlib import Path
from datetime import datetime
import re

p = Path("frontend/src/app/dashboard/page.tsx")

if not p.exists():
    raise SystemExit("ERROR: no existe frontend/src/app/dashboard/page.tsx")

text = p.read_text()
original = text

backup = p.with_suffix(p.suffix + f".bak_fix_effective_scope_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
backup.write_text(text)

derived_block_pattern = re.compile(
    r"""
\s*
  const effectiveActiveRows = effectiveHealthRows\.filter\(
    \(row\) => toSafeNumber\(row\.active_scope_controls\) > 0
  \);

  const effectiveTotalActiveControls = effectiveActiveRows\.reduce\(
    \(acc, row\) => acc \+ toSafeNumber\(row\.active_scope_controls\),
    0
  \);

  const effectiveCompliesControls = effectiveActiveRows\.reduce\(
    \(acc, row\) => acc \+ toSafeNumber\(row\.complies_controls\),
    0
  \);

  const effectiveControlsWithoutEvidence = effectiveActiveRows\.reduce\(
    \(acc, row\) => acc \+ toSafeNumber\(row\.controls_without_evidence\),
    0
  \);

  const effectiveOverduePlans = effectiveActiveRows\.reduce\(
    \(acc, row\) => acc \+ toSafeNumber\(row\.overdue_action_plans_count\),
    0
  \);

  const effectiveCompliancePercent =
    effectiveTotalActiveControls > 0
      \? Math\.round\(\(effectiveCompliesControls / effectiveTotalActiveControls\) \* 100\)
      : 0;

""",
    re.VERBOSE
)

# 1) Eliminar todas las apariciones actuales del bloque derivado.
text, removed = derived_block_pattern.subn("\n", text)

if removed == 0:
    print("WARN: no encontré bloque derivado para remover. Continuaré con validación.")

derived_block = """
  const effectiveActiveRows = effectiveHealthRows.filter(
    (row) => toSafeNumber(row.active_scope_controls) > 0
  );

  const effectiveTotalActiveControls = effectiveActiveRows.reduce(
    (acc, row) => acc + toSafeNumber(row.active_scope_controls),
    0
  );

  const effectiveCompliesControls = effectiveActiveRows.reduce(
    (acc, row) => acc + toSafeNumber(row.complies_controls),
    0
  );

  const effectiveControlsWithoutEvidence = effectiveActiveRows.reduce(
    (acc, row) => acc + toSafeNumber(row.controls_without_evidence),
    0
  );

  const effectiveOverduePlans = effectiveActiveRows.reduce(
    (acc, row) => acc + toSafeNumber(row.overdue_action_plans_count),
    0
  );

  const effectiveCompliancePercent =
    effectiveTotalActiveControls > 0
      ? Math.round((effectiveCompliesControls / effectiveTotalActiveControls) * 100)
      : 0;

"""

# 2) Insertarlo dentro del componente principal.
# Buscamos el return que contiene AppLayout, no cualquier return de componentes auxiliares.
return_matches = list(re.finditer(r"\n\s+return\s*\(", text))

target = None
for m in return_matches:
    window = text[m.start():m.start() + 3000]
    if "<AppLayout" in window or "DashboardV2" in window:
        target = m
        break

if target is None:
    # Alternativa: usar el último return largo del archivo.
    if not return_matches:
        raise SystemExit("ERROR: no encontré ningún return.")
    target = return_matches[-1]

text = text[:target.start()] + "\n" + derived_block + text[target.start():]

# 3) Validaciones para no dejarlo dentro de AiAuditorDashboardCta.
ai_cta_match = re.search(
    r"function AiAuditorDashboardCta[\s\S]*?(?=\nfunction |\nexport default|\Z)",
    text
)

if ai_cta_match and "effectiveActiveRows" in ai_cta_match.group(0):
    raise SystemExit("ERROR: effectiveActiveRows sigue dentro de AiAuditorDashboardCta.")

if "const [effectiveHealthRows, setEffectiveHealthRows]" not in text:
    raise SystemExit("ERROR: no existe el useState effectiveHealthRows.")

if "Salud ISO efectiva" not in text:
    raise SystemExit("ERROR: no existe el bloque visual Salud ISO efectiva.")

p.write_text(text)

print("OK: bloque effectiveActiveRows movido al scope correcto.")
print(f"Bloques removidos: {removed}")
print(f"Backup: {backup}")
