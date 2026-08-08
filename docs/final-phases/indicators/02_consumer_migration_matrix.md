# Matriz de migración de consumers 5-C3

Baseline: `c20370566eb3f0d311dd82a6c68e66a070ed32ce`.

| Consumer | Ruta/módulo | Endpoint/servicio actual | Motor/modelo actual | Riesgo | Destino oficial y estrategia | Compatibilidad/prueba | Acceso | Estado final |
|---|---|---|---|---|---|---|---|---|
| Catálogo de métricas | `/metricas` | `/api/metrics/official/catalog` | Snapshot funcional 5-C3 | Cerrado | `FunctionalIndicatorCatalog`; detalle técnico bajo demanda | API/UI verifican código, unidad y snapshot | `metrics.read`; detalle `data.lineage.read` | migrado |
| Detalle de indicador | `/metricas/[id]` | `/api/metrics/official/:code` | Snapshot funcional 5-C3 | Cerrado | Detalle, historial y comparaciones oficiales | API/UI mismo snapshot ID y checksum | lectura funcional/técnica separada | migrado |
| Builder métrica | `MetricBuilder` / `OperationalBuilder` | `/api/metrics/:id/calculate` | Administración técnica legacy | Cerrado | El endpoint resuelve el binding y delega al orquestador oficial; el builder no publica valor funcional | Test residual impide `evaluate()` como cálculo oficial | manage/publish/calculate | adaptado |
| Cockpit BI | `/bi`, `GrcDecisionCenter` | `/api/metrics/official/catalog` | Snapshot funcional 5-C3 | Cerrado | Consume interpretación persistida; `unmeasured` permanece sin valor | E2E API/UI por dos tenants | `metrics.read`, sin builder para auditor | migrado |
| Dashboard principal KPI | `/dashboard` | `/api/metrics/official/dashboard` | Adapter de snapshot 5-C3 | Cerrado | Score, cobertura, estado y color llegan desde backend | Dashboard = API = snapshot en E2E | lectura; recálculo admin | migrado |
| Dashboard Builder | `/bi/dashboards/*` | dashboards render/snapshot | Superficie metodológica 5.5 | Cerrado | Conservado como editor técnico; el cockpit funcional contiguo usa snapshot 5-C3 | Package 6 y E2E BI | dashboard RBAC existente | mantenido técnico |
| Report Studio | `/reportes/studio` | reports generate + catálogo 5-C3 | Snapshot funcional incorporado al artifact | Cerrado | `official_indicators` se resuelve en backend y preserva snapshot/checksum | Contrato estático, suite reports y export oficial | reporting existente | adaptado |
| Exportaciones | `/api/metrics/official/export` y artefactos | servicio de indicadores | Snapshot funcional | Cerrado | Fila reproduce valor, estado, unidad, período, trust, cobertura, snapshot y checksum | E2E API export = API catálogo = UI | permiso de export y límite mensual | migrado |
| Portal GRC | `GrcPortal`, centros de decisión | `OfficialAnalyticsPanel` / catálogo 5-C3 | Snapshot funcional | Cerrado | Eliminadas tarjetas paralelas del overview; interpretación y propuesta provienen del snapshot | Package 6 y scan residual | `metrics.read` | migrado |
| Data center técnico | `/datos/semantica` | `/api/data/semantic` | Capa semántica 5-C2 | Cerrado | Se mantiene como fuente técnica; el detalle 5-C3 expone binding/lineage con autorización | IDs y checksums verificables | `data.lineage.read` | mantenido |
| KPI legacy `/api/kpi*` | Administración e históricos | `kpi.controller`, `kpi.engine` | `kpi_definitions`/`kpi_snapshots` | Cerrado | Conservado como KPI operacional/legacy; ya no alimenta el dashboard oficial | Demo e históricos preservados; dashboard usa 5-C3 | RBAC heredado + tenant | deprecado como oficial |
| Métricas Fase 3 | API GRC phase3 | tablas `grc_metric_*` | Registro/threshold operacional | Confusión de nombre | Mantener como fuente/registro operacional; bindings deciden si alimentan oficial | No consumer 5-C3 lee valor directo | RBAC phase3 | mantener |
| Riesgo cuantitativo UI | `riskSimulationUtils` | inputs locales/servicio riesgo | Simulación de escenario | Puede parecer KPI oficial | Mantener preview/escenario no publicado; cualquier cifra oficial se publica vía registry/snapshot | etiqueta preview y test sin escritura oficial | risk capability | mantener |
| Health/ISO legacy | `/health/*`, `IsoHealthPageClient` | health services | Health operacional | Cerrado | Conservado con etiqueta operacional; no se publica como indicador 5-C3 | scan residual y dashboard oficial separado | health roles | mantenido operacional |
| Jobs | `/api/metrics/official/jobs` | `tcdx_async_jobs` | Dispatcher allowlisted 5-C3 | Cerrado | Estado persistido, idempotencia, retry, timeout y correlation ID | PostgreSQL y unitarias | calculate/admin | adaptado |

## Criterio de retiro

Un consumer se considera migrado cuando no calcula valor, estado, threshold, trust, tendencia o cobertura oficial en frontend; recibe un snapshot ID y las mismas propiedades que API/reporting. Un motor legacy puede permanecer solo para datos operacionales o compatibilidad identificada, nunca como selector alternativo de resultado oficial. La prueba residual y `calculation_consumers` bloquean consumers desconocidos.
