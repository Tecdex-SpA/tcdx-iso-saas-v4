# PROMPT DE CONTINUIDAD CODEX --- CIERRE SISTÉMICO GRC

## Retomar exactamente el trabajo inconcluso sin redescubrimiento

Repositorio local: `~/repos/tcdx-iso-saas-v4`

## 0. OBJETIVO

Retoma **exactamente** el trabajo inconcluso dejado por la sesión Codex
anterior.

NO reinicies el análisis desde cero.\
NO repitas el inventario general ya realizado.\
NO descartes ni sobrescribas el working tree existente.\
NO hagas `git reset --hard`, `git checkout .`, `git restore .`, stash
destructivo ni limpieza automática.\
NO hagas commit, push, merge ni deploy.

Tu primera responsabilidad es **auditar técnicamente el diff inconcluso
que ya existe**, confirmar qué partes son correctas y corregir cualquier
supuesto no demostrado antes de continuar.

El trabajo sigue gobernado por:

`docs/codex/prompts/PROMPT_CODEX_CIERRE_SISTEMICO_GRC_CALCULATION_ORCHESTRATION_2026-09-11.md`

y, como autoridad arquitectónica:

`docs/codex/ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md`

No reabras las decisiones arquitectónicas ya aprobadas.

------------------------------------------------------------------------

# 1. ESTADO BASE CONFIRMADO POR LA SESIÓN ANTERIOR

Al iniciar el trabajo anterior:

-   rama: `main`
-   HEAD: `d889fa915ccc46ff932c51fbc69b292f81772974`
-   `origin/main`: mismo SHA
-   working tree inicial: limpio
-   commit rector `afe8f35786b3f8a70919bebd5c6541109b04704a` confirmado
    como ancestro
-   no hubo commit, push, merge ni deploy durante la ejecución
    inconclusa.

El agotamiento de recursos ocurrió con cambios **sin commit en el
working tree local**.

Por lo tanto, el working tree actual es el handoff principal y debe
preservarse.

------------------------------------------------------------------------

# 2. CAMBIOS YA REALIZADOS EN EL WORKING TREE

La sesión anterior reportó aproximadamente:

`11 files changed, 493 insertions(+), 33 deletions(-)`

y creó/modificó estas piezas:

## Nuevo servicio

`backend/src/services/grcCalculationOrchestration.service.js`

Se creó como helper de orquestación post-mutación.

Incluye, entre otros:

-   `METRICS_BY_FACT_TYPE`
-   `resolveAffectedMetricCodes()`
-   `publishAffectedOfficialIndicators()`
-   `normalizeControlImplementationStatus()`
-   `recordControlSoAAssessment()`

Mapa provisional introducido:

-   compliance / diagnostic / soa → `COMPLIANCE`, `COVERAGE`,
    `DATA-TRUST`, `GRC-HEALTH`
-   evidence → `EVIDENCE-FRESH`, `DATA-TRUST`, `GRC-HEALTH`
-   finding / nonconformity / action → `ACTIONS`, `DATA-TRUST`,
    `GRC-HEALTH`
-   risk → `RISK-INHERENT`, `RISK-RESIDUAL`, `DATA-TRUST`, `GRC-HEALTH`
-   scope → conjunto amplio de
    compliance/coverage/risk/actions/evidence/data-trust/health.

**IMPORTANTE:** este mapa es PROVISIONAL hasta contrastarlo con
`metric_source_bindings`, source contracts y fórmulas oficiales. No lo
des por correcto sólo porque fue escrito.

El helper usa actualmente `indicatorGovernance.calculateIndicator()`,
`createSnapshot()` y `publishSnapshot()`.

Debes comprobar que esta secuencia es realmente la integración correcta
con la autoridad oficial y que no está creando una segunda capa
equivalente al `officialCalculationOrchestrator`.

## Diagnóstico

`backend/src/routes/diagnostic.routes.js`

Se modificó para:

-   llamar `recordControlSoAAssessment()` dentro de la transacción;
-   hacer COMMIT;
-   ejecutar `publishAffectedOfficialIndicators()` después;
-   devolver `canonical_assessment`;
-   devolver `official_recalculation`;
-   reemplazar etiqueta `canonical_health_projection_read_only` por
    `canonical_health_projection_after_official_recalculation`.

## SoA

`backend/src/routes/soa.routes.js`

Se modificó para:

