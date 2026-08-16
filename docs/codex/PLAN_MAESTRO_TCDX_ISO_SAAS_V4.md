# PLAN MAESTRO INTEGRAL DE CIERRE, EVOLUCION Y SALIDA COMERCIAL - TCDX ISO SAAS V4
## Arquitectura AS-IS, arquitectura TO-BE, remediacion sin deuda, inteligencia GRC, RAG, Regulatory Intelligence, UX enterprise y produccion comercial
### Baseline tecnico original: 14 de agosto de 2026
### Revision de continuidad Codex: 16 de agosto de 2026
### Revision de validacion Codex: 16 de agosto de 2026 — FOCUSED_MINIMAL

**Producto:** TCDX ISO SaaS V4  
**Repositorio producto:** `Tecdex-SpA/tcdx-iso-saas-v4`  
**Repositorio visual de referencia:** `Tecdex-SpA/tecdex-design-system` - READ ONLY  
**Rama base:** `main`  
**Objetivo:** salida comercial oficial sin deuda funcional, tecnica, visual, de datos, seguridad, multi-tenant, IA, operacion ni trazabilidad.  
**Modo de ejecucion previsto:** tres cuentas Codex con presupuesto semanal limitado, trabajo particionado por dominio y contratos de integracion estables.  

# 0. CARACTER RECTOR DEL DOCUMENTO

- Este documento sustituye cualquier simplificacion anterior cuando exista evidencia mas reciente en el repositorio, PRs, CI o runtime.
- No autoriza reabrir funcionalidad cerrada sin nueva evidencia objetiva de defecto o regresion.
- No autoriza reconstruir motores ya existentes cuando la mejora puede implementarse por extension.
- Toda afirmacion de estado se clasifica como CONFIRMADO, PARCIAL, PROBLEMA CONFIRMADO, NO CONFIRMADO o OBJETIVO.
- Una tarea no se considera terminada por compilar: requiere contrato, pruebas, multi-tenant, RBAC cuando aplique, evidencia de no regresion y validacion runtime cuando corresponda.
- La prioridad es fidelidad del dato y del comportamiento; la estetica nunca puede maquillar un dato incorrecto.

# 1. FUENTES Y EVIDENCIA UTILIZADA

- `main` actual del repositorio TCDX ISO SaaS V4.
- `docs/final-phases/plan_maestro_ultimas_fases_tcdx_iso_saas_v4.md`.
- `docs/final-phases/phase6/*`.
- `docs/final-phases/pre-ui/01_official_metrics_source_reconciliation.md`.
- PR #91 `fix(metrics): reconcile control risk and maturity sources`, abierto al 14-08-2026.
- CI del PR #91: backend tests fallando en `sourceResolver.test.js` por contradiccion CONTROL-EFFECT; el resto del pipeline queda saltado despues del fallo.
- `backend/src/services/math-governance/*`.
- `backend/src/services/knowledge-base/*`.
- `backend/src/services/intelligence/*`.
- `backend/src/services/grc/*`.
- `ai-engine/app/routes/*` y `ai-engine/app/services/*`.
- `frontend/src/app/*` y trabajos de Fase 6 ya documentados.
- Instructivo maestro UI/UX y plan PRE-UI entregados en el proyecto.
- Plan funcional Fases 5 a 7 y plan de brechas frente a GlobalSuite usados como objetivos de producto, no como prueba de implementacion.

# 2. TAXONOMIA DE ESTADO

- **CONFIRMADO FUNCIONAL:** Existe implementacion visible y evidencia suficiente de pruebas/uso o cierre. Debe protegerse contra regresion.
- **PARCIAL:** Existe foundation o flujo util, pero faltan contratos, cobertura, integracion transversal, UX, runtime o DoD comercial.
- **PROBLEMA CONFIRMADO:** Existe evidencia concreta de error, CI rojo, inconsistencia o dato incorrecto.
- **NO CONFIRMADO:** No se encontro evidencia suficiente en el escaneo actual. No significa que no exista; exige auditoria antes de implementar.
- **OBJETIVO:** Capacidad TO-BE requerida para salida comercial o diferenciacion futura.

# 3. PRINCIPIOS NO NEGOCIABLES

- PostgreSQL conserva la verdad operacional; un LLM nunca se convierte en sistema de registro.
- No existe `null -> 0` para ocultar insuficiencia.
- No se usan datos demo en flujos MVP/productivos.
- No se codifican tenants, UUIDs, nombres de clientes, emails, periodos fijos ni datasets conocidos.
- No se requiere SQL manual por cliente para onboarding.
- RBAC y aislamiento tenant se validan con pruebas concretas.
- No se modifica infraestructura cerrada sin evidencia nueva y autorizacion.
- No se reintroduce `dashboard-v2` ni superficies legacy ya eliminadas.
- No se desactiva una prueba para hacer pasar un cambio; se reconcilia el contrato correcto.
- No se copia un score agregado en dimensiones que la fuente no publica.
- No se usa fallback legacy para esconder un adapter defectuoso.
- No se permite acceso SQL arbitrario del LLM a produccion.
- No se entrena automaticamente un modelo global con informacion privada de tenants.
- El repositorio `tecdex-design-system` es fuente visual de referencia y no debe modificarse desde este proyecto.
- Cada mejora debe ser backward-compatible o migrada explicitamente con pruebas.
- Cada nueva capacidad debe funcionar con tenant nuevo, tenant vacio, tenant parcial y al menos dos tenants con datasets distintos.
- Cada calculo oficial debe ser reproducible por fuente, periodo, version, lineage y snapshot.
- La IA puede detectar, explicar y recomendar; decisiones de cumplimiento, aceptacion de riesgo y cierres oficiales permanecen gobernados.

```text
BASELINE
  -> CAMBIO MINIMO
  -> TEST UNITARIO/CONTRATO
  -> TEST INTEGRACION
  -> TEST MULTI-TENANT
  -> TEST RBAC
  -> TEST E2E/UI SI APLICA
  -> DIFF ANTES/DESPUES
  -> CI VERDE
  -> MERGE
  -> DEPLOY
  -> VALIDACION RUNTIME
  -> CIERRE
```


# 3A. MECANISMO OBLIGATORIO DE CONTINUIDAD ENTRE CUENTAS CODEX

Este mecanismo es normativo para TODOS los work packages y prompts del programa.

## 3A.1 Ubicacion canonica
El Plan Maestro debe existir en:
`docs/codex/PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`

Debe existir tambien `AGENTS.md` en la raiz, instruyendo a Codex a leer siempre:
1. `docs/codex/PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`
2. `docs/codex/CURRENT_STATE.md`
3. `docs/codex/SHARED_BASELINE.md`
4. `docs/codex/WORK_QUEUE.md`
5. `docs/codex/DECISIONS.md`
6. el handoff del work package relacionado.

## 3A.2 Artefactos obligatorios
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/REGRESSION_COMMANDS.md`
- `docs/codex/handoffs/`

## 3A.3 Ownership fijo
- CODEX A — Data / Backend / GRC core
- CODEX B — AI / Knowledge / RAG / Regulatory
- CODEX C — Frontend / UX / Product E2E

## 3A.4 Handoff obligatorio
Cada work package crea/actualiza `docs/codex/handoffs/<WORK_PACKAGE_ID>.md` con:
- owner, branch, base SHA, head/commit SHA;
- objetivo completado;
- root cause/decision;
- archivos cambiados;
- contratos;
- migraciones;
- tests focales y completos;
- runtime validation;
- gates;
- fallas conocidas;
- deuda restante;
- siguiente accion exacta;
- archivos que la siguiente cuenta debe inspeccionar primero;
- archivos que NO debe inspeccionar salvo evidencia.

Debe incluir obligatoriamente:

### Do not rediscover
- decisiones VERIFIED;
- hechos confirmados;
- archivos ya auditados que no requieren relectura;
- enfoques descartados y motivo;
- contratos congelados.

## 3A.5 Regla de no-rescan
NO realizar repo-wide scan salvo work package de auditoria/inventario global.
Solo ampliar inspeccion si:
1. cambio un contrato compartido;
2. un merge posterior afecta directamente el trabajo;
3. un test contradice el handoff;
4. el handoff declara incertidumbre;
5. un archivo requerido cambio desde el SHA registrado;
6. existe evidencia de dependencia no documentada.

## 3A.6 Bloque inicial obligatorio en TODOS los prompts

```text
CONTINUIDAD OBLIGATORIA

Antes de analizar código:

1. Ejecuta:
   git status
   git rev-parse HEAD

2. Lee:
   docs/codex/CURRENT_STATE.md
   docs/codex/SHARED_BASELINE.md
   docs/codex/WORK_QUEUE.md
   docs/codex/DECISIONS.md

3. Lee el último handoff relacionado:
   docs/codex/handoffs/<ID>.md

4. NO realices repo-wide scan.

5. NO vuelvas a investigar decisiones que estén marcadas
   VERIFIED en esos documentos.

6. Sólo inspecciona inicialmente los paths indicados en el
   work package.

7. Si detectas contradicción entre código y handoff:
   detente, demuestra la contradicción y actualiza el baseline.
```

## 3A.7 Bloque final obligatorio en TODOS los prompts

```text
CIERRE OBLIGATORIO

Antes de terminar:

1. Actualiza el handoff del work package.
2. Actualiza CURRENT_STATE.md.
3. Actualiza WORK_QUEUE.md.
4. Si cambió un contrato:
   actualiza CONTRACTS_REGISTRY.md.
5. Si cambió arquitectura:
   actualiza ARCHITECTURE_MAP.md.
6. Si hubo una decisión nueva:
   registra ADR en DECISIONS.md.
7. Indica exactamente:
   - commit
   - tests
   - gates
   - deuda restante
   - siguiente acción
```

## 3A.8 Precedencia
Si un prompt futuro omite estas reglas, prevalece este Plan Maestro.
Antes de PUI-01, UI-01 o cualquier work package productivo debe completarse `CONT-00`.



# 3B. POLITICA OBLIGATORIA DE VALIDACION CODEX — FOCUSED_MINIMAL

A partir de esta revision, TODOS los work packages ejecutados por cualquiera de las tres cuentas Codex deben aplicar obligatoriamente:

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`

El objetivo es reducir consumo semanal de Codex y reservar su capacidad para analisis focal, implementacion y handoff, dejando al responsable del proyecto la ejecucion manual de CI, merge, deploy y validaciones extensas.

## NO ejecutar automaticamente con Codex

- full CI
- full regression
- repeated test cycles
- push
- merge
- deploy

Tambien queda prohibido consumir presupuesto Codex en ciclos reiterativos de:

`cambio -> suite extensa -> fallo -> correccion -> suite extensa -> nuevo fallo`

salvo que el work package haya sido creado especificamente para reparar un fallo concreto y el responsable del proyecto autorice ampliar validacion.

## SI debe hacer Codex

- continuity files
- focused paths
- implementation
- diff review
- max 1 focal test when useful
- handoff
- atomic commit

## Interpretacion operativa

### Continuity files
Codex debe leer y actualizar, segun corresponda:

- `docs/codex/CURRENT_STATE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/handoffs/<ID>.md`

### Focused paths
Codex debe comenzar exclusivamente por los paths definidos en el work package y handoff. No debe ampliar la inspeccion salvo evidencia objetiva de dependencia.

### Implementation
Codex debe completar la unidad mergeable definida por el work package, evitando refactors oportunistas y trabajo fuera de alcance.

### Diff review
Antes de cerrar, Codex debe revisar el diff generado para detectar:
- cambios fuera de alcance;
- hardcode;
- archivos productivos no esperados;
- eliminaciones accidentales;
- modificaciones de contratos no documentadas;
- cambios de tests para ocultar errores.

### Max 1 focal test when useful
Codex puede ejecutar como maximo una prueba focal rapida directamente relacionada con el cambio cuando exista y aporte valor.

Si no existe un test focal claro o ejecutarlo implica una suite extensa:
- NO debe inventar una validacion costosa;
- debe documentar la validacion pendiente para el usuario.

### Handoff
Cada work package debe terminar con handoff completo, incluyendo:
- cambios;
- decisiones;
- archivos;
- contratos;
- prueba focal ejecutada o no ejecutada;
- validaciones manuales pendientes;
- `Do not rediscover`;
- deuda restante;
- siguiente accion exacta.

### Atomic commit
Codex debe crear un commit atomico del work package cuando el cambio este listo.

Codex NO debe:
- push;
- abrir/mergear PR;
- mergear;
- desplegar.

## Responsabilidad manual del usuario

El responsable del proyecto ejecutara manualmente, cuando corresponda:

1. revision adicional del diff;
2. push;
3. apertura/actualizacion de PR;
4. CI;
5. regression completa;
6. merge;
7. deploy;
8. validacion runtime/post-deploy.

Si CI, regression o runtime falla:

1. detener nuevos reintentos Codex sobre ese fallo;
2. analizar el error en ChatGPT;
3. determinar causa probable y alcance;
4. solo si corresponde, generar un work package correctivo Codex focalizado.

## Regla de cierre

Ningun prompt Codex debe declarar falsamente:

`FULL_REGRESSION = PASS`
`CI = PASS`
`DEPLOY = PASS`

si esas acciones no fueron ejecutadas.

En su lugar debe reportar:

`CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`
`FOCAL_TEST = PASS | FAIL | NOT_RUN`
`FULL_CI = NOT_RUN_BY_DESIGN`
`FULL_REGRESSION = NOT_RUN_BY_DESIGN`
`PUSH = NOT_RUN_BY_DESIGN`
`MERGE = NOT_RUN_BY_DESIGN`
`DEPLOY = NOT_RUN_BY_DESIGN`
`MANUAL_VALIDATION_PENDING = YES`

## Precedencia

Esta politica reemplaza cualquier instruccion previa del Plan Maestro que obligue a Codex a ejecutar automaticamente:
- CI completo;
- regression completa;
- suites repetitivas;
- merge;
- push;
- deploy;
- runtime validation extensa.

Las pruebas completas siguen siendo parte de la Definition of Done del producto, pero pasan a ser responsabilidad manual del responsable del proyecto o de un work package correctivo expresamente autorizado.


# 4. ARQUITECTURA AS-IS VERIFICADA

```text
Frontend web (frontend/src/app)
        |
        v
Backend Node/Express
        |
        +--> PostgreSQL / dominios operacionales
        |
        +--> math-governance
        |      +--> source contracts
        |      +--> source resolver/adapters
        |      +--> dataset validation
        |      +--> formula registry/execution
        |      +--> official calculation orchestrator
        |      +--> snapshots / lineage / decision interpretation
        |
        +--> GRC services
        |      +--> rules
        |      +--> workflows/approvals
        |      +--> observability
        |      +--> exports/imports/runtime adapters
        |
        +--> Knowledge Base v2
        |      +--> knowledge_items/rules/...
        |      +--> structured search
        |      +--> matching/coverage/licensing guardrails
        |
        +--> Intelligence services
               +--> rules
               +--> confidence/evidence strength
               +--> explainability
               +--> next best actions
               +--> prompt builder
               +--> AI orchestrator
               +--> deterministic fallback
               +--> audit traces
                    |
                    v
              AI Engine Python/FastAPI
                    +--> AI routes
                    +--> audit documents
                    +--> SoA
                    +--> Senior Auditor
                    +--> Beta-PERT operational risk
                    +--> context builder / ai_core
                    +--> domain knowledge/playbooks
                    +--> external lookup / trusted sources / Brave Search
                    +--> model provider layer (runtime previously audited with Ollama; revalidate before changing)
```

