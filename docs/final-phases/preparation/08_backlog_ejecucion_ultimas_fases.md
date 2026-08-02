# Backlog de ejecución de las últimas fases

## 1. Propósito y reglas de secuencia

Este backlog transforma el plan rector y la auditoría estática en entregas verificables. La secuencia es bloqueante: Fase 6 no absorbe deuda de Fase 5 y Fase 7 no corrige producto base ni aislamiento tenant.

Reglas comunes:

- cada bloque parte desde `main` actualizado y worktree limpio;
- cada migración es aditiva, idempotente, con ledger, checksum, lock y rollback operativo;
- PostgreSQL y backend son autoridad; frontend no recalcula resultados oficiales;
- toda lectura y escritura se limita por tenant, permiso, capability y límite comercial;
- ninguna vista de negocio expone fórmulas, SQL, tablas o adaptadores como experiencia principal;
- cada endpoint tiene caso de uso, consumidor, prueba positiva, negativa y cross-tenant;
- una capability no se declara operativa por la sola presencia de una tabla, ruta o componente;
- cada bloque termina con CI bloqueante, evidencia versionable y revisión adversarial;
- el merge y deploy quedan fuera de los prompts de implementación hasta aprobación humana.

## 2. Backlog Fase 5

| ID | Bloque | Entrega | Prioridad | Dependencias | Criterio de aceptación |
|---|---|---|---|---|---|
| F5-C1-01 | 5-C1 | Inventario runtime por ruta, rol, capability y tenant | P0 | auditoría estática | evidencia QA sin datos reales y clasificación actualizada |
| F5-C1-02 | 5-C1 | Validación runtime de endpoints y consumidores | P0 | F5-C1-01 | cada endpoint nuevo responde con contrato esperado o queda clasificado |
| F5-C1-03 | 5-C1 | Validación PostgreSQL, jobs, snapshots y artefactos | P0 | F5-C1-01 | persistencia, idempotencia, lineage y checksums comprobados |
| F5-C1-04 | 5-C1 | Línea base de rendimiento y accesibilidad real | P0 | F5-C1-01 | métricas medibles, umbrales y hallazgos reproducibles |
| F5-C1-05 | 5-C1 | Gate de cierre runtime | P0 | F5-C1-02..04 | cero hallazgos críticos sin disposición y ledger completo |
| F5-C2-01 | 5-C2 | Registro versionado de source contracts | P0 | F5-C1-05 | contrato inmutable publicado y tenant scope verificable |
| F5-C2-02 | 5-C2 | Mapeos de campos a observaciones canónicas | P0 | F5-C2-01 | mapeos tipados, versionados y sin SQL configurable |
| F5-C2-03 | 5-C2 | Persistencia de observaciones y relaciones | P0 | F5-C2-02 | PK/FK/checks/índices y aislamiento PostgreSQL probados |
| F5-C2-04 | 5-C2 | Resolución de suficiencia, calidad y freshness | P0 | F5-C2-03 | fuente ausente se informa como no medida, nunca como cero |
| F5-C2-05 | 5-C2 | Lineage fuente a resultado | P0 | F5-C2-03 | trazabilidad completa desde registro fuente a snapshot |
| F5-C2-06 | 5-C2 | Adaptadores legacy controlados | P1 | F5-C2-01..05 | duplicados activos retirados o adaptados con compatibilidad |
| F5-C3-01 | 5-C3 | Catálogo funcional de indicadores | P0 | F5-C2-06 | negocio consume conceptos y anexo técnico queda restringido |
| F5-C3-02 | 5-C3 | Data Trust oficial por dimensión | P0 | F5-C2-04 | componentes reales, cobertura, warnings y explicación |
| F5-C3-03 | 5-C3 | Snapshots y comparaciones inmutables | P0 | F5-C2-05 | mismo resultado reproducible por período y versión |
| F5-C3-04 | 5-C3 | Umbrales, interpretación y recomendación | P0 | F5-C3-01..03 | resultado conduce a causa, impacto y acción autorizada |
| F5-C3-05 | 5-C3 | Consistencia multicanal | P0 | F5-C3-04 | valor, unidad, período, trust y snapshot coinciden en todos los canales |
| F5-C4-01 | 5-C4 | Consolidación Riesgo 360 | P0 | F5-C3-05 | riesgo, controles, evidencias, pérdidas y acciones conectados |
| F5-C4-02 | 5-C4 | Consolidación Control 360 | P0 | F5-C3-05 | diseño, operación, assurance, evidencia y efectividad oficiales |
| F5-C4-03 | 5-C4 | Consolidación Cumplimiento 360 | P0 | F5-C3-05 | requisitos, evaluaciones, cobertura, SoA y planes consistentes |
| F5-C4-04 | 5-C4 | Centro de Datos y Confianza | P0 | F5-C3-02 | drill-down de calidad, cobertura, freshness y lineage |
| F5-C5-01 | 5-C5 | Centro Ejecutivo | P0 | F5-C4-01..04 | priorización, tendencias e impactos sin detalle técnico primario |
| F5-C5-02 | 5-C5 | Centro Operativo | P0 | F5-C4-01..04 | pendientes accionables con owner, vencimiento y estado |
| F5-C5-03 | 5-C5 | Widgets y dashboards versionados | P1 | F5-C5-01..02 | configuración persistente, publicación, snapshot y permisos |
| F5-C5-04 | 5-C5 | Retiro de consumidores paralelos | P0 | F5-C5-01..03 | mismo concepto usa un único output oficial |
| F5-C6-01 | 5-C6 | Grafo de impacto GRC | P0 | F5-C4-01..04 | aristas tipadas, vigentes, tenant-scoped y explicables |
| F5-C6-02 | 5-C6 | Propagación controlada de impacto | P0 | F5-C6-01 | no hay inferencias irreversibles ni causalidad no probada |
| F5-C6-03 | 5-C6 | Vista de causa e impacto | P1 | F5-C6-02 | drill-down muestra evidencia, nivel de confianza y limitaciones |
| F5-C7-01 | 5-C7 | Motor de prioridad | P0 | F5-C6-02 | score versionado con factores visibles y sin constantes ocultas |
| F5-C7-02 | 5-C7 | Recomendaciones y acciones | P0 | F5-C7-01 | propuesta requiere aprobación y genera trazabilidad |
| F5-C7-03 | 5-C7 | Seguimiento de decisiones | P0 | F5-C7-02 | actor, fundamento, fecha, resultado y reversión auditados |
| F5-C8-01 | 5-C8 | Encuestas y campañas operacionales | P1 | F5-C3-05 | scoring, cobertura, consistencia y aprobación E2E |
| F5-C8-02 | 5-C8 | Assurance y muestreo operacional | P0 | F5-C3-05 | muestra, evidencia, resultado, excepción y re-test E2E |
| F5-C8-03 | 5-C8 | Pérdidas y análisis cuantitativo | P0 | F5-C3-05 | moneda aislada, recuperación, percentiles y supuestos explícitos |
| F5-C8-04 | 5-C8 | Report Studio y artefactos | P0 | F5-C5-03 | PDF/DOCX/XLSX reales, checksum y consistencia multicanal |
| F5-C8-05 | 5-C8 | Programación, aprobación y descarga | P1 | F5-C8-04 | job idempotente, autorización, retención y auditoría |
| F5-C9-01 | 5-C9 | Cierre RBAC y capabilities | P0 | F5-C1-05 | matriz ejecutable con positivos, negativos y cross-tenant |
| F5-C9-02 | 5-C9 | Entitlements y límites atómicos | P0 | F5-C9-01 | límite aplicado concurrentemente sin excedente ni bypass |
| F5-C9-03 | 5-C9 | Sanitización, archivos y auditoría | P0 | F5-C9-01 | sin secreto, PII o detalle interno en respuesta y logs |
| F5-C10-01 | 5-C10 | Jerarquía premium y lenguaje funcional | P0 | F5-C5-01..02 | no hay fórmulas o códigos técnicos en flujo de negocio |
| F5-C10-02 | 5-C10 | Responsive y accesibilidad WCAG AA | P0 | F5-C10-01 | navegación, foco, contraste y viewports medidos |
| F5-C10-03 | 5-C10 | Estados operacionales completos | P1 | F5-C10-01 | loading, empty, error, success, parcial y no medido |
| F5-C11-01 | 5-C11 | Suite integral PostgreSQL y API | P0 | F5-C8, F5-C9, F5-C10 | migraciones, contratos, tenant, jobs y rollback pasan |
| F5-C11-02 | 5-C11 | E2E navegador y artefactos | P0 | F5-C11-01 | flujos críticos, A/B y artefactos reales sin reintentos ocultos |
| F5-C11-03 | 5-C11 | Validación runtime QA y observabilidad | P0 | F5-C11-02 | SHA desplegado, salud, métricas, alertas y cleanup verificados |
| F5-C11-04 | 5-C11 | Cierre documental y aceptación | P0 | F5-C11-03 | matriz completa, cero deuda crítica/alta y aprobación humana |