-   registrar `control_soa_assessments`;
-   ejecutar publicación oficial post-COMMIT;
-   devolver `canonical_assessment` y `official_recalculation`.

## Source resolver

`backend/src/services/math-governance/sourceResolver.service.js`

Se modificó el candidato `control_soa_assessments` para leer
preferentemente:

-   `suggested_implementation_status`
-   `suggested_applicable`

en vez de interpretar `status='applied'` como cumplimiento.

Esto responde a un problema real detectado: el `status` de
`control_soa_assessments` parece representar workflow de assessment, no
necesariamente estado matemático de cumplimiento.

**Debe validarse contra schema, contratos y datos de prueba antes de
considerarlo definitivo.**

## Evidencias

`backend/src/routes/evidences.routes.js`

Se agregó orquestación post-mutación a rutas reportadas como:

-   upload;
-   validate;
-   approve;
-   mark-official.

Debes comprobar si faltan otros writers relevantes y, sobre todo, si
`EVIDENCE-FRESH` y `DATA-TRUST` consumen realmente hechos afectados por
estas operaciones.

## Findings

`backend/src/routes/findings.routes.js`

Se agregó helper local `publishFindingOrchestration()` y publicación
post-mutación para:

-   crear;
-   actualizar;
-   borrar;
-   crear/reutilizar action plan desde finding.

## Action plans

`backend/src/routes/action-plans.routes.js`

Se agregó publicación para:

-   updates/progreso;
-   request-approval;
-   review-approval;
-   crear;
-   actualizar;
-   borrar.

## Nonconformities

`backend/src/routes/nonconformities.routes.js`

Se agregó publicación en actualización de NC.

Debes verificar si existen otros writers de NC y si la asociación del
fact type `nonconformity → ACTIONS` es realmente contractual.

## Tenant standards / scope

`backend/src/routes/tenant-standards.routes.js`

Se agregó publicación tipo `scope` después de cambios en:

-   operaciones;
-   actualización/desactivación de operación;
-   scope;
-   initialize;
-   deactivate.

## Controls workbench

`backend/src/routes/controls.routes.js`

Se agregó:

-   `publishControlOrchestration()`;
-   `recordControlSoAAssessment()` al update de workbench;
-   BEGIN/COMMIT/ROLLBACK alrededor del update + assessment;
-   publicación para quick nonconformity;
-   quick finding;
-   quick action plan;
-   enable control;
-   disable control.

Debes revisar con cuidado la transacción añadida y confirmar que
`resolveControlRefs()` devuelve una identidad normativa válida para
`isoCode`; no asumir que `primary_standard_code` es directamente
compatible con `control_soa_assessments.iso_code`.

## Riesgo

`backend/src/routes/iso-risk-matrix.routes.js`

Se agregó publicación tipo `risk` a:

-   generate cuando no es dry-run;
-   review;
-   PATCH risk-inputs;
-   archive.

Debes verificar cuáles de esas operaciones realmente cambian source
contracts oficiales y evitar recalculaciones espurias.

## KPI

`backend/src/controllers/kpi.controller.js`

Se eliminó el bloque no-op:

`canonical_health_projection_read_only`

y se reemplazó por `publishAffectedOfficialIndicators()` usando
provisionalmente `factType: 'scope'`.

**Este punto requiere revisión prioritaria.** Un endpoint explícito de
recálculo KPI no necesariamente equivale semánticamente a una mutación
de `scope`. Determina qué conjunto de métricas debe recalcular según
contratos oficiales, sin usar un fact type incorrecto sólo para
reutilizar el mapa.

## Test nuevo

`backend/src/services/grcCalculationOrchestration.service.test.js`

Se creó test focal con dobles/mocks para:

-   mapa de métricas;
-   escritura de `control_soa_assessments`;
-   publicación calculate → snapshot → publish;
-   aislamiento lógico Tenant A / Tenant B;
-   fallo explícito de una métrica sin detener las restantes.

El test pasó:

`grcCalculationOrchestration.service.test PASS`

Este test **NO satisface todavía** el gate E2E causal obligatorio del
prompt rector porque no usa PostgreSQL aislado ni demuestra persistencia
real → source contract → fórmula → run/output/snapshot → consumidores.

------------------------------------------------------------------------

# 3. VALIDACIONES YA EJECUTADAS

Pasó `node -c` para:

-   `grcCalculationOrchestration.service.js`
-   `soa.routes.js`
-   `diagnostic.routes.js`
-   `findings.routes.js`
-   `action-plans.routes.js`
-   `nonconformities.routes.js`
-   `tenant-standards.routes.js`
-   `controls.routes.js`
-   `iso-risk-matrix.routes.js`
-   `sourceResolver.service.js`
-   `kpi.controller.js`
-   `grcCalculationOrchestration.service.test.js`
-   `evidences.routes.js`

También pasó:

`node backend/src/services/grcCalculationOrchestration.service.test.js`

Todavía NO consta ejecución completa de:

-   backend test suite;
-   frontend typecheck;
-   deploy strategy;
-   RBAC gates;
-   PostgreSQL causal E2E;
-   cross-view reconciliation;
-   legacy authority scan final;
-   documentación/handoff final.

------------------------------------------------------------------------

# 4. PUNTO EXACTO DONDE SE AGOTARON LOS RECURSOS

La sesión estaba investigando una cuestión crítica:

El contrato publicado todavía parecía declarar
`grc_requirement_control_mappings` como fuente primaria de cumplimiento.

Se observó que `sourceResolver.service.js` tiene candidatos en un orden
donde:

1.  `grc_requirement_control_mappings`
2.  `control_soa_assessments`
3.  `tenant_controls`

pueden actuar como fuentes alternativas/priorizadas.

La sesión anterior llegó a la hipótesis:

> si existe un `grc_framework_requirement` resoluble para el control,
> podría ser necesario materializar/actualizar mapping/assurance
> gobernado; si no existe, `control_soa_assessments` actuaría como
> fallback.

**NO IMPLEMENTES ESA HIPÓTESIS TODAVÍA.**

Éste es exactamente el punto donde debes continuar.

Antes de escribir más código debes demostrar:

1.  qué source contract es la autoridad real actual para
    `F5_5_COMPLIANCE_WEIGHTED`;
2.  qué significa exactamente el orden de candidatos de
    `sourceResolver`;
3.  cuándo `grc_requirement_control_mappings` existe y qué semántica
    tiene;
4.  si una mutación de Diagnóstico/SoA debe escribir directamente esa
    relación o si esa tabla se deriva/gobierna por otro proceso;
5.  si escribirla desde Diagnóstico introduciría una nueva autoridad o
    duplicaría una relación normativa;
6.  cómo se relacionan:
    -   `tenant_controls`
    -   `control_soa_assessments`
    -   `grc_framework_requirements`
    -   `grc_requirement_control_mappings`
    -   `grc_control_assurance`
    -   `controls_catalog`
    -   `controls_catalog_standards`
    -   identidad normativa ISO.

Sólo después de demostrar ese contrato decide si el diff actual necesita
ampliación, corrección o simplificación.

------------------------------------------------------------------------

# 5. PRIMERA ACCIÓN DE ESTA SESIÓN --- NO REDESCUBRIR

Ejecuta solamente estas verificaciones iniciales:

``` bash
cd ~/repos/tcdx-iso-saas-v4

git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --stat
git diff --check
```

Esperado:

-   rama `main`;
-   HEAD base `d889fa915ccc46ff932c51fbc69b292f81772974`, salvo que el
    usuario haya cambiado explícitamente el repo;
-   working tree con los cambios inconclusos descritos arriba.

NO hagas `git pull` si eso puede interferir con cambios locales sin
antes evaluar estado.

Luego inspecciona el diff existente:

``` bash
git diff -- \
  backend/src/services/grcCalculationOrchestration.service.js \
  backend/src/services/grcCalculationOrchestration.service.test.js \
  backend/src/services/math-governance/sourceResolver.service.js \
  backend/src/routes/diagnostic.routes.js \
  backend/src/routes/soa.routes.js \
  backend/src/routes/evidences.routes.js \
  backend/src/routes/findings.routes.js \
  backend/src/routes/action-plans.routes.js \
  backend/src/routes/nonconformities.routes.js \
  backend/src/routes/tenant-standards.routes.js \
  backend/src/routes/controls.routes.js \
  backend/src/routes/iso-risk-matrix.routes.js \
  backend/src/controllers/kpi.controller.js
```

Nota: el `git diff --stat` anterior reportó 11 archivos aunque el
handoff textual enumera más paths tocados en distintas fases. **Confía
en el working tree real**, no en el número histórico. Determina la lista
exacta mediante `git status`/`git diff --name-only`.

