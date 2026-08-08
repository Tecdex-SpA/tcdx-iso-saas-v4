# Inventario de estado previo a Fase 5-C3

Baseline: `c20370566eb3f0d311dd82a6c68e66a070ed32ce`. Inspección local sobre schema versionado; no se consultó producción.

## Activos autoritativos reutilizados

| Capa | Activo vigente | Estado y disposición 5-C3 |
|---|---|---|
| Registro matemático | `official_formula_definitions`, `official_formula_versions`, `formulaRegistry.service.js` | Autoridad única. Mantener y enlazar; no duplicar expresiones. |
| Ejecución oficial | `officialCalculationOrchestrator.service.js`, servicios `math-governance/*Calculation` | Mantener. Toda medición oficial nueva debe referenciar su `calculation_run`. |
| Persistencia de cálculo | `calculation_runs`, inputs, outputs, validations, snapshots, explanations y comparisons | Extender de forma compatible para publicación funcional y reproducibilidad. |
| Binding/policy | `metric_source_bindings`, `metric_calculation_policies` | Extender con versión, vigencia, checksum, contrato semántico y unicidad de binding publicado. |
| Catálogo | `metric_definitions`, `metric_formula_versions`, dimensions, sources | Consolidar como catálogo funcional versionado. `metric_formula_versions` queda como compatibilidad, sin ejecución paralela. |
| Medición | `metric_measurements`, `metric_validations` | Extender con estados oficiales, cobertura, suficiencia, source snapshots y run oficial. |
| Snapshots | `metric_snapshots`, `data_snapshots`, `calculation_snapshots` | `metric_snapshots` será snapshot funcional publicado; los otros conservan fuente y ejecución. |
| Comparación | `data_comparisons`, `calculation_comparisons` | Reutilizar `data_comparisons` entre snapshots oficiales y registrar compatibilidad metodológica. |
| Data Trust | `data_trust_scores`, `dataTrustScore.js` | Sustituir defaults heurísticos por política versionada y evidencia por ocho dimensiones. |
| Capa semántica | contratos/versiones, mappings, `grc_observations`, sufficiency rules, source snapshots y lineage | Entrada obligatoria; estados negativos permanecen explícitos. |
| Jobs | `tcdx_async_jobs` y helper compartido | Reutilizar para calculate/snapshot/comparison/freshness/alert/reconcile/retention. |
| Seguridad comercial | permissions `metrics.*`, capabilities `metrics.catalog`, `metrics.engine`, `metrics.data_trust`; entitlements y usage | Extender capabilities y límites por operación, manteniendo middleware actual. |
| Reporting/BI | resultados oficiales, dashboard snapshots, report generations y artefactos | Adaptar al snapshot funcional sin recalcular. |

## Catálogos y datos legacy

| Activo | Riesgo | Disposición |
|---|---|---|
| `kpi_definitions` / `kpi_snapshots` / `/api/kpi*` | Valor paralelo consumido por `/dashboard` | Adaptar como compatibilidad de lectura al resultado/snapshot oficial; retirar recálculo como fuente oficial. |
| `grc_metric_definitions` / `grc_metric_measurements` | Métricas operacionales de Fase 3 con metodología propia | Mantener como registros operacionales/fuente; nunca presentarlos como output 5-C3. |
| `metric_formula_versions` + `phase5/formulaEngine.js` | Segundo ejecutor declarativo | Deprecar ejecución; resolver binding hacia `official_formula_versions`. |
| `calculation_consumers` | Inventario parcial | Actualizar con cada consumer migrado y estado activo/retired. |
| KPIs `DEMO-KPI-*` y snapshots demo | Compatibilidad comercial | Preservar filas e históricos; adaptar lectura, sin reescribir migraciones aplicadas. |

## Cobertura funcional documental

El catálogo vigente contiene 22 conceptos: GRC Health, ISO Readiness, Compliance, Coverage, Risk Inherent, Risk Residual, Control Effectiveness, Evidence Freshness, Remediation, Findings, Actions, Audit Assurance, Supplier Risk, Continuity, Incidents, Losses, Data Trust, Maturity, Operational Performance, Control Coverage, SLA Compliance y Supplier Health. Todos deben tener código funcional estable, binding único, política de suficiencia/freshness/trust/threshold y estado de publicación explícito.

## Brechas contractuales demostradas

1. `metric_definitions` no versiona integralmente concepto, objetivo, población, metodología, checksum ni ciclo reviewed.
2. Bindings/policies no conservan versión publicada, contrato semántico, mapping, actor/reviewer o checksum.
3. Data Trust convierte unknown a score cero y usa constantes heurísticas para stability, assurance y dimensiones sin evidencia.
4. `metric_measurements` exige valor y no representa todos los estados oficiales sin inventar texto.
5. `metric_snapshots` no distingue draft/published ni protege publicación inmutable, y su payload mínimo no fija todas las versiones.
6. Comparaciones no declaran compatibilidad metodológica ni ventanas 6/12/24.
7. No hay interpretación persistida ni propuesta de acción gobernada 5-C3.
8. Jobs no tienen contrato 5-C3 de timeout/retry/correlation persistido por tipo.
9. `/metricas` prioriza fórmula/builder técnico; no ofrece el contrato funcional premium.
10. `/dashboard` consume KPI legacy y calcula score/cobertura en frontend.

Estas brechas justifican una forward migration aditiva y un servicio de gobierno que orquesta las piezas existentes. No justifican un motor matemático nuevo.
