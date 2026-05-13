from pathlib import Path
from datetime import datetime
import re

p = Path("frontend/src/app/dashboard-kpi/page.tsx")

if not p.exists():
    raise SystemExit("ERROR: no existe frontend/src/app/dashboard-kpi/page.tsx")

text = p.read_text()
backup = p.with_suffix(p.suffix + f".bak_effective_kpi_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
backup.write_text(text)

original = text

# ============================================================
# 1) Agregar tipos para resumen efectivo
# ============================================================

type_block = r"""
type EffectiveHealthSummaryItem = {
  tenant_id: string;
  iso: string;
  operation_id: string;
  operation_name?: string | null;
  operation_code?: string | null;
  operation_type?: string | null;
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
  kpi_trace_json?: Record<string, unknown> | null;
};

type EffectiveHealthSummaryResponse = {
  ok: boolean;
  tenant_id: string;
  source?: string;
  total_rows?: number;
  active_rows?: number;
  summary?: EffectiveHealthSummaryItem[];
  active_summary?: EffectiveHealthSummaryItem[];
};
"""

if "type EffectiveHealthSummaryItem =" not in text:
    anchor = "type KpiDashboardItem = {"
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit("ERROR: no encontré type KpiDashboardItem como ancla.")
    text = text[:idx] + type_block + "\n" + text[idx:]

# ============================================================
# 2) Agregar helpers
# ============================================================

helpers_block = r"""
function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapEffectiveHealthLabel(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') return 'Saludable';
  if (normalized === 'atencion') return 'Atención';
  if (normalized === 'deteriorado') return 'Deteriorado';
  if (normalized === 'critico') return 'Crítico';
  if (normalized === 'sin_alcance') return 'Sin alcance';
  if (normalized === 'fuera_alcance') return 'Fuera de alcance';
  if (normalized === 'sin_datos') return 'Sin datos';

  return value || 'Sin datos';
}

function getEffectiveHealthTone(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized === 'atencion') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalized === 'critico' || normalized === 'deteriorado') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (normalized === 'sin_alcance' || normalized === 'fuera_alcance') {
    return 'border-slate-200 bg-slate-50 text-slate-500';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}
"""

if "function mapEffectiveHealthLabel" not in text:
    anchor = "function normalizeKpiDashboardItem(item: any): KpiDashboardItem {"
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit("ERROR: no encontré normalizeKpiDashboardItem como ancla.")
    text = text[:idx] + helpers_block + "\n" + text[idx:]

# ============================================================
# 3) Agregar estados React
# ============================================================

state_anchor = "const [kpiData, setKpiData] = useState<KpiDashboardResponse | null>(null);"
state_insert = """const [effectiveHealthData, setEffectiveHealthData] = useState<EffectiveHealthSummaryResponse | null>(null);
  const [loadingEffectiveHealth, setLoadingEffectiveHealth] = useState(false);"""

if "effectiveHealthData" not in text:
    if state_anchor not in text:
        raise SystemExit("ERROR: no encontré estado kpiData como ancla.")
    text = text.replace(
        state_anchor,
        state_anchor + "\n  " + state_insert,
        1
    )

# ============================================================
# 4) Hacer que loadKpiDashboard cargue también el resumen efectivo
# ============================================================

load_anchor = """      const json = await fetchJson(
        `${API_URL}/api/kpis/dashboard/${user.tenant_id}`,
        token
      );

      setKpiData(
        normalizeKpiDashboardResponse(json || { summary: undefined, items: [] })
      );"""

load_replacement = """      const [json, effectiveJson] = await Promise.all([
        fetchJson(`${API_URL}/api/kpis/dashboard/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/kpi/effective-health-summary/${user.tenant_id}`, token),
      ]);

      setKpiData(
        normalizeKpiDashboardResponse(json || { summary: undefined, items: [] })
      );

      setEffectiveHealthData(effectiveJson || null);"""

if load_anchor in text and "effective-health-summary" not in text:
    text = text.replace(load_anchor, load_replacement, 1)

# Si ya existe effective-health-summary pero no está el estado, no tocar.

# ============================================================
# 5) Agregar variables calculadas cerca de kpiItems/kpiSummary
# ============================================================

calc_anchor = """  const kpiItems = kpiData?.items || [];
  const kpiSummary = kpiData?.summary;
  const healthKpiCount = kpiItems.filter("""

calc_insert = """  const kpiItems = kpiData?.items || [];
  const kpiSummary = kpiData?.summary;
  const effectiveHealthRows = effectiveHealthData?.active_summary || [];
  const effectiveHealthTotals = effectiveHealthRows.reduce(
    (acc, row) => {
      acc.activeControls += toSafeNumber(row.active_scope_controls);
      acc.compliesControls += toSafeNumber(row.complies_controls);
      acc.withoutEvidence += toSafeNumber(row.controls_without_evidence);
      acc.officialEvidenceControls += toSafeNumber(row.controls_with_official_evidence);
      acc.overdueActionPlans += toSafeNumber(row.overdue_action_plans_count);
      acc.openNonconformities += toSafeNumber(row.open_nonconformities_count);
      return acc;
    },
    {
      activeControls: 0,
      compliesControls: 0,
      withoutEvidence: 0,
      officialEvidenceControls: 0,
      overdueActionPlans: 0,
      openNonconformities: 0,
    }
  );
  const effectiveCompliancePercent =
    effectiveHealthTotals.activeControls > 0
      ? Math.round((effectiveHealthTotals.compliesControls / effectiveHealthTotals.activeControls) * 100)
      : 0;
  const effectiveOfficialEvidencePercent =
    effectiveHealthTotals.activeControls > 0
      ? Math.round((effectiveHealthTotals.officialEvidenceControls / effectiveHealthTotals.activeControls) * 100)
      : 0;
  const healthKpiCount = kpiItems.filter("""

if "const effectiveHealthRows = effectiveHealthData?.active_summary || [];" not in text:
    if calc_anchor not in text:
        raise SystemExit("ERROR: no encontré bloque kpiItems/kpiSummary como ancla.")
    text = text.replace(calc_anchor, calc_insert, 1)

# ============================================================
# 6) Agregar bloque visual dentro de activeView === 'kpi'
#    Lo insertamos antes del bloque loadingKpis.
# ============================================================

visual_block = r"""
              {effectiveHealthRows.length > 0 && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Salud ISO efectiva
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        Cumplimiento calculado por norma y operación activa
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm text-slate-500">
                        Este resumen usa la vista efectiva de cumplimiento. Excluye datos fuera de alcance operacional y prioriza evidencia oficial, hallazgos, no conformidades y planes vencidos.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xs text-slate-500">Cumplimiento efectivo</p>
                      <p className="text-2xl font-bold text-slate-900">{effectiveCompliancePercent}%</p>
                      <p className="text-xs text-slate-500">
                        Evidencia oficial: {effectiveOfficialEvidencePercent}%
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Controles activos</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {effectiveHealthTotals.activeControls}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Cumplen</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-700">
                        {effectiveHealthTotals.compliesControls}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Sin evidencia</p>
                      <p className="mt-1 text-2xl font-semibold text-amber-700">
                        {effectiveHealthTotals.withoutEvidence}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">Planes vencidos</p>
                      <p className="mt-1 text-2xl font-semibold text-red-700">
                        {effectiveHealthTotals.overdueActionPlans}
                      </p>
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

                    {effectiveHealthRows.map((row) => (
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

loading_anchor = """              {loadingKpis && (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  {t('dashboardKpi.loadingKpiView')}
                </div>
              )}"""

if "Salud ISO efectiva" not in text:
    if loading_anchor not in text:
        raise SystemExit("ERROR: no encontré bloque loadingKpis como ancla.")
    text = text.replace(loading_anchor, visual_block + "\n\n" + loading_anchor, 1)

# ============================================================
# 7) Limpieza defensiva
# ============================================================

text = text.replace("const [loadingEffectiveHealth, setLoadingEffectiveHealth] = useState(false);\n", "")

if text == original:
    print("WARN: no se realizaron cambios. Puede que ya estuviera aplicado.")
else:
    p.write_text(text)
    print("OK: dashboard KPI integrado con resumen efectivo ISO.")
    print(f"Backup: {backup}")