# 5. INVENTARIO DE CAPACIDADES AS-IS Y DEUDA REAL

### 5.X - Frontend App Router y superficies funcionales
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Existe un conjunto amplio de rutas en `frontend/src/app` para acciones, activos, auditorias, BI, BIA, conectores, configuracion, continuidad, controles y otros dominios.
**Tratamiento:** No remodelar rutas a ciegas. Inventariar por workspace y consolidar UX sin eliminar capacidades ni romper deep links.

### 5.X - Responsive Fase 6.2
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Existe documentacion y rama historica de trabajo responsive.
**Tratamiento:** Usarlo como baseline de regresion durante UI 1/4-4/4; no reimplementar desde cero.

### 5.X - Sidebar/navegacion/RBAC Fase 6.3
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Trabajo documentado de navegacion condicionada por permisos/capacidades.
**Tratamiento:** La nueva IA y Regulatory Intelligence deben entrar por el mismo sistema de capacidades, no con menus hardcodeados.

### 5.X - KPI product reconciliation Fase 6.4
**Estado:** CONFIRMADO FUNCIONAL CON DEUDA PRE-UI
**Realidad observada:** La capa producto consume metricas oficiales, pero las fuentes de algunas formulas aun presentan vacios de normalizacion.
**Tratamiento:** Cerrar PRE-UI antes de considerar confiables todas las superficies analiticas.

### 5.X - Functional flows/UX states Fase 6.5
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Estados UX trabajados.
**Tratamiento:** Preservar y normalizar nuevos estados de RAG/IA/regulatorio usando el mismo lenguaje de producto.

### 5.X - Commercial multi-tenant Fase 6.6
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Existe trabajo de aislamiento comercial multi-tenant.
**Tratamiento:** Todo nuevo objeto de knowledge, observation, graph, regulation y memory debe usar tenant scope desde diseño.

### 5.X - Dashboard-v2 legacy
**Estado:** RETIRADO/PROTEGIDO
**Realidad observada:** La superficie V2 fue eliminada en cleanup previo.
**Tratamiento:** No reintroducir ni crear un nuevo dashboard paralelo; consolidar sobre superficies oficiales.

### 5.X - Math Governance - formula registry
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** 53 formulas y alta cobertura de tests observada en CI.
**Tratamiento:** No cambiar pesos/expresiones durante PRE-UI; resolver semantica de fuente antes de tocar formula.

### 5.X - Math Governance - source contracts
**Estado:** CONFIRMADO/PARCIAL
**Realidad observada:** Existe `sourceContracts.service.js` con bindings por formula.
**Tratamiento:** Fortalecer contratos de unidad, escala, elegibilidad, temporalidad y semantica sin tenant-specific branching.

### 5.X - Math Governance - source resolver
**Estado:** PROBLEMA CONFIRMADO EN PRE-UI
**Realidad observada:** Resolver amplio y complejo; PR #91 corrige CONTROL-EFFECT, RISK-INHERENT y MATURITY pero CI esta rojo.
**Tratamiento:** Hacer reconciliacion por contrato; test de no fabricacion de dimensiones; separar rows fisicas/elegibles; metadata de escalas.

### 5.X - Dataset validation
**Estado:** CONFIRMADO/PARCIAL
**Realidad observada:** Existe validador y correcciones de timestamp/exclusiones del PR #90.
**Tratamiento:** Agregar invariantes sistematicas: usable<=received, excluded<=received, issue_count separado, canonical event time y period semantics por dominio.

### 5.X - Official calculation orchestrator
**Estado:** CONFIRMADO FUNCIONAL
**Realidad observada:** Clasifica source incompatibility, insufficient data y dependencias; persiste calculos/snapshots cuando corresponde.
**Tratamiento:** Extender para observations/eventos despues de PRE-UI sin insertar un camino paralelo.

### 5.X - Decision interpretation
**Estado:** CONFIRMADO FOUNDATION
**Realidad observada:** Entrega severidad, causa, impacto, recomendacion, accion, data quality y trend.
**Tratamiento:** Las causas/recomendaciones son todavia genericas por dominio; evolucionar a Gap/Impact context sin eliminar fallback deterministico.

### 5.X - GRC rules/workflows/approvals
**Estado:** CONFIRMADO FOUNDATION
**Realidad observada:** Existen reglas, approvals, scheduler, observability y tests.
**Tratamiento:** Usarlos para Human-in-the-Loop y cierres gobernados; no crear un segundo workflow engine.

### 5.X - Knowledge Base v2
**Estado:** CONFIRMADO FOUNDATION
**Realidad observada:** Existe repository/search/service/coverage/guardrails y matching de control/evidence/risk/finding/action.
**Tratamiento:** Evolucionar a RAG hibrido; no reemplazar esta KB.

### 5.X - Vector RAG
**Estado:** NO CONFIRMADO / FALTA
**Realidad observada:** La busqueda observada usa filtros estructurados e ILIKE; no se encontro pgvector/embeddings/reranking en esa capa.
**Tratamiento:** Implementar ingestion, chunking, embeddings, pgvector, hybrid retrieval, reranking y citations manteniendo metadata de KB.

### 5.X - Tenant document learning
**Estado:** PARCIAL
**Realidad observada:** Existen rutas documentales en AI Engine y extractores especializados.
**Tratamiento:** Generalizar ingestion segura tenant-scoped y conectar al RAG privado con versionado/vigencia.

### 5.X - Intelligence Engine backend
**Estado:** CONFIRMADO FOUNDATION AVANZADO
**Realidad observada:** Existen rules, confidence, evidence-strength, explainability, guardrails, prompt builder, next best actions, audit log y orchestrator.
**Tratamiento:** Integrar con observations, Impact Graph, RAG y operational memory; no crear motor paralelo.

### 5.X - AI structured narratives
**Estado:** CONFIRMADO FOUNDATION
**Realidad observada:** AI orchestrator valida salida, exige knowledge basis, registra trace y usa fallback deterministico.
**Tratamiento:** Agregar policy/version governance, evaluation set, source citations y decision lifecycle.

### 5.X - AI Engine routes
**Estado:** CONFIRMADO
**Realidad observada:** Existen rutas generales, audit documents, convivencia, Beta-PERT, Senior Auditor y SoA.
**Tratamiento:** Consolidar contratos y utilizar un Context Builder comun donde aplique.

### 5.X - AI Core context builder
**Estado:** CONFIRMADO FOUNDATION
**Realidad observada:** Existen vistas/contextos tenant/control/finding y tablas ai_core de problem types, priority rules, playbooks, evidence expectations, closure criteria, etc.
**Tratamiento:** Reconciliar con la KB backend para evitar dos ontologias divergentes; documentar ownership de cada capa.

### 5.X - External web lookup
**Estado:** CONFIRMADO PARCIAL
**Realidad observada:** Existe `trusted_external_sources`, plan de lookup, logs y ejecucion Brave Search con allowlist de dominios.
**Tratamiento:** Elevarlo a authoritative-source ingestion versionada; no depender de resultados web efimeros para verdad regulatoria.

### 5.X - Regulatory Intelligence
**Estado:** NO CONFIRMADO COMO PACK COMPLETO
**Realidad observada:** No se encontro un motor generico de RegulationVersion/LegalObligation/Applicability completo para Ley 21.719.
**Tratamiento:** Construir capa regulatoria versionada sobre KB+Intelligence+web trusted sources.

### 5.X - Operational Memory
**Estado:** PARCIAL
**Realidad observada:** Existen snapshots, audit traces, acciones y resultados operacionales, pero no un ciclo formal recommendation->decision->action->effectiveness->memory.
**Tratamiento:** Implementar memoria por tenant y retrieval de casos similares sin fine-tuning cross-tenant.

### 5.X - Impact Graph transversal
**Estado:** NO CONFIRMADO COMO MOTOR CANONICO
**Realidad observada:** Existen relaciones GRC dispersas, pero no se confirmo un grafo canónico transitable de extremo a extremo.
**Tratamiento:** Auditar relaciones existentes y construir graph layer sobre IDs reales; evitar duplicar relaciones.

### 5.X - Reporting/exports
**Estado:** CONFIRMADO/PARCIAL
**Realidad observada:** Existen servicios y pruebas de export/reporting de Fase 5.
**Tratamiento:** Revalidar que consuman metricas oficiales y no pipelines paralelos antes de cierre comercial.

### 5.X - CI
**Estado:** PROBLEMA CONFIRMADO ACTUAL
**Realidad observada:** PR #91 falla en backend test; resto de jobs queda skipped.
**Tratamiento:** No mergear hasta reconciliar contrato y recuperar pipeline completo verde.

### 5.X - UI remodelacion enterprise
**Estado:** INICIAL
**Realidad observada:** Existe prompt/instructivo maestro y objetivo visual; la ejecucion nueva esta en etapa inicial.
**Tratamiento:** Trabajar en paralelo solo foundation visual mientras PRE-UI no cierre; no fabricar KPIs ni estados.

# 6. ARQUITECTURA TO-BE

```text
FUENTES OPERACIONALES REALES
        |
        v
SOURCE CONTRACT + ADAPTER + NORMALIZACION
        |
        v
ELIGIBILIDAD + SUFICIENCIA + DATA TRUST
        |
        v
FORMULA/CALCULO OFICIAL
        |
        v
MEASUREMENT + SNAPSHOT + LINEAGE
        |
        +-------------------------------+
        |                               |
        v                               v
GRC OBSERVATION ENGINE           KNOWLEDGE PLATFORM
        |                         + Global GRC
        v                         + Regulatory
GRC GAP MODEL                    + Tenant private docs
        |                         + Operational memory
        v                               |
IMPACT GRAPH <--------------------------+
        |                               |
        v                               v
PRIORITY ENGINE                 HYBRID RAG
        |                      vector + full text + metadata
        |                      + graph + authority + recency
        +---------------+---------------+
                        |
                        v
              GRC INTELLIGENCE ENGINE
              + deterministic rules
              + time series
              + anomaly/pattern engine
              + similarity/case retrieval
              + LLM reasoning/explanation
                        |
                        v
                  HUMAN DECISION
                        |
                        v
                  ACTION/WORKFLOW
                        |
                        v
                EVIDENCE + RETEST
                        |
                        v
              EFFECTIVENESS / OUTCOME
                        |
                        +----> OPERATIONAL MEMORY

REGULATORY SOURCES OFFICIAL WEB
        -> Source Registry
        -> immutable ingestion/version
        -> semantic diff
        -> human review/publish
        -> Regulatory Pack
        -> Impact Graph / Applicability / RAG
```


# 6A. CONT-00 — CODEX CONTINUITY BOOTSTRAP

**Owner:** CODEX A  
**Estado:** obligatorio antes de cualquier work package productivo.

Objetivo: instalar la memoria compartida de las tres cuentas sin modificar codigo productivo.

Crear:
- `AGENTS.md`
- `docs/codex/PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/SHARED_BASELINE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/ARCHITECTURE_MAP.md`
- `docs/codex/REGRESSION_COMMANDS.md`
- `docs/codex/handoffs/CONT-00.md`

Reglas:
1. No modificar backend, frontend, AI Engine, DB productiva ni infraestructura.
2. Instalar este Plan Maestro como unica fuente canonica en `docs/codex/PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`.
3. Inicializar artefactos solo con hechos confirmados; lo no comprobable se marca `NO CONFIRMADO`.
4. Registrar ownership fijo A/B/C.
5. `WORK_QUEUE.md` debe incluir CONT-00 y los work packages del Plan Maestro con dependencias.
6. El handoff CONT-00 debe incluir `Do not rediscover`.
7. Commit atomico documental.

Gate:
- `CODEX_CONTINUITY_BOOTSTRAP = PASS`
- `PRODUCT_CODE_CHANGED = NO`
- `MASTER_PLAN_CANONICAL_PATH = PASS`
- todos los artefactos obligatorios creados.

# 7. WORKSTREAM PRE-UI - CIERRE DE VERDAD DE DATOS

### PUI-01 - Reconciliar PR #91 y recuperar CI completo

**Estado de partida:** PROBLEMA CONFIRMADO  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Resolver la contradiccion CONTROL-EFFECT y devolver el pipeline completo a verde.

**Realidad actual / baseline**
PR #91 esta abierto y backend tests fallan en `sourceResolver.test.js`; jobs posteriores no alcanzan ejecucion.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `backend/src/services/math-governance/formulaRegistry.service.js`
- `backend/src/services/math-governance/phase5Package3.test.js`

**Implementacion requerida - orden obligatorio**
1. Reproducir exactamente el test que falla en la rama del PR antes de editar.
2. Documentar el contrato deseado: composite score puede ser input valido solo como score agregado y nunca como cuatro dimensiones fabricadas.
3. Alinear `sourceResolver.service.js`, `sourceResolver.test.js`, `formulaRegistry.service.js` y `phase5Package3.test.js` con un unico contrato.
4. Si la formula oficial exige dimensiones, decidir con evidencia si el input agregado es una modalidad soportada por la formula o una formula distinta; no hacer coercion silenciosa.
5. Ejecutar backend test completo, luego pipeline Phase 5/5.5 y frontend/E2E.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] CI_PR91 = PASS
- [ ] CONTROL_EFFECT_DIMENSION_FABRICATION = 0
- [ ] PHASE5_REGRESSION = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-02 - Contrato canonico de escala y unidades

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Eliminar ambiguedad entre score, ratio, porcentaje, nivel 0..5, horas y otras unidades.

**Realidad actual / baseline**
MATURITY requirio normalizacion de 0..100 a 0..5; otros dominios pueden repetir el problema si la escala se infiere por valor.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`

**Implementacion requerida - orden obligatorio**
1. Agregar metadata de `source_scale`, `source_unit`, `target_scale`, `target_unit` donde el contrato lo requiera.
2. Crear normalizadores genericos por tipo de escala, nunca por tenant.
3. Rechazar valores ambiguos cuando no exista metadata suficiente; no adivinar por magnitud salvo regla global documentada.
4. Persistir metadata de transformacion en lineage/snapshot.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] UNIT_SEMANTICS = PASS
- [ ] SCALE_NORMALIZATION = PASS
- [ ] AMBIGUOUS_SCALE_GUESSING = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-03 - Poblacion fisica, elegible y utilizable

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Definir contabilidad unica para received, eligible, usable, excluded e issue count.

**Realidad actual / baseline**
PR #90 corrigio excludedCount; PR #91 trabaja RISK-INHERENT para separar filas fisicas y elegibles.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`

**Implementacion requerida - orden obligatorio**
1. Definir contrato transversal de counts y aplicarlo a todos los source adapters.
2. `received` = filas fisicas leidas del universo correcto; `eligible` = filas dentro de scope semantico; `usable` = filas con inputs validos; `excluded` = received-usable o definicion documentada consistente.
3. Mantener `exclusionIssueCount` separado para multiples defectos por fila.
4. Exponer exclusiones auditables con source record y reason code.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] COUNT_INVARIANTS = PASS
- [ ] EXCLUDED_GT_RECEIVED = 0
- [ ] AUDITABLE_EXCLUSIONS = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-04 - Semantica temporal por dominio

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Evitar que period filtering elimine entidades vigentes o use fechas auxiliares incorrectas.

