# PROMPT CODEX --- CORRECCIÓN FINAL PRE-COMMIT

## TCDX GRC Calculation Orchestration --- revisión humana

Repositorio local: `~/repos/tcdx-iso-saas-v4`

### Estado

Retoma el working tree ACTUAL. No redescubras el proyecto y no descartes
ningún cambio.

Documentos rectores: -
`docs/codex/ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md` -
`docs/codex/prompts/PROMPT_CODEX_CIERRE_SISTEMICO_GRC_CALCULATION_ORCHESTRATION_2026-09-11.md` -
`docs/codex/prompts/PROMPT_CONTINUIDAD_CODEX_CIERRE_SISTEMICO_GRC_2026-09-11.md`

Base original del worktree: `d889fa915ccc46ff932c51fbc69b292f81772974`

NO commit. NO push. NO merge. NO deploy. NO `.env`. NO escritura en
producción. NO reset/stash/restore destructivo.

La revisión humana considera el cierre bien encaminado, pero NO aprobado
para commit todavía.

## 1. Defecto prioritario: semántica post-COMMIT

Varias rutas siguen este patrón:

``` text
mutación
→ COMMIT
→ await publishAffectedOfficialIndicators(...)
→ respuesta
```

y la llamada post-COMMIT permanece dentro del mismo `try/catch` de la
mutación.

Esto puede producir:

``` text
hecho GRC persistido
→ falla propagación analytics
→ catch general
→ HTTP 500
→ cliente cree que la mutación falló
→ posible retry/duplicación
```

Un `ROLLBACK` posterior al COMMIT no revierte el hecho.

Corrige SISTÉMICAMENTE esta semántica en todos los writers tocados.

Contrato requerido:

-   el hecho GRC confirmado debe permanecer durable;
-   una falla posterior de cálculo/publicación NO debe hacer que la API
    represente falsamente que la mutación no fue persistida;
-   la falla de propagación debe quedar explícita/observable en
    `official_recalculation` o contrato equivalente;
-   no ocultar fallas;
-   no crear un segundo motor de retry;
-   no introducir colas nuevas;
-   no envolver el orchestrator en la transacción del hecho sin
    demostrar que ello es seguro;
-   no devolver 500 de "mutación fallida" exclusivamente porque falló
    una propagación que ocurrió después de COMMIT.

Usa una abstracción común si reduce duplicación, pero no crees
arquitectura paralela.

Añade tests que demuestren esta semántica.

## 2. Revisar `recordMappedControlAssurance`

La revisión humana acepta que Diagnóstico/SoA NO creen
`grc_requirement_control_mappings`.

Sin embargo, revisa cuidadosamente esta proyección actual:

-   implementado → score 100
-   parcial → score 50
-   no implementado → score 0

No aceptes esos valores sólo por intuición.

Demuestra que `grc_control_assurance.score` usa exactamente esa escala y
semántica según contrato/schema/tests existentes.

Si existe una autoridad/fórmula ya definida para convertir
implementation status a assurance, reutilízala.

Si NO existe contrato que autorice 100/50/0, NO inventes esos scores. En
ese caso conserva el hecho SoA canónico y deja que el source
contract/fórmula oficial determine la medición por la vía correcta.

No hardcodees política matemática nueva dentro del adaptador.

## 3. Verificar identidad ISO

`recordControlSoAAssessment()` usa `normalizeIsoCode(isoCode)`.

Demuestra con tests que al menos estas identidades soportadas convergen
correctamente cuando corresponda:

-   código operacional/versionado como `ISO_27001_2022`;
-   código normativo `ISO27001`;
-   otras normas soportadas por el catálogo, sin hardcodear sólo
    ISO27001.

No introduzcas regex dispersas si ya existe resolver canónico.

## 4. Verificar historial determinista de `control_soa_assessments`

El resolver fue modificado para consumir la última fila por:
`(tenant_id, tenant_control_id, iso_code)`.

