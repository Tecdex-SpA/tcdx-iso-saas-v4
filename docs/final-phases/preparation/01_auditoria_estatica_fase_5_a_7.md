# Auditoría estática de Fase 5 a Fase 7

Fecha de corte: 2026-08-02
Rama: `docs/final-phases-audit-and-execution-design`
SHA base: `d08997d4be9ea994812441ba2aba488220c5c703`
Alcance: repositorio local; no se consultó producción ni bases remotas.

## Criterio de clasificación

`OPERATIVO` exige implementación, consumidor y prueba funcional local identificable. No equivale a validación productiva. `PARCIAL` identifica una cadena incompleta o evidencia insuficiente. `NO_VERIFICADO_RUNTIME` se usa cuando el estado depende de VMs, secretos, datos o servicios externos. La sola presencia de una tabla, endpoint o componente no se considera operatividad.

## Baseline verificable

| Activo | Conteo | Evidencia |
|---|---:|---|
| Migraciones SQL | 42 | `database/migrations/*.sql` |
| Tablas declaradas únicas | 293 | `CREATE TABLE` en migraciones |
| Vistas declaradas únicas | 23 | `CREATE VIEW` en migraciones |
| Archivos de rutas backend | 77 | `backend/src/routes/*.js` |
| Handlers HTTP declarados | 710 | llamadas `router.get/post/put/patch/delete` |
| Páginas Next.js | 96 | `frontend/src/app/**/page.tsx` |
| Componentes frontend | 134 | `frontend/src/components/**/*.{ts,tsx}` |
| Servicios backend | 160 | `backend/src/services/**/*.js` |
| Archivos de prueba y E2E | 452 | backend, frontend, tests y scripts |
| Workflows GitHub Actions | 2 | `.github/workflows` |
| Capabilities inventariadas | 40 | `config/capabilities/catalog.json` |
| Entradas de autorización inventariadas | 548 | `config/security/authorization-matrix.json` |

La matriz de autorización fue generada el 2026-07-22 y no contiene las rutas agregadas en `phase2.routes.js`, `phase5.routes.js` o `grc.routes.js`. El middleware `rbac.middleware.js` sí contiene reglas runtime para esas familias; se requiere regenerar la matriz y vincular pruebas positivas, negativas y cross-tenant.

## Resultado agregado

| Estado | Capacidades |
|---|---:|
| OPERATIVO | 10 |
| PARCIAL | 40 |
| DUPLICADO | 1 |
| SIN_UI | 1 |
| SIN_PRUEBAS | 4 |
| NO_IMPLEMENTADO | 20 |
| NO_VERIFICADO_RUNTIME | 4 |
| Total | 80 |

## Matriz de capacidades