**Realidad actual / baseline**
PR #90 establecio `__event_time` canónico y tratamiento especial para riesgo vigente.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/sourceResolver.service.js`

**Implementacion requerida - orden obligatorio**
1. Clasificar cada source contract como event stream, state snapshot, validity interval o latest-effective-state.
2. Definir `effective_at`, `valid_from`, `valid_to` o `event_time` segun clase.
3. Prohibir aplicar generic created_at filtering a stateful entities sin semantica temporal explicita.
4. Agregar tests cruzando registros creados antes del periodo pero vigentes durante el periodo.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] TEMPORAL_SEMANTICS = PASS
- [ ] FALSE_EMPTY_BY_PERIOD = 0
- [ ] CANONICAL_EVENT_TIME = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-05 - Normalizacion de estados por dominio

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Eliminar traducciones inconsistentes de status que cambian elegibilidad o interpretacion.

**Realidad actual / baseline**
Existen normalizaciones ad hoc en varios adapters y el PRE-UI original identifica estados como fuente de errores.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceContracts.service.js`

**Implementacion requerida - orden obligatorio**
1. Crear diccionario/versionado por dominio para estados canonicos.
2. No usar un unico set generico cuando el significado difiere entre evidence, control, audit, continuity, supplier, finding y risk.
3. Mapear estado de origen -> estado canonico + reason + version.
4. Agregar unknown/unmapped visible y no convertirlo silenciosamente a pending/compliant.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] STATUS_NORMALIZATION = PASS
- [ ] UNKNOWN_STATUS_SILENT_MAPPING = 0
- [ ] STATUS_VERSIONING = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-06 - Fallback legacy gobernado

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Mantener compatibilidad legacy sin permitir que oculte defectos de fuente primaria.

**Realidad actual / baseline**
PR #90 aclaro que el fallback ocurre por ausencia de filas primarias en periodo, no por filas inutilizables.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/sourceResolver.service.js`

**Implementacion requerida - orden obligatorio**
1. Formalizar policy: fallback solo si primary source no existe/no tiene filas segun contrato y el fallback esta explicitamente permitido.
2. No ejecutar fallback ante contract_invalid, source_incompatible o 100% excluded por bug.
3. Registrar `physical_source`, `fallback_reason`, `primary_state` y warning.
4. Agregar metricas de uso de fallback para identificar deuda residual.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] LEGACY_FALLBACK_POLICY = PASS
- [ ] FALLBACK_MASKING_BUG = 0
- [ ] FALLBACK_OBSERVABILITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-07 - Provenance, snapshots y Data Trust completos

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Garantizar que todo KPI oficial calculado tenga cadena de evidencia suficiente y que Data Trust no sea cosmetico.

**Realidad actual / baseline**
Existen lineage/snapshots, pero historicamente hubo calculation_run_id null y source_snapshot_ids vacios en casos con datos.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance/calculationLineage.service.js`
- `backend/src/services/math-governance/calculationSnapshot.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`

**Implementacion requerida - orden obligatorio**
1. Auditar por formula los campos de provenance obligatorios.
2. No marcar `ready` una fuente si falta metadata requerida para reproducir el calculo.
3. Persistir source snapshot antes o junto con official calculation de forma transaccional cuando aplique.
4. Exponer Data Trust basado en counts, freshness, completeness, consistency y lineage real.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PROVENANCE_CHAIN = PASS
- [ ] SOURCE_SNAPSHOT_CHAIN = PASS
- [ ] DATA_TRUST_REPRODUCIBLE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-08 - Matriz de 22+ indicadores oficiales

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Revalidar todos los indicadores oficiales contra fuente real, no solo los tres del PR #91.

**Realidad actual / baseline**
El plan funcional exige reconciliacion completa y el motor posee decenas de formulas.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance`
- `docs/final-phases/indicators`

**Implementacion requerida - orden obligatorio**
1. Construir matriz machine-readable por formula: business concept, source code, physical sources, temporal semantics, fields, scale, eligibility, sufficiency, dependencies, expected unit.
2. Ejecutar fixtures de empty/partial/sufficient y dos tenants por formula.
3. Comparar consumers: dashboard, BI, metrics, reports, exports.
4. Clasificar cualquier discrepancia como source, normalization, formula input, persistence o consumer bug.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] OFFICIAL_INDICATOR_MATRIX = COMPLETE
- [ ] CROSS_VIEW_CONSISTENCY = PASS
- [ ] FALSE_UNMEASURED = 0_FOR_SUFFICIENT_FIXTURES

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### PUI-09 - Validacion runtime post-deploy PRE-UI

**Estado de partida:** PENDIENTE  
**Cuenta Codex primaria sugerida:** Codex A  

**Objetivo**
Cerrar PRE-UI con evidencia en runtime y no solo con CI.

**Realidad actual / baseline**
La propia documentacion del PR #90 declara runtime productivo como validacion posterior al merge/deploy.

**Zonas de codigo a inspeccionar primero**
- `scripts/validation`
- `backend/src/services/math-governance`

**Implementacion requerida - orden obligatorio**
1. Ejecutar recalculate oficial en tenant(s) de aceptacion autorizados sin insertar datos manuales.
2. Capturar counts, sources, exclusions, calculation run, snapshots, values y consumers.
3. Comparar antes/despues para indicadores corregidos.
4. Confirmar que un tenant distinto produce resultados coherentes y diferentes segun su dataset.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PRE_UI_RUNTIME = PASS
- [ ] SELLABLE_MULTI_TENANT = PASS
- [ ] PRE_UI_DATA_TRUTH_GATE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

# 8. WORKSTREAM UI/UX 1/4-4/4 - REMODELACION VISUAL SIN ALTERAR LOGICA

### UI-01 - Inventario visual y funcional de todas las rutas

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Mapear cada vista, rol, capability, API y estado antes de mover componentes.

**Realidad actual / baseline**
El frontend posee numerosas rutas y el trabajo de remodelacion nueva esta en inicio.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/app`
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Generar inventario de routes -> workspace -> roles -> plan -> APIs -> componentes.
2. Marcar vistas duplicadas/candidatas a consolidacion sin eliminarlas aun.
3. Identificar dependencias con metricas PRE-UI y bloquear redesign analitico de esas secciones hasta Data Truth Gate.
4. Guardar inventario versionado para que las tres cuentas Codex no repitan el escaneo.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] UI_ROUTE_INVENTORY = COMPLETE
- [ ] NO_ROUTE_LOST = PASS
- [ ] CODEX_RESCAN_REDUCTION_ARTIFACT = CREATED

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-02 - Foundation visual TECDEX

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Crear tokens y primitives reutilizables alineados al design system de solo lectura.

**Realidad actual / baseline**
Existe instructivo visual detallado y referencia externa; no debe modificarse el repo de diseño.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/styles`
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Extraer tokens autorizados: typography, spacing, radius, elevation, semantic states, surfaces.
2. Implementar tokens en producto sin copiar deuda o componentes innecesarios.
3. Crear primitives: PageHeader, Section, KPI Card, StatusBadge, EmptyState, ErrorState, Skeleton, DataTable shell, FilterBar.
4. Mantener contraste, keyboard navigation y responsive.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] DESIGN_SYSTEM_ALIGNMENT = PASS
- [ ] DESIGN_REPO_MODIFIED = NO
- [ ] A11Y_FOUNDATION = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-03 - App Shell y navegacion enterprise

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Modernizar shell sin romper RBAC, capability UI ni rutas existentes.

**Realidad actual / baseline**
Navegacion/RBAC de Fase 6.3 esta protegida.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/components`
- `frontend/src/app`

**Implementacion requerida - orden obligatorio**
1. Reutilizar fuente de autorizacion actual.
2. Consolidar grupos de navegacion por workspace sin hardcode de tenant.
3. Preservar deep links y breadcrumbs.
4. Validar Plan 1/2/3 y roles representativos.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] RBAC_NAV_REGRESSION = 0
- [ ] CAPABILITY_DRIVEN_UI = PASS
- [ ] DEEP_LINKS = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-04 - Centro Ejecutivo

**Estado de partida:** BLOQUEADO PARCIAL POR PRE-UI  
**Cuenta Codex primaria sugerida:** Codex C  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE  

**Objetivo**
Crear experiencia ejecutiva basada exclusivamente en KPI oficiales confiables.

**Realidad actual / baseline**
No se deben fabricar tendencias o KPIs mientras Data Truth no cierre.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/app/dashboard`
- `frontend/src/app/bi`

**Implementacion requerida - orden obligatorio**
1. Diseñar layout y componentes con estados reales empty/loading/error/insufficient.
2. Conectar solo endpoints oficiales existentes tras PRE_UI_DATA_TRUTH_GATE.
3. Mostrar que requiere atencion, tendencia, confianza, causa e impacto sin exponer formulas como contenido principal.
4. Drill-down hacia fuente/entidad real.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] EXECUTIVE_DATA_INTEGRITY = PASS
- [ ] FAKE_KPI = 0
- [ ] DRILLDOWN = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-05 - Workspaces GRC consolidados

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Reducir fragmentacion visual manteniendo capacidades.

**Realidad actual / baseline**
El prompt visual objetivo define consolidacion por Centro Ejecutivo, Cumplimiento, Auditorias, Remediacion, Continuidad, Integraciones, Datos, Metricas, Reporting y Configuracion.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/app`

**Implementacion requerida - orden obligatorio**
1. Crear mapa de migracion vista actual -> workspace destino.
2. No eliminar endpoint ni ruta hasta tener redirect/compatibilidad y tests.
3. Usar tabs/subroutes solo cuando reduzcan carga cognitiva.
4. Mantener acciones primarias visibles y detalle tecnico secundario.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] WORKSPACE_CONSOLIDATION = PASS
- [ ] FUNCTIONALITY_LOST = 0
- [ ] ROUTE_COMPATIBILITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-06 - Visualizacion de datos y charts

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE for official metrics  

**Objetivo**
Aplicar reglas analiticas correctas y consistentes.

**Realidad actual / baseline**
El prompt maestro define barras, lineas, heatmaps, Beta-PERT, KPI, donut, progress, scatter, tooltips, legends y estados.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Crear chart decision matrix por tipo de dato.
2. No usar pie/donut cuando la cardinalidad o comparacion lo desaconseje.
3. Usar series temporales solo con periodos comparables reales.
4. Mostrar source/confidence en contexto cuando el grafico soporte decisiones.
5. Agregar no-data e insufficient-data states diferenciados.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] ANALYTICAL_INTEGRITY = PASS
- [ ] CHART_STATE_COVERAGE = PASS
- [ ] RESPONSIVE_CHARTS = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-07 - Tablas, filtros y densidad enterprise

**Estado de partida:** INICIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Unificar tablas sin perder operaciones existentes.

**Realidad actual / baseline**
Existen multiples modulos con patrones de tabla potencialmente distintos.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Crear DataTable primitive con sorting/filtering/pagination/accessibility.
2. Preservar acciones row-level y bulk solo donde RBAC lo permita.
3. No ocultar columnas necesarias para auditoria; mover detalle tecnico a panel secundario si procede.
4. Persistir filtros solo si no filtran accidentalmente otro tenant/contexto.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] TABLE_CONSISTENCY = PASS
- [ ] ROW_ACTION_RBAC = PASS
- [ ] DATA_VISIBILITY_REGRESSION = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-08 - Estados UX universales

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Normalizar loading, empty, insufficient, blocked, permission denied, degraded AI, source unavailable y error.

**Realidad actual / baseline**
Fase 6.5 ya trabajo estados; nuevas capacidades deben extenderlos.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Reusar taxonomia existente cuando sea compatible.
2. Diferenciar `sin datos` de `datos insuficientes` y `fuente incompatible`.
3. Diferenciar IA no disponible de calculo deterministico no disponible.
4. Nunca mostrar cero como sustituto visual de null/insufficient.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] UX_STATE_TAXONOMY = PASS
- [ ] NULL_ZERO_VISUAL_CROSSOVER = 0
- [ ] ERROR_ACTIONABILITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-09 - Responsive y accesibilidad final

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Cerrar experiencia desktop/tablet/mobile sin regresion.

**Realidad actual / baseline**
Responsive previo existe pero el rediseño cambia densidad/layout.

**Zonas de codigo a inspeccionar primero**
- `frontend/src/app`
- `frontend/src/components`

**Implementacion requerida - orden obligatorio**
1. Ejecutar breakpoints definidos por producto, no por tenant.
2. Validar keyboard, focus, labels, contrast, reduced motion donde aplique.
3. Evitar tablas inutilizables en mobile; usar responsive patterns sin esconder informacion critica.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] RESPONSIVE_FINAL = PASS
- [ ] A11Y_CORE = PASS
- [ ] MOBILE_CRITICAL_FLOWS = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### UI-10 - QA visual automatizable

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex C  

**Objetivo**
Evitar regresiones visuales mientras se trabaja con varias cuentas Codex.

**Realidad actual / baseline**
Tres cuentas trabajando en paralelo elevan riesgo de drift visual.

**Zonas de codigo a inspeccionar primero**
- `frontend/tests`
- `frontend/src`

**Implementacion requerida - orden obligatorio**
1. Definir paginas centinela por workspace y plan.
2. Agregar screenshots/E2E deterministas donde la infraestructura permita.
3. Comparar shell, nav, tables, forms, charts y states en cada merge significativo.
4. No hacer snapshots de datos volatiles sin fixtures estables.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] VISUAL_SENTINELS = PASS
- [ ] CROSS_ACCOUNT_STYLE_DRIFT = 0
- [ ] UI_REGRESSION_EVIDENCE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

# 9. FASE 6 AMPLIADA - INTELIGENCIA GRC SOBRE VERDAD OPERACIONAL

### 6.8-01 - GRC Observation Model

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE  

**Objetivo**
Convertir cambios confiables de measurement/snapshot en observaciones GRC tipadas y auditables.

**Realidad actual / baseline**
Existe math-governance y observability, pero no se confirmo un modelo transversal de GrcObservation.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/math-governance`
- `backend/src/services/grc`

**Implementacion requerida - orden obligatorio**
1. Definir schema/event contract con tenant_id, observation_type, entity, current/previous, period, source snapshots, data trust, correlation id.
2. Emitir observaciones desde el orchestrator o outbox despues de persistencia oficial, no desde el LLM.
3. Implementar idempotencia por observation key/hash.
4. No generar observacion de deterioro cuando el dato esta insufficient/source_incompatible.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] OBSERVATION_MODEL = PASS
- [ ] OBSERVATION_IDEMPOTENCY = PASS
- [ ] FALSE_OBSERVATION_FROM_BAD_DATA = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.8-02 - Transactional Outbox para intelligence events

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** 6.8-01  

**Objetivo**
Desacoplar procesamiento continuo sin introducir Kafka prematuramente.

**Realidad actual / baseline**
No se confirmo event bus dedicado; PostgreSQL es suficiente para escala inicial.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services`
- `backend/migrations`

**Implementacion requerida - orden obligatorio**
1. Crear outbox tenant-scoped con event type, aggregate, payload ref, status, attempts, created/processed timestamps.
2. Escribir outbox en la misma transaccion del hecho cuando sea necesario.
3. Worker con retry/backoff/idempotencia y dead-letter visible.
4. No almacenar payload sensible innecesario; preferir IDs/snapshots.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] OUTBOX_ATOMICITY = PASS
- [ ] RETRY_IDEMPOTENCY = PASS
- [ ] EVENT_TENANT_SCOPE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.8-03 - GRC Gap Model

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** 6.8-01  

**Objetivo**
Estructurar brechas deterministicas sobre observations y reglas.

**Realidad actual / baseline**
Decision interpretation/findings ya entregan señales y acciones, pero no existe un Gap model canónico confirmado.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/grc`
- `backend/src/services/intelligence`

