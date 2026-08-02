# PLAN MAESTRO DE ÚLTIMAS FASES — TCDX ISO SAAS V4
## Cierre definitivo de Fase 5, Fase 6 Integration Hub y Fase 7 Ecosistema MSP
### Documento rector para salida comercial premium — Agosto 2026

**Producto:** TCDX ISO SaaS
**Empresa:** Tecdex SpA
**Repositorio:** `Tecdex-SpA/tcdx-iso-saas-v4`
**Rama base:** `main`
**Punto de partida técnico:** merge PR #39, commit `d08997d4be9ea994812441ba2aba488220c5c703`
**Estado:** plan maestro de implementación, cierre funcional y aceptación productiva
**Objetivo:** completar desde Fase 5-C1 hasta Fase 7, sin deuda funcional, visual, técnica, de seguridad ni de operación.

---

# 0. PROPÓSITO

Este documento define el trabajo restante para completar TCDX ISO SaaS como plataforma GRC enterprise, lista para comercialización en agosto de 2026.

Cubre:

```text
Fase 5-C1 a Fase 5-C11
→ cierre formal de Fase 5
→ Fase 6 completa
→ Fase 7 completa
→ preparación comercial, operativa y productiva
```

La plataforma debe ser capaz de:

```text
capturar datos reales
→ validarlos
→ normalizarlos
→ medirlos internamente
→ evaluar su calidad
→ generar señales GRC
→ explicar su impacto
→ priorizar decisiones
→ crear acciones
→ verificar efectividad
→ comparar resultados
→ generar dashboards e informes
→ operar integraciones
→ soportar operación MSP
```

No se permite cerrar ninguna fase, bloque o módulo con:

- deuda funcional;
- interfaz parcial;
- flujo incompleto;
- mock productivo;
- cálculo opaco;
- dato inventado;
- endpoint sin UI;
- UI sin backend;
- tabla sin uso;
- ruta sin autorización;
- reporte inválido;
- migración no probada;
- error SQL;
- aislamiento tenant incompleto;
- pendiente intencional;
- marcador explícito de trabajo pendiente;
- marcador explícito de corrección pendiente;
- “coming soon”;
- dato de cliente no trazable;
- acción sin responsable o fecha;
- métrica sin fuente, período, cobertura y confianza.

---

# 1. VISIÓN FINAL DEL PRODUCTO

TCDX ISO SaaS debe operar como un sistema de gestión GRC integral y no como una colección de módulos aislados.

Debe responder:

1. ¿Cuál es el estado real de la organización?
2. ¿Qué cambió?
3. ¿Por qué cambió?
4. ¿Qué riesgo, control, requisito o proceso se afecta?
5. ¿Qué debe hacerse?
6. ¿Quién debe actuar?
7. ¿Cuándo debe hacerlo?
8. ¿Qué evidencia respalda la conclusión?
9. ¿La remediación fue efectiva?
10. ¿La organización mejoró?

La cadena central será:

```text
Operación
→ Dato confiable
→ Observación
→ Indicador
→ Impacto
→ Decisión
→ Acción
→ Verificación
→ Mejora demostrada
```

---

# 2. PRINCIPIO DE EXPERIENCIA: LAS FÓRMULAS SON INTERNAS

Las fórmulas, expresiones matemáticas, variables técnicas, nombres de tablas, columnas, adaptadores SQL, contratos físicos y códigos internos forman parte del motor interno.

No deben ser visibles como contenido principal para usuarios de negocio.

El usuario debe ver:

```text
qué se mide
→ resultado
→ tendencia
→ confianza
→ causa
→ impacto
→ recomendación
→ acción
```

El usuario no debe necesitar comprender:

- códigos de fórmula;
- expresiones matemáticas;
- nombres internos;
- variables;
- SQL;
- adaptadores;
- tablas;
- columnas;
- dependencias internas.

El detalle técnico solo puede estar disponible para:

- administradores técnicos;
- auditores autorizados;
- soporte Tecdex;
- especialistas de datos;
- revisión metodológica.

Incluso para estos perfiles, debe aparecer en una sección secundaria y colapsable.

## 2.1 Contrato visible de un indicador

Cada indicador debe mostrar:

```text
Nombre del concepto
Resultado actual
Estado
Tendencia
Objetivo
Cobertura
Confianza
Interpretación
Causa principal
Impacto GRC
Recomendación
Acción
Fuente resumida
Fecha de actualización
```

Ejemplo correcto:

```text
Efectividad de controles
63%
Estado: requiere atención
Tendencia: -8 puntos
Cobertura: 84%
Confianza: 91%
Interpretación: los controles existen, pero su ejecución y evidencia son insuficientes
Causa principal: 5 controles sin evidencia vigente y 2 pruebas fallidas
Impacto: aumento del riesgo residual y reducción del readiness
Recomendación: priorizar controles críticos con evidencia vencida
Acción: crear plan de fortalecimiento
```

Ejemplo incorrecto:

```text
F5_5_CONTROL_EFFECTIVENESS
(design + implementation + operation + evidence) / 4
```

## 2.2 Catálogo funcional y catálogo técnico

### Catálogo funcional

Visible para usuarios de negocio.

Incluye:

- concepto;
- objetivo;
- unidad;
- owner;
- frecuencia;
- resultado;
- tendencia;
- umbral;
- interpretación;
- recomendación;
- acción.

### Catálogo técnico

Visible solo para roles autorizados.

Incluye:

- código interno;
- versión;
- fórmula;
- variables;
- source contract;
- adapter;
- tablas;
- columnas;
- reglas de suficiencia;
- checksum;
- lineage técnico.

Relación:

```text
Concepto de negocio
→ una o más fórmulas internas
→ una o más fuentes
→ resultado consolidado
```

## 2.3 Reglas UX obligatorias

1. No mostrar códigos de fórmula como título principal.
2. No mostrar expresiones matemáticas en vistas de negocio.
3. No mostrar nombres de tablas o columnas a usuarios finales.
4. No usar el catálogo técnico como vista principal.
5. No exigir selección manual de fórmulas.
6. No permitir editar fórmulas a perfiles de negocio.
7. Mostrar concepto, finalidad e interpretación.
8. Mostrar cobertura y confianza.
9. Mostrar tendencia y comparación.
10. Mostrar acción disponible.
11. Mantener trazabilidad completa internamente.
12. Separar lectura ejecutiva y detalle técnico.

---

# 3. PRINCIPIOS NO NEGOCIABLES

## 3.1 Arquitectura

1. PostgreSQL es la fuente de verdad.
2. El backend es autoritativo.
3. El frontend nunca es el único control de seguridad.
4. Toda entidad operacional es tenant-scoped.
5. Los catálogos globales deben declararse explícitamente.
6. Toda cifra tiene fuente, período, fórmula interna, versión y confianza.
7. Toda acción sensible es auditable.
8. Toda operación repetible es idempotente.
9. No se eliminan históricos por cambio de plan.
10. No se inventan datos para completar dashboards.
11. Los errores técnicos se traducen a estados funcionales.
12. No se usa IA generativa como fuente de verdad.
13. No se permite `eval`.
14. No se permite SQL arbitrario.
15. No se permite acceso cross-tenant.
16. No se cierra una fase con checks fallidos.
17. No se traslada deuda de Fase 5 a Fase 6.
18. No se traslada deuda del producto base a Fase 7.
19. No se crean sistemas paralelos para métricas, reportes, jobs, acciones, evidencias o permisos.
20. El deploy oficial sigue siendo un solo comando: `./scripts/deploy-vms.sh`.

## 3.2 Calidad premium

Todo módulo debe incorporar:

- diseño enterprise;
- navegación clara;
- responsive;
- accesibilidad;
- loading;
- empty;
- error;
- success;
- mensajes comprensibles;
- drill-down;
- permisos;
- auditoría;
- integración GRC;
- documentación;
- unit tests;
- integración PostgreSQL;
- pruebas de seguridad;
- E2E;
- UAT.

## 3.3 Deuda cero

Se considera deuda funcional:

- ruta sin flujo completo;
- API que la UI no usa;
- UI sin backend;
- tabla sin relaciones;
- métrica sin fuente;
- fórmula que convierte ausencia en cero;
- reporte inválido;
- job sin retry;
- dashboard sin acción;
- plan sin verificación;
- integración que solo extrae;
- partner sin engagement;
- endpoint sin aislamiento;
- migración sin checksum;
- pantalla sin estados;
- código con mocks o pendientes.

---

# 4. ESTADO DE PARTIDA

La plataforma ya dispone de:

- dominio GRC;
- cumplimiento;
- riesgos;
- controles;
- SOA;
- evidencias;
- auditorías;
- hallazgos;
- acciones;
- planes;
- capabilities;
- entitlements;
- límites;
- administración SaaS;
- migraciones controladas;
- deploy unificado;
- métricas oficiales;
- motor matemático;
- adaptadores PostgreSQL;
- clasificación funcional de errores;
- interpretación ejecutiva inicial;
- centro de decisiones inicial;
- integración inicial en BI y dashboard;
- pruebas de PostgreSQL descartable;
- aislamiento tenant probado.

El cierre reciente corrigió:

- fórmulas calculadas sin valor;
- ausencia convertida en cero;
- dependencias;
- columnas incompatibles;
- SQL inválido;
- severidades no normalizadas;
- lineage ausente;
- falta de clasificación funcional;
- ausencia de acción contextual.

Este avance se considera:

```text
estabilización del motor matemático
+ primera versión del centro de decisiones
```

No constituye cierre total de Fase 5.

---

# 5. ARQUITECTURA OBJETIVO

## 5.1 Flujo interno

```text
Módulo operacional
→ Fuente física
→ Contrato de fuente
→ Perfilado
→ Normalización
→ Observación canónica
→ Validación
→ Medición interna
→ Trust Score
→ Snapshot
→ Impacto GRC
→ Dashboard
→ Acción
→ Verificación
```

## 5.2 Flujo externo

```text
Conector
→ Extracción
→ Raw Record
→ Validación
→ Normalización
→ Observación externa
→ Mapeo
→ Indicador
→ Regla
→ Impacto
→ Acción
→ Dashboard
→ Reporte
```

## 5.3 Capas

1. Datos operacionales.
2. Contratos de fuente.
3. Observaciones canónicas.
4. Gobierno de indicadores.
5. Causalidad.
6. Experiencia ejecutiva y operativa.
7. Integraciones.
8. Operación MSP.

---

# 6. MODELO DE DATOS OBJETIVO

Antes de crear tablas se debe inspeccionar el esquema actual y reutilizar entidades existentes.

## 6.1 Gobierno de datos

Crear o extender:

```text
data_domains
data_elements
data_definitions
data_owners
data_sources
data_source_contracts
data_source_contract_versions
data_source_field_mappings
data_quality_rules
data_quality_assessments
data_quality_findings
data_lineage_edges
data_snapshots
data_comparisons
```