## 3. Backlog Fase 6: Integration Hub

| ID | Bloque | Entrega | Prioridad | Dependencias | Criterio de aceptación |
|---|---|---|---|---|---|
| F6-1-01 | 6.1 | Catálogo, instancias, credenciales cifradas y ownership | P0 | F5-C11-04 | separación tenant, permisos, rotación y auditoría |
| F6-1-02 | 6.1 | Runtime común de sync, retry y dead letter | P0 | F6-1-01 | idempotencia, cursor, rate limit y errores sanitizados |
| F6-1-03 | 6.1 | Mapping visual a contratos semánticos | P0 | F6-1-01, F5-C2 | preview, validación y publicación versionada |
| F6-2-01 | 6.2 | Jira Cloud adapter | P1 | F6-1 | OAuth, proyectos, issues, incremental sync y revocación |
| F6-2-02 | 6.2 | Confluence Cloud adapter | P1 | F6-1 | espacios, páginas, permisos, incremental sync y revocación |
| F6-2-03 | 6.2 | Mapeos Jira/Confluence a GRC | P1 | F6-2-01..02 | datos externos no crean acciones irreversibles sin aprobación |
| F6-3-01 | 6.3 | GitHub adapter productivo | P1 | F6-1 | app/OAuth, repos, findings, retries y least privilege |
| F6-3-02 | 6.3 | GitLab y pipelines | P1 | F6-1 | proyectos, pipelines, hallazgos y tenant isolation |
| F6-3-03 | 6.3 | Azure DevOps y Jenkins | P2 | F6-1 | contratos, credenciales, paginación y health |
| F6-4-01 | 6.4 | Microsoft Graph productivo | P1 | F6-1 | consentimiento, delta sync, revocación y límites |
| F6-4-02 | 6.4 | Google Workspace productivo | P1 | F6-1 | scopes mínimos, incremental sync, revocación y límites |
| F6-4-03 | 6.4 | Identidad externa | P1 | F6-1 | usuarios/grupos mapeados sin elevar privilegios locales |
| F6-5-01 | 6.5 | AWS adapter | P1 | F6-1 | cuentas, recursos, findings y aislamiento |
| F6-5-02 | 6.5 | Azure adapter | P1 | F6-1 | subscriptions, recursos, findings y aislamiento |
| F6-5-03 | 6.5 | GCP adapter | P1 | F6-1 | projects, recursos, findings y aislamiento |
| F6-6-01 | 6.6 | Marketplace y planes | P1 | F6-2..5 | instalación, entitlement, límites y baja coherentes |
| F6-6-02 | 6.6 | Catálogo de mappings | P1 | F6-2..5 | versiones aprobadas y compatibilidad declarada |
| F6-6-03 | 6.6 | UX de Integration Hub | P1 | F6-6-01..02 | configuración, health, runs, errores y acciones accesibles |
| F6-7-01 | 6.7 | QA de conectores y aislamiento | P0 | F6-6 | contract tests, sandbox/provider, tenant A/B y revocación |
| F6-7-02 | 6.7 | Operación, observabilidad y runbook | P0 | F6-7-01 | SLO, alertas, replay, incidentes y cleanup |
| F6-7-03 | 6.7 | Cierre Integration Hub | P0 | F6-7-01..02 | conectores clasificados por nivel real de validación |