| ID | Dominio | Capacidad | Estado | Evidencia | Riesgo e impacto | Solución / bloque | Prioridad | Dependencia | Criterio de aceptación |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Plataforma | Login y contexto tenant | OPERATIVO | `auth.routes.js`, `effectiveTenant.js`, E2E Fase 5.5 escenario 1 | Falta validación productiva actual | 5-C1/C11 | P0 | Datos QA | Login, selección y rechazo cross-tenant en runtime |
| 2 | GRC | Workflows y aprobaciones | PARCIAL | `grc.routes.js`, tablas `grc_workflow_*` | Flujo amplio sin evidencia runtime actual | 5-C1/C7/C11 | P0 | RBAC y datos | Crear, transicionar, aprobar, auditar y reabrir E2E |
| 3 | Evidencias | Solicitudes, versiones y revisión | PARCIAL | `grc_evidence_*`, `/api/grc/evidence/*` | Evidencia puede no cerrar la cadena de cálculo | 5-C4/C7 | P0 | Lineage | Solicitud a aprobación vinculada a control y cálculo |
| 4 | Auditoría | Workspace y workpapers | PARCIAL | rutas `/api/grc/audits/*`, `grc_audit_*` | No existe UAT productiva vigente | 5-C4/C8/C11 | P1 | Evidencia | Plan, muestra, papel, revisión, hallazgo y cierre E2E |
| 5 | Privacidad | Actividades, DPIA y solicitudes | PARCIAL | `phase2.routes.js`, tablas `privacy_*`, rutas frontend | Runtime y consistencia 360 no verificadas | 5-C1/C4 | P1 | Impact graph | Flujo completo con relaciones, permisos y tenant |
| 6 | Incidentes | Registro, comando y cierre | PARCIAL | `grc_incidents*`, `/api/grc/phase2/incidents/*` | Cierre y efecto GRC no verificados en runtime | 5-C4/C7 | P0 | Acciones | Estado, causa, impacto, evidencia y efectividad E2E |
| 7 | TPRM | Proveedores y evaluaciones | PARCIAL | `grc_suppliers*`, páginas `/proveedores` | Health y efecto transversal incompletos | 5-C4/C8 | P0 | Encuestas | Proveedor 360 con evaluación, riesgo, acción y evidencia |
| 8 | TPRM | Portal de proveedor | PARCIAL | `supplier-portal.routes.js`, sesiones e invitaciones | Acceso externo y expiración requieren runtime | 5-C9/C11 | P0 | Seguridad | Invitación, respuesta, expiración y aislamiento E2E |
| 9 | Datos | Catálogo y gobierno de datos | PARCIAL | `data_domains`, `data_elements`, páginas `/datos/*` | Modelo no unifica aún contratos canónicos | 5-C2 | P0 | Migración aditiva | Owner, definición, fuente, calidad y lineage completos |
| 10 | Datos | Contratos de fuente versionados | PARCIAL | `official_formula_source_contracts`, `sourceContracts.service.js` | Contrato está acoplado a fórmulas y no cubre toda fuente | 5-C2 | P0 | Modelo semántico | Contrato independiente, versionado, probado y sin SQL libre |
| 11 | Datos | Observaciones canónicas | NO_IMPLEMENTADO | No existen `grc_observations` ni relaciones equivalentes completas | Cada dominio conserva formas incompatibles | 5-C2 | P0 | Contratos | Ingesta tenant-scoped con snapshot, calidad y lineage |
| 12 | Datos | Perfilado y calidad | PARCIAL | `data_quality_*`, `datasetValidation.service.js` | No hay perfilado transversal por contrato | 5-C2/C3 | P0 | Observaciones | Nulos, duplicados, rango, freshness y suficiencia persistidos |
| 13 | Métricas | Catálogo y builder | OPERATIVO | `/api/metrics`, `MetricBuilder`, E2E Fase 5.5 escenario 2 | UX expone detalles técnicos | 5-C3/C10 | P0 | Catálogo funcional | Crear, revisar, publicar y calcular sin fórmulas visibles |
| 14 | Métricas | Mediciones y snapshots | OPERATIVO | `metric_measurements`, `calculation_snapshots`, E2E local | Falta aceptación con datos representativos | 5-C3/C11 | P0 | Fuentes | Resultado reproducible por período y checksum |
| 15 | Métricas | Data Trust | PARCIAL | `dataTrustScore.js`, `officialCalculation.service.js` | Existen componentes con valores por defecto heurísticos | 5-C3 | P0 | Perfilado | Cada componente derivado de evidencia y ausencia como unknown |
| 16 | Métricas | Tendencias y comparaciones | PARCIAL | tablas de comparaciones y endpoints de tendencias | No se probó consistencia 6/12/24 períodos | 5-C3/C5 | P1 | Snapshots | Comparación reproducible entre snapshots inmutables |
| 17 | Decisiones | Centro de decisiones | PARCIAL | `GrcDecisionCenter.tsx`, `decisionInterpretation.service.js` | Interpretación inicial sin gobierno completo de decisiones | 5-C6/C7 | P0 | Impact graph | Causa, impacto, prioridad, owner, fecha y acción persistida |
| 18 | Causalidad | Impact Graph | PARCIAL | `data_lineage_edges`, `grc_analytical_impact_*`, endpoints graph | Relaciones dispersas y sin propagación gobernada completa | 5-C6 | P0 | Observaciones | Grafo acotado, explicable, versionado y tenant-scoped |
| 19 | Remediación | Acción desde indicador | PARCIAL | links a `/planes-accion` con run/formula | Link no demuestra decisión y verificación completa | 5-C7 | P0 | Planes | Crear plan, ejecutar, evidenciar, re-test y comparar |
| 20 | UX GRC | Centro Ejecutivo | PARCIAL | `/grc`, `/grc-global`, dashboard y health | Conceptos y definiciones no están consolidados | 5-C4/C5 | P0 | Catálogo funcional | Una definición por concepto, tendencia y acción |
| 21 | UX GRC | Centro Operativo | PARCIAL | decisiones y superficies operacionales actuales | No existe cola unificada de asuntos GRC | 5-C4 | P0 | Impact graph | Pendientes priorizados con owner, fecha y drill-down |
| 22 | UX GRC | Riesgo 360 | PARCIAL | rutas de riesgos, activos, controles y Monte Carlo | Relaciones no convergen en una vista contractual | 5-C4 | P1 | Observaciones | Inherente, residual, controles, pérdidas y acciones coherentes |
| 23 | UX GRC | Control 360 | PARCIAL | `/controles`, control assurance y efectividad oficial | Evidencia/frecuencia/assurance no consolidados visualmente | 5-C4 | P1 | Cálculo oficial | Componentes, riesgos, requisitos, pruebas y acciones |
| 24 | UX GRC | Cumplimiento 360 | PARCIAL | diagnóstico, SoA, evaluaciones y cálculo oficial | Varias superficies pueden divergir | 5-C4 | P0 | Catálogo funcional | Aplicabilidad, cobertura, confianza, evidencia y readiness únicos |
| 25 | UX GRC | Centro de Datos y Confianza | PARCIAL | `/datos/*`, FormulaCatalog y lineage | Presenta códigos y fuentes físicas a perfiles de negocio | 5-C3/C10 | P0 | RBAC técnico | Vista funcional por defecto y detalle técnico autorizado |
| 26 | BI | Dashboard Builder | OPERATIVO | `/api/dashboards`, `DashboardBuilder`, E2E escenario 6 | Falta UAT y rendimiento a volumen | 5-C5/C11 | P1 | Métricas | Crear, mover, publicar y snapshot con datos oficiales |
| 27 | Reporting | Report Studio | OPERATIVO | `/api/reports`, `ReportStudioWorkspace`, E2E escenario 7 | Falta validación de programación runtime | 5-C8/C11 | P1 | Snapshots | Definir, generar, aprobar, versionar y descargar |
| 28 | Reporting | PDF, DOCX y XLSX | OPERATIVO | `phase5ArtifactValidation.test.js`, E2E descargas | Evidencia local, no productiva | 5-C8/C11 | P0 | Storage | Artefactos válidos, checksum, tenant y fórmula interna |
| 29 | Reporting | Programación de reportes | SIN_UI | endpoints `/api/report-schedules` y tabla `report_schedules` | Operación requiere API/manual; no experiencia completa | 5-C8 | P1 | Jobs | Crear, pausar, reanudar, ejecutar y auditar desde UI |
| 30 | Encuestas | Builder, campaña y scoring | OPERATIVO | tablas survey, `SurveyScoringBuilder`, E2E escenario 3 | Branching avanzado y UAT no verificados | 5-C8/C11 | P1 | Catálogo funcional | Flujo completo con cobertura, aprobación y consecuencias |
| 31 | Assurance | Definición, muestra y resultado | OPERATIVO | tablas assurance, builder, E2E escenario 4 | Flujo de re-test y evidencia requiere UAT | 5-C8/C11 | P1 | Evidencias | Muestra, ejecución, excepción, acción, revisión y re-test |
| 32 | Pérdidas | Eventos y análisis | OPERATIVO | `loss_events`, builder, E2E escenario 5 | Moneda y distribución necesitan datos representativos | 5-C8/C11 | P1 | Riesgo | Evento, recuperación, net loss, KRI y vínculo causal |
| 33 | Cálculo | Riesgo, control y cumplimiento oficiales | PARCIAL | servicios `math-governance/*Calculation` | Fuentes y consumidores legacy aún requieren consolidación | 5-C2/C3 | P0 | Contratos | Mismo concepto produce mismo resultado en todos los canales |
| 34 | Cálculo | KPI/formula engines paralelos | DUPLICADO | `kpi.routes.js`, `formulaEngine.js`, math-governance y dashboards legacy | Divergencia de valores y mantenimiento duplicado | 5-C3 | P0 | Migración de consumidores | Adaptadores únicos y deprecación comprobada del cálculo paralelo |
| 35 | UX | Catálogo funcional vs técnico | PARCIAL | UI muestra `formula_code`, contratos y fuentes físicas | Usuario de negocio recibe detalle interno | 5-C3/C10 | P0 | Roles técnicos | Negocio ve concepto; técnico autorizado expande metodología |
| 36 | Arquitectura | Endpoints con consumidor | PARCIAL | matriz Fase 5.5 cubre endpoints principales, no 710 handlers | Rutas huérfanas o duplicadas no descartadas | 5-C1 | P0 | Inventario | 100% endpoints con caso, consumidor o justificación técnica |
| 37 | Seguridad | RBAC, capabilities y límites Fase 5 | PARCIAL | `rbac.middleware.js`, entitlement middleware; inventarios desactualizados | Trazabilidad y pruebas negativas incompletas | 5-C9 | P0 | Catálogo regenerado | Permiso+capability+entitlement+limit+tenant probados |
| 38 | Seguridad | Tenant isolation Fase 5 | OPERATIVO | E2E Fase 5.5 escenario 9 y `effectiveTenant.js` | Solo fixture local | 5-C11 | P0 | QA runtime | Tenant A/B sobre cada mutación y archivo |
| 39 | CI | Regresión integral Fase 5 | SIN_PRUEBAS | CI no ejecuta browser E2E ni `phase5-5:final-check` completo | Merge puede omitir flujos críticos | 5-C11 | P0 | Runner estable | CI bloqueante ejecuta contratos, PostgreSQL, E2E y artefactos |
| 40 | Calidad | Accesibilidad | SIN_PRUEBAS | script actual reutiliza check estructural | No demuestra WCAG ni teclado | 5-C10/C11 | P1 | Browser QA | Axe/teclado/foco/contraste en rutas críticas |
| 41 | Calidad | Rendimiento | SIN_PRUEBAS | script actual reutiliza check final | No hay presupuesto ni carga representativa | 5-C11 | P1 | Dataset sintético | SLO y pruebas 100k mediciones/1M observaciones |
| 42 | QA | UAT Credex, Tecdex y Demo | NO_VERIFICADO_RUNTIME | no se consultó producción por restricción | Estado comercial real desconocido | 5-C1/C11 | P0 | Accesos QA | Matriz UAT firmada por tenant y rol |
| 43 | DevOps | Migraciones y deploy unificado | NO_VERIFICADO_RUNTIME | runners Fase 3-5 y `deploy-vms.sh` | No se ejecutó ni verificó runtime en esta auditoría | 5-C11 | P0 | MIGRATION_DATABASE_URL | Apply idempotente, health y rollback documentados |
| 44 | Operación | Backup, restore, RPO y RTO | NO_VERIFICADO_RUNTIME | scripts de backup/restore existen | Recuperabilidad actual no demostrada | 5-C11 | P0 | QA aislada | Restore exitoso con RPO/RTO medidos |
| 45 | Operación | Observabilidad | PARCIAL | request_id, logs y health distribuidos | Métricas/alertas/DLQ no están unificadas | 5-C11/6.1 | P1 | Telemetría | SLO, alertas y correlación de extremo a extremo |
| 46 | Integraciones | Catálogo de conectores | PARCIAL | `grc_connector_definitions`, UI `/conectores` | Catálogo limitado y sin marketplace | 6.1/6.6 | P0 | Entitlements | Versiones, scopes, documentación y disponibilidad por tenant |
| 47 | Integraciones | OAuth y credenciales | PARCIAL | envelope cifrado, state hash y refresh en Phase 2 | Secret store externo y rotación no verificados | 6.1 | P0 | Vault/referencias | Secretos fuera de BD, rotación, revoke y auditoría |
| 48 | Integraciones | Sync, runs y checkpoints | PARCIAL | connector runs, cursor e idempotency | Scheduler/retry productivo no verificado | 6.1 | P0 | Jobs | Full/incremental, backoff, checkpoint y reanudación |
| 49 | Integraciones | Raw/external records | PARCIAL | `grc_external_records` y normalización | Falta modelo canónico transversal | 6.1 | P0 | 5-C2 | Raw inmutable a observación externa trazable |
| 50 | Integraciones | Mapping | PARCIAL | `grc_connector_mappings` y default mappings | No existe Mapping Studio completo | 6.1/6.6 | P0 | Modelo semántico | Preview, versión, aprobación y rollback de mapping |
| 51 | Integraciones | Health | PARCIAL | `/connectors/health` y página de salud | No cubre scopes, freshness ni deuda de DLQ completa | 6.1 | P1 | Observabilidad | Estado funcional, causa, acción y SLO |
| 52 | Integraciones | Dead-letter | PARCIAL | `grc_connector_dead_letters` | Replay, retención y UI no demostrados | 6.1 | P0 | Jobs | Clasificar, reintentar, resolver y auditar sin pérdida |
| 53 | Integraciones | Webhooks | PARCIAL | validación de secret y registro Phase 2 | Cobertura de proveedores e idempotencia runtime desconocida | 6.1 | P0 | Seguridad | Firma, replay protection, DLQ y tenant isolation |
| 54 | Integraciones | Jira/Confluence | PARCIAL | adapter live/sandbox y docs | Conexión real depende de credenciales tenant | 6.2 | P0 | Fundación | Dato externo a indicador, impacto y acción E2E |
| 55 | Integraciones | GitHub | PARCIAL | adapter live/sandbox y pruebas controladas | Solo parte de DevSecOps objetivo | 6.3 | P0 | Fundación | Repos, protection, alerts y workflows con impacto GRC |
| 56 | Integraciones | GitLab | NO_IMPLEMENTADO | sin adapter ni definición | Cobertura DevSecOps incompleta | 6.3 | P1 | Fundación | Adapter, OAuth/token, mapping y E2E controlado |
| 57 | Integraciones | Jenkins | NO_IMPLEMENTADO | sin adapter ni definición | Pipelines externos no cubiertos | 6.3 | P1 | Fundación | Jobs/builds/fallos a observación e impacto |
| 58 | Integraciones | Microsoft 365/Entra | PARCIAL | adapter Graph y OAuth | Live no verificado; scopes por módulo incompletos | 6.4 | P0 | Fundación | Identidad, MFA, sharing y evidencia con mínimos scopes |
| 59 | Integraciones | Google Workspace | PARCIAL | adapter Directory/Drive y OAuth | Live no verificado | 6.4 | P0 | Fundación | Usuarios, grupos, sharing y evidencia E2E |
| 60 | Integraciones | AWS | NO_IMPLEMENTADO | no hay adapter Integration Hub | Exposición cloud no cubierta | 6.5 | P1 | Fundación | IAM, logging, backup y exposición normalizados |
| 61 | Integraciones | Azure | NO_IMPLEMENTADO | no hay adapter cloud | Exposición cloud no cubierta | 6.5 | P1 | Fundación | IAM, logging, backup y exposición normalizados |
| 62 | Integraciones | Google Cloud | NO_IMPLEMENTADO | no hay adapter cloud | Exposición cloud no cubierta | 6.5 | P1 | Fundación | IAM, logging, backup y exposición normalizados |
| 63 | Integraciones | Marketplace y Mapping Studio | NO_IMPLEMENTADO | no existen rutas/componentes dedicados | Configuración depende de superficies genéricas | 6.6 | P0 | Catálogo | Instalar, configurar, mapear, probar, versionar y retirar |
| 64 | Integraciones | Observación a acción GRC | PARCIAL | alertas y domain events Phase 2 | Cadena completa no está probada por conector | 6.7 | P0 | Impact graph | Cada conector demuestra indicador, impacto, acción y reporte |
| 65 | Integraciones | Entitlements, límites y usage | PARCIAL | modelo comercial Fase 4 | No hay medición completa por connector/run/record | 6.1/6.7 | P0 | Comercial | Límite backend, contador idempotente y downgrade seguro |
| 66 | Integraciones | E2E live por proveedor | NO_VERIFICADO_RUNTIME | no se usaron credenciales externas | No puede afirmarse operación live | 6.2-6.7 | P0 | Cuentas sandbox proveedor | Evidencia por provider sin secretos ni datos reales |
| 67 | MSP | Partner foundation | NO_IMPLEMENTADO | no hay tablas/rutas/componentes partner | Fase 7 no puede iniciar operación | 7.1 | P0 | Modelo y migración | Alta, estado, perfil, auditoría y portal |
| 68 | MSP | Usuarios, equipos, RBAC | NO_IMPLEMENTADO | sin modelo partner | Riesgo de acceso excesivo si se improvisa | 7.1 | P0 | Partner foundation | Roles, permisos, MFA y separación por partner |
| 69 | MSP | Engagements y assignments | NO_IMPLEMENTADO | sin tablas equivalentes | Partner no puede asociarse de forma gobernada a tenant | 7.1 | P0 | RBAC | Engagement, servicio, vigencia, propósito y aprobación |
| 70 | MSP | Oportunidades y provisioning | NO_IMPLEMENTADO | sin backend/UI | Flujo comercial no integrado | 7.2 | P1 | Engagement | Oportunidad a tenant provisionado con aprobación |
| 71 | MSP | Proyectos de implementación | NO_IMPLEMENTADO | sin modelo | Onboarding de cliente no trazable | 7.2 | P1 | Provisioning | Proyecto, tareas, hitos, aceptación y go-live |
| 72 | MSP | Soporte y SLA | NO_IMPLEMENTADO | sin tickets/SLA partner | Servicio recurrente no medible | 7.3 | P0 | Engagement | Ticket L1-L3, SLA, escalamiento y satisfacción |
| 73 | MSP | Acceso temporal | NO_IMPLEMENTADO | sin requests/sessions partner | Riesgo crítico de soporte sin control | 7.3 | P0 | Seguridad | Solicitud, aprobación, propósito, expiración y auditoría |
| 74 | MSP | Servicios gestionados | NO_IMPLEMENTADO | sin planes/tareas MSP | Operación recurrente no soportada | 7.4 | P1 | Engagement | Calendario, tarea, evidencia, aprobación y reporte |
| 75 | MSP | Asignación de integraciones | NO_IMPLEMENTADO | sin partner integration assignment | Secretos y ownership sin modelo | 7.4 | P0 | Fase 6 | Partner configura sin leer secretos; cliente aprueba |
| 76 | MSP | Plantillas y knowledge base | NO_IMPLEMENTADO | sin catálogos partner | Implementaciones no reutilizables de forma gobernada | 7.4 | P2 | Partner foundation | Versionado, aprobación, visibilidad y uso auditado |
| 77 | MSP | Scorecards y mejora | NO_IMPLEMENTADO | sin métricas partner | No hay gobierno de calidad del canal | 7.5 | P1 | Datos MSP | SLA, calidad, satisfacción, seguridad y plan de mejora |
| 78 | MSP | Co-branding y comunicaciones | NO_IMPLEMENTADO | sin configuración partner | Riesgo de marca y comunicaciones no autorizadas | 7.5 | P2 | Entitlements | Plantillas aprobadas, alcance y auditoría |
| 79 | MSP | Offboarding y transferencia | NO_IMPLEMENTADO | sin modelo | Accesos y responsabilidades pueden quedar vigentes | 7.5 | P0 | Engagement | Revocar, transferir, exportar evidencia y certificar cierre |
| 80 | MSP | Partner isolation | SIN_PRUEBAS | no existe dominio implementado | Riesgo crítico futuro de fuga multi-tenant | 7.1/7.5 | P0 | Modelo MSP | Partner A/B, tenant A/B, IDOR, archivos y expiración E2E |

