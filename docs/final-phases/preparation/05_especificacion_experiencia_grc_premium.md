# Especificación de experiencia GRC premium

## Principios

- La vista de negocio presenta concepto, resultado, tendencia, cobertura, confianza, interpretación, causa, impacto, recomendación y acción.
- Fórmulas, SQL, tablas, columnas, adapters y códigos internos quedan en un panel técnico colapsable y protegido.
- Ausencia de datos se muestra como `Sin medición`, `Fuente no disponible` o `Cobertura insuficiente`; nunca como cero.
- Los filtros globales de tenant, período, estándar, proceso y owner mantienen semántica común.

## Centro Ejecutivo

| Aspecto | Especificación |
|---|---|
| Objetivo | Responder estado, cambio, causa, impacto y decisión requerida. |
| Roles | Directorio, ejecutivo GRC, risk/compliance lead; lectura técnica separada. |
| Datos | GRC Health, readiness, cumplimiento/cobertura, riesgo residual, control effectiveness, acciones críticas y trust. |
| Filtros | Período, estándar, unidad, proceso, owner; comparación contra snapshot. |
| Cards | Valor, tendencia, objetivo, coverage, trust y estado; máximo ocho prioritarias. |
| Gráficas | Tendencias 6/12/24 períodos, exposición por dominio, distribución de prioridad. |
| Tabla | Decisiones ordenadas por priority score con causa, owner y fecha. |
| Drill-down | Card → componente → observación → entidad 360 → evidencia/acción. |
| Acciones | Crear decisión/plan, asignar owner, aprobar excepción, abrir snapshot/reporte. |
| Permisos | `grc.executive.read`; mutaciones requieren permiso específico, capability y entitlement. |
| Estados | Skeleton estable; empty orientado a fuente; error por bloque; success con request_id. |
| Responsive | 4/2/1 columnas; tabla en contenedor con scroll; acciones sticky en móvil. |
| Accesibilidad | Orden de foco, headings, texto alternativo, no depender de color, contraste AA. |
| APIs | `/api/grc/executive`, `/api/grc/decisions`, `/api/metrics/*`, snapshots oficiales. |
| Aceptación | Mismo valor/unidad/período/trust que dominio, dashboard y reporte; ninguna fórmula visible. |

## Centro Operativo

| Aspecto | Especificación |
|---|---|
| Objetivo | Operar asuntos GRC priorizados y evitar listas de módulos aisladas. |
| Roles | Analista GRC, owners de riesgo/control/acción, supervisor. |
| Datos | Acciones vencidas, controles degradados, riesgos sin tratamiento, evidencias vencidas, requisitos sin evaluar, tests fallidos, proveedores críticos y fuentes stale. |
| Filtros | Tipo, severidad, prioridad, owner, due date, proceso, estándar, estado. |
| Cards | Backlog, críticos, vencidos, sin owner, sin evidencia y fuente insuficiente. |
| Gráficas | Aging, flujo de cierre, backlog growth, concentración por owner/proceso. |
| Tabla | Cola unificada con asunto, causa, impacto, prioridad, owner, fecha y siguiente acción. |
| Drill-down | Asunto → relaciones GRC → historial → evidencia → acción. |
| Acciones | Asignar, crear plan, escalar, solicitar evidencia, programar re-test, cerrar con verificación. |
| Permisos | Lectura por dominio; mutación según tipo de entidad; servidor autoritativo. |
| Estados | Loading paginado; empty por filtro; error recuperable; confirmación de mutación. |
| Responsive | Filtros en drawer; columnas prioritarias; ninguna acción se elimina. |
| Accesibilidad | Tabla navegable, menú de fila etiquetado, focus visible y live region para cambios. |
| APIs | `/api/grc/operational`, impact/priority/decisions/actions. |
| Aceptación | Todo asunto tiene causa, owner/fecha o razón de ausencia, acción y audit event. |

## Riesgo 360