## 4. Backlog Fase 7: ecosistema MSP

| ID | Bloque | Entrega | Prioridad | Dependencias | Criterio de aceptación |
|---|---|---|---|---|---|
| F7-1-01 | 7.1 | Modelo partner, clientes y memberships | P0 | F5-C11, F6-7 | aislamiento partner/tenant con auditoría |
| F7-1-02 | 7.1 | RBAC y acceso delegado con caducidad | P0 | F7-1-01 | aprobación, justificación, scope y revocación |
| F7-1-03 | 7.1 | Consola MSP mínima | P0 | F7-1-01..02 | cartera visible sin fuga de detalle no autorizado |
| F7-2-01 | 7.2 | Pipeline comercial partner | P1 | F7-1 | lead, oportunidad, oferta y conversión auditada |
| F7-2-02 | 7.2 | Implementación por plantillas | P1 | F7-1 | onboarding idempotente, checklist y evidencia |
| F7-2-03 | 7.2 | Capacidad y límites comerciales MSP | P1 | F7-1 | cuotas, planes y consumo concurrente coherentes |
| F7-3-01 | 7.3 | Casos de soporte tenant-scoped | P0 | F7-1 | SLA, prioridad, evidencia y comunicación auditada |
| F7-3-02 | 7.3 | Acceso break-glass | P0 | F7-1-02 | doble aprobación, caducidad, alerta y revisión posterior |
| F7-3-03 | 7.3 | Portal de cliente y consentimiento | P1 | F7-3-01 | cliente controla acceso y ve actividad delegada |
| F7-4-01 | 7.4 | Catálogo de servicios gestionados | P1 | F7-1, F6-7 | entitlement, owner y SLA por servicio |
| F7-4-02 | 7.4 | Operación de integraciones por MSP | P1 | F7-4-01 | acciones delegadas limitadas y auditadas |
| F7-4-03 | 7.4 | Reportes multiempresa agregados | P1 | F7-4-01 | solo agregados autorizados, sin exposición individual |
| F7-5-01 | 7.5 | Gobierno, contratos y retención | P0 | F7-1..4 | políticas versionadas y aplicadas por jurisdicción |
| F7-5-02 | 7.5 | Offboarding y portabilidad | P0 | F7-5-01 | revocación, exportación, retención y borrado verificables |
| F7-5-03 | 7.5 | QA partner/tenant y cierre | P0 | F7-5-01..02 | aislamiento, accesos, soporte, billing y offboarding E2E |