------------------------------------------------------------------------

# 6. AUDITORÍA OBLIGATORIA DEL DIFF ANTES DE CONTINUAR

No asumas que el trabajo anterior es correcto porque compiló.

Revisa específicamente:

### A. ¿Se creó accidentalmente un segundo orchestrator?

El contrato aprobado exige:

`officialCalculationOrchestrator` = única autoridad de cálculo.

El nuevo `grcCalculationOrchestration.service.js` sólo es aceptable si
actúa como adaptador post-mutación hacia las APIs oficiales existentes.

Si reproduce lógica de cálculo, resolución de fórmula o publicación que
ya pertenece al orchestrator/indicator governance, simplifícalo.

### B. Mapa `METRICS_BY_FACT_TYPE`

No aceptes el mapa provisional por intuición.

Derívalo de:

-   `metric_source_bindings`;
-   source contracts;
-   formula definitions/versions;
-   dependencias de `F5_5_GRC_HEALTH v2`.

Una mutación debe recalcular las métricas que realmente dependen de ese
hecho.

No recalcules `DATA-TRUST` o `GRC-HEALTH` sólo porque "parece lógico".

### C. Error policy post-COMMIT

El helper actualmente captura errores por métrica y devuelve
`status: failed` sin revertir el hecho operacional.

Determina si éste es el contrato correcto.

El sistema NO debe responder éxito silencioso si la propagación oficial
requerida quedó rota.

A la vez, una falla de analytics posterior no debe corromper/rollbackear
una mutación ya confirmada.

Define una semántica explícita y testeable.

### D. `control_soa_assessments`

Verifica:

-   si se permiten múltiples filas históricas por tenant/control/ISO;
-   si debería hacerse INSERT o UPSERT;
-   cuál es la clave lógica;
-   semántica de `status`;
-   semántica de `suggested_*`;
-   timestamps;
-   reviewer/applier;
-   cómo el resolver elige una fila si existen varias.

No dejes una implementación que acumule evaluaciones ambiguas y haga que
`firstPopulated`/resolver lea datos no deterministas.

### E. Identidad normativa

No mezcles sin resolver:

`ISO_27001_2022` `ISO27001` `ISO27001:2022`

Confirma la identidad que espera `control_soa_assessments.iso_code`.

Usa resolver canónico existente si existe.

No hardcodear ISO27001 como solución.

### F. `sourceResolver`

Comprueba que el SQL agregado sea seguro para todas las variantes de
schema soportadas y que no produzca casts boolean inválidos.

### G. Writers

Confirma que cada llamada de orquestación corresponda a una mutación
real y esté colocada después del COMMIT cuando corresponde.

Evita recalcular en:

-   dry-run;
-   no-op;
-   idempotent already_exists;
-   lectura;
-   cambios que no alteran source contract.

### H. KPI recalculate

No usar `factType='scope'` por conveniencia si el endpoint significa
"recalcular analytics".

Implementa semántica explícita.

------------------------------------------------------------------------

# 7. CONTRATO SISTÉMICO QUE NO DEBES CAMBIAR

``` text
CONFIGURACIÓN TENANT
plan / módulos / normas / RBAC / unidades
        ↓
ALCANCE APLICABLE
tenant_standards
tenant_operations
effective control catalog
tenant_controls
tenant_applicable_controls
        ↓
HECHOS GRC
SoA / diagnóstico
Evidencias
Hallazgos
No conformidades
Planes de acción
Riesgos
Auditorías
Continuidad / otros dominios
        ↓
SOURCE CONTRACTS OFICIALES
        ↓
officialCalculationOrchestrator
        ↓
calculation_runs
calculation_outputs
calculation_snapshots
metric_snapshots
        ↓
CANONICAL PROJECTION
        ↓
Dashboard / Health / KPI / Diagnóstico / BI / Reportes / IA
```

------------------------------------------------------------------------

# 8. DECISIONES APROBADAS --- NO REABRIR

1.  `officialCalculationOrchestrator` es la vía oficial de recalculación
    posterior a hechos GRC relevantes.

2.  `F5_5_GRC_HEALTH v2` es la autoridad Health.

No revivir:

-   `control_health_scores`;
-   `refresh_kpi_health_snapshots`;
-   KPI-HLT;
-   motores Health paralelos.

