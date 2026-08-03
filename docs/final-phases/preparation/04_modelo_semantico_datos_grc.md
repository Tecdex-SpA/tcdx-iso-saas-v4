# Modelo semántico de datos GRC

Documento de diseño; no contiene SQL productivo. PostgreSQL continúa como fuente de verdad y el backend como capa autoritativa.

## Decisiones de reutilización

| Entidades actuales | Decisión |
|---|---|
| `data_domains`, `data_sources`, `data_elements`, `data_definitions`, `data_owners` | Extender; no recrear catálogo de datos. |
| `data_quality_rules`, `data_quality_assessments`, `data_lineage_edges`, `data_snapshots`, `data_comparisons` | Extender para contratos y observaciones canónicas. |
| `metric_definitions`, `metric_formula_versions`, `metric_sources`, `metric_thresholds`, `metric_measurements`, `metric_snapshots` | Mantener como catálogo funcional y mediciones. |
| `official_formula_*`, `calculation_*`, `statistical_*` | Mantener como catálogo técnico y evidencia matemática. |
| `grc_phase2_relations`, `grc_domain_events`, `grc_analytical_impact_*` | Adaptar al Impact Graph; conservar historial. |
| `grc_connector_*`, `grc_external_records` | Convertir en fundación de Fase 6 mediante extensiones aditivas. |
| `grc_workflow_*`, `action_plans`, hallazgos y evidencias | Reutilizar para decisión/acción; no crear workflow paralelo. |

## Flujo canónico

Fuente física → contrato/version → mapping → observación → validación/calidad → medición → snapshot → impacto → decisión → acción → verificación.

## Tablas semánticas nuevas o extendidas