### data_source_contracts

```text
id
tenant_id nullable para catálogo global
source_code
display_name
entity_type
adapter_key
status
current_version_id
owner_user_id
created_by
created_at
updated_at
metadata
```

### data_source_contract_versions

```text
id
contract_id
version_number
physical_tables
tenant_key_candidates
timestamp_candidates
required_fields
optional_fields
field_equivalences
status_equivalences
severity_equivalences
unit_rules
period_rules
exclusion_rules
fallback_rules
minimum_coverage
freshness_policy
status
effective_from
effective_until
created_by
approved_by
created_at
approved_at
checksum
```

### data_source_field_mappings

```text
id
tenant_id
contract_version_id
physical_table
physical_column
canonical_field
transformation_type
transformation_config
priority
is_required
status
created_by
created_at
updated_at
```

No se almacena SQL libre ni JavaScript.

## 6.2 Observaciones canónicas

Crear o consolidar:

```text
grc_observations
grc_observation_relations
```

### grc_observations

```text
id
tenant_id
observation_type
entity_type
entity_id
source_contract_id
source_contract_version_id
source_table
source_record_id
source_timestamp
observed_at
period_start
period_end
status
severity
value_numeric
value_text
unit
quality_status
freshness_status
trust_score
owner_user_id
evidence_id
correlation_id
source_snapshot_id
is_current
created_at
metadata
```

Tipos:

```text
risk
control
compliance
evidence
audit
action
incident
loss
supplier
continuity
data_quality
integration
```

### grc_observation_relations

```text
id
tenant_id
from_observation_id
to_entity_type
to_entity_id
relation_type
confidence
valid_from
valid_until
created_by
created_at
metadata
```

## 6.3 Indicadores y mediciones

Crear o consolidar:

```text
metric_definitions
metric_formula_versions
metric_dimensions
metric_sources
metric_thresholds
metric_sufficiency_rules
metric_measurements
metric_validations
metric_impact_rules
metric_snapshots
metric_comparisons
metric_calculation_runs
metric_calculation_outputs
```

### metric_definitions

Debe representar conceptos de negocio.

```text
id
tenant_id nullable para catálogo global
metric_code interno
display_name
business_definition
technical_definition
metric_type
unit
direction
aggregation
frequency
owner_user_id
reviewer_user_id
status
valid_from
valid_until
created_by
created_at
updated_at
metadata
```

### metric_formula_versions

Uso interno.

```text
id
metric_definition_id
version_number
expression
expression_language
inputs
status
effective_from
effective_until
created_by
approved_by
created_at
approved_at
checksum
metadata
```

### metric_sufficiency_rules

```text
id
metric_definition_id
formula_version_id
required_inputs
optional_inputs
minimum_sample_size
minimum_coverage
maximum_age_seconds
allowed_quality_states
allowed_freshness_states
unit_requirements
period_requirements
exclusion_policy
status
created_at
updated_at
```

### metric_measurements

```text
id
tenant_id
metric_definition_id
formula_version_id
period_key
period_start
period_end
value_numeric
value_text
unit
coverage_ratio
sample_size
source_timestamp
ingested_at
calculated_at
quality_status
freshness_status
trust_score
validation_status
measurement_status
evidence_id
correlation_id
source_snapshot_id
supersedes_measurement_id
created_by
created_at
metadata
```

Estados:

```text
draft
unmeasured
insufficient_data
dependency_pending
source_incompatible
technical_error
estimated
calculated
validated
approved
superseded
retired
```

Reglas:

- `calculated` exige valor;
- `insufficient_data` no puede inventar cero;
- `source_incompatible` identifica contrato y campo;
- `technical_error` no se muestra como resultado de negocio;
- el usuario ve concepto e interpretación, no fórmula.

## 6.4 Impact Graph

Crear o consolidar:

```text
grc_impact_edges
grc_impact_events
grc_impact_propagations
```

### grc_impact_edges

```text
id
tenant_id
from_type
from_id
to_type
to_id
relation_type
weight
direction
rule_id
status
valid_from
valid_until
created_by
created_at
metadata
```

Relaciones:

```text
affects
mitigates
supports
evidences
violates
increases
decreases
triggers
blocks
depends_on
reported_in
resolved_by
```

### grc_impact_events

```text
id
tenant_id
origin_type
origin_id
event_type
previous_value
current_value
delta
severity
detected_at
correlation_id
status
created_at
metadata
```

## 6.5 Decisiones y prioridad

Crear o consolidar:

```text
grc_decisions
grc_priority_rules
grc_priority_scores
grc_decision_actions
```

### grc_priority_scores

```text
id
tenant_id
entity_type
entity_id
score
risk_component
regulatory_component
severity_component
due_component
financial_component
process_component
breadth_component
trust_component
explanation
rule_version
calculated_at
snapshot_id
```

El cálculo es determinista.

## 6.6 Snapshots

Crear o consolidar:

```text
grc_snapshots
risk_snapshots
control_snapshots
compliance_snapshots
metric_snapshots
dashboard_snapshots
report_snapshots
```

Cada snapshot debe ser:

- inmutable;
- tenant-scoped;
- versionado;
- con checksum;
- con período;
- reproducible;
- auditable.

## 6.7 Encuestas

Crear o consolidar:

```text
survey_definitions
survey_versions
survey_sections
survey_questions
survey_question_options
assessment_campaigns
assessment_recipients
survey_responses
survey_response_items
survey_evaluations
survey_approvals
survey_grc_consequences
```