**Implementacion requerida - orden obligatorio**
1. Definir Gap con type, source observation, affected entities, severity, status, first_seen,last_seen, deterministic_rule_version.
2. Reusar findings cuando semanticamente sean hallazgos; no duplicar auditoria findings como gaps sin relacion explicita.
3. Permitir lifecycle open/acknowledged/treatment/verified/closed gobernado.
4. La IA puede explicar gap; no crear el gap si una regla deterministica no lo sustenta salvo categoria `hypothesis` separada.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] GAP_MODEL = PASS
- [ ] DETERMINISTIC_GAP_TRUTH = PASS
- [ ] AI_HYPOTHESIS_SEPARATION = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.9-01 - Inventario de relaciones GRC existentes

**Estado de partida:** NO CONFIRMADO COMPLETO  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE  

**Objetivo**
Antes de crear Impact Graph, documentar todas las relaciones ya persistidas.

**Realidad actual / baseline**
El backend GRC es amplio y existen mappings; crear nuevas tablas sin inventario podria duplicar verdad.

**Zonas de codigo a inspeccionar primero**
- `backend/migrations`
- `backend/src/services/grc`

**Implementacion requerida - orden obligatorio**
1. Extraer schema relation inventory: requirement-control, control-evidence, risk-control, finding-action, supplier, asset/process, metrics, regulation si existe.
2. Documentar cardinalidad, ownership, tenant scope, source of truth y temporalidad.
3. Marcar relaciones derivadas versus persistidas.
4. Guardar `docs/architecture/grc_relationship_inventory.md` para evitar rescans de Codex.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] RELATIONSHIP_INVENTORY = COMPLETE
- [ ] DUPLICATE_RELATION_MODEL = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.9-02 - Impact Graph 2.0

**Estado de partida:** NUEVO SOBRE RELACIONES EXISTENTES  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** 6.9-01  

**Objetivo**
Crear capa de traversal sin reemplazar tablas de dominio.

**Realidad actual / baseline**
No se confirmo un graph engine canonico; relaciones GRC ya existen dispersas.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/grc`
- `backend/migrations`

**Implementacion requerida - orden obligatorio**
1. Crear abstraction de graph edges apuntando a entidades reales o vistas materializadas, no duplicar payloads completos.
2. Edge metadata: tenant, relationship_type, source, confidence, effective_from/to, derivation rule.
3. Traversal con depth limits, cycle handling y tenant guard.
4. Inicialmente usar PostgreSQL; introducir graph DB solo con benchmark/necessidad demostrada.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] IMPACT_GRAPH = PASS
- [ ] GRAPH_TENANT_ISOLATION = PASS
- [ ] GRAPH_SOURCE_TRACEABILITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.9-03 - Priority Engine 2.0

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.9-02  

**Objetivo**
Evolucionar next-best-actions desde severity sort hacia prioridad explicable multi-factor.

**Realidad actual / baseline**
`intelligence.actions.js` ya prioriza por severidad/audit blocker y genera owner/effort/risk_if_ignored.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence/intelligence.actions.js`
- `backend/src/services/intelligence/intelligence.rules.js`

**Implementacion requerida - orden obligatorio**
1. Definir score deterministico versionado con factores configurables: severity, risk exposure, regulatory impact, recurrence, overdue, critical process/asset, graph centrality/impact, data trust.
2. No permitir que el LLM invente el score.
3. Persistir breakdown para explicar prioridad.
4. Mantener next-best-actions actual como fallback/compatibility adapter.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PRIORITY_SCORE_VERSIONED = PASS
- [ ] PRIORITY_EXPLAINABILITY = PASS
- [ ] LLM_SCORE_AUTHORITY = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.10-01 - Modelo de documentos de conocimiento

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE  

**Objetivo**
Generalizar documentos globales, regulatorios y tenant privados con versionado/vigencia.

**Realidad actual / baseline**
KB v2 existe para knowledge items y AI Engine tiene extractores/rutas documentales.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/knowledge-base`
- `backend/migrations`
- `ai-engine/app/services`

**Implementacion requerida - orden obligatorio**
1. Definir knowledge_document con scope GLOBAL/REGULATORY/TENANT, tenant_id nullable solo para scopes globales autorizados, classification, version, status, effective dates, supersedes, checksum, source authority.
2. No mezclar attachment operacional con knowledge published sin workflow de ingestion.
3. Conservar archivo original y texto extraido con hashes.
4. Agregar lifecycle draft/indexing/active/deprecated/rejected/error.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] KNOWLEDGE_DOCUMENT_MODEL = PASS
- [ ] TENANT_SCOPE_ENFORCED = PASS
- [ ] DOCUMENT_VERSIONING = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.10-02 - Pipeline de ingestion tenant

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.10-01  

**Objetivo**
Permitir que documentacion subida por un tenant alimente solo su memoria RAG.

**Realidad actual / baseline**
Existen capacidades documentales especializadas pero no un pipeline RAG tenant universal confirmado.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/knowledge-base`
- `ai-engine/app/routes/audit_documents.py`
- `ai-engine/app/services`

**Implementacion requerida - orden obligatorio**
1. Validar MIME/ext/size con secure upload existente; malware scanning si disponible/planificado.
2. Extraer texto por tipo soportado sin OCR salvo necesidad.
3. Chunking semantico conservando page/section/heading/source offsets.
4. Eliminar secretos no necesarios o clasificar contenido sensible antes de embedding segun policy.
5. Indexar solo dentro del tenant efectivo; borrar/reindexar al versionar o revocar.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] TENANT_DOCUMENT_INGESTION = PASS
- [ ] TENANT_VECTOR_LEAKAGE = 0
- [ ] INGESTION_AUDIT = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.10-03 - pgvector y embeddings

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.10-02  

**Objetivo**
Agregar recuperacion semantica sin nueva infraestructura innecesaria.

**Realidad actual / baseline**
No se encontro vector retrieval en knowledge repository actual.

**Zonas de codigo a inspeccionar primero**
- `backend/migrations`
- `backend/src/services/knowledge-base`

**Implementacion requerida - orden obligatorio**
1. Validar extension pgvector en entornos; migracion reversible.
2. Definir embedding model/version/dimensions y reindex policy.
3. Crear knowledge_chunks con tenant scope, document version, text, metadata, embedding y checksum.
4. Indices vectoriales adecuados a volumen real; comenzar simple y medir.
5. Nunca comparar embeddings de tenants fuera del filtro tenant/global permitido.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PGVECTOR = PASS
- [ ] EMBEDDING_VERSIONING = PASS
- [ ] VECTOR_TENANT_FILTER_FIRST = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.10-04 - Hybrid Retrieval

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.10-03, 6.9-02  

**Objetivo**
Combinar structured KB, full text, vectors, metadata, graph, recency y authority.

**Realidad actual / baseline**
Knowledge search actual aporta filtros/ILIKE y matching; debe preservarse como signal.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/knowledge-base`

**Implementacion requerida - orden obligatorio**
1. Crear retrieval orchestrator con filtros duros tenant/scope antes de ranking.
2. Combinar lexical/full-text, structured matches y vector candidates.
3. Agregar graph-related candidates para entidad consultada.
4. Aplicar boosts de authority, active version y recency; penalizar deprecated.
5. Rerank top N con algoritmo deterministico o modelo separado versionado.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] HYBRID_RAG = PASS
- [ ] DEPRECATED_SOURCE_PREFERRED = 0
- [ ] RETRIEVAL_TRACE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.10-05 - RAG citations y grounded answer contract

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.10-04  

**Objetivo**
Toda respuesta grounded debe indicar exactamente de donde proviene.

**Realidad actual / baseline**
AI orchestrator ya maneja knowledge_basis pero no equivale a citations de chunks/documentos completas.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`
- `backend/src/services/knowledge-base`
- `ai-engine/app/routes/ai.py`

**Implementacion requerida - orden obligatorio**
1. Definir citation object con source_type, source_id, title, version, page/section, chunk id, authority, retrieved score.
2. Obligar a structured AI output a referenciar citation IDs proporcionados; validar que no invente IDs.
3. Cuando no existe evidencia suficiente, responder limitation/insufficient y no completar con memoria del modelo como hecho.
4. Diferenciar model knowledge de retrieved evidence en output.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] RAG_CITATIONS = PASS
- [ ] FABRICATED_CITATION = 0
- [ ] UNGROUNDED_HIGH_CONFIDENCE = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-01 - Authoritative Source Registry

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.10-01  

**Objetivo**
Convertir trusted_external_sources en registro gobernado de fuentes oficiales/aprobadas.

**Realidad actual / baseline**
AI Engine ya posee `ai_core.trusted_external_sources`, allowlists y trust levels.

**Zonas de codigo a inspeccionar primero**
- `ai-engine/app/services/external_lookup_service.py`
- `backend/migrations`

**Implementacion requerida - orden obligatorio**
1. Extender metadata: authority type, jurisdiction, content type, fetch policy, legal owner, update frequency, terms/license, canonical URLs.
2. Separar AUTHORITATIVE, APPROVED_REFERENCE e INFORMATIONAL.
3. No permitir que informational sea Source of Truth regulatoria.
4. Agregar health/status de fuente y ultimo fetch exitoso.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] SOURCE_REGISTRY_GOVERNED = PASS
- [ ] AUTHORITY_CLASSIFICATION = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-02 - Regulatory ingestion versionada

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.11-01  

**Objetivo**
Ingerir fuentes oficiales como artefactos inmutables/versionados.

**Realidad actual / baseline**
External lookup actual puede buscar web y loguear resultados, pero resultados efimeros no bastan para regulacion.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/knowledge-base`
- `ai-engine/app/services/external_lookup_service.py`

**Implementacion requerida - orden obligatorio**
1. Fetcher allowlisted por source registry.
2. Guardar documento raw/hash/fetched_at/source_url/version metadata.
3. Detectar cambios por checksum/etag/last-modified donde exista.
4. Parsear secciones sin perder referencia juridica.
5. No publicar automaticamente interpretacion normativa.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] REGULATORY_INGESTION = PASS
- [ ] IMMUTABLE_SOURCE_VERSION = PASS
- [ ] SOURCE_HASH_TRACE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-03 - Regulation / Legal Obligation data model

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.11-02  

**Objetivo**
Crear modelo generico para Ley 21.719, 21.663 y futuras regulaciones.

**Realidad actual / baseline**
No se confirmo pack completo en main.

**Zonas de codigo a inspeccionar primero**
- `backend/migrations`
- `backend/src/services/grc`
- `backend/src/services/knowledge-base`

**Implementacion requerida - orden obligatorio**
1. Definir Regulation, RegulationVersion, Section, LegalObligation, ApplicabilityRule, RegulatoryRequirement, mapping to controls/evidence/risks/metrics.
2. Evitar `if regulation == 21719` disperso; usar packs data-driven/versioned.
3. Agregar status draft/reviewed/published/deprecated y reviewed_by/reviewed_at.
4. Preservar texto fuente/licencia por referencia, no duplicar contenido protegido innecesario.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] REGULATORY_MODEL_GENERIC = PASS
- [ ] LAW_SPECIFIC_HARDCODE = 0
- [ ] REGULATORY_VERSIONING = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-04 - Semantic diff regulatorio

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.11-03  

**Objetivo**
Detectar cambios de version y sus posibles impactos sin afirmar efectos juridicos automaticamente.

**Realidad actual / baseline**
Existe web lookup pero no un diff versionado confirmado.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/knowledge-base`
- `backend/src/services/intelligence`

**Implementacion requerida - orden obligatorio**
1. Comparar secciones por IDs/anchors y similitud textual.
2. Clasificar added/removed/modified/moved; conservar before/after references.
3. IA puede resumir cambio, pero debe citar versiones y quedar como draft.
4. Requerir review humano antes de publicar mappings/obligaciones nuevas.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] REGULATORY_DIFF = PASS
- [ ] HUMAN_PUBLICATION_GATE = PASS
- [ ] AI_LEGAL_AUTHORITY = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-05 - Regulatory Pack CL-LAW-21719

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.11-04, 6.10-05  

**Objetivo**
Implementar primer pack completo reutilizando el motor generico.

**Realidad actual / baseline**
Objetivo funcional acordado; no se encontro pack completo confirmado.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services`
- `frontend/src/app`
- `ai-engine/app/services`

**Implementacion requerida - orden obligatorio**
1. Registrar fuente oficial y versiones.
2. Estructurar obligaciones y applicability rules revisables.
3. Mapear requisitos a controles/evidencias/riesgos existentes cuando exista equivalencia real.
4. Crear evaluacion tenant-specific basada en perfil/configuracion, con confirmacion humana para aplicabilidad sensible.
5. Integrar RAG con citas a version legal y contexto tenant.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] LAW_21719_PACK = PASS
- [ ] LAW_21719_CITATIONS = PASS
- [ ] TENANT_APPLICABILITY_GOVERNED = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.11-06 - Regulatory Pack CL-LAW-21663

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.11-05  

**Objetivo**
Aplicar el mismo framework a Ley 21.663 sin forks de arquitectura.

**Realidad actual / baseline**
Requerimiento identificado en plan competitivo para Chile.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services`
- `frontend/src/app`

**Implementacion requerida - orden obligatorio**
1. Reutilizar exactamente Regulation/Version/Obligation/Applicability abstractions.
2. Configurar requisitos/casos de uso de incidentes/ciberseguridad sin acoplar a tenant demo.
3. Validar convivencia con ISO 27001 y mappings reutilizables.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] LAW_21663_PACK = PASS
- [ ] REGULATORY_ENGINE_REUSE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.12-01 - Unificar Context Builders

**Estado de partida:** PARCIAL/DUPLICATION RISK  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** PRE_UI_DATA_TRUTH_GATE  

**Objetivo**
Evitar divergencia entre backend intelligence prompt context y ai-engine context_builder/ai_core.

**Realidad actual / baseline**
Existen context builders en backend y AI Engine con fuentes distintas.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence/intelligence.prompt-builder.js`
- `ai-engine/app/services/context_builder.py`

**Implementacion requerida - orden obligatorio**
1. Inventariar ownership de cada campo de contexto.
2. Definir canonical IntelligenceContext contract versionado.
3. Backend autoriza/arma tenant scope y hechos; AI Engine enriquece solo con servicios permitidos.
4. No permitir que AI Engine amplie scope tenant por query propia no autorizada.
5. Migrar endpoints gradualmente con compatibility adapters.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] INTELLIGENCE_CONTEXT_CONTRACT = PASS
- [ ] CONTEXT_DUPLICATION_DRIFT = 0
- [ ] AI_TENANT_SCOPE_ESCALATION = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.12-02 - Pattern and Trend Engine

**Estado de partida:** NUEVO/PARCIAL  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.8-01  

**Objetivo**
Detectar tendencias y patrones sobre series confiables sin delegarlo todo al LLM.

**Realidad actual / baseline**
Decision interpretation ya calcula tendencia simple previous/current; falta analitica transversal confirmada.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`
- `backend/src/services/math-governance`