3.  Diagnóstico y SoA deben alimentar la misma verdad canónica de
    cumplimiento.

4.  Dashboard, KPI, Health, BI, Reportes, Diagnóstico e IA deben
    converger sobre resultados oficiales publicados.

5.  Sin medición no significa 0.

------------------------------------------------------------------------

# 9. REFERENCIA HISTÓRICA YA DETERMINADA

No gastes recursos repitiendo la auditoría histórica.

La revisión previa determinó:

-   referencia funcional pre-fresh-baseline:
    `11003dd92385dcca1caf5365fa437be3aee1f648`
-   fresh baseline: `7c23a0a03920fff6690f3ae750f5850afd440da6`
-   canonical Health authority:
    `476afe25f2e6504b672d20e3c9ef2db0dd682342`
-   governed ISO mapping: `b36306fcf876b19e7030748e4fd8718eb01e6fe4`
-   ISO Express introduction: `fae5b6688ea7367fe5d984d1d9ac327df056dc4a`
-   current audit reference before this repair:
    `56c38f482bdd7a9527d1e9aaabf961ae963c7308`

Hallazgo histórico clave:

En `11003dd`, Diagnóstico hacía:

``` text
update tenant_controls
→ refresh_control_health_scores_v2_1(tenant)
→ refresh_kpi_health_snapshots(tenant)
```

Ese comportamiento de propagación existía.

Las funciones legacy NO deben volver.

La conducta sí debe reimplementarse mediante autoridades actuales.

En estado reciente, `refreshHealthForTenant()` quedó reducido a lectura
de `v_iso_control_effective_health`, sin producir downstream state.

Ésa es una causa raíz confirmada de divergencia.

------------------------------------------------------------------------

# 10. PROBLEMAS FUNCIONALES OBSERVADOS QUE EL CIERRE DEBE ELIMINAR

En QA/manual se observó:

-   ISO27001 activa;
-   51 controles efectivos;
-   51 `tenant_controls`;
-   51 aplicables;
-   Diagnóstico puede cambiar un control a Cumple;
-   Diagnóstico local puede mostrar \~2%;
-   Dashboard permanece 0/51 o 0%;
-   KPI indica ausencia de snapshots/recalculate;
-   Health no converge;
-   ISO Express puede decir que no hay normas evaluables.

No "arregles" estas pantallas por separado.

Repara las fuentes y propagación.

------------------------------------------------------------------------

# 11. ISO EXPRESS --- NO OLVIDAR

La revisión histórica identificó una incompatibilidad estructural:

-   identidad comercial/operacional: ejemplo `ISO_27001_2022`
-   identidad normativa/versionada: ejemplo `ISO27001` + `2022`

La vista/readiness de Express llegó a comparar directamente códigos
incompatibles.

El cierre sistémico debe verificar que Express usa el resolver/mapping
normativo canónico.

No resuelvas con regex/string replace dispersos.

Debe existir una sola reconciliación explícita entre ambas identidades.

------------------------------------------------------------------------

# 12. TEST E2E CAUSAL TODAVÍA PENDIENTE

El test mock creado NO es suficiente.

Debes construir/ejecutar evidencia aislada que demuestre:

``` text
MUTACIÓN
→ PERSISTENCIA CANÓNICA
→ SOURCE CONTRACT
→ FÓRMULA OFICIAL
→ calculation_run
→ calculation_output
→ calculation_snapshot
→ metric_snapshot publicado
→ CONSUMIDORES RECONCILIADOS
```

Debe cubrir como mínimo:

-   cumplimiento;
-   evidencia;
-   hallazgo/no conformidad según contrato;
-   acción 20% → 50% → 100%;
-   riesgo P=4, I=5 → inherente 20 según contrato vigente;
-   Tenant A;
-   Tenant B;
-   no leakage;
-   no score artificial 0.

Usa PostgreSQL aislado/local/efímero o harness ya existente.

NO escribas en producción.

------------------------------------------------------------------------

# 13. GATES PENDIENTES

Cuando el código esté completo, ejecutar como mínimo:

``` bash
git diff --check

npm --prefix backend test

npm --prefix frontend run typecheck

node scripts/deploy-vms-strategy.test.js

node scripts/release-rbac/check-release-rbac-contract.js

node scripts/release-rbac/check-residual-role-authority.js

node scripts/release-rbac/check-role-alias-equivalence.js

node scripts/release-rbac/check-frontend-backend-authorization-consistency.js
```