## 6.8 Assurance

Crear o consolidar:

```text
assurance_test_definitions
assurance_test_executions
assurance_test_samples
assurance_test_results
assurance_test_exceptions
assurance_test_retests
```

## 6.9 Pérdidas

Crear o consolidar:

```text
loss_events
loss_recoveries
loss_event_versions
```

## 6.10 BI y reporting

Crear o consolidar:

```text
dashboard_definitions
dashboard_versions
dashboard_widgets
dashboard_permissions
report_definitions
report_template_versions
report_schedules
report_generations
report_artifacts
report_approvals
```

## 6.11 Integraciones

Crear o consolidar:

```text
integration_definitions
connector_versions
tenant_integrations
integration_entitlements
integration_credential_references
integration_scopes
integration_configurations
integration_sync_schedules
integration_sync_jobs
integration_sync_runs
integration_checkpoints
raw_external_records
external_observations
external_entity_mappings
integration_metric_mappings
integration_rules
integration_impacts
integration_errors
integration_health
integration_usage
webhook_registrations
dead_letter_records
```

## 6.12 MSP

Crear o consolidar:

```text
partners
partner_profiles
partner_status_history
partner_certifications
partner_specializations
partner_users
partner_teams
partner_roles
partner_permissions
partner_tenant_engagements
partner_tenant_assignments
partner_access_requests
partner_access_approvals
partner_access_sessions
partner_opportunities
partner_provisioning_requests
partner_implementation_projects
partner_implementation_tasks
partner_implementation_milestones
partner_support_tickets
partner_ticket_escalations
partner_slas
partner_managed_services
partner_managed_service_tasks
partner_integration_assignments
partner_templates
partner_template_versions
partner_knowledge_articles
partner_notifications
partner_scorecards
partner_improvement_plans
partner_audit_events
partner_offboardings
```

---

# 7. REGLAS DE MIGRACIÓN

1. Migraciones aditivas.
2. Checksum.
3. Preflight.
4. Registro en `schema_migrations`.
5. Idempotencia.
6. Reintento controlado.
7. Postconditions.
8. Foreign keys.
9. Índices.
10. Checks.
11. Unicidad.
12. No usar JSONB para campos esenciales.
13. No cascadas destructivas.
14. Conservar históricos.
15. Tenant scope.
16. Timestamps.
17. Auditoría.
18. Versionado.
19. No editar migraciones aplicadas.
20. Allowlist declarativa de runners.

---

# 8. FASE 5-C1 — AUDITORÍA INTEGRAL

## Objetivo

Inventariar el estado real del repositorio y producción.

## Inventario

- tablas;
- migraciones;
- endpoints;
- servicios;
- jobs;
- schedulers;
- rutas;
- componentes;
- permisos;
- capabilities;
- límites;
- eventos;
- reportes;
- exporters;
- widgets;
- indicadores;
- fórmulas internas;
- adaptadores;
- encuestas;
- assurance;
- pérdidas;
- lineage;
- snapshots;
- integraciones;
- archivos;
- tests;
- CI;
- deploy.

## Producción

Validar:

- Credex;
- Tecdex;
- Demo.

## Clasificación

```text
operativo
parcial
inaccesible
duplicado
sin datos
sin permisos
sin UI
sin backend
sin pruebas
no implementado
obsoleto
```

## Entregables

```text
docs/phase5/phase5-current-inventory.md
docs/phase5/phase5-functional-gap-matrix.md
docs/phase5/phase5-data-source-inventory.md
docs/phase5/phase5-route-endpoint-matrix.md
docs/phase5/phase5-rbac-capability-matrix.md
docs/phase5/phase5-production-baseline.md
```

## Cierre

- 100% de módulos clasificados;
- 100% de rutas inventariadas;
- 100% de tablas identificadas;
- 100% de endpoints mapeados;
- ningún componente sin clasificación;
- backlog basado en evidencia.

---

# 9. FASE 5-C2 — CAPA SEMÁNTICA

## Objetivo

Eliminar consultas frágiles y parches por cliente.

## Trabajo

- contratos versionados;
- equivalencias de columnas;
- equivalencias de estados;
- equivalencias de severidad;
- fechas;
- unidades;
- tenant key;
- campos obligatorios;
- campos opcionales;
- exclusiones;
- fallback;
- cobertura;
- freshness;
- observaciones;
- perfilado.

## Perfilado

Detectar:

- nulos;
- tipos incorrectos;
- duplicados;
- claves huérfanas;
- estados desconocidos;
- fechas inválidas;
- valores fuera de rango;
- unidades incompatibles;
- stale;
- falta de owner;
- cobertura insuficiente.

## Estados

```text
source_ready
source_ready_with_warnings
insufficient_data
stale_source
schema_incompatible
source_unavailable
permission_denied
```

## Problemas y solución

### Columnas distintas

Mapping versionado.

### Estados heterogéneos

Catálogo de equivalencias.

### Severidades heterogéneas

Escala canónica.

### Timestamp ausente

No inventar; clasificar insuficiencia.

### Baja cobertura

Mostrar cobertura y limitar interpretación.

### Tablas legacy

Adapter explícito.

### Alto volumen

Índices, paginación, jobs y snapshots.

## Cierre

- dominios principales normalizados;
- adapters versionados;
- sin fallback silencioso;
- cobertura visible;
- errores clasificados;
- validación multitenant.

---

# 10. FASE 5-C3 — INDICADORES, TRUST Y SNAPSHOTS

## Objetivo

Hacer toda cifra reproducible y comparable.