**Implementacion requerida - orden obligatorio**
1. Crear time-series features desde snapshots oficiales.
2. Reglas de minimum periods/data trust antes de declarar tendencia.
3. Implementar rolling deltas, threshold crossings, recurrence y seasonality solo donde tenga sentido.
4. El LLM recibe resultados calculados, no series crudas ilimitadas.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] TREND_ENGINE = PASS
- [ ] MIN_DATA_TREND_GUARD = PASS
- [ ] LLM_NUMERIC_INVENTION = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.12-03 - Anomaly Engine

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.12-02  

**Objetivo**
Detectar observaciones atipicas con modelos estadisticos/versionados.

**Realidad actual / baseline**
No se confirmo anomaly engine transversal.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`

**Implementacion requerida - orden obligatorio**
1. Empezar con robust z-score/IQR/rolling baseline segun dominio antes de ML complejo.
2. Guardar model/config version, baseline window, score y confidence.
3. No marcar anomaly cuando dataset no alcanza sample size.
4. Tests con datasets normales, outliers y sparse.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] ANOMALY_ENGINE = PASS
- [ ] SPARSE_FALSE_POSITIVE_GUARD = PASS
- [ ] ANOMALY_EXPLAINABILITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.12-04 - Cross-GRC Intelligence Orchestrator

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.9-03, 6.10-05, 6.12-03  

**Objetivo**
Orquestar rules + gaps + graph + RAG + patterns + LLM usando el intelligence engine existente.

**Realidad actual / baseline**
El backend ya tiene intelligence orchestrator, guardrails y fallback.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence/intelligence.ai-orchestrator.js`
- `backend/src/services/intelligence`

**Implementacion requerida - orden obligatorio**
1. Extender el orchestrator existente con adapters para observations/gaps/graph/RAG.
2. No reemplazar `intelligence.ai-orchestrator.js` salvo defecto probado.
3. Construir context budget strategy y limitar top findings/citations.
4. Mantener fallback deterministico cuando AI no esta disponible.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] CROSS_GRC_INTELLIGENCE = PASS
- [ ] DETERMINISTIC_FALLBACK = PASS
- [ ] NO_SECOND_AI_ORCHESTRATOR = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.13-01 - Recommendation Decision Ledger

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.12-04  

**Objetivo**
Registrar recommendation -> human decision -> action link.

**Realidad actual / baseline**
AI traces existen, next best actions existen, pero decision lifecycle formal no se confirmo.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`
- `backend/src/services/grc`
- `backend/migrations`

**Implementacion requerida - orden obligatorio**
1. Crear ledger tenant-scoped con analysis/recommendation/version/confidence/sources.
2. Registrar accepted/modified/rejected/escalated con user/time/reason.
3. Crear action solo via workflow backend autorizado.
4. No alterar recommendation historica; versionar modificaciones humanas.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] RECOMMENDATION_LEDGER = PASS
- [ ] HUMAN_DECISION_AUDIT = PASS
- [ ] AI_AUTONOMOUS_OFFICIAL_ACTION = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.13-02 - Effectiveness Feedback Loop

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** 6.13-01  

**Objetivo**
Medir si una accion realmente corrigio la brecha.

**Realidad actual / baseline**
El plan funcional exige evidencia/retest/recalculo y existen snapshots/acciones, pero falta memoria integrada.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/grc`
- `backend/src/services/math-governance`

**Implementacion requerida - orden obligatorio**
1. Capturar before snapshot/related gaps/priority.
2. Al cierre de accion exigir evidencia y retest segun tipo.
3. Recalcular metricas/riesgos afectados de forma oficial.
4. Comparar after snapshot y registrar effectiveness outcome; closed != effective.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] ACTION_EFFECTIVENESS = PASS
- [ ] CLOSED_EQUALS_EFFECTIVE_ASSUMPTION = 0
- [ ] BEFORE_AFTER_TRACE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.13-03 - Operational Memory

**Estado de partida:** NUEVO SOBRE DATOS EXISTENTES  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.13-02, 6.10-03  

**Objetivo**
Construir memoria consultable de casos y resultados por tenant.

**Realidad actual / baseline**
Existen datos historicos dispersos; no se confirmo case-memory abstraction.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`
- `backend/src/services/knowledge-base`

**Implementacion requerida - orden obligatorio**
1. Crear case representation referenciando observations/gaps/recommendations/actions/outcomes.
2. Embeddings de case summary tenant-scoped opcionales despues de datos estructurados.
3. Retrieval de casos similares solo del mismo tenant, salvo knowledge global anonimo aprobado.
4. No hacer fine-tuning automatico del modelo global con casos privados.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] OPERATIONAL_MEMORY = PASS
- [ ] CASE_TENANT_ISOLATION = PASS
- [ ] CROSS_TENANT_FINE_TUNING = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.14-01 - AI Governance formal

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.12-04  

**Objetivo**
Completar lo que ya existe de guardrails, confidence y traces con governance versionada.

**Realidad actual / baseline**
AI orchestrator ya registra trazas, model, latency, fallback, knowledge count y confidence.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/intelligence`
- `ai-engine/app`

**Implementacion requerida - orden obligatorio**
1. Definir model registry/config, prompt version, structured schema version y allowed tools.
2. Registrar source/citation set y policy version por analysis.
3. Definir acciones prohibidas y approvals requeridos.
4. Agregar retention/redaction policy para prompts/contextos sensibles.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] AI_GOVERNANCE = PASS
- [ ] MODEL_PROMPT_VERSION_TRACE = PASS
- [ ] AI_PROHIBITED_ACTION_ENFORCEMENT = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.14-02 - AI Evaluation Suite

**Estado de partida:** NUEVO  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 6.14-01  

**Objetivo**
Evitar degradacion silenciosa de calidad al cambiar prompts/modelos/RAG.

**Realidad actual / baseline**
Hay unit tests funcionales pero no se confirmo eval suite GRC transversal.

**Zonas de codigo a inspeccionar primero**
- `backend/tests`
- `ai-engine/app/scripts`

**Implementacion requerida - orden obligatorio**
1. Crear golden cases sinteticos/no sensibles por dominio con expected facts/citations/limitations.
2. Medir structured validity, citation precision, factual consistency, refusal on insufficient data y deterministic fallback.
3. No usar exact-string matching para narrativa; validar hechos/estructura.
4. Bloquear release si el modelo nuevo degrada gates definidos.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] AI_EVAL_SUITE = PASS
- [ ] CITATION_PRECISION_GATE = PASS
- [ ] MODEL_REGRESSION_GATE = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 6.14-03 - Cierre integral Fase 6 ampliada

**Estado de partida:** PENDIENTE  
**Cuenta Codex primaria sugerida:** Codex A + B + C  
**Dependencias:** todos 6.8-6.14  

**Objetivo**
Demostrar dato -> inteligencia -> decision -> accion -> efectividad sin deuda.

**Realidad actual / baseline**
No debe cerrarse mientras PRE-UI, RAG, graph, regulatory e intelligence integration tengan gates rojos.

**Zonas de codigo a inspeccionar primero**
- `docs/final-phases/phase6`

**Implementacion requerida - orden obligatorio**
1. Ejecutar E2E operacional multi-tenant.
2. Ejecutar E2E regulatorio con version/source/citation.
3. Ejecutar AI-disabled fallback E2E.
4. Ejecutar permisos por rol y plan.
5. Generar artifact de cierre con versiones, CI, runtime evidence y deuda=0.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PHASE6_GRC_INTELLIGENCE = CLOSED
- [ ] SELLABLE_MULTI_TENANT = PASS
- [ ] REMAINING_CRITICAL_DEBT = 0
- [ ] REMAINING_NONCRITICAL_PRODUCT_DEBT = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

# 10. FASE 7 - PRODUCTO COMERCIAL, MSP Y EXPERIENCIA COMPLETA

### 7.1 - Re-baseline funcional de Fase 7

**Estado de partida:** NO INICIADA  
**Cuenta Codex primaria sugerida:** Codex C  
**Dependencias:** 6.14-03  

**Objetivo**
Congelar scope final despues del cierre 6.14 y evitar que Fase 7 reabra motores.

**Realidad actual / baseline**
Fase 7 aun no comienza; UI va en linea paralela inicial.

**Zonas de codigo a inspeccionar primero**
- `docs/final-phases`

**Implementacion requerida - orden obligatorio**
1. Generar feature inventory final por plan y rol.
2. Congelar contratos de datos/IA que la UI final consumira.
3. Definir solo deuda comercial/operativa restante.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PHASE7_SCOPE_FROZEN = PASS
- [ ] PHASE6_REOPEN_WITHOUT_EVIDENCE = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.2 - Experiencia por planes comerciales

**Estado de partida:** PARCIAL FOUNDATION  
**Cuenta Codex primaria sugerida:** Codex C  
**Dependencias:** 7.1  

**Objetivo**
Asegurar Plan 1 ISO, Plan 2 ISO+Riesgo Operacional y Plan 3 GRC con capability-driven UI.

**Realidad actual / baseline**
El prompt UI ya define aislamiento por plan.

**Zonas de codigo a inspeccionar primero**
- `frontend/src`
- `backend/src`

**Implementacion requerida - orden obligatorio**
1. Crear capability matrix backend+frontend.
2. No ocultar solo por CSS; backend debe autorizar.
3. Validar upgrade/downgrade behavior y rutas directas.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PLAN_CAPABILITY_MATRIX = PASS
- [ ] DIRECT_URL_BYPASS = 0
- [ ] PLAN_DATA_LEAKAGE = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.3 - MSP partner model

**Estado de partida:** PENDIENTE/SEGUN PLAN  
**Cuenta Codex primaria sugerida:** Codex A  
**Dependencias:** 7.1  

**Objetivo**
Completar administracion de partners y operacion delegada multi-tenant sin romper ownership.

**Realidad actual / baseline**
Fase 7 historicamente considera ecosistema MSP.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/commercial`
- `frontend/src/app/admin-saas`

**Implementacion requerida - orden obligatorio**
1. Auditar modelo existente de MSP/partners antes de crear tablas.
2. Definir partner -> managed tenant relations y scopes.
3. Separar support delegation, billing/commercial visibility y GRC decision authority.
4. Agregar audit log de tenant switching/delegated actions.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] MSP_MODEL = PASS
- [ ] DELEGATED_RBAC = PASS
- [ ] PARTNER_CROSS_TENANT_LEAKAGE = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.4 - Onboarding de cliente nuevo

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A + C  
**Dependencias:** 7.2  

**Objetivo**
Hacer onboarding sin codigo ni SQL manual.

**Realidad actual / baseline**
Gate SELLABLE_MULTI_TENANT ya es obligatorio pero debe probarse end-to-end final.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services/commercial`
- `frontend/src/app`

**Implementacion requerida - orden obligatorio**
1. Provision tenant/config/plan/roles/default policies via producto o automation soportada.
2. No insertar KPI fake para llenar dashboard.
3. Sin datos debe mostrar empty/insufficient correctamente.
4. Permitir cargar documentos y datos reales y observar activacion progresiva.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] NEW_TENANT_CODE_CHANGE_REQUIRED = NO
- [ ] NEW_TENANT_SQL_PATCH_REQUIRED = NO
- [ ] EMPTY_TENANT_UX = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.5 - Reporting y exportes finales

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A + C  
**Dependencias:** PRE_UI, 6.11  

**Objetivo**
Garantizar que reportes usan exactamente la verdad oficial y nuevas fuentes/citations cuando corresponda.

**Realidad actual / baseline**
Reporting existe y tiene tests; debe revalidarse post PRE-UI/intelligence.

**Zonas de codigo a inspeccionar primero**
- `backend/src/services`
- `frontend/src/app/reportes`

**Implementacion requerida - orden obligatorio**
1. Comparar valores reportados con official measurements.
2. Agregar source/version/cutoff metadata en reportes regulatorios/IA.
3. No generar un PDF/Excel con dato que UI marca insufficient.
4. Validar timezone, locale y periodos.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] REPORT_OFFICIAL_PARITY = PASS
- [ ] EXPORT_OFFICIAL_PARITY = PASS
- [ ] REPORT_INSUFFICIENT_DATA_INTEGRITY = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.6 - Demo comercial definitiva basada en datos reales

**Estado de partida:** PENDIENTE  
**Cuenta Codex primaria sugerida:** Codex C  
**Dependencias:** 7.5  

**Objetivo**
Crear historia demostrable sin hacks ni seed obligatorio de produccion.

**Realidad actual / baseline**
El plan funcional define historias de evidencia/riesgo, auditoria, acciones, proveedor y datos insuficientes.

**Zonas de codigo a inspeccionar primero**
- `scripts`
- `docs`
- `frontend`

**Implementacion requerida - orden obligatorio**
1. Usar tenant demo como fixture de aceptacion, no como condicional de codigo.
2. Demostrar drill-down y causalidad.
3. Demostrar IA con citations y fallback.
4. Demostrar tenant vacio/partial sin apariencia rota.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] COMMERCIAL_DEMO = PASS
- [ ] DEMO_ONLY_CODE = 0
- [ ] DEMO_DATA_PRODUCT_DEPENDENCY = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.7 - Hardening seguridad final

**Estado de partida:** PARCIAL/BASELINE EXISTENTE  
**Cuenta Codex primaria sugerida:** Codex A + B  
**Dependencias:** 6.10-6.14  

**Objetivo**
Revalidar seguridad despues de nuevas superficies RAG/web/MSP.

**Realidad actual / baseline**
Hubo cierre de security hardening previo; no reabrir items cerrados sin evidencia, pero nuevas features crean nuevos attack surfaces.

**Zonas de codigo a inspeccionar primero**
- `backend/src`
- `ai-engine/app`
- `frontend/src`

**Implementacion requerida - orden obligatorio**
1. Threat model RAG prompt injection, document upload, SSRF/web fetch, vector tenant leakage, MSP delegated access.
2. Allowlist outbound domains y evitar arbitrary URL fetch desde prompts.
3. Rate limits y quotas de AI/search/ingestion.
4. Secrets nunca en logs/prompt traces.
5. Dependency audit compatible, no upgrades destructivos sin necesidad.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] SECURITY_FINAL = PASS
- [ ] SSRF_GUARD = PASS
- [ ] PROMPT_INJECTION_GUARD = PASS
- [ ] SECRET_LOG_LEAKAGE = 0

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.8 - Observabilidad y soporte productivo

**Estado de partida:** PARCIAL  
**Cuenta Codex primaria sugerida:** Codex A + B  
**Dependencias:** 7.7  

**Objetivo**
Cerrar telemetria suficiente para operar SaaS sin adivinar fallos.

**Realidad actual / baseline**
Existe GRC observability y AI traces; falta consolidar nuevos pipelines.

**Zonas de codigo a inspeccionar primero**
- `backend/src`
- `ai-engine/app`
- `docs`

**Implementacion requerida - orden obligatorio**
1. Metricas para calculation errors, source incompatibility, outbox lag, RAG ingestion, search latency, AI fallback, regulatory fetch, graph failures.
2. Correlation IDs de frontend->backend->AI engine cuando aplique.
3. Runbooks para fallas conocidas y safe retry.
4. No registrar PII/document text completo por defecto.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] OBSERVABILITY_FINAL = PASS
- [ ] RUNBOOKS = COMPLETE
- [ ] TRACE_CORRELATION = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.9 - Performance y costo