## Hallazgos transversales prioritarios

1. El catálogo de capacidades y la matriz de autorización son artefactos generados anteriores a rutas críticas actuales; deben regenerarse desde el árbol real y vincular pruebas.
2. La experiencia de métricas muestra códigos de fórmula, contratos y fuentes físicas en componentes de negocio; contradice el principio rector.
3. Coexisten motores y superficies legacy de KPI/reporting con la capa oficial; la migración de consumidores debe ser explícita y medible.
4. CI valida partes de Fase 5.5, pero no ejecuta su browser E2E, accesibilidad real, rendimiento ni UAT productiva.
5. La fundación de conectores existe, pero no equivale a Fase 6: faltan secret references externas, marketplace, cloud, GitLab/Jenkins y evidencia live.
6. No se encontró implementación MSP. Fase 7 debe comenzar con aislamiento y acceso temporal, no con UI comercial.

## Línea base técnica ejecutada

Fecha: 2026-08-02. SHA base: `d08997d4be9ea994812441ba2aba488220c5c703`.

| Comando | Resultado | Evidencia |
|---|---|---|
| `npm --prefix backend test` | PASS | check sintáctico y suite completa; 50 fórmulas oficiales y 848 aserciones reportadas |
| `npm --prefix frontend run lint` | PASS con advertencia | cero errores; advertencia preexistente por `latestSnapshot` no usado en `GrcDecisionCenter.tsx` |
| `npm --prefix frontend run typecheck` | PASS | TypeScript sin errores |
| `npm --prefix frontend run build` | PASS | Next.js compiló y generó 83 rutas |
| `git diff --check` | PASS | sin errores de whitespace |

La advertencia de lint se registra como brecha de higiene de línea base y no se corrige en esta rama documental. Estas validaciones no sustituyen runtime QA, bases remotas, UAT ni validación productiva.

## Reconciliación runtime 5-C1

La baseline local 5-C1 cerró la advertencia `latestSnapshot`, verificó PostgreSQL descartable, artefactos, RBAC/tenant A-B y browser E2E real. El resultado actualizado está en `docs/final-phases/runtime/`; los hallazgos de contraste y foco de teclado se corrigieron con prueba Axe WCAG 2 A/AA. Las limitaciones de producción, VM, backup/restore, conectores live y MSP permanecen `NO_VERIFICADO_RUNTIME`; no se reclasifican como operativas.

## Límites de esta auditoría

- Producción, VMs, secretos, jobs activos, datos, `schema_migrations`, systemd, alertas, backups y restore: `NO_VERIFICADO_RUNTIME`.
- Los resultados E2E Fase 5.5 son evidencia local sintética versionada; no se reinterpretan como evidencia productiva.
- No se corrigió ninguna brecha funcional en esta rama documental.