## Funcionalidad

- catálogo funcional;
- catálogo técnico interno;
- fórmulas versionadas;
- reglas de suficiencia;
- frecuencia;
- owner;
- reviewer;
- umbrales;
- validación;
- aprobación;
- trust;
- freshness;
- cobertura;
- snapshots;
- comparativas.

## Data Trust

Componentes:

```text
completeness
accuracy
consistency
freshness
lineage
validation
stability
coverage
```

Estados:

```text
trusted
acceptable
attention
untrusted
unknown
```

## Reglas

- score 0–100;
- pesos suman 1;
- sin lineage no puede ser 100;
- stale reduce score;
- rejected no puede ser trusted;
- unknown no se muestra normal.

## Cierre

- todo indicador visible tiene trust;
- toda medición tiene período;
- toda comparación tiene snapshot;
- ninguna ausencia se vuelve cero;
- ninguna fórmula interna aparece como experiencia principal;
- snapshots inmutables.

---

# 11. FASE 5-C4 — CONSOLIDACIÓN GRC

## 11.1 Centro Ejecutivo

Sin fórmulas visibles.

Mostrar:

- GRC Health;
- readiness;
- cumplimiento;
- riesgo residual;
- efectividad de controles;
- acciones críticas;
- Data Trust;
- tendencias;
- exposiciones;
- decisiones.

## 11.2 Centro Operativo

La unidad es el asunto GRC, no la fórmula.

Mostrar:

- acciones vencidas;
- controles degradados;
- riesgos sin tratamiento;
- evidencias vencidas;
- requisitos sin evaluar;
- pruebas fallidas;
- proveedores críticos;
- integraciones degradadas;
- datos insuficientes;
- fuentes stale.

## 11.3 Riesgo 360

- definición;
- owner;
- proceso;
- activos;
- causa;
- consecuencia;
- inherente;
- residual;
- controles;
- efectividad;
- KRIs;
- incidentes;
- pérdidas;
- hallazgos;
- acciones;
- evidencia;
- requisitos;
- tendencia.

## 11.4 Control 360

- objetivo;
- diseño;
- implementación;
- operación;
- evidencia;
- frecuencia;
- última ejecución;
- próxima ejecución;
- pruebas;
- excepciones;
- riesgos mitigados;
- requisitos cubiertos;
- owner;
- efectividad;
- acciones.

## 11.5 Cumplimiento 360

- aplicabilidad;
- cobertura;
- cumplimiento;
- confianza;
- controles;
- evidencias;
- hallazgos;
- acciones;
- owner;
- evaluación;
- tendencia;
- readiness.

## 11.6 Centro de Datos

- fuentes;
- cobertura;
- filas recibidas;
- válidas;
- excluidas;
- rechazadas;
- freshness;
- errores;
- owners;
- indicadores afectados;
- lineage.

## Cierre

- navegación coherente;
- filtros globales;
- drill-down;
- mismas definiciones;
- acciones;
- responsive;
- accesibilidad;
- detalle técnico separado.

---

# 12. FASE 5-C5 — DASHBOARD OPERATIVO

## Capas

### Estado

- GRC Health;
- readiness;
- residual;
- cumplimiento;
- control effectiveness;
- remediación;
- trust.

### Tendencias

- 6, 12 y 24 períodos;
- variación;
- causa;
- objetivo.

### Exposición

- heatmap;
- riesgos críticos;
- procesos;
- unidades;
- proveedores;
- activos.

### Cumplimiento y controles

- norma;
- cobertura;
- controles degradados;
- evidencias;
- requisitos;
- efectividad.

### Ejecución

- acciones;
- aging;
- responsables;
- cierre;
- auditorías;
- vencimientos.

### Calidad

- trust;
- stale;
- incompatibles;
- insufficient;
- integraciones degradadas.

### Decisiones

- lista priorizada;
- factores;
- responsable;
- fecha;
- acción.

## Cierre

- datos reales;
- fórmulas ocultas;
- conceptos visibles;
- fuente visible;
- período;
- trust;
- drill-down;
- acción;
- snapshots.

---

# 13. FASE 5-C6 — IMPACT GRAPH Y PRIORIDAD

## Impact Graph

```text
Dato
→ Observación
→ Indicador
→ Control
→ Riesgo
→ Requisito
→ Readiness
→ Hallazgo
→ Acción
```

## Priority Score

- riesgo;
- regulación;
- severidad;
- vencimiento;
- impacto financiero;
- criticidad del proceso;
- amplitud;
- trust.

## Reglas

- determinista;
- versionado;
- explicable;
- tenant-scoped;
- no IA opaca;
- no edición sin justificación.

## Dificultades

- ciclos: limitar profundidad;
- alto volumen: snapshots;
- ambigüedad: exigir tipo y confianza;
- propagación excesiva: pesos y reglas.

## Cierre

- recorrido visual;
- explicación causal;
- prioridad;
- acción;
- sin ciclos;
- aislamiento tenant.

---

# 14. FASE 5-C7 — ACCIÓN Y VERIFICACIÓN

## Flujo

```text
señal
→ decisión
→ plan
→ responsable
→ fecha
→ ejecución
→ evidencia
→ revisión
→ re-test
→ verificación
→ recálculo
→ comparación
→ cierre
```

## Funciones

- crear plan desde indicador;
- vincular riesgo;
- vincular control;
- vincular requisito;
- owner;
- fecha;
- escalamiento;
- evidencia;
- aprobación;
- reapertura;
- re-test;
- efectividad;
- actualización.