| Tabla | Propósito y campos PostgreSQL | PK/FK, checks, índices y unicidad | Scope, auditoría, versión, retención | Relación y estrategia de migración |
|---|---|---|---|---|
| `data_source_contracts` | Contrato lógico: `id uuid`, `tenant_id uuid null`, `source_code text`, `display_name text`, `entity_type text`, `adapter_key text`, `status text`, `current_version_id uuid`, `owner_user_id uuid`, timestamps, `metadata jsonb` no esencial | PK `id`; FK tenant/user/current_version diferible; check status; unique `(tenant_id,source_code)` con índice para null global; índice `(tenant_id,status)` | Global explícito o tenant; created/updated actor; versiones en tabla hija; retención permanente | Nueva; bootstrap desde `official_formula_source_contracts` y `data_sources`, sin borrar origen hasta validar equivalencia |
| `data_source_contract_versions` | Contrato físico: `id uuid`, `contract_id uuid`, `version_number int`, `physical_tables text[]`, keys/campos/reglas `jsonb`, `minimum_coverage numeric(5,4)`, `freshness_policy jsonb`, status, vigencia, actores, checksum | PK; FK contract; check version>0, coverage 0..1, status; unique `(contract_id,version_number)` y checksum; índices status/vigencia | Hereda scope; versión publicada inmutable; retención permanente | Nueva; JSONB solo para listas/reglas variables, nunca SQL; trigger de inmutabilidad publicada |
| `data_source_field_mappings` | Mapeo: `id uuid`, `tenant_id uuid`, `contract_version_id uuid`, `physical_table text`, `physical_column text`, `canonical_field text`, `transformation_type text`, `transformation_config jsonb`, `priority int`, `is_required bool`, status, actor/timestamps | PK; FK tenant/version; checks allowlist transformación y priority>=0; unique active `(tenant_id,contract_version_id,canonical_field,priority)`; índices físicos/canónicos | Tenant obligatorio; auditoría completa; versionado por contract version; retención permanente | Nueva; migrar mappings de `grc_connector_mappings` mediante adapter explícito |
| `grc_observations` | Observación canónica: IDs tenant/entity/source, tipo/estado/severidad, timestamps/período, valores numeric/text, unidad, quality/freshness/trust, owner/evidence/correlation/snapshot, current, metadata | PK uuid; FK tenant/contract/version/evidence/snapshot cuando aplique; checks un solo valor, período válido, trust 0..100; índices `(tenant_id,type,observed_at)`, entity, current | Tenant obligatorio; insert-only salvo supersede; auditoría por correlation; retención 7 años configurable | Nueva; backfill por dominio en lotes, reconciliar conteos y no sustituir tablas operacionales |
| `grc_observation_relations` | Relaciones: `id`, `tenant_id`, `from_observation_id`, `to_entity_type`, `to_entity_id`, `relation_type`, `confidence numeric`, vigencia, actor, metadata | PK; FK observation/tenant; checks relation allowlist, confidence 0..1; unique relación vigente; índices from/to/tenant | Tenant obligatorio; historial temporal; retención alineada a observaciones | Nueva; importar relaciones validadas de `grc_phase2_relations` y lineage sin perder origen |
| `metric_sufficiency_rules` | Reglas: `id`, metric/formula IDs, inputs, min sample/coverage, max age, quality/freshness/unit/period policies, status, timestamps | PK; FK metric/formula; checks sample>=0, coverage 0..1; unique versión activa | Global o tenant por metric; versionado junto a fórmula; retención permanente | Nueva; bootstrap explícito desde metadata de fórmula y source contracts |
| `metric_calculation_policies` | Ya existe; política de ejecución, calendario, timezone, late data y revisión | Extender con FKs contract/sufficiency; checks timezone/frequency; unique active per metric | Tenant/global según metric; historial, no update destructivo | Migración aditiva; preservar filas Fase 5.5 |
| `metric_measurements` | Ya existe; resultado funcional con period, value, coverage, trust, status, snapshot y supersede | Extender FK a `calculation_runs` y sufficiency result; check calculated exige valor; unique por tenant/metric/period/version/current | Tenant; append/supersede; retención 7 años o contractual | Backfill links desde calculation outputs; no recalcular históricos silenciosamente |
| `metric_comparisons` | Comparación inmutable: `id`, tenant, metric, base/target snapshot, absolute/percent change, direction, status, calculated_at, correlation | PK; FKs metric/snapshots; check snapshots distintos y misma unidad/período compatible; unique pair | Tenant; insert-only; retención con snapshots | Nueva o vista materializada sobre `data_comparisons`/`calculation_comparisons`; elegir una sola fuente en 5-C1 |
| `grc_impact_edges` | Arista causal: IDs tenant, from/to type+id, relation, weight, direction, rule_id, status, vigencia, actor, metadata | PK; FKs tenant/rule; checks no self-loop, weight 0..1, allowlists; unique arista vigente; índices from/to | Tenant; versionado temporal; retención permanente | Nueva canónica; adaptar `data_lineage_edges` y `grc_analytical_impact_rules` sin duplicar lectura |
| `grc_impact_events` | Cambio observado: origen, event_type, previous/current/delta jsonb controlado, severity, detected_at, correlation, status, metadata | PK; tenant FK; checks severity/status; índices tenant/time/origin | Tenant; append-only; retención 7 años | Extender o reemplazar por vista sobre `grc_domain_events` y `grc_analytical_impact_events` tras reconciliación |
| `grc_impact_propagations` | Ejecución del grafo: event, edge, depth, contribution, path_hash, status, started/finished, correlation | PK; FKs event/edge; checks depth 0..10, contribution; unique `(event_id,path_hash)` | Tenant derivado; idempotente; retención 2 años más snapshot | Nueva; job acotado, detecta ciclos y no ejecuta acciones irreversibles |
| `grc_priority_rules` | Regla determinista versionada: componentes/pesos/umbrales, status, vigencia, owner/approver/checksum | PK; tenant null/global; checks pesos suman 1 y estado; unique code/version | Global o tenant; published inmutable; permanente | Nueva; no IA opaca ni expresión libre |
| `grc_priority_scores` | Score por entidad: componentes numéricos, explanation jsonb sanitizado, rule version, calculated_at, snapshot | PK; FKs tenant/rule/snapshot; checks 0..100; índice tenant/entity/date | Tenant; append-only/supersede; 7 años | Nueva; fuentes exclusivas de observaciones/mediciones oficiales |
| `grc_decisions` | Decisión: `id`, tenant, subject, priority_score_id, status, rationale, owner, due_at, approved_by/at, correlation, timestamps | PK; FKs tenant/priority/users; checks estado y due requerido al aprobar; índices owner/status/due | Tenant; auditoría e historial; retención 7 años | Nueva; se vincula a workflow existente, no reemplaza aprobaciones |
| `grc_decision_actions` | Relación decisión-plan/action y verificación: IDs, relation_type, before/after snapshots, effectiveness_status, timestamps | PK; FKs decision/action/snapshots; unique relación; checks cierre requiere after snapshot | Tenant; auditada; retención con decisión | Nueva; backfill solo para links verificables existentes |