**Estado de partida:** PENDIENTE  
**Cuenta Codex primaria sugerida:** Codex B  
**Dependencias:** 7.8  

**Objetivo**
Evitar que RAG/IA/graph degrade el SaaS o consuma recursos sin control.

**Realidad actual / baseline**
Nuevos pipelines requieren budgets.

**Zonas de codigo a inspeccionar primero**
- `backend/src`
- `ai-engine/app`

**Implementacion requerida - orden obligatorio**
1. Baseline p50/p95 de endpoints criticos antes de cambios.
2. Cache tenant-safe donde tenga sentido.
3. Async jobs para ingestion/long AI analysis; request path no debe bloquear minutos.
4. Budgets de context tokens, retrieved chunks y external queries.
5. No optimizar prematuramente con infraestructura compleja sin medicion.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] PERFORMANCE_BUDGET = PASS
- [ ] AI_CONTEXT_BUDGET = PASS
- [ ] ASYNC_LONG_TASKS = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

### 7.10 - Acceptance comercial final

**Estado de partida:** PENDIENTE  
**Cuenta Codex primaria sugerida:** Codex A + B + C  
**Dependencias:** 7.1-7.9  

**Objetivo**
Autorizar salida al mercado solo con gates completos.

**Realidad actual / baseline**
Es el cierre del programa.

**Zonas de codigo a inspeccionar primero**
- `docs`
- `scripts`

**Implementacion requerida - orden obligatorio**
1. Ejecutar matriz completa de planes/roles/tenants.
2. Ejecutar critical user journeys E2E.
3. Validar backup/restore/migrations/rollback.
4. Validar documentos legales/soporte/SLA segun proceso comercial.
5. Emitir Release Readiness Record firmado/aprobado.

**Pruebas y no-regresion obligatorias**
- [ ] Unit tests for changed pure logic.
- [ ] Contract tests for public/internal interfaces affected.
- [ ] Integration test with disposable PostgreSQL when DB semantics change.
- [ ] Two-tenant isolation test with distinct datasets.
- [ ] Empty tenant / partial tenant / sufficient tenant behavior.
- [ ] RBAC regression for routes or actions that expose new capabilities.
- [ ] No hardcoded tenant IDs, emails, periods, customer names or demo assumptions.
- [ ] No null-to-zero or silent fallback masking.
- [ ] Existing successful tests remain enabled and green.
- [ ] Runtime verification after deploy for production-dependent behavior.

**Gate de aceptacion**
- [ ] MARKET_READY = PASS
- [ ] SELLABLE_MULTI_TENANT = PASS
- [ ] ZERO_HARDCODE = PASS
- [ ] ZERO_KNOWN_CRITICAL_ERRORS = PASS
- [ ] ZERO_REGRESSION = PASS

**Salida que Codex debe reportar**
- root cause/decision record
- files changed
- tests executed and exact results
- gates PASS/FAIL
- remaining debt = none or explicit blocker
- commit SHA
- next action, without merging/deploying unless explicitly instructed

# 11. ESTRATEGIA DE 3 CUENTAS CODEX PARA AHORRAR USO SEMANAL

```text
CUENTA CODEX A - DATA / BACKEND / GRC CORE
  PRE-UI
  math-governance
  source contracts/resolvers
  observations/gaps
  graph persistence
  workflow/effectiveness
  MSP/backend

CUENTA CODEX B - AI / KNOWLEDGE / REGULATORY
  knowledge-base
  pgvector/RAG
  ai-engine
  intelligence integration
  external authoritative sources
  regulatory packs
  operational memory / AI evals

CUENTA CODEX C - FRONTEND / UX / E2E PRODUCT
  UI 1/4-4/4
  app shell/workspaces
  capability-driven UI
  charts/tables/states
  visual E2E
  commercial demo

TODAS
  leen artefactos de baseline versionados
  no repiten escaneo completo si el baseline no cambio
  trabajan en branches/worktrees separados
  no pisan los mismos archivos simultaneamente
  integran solo mediante contratos previamente congelados
```

# 12. PROTOCOLO PARA EVITAR CONSUMO INNECESARIO DE CODEX

- Crear una vez `docs/architecture/current_repo_map.md` con mapa de carpetas, servicios, rutas y owners; actualizar incrementalmente.
- Crear `docs/architecture/contracts_registry.md` con APIs, source contracts, IntelligenceContext, RAG citation schema, observation schema y graph edge schema.
- Crear `docs/qa/regression_commands.md` con comandos exactos por dominio; Codex no debe redescubrir como probar cada vez.
- Crear `docs/qa/known_green_baseline.md` con commit y gates verdes; usarlo para comparar.
- Cada prompt debe limitar paths editables y paths solo lectura.
- Cada prompt empieza por `git status`, branch, HEAD y lectura del handoff anterior; no por un repo-wide scan salvo tarea de auditoria.
- Una cuenta no debe investigar el dominio de otra si existe un handoff actualizado.
- Para bugs, proporcionar error exacto, test exacto, archivos sospechosos y contrato esperado; evitar prompt generico “revisa todo”.
- No pedir a Codex que implemente y simultaneamente rediseñe arquitectura si primero puede producir un decision record corto.
- Usar un prompt por unidad mergeable; evitar mega-prompts que consumen contexto y dejan cambios parciales.
- No ejecutar E2E completo en cada micro-edicion; usar test focal primero y suite completa antes de merge.
- No usar tres cuentas sobre el mismo PR; asignar ownership y una cuenta integradora por work package.
- Persistir salidas de auditoria en `docs/` para reutilizarlas en la siguiente cuenta.
- Evitar repetir logs gigantes; guardar artefacto y pasar lineas relevantes.
- Cuando CI falle temprano, corregir la primera causa real antes de consumir recursos interpretando jobs skipped.

# 13. CONTRATO DE HANDOFF ENTRE CUENTAS CODEX

```text
# HANDOFF TEMPLATE
Work package: <ID>
Branch: <branch>
Base commit: <sha>
Head commit: <sha>
Status: READY / BLOCKED / NEEDS_REVIEW

Files changed:
- ...

Contracts changed:
- NONE | list

Migrations:
- NONE | list + rollback

Tests focales:
- command -> result

Tests completos:
- command -> result

Known failures:
- NONE | exact failure

Gates:
- MULTI_TENANT = PASS/FAIL
- RBAC = PASS/FAIL/NA
- ZERO_HARDCODE = PASS/FAIL
- REGRESSION = PASS/FAIL

Do not touch:
- ...

Next exact action:
- ...
```

# 14. REGLAS DE BRANCHES Y PARALELISMO

- Codex A: prefijos `fix/data-*`, `feat/grc-*`, `feat/phase6-observation-*`.
- Codex B: `feat/ai-*`, `feat/rag-*`, `feat/regulatory-*`.
- Codex C: `feat/ui-*`, `fix/ui-*`, `test/e2e-*`.
- No compartir worktree entre cuentas.
- Antes de iniciar una rama, sincronizar `main` y registrar base SHA.
- No hacer merge automatico desde Codex salvo instruccion explicita.
- No hacer rebase destructivo sobre trabajo ajeno sin revisar diff.
- Cuando dos work packages requieren mismo archivo, secuenciarlos en vez de paralelizarlos.

# 15. ARTEFACTOS DE ARQUITECTURA QUE DEBEN EXISTIR ANTES DE 6.8

- `docs/architecture/current_repo_map.md` - mapa AS-IS por servicio y owner.
- `docs/architecture/data_truth_pipeline.md` - source -> normalization -> formula -> snapshot.
- `docs/architecture/official_metric_contracts.json|yaml` - matriz machine-readable.
- `docs/architecture/grc_relationship_inventory.md`.
- `docs/architecture/intelligence_context_contract.md`.
- `docs/architecture/knowledge_architecture.md`.
- `docs/architecture/rag_security_model.md`.
- `docs/architecture/regulatory_model.md`.
- `docs/architecture/ui_route_workspace_map.md`.
- `docs/qa/regression_commands.md`.
- `docs/qa/sellable_multitenant_acceptance.md`.

# 16. TEST STRATEGY GLOBAL

### 16.X - Suite Datos y metricas

- [ ] source exists
- [ ] source absent
- [ ] source empty in period
- [ ] source primary empty + permitted legacy fallback
- [ ] source incompatible
- [ ] valid rows
- [ ] invalid rows
- [ ] mixed rows
- [ ] multiple exclusion reasons in one row
- [ ] old created_at + valid effective event
- [ ] stateful entity created before period but active
- [ ] scale metadata present
- [ ] scale metadata absent
- [ ] dependency available
- [ ] dependency missing
- [ ] snapshot persistence
- [ ] lineage reproducibility

### 16.X - Suite Multi-tenant

- [ ] tenant A only
- [ ] tenant B only
- [ ] A/B distinct values
- [ ] cross-tenant guessed ID
- [ ] cross-tenant direct URL
- [ ] cross-tenant vector retrieval
- [ ] cross-tenant graph traversal
- [ ] cross-tenant AI context
- [ ] MSP delegated tenant A
- [ ] MSP unauthorized tenant B

### 16.X - Suite RAG

- [ ] lexical exact match
- [ ] semantic paraphrase
- [ ] metadata filter
- [ ] graph-related retrieval
- [ ] active vs deprecated version
- [ ] global + tenant merge
- [ ] tenant private isolation
- [ ] citation mapping
- [ ] fabricated citation rejection
- [ ] prompt injection document
- [ ] empty retrieval
- [ ] low authority web result

### 16.X - Suite Regulatory

- [ ] source fetch success
- [ ] source fetch failure
- [ ] same checksum no version
- [ ] new checksum version
- [ ] semantic diff
- [ ] draft review
- [ ] publish
- [ ] deprecate
- [ ] tenant applicability
- [ ] future regulation added without code fork
- [ ] citation to exact version

### 16.X - Suite AI

- [ ] AI enabled
- [ ] AI disabled
- [ ] timeout
- [ ] invalid structured output
- [ ] missing knowledge basis
- [ ] low confidence
- [ ] insufficient data
- [ ] deterministic fallback
- [ ] model version change eval
- [ ] prompt injection
- [ ] tool allowlist
- [ ] human accept
- [ ] human modify
- [ ] human reject

### 16.X - Suite UI

- [ ] loading
- [ ] empty
- [ ] insufficient
- [ ] error
- [ ] permission denied
- [ ] plan blocked
- [ ] AI degraded
- [ ] desktop
- [ ] tablet
- [ ] mobile
- [ ] keyboard
- [ ] charts no-data
- [ ] tables pagination
- [ ] deep link
- [ ] back/forward navigation

# 17. GATES GLOBALES DE NO DEUDA

- [ ] `SOURCE_ADAPTER_GENERALIZATION = PASS`
- [ ] `SOURCE_CONTRACT_GENERALIZATION = PASS`
- [ ] `SOURCE_PERIOD_FILTERING = PASS`
- [ ] `SOURCE_STATUS_NORMALIZATION = PASS`
- [ ] `SOURCE_SCALE_NORMALIZATION = PASS`
- [ ] `FALSE_ZERO_METRIC = 0`
- [ ] `FALSE_INSUFFICIENT_DATA = 0 for controlled sufficient fixtures`
- [ ] `ADMIN_OFFICIAL_CROSSOVER = 0`
- [ ] `OFFICIAL_NULL_TO_ZERO = 0`
- [ ] `EXCLUSION_ACCOUNTING_INCONSISTENCY = 0`
- [ ] `LEGACY_FALLBACK_MASKING_BUG = 0`
- [ ] `PROVENANCE_CHAIN = PASS`
- [ ] `SNAPSHOT_CHAIN = PASS`
- [ ] `CROSS_VIEW_METRIC_CONSISTENCY = PASS`
- [ ] `CROSS_TENANT_DATA_LEAKAGE = 0`
- [ ] `CROSS_TENANT_METRIC_LEAKAGE = 0`
- [ ] `CROSS_TENANT_VECTOR_LEAKAGE = 0`
- [ ] `CROSS_TENANT_GRAPH_LEAKAGE = 0`
- [ ] `CROSS_TENANT_AI_CONTEXT_LEAKAGE = 0`
- [ ] `RBAC_REGRESSION = 0`
- [ ] `PLAN_CAPABILITY_REGRESSION = 0`
- [ ] `ZERO_HARDCODE = PASS`
- [ ] `NEW_TENANT_CODE_CHANGE_REQUIRED = NO`
- [ ] `NEW_TENANT_SQL_PATCH_REQUIRED = NO`
- [ ] `SELLABLE_MULTI_TENANT = PASS`
- [ ] `RAG_HYBRID = PASS`
- [ ] `SOURCE_CITATIONS = PASS`
- [ ] `FABRICATED_CITATION = 0`
- [ ] `REGULATORY_VERSIONING = PASS`
- [ ] `HUMAN_PUBLICATION_GATE = PASS`
- [ ] `AI_AUDITABILITY = PASS`
- [ ] `HUMAN_IN_THE_LOOP = PASS`
- [ ] `AI_DETERMINISTIC_FALLBACK = PASS`
- [ ] `OPERATIONAL_MEMORY_TENANT_ISOLATION = PASS`
- [ ] `ACTION_EFFECTIVENESS = PASS`
- [ ] `UI_ANALYTICAL_INTEGRITY = PASS`
- [ ] `UI_RESPONSIVE = PASS`
- [ ] `A11Y_CORE = PASS`
- [ ] `REPORT_OFFICIAL_PARITY = PASS`
- [ ] `EXPORT_OFFICIAL_PARITY = PASS`
- [ ] `SECURITY_FINAL = PASS`
- [ ] `PERFORMANCE_BUDGET = PASS`
- [ ] `ZERO_KNOWN_CRITICAL_ERRORS = PASS`
- [ ] `ZERO_KNOWN_HIGH_SECURITY_FINDINGS = PASS`
- [ ] `ZERO_REGRESSION = PASS`
- [ ] `REMAINING_CRITICAL_DEBT = 0`
- [ ] `REMAINING_NONCRITICAL_PRODUCT_DEBT = 0`
- [ ] `MARKET_READY = PASS`

# 18. DEFINITION OF DONE POR CAMBIO

- [ ] Root cause o objetivo tecnico documentado antes de editar.
- [ ] Contrato funcional esperado explicitado.
- [ ] Diff limitado al alcance; sin refactors oportunistas no necesarios.
- [ ] Tests focales verdes.
- [ ] Suite de regresion pertinente verde.
- [ ] No tests desactivados/skipped nuevos para esconder fallos.
- [ ] Multi-tenant probado cuando toca datos tenant-scoped.
- [ ] RBAC probado cuando toca rutas/acciones.
- [ ] No hardcode de cliente/tenant/periodo/dataset.
- [ ] Documentacion actualizada cuando cambia contrato.
- [ ] Migracion reversible o estrategia forward-safe cuando cambia DB.
- [ ] Observabilidad suficiente para diagnosticar runtime.
- [ ] CI completo verde antes de merge.
- [ ] Validacion post-deploy si el comportamiento depende de runtime/productive data.
- [ ] No deuda residual conocida dentro del alcance.

# 19. PLAN DE SECUENCIA Y DEPENDENCIAS