## Cierre

- acción completa;
- responsable obligatorio;
- fecha obligatoria;
- evidencia;
- cierre;
- verificación;
- comparación antes/después.

---

# 15. FASE 5-C8 — CAPACIDADES RESTANTES

## Encuestas

- builder;
- versiones;
- preguntas;
- branching;
- scoring;
- campañas;
- destinatarios;
- recordatorios;
- cierre;
- evaluación;
- aprobación;
- consecuencias GRC.

## Assurance

- definición;
- muestra;
- ejecución;
- evidencia;
- excepciones;
- hallazgos;
- acciones;
- re-test;
- aprobación.

## Pérdidas

- evento;
- revisión;
- confirmación;
- recuperación;
- cierre;
- frecuencia;
- severidad;
- KRI;
- expected loss;
- dashboard.

## Dashboard Builder

- crear;
- editar;
- clonar;
- versionar;
- publicar;
- retirar;
- permisos;
- filtros;
- layout;
- snapshot.

## Report Studio

- definiciones;
- plantillas;
- secciones;
- filtros;
- destinatarios;
- clasificación;
- aprobación;
- PDF;
- DOCX;
- XLSX;
- scheduling;
- historial;
- descarga;
- checksum;
- snapshot.

## Cierre

Todos los recorridos end-to-end y sin mocks.

---

# 16. FASE 5-C9 — SEGURIDAD Y COMERCIAL

## Validar

- RBAC;
- capability;
- entitlement;
- limit;
- usage;
- override;
- plan;
- trial;
- downgrade;
- suspensión;
- archivos;
- descargas;
- jobs;
- snapshots;
- exports;
- tenant isolation;
- platform admin.

## Regla

```text
permiso
+ capability
+ entitlement
+ límite
+ tenant
+ vigencia
```

## Cierre

- backend autoritativo;
- rutas protegidas;
- archivos protegidos;
- exportaciones auditadas;
- downgrade seguro;
- límites claros;
- históricos preservados.

---

# 17. FASE 5-C10 — UX PREMIUM

## Revisar

- navegación;
- sidebar;
- títulos;
- breadcrumbs;
- tipografía;
- densidad;
- grids;
- cards;
- tablas;
- filtros;
- modales;
- scroll;
- sticky headers;
- tooltips;
- colores;
- contraste;
- foco;
- teclado;
- responsive;
- loading;
- empty;
- error;
- success;
- i18n;
- textos;
- ayuda;
- detalle progresivo.

## Regla

El usuario de negocio ve interpretación. El técnico puede expandir detalle.

## Cierre

- interfaz enterprise;
- sin desbordes;
- sin datos crudos;
- sin componentes inconclusos;
- sin navegación duplicada;
- sin inconsistencias.

---

# 18. FASE 5-C11 — QA Y UAT

## Tenants

- Credex;
- Tecdex;
- Demo.

## Pruebas

### Datos

- válida;
- stale;
- vacía;
- esquema incompatible;
- inválida;
- unidad incompatible;
- cobertura baja.

### Indicadores

- cálculo;
- insuficiencia;
- dependencia;
- error;
- snapshot;
- comparación;
- trust.

### GRC

- riesgo;
- control;
- cumplimiento;
- acción;
- re-test;
- impacto.

### Encuestas

- definición;
- campaña;
- respuesta;
- evaluación;
- consecuencia.

### Assurance

- definición;
- ejecución;
- muestra;
- hallazgo;
- re-test.

### Pérdidas

- evento;
- recuperación;
- net loss;
- KRI.

### BI

- dashboard;
- filtro;
- drill-down;
- snapshot.

### Reporting

- PDF;
- DOCX;
- XLSX;
- aprobación;
- descarga;
- segunda emisión.

### Seguridad

- tenant A vs B;
- usuario sin permiso;
- capability off;
- entitlement off;
- límite alcanzado;
- archivo ajeno;
- job ajeno.

## Cierre

- CI verde;
- UAT aprobado;
- archivos válidos;
- sin SQL errors;
- sin rutas huérfanas;
- sin indicadores opacos;
- sin deuda visual;
- sin deuda funcional.

---

# 19. DEFINITION OF DONE FASE 5

```text
[ ] auditoría completa
[ ] capa semántica
[ ] contratos versionados
[ ] observaciones canónicas
[ ] suficiencia
[ ] trust
[ ] freshness
[ ] snapshots
[ ] comparativas
[ ] centro ejecutivo
[ ] centro operativo
[ ] riesgo 360
[ ] control 360
[ ] cumplimiento 360
[ ] centro de datos
[ ] dashboard
[ ] impact graph
[ ] priority score
[ ] acción
[ ] verificación
[ ] encuestas
[ ] assurance
[ ] pérdidas
[ ] builder
[ ] report studio
[ ] PDF
[ ] DOCX
[ ] XLSX
[ ] scheduling
[ ] RBAC
[ ] capabilities
[ ] límites
[ ] tenant isolation
[ ] E2E
[ ] UX premium
[ ] fórmulas internas ocultas
[ ] catálogo funcional de conceptos
[ ] documentación
[ ] deuda cero
```

---

# 20. FASE 6 — INTEGRATION HUB

## Objetivo

Conectar fuentes reales y transformarlas en señales GRC.

## Arquitectura

```text
Connector
→ Authentication
→ Discovery
→ Extraction
→ Raw Record
→ Validation
→ Normalization
→ External Observation
→ Mapping
→ Indicador
→ Regla
→ Impacto
→ Acción
→ Dashboard
→ Reporte
```