Más tests focales existentes de:

-   officialCalculationOrchestrator;
-   sourceResolver/source contracts;
-   formulas;
-   Health;
-   compliance;
-   evidence;
-   actions;
-   risk matrix;
-   GRC decision center.

No ejecutes suite completa prematuramente si aún estás corrigiendo el
contrato; primero usa tests focales y luego gates finales.

------------------------------------------------------------------------

# 14. SCAN LEGACY FINAL

Al finalizar, demostrar que runtime activo no depende como autoridad de:

``` text
refresh_kpi_health_snapshots
control_health_scores
KPI-HLT
controls_catalog_standards.clause
canonical_health_projection_read_only
```

No borrar historia de migraciones/docs sólo por grep.

Clasifica referencias ejecutables vs históricas.

------------------------------------------------------------------------

# 15. DOCUMENTACIÓN PENDIENTE

Al terminar, actualizar sólo lo necesario:

-   `docs/codex/CURRENT_STATE.md`
-   `docs/codex/WORK_QUEUE.md`
-   `docs/codex/DECISIONS.md`
-   `docs/codex/CONTRACTS_REGISTRY.md`
-   `docs/codex/ARCHITECTURE_MAP.md`
-   `docs/codex/REGRESSION_COMMANDS.md`

Crear:

`docs/codex/handoffs/TCDX-GRC-CALCULATION-ORCHESTRATION-SYSTEMIC-CLOSEOUT.md`

El handoff debe documentar evidencia real, no intención.

------------------------------------------------------------------------

# 16. PROHIBICIONES OPERATIVAS

Durante esta continuación:

``` text
NO commit
NO push
NO merge
NO deploy
NO editar .env
NO escribir producción
NO borrar working tree
NO reset destructivo
NO hardcodes de tenant/ISO/IDs
NO datos demo para hacer pasar tests
NO nueva autoridad matemática
NO nueva autoridad Health
```

No uses `backend/.env` mediante `source`.

Si necesitas cargar variables para una validación, respeta los
mecanismos ya documentados y nunca expongas secretos.

------------------------------------------------------------------------

# 17. SALIDA FINAL

Sólo cuando todas las fases del prompt original estén realmente
completas, responde:

`TCDX_GRC_CALCULATION_ORCHESTRATION_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

Incluye:

-   HEAD base;
-   lista exacta de archivos modificados;
-   root causes confirmados;
-   supuestos del diff anterior confirmados/corregidos/descartados;
-   autoridad final de cumplimiento;
-   autoridad final Health;
-   source contracts;
-   fórmulas;
-   productores conectados;
-   consumidores reconciliados;
-   E2E causal por hecho;
-   Tenant A/B;
-   no leakage;
-   no score inventado;
-   migraciones o confirmación de que no fueron necesarias;
-   todos los gates;
-   `git diff --stat`;
-   `git status --short`;
-   riesgos residuales reales;
-   confirmación expresa de:
    `NO commit / NO push / NO merge / NO deploy / NO .env / NO escritura productiva`.

Si todavía falta una prueba causal, un productor o una reconciliación
cross-view, NO uses READY_FOR_HUMAN_REVIEW.

------------------------------------------------------------------------

# 18. INSTRUCCIÓN FINAL

No gastes recursos redescubriendo lo ya establecido.

Usa el working tree como continuidad material.

Pero tampoco confíes ciegamente en el código inconcluso: fue escrito
antes de completar la verificación de source contracts.

Tu tarea inmediata es:

``` text
AUDITAR DIFF EXISTENTE
→ RESOLVER AUTORIDAD REAL DE COMPLIANCE
→ CORREGIR EL DIFF SI ES NECESARIO
→ COMPLETAR PRODUCTORES/CONSUMIDORES
→ E2E CAUSAL REAL
→ GATES
→ DOCUMENTACIÓN
→ READY_FOR_HUMAN_REVIEW
```

El objetivo no es maximizar cambios.

El objetivo es el menor conjunto de cambios sistémicos que restablezca:

`HECHO GRC → FUENTE OFICIAL → CÁLCULO OFICIAL → SNAPSHOT → PROYECCIÓN CANÓNICA → CONSUMIDORES COHERENTES`.
