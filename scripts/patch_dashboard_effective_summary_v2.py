from pathlib import Path
from datetime import datetime
import re

p = Path("frontend/src/app/dashboard/page.tsx")

if not p.exists():
    raise SystemExit("ERROR: no existe frontend/src/app/dashboard/page.tsx")

text = p.read_text()
original = text

backup = p.with_suffix(p.suffix + f".bak_effective_iso_summary_v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
backup.write_text(text)

# ============================================================
# 1) Tipos y helpers
# ============================================================

type_block = """
type EffectiveIsoHealthRow = {
  tenant_id?: string;
  iso: string;
  operation_id?: string;
  operation_name?: string;
  operation_code?: string;
  operation_type?: string;
  total_controls?: number | string | null;
  active_scope_controls?: number | string | null;
  out_of_scope_controls?: number | string | null;
  complies_controls?: number | string | null;
  partial_controls?: number | string | null;
  non_compliant_or_no_data_controls?: number | string | null;
  healthy_controls?: number | string | null;
  attention_controls?: number | string | null;
  deteriorated_controls?: number | string | null;
  controls_with_official_evidence?: number | string | null;
  controls_with_approved_non_official_evidence?: number | string | null;
  controls_without_evidence?: number | string | null;
  approved_evidence_count?: number | string | null;
  official_evidence_count?: number | string | null;
  open_findings_count?: number | string | null;
  open_nonconformities_count?: number | string | null;
  open_action_plans_count?: number | string | null;
  overdue_action_plans_count?: number | string | null;
  avg_effective_health_score?: number | string | null;
  compliance_percentage?: number | string | null;
  official_evidence_percentage?: number | string | null;
  kpi_health_status?: string | null;
};

function toSafeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapEffectiveHealthLabel(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') return 'Saludable';
  if (normalized === 'atencion') return 'Atención';
  if (normalized === 'critico') return 'Crítico';
  if (normalized === 'deteriorado') return 'Deteriorado';
  if (normalized === 'sin_alcance') return 'Sin alcance';

  return 'Sin datos';
}

function getEffectiveHealthTone(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'atencion') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'critico') return 'border-red-200 bg-red-50 text-red-700';
  if (normalized === 'deteriorado') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'sin_alcance') return 'border-slate-200 bg-slate-50 text-slate-500';

  return 'border-slate-200 bg-slate-50 text-slate-600';
}
"""

if "type EffectiveIsoHealthRow" not in text:
    m = re.search(r"\ntype\s+AuditItem\s*=", text)
    if not m:
        raise SystemExit("ERROR: no encontré type AuditItem para insertar tipos/helpers.")
    text = text[:m.start()] + "\n" + type_block + text[m.start():]

# ============================================================
# 2) Estado useState dentro del componente
# ============================================================

state_line = "  const [effectiveHealthRows, setEffectiveHealthRows] = useState<EffectiveIsoHealthRow[]>([]);"

if "const [effectiveHealthRows, setEffectiveHealthRows]" not in text:
    # Insertar después del estado summary, porque ya existe en tu archivo.
    anchor = "  const [summary, setSummary] = useState<DashboardSummary | null>(null);"
    if anchor not in text:
      raise SystemExit("ERROR: no encontré useState summary para insertar estado.")
    text = text.replace(anchor, anchor + "\n" + state_line, 1)

# ============================================================
# 3) Carga API
# ============================================================

load_block = """
  const loadEffectiveHealthSummary = useCallback(async () => {
    if (!user?.tenant_id || !token) return;

    try {
      const res = await fetch(`${API_URL}/api/kpi/effective-health-summary/${user.tenant_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR EFFECTIVE ISO HEALTH SUMMARY:', json);
        setEffectiveHealthRows([]);
        return;
      }

      const rows = Array.isArray(json?.active_summary)
        ? json.active_summary
        : Array.isArray(json?.summary)
          ? json.summary.filter((row: EffectiveIsoHealthRow) => toSafeNumber(row.active_scope_controls) > 0)
          : [];

      setEffectiveHealthRows(rows);
    } catch (err) {
      console.error('ERROR EFFECTIVE ISO HEALTH SUMMARY:', err);
      setEffectiveHealthRows([]);
    }
  }, [user?.tenant_id, token]);

"""

if "loadEffectiveHealthSummary" not in text:
    # Insertar antes de loadKpiDashboard, si existe.
    m = re.search(r"\n\s+const\s+loadKpiDashboard\s*=", text)
    if not m:
        # Alternativa: antes de handleRecalculateKpis
        m = re.search(r"\n\s+const\s+handleRecalculateKpis\s*=", text)

    if not m:
        raise SystemExit("ERROR: no encontré dónde insertar loadEffectiveHealthSummary.")

    text = text[:m.start()] + "\n" + load_block + text[m.start():]

# ============================================================
# 4) Llamar carga en useEffect
# ============================================================

if "loadEffectiveHealthSummary();" not in text:
    # Buscar el useEffect donde se llama loadDashboardData o loadKpiDashboard
    candidates = list(re.finditer(r"useEffect\s*\(\s*\(\)\s*=>\s*\{", text))
    if not candidates:
        raise SystemExit("ERROR: no encontré useEffect.")

    chosen = None
    for m in candidates:
        block = text[m.start():m.start()+1200]
        if "loadDashboard" in block or "loadKpiDashboard" in block or "user" in block:
            chosen = m
            break

    if chosen is None:
        chosen = candidates[0]

    insert_at = chosen.end()
    text = text[:insert_at] + "\n    loadEffectiveHealthSummary();" + text[insert_at:]

    # Si el useEffect tiene array de dependencias y no incluye la función, agregamos defensivamente.
    text = re.sub(
        r"\}, \[([^\]]*)\]\);",
        lambda mm: mm.group(0) if "loadEffectiveHealthSummary" in mm.group(1) else f"}}, [{mm.group(1).strip()}, loadEffectiveHealthSummary]);",
        text,
        count=1
    )

# ============================================================
# 5) Métricas derivadas antes del return
# ============================================================

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

if "const effectiveActiveRows = effectiveHealthRows.filter" not in text:
    m = re.search(r"\n\s+return\s*\(", text)
    if not m:
        raise SystemExit("ERROR: no encontré return principal para insertar métricas derivadas.")
    text = text[:m.start()] + "\n" + derived_block + text[m.start():]

# ============================================================
# 6) Bloque visual
# ============================================================

visual_block = """
        {effectiveActiveRows.length > 0 && (
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Salud ISO efectiva
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Cumplimiento calculado por norma y operación activa
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Usa la vista efectiva de salud ISO, excluye datos fuera de alcance y prioriza evidencia oficial.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-right">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Cumplimiento efectivo</p>
                  <p className="text-2xl font-bold text-slate-900">{effectiveCompliancePercent}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Planes vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{effectiveOverduePlans}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Controles activos</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{effectiveTotalActiveControls}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Cumplen</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">{effectiveCompliesControls}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Sin evidencia</p>
                <p className="mt-1 text-xl font-bold text-amber-700">{effectiveControlsWithoutEvidence}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Normas/operaciones activas</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{effectiveActiveRows.length}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <div className="col-span-3">Norma / operación</div>
                <div className="col-span-2 text-right">Cumplimiento</div>
                <div className="col-span-2 text-right">Evidencia oficial</div>
                <div className="col-span-2 text-right">Sin evidencia</div>
                <div className="col-span-2 text-right">Promedio salud</div>
                <div className="col-span-1 text-right">Estado</div>
              </div>

              {effectiveActiveRows.map((row) => (
                <div
                  key={`${row.iso}-${row.operation_id}`}
                  className="grid grid-cols-12 items-center border-t border-slate-100 px-4 py-3 text-sm"
                >
                  <div className="col-span-3">
                    <p className="font-semibold text-slate-900">{row.iso}</p>
                    <p className="text-xs text-slate-500">
                      {row.operation_name || 'Operación'} · {row.operation_code || 'N/A'}
                    </p>
                  </div>

                  <div className="col-span-2 text-right font-semibold text-slate-900">
                    {toSafeNumber(row.compliance_percentage)}%
                  </div>

                  <div className="col-span-2 text-right text-slate-700">
                    {toSafeNumber(row.official_evidence_percentage)}%
                  </div>

                  <div className="col-span-2 text-right text-slate-700">
                    {toSafeNumber(row.controls_without_evidence)}
                  </div>

                  <div className="col-span-2 text-right text-slate-700">
                    {toSafeNumber(row.avg_effective_health_score)}
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getEffectiveHealthTone(row.kpi_health_status)}`}>
                      {mapEffectiveHealthLabel(row.kpi_health_status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

"""

if "Salud ISO efectiva" not in text:
    # Buscamos un contenedor conocido del dashboard.
    # Prioridad: antes del primer bloque "Vista Ejecutiva" / cards principales.
    anchors = [
        "          <div className=\"grid gap-4",
        "          <section className=\"grid",
        "          <div className=\"mb-",
        "          <div className=\"space-y-",
    ]

    inserted = False

    for anchor in anchors:
        idx = text.find(anchor)
        if idx != -1:
            text = text[:idx] + visual_block + text[idx:]
            inserted = True
            break

    if not inserted:
        # Inserción alternativa: justo después de <AppLayout>
        m = re.search(r"(<AppLayout[^>]*>\s*)", text)
        if m:
            text = text[:m.end()] + "\n" + visual_block + text[m.end():]
            inserted = True

    if not inserted:
        raise SystemExit(
            "ERROR: no pude insertar bloque visual. Ejecuta: sed -n '1040,1125p' frontend/src/app/dashboard/page.tsx"
        )

# ============================================================
# 7) Validaciones
# ============================================================

required = [
    "type EffectiveIsoHealthRow",
    "loadEffectiveHealthSummary",
    "effectiveActiveRows",
    "Salud ISO efectiva",
    "/api/kpi/effective-health-summary/",
]

missing = [r for r in required if r not in text]
if missing:
    raise SystemExit(f"ERROR: faltan elementos después del parche: {missing}")

if text == original:
    print("WARN: no se realizaron cambios. Puede que ya estuviera aplicado.")
else:
    p.write_text(text)
    print("OK: dashboard principal integrado con Salud ISO efectiva.")
    print(f"Backup: {backup}")