| Aspecto | Especificación |
|---|---|
| Objetivo | Explicar exposición inherente/residual y eficacia de mitigación. |
| Roles | Risk owner, control owner, ejecutivo, auditor lectura. |
| Datos | Definición, causa, consecuencia, P/I, metodología, controles, KRIs, incidentes, pérdidas, proveedores, activos, hallazgos, acciones y evidencia. |
| Filtros | Período, metodología, proceso, owner, nivel, estado, apetito. |
| Cards | Inherente, residual, apetito, tendencia, coverage, trust. |
| Gráficas | Heatmap semántico, tendencia residual, contribución de controles y pérdidas. |
| Tabla | Controles, eventos y acciones vinculadas con estado y evidencia. |
| Drill-down | Componente de score → source observation → cálculo autorizado → evidencia. |
| Acciones | Evaluar, tratar, aceptar con aprobación, asignar control, crear KRI/plan. |
| Permisos | `risks.read/manage/approve`; capability `risk.*`; límites de métricas. |
| Estados | Sin metodología bloquea cálculo; fuente insuficiente no muestra nivel artificial. |
| Responsive/accesibilidad | Heatmap con tabla equivalente; teclado y etiquetas por celda. |
| APIs | `/api/risks/*`, `/api/grc/official/analytics/risk.*`, impact/lineage. |
| Aceptación | Residual no supera inherente sin explicación; metodología y período consistentes. |

## Control 360

| Aspecto | Especificación |
|---|---|
| Objetivo | Mostrar si el control está bien diseñado, implementado y operando. |
| Roles | Control owner, assurance, risk/compliance, auditor. |
| Datos | Objetivo, tipo, frecuencia, diseño, implementación, operación, evidencia, tests, excepciones, riesgos y requisitos. |
| Filtros | Proceso, owner, tipo, frecuencia, efectividad, evidencia, período. |
| Cards | Effectiveness, coverage, frequency compliance, failure rate, freshness/trust. |
| Gráficas | Componentes, ejecución temporal, fallos y riesgos mitigados. |
| Tabla | Ejecuciones, evidencias, assurance, excepciones y acciones. |
| Drill-down | Componente → ejecución/test/evidencia → source snapshot. |
| Acciones | Registrar ejecución, solicitar evidencia, programar test, crear acción, re-test. |
| Permisos | `controls.read/manage`, `evidence.*`, `assurance.*`. |
| Estados | Inconclusive separado; no aplica excluido; vencido destacado con texto. |
| Responsive/accesibilidad | Gráfica con resumen textual; tablas con headers y scroll controlado. |
| APIs | `/api/controls/*`, assurance/evidence y analytics oficiales. |
| Aceptación | Score no se calcula en UI y cada componente tiene evidencia trazable. |

## Cumplimiento 360

| Aspecto | Especificación |
|---|---|
| Objetivo | Relacionar aplicabilidad, evaluación, controles, evidencia y remediación. |
| Roles | Compliance owner, responsable ISO, control owner, auditor. |
| Datos | Norma/requisito, aplicabilidad, score, coverage, owner, controles, evidencias, hallazgos, acciones y readiness. |
| Filtros | Norma, versión, cláusula, dominio, proceso, owner, estado, período. |
| Cards | Compliance, coverage, no evaluados, brechas, evidencia vigente, readiness. |
| Gráficas | Tendencia, distribución de estado y cobertura por norma/dominio. |
| Tabla | Requisitos con estado, confidence, owner, brecha y acción. |
| Drill-down | Requisito → evaluación → control → evidencia → hallazgo/acción. |
| Acciones | Evaluar, justificar no aplica, mapear control, solicitar evidencia, crear plan. |
| Permisos | `framework.*`, `soa.*`, `compliance.*`, evidence/action específicos. |
| Estados | No aplica requiere aprobación; no evaluado no cuenta conforme. |
| Responsive/accesibilidad | Tabla jerárquica accesible; filtros resumidos en móvil. |
| APIs | `/api/soa`, `/api/tenant-standards`, `/api/grc/frameworks`, analytics compliance. |
| Aceptación | Compliance siempre acompaña coverage; definición única entre canales. |

## Centro de Datos y Confianza

