# Matriz de cierre de Fase 5

Estado de planificación: `NOT_READY`. La implementación actual contiene una base matemática y flujos locales probados, pero no satisface todavía la Definition of Done del plan rector.

## Secuencia obligatoria

| Bloque | Objetivo | Estado de entrada | Entregables verificables | Dependencias | Gate de cierre |
|---|---|---|---|---|---|
| 5-C1 | Auditoría integral runtime | Estática completada en esta rama; runtime no verificado | Inventario DB/API/UI/jobs, matriz ruta-endpoint, baseline Credex/Tecdex/Demo | Acceso QA y observabilidad | 100% activos clasificados y evidencia por tenant |
| 5-C2 | Capa semántica | PARCIAL | Contratos independientes, mappings, observaciones canónicas, perfilado | 5-C1 | Ningún fallback silencioso; schemas y estados normalizados |
| 5-C3 | Indicadores, trust y snapshots | PARCIAL | Catálogo funcional, suficiencia, trust real, snapshots y comparaciones | 5-C2 | Cada cifra tiene fuente, período, cobertura, confianza y snapshot |
| 5-C4 | Consolidación GRC | PARCIAL | Centros ejecutivo/operativo y vistas 360 | 5-C3 | Mismo concepto y valor en todos los consumidores |
| 5-C5 | Dashboard operativo | PARCIAL | Estado, tendencias, exposición, ejecución, calidad y decisiones | 5-C4 | Datos oficiales, drill-down y acción sin fórmula visible |
| 5-C6 | Impact Graph y prioridad | PARCIAL | Grafo causal, propagación y score determinista | 5-C2/C3 | Recorrido explicable, acotado y tenant-scoped |
| 5-C7 | Acción y verificación | PARCIAL | Plan, evidencia, re-test y comparación antes/después | 5-C6 | Ninguna acción cierra sin verificación de efectividad |
| 5-C8 | Encuestas, assurance, pérdidas y reporting | PARCIAL | Flujos completos, scheduling y artefactos | 5-C3/C7 | E2E sin mocks y artefactos válidos |
| 5-C9 | Seguridad y comercial | PARCIAL | Matriz autoritativa, limits/usage, downgrade y archivos | Todos los anteriores | Permiso+capability+entitlement+limit+tenant probados |
| 5-C10 | UX premium | PARCIAL | Navegación, estados, responsive, WCAG y detalle progresivo | 5-C4/C5/C8 | Negocio no ve fórmulas ni nombres físicos |
| 5-C11 | QA y cierre | NO_VERIFICADO_RUNTIME | CI, UAT, seguridad, rendimiento, restore y evidencia | 5-C1 a C10 | Cero fallos, deuda funcional o afirmaciones no verificadas |

## Definition of Done trazable

| Resultado | Evidencia actual | Brecha | Responsable futuro | Prueba de aceptación |
|---|---|---|---|---|
| Auditoría de producción | No ejecutada | Baseline de tres tenants | Release owner | Inventario firmado con SHA y fecha |
| Contratos de fuente | Contratos de fórmula existentes | Falta contrato semántico independiente | Data architect | Fixture por variante de schema |
| Observaciones canónicas | No existen | Unificar eventos y mediciones | Backend lead | PostgreSQL integration y tenant A/B |
| Catálogo funcional | Catálogo técnico y analytics | UX aún expone códigos | Product + UX | Prueba visual por rol |
| Trust real | Score implementado | Componentes heurísticos/default | Data quality owner | Dataset conocido y resultado reproducible |
| Snapshots | Tablas y flujos presentes | Cobertura transversal no demostrada | BI owner | Snapshot inmutable y checksum |
| Centro Ejecutivo | Superficies iniciales | Definiciones y acciones no consolidadas | Frontend lead | E2E ejecutivo con drill-down |
| Centro Operativo | Centro de decisiones inicial | No hay cola única de asuntos | GRC product owner | Prioridad, owner, fecha y acción |
| Riesgo/Control/Cumplimiento 360 | Vistas separadas | Falta contrato 360 común | Domain leads | Mismo resultado en vista, dashboard y reporte |
| Impact Graph | Relaciones parciales | No hay grafo canónico completo | Architecture | Profundidad, ciclos, tenant y explicación |
| Acción verificada | Planes existentes | No hay ciclo uniforme re-test/antes-después | Workflow owner | E2E de señal a cierre verificado |
| Encuestas | E2E local | Branching/UAT productiva pendientes | Assessment owner | Campaña completa y consecuencia aprobada |
| Assurance | E2E local | Re-test y evidencia productiva pendientes | Audit owner | Ejecución, excepción, acción y re-test |
| Pérdidas | E2E local | Moneda/distribución con datos representativos | Risk owner | Net loss, KRI y relación causal |
| Reporting | PDF/DOCX/XLSX local | Scheduling y storage runtime | Reporting owner | Segunda emisión, aprobación y descarga segura |
| Seguridad comercial | Middleware y catálogo comercial | Matrices generadas desactualizadas | Security lead | Matriz y pruebas negativas por endpoint |
| Accesibilidad | No existe prueba real | Check estructural insuficiente | UX QA | WCAG AA, teclado, foco y lector |
| Rendimiento | No existe carga representativa | Sin presupuestos ni SLO | Performance owner | Volúmenes del plan rector dentro de SLO |
| Backup/restore | Scripts presentes | Ejecución QA no verificada | Operations | Restore, checksum, RPO y RTO |
| Cierre | Documentación Fase 5.5 afirma review local | Falta aceptación productiva total | Release owner | CI/UAT verdes y evidencia sin deuda |

## Reglas de no duplicación

1. `metric_definitions` representa el concepto funcional; `official_formula_*` conserva metodología interna. No crear un tercer catálogo.
2. `calculation_runs` y snapshots oficiales son la fuente de BI/reporting; no recalcular en frontend o exporter.
3. `grc_workflow_*` y planes de acción se extienden para decisiones; no crear un workflow paralelo.
4. `grc_phase2_relations`, `data_lineage_edges` y el futuro Impact Graph se migran a un contrato común con compatibilidad explícita.
5. Reportes legacy y Fase 5 se consolidan mediante adaptadores de contrato, no eliminando rutas sin análisis de consumidores.
6. Los conectores de Fase 2 se convierten en la fundación de Fase 6; no crear otro Integration Hub.

## Orden de ejecución

5-C1 bloquea decisiones de schema. 5-C2 bloquea indicadores, grafo e integraciones. 5-C3 bloquea UX y reporting. 5-C4/C5 y 5-C6/C7 pueden desarrollarse en ramas separadas después de estabilizar contratos. 5-C8 usa las mismas mediciones y acciones. 5-C9/C10 son gates transversales. 5-C11 no repara deuda: solo valida y cierra.

## Estado reconciliado de 5-C1

La baseline local está documentada en `docs/final-phases/runtime/11_phase5_c1_closeout.md`: PostgreSQL efímero, 50 fórmulas, snapshots, lineage, artefactos, browser E2E, RBAC y tenant A/B tienen evidencia ejecutada. Los ítems que requieren VMs, producción, UAT de Credex/Tecdex/Demo, restore, conectores live o MSP siguen en sus fases de cierre; 5-C1 no los marca como completos.