## Bloques

### 6.1 Fundación

- catálogo;
- versiones;
- credenciales referenciadas;
- scopes;
- schedules;
- jobs;
- runs;
- checkpoints;
- raw records;
- health;
- errors;
- usage;
- audit;
- DLQ.

### 6.2 Jira y Confluence

Extracción, mapping, indicadores, reglas e impacto.

### 6.3 GitHub, GitLab y Jenkins

DevSecOps, pipelines, vulnerabilidades, branch protection y fallos.

### 6.4 Microsoft 365 y Google Workspace

Identidad, MFA, sharing, actividad y riesgo.

### 6.5 AWS, Azure y Google Cloud

Cloud security, IAM, logging, backup y exposición.

### 6.6 Marketplace y Mapping Studio

- catálogo;
- configuración;
- scopes;
- preview;
- mappings;
- health;
- consumo;
- documentación.

### 6.7 Automatización GRC

Cada observación puede:

- actualizar indicador;
- crear evidencia;
- degradar control;
- aumentar riesgo;
- afectar cumplimiento;
- crear hallazgo;
- crear acción;
- degradar readiness.

## Seguridad

- secretos fuera de BD;
- mínimo privilegio;
- SSRF;
- allowlist;
- rate limit;
- masking;
- rotation;
- revoke;
- audit;
- tenant isolation.

## Dificultades

- rate limits: backoff;
- credenciales vencidas: health;
- duplicados: hash;
- errores parciales: DLQ;
- cambios externos: versionado;
- carga: jobs;
- permisos faltantes: estado funcional.

## Definition of Done Fase 6

Cada conector debe demostrar:

```text
dato externo
→ observación
→ indicador
→ impacto
→ decisión
→ acción
→ dashboard
→ reporte
```

No basta con estar conectado.

---

# 21. FASE 7 — ECOSISTEMA MSP

## Objetivo

Permitir que partners autorizados vendan, implementen, soporten y operen TCDX manteniendo control central.

## Principios

- Tecdex controla plataforma;
- cliente conserva datos;
- engagement no equivale a permiso;
- mínimo privilegio;
- auditoría;
- no impersonación invisible;
- acceso temporal;
- continuidad;
- offboarding.

## Bloques

### 7.1 Fundación MSP

- partner;
- perfil;
- estado;
- usuarios;
- equipos;
- roles;
- competencias;
- engagements;
- cartera;
- portal;
- auditoría.

### 7.2 Comercial e implementación

- oportunidades;
- aprovisionamiento;
- aprobación;
- proyecto;
- tareas;
- hitos;
- plantillas;
- go-live;
- aceptación.

### 7.3 Soporte

- tickets;
- SLA;
- L1/L2/L3;
- acceso temporal;
- escalamiento;
- knowledge base;
- satisfacción.

### 7.4 Servicios e integraciones

- planes recurrentes;
- calendario;
- evidencias;
- integraciones;
- health;
- reporting.

### 7.5 Gobierno y continuidad

- scorecard;
- competencias;
- mejora;
- co-branding;
- comunicaciones;
- reporting;
- restricciones;
- offboarding;
- transferencia.

## Acceso

```text
partner activo
+ usuario activo
+ engagement
+ asignación
+ servicio
+ rol
+ permiso
+ capability
+ vigencia
+ propósito
```

## Dashboard MSP

- clientes;
- onboarding;
- SLA;
- integraciones;
- acciones;
- evidencias;
- readiness;
- data trust;
- salud;
- renovaciones;
- alertas.

## Definition of Done Fase 7

- aislamiento partner-tenant;
- acceso temporal;
- expiración;
- auditoría;
- continuidad;
- cambio de partner;
- integración sin secretos;
- soporte completo;
- reporting;
- scorecard;
- offboarding.

---

# 22. API OBJETIVO

## Fase 5

```text
/api/data/*
/api/metrics/*
/api/surveys/*
/api/assurance-tests/*
/api/loss-events/*
/api/dashboards/*
/api/reports/*
/api/grc/decisions/*
/api/grc/impact/*
/api/grc/priority/*
```

## Fase 6

```text
/api/integrations/*
/api/connectors/*
/api/integration-runs/*
/api/integration-health/*
/api/external-observations/*
/api/mappings/*
```

## Fase 7

```text
/api/v1/partners/*
/api/v1/partner-access/*
/api/v1/partner-offboarding/*
```

Cada endpoint valida:

- autenticación;
- tenant;
- partner cuando corresponda;
- permiso;
- capability;
- entitlement;
- límite;
- propósito;
- vigencia.

---

# 23. JOBS

## Fase 5

```text
metric.calculate
metric.recalculate
data_quality.assess
freshness.evaluate
snapshot.create
comparison.calculate
survey.reminder
survey.close
assurance.evaluate
dashboard.snapshot
report.generate
report.schedule
report.cleanup
```

## Fase 6

```text
integration.discovery
integration.full_sync
integration.incremental_sync
integration.webhook_process
integration.retry
integration.dlq_replay
integration.health
integration.freshness
```

## Fase 7

```text
partner.access_expire
partner.sla_evaluate
partner.managed_service_schedule
partner.competency_expire
partner.scorecard_calculate
partner.offboarding_execute
```

Cada job registra:

```text
tenant_id
partner_id nullable
job_type
status
attempts
started_at
finished_at
duration
error_code
correlation_id
payload_sanitized
```

---

# 24. OBSERVABILIDAD

Debe existir:

- logs estructurados;
- request_id;
- correlation_id;
- tenant_id;
- partner_id;
- job_id;
- metric_run_id;
- integration_run_id;
- report_generation_id;
- alertas;
- tiempos;
- errores;
- health;
- backlog;
- DLQ;
- almacenamiento;
- latencia;
- tasa 5xx;
- SQL errors.

No registrar secretos.

---

# 25. SEGURIDAD

## Controles

- RBAC;
- tenant isolation;
- partner isolation;
- IDOR;
- CSRF;
- XSS;
- SQL injection;
- SSRF;
- file upload;
- signed URLs;
- rate limiting;
- session invalidation;
- MFA;
- audit;
- secrets;
- dependency scanning;
- secure headers;
- password policy;
- rotation;
- least privilege.

## Pruebas

- positivas;
- negativas;
- manipulación IDs;
- cross-tenant;
- cross-partner;
- access expired;
- entitlement off;
- limit reached;
- file access;
- export;
- connector secret;
- emergency access.

---

# 26. RENDIMIENTO

## Reglas

- índices por tenant;
- índices por estado;
- índices por período;
- paginación;
- consultas acotadas;
- snapshots;
- jobs async;
- cache segura;
- no N+1;
- límites;
- cleanup;
- retención;
- particionamiento si corresponde.

## Pruebas de carga

- 100.000 mediciones;
- 1.000.000 observaciones;
- 10.000 acciones;
- 500 tenants;
- 100 integraciones concurrentes;
- 50 partners;
- dashboards complejos;
- reportes grandes.

---

# 27. DOCUMENTACIÓN

Crear:

```text
docs/final-phases/architecture.md
docs/final-phases/data-model.md
docs/final-phases/source-contracts.md
docs/final-phases/metric-engine.md
docs/final-phases/data-trust.md
docs/final-phases/impact-graph.md
docs/final-phases/decision-engine.md
docs/final-phases/executive-dashboard.md
docs/final-phases/operational-dashboard.md
docs/final-phases/360-views.md
docs/final-phases/surveys.md
docs/final-phases/assurance.md
docs/final-phases/loss-events.md
docs/final-phases/reporting.md
docs/final-phases/integrations.md
docs/final-phases/msp.md
docs/final-phases/security.md
docs/final-phases/operations.md
docs/final-phases/uat.md
docs/final-phases/closeout.md
```

---

# 28. ESTRATEGIA GIT

Cada bloque:

1. parte desde `main`;
2. crea rama dedicada;
3. ejecuta baseline;
4. implementa;
5. valida;
6. abre PR;
7. espera CI;
8. corrige hasta verde;
9. revisa;
10. fusiona;
11. despliega;
12. valida producción;
13. registra evidencia.

No acumular todas las fases en un solo PR.

---

# 29. HOJA DE RUTA

```text
5-C1 Auditoría
↓
5-C2 Semántica
↓
5-C3 Indicadores y snapshots
↓
5-C4 Vistas
↓
5-C5 Dashboard
↓
5-C6 Impact Graph
↓
5-C7 Acción
↓
5-C8 Encuestas/Assurance/Pérdidas/Reporting
↓
5-C9 Seguridad y comercial
↓
5-C10 UX
↓
5-C11 QA
↓
Cierre Fase 5
↓
6.1 Fundación
↓
6.2 Jira/Confluence
↓
6.3 GitHub/GitLab/Jenkins
↓
6.4 Microsoft/Google
↓
6.5 Cloud
↓
6.6 Marketplace/Mapping
↓
6.7 Cierre
↓
7.1 Fundación MSP
↓
7.2 Comercial/Implementación
↓
7.3 Soporte
↓
7.4 Servicios/Integraciones
↓
7.5 Gobierno/Offboarding
↓
Cierre comercial
```

---

# 30. DEFINITION OF DONE GLOBAL

El producto está listo únicamente si:

```text
[ ] fases cerradas
[ ] módulos operativos
[ ] flujos E2E
[ ] datos reales
[ ] sin mocks
[ ] sin marcadores de trabajo pendiente
[ ] sin rutas huérfanas
[ ] sin tablas huérfanas
[ ] sin endpoints sin uso
[ ] sin UI incompleta
[ ] sin errores SQL
[ ] sin cálculos opacos
[ ] fórmulas internas ocultas
[ ] conceptos de negocio visibles
[ ] trust
[ ] freshness
[ ] snapshots
[ ] impact graph
[ ] acciones
[ ] verificación
[ ] reportes válidos
[ ] integraciones completas
[ ] MSP completo
[ ] RBAC
[ ] tenant isolation
[ ] partner isolation
[ ] migraciones idempotentes
[ ] deploy unificado
[ ] CI verde
[ ] UAT aprobado
[ ] UX premium
[ ] documentación
[ ] observabilidad
[ ] backup y restore
[ ] seguridad
[ ] deuda cero
```

---

# 31. RESULTADO FINAL

TCDX ISO SaaS debe llegar al mercado como una plataforma capaz de:

- centralizar GRC;
- leer datos reales;
- medir calidad;
- explicar resultados;
- conectar operación, riesgo y cumplimiento;
- priorizar decisiones;
- ejecutar acciones;
- verificar resultados;
- demostrar mejora;
- conectarse a sistemas externos;
- operar un ecosistema MSP;
- producir valor visible para gerentes, equipos técnicos, auditores y directorios.

Promesa final:

```text
TCDX convierte la operación de la organización
en decisiones GRC confiables,
acciones trazables
y mejora continua verificable.
```