| Aspecto | Especificación |
|---|---|
| Objetivo | Permitir corregir fuentes y comprender la confiabilidad sin abrumar a negocio. |
| Roles | Data owner/steward, platform admin, auditor técnico; negocio en vista resumida. |
| Datos | Contratos, versiones, received/usable/excluded/rejected, freshness, quality, lineage, métricas afectadas. |
| Filtros | Dominio, fuente, estado, owner, freshness, período, indicador impactado. |
| Cards | Fuentes saludables, incompatibles, stale, cobertura, trust y métricas afectadas. |
| Gráficas | Calidad por componente, freshness y evolución de errores. |
| Tabla | Fuente conceptual por defecto; tabla/columna solo en panel técnico autorizado. |
| Drill-down | Fuente → contrato → mapping → observaciones → mediciones → consumidores. |
| Acciones | Asignar owner, versionar mapping, revalidar, recalcular, abrir finding de datos. |
| Permisos | `data.governance`, `data.technical.read/manage`, `metrics.engine`. |
| Estados | Unknown explícito; error técnico con código funcional y request_id. |
| Responsive/accesibilidad | Doble panel pasa a navegación secuencial; grafos tienen lista alternativa. |
| APIs | `/api/data/*`, source contracts, lineage, quality, recalculation. |
| Aceptación | Perfil negocio no recibe SQL/nombres físicos; técnico puede auditar lineage completo. |

## Dashboard de Integraciones

| Aspecto | Especificación |
|---|---|
| Objetivo | Operar conectores por salud, cobertura, freshness, errores e impacto GRC. |
| Roles | Integration admin, data steward, security, GRC owner; soporte con acceso aprobado. |
| Datos | Connector/version, auth/scopes, runs, checkpoints, records, mappings, DLQ, usage, impacts. |
| Filtros | Provider, tenant, estado, health, last sync, error, dominio. |
| Cards | Conectados, degradados, expirados, stale, DLQ, límite utilizado. |
| Gráficas | Runs/errores/freshness y observaciones por dominio. |
| Tabla | Integración con causa, última ejecución, próximo run, records y acción. |
| Drill-down | Connector → run → raw → mapping → observation → metric → impact/action. |
| Acciones | Conectar, rotar/revocar, probar scopes, sync, retry, replay DLQ, pausar. |
| Permisos | `connectors.*`, capability/entitlement/limit y secret-management separado. |
| Estados | Sandbox nunca se etiqueta live; credencial ausente/expirada es estado funcional. |
| Responsive/accesibilidad | Tablas densas con columnas configurables; status no depende de color. |
| APIs | `/api/integrations/*`, `/api/connectors/*`, runs/health/mappings. |
| Aceptación | Cada provider demuestra dato→observación→indicador→impacto→acción. |

## Dashboard MSP

| Aspecto | Especificación |
|---|---|
| Objetivo | Gestionar cartera, engagements, SLA, accesos, servicios e integraciones sin perder control tenant. |
| Roles | Partner admin/manager/analyst/support; tenant approver; Tecdex platform admin. |
| Datos | Clientes asignados, onboarding, tickets, SLA, accesos, servicios, integraciones, scorecard, offboarding. |
| Filtros | Partner, tenant autorizado, engagement, servicio, SLA, estado, owner, período. |
| Cards | Tenants activos, onboarding en riesgo, SLA breach, accesos por expirar, integraciones degradadas. |
| Gráficas | SLA/tickets, health de cartera, evolución scorecard y carga por equipo. |
| Tabla | Engagements y asuntos operativos con propósito, vigencia, owner y próxima acción. |
| Drill-down | Partner → engagement → tenant permitido → servicio/ticket/acceso → audit. |
| Acciones | Solicitar acceso, asignar equipo, escalar ticket, ejecutar servicio, iniciar offboarding. |
| Permisos | Intersección partner+engagement+assignment+service+role+permission+tenant+vigencia. |
| Estados | Sin engagement no hay datos; acceso expirado revoca inmediatamente; offboarding bloquea nuevas sesiones. |
| Responsive/accesibilidad | Selector tenant accesible y explícito; no persistir tenant fuera de sesión autorizada. |
| APIs | `/api/v1/partners/*`, partner-access, support, services, scorecards, offboarding. |
| Aceptación | Partner A no ve Partner B ni tenants no asignados; cada sesión tiene propósito y expiración. |

## Componentes compartidos requeridos

`FunctionalMetricCard`, `TrustBadge`, `CoverageIndicator`, `TrendComparison`, `DecisionPanel`, `ActionComposer`, `SourceSummary`, `TechnicalMethodologyDisclosure`, `EvidenceLink`, `StateBoundary` y `TenantScopeBanner`. Todos consumen contratos backend; ninguno calcula métricas.