Confirma mediante test PostgreSQL/SQL real que: - múltiples assessments
históricos no producen duplicación matemática; - se selecciona realmente
el último determinísticamente; - `status='applied'` nunca se interpreta
como cumplimiento; - `suggested_implementation_status` y
`suggested_applicable` gobiernan el fallback; - tenant B nunca puede
contaminar tenant A.

## 5. Mantener el adaptador como adaptador

`grcCalculationOrchestration.service.js` puede coordinar:
`indicatorGovernance.calculateIndicator → createSnapshot → publishSnapshot`.

Pero no debe: - implementar fórmulas; - inventar scores; - convertirse
en autoridad Health; - duplicar `officialCalculationOrchestrator`; -
crear source contracts alternativos.

Mantén: - catálogo funcional/formula mapping existente; - métricas base
primero; - dependencias oficiales después; - GRC Health al final sólo si
el contrato vigente lo requiere.

Verifica mediante tests que `DATA-TRUST` y `GRC-HEALTH` no se agregan
por intuición sino por dependencia vigente documentada/codificada.

## 6. KPI recalculate

Mantén eliminada la falsa semántica `factType='scope'`.

El endpoint de recálculo debe usar metric codes explícitos derivados del
catálogo/contrato existente.

No revivas: - `refresh_kpi_health_snapshots` - `control_health_scores` -
`KPI-HLT` - `canonical_health_projection_read_only` como supuesto
refresh.

## 7. Gates que faltan antes de READY

El handoff anterior marcó READY aunque dejó explícitamente: "CI/full
backend/frontend/deploy/runtime permanecen manuales".

Eso NO satisface el prompt rector.

Después de corregir lo anterior, ejecuta los gates completos aplicables:

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

Además: - test focal `grcCalculationOrchestration.service.test.js`; -
PostgreSQL formula-lineage/orchestrator E2E; - tests relevantes de
source contracts, compliance, evidence, actions, risk y Health que ya
existan.

Si un gate falla por defecto real, corrígelo. Si falla sólo por
restricción comprobable del sandbox, documenta evidencia exacta y usa el
mecanismo permitido/no productivo existente; nunca producción.

## 8. Gate causal y reconciliación

No basta el test mock.

Confirma que el PostgreSQL E2E existente demuestra o amplíalo para
demostrar:

`hecho → source contract → fórmula oficial → run/output/snapshot → publicación`

y: - Tenant A; - Tenant B; - leakage 0; - ausencia de medición != 0.

Si el test existente no cubre mutaciones reales de Diagnóstico/SoA,
acción, evidencia y riesgo, añade cobertura focal sin fabricar
comportamiento de producción.

## 9. Scan legacy

Antes de cerrar, clasifica referencias ejecutables e históricas y
demuestra que runtime activo no usa como autoridad:

-   `refresh_kpi_health_snapshots`
-   `control_health_scores`
-   `KPI-HLT`
-   `controls_catalog_standards.clause`
-   `canonical_health_projection_read_only`

No borres referencias históricas/documentales sólo para hacer pasar
grep.

## 10. Handoff

Actualiza:
`docs/codex/handoffs/GRC-CALCULATION-ORCHESTRATION-SYSTEMIC-CLOSEOUT.md`

Corrige su estado: sólo puede quedar READY cuando todos los gates
obligatorios anteriores estén ejecutados y pasen o exista una excepción
ambiental explícitamente permitida y demostrada.

Incluye: - base HEAD; - `git status --short`; - `git diff --stat`; -
archivos modificados/untracked; - correcciones hechas a partir de human
review; - semántica post-COMMIT final; - contrato assurance
confirmado; - identidad ISO; - historial SoA; - source contracts; -
fórmulas; - causal E2E; - Tenant A/B y leakage; - backend tests; -
frontend typecheck; - deploy strategy; - RBAC gates; - legacy scan; -
riesgos residuales.

Sólo si TODO lo requerido está realmente satisfecho termina con:

`TCDX_GRC_CALCULATION_ORCHESTRATION_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW`

y confirma literalmente:

`NO commit / NO push / NO merge / NO deploy / NO .env / NO escritura productiva`

Si queda cualquier gate real pendiente, NO uses READY_FOR_HUMAN_REVIEW.