## Extensiones de Integration Hub

| Tabla | Propósito y campos PostgreSQL | PK/FK, checks, índices y unicidad | Scope, auditoría, versión, retención | Relación y migración |
|---|---|---|---|---|
| `integration_definitions` | Catálogo provider/connector/version/capabilities/scopes/status | PK; unique provider+version; checks estado; índice provider | Global; published inmutable; permanente | Evoluciona `grc_connector_definitions`; crear vista de compatibilidad durante transición |
| `tenant_integrations` | Instalación tenant: definition, display, mode, status, owner, entitlement, schedule refs | PK; FKs tenant/definition; unique tenant+instance key; índices status/next run | Tenant; auditoría; historial de estado; permanente | Evoluciona `grc_connector_instances`, preservando IDs mediante migración/adaptador |
| `integration_credential_references` | Referencia externa, nunca secreto: tenant/integration, provider, secret_ref, key_version, status, rotated_at | PK; FKs; check formato ref y status; unique active per purpose | Tenant; acceso restringido; audit; retener 7 años sin valor secreto | Nueva; migrar envelope solo con procedimiento de rotación, no copiar secretos en logs |
| `integration_scopes` | Scopes requeridos/concedidos, purpose, status, verified_at | PK; FK integration; unique scope; checks estados | Tenant; historial; retención engagement+7 años | Nueva; derivar inicialmente de catálogo y OAuth grants |
| `integration_configurations` | Config versionada no secreta: key, typed value jsonb, schema_version, status | PK; FK; checks JSON schema backend; unique key/version | Tenant; published immutable; 7 años | Extraer config esencial de JSONB actual en campos tipados por provider |
| `integration_sync_schedules` | Cron/interval/timezone, enabled, next/last run, owner | PK; FK; checks timezone/frequency; unique active per integration/job type | Tenant; audit; 2 años historial | Evoluciona `schedule` JSONB de connector instance |
| `integration_sync_jobs` | Job solicitado: type, idempotency_key, status, attempts, correlation, timestamps | PK; FK; unique tenant+key; checks attempts/status; índices queue | Tenant; 2 años; payload sanitizado | Evoluciona async jobs y connector runs, sin doble scheduler |
| `integration_sync_runs` | Ejecución: job/checkpoint, counts, duration, status/error code | PK; FKs; checks counts>=0; índices tenant/integration/time/status | Tenant; 2 años o contractual | Evoluciona `grc_connector_runs`; conservar ID y trazabilidad |
| `integration_checkpoints` | Cursor versionado, external watermark, checksum, committed_at | PK; FK integration/run; unique committed sequence; check monotonicidad por adapter | Tenant; append-only; 2 años | Nueva; cursor actual se importa como checkpoint inicial |
| `raw_external_records` | Raw cifrado/seguro o referencia: provider ID/version/hash, observed_at, payload_ref/payload sanitizado, run | PK; FKs; unique tenant+provider+external+hash; índices time/type | Tenant; inmutable; retención por provider/política | Evoluciona `grc_external_records`; contenido sensible se externaliza cuando corresponda |
| `external_observations` | Observación canónica derivada con mapping/version/quality/source record | PK; FKs raw/mapping/grc observation; unique raw+mapping version | Tenant; append-only; 7 años | Nueva; puente formal a `grc_observations` |
| `external_entity_mappings` | External ID a entidad TCDX, confidence, status, approved_by | PK; FKs; unique provider/external/type vigente; checks confidence | Tenant; versionado y audit; permanente | Evoluciona `grc_connector_mappings` |
| `integration_metric_mappings` | Observación/campo a métrica/variable, unit transform allowlisted | PK; FKs integration/metric/formula variable; unique active | Tenant; versionado; permanente | Nueva; no SQL/JS libre |
| `integration_rules` | Regla declarativa de señal, condición tipada, severidad, status/version/checksum | PK; FK tenant/definition; checks operador allowlist; unique code/version | Tenant/global; published inmutable | Nueva; reutiliza motor de reglas GRC, no motor paralelo |
| `integration_impacts` | Resultado rule→impact event/decision/action proposal | PK; FKs rule/observation/impact/decision; unique idempotency key | Tenant; audit; 7 años | Nueva; acciones irreversibles requieren aprobación |
| `integration_health` | Snapshot de auth/scopes/freshness/errors/DLQ/SLO y trust | PK; FK integration/run; check score/status; índice latest | Tenant; snapshots 2 años | Nueva; alimenta dashboard y alertas oficiales |
| `integration_usage` | Uso por período: runs, records, bytes, API calls, errors, limit key | PK; FK tenant/integration/limit; unique period/dimension | Tenant; inmutable por cierre de período; 7 años comercial | Nueva; integra Fase 4 limits/usage |
| `webhook_registrations` | Endpoint ref, provider hook ID, secret_ref, status, expiry, last delivery | PK; FKs; unique provider hook; no secret; índices expiry/status | Tenant; audit; 7 años | Nueva; no almacena secreto en claro |
| `dead_letter_records` | Error no procesado: run/raw ref, stage, code, retry count, status, next retry, resolution | PK; FKs; checks retries/status; índices queue | Tenant; 2 años; payload sanitizado | Evoluciona `grc_connector_dead_letters`; UI y replay usan una sola cola |