## 5. Gates de transición

| Transición | Gate bloqueante |
|---|---|
| 5-C1 a 5-C2 | inventario runtime, baseline y hallazgos críticos resueltos |
| 5-C2 a 5-C3 | modelo semántico persistido, tenant isolation y lineage verificados |
| 5-C3 a 5-C4 | indicadores, trust y snapshots consistentes en API |
| 5-C5 a 5-C6 | vistas 360 y dashboards consumen únicamente outputs oficiales |
| 5-C8 a 5-C9 | flujos funcionales y artefactos reales pasan E2E |
| 5-C10 a 5-C11 | UX, permisos y estados completos en todos los viewports |
| Fase 5 a Fase 6 | F5-C11 cerrado; sin deuda funcional del producto base |
| Fase 6 a Fase 7 | Integration Hub cerrado; conectores y revocación operables |
| Fase 7 a producción MSP | aislamiento partner/tenant, break-glass y offboarding verificados |

## 6. Ruta crítica y Definition of Done

Ruta crítica: `C1 → C2 → C3 → C4/C5 → C6/C7 → C8 → C9/C10 → C11 → 6.1 → 6.7 → 7.1 → 7.5`.

Cada ítem se considera terminado únicamente con código integrado en su rama, migración probada cuando aplique, pruebas unitarias y PostgreSQL, E2E relevante, documentación, evidencia sin secretos, CI verde y revisión adversarial sin hallazgos altos o críticos. Un bloqueo externo se documenta como `NO_VERIFICADO_RUNTIME`; no se transforma en aceptación.

## 7. Trazabilidad con prompts

Los archivos `docs/final-phases/prompts/01_...` a `20_...` ejecutan estos bloques en el mismo orden. Cada prompt exige base `main` actual, worktree limpio, rama propia, PR sin merge y sin deploy.