```text
AHORA
  |
  +--> PUI-01..PUI-08
  |       |
  |       v
  |   CI COMPLETO VERDE
  |       |
  |       v
  |   PUI-09 RUNTIME
  |       |
  |       v
  |   PRE_UI_DATA_TRUTH_GATE
  |
  +--> UI-01..UI-03 y UI-07..UI-10 foundation (paralelo seguro)
          |
          +--> UI-04/UI-06 analitico solo despues Data Truth

DESPUES DATA TRUTH
  6.8 Observation + Gap
    -> 6.9 Relationship Inventory + Impact Graph + Priority
    -> 6.10 Knowledge docs + pgvector + Hybrid RAG + citations
    -> 6.11 Regulatory Intelligence + Law packs
    -> 6.12 Context unification + patterns + anomaly + orchestration
    -> 6.13 Decision ledger + effectiveness + operational memory
    -> 6.14 Governance + eval + integrated closure

EN PARALELO CONTROLADO
  UI 1/4..4/4 consume contratos estables

FINAL
  Phase 7 commercial/MSP/onboarding/reporting/security/performance/demo
    -> Final Acceptance
    -> Market Ready
```

# 20. PRIORIZACION PARA PRESUPUESTO CODEX LIMITADO

- **P0 - PUI-01 PR #91/CI:** Bloquea toda confianza en metricas y analitica.
- **P0 - PUI-02..PUI-08:** Evita seguir corrigiendo KPI uno por uno y establece contratos genericos.
- **P0 - PUI-09 runtime:** Evita declarar falso cierre por CI.
- **P0 - UI-01 inventory:** Ahorra rescans y reduce riesgo de romper rutas.
- **P0 - UI-02 foundation:** Permite que Codex C avance sin depender de datos.
- **P1 - 6.8 observations/gaps:** Crea input confiable para inteligencia.
- **P1 - 6.9 graph/priority:** Habilita causalidad/priorizacion real.
- **P1 - 6.10 RAG:** Amplia knowledge sin reentrenar modelos.
- **P1 - 6.11 regulatory:** Diferenciador Chile y fuente autoritativa.
- **P1 - 6.12 intelligence integration:** Convierte foundations existentes en cerebro transversal.
- **P1 - 6.13 operational memory:** Aprendizaje continuo gobernado.
- **P1 - 6.14 governance/evals:** Evita regresion IA y caja negra.
- **P2 - Fase 7 MSP/comercial:** Se ejecuta sobre producto estable, no antes.

# 21. PROMPT BASE OPTIMIZADO PARA CADA CUENTA CODEX


Todo prompt debe incluir tambien de forma explicita:

```text
CODEX_VALIDATION_MODE = FOCUSED_MINIMAL

NO:
- full CI
- full regression
- repeated test cycles
- push
- merge
- deploy

YES:
- continuity files
- focused paths
- implementation
- diff review
- max 1 focal test when useful
- handoff
- atomic commit
```

Si una instruccion especifica de un work package antiguo contradice esta politica, prevalece `FOCUSED_MINIMAL`, salvo autorizacion expresa del responsable del proyecto.



```text
ROL
Trabaja exclusivamente en <WORK_PACKAGE>. No amplíes alcance.

BASELINE
Repo: Tecdex-SpA/tcdx-iso-saas-v4
Base: main @ <SHA>
Branch: <BRANCH>
Lee primero:
- docs/architecture/<relevant artifacts>
- handoff anterior
- archivos listados como primary inspection paths

NO REPETIR
No hagas repo-wide scan si los artefactos anteriores siguen vigentes.
No investigues subsistemas fuera del alcance salvo que un test pruebe dependencia directa.

INVARIANTES
- no tenant hardcode
- no demo dependency
- no null->0
- no RBAC bypass
- no cross-tenant leakage
- no desactivar tests
- no reemplazar motor existente por duplicado
- no merge/push/deploy sin instruccion

METODO
1. Reproduce baseline/test.
2. Identifica root cause.
3. Escribe contrato esperado.
4. Realiza cambio minimo.
5. Ejecuta test focal.
6. Ejecuta regresion definida.
7. Valida zero-hardcode/multi-tenant.
8. Documenta handoff.
9. Commit atomico.

SALIDA
Estado; root cause; decision; files; tests; gates; debt; SHA; next exact action.
```

# 22. MATRIZ DE PROTECCION: LO QUE FUNCIONA NO SE TOCA SIN EVIDENCIA

- [PROTECTED] Auth/RBAC establecido y tests existentes.
- [PROTECTED] Multi-tenant scoping ya validado en Fases anteriores.
- [PROTECTED] Fórmulas oficiales y pesos salvo defecto matematico demostrado y decision de producto aprobada.
- [PROTECTED] Phase 5 snapshots/read isolation.
- [PROTECTED] Knowledge Base v2 structured search y license guardrails.
- [PROTECTED] Intelligence deterministic fallback y structured validation.
- [PROTECTED] Existing AI specialized flows: SoA, Beta-PERT, audit documents, Senior Auditor, convivencia extraction.
- [PROTECTED] Security hardening cerrado previamente: uploads, password policy, JWT secret, error logging, dependency fixes; reabrir solo por evidencia nueva.
- [PROTECTED] Legacy dashboard-v2 removal.
- [PROTECTED] Responsive/navigation/RBAC/commercial multi-tenant work de Fase 6 ya cerrado.

# 23. ANTI-PATRONES PROHIBIDOS

- [PROHIBIDO] Crear `sourceResolverV2` para evitar arreglar contrato actual.
- [PROHIBIDO] Crear `knowledge-base-new` ignorando KB v2.
- [PROHIBIDO] Crear segundo AI orchestrator transversal.
- [PROHIBIDO] Crear nuevo rules engine paralelo a intelligence/grc rules sin decision arquitectonica.
- [PROHIBIDO] Crear dashboard nuevo en paralelo porque el actual tiene deuda.
- [PROHIBIDO] Copiar score global a D/I/O/E.
- [PROHIBIDO] Convertir porcentaje a 0..5 por `if value > 5` sin metadata/contrato.
- [PROHIBIDO] Usar tenant 1/UUID fijo para resolver un bug.
- [PROHIBIDO] Usar datos demo para hacer pasar un KPI.
- [PROHIBIDO] Modificar frontend para mostrar 0 cuando backend retorna null.
- [PROHIBIDO] Usar web search efimero como texto legal oficial.
- [PROHIBIDO] Dejar que LLM decida aplicabilidad juridica definitiva.
- [PROHIBIDO] Indexar documentos tenant sin tenant_id hard filter.
- [PROHIBIDO] Permitir URL arbitraria para fetch web por prompt.
- [PROHIBIDO] Entrenar modelo global automaticamente con documentos tenant.
- [PROHIBIDO] Marcar accion cerrada como efectiva sin retest.
- [PROHIBIDO] Eliminar tests que contradicen nueva implementacion en vez de resolver el contrato.
- [PROHIBIDO] Mergear con CI parcial porque los jobs restantes estan skipped.

# 24. RIESGOS DEL PROGRAMA Y RESPUESTAS

- **Semantica de datos inconsistente - Muy alta:** PRE-UI contract-first; no construir intelligence sobre datos dudosos.
- **Tres cuentas modificando los mismos archivos - Alta:** Ownership por dominio, handoffs, branches y secuenciacion de archivos compartidos.
- **Consumo semanal Codex - Alta:** Artefactos persistentes, scans incrementales, prompts focales, tests focales antes de suites.
- **Duplicacion de motores - Alta:** Extension obligatoria de math-governance/KB/intelligence/grc/ai-engine existentes.
- **Cross-tenant leakage en RAG/graph - Critica:** Tenant filter antes de retrieval/traversal + integration tests.
- **Prompt injection desde documentos - Alta:** Treat documents as untrusted content, tool allowlist, citations, no instruction execution from chunks.
- **Legislacion desactualizada - Alta:** Authoritative registry + versioned ingestion + change watcher + human publish.
- **IA convincente sobre dato falso - Critica:** Data Truth Gate + confidence/data trust + insufficient guards.
- **UI atractiva pero analiticamente falsa - Critica:** No fake KPI/trend; analytical UI bloqueada hasta metric truth.
- **Regresion por refactor visual - Alta:** Route inventory + capability matrix + visual/E2E sentinels.
- **Complejidad infra innecesaria - Media:** PostgreSQL outbox/pgvector primero; Kafka/graph DB solo con evidencia.

# 25. RELEASE READINESS RECORD - FORMATO OBLIGATORIO

- [ ] Release candidate SHA
- [ ] Migrations applied
- [ ] Migration rollback tested
- [ ] Backend tests
- [ ] Frontend lint/typecheck/build
- [ ] E2E critical flows
- [ ] PRE_UI_DATA_TRUTH_GATE
- [ ] Official metrics parity
- [ ] Two-tenant acceptance
- [ ] RBAC matrix
- [ ] Plan capability matrix
- [ ] RAG isolation
- [ ] Graph isolation
- [ ] AI eval suite
- [ ] Regulatory source/version check
- [ ] Security review
- [ ] Performance budget
- [ ] Backup/restore check
- [ ] Observability/runbooks
- [ ] Known errors
- [ ] Known debt
- [ ] Final SELLABLE_MULTI_TENANT
- [ ] Final MARKET_READY
- [ ] Approver/date

# ANEXO A. CHECKLIST DETALLADO POR SUBSISTEMA

### ANEXO A.X - MATH-GOVERNANCE / SOURCE CONTRACT

- [ ] formula_code
- [ ] business concept
- [ ] source_code
- [ ] tenant scoped
- [ ] physical sources
- [ ] primary source
- [ ] legacy fallback allowed
- [ ] required fields
- [ ] optional fields
- [ ] canonical status mapping
- [ ] temporal class
- [ ] event/effective timestamp
- [ ] source unit
- [ ] source scale
- [ ] target unit
- [ ] target scale
- [ ] eligibility rule
- [ ] sufficiency rule
- [ ] minimum population
- [ ] counts semantics
- [ ] exclusion reason codes
- [ ] dependency formulas
- [ ] snapshot required
- [ ] lineage required
- [ ] consumer list
- [ ] empty behavior
- [ ] partial behavior
- [ ] incompatible behavior

### ANEXO A.X - KNOWLEDGE DOCUMENT

- [ ] scope
- [ ] tenant_id policy
- [ ] document owner
- [ ] classification
- [ ] source authority
- [ ] version
- [ ] effective_from
- [ ] effective_to
- [ ] status
- [ ] supersedes
- [ ] checksum
- [ ] original file ref
- [ ] extraction method
- [ ] extraction checksum
- [ ] chunking version
- [ ] embedding model/version
- [ ] citation metadata
- [ ] retention
- [ ] delete/revoke semantics
- [ ] reindex semantics

### ANEXO A.X - RAG QUERY

- [ ] effective tenant
- [ ] user/role
- [ ] question intent
- [ ] entity context
- [ ] hard metadata filters
- [ ] global scopes allowed
- [ ] tenant scopes allowed
- [ ] lexical candidates
- [ ] vector candidates
- [ ] graph candidates
- [ ] authority boost
- [ ] recency boost
- [ ] active-version filter
- [ ] rerank version
- [ ] top N
- [ ] context token budget
- [ ] citation IDs
- [ ] low coverage behavior
- [ ] trace persistence

### ANEXO A.X - GRC OBSERVATION

- [ ] tenant
- [ ] type
- [ ] entity type
- [ ] entity id
- [ ] period
- [ ] previous state
- [ ] current state
- [ ] delta
- [ ] severity
- [ ] data trust
- [ ] source run
- [ ] source snapshot IDs
- [ ] rule version
- [ ] correlation ID
- [ ] idempotency key
- [ ] created at
- [ ] processed status

### ANEXO A.X - GRC GAP

- [ ] tenant
- [ ] gap type
- [ ] source observation
- [ ] source rule
- [ ] affected entity
- [ ] status
- [ ] severity
- [ ] first seen
- [ ] last seen
- [ ] current evidence
- [ ] impact refs
- [ ] priority ref
- [ ] owner
- [ ] target date
- [ ] verification policy
- [ ] closure evidence
- [ ] retest result

### ANEXO A.X - IMPACT GRAPH EDGE

- [ ] tenant
- [ ] source type/id
- [ ] relationship type
- [ ] target type/id
- [ ] direction
- [ ] source of relation
- [ ] confidence
- [ ] effective from
- [ ] effective to
- [ ] derivation rule
- [ ] version
- [ ] deleted/deprecated semantics

### ANEXO A.X - AI ANALYSIS

- [ ] tenant
- [ ] user
- [ ] request
- [ ] analysis type
- [ ] context contract version
- [ ] model
- [ ] model version
- [ ] prompt version
- [ ] policy version
- [ ] source/citations
- [ ] knowledge coverage
- [ ] data trust
- [ ] structured schema version
- [ ] confidence
- [ ] limitations
- [ ] recommendations
- [ ] fallback
- [ ] latency
- [ ] human decision
- [ ] action link

### ANEXO A.X - REGULATION VERSION

- [ ] jurisdiction
- [ ] regulation code
- [ ] source registry key
- [ ] canonical URL
- [ ] raw hash
- [ ] fetched at
- [ ] published/effective dates
- [ ] version identifier
- [ ] sections
- [ ] obligations
- [ ] status
- [ ] reviewer
- [ ] review date
- [ ] supersedes
- [ ] semantic diff
- [ ] affected mappings
- [ ] tenant impact status

### ANEXO A.X - UI PAGE

- [ ] route
- [ ] workspace
- [ ] plan capability
- [ ] roles
- [ ] API dependencies
- [ ] official metric dependencies
- [ ] loading
- [ ] empty
- [ ] insufficient
- [ ] error
- [ ] permission denied
- [ ] AI degraded
- [ ] responsive
- [ ] keyboard
- [ ] breadcrumbs
- [ ] deep link
- [ ] primary action
- [ ] drill-down
- [ ] analytics integrity
- [ ] technical detail visibility

# ANEXO B. MATRIZ DE ESCENARIOS MULTI-TENANT

### metric
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### observation
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### gap
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### graph
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### knowledge document
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### knowledge chunk
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### RAG answer
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### regulation applicability
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### AI analysis
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### recommendation
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### action
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### effectiveness result
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### report
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### export
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

### MSP delegated action
- [ ] Tenant A con datos, Tenant B vacio
- [ ] Tenant A y B con valores diferentes
- [ ] Intento de A de referenciar ID de B
- [ ] Busqueda sin tenant explicitado donde tenant es obligatorio
- [ ] Admin autorizado dentro de tenant
- [ ] Rol sin permiso
- [ ] MSP autorizado para tenant A
- [ ] MSP no autorizado para tenant B
- [ ] Tenant desactivado/suspendido segun politica
- [ ] Registro global autorizado + registro tenant privado

# ANEXO C. MATRIZ DE ESTADOS DE DATOS Y RESPUESTA ESPERADA

### Estado `source_unavailable`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `source_incompatible`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `empty_dataset`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `partially_available`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `validated_with_warnings`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `ready`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `insufficient_data`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `dependency_pending`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `calculation_error`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `calculated`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `stale`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

### Estado `deprecated`
- Backend: devolver codigo/estado explicito, nunca convertir silenciosamente a cero.
- Data Trust: reflejar cobertura/frescura/lineage disponible; no inventar confianza.
- UI: representar estado correcto con accion de remediacion si existe.
- Reporting: no presentar como valor calculado si no lo esta.
- Intelligence: no generar conclusion factual de deterioro cuando el estado impide inferencia.
- Tests: fixture dedicado y consumer consistency.