## Modelo MSP propuesto

Cada tabla usa `id uuid` como PK, `created_at/updated_at timestamptz`, `created_by/updated_by uuid` y `metadata jsonb` solo para extensiones no esenciales. Toda FK tenant o partner se indexa. Retención mínima de auditoría: siete años o contrato aplicable.

| Tabla | Campos esenciales adicionales | FK/checks/unicidad | Scope, versión y migración |
|---|---|---|---|
| `partners` | `partner_code text`, `legal_name text`, `status text`, `country_code char(2)`, `primary_contact_user_id uuid` | unique code; check status | Global Tecdex; historial permanente; nueva en 7.1 |
| `partner_profiles` | `partner_id`, `display_name`, `description`, `website`, `service_regions text[]`, `branding_status` | FK partner; unique partner; URL/branding checks | Partner; versionado; no credenciales |
| `partner_status_history` | partner, previous/current status, reason, effective_at | FK partner; check transición; índice fecha | Append-only; permanente |
| `partner_certifications` | partner, type, issuer, issued/expires, evidence_id, status | FKs; unique credential/version; date checks | Partner; expiración job; no afirmar certificación TCDX |
| `partner_specializations` | partner, domain_code, level, approved_by/at, status | FKs; unique partner/domain active; level allowlist | Partner; Tecdex aprueba; historial |
| `partner_users` | partner, user_id, status, joined/expires | FKs partner/user; unique pair; expiry check | Partner; identidad central existente; no password duplicada |
| `partner_teams` | partner, team_code, name, owner_user_id, status | FKs; unique partner/code | Partner; audit; nueva |
| `partner_roles` | partner nullable/global, role_code, name, status, version | unique partner/code/version; published immutable | Catálogo global o partner; no reemplaza RBAC central |
| `partner_permissions` | role_id, permission_key, effect, scope_type | FKs; unique role/permission/scope; effect allowlist | Gobierno Tecdex; historial |
| `partner_tenant_engagements` | partner, tenant, engagement_code, service_type, status, starts/ends, purpose, approved_by | FKs; unique active partner/tenant/service; date/status checks | Cruce partner-tenant explícito; permanente |
| `partner_tenant_assignments` | engagement, partner_user, team, role, starts/ends, status | FKs; unique active assignment; vigencia checks | Scope engagement; mínimo privilegio |
| `partner_access_requests` | engagement, requester, purpose, requested permissions, starts/ends, status | FKs; duration max; no wildcard | Tenant y partner; audit; 7 años |
| `partner_access_approvals` | request, approver, decision, reason, decided_at | FKs; unique approver/request; decision check | Tenant owner/Tecdex según política; append-only |
| `partner_access_sessions` | request, user, session_hash, starts/expires/revoked, purpose, status | FKs; unique hash; expiry/revocation checks | Tenant+partner; token fuera de logs; 7 años metadata |
| `partner_opportunities` | partner, tenant nullable, stage, product/plan, amount/currency, owner, status | FKs; currency/date checks; unique external ref | Partner comercial; datos mínimos; 7 años |
| `partner_provisioning_requests` | opportunity/partner/tenant, requested plan, status, approved_by, idempotency_key | FKs; unique key; state checks | Tecdex autoritativo; no crea tenant sin aprobación |
| `partner_implementation_projects` | engagement, name, status, planned/actual dates, owner, acceptance_status | FKs; date/status checks | Tenant+partner; 7 años |
| `partner_implementation_tasks` | project, task_code, title, owner, due, status, evidence_id | FKs; unique project/code; closure requires evidence when configured | Tenant+partner; historial |
| `partner_implementation_milestones` | project, milestone_code, due, achieved, acceptance_by/at | FKs; unique project/code; acceptance checks | Tenant+partner; append history |
| `partner_support_tickets` | engagement, ticket_code, severity, status, requester, owner, opened/due/closed | FKs; unique code; SLA/date checks | Tenant+partner; 7 años |
| `partner_ticket_escalations` | ticket, level, reason, from/to team, escalated_at, resolved_at | FKs; level/status checks | Append-only; 7 años |
| `partner_slas` | engagement/service, metric, target, unit, calendar, version, status | FKs; target checks; unique active service/metric | Published immutable; permanente |
| `partner_managed_services` | engagement, service_code, cadence, owner, status, starts/ends | FKs; unique active service; date checks | Tenant+partner; 7 años |
| `partner_managed_service_tasks` | service, scheduled_for, owner, status, evidence, approval | FKs; unique service/schedule; closure checks | Tenant+partner; 7 años |
| `partner_integration_assignments` | engagement, tenant_integration, partner_user/team, permissions, starts/ends | FKs; unique active assignment; no secret-read permission | Tenant+partner; depends on Fase 6 |
| `partner_templates` | partner nullable/global, template_code, domain, status, owner | unique code/version scope; status checks | Catálogo; content versioned separately |
| `partner_template_versions` | template, version, content_ref/checksum, status, approved_by | FKs; unique version/checksum; published immutable | Retención permanente; contenido seguro |
| `partner_knowledge_articles` | partner nullable, article_code, title, body_ref, visibility, status/version | unique code/version; visibility check | No datos tenant; revisión editorial |
| `partner_notifications` | partner/user/engagement, type, payload sanitizado, status, sent/read timestamps | FKs; delivery/status checks | Partner; retención 2 años |
| `partner_scorecards` | partner, period, SLA/quality/security/satisfaction scores, trust, snapshot | FKs; scores 0..100; unique partner/period/version | Snapshot inmutable; 7 años |
| `partner_improvement_plans` | partner/scorecard, owner, due, status, evidence, verification | FKs; owner/due required; closure requires verification | Partner+Tecdex; 7 años |
| `partner_audit_events` | partner, tenant nullable, actor, action, resource, request/correlation, outcome, timestamp | FKs; immutable; índices partner/tenant/time | Append-only; mínimo 7 años |
| `partner_offboardings` | partner/engagement, reason, plan, status, revoke/transfer/complete timestamps, approved_by | FKs; state/date checks; one active per target | Permanente; job idempotente y evidencia de revocación |

## Políticas transversales

- RLS puede complementar, nunca reemplazar, tenant scope del backend.
- No hay cascadas destructivas sobre evidencia, mediciones, decisiones, accesos o auditoría.
- Los estados publicados son inmutables; una metodología cambia mediante nueva versión.
- Retención se parametriza por clase de dato y contrato; el cleanup genera auditoría.
- `metadata jsonb` no almacena claves, estados, permisos, fechas, owners o relaciones esenciales.
- Migraciones son aditivas, con preflight, checksum, advisory lock, ledger, postconditions e idempotencia.

## Implementación 5-C2

La decisión ejecutada reutiliza `data_snapshots` y `data_lineage_edges`, y crea `data_source_contracts`, `data_source_contract_versions`, `data_source_field_mappings`, `grc_observations`, `grc_observation_relations` y `metric_sufficiency_rules`. La migración aditiva es `20260803_phase5_c2_semantic_layer`; no reemplaza tablas operacionales ni históricos.