# ANEXO D. CHECKLIST DE PROMPT INJECTION Y RAG SECURITY

- [ ] Document chunks are data, never system instructions.
- [ ] Strip/label embedded prompt-like text as untrusted.
- [ ] No tool execution instructed by retrieved content.
- [ ] Tenant filter happens before candidate retrieval, not after ranking.
- [ ] Outbound fetch only from registry/allowlist.
- [ ] No file://, localhost, RFC1918, metadata service or arbitrary redirect fetch.
- [ ] Redirect target revalidated against allowlist.
- [ ] Secrets not passed to model context.
- [ ] PII minimization.
- [ ] Citation IDs generated server-side.
- [ ] Model cannot invent source URLs accepted as authoritative.
- [ ] Uploaded document revoke removes/restricts retrieval.
- [ ] Deprecated document not preferred over active.
- [ ] Index deletion validated.
- [ ] AI traces do not store full sensitive document unnecessarily.
- [ ] Rate limit ingestion/search.
- [ ] Quota per tenant.
- [ ] Malicious oversized document handling.
- [ ] Malformed PDF/doc handling.
- [ ] Embedding failure does not leave document falsely active.
- [ ] Retrieval low-confidence returns limitation.

# ANEXO E. CODIGO Y DOCUMENTOS DE REFERENCIA - NO ES UNA LISTA EXHAUSTIVA

- `backend/src/services/math-governance/sourceResolver.service.js`
- `backend/src/services/math-governance/sourceResolver.test.js`
- `backend/src/services/math-governance/sourceContracts.service.js`
- `backend/src/services/math-governance/datasetValidation.service.js`
- `backend/src/services/math-governance/formulaRegistry.service.js`
- `backend/src/services/math-governance/officialCalculationOrchestrator.service.js`
- `backend/src/services/math-governance/decisionInterpretation.service.js`
- `backend/src/services/knowledge-base/knowledge.repository.js`
- `backend/src/services/knowledge-base/knowledge.search.js`
- `backend/src/services/knowledge-base/knowledge.service.js`
- `backend/src/services/knowledge-base/knowledge.guardrails.js`
- `backend/src/services/intelligence/intelligence.actions.js`
- `backend/src/services/intelligence/intelligence.ai-orchestrator.js`
- `backend/src/services/intelligence/intelligence.audit-log.js`
- `backend/src/services/intelligence/intelligence.confidence.js`
- `backend/src/services/intelligence/intelligence.evidence-strength.js`
- `backend/src/services/intelligence/intelligence.explainability.js`
- `backend/src/services/intelligence/intelligence.guardrails.js`
- `backend/src/services/intelligence/intelligence.prompt-builder.js`
- `backend/src/services/intelligence/intelligence.rules.js`
- `backend/src/services/grc/grc.service.js`
- `backend/src/services/grc/grcRules.js`
- `backend/src/services/grc/grcApprovalRules.js`
- `backend/src/services/grc/grcObservability.js`
- `ai-engine/app/routes/ai.py`
- `ai-engine/app/routes/audit_documents.py`
- `ai-engine/app/routes/operational_risk_beta_pert.py`
- `ai-engine/app/routes/senior_auditor_v2.py`
- `ai-engine/app/routes/soa_assessment.py`
- `ai-engine/app/services/context_builder.py`
- `ai-engine/app/services/external_lookup_service.py`
- `ai-engine/app/services/domain_knowledge.py`
- `ai-engine/app/services/bootstrap_knowledge_service.py`
- `frontend/src/app`
- `docs/final-phases/pre-ui/01_official_metrics_source_reconciliation.md`
- `docs/final-phases/phase6`
- `docs/final-phases/plan_maestro_ultimas_fases_tcdx_iso_saas_v4.md`

# ANEXO F. CRITERIOS DE FIDELIDAD AL OBJETIVO VISUAL

- [ ] Enterprise SaaS sobrio, no startup colorida ni estetica gamer.
- [ ] Fondo principal claro, cards/surfaces limpias, sidebar corporativa.
- [ ] Color semantico reservado a estado: verde positivo, ambar advertencia, rojo alto/critico, azul informativo.
- [ ] Jerarquia visual por decision: requiere atencion -> evidencia -> impacto -> accion.
- [ ] Formula tecnica y nombres internos fuera de la vista de negocio primaria.
- [ ] Density management: tablas densas pero legibles; cards solo cuando ayudan a decision.
- [ ] Consistencia de componentes entre Risk, Compliance, Audit, Continuity, Supplier, Data y AI.
- [ ] No charts decorativos sin decision purpose.
- [ ] No tendencias con un solo periodo o sin comparabilidad.
- [ ] No porcentajes de confianza sin metodologia.
- [ ] Responsive sin perder criticidad/estado.
- [ ] Accesibilidad y keyboard navigation.
- [ ] AI recommendations visualmente diferenciadas de hechos/calculos oficiales.
- [ ] Regulatory source/citation visible cuando una conclusion depende de una ley.
- [ ] Data Trust visible cuando condiciona interpretacion.

# ANEXO G. DEFINITION OF MARKET READY

- [ ] Un cliente nuevo puede contratar, provisionarse y comenzar sin cambio de codigo ni SQL manual.
- [ ] El sistema funciona con cero datos, datos parciales y datos suficientes sin falsear indicadores.
- [ ] Metricas oficiales reproducibles y consistentes entre dashboard/BI/report/export.
- [ ] Riesgos, controles, evidencias, hallazgos, acciones y cumplimiento vinculados de forma trazable.
- [ ] IA explica y recomienda sobre hechos/knowledge recuperado con citations.
- [ ] Tenant documents enriquecen solo el tenant propietario.
- [ ] Regulatory packs versionados y basados en fuentes oficiales gobernadas.
- [ ] Cambios regulatorios pueden detectarse/versionarse/revisarse sin editar codigo central.
- [ ] Recomendaciones humanas pueden aceptar/modificar/rechazar y queda auditado.
- [ ] Acciones cerradas se retestean; la efectividad se demuestra.
- [ ] MSP opera solo tenants delegados y con permisos explicitos.
- [ ] UI visualmente consistente, responsive, accesible y fiel a Tecdex.
- [ ] No existen TODO/coming soon/mocks productivos en flujos vendidos.
- [ ] Security, performance, observability, backups y rollback verificados.
- [ ] CI verde y release readiness record completo.
- [ ] Known critical debt = 0; known commercial-blocking debt = 0.

# ANEXO H. PLANTILLA DE EJECUCION DETALLADA PARA CADA WORK PACKAGE

### Plantilla H.01 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.02 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.03 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.04 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.05 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.06 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.07 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.08 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.09 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.10 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.11 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.12 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.13 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.14 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.15 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.16 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.17 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.18 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.19 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.20 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.21 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.22 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.23 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.24 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.25 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.26 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.27 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.28 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.29 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.30 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.31 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.32 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.33 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.34 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.35 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.36 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.37 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.38 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.39 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

### Plantilla H.40 - Registro de ejecucion atomica
- Work package ID:
- Cuenta Codex: A / B / C
- Fecha:
- Base SHA:
- Branch:
- Objetivo exacto:
- Contrato esperado:
- Baseline reproducido: SI/NO
- Error o comportamiento baseline:
- Root cause confirmado:
- Alternativas descartadas y motivo:
- Decision implementada:
- Archivos permitidos:
- Archivos modificados:
- Archivos protegidos tocados: NONE requerido salvo justificacion:
- Migraciones: NONE / detalle:
- Hardcode scan: PASS/FAIL
- Tenant isolation test: PASS/FAIL/NA
- RBAC test: PASS/FAIL/NA
- Empty tenant: PASS/FAIL/NA
- Partial tenant: PASS/FAIL/NA
- Sufficient tenant: PASS/FAIL/NA
- Tenant A vs B distinct behavior: PASS/FAIL/NA
- Unit tests:
- Integration tests:
- E2E tests:
- CI result:
- Runtime validation:
- Before/after evidence:
- Regression found: NONE / detail:
- Remaining debt: NONE / explicit blocker:
- Commit SHA:
- Handoff written: SI/NO
- Next exact action:

# ANEXO I. DECISIONES ARQUITECTONICAS PREDEFINIDAS PARA EVITAR GASTO CODEX

### ADR-001 - No LLM direct SQL
El LLM recibe contextos autorizados; no conexion SQL arbitraria.

### ADR-002 - PostgreSQL outbox first
Usar outbox/worker antes de Kafka salvo benchmark.

### ADR-003 - PostgreSQL pgvector first
Usar pgvector antes de vector DB separada salvo escala demostrada.

### ADR-004 - PostgreSQL graph abstraction first
No Neo4j obligatorio; usar relaciones existentes/edge abstraction y medir.

### ADR-005 - Extend KB v2
RAG se construye encima de knowledge-base actual.

### ADR-006 - Extend Intelligence Engine
No segundo orchestrator; integrar componentes actuales.

### ADR-007 - Deterministic truth, AI explanation
Scores/gaps oficiales por reglas/calculos; IA explica/recomienda.

### ADR-008 - Tenant learning via memory/RAG
No fine-tuning cross-tenant automatico.

### ADR-009 - Authoritative regulatory sources
Web general no es truth legal.

### ADR-010 - Human publication and decisions
Cambios regulatorios y decisiones oficiales requieren governance.

### ADR-011 - UI consumes official contracts
No calcular KPI paralelo en frontend.

### ADR-012 - No hardcode by tenant
Configuracion data-driven/capabilities.

### ADR-013 - No demo dependency
Demo es acceptance fixture, no branch de codigo.

### ADR-014 - Active/deprecated version semantics
RAG/regulatory retrieval debe considerar vigencia.

### ADR-015 - Closed action != effective
Effectiveness requiere evidence/retest/recalculation.

# ANEXO J. MAPA DE RESULTADO FINAL

```text
USUARIO EJECUTIVO
  ve estado real, tendencias, confianza, prioridades y acciones.

RESPONSABLE GRC
  ve gaps, impacto, controles/evidencias, requisitos, riesgos, owners y fechas.

AUDITOR
  ve evidencia, lineage, snapshots, findings, trails y fuentes citables.

RESPONSABLE DE RIESGO
  ve inherente/residual, controles, escenarios, Beta-PERT/Monte Carlo donde aplique, tendencias y tratamientos.

PRIVACIDAD / REGULATORIO
  ve obligaciones versionadas, applicability, mappings, evidencias y cambios de fuente oficial.

MSP
  opera clientes delegados con aislamiento y auditoria.

AI ENGINE
  no reemplaza la verdad: consume contextos confiables, knowledge y graph; detecta patrones y recomienda.

TCDX
  aprende operacionalmente del ciclo decision -> accion -> resultado sin mezclar datos privados entre tenants.
```

# 26. CONCLUSION Y ORDEN EJECUTIVO

La plataforma no necesita una reconstruccion general. El repositorio ya contiene foundations importantes de math-governance, GRC, Knowledge Base, Intelligence y AI Engine. El riesgo principal seria duplicarlas o construir inteligencia sobre datos todavia mal normalizados.

El orden obligatorio es:

1. Cerrar PR #91 y toda deuda PRE-UI de source semantics.
2. Validar runtime y declarar PRE_UI_DATA_TRUTH_GATE solo con evidencia.
3. Avanzar UI foundation en paralelo, reservando analitica real para despues del gate.
4. Crear Observation/Gap layer sobre measurements/snapshots existentes.
5. Construir Impact Graph y Priority 2.0 reutilizando relaciones y Next Best Actions.
6. Evolucionar Knowledge Base v2 a RAG hibrido multi-tenant con citations.
7. Convertir trusted external lookup en Regulatory Intelligence versionada y publicar packs 21.719/21.663.
8. Integrar observations+graph+RAG+patterns en el Intelligence Engine actual.
9. Cerrar Human-in-the-Loop, effectiveness y Operational Memory.
10. Completar AI Governance/evals.
11. Finalizar UI/UX enterprise y Fase 7 comercial/MSP.
12. Ejecutar Release Readiness con debt=0, hardcode=0, leakage=0, regression=0 y MARKET_READY=PASS.

**Regla final:** ningun cambio se justifica por ser nuevo. Solo se acepta si mejora el producto, conserva lo que ya funciona, reduce deuda demostrable y pasa los gates de producto SaaS comercializable.

# ANEXO K. REGISTRO DETALLADO DE EVIDENCIA POR GATE

### SOURCE_ADAPTER_GENERALIZATION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SOURCE_CONTRACT_GENERALIZATION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SOURCE_PERIOD_FILTERING = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SOURCE_STATUS_NORMALIZATION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SOURCE_SCALE_NORMALIZATION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### FALSE_ZERO_METRIC = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### FALSE_INSUFFICIENT_DATA = 0 for controlled sufficient fixtures
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ADMIN_OFFICIAL_CROSSOVER = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### OFFICIAL_NULL_TO_ZERO = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### EXCLUSION_ACCOUNTING_INCONSISTENCY = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### LEGACY_FALLBACK_MASKING_BUG = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### PROVENANCE_CHAIN = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SNAPSHOT_CHAIN = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_VIEW_METRIC_CONSISTENCY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_TENANT_DATA_LEAKAGE = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_TENANT_METRIC_LEAKAGE = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_TENANT_VECTOR_LEAKAGE = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_TENANT_GRAPH_LEAKAGE = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### CROSS_TENANT_AI_CONTEXT_LEAKAGE = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### RBAC_REGRESSION = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### PLAN_CAPABILITY_REGRESSION = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ZERO_HARDCODE = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### NEW_TENANT_CODE_CHANGE_REQUIRED = NO
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### NEW_TENANT_SQL_PATCH_REQUIRED = NO
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SELLABLE_MULTI_TENANT = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### RAG_HYBRID = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SOURCE_CITATIONS = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### FABRICATED_CITATION = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### REGULATORY_VERSIONING = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### HUMAN_PUBLICATION_GATE = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### AI_AUDITABILITY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### HUMAN_IN_THE_LOOP = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### AI_DETERMINISTIC_FALLBACK = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### OPERATIONAL_MEMORY_TENANT_ISOLATION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ACTION_EFFECTIVENESS = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### UI_ANALYTICAL_INTEGRITY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### UI_RESPONSIVE = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### A11Y_CORE = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### REPORT_OFFICIAL_PARITY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### EXPORT_OFFICIAL_PARITY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### SECURITY_FINAL = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### PERFORMANCE_BUDGET = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ZERO_KNOWN_CRITICAL_ERRORS = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ZERO_KNOWN_HIGH_SECURITY_FINDINGS = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### ZERO_REGRESSION = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### REMAINING_CRITICAL_DEBT = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### REMAINING_NONCRITICAL_PRODUCT_DEBT = 0
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:

### MARKET_READY = PASS
- Estado actual: NOT_EVALUATED / PASS / FAIL
- Commit evaluado:
- Entorno: local / CI / disposable PostgreSQL / staging / production
- Cuenta Codex responsable:
- Comando o procedimiento exacto:
- Dataset/fixture:
- Tenant A:
- Tenant B:
- Rol/permiso:
- Resultado esperado:
- Resultado obtenido:
- Evidencia/log/artifact:
- Diferencia antes/despues:
- Riesgo residual:
- Aprobador:
- Fecha de cierre:
