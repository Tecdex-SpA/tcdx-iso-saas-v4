# PROMPT CODEX — CIERRE SISTÉMICO DEFINITIVO DE PROPAGACIÓN GRC Y RECONCILIACIÓN CROSS-VIEW
## TCDX ISO SaaS v4

Repositorio: `Tecdex-SpA/tcdx-iso-saas-v4`  
Rama objetivo de trabajo: `main`  
Documento rector obligatorio: `docs/codex/ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md`

---

# 0. MISIÓN

Debes ejecutar un **cierre sistémico integral de reparación funcional** de TCDX ISO SaaS v4.

NO debes agregar funcionalidades nuevas.

NO debes rediseñar el producto.

NO debes crear una arquitectura paralela.

NO debes resolver síntomas aislados con hotfixes independientes.

El objetivo es hacer que **las funcionalidades ya existentes operen correctamente, de punta a punta, sobre la arquitectura canónica que ya existe**.

La plataforma debe quedar funcionalmente orquestada según este contrato:

```text
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

Ésta es la única arquitectura aceptada.

---

# 1. REGLA ABSOLUTA DE CONTINUIDAD

Antes de modificar cualquier archivo:

```bash
cd ~/repos/tcdx-iso-saas-v4

git status --short --branch
git fetch origin --prune
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

El HEAD debe coincidir con el último `origin/main` disponible al iniciar esta ejecución y debe contener como ancestro el commit de documentación sistémica:

```text
afe8f35786b3f8a70919bebd5c6541109b04704a
```

Además deben existir en el checkout:

```text
docs/codex/ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md
docs/codex/prompts/PROMPT_CODEX_CIERRE_SISTEMICO_GRC_CALCULATION_ORCHESTRATION_2026-09-11.md
```

Si el working tree contiene cambios no esperados antes del pull:

- NO ejecutar `git reset --hard`;
- NO borrar trabajo;
- NO sobrescribir cambios;
- informar exactamente qué existe y detenerte si impide continuar con seguridad.

---

# 2. LECTURA OBLIGATORIA ANTES DE PROGRAMAR

Lee completos, no sólo por búsqueda puntual:

```text
docs/codex/ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md
docs/codex/CURRENT_STATE.md
docs/codex/WORK_QUEUE.md
docs/codex/DECISIONS.md
docs/codex/CONTRACTS_REGISTRY.md
docs/codex/ARCHITECTURE_MAP.md
docs/codex/REGRESSION_COMMANDS.md
```

Cuando exista contradicción entre documentos históricos y el documento:

```text
ESTADO_SISTEMICO_TCDX_ISO_SAAS_V4_2026-09-11.md
```

debes verificar el código/runtime vigente y resolver siguiendo la arquitectura canónica aprobada, no reviviendo contratos obsoletos.

---

# 3. DECISIONES ARQUITECTÓNICAS YA APROBADAS — NO REABRIR

Estas cinco decisiones son obligatorias:

1. `officialCalculationOrchestrator` es la vía oficial de recalculación posterior a hechos GRC relevantes.

2. `F5_5_GRC_HEALTH v2` y sus fórmulas/componentes actuales son la autoridad Health.  
   NO revivir:
   - `control_health_scores`;
   - `refresh_kpi_health_snapshots()`;
   - `KPI-HLT-*`;
   - otro motor Health paralelo.

3. Diagnóstico y SoA deben representar evaluación de cumplimiento en la fuente canónica que alimenta las fórmulas oficiales. Un estado visible local que no repercute sistémicamente es un bug.

4. Dashboard, KPI, Health, BI, Reportes, Diagnóstico e IA deben converger sobre los mismos resultados oficiales publicados.

5. Un tenant nuevo comienza en `sin_datos` / `unmeasured` / `insufficient_coverage` según contrato.  
   **Ausencia de medición NO es 0%.**

---

# 4. PRINCIPIO DE NO REGRESIÓN

“No regresión” significa:

> usar correctamente lo existente, avanzar sin romper comportamiento funcional ya válido y sin complejizar el sistema innecesariamente.

NO significa conservar implementaciones obsoletas ni crear capas de compatibilidad indefinidas.

Siempre preferir:

```text
autoridad existente
+ contrato existente
+ integración correcta
```

antes que:

```text
nueva tabla
nueva vista
nuevo endpoint
nuevo score
nuevo fallback
nueva función legacy
```

---

# 5. PROHIBICIONES

Queda prohibido:

- crear funcionalidades nuevas;
- reconstruir módulos que ya existen;
- crear otro orchestrator;
- crear otra autoridad Health;
- calcular scores oficiales en frontend;
- inventar `0` para reemplazar `NULL`;
- hardcodear tenant IDs;
- hardcodear usuarios;
- hardcodear fechas;
- hardcodear una norma ISO concreta como solución transversal;
- crear columnas duplicadas para satisfacer queries antiguas;
- revivir `controls_catalog_standards.clause`;
- tratar `source_type` como autoridad funcional si sólo es provenance;
- restaurar `refresh_kpi_health_snapshots()`;
- restaurar `control_health_scores`;
- restaurar KPI-HLT como autoridad;
- silenciar errores de esquema mediante catch genérico;
- considerar `HTTP 200`, typecheck o tests unitarios como evidencia suficiente de cierre funcional;
- modificar fórmulas oficiales para acomodar un test si el problema real está en fuentes/orquestación;
- generar datos demo para “hacer pasar” escenarios;
- borrar datos reales;
- escribir en producción;
- tocar `.env`;
- commit;
- push;
- merge;
- deploy.

Debes detenerte antes de commit/push/deploy y entregar revisión humana.

---

# 6. OBJETIVO FUNCIONAL CENTRAL

Hoy existe evidencia de que ciertas mutaciones se guardan localmente pero no se propagan:

```text
usuario cambia un hecho GRC
→ la vista local refleja el cambio
→ cálculo oficial no se ejecuta o no recibe la fuente correcta
→ snapshots permanecen viejos/inexistentes
→ Dashboard / Health / KPI / Diagnóstico quedan desalineados
```

Debes reparar esa cadena completa.

El resultado correcto es:

```text
usuario cambia un hecho GRC
→ persiste en su fuente canónica
→ se identifican métricas afectadas
→ officialCalculationOrchestrator ejecuta cálculo oficial
→ calculation_runs
→ calculation_outputs
→ calculation_snapshots
→ metric_snapshots
→ canonical projection
→ todos los consumidores reflejan el mismo estado
```

---

# 7. FASE A — INVENTARIO DE PRODUCTORES REALES

Antes de implementar, construye un inventario exhaustivo de las **mutaciones existentes** que pueden cambiar hechos GRC.

Debes revisar como mínimo:

- Diagnóstico;
- Diagnóstico Express;
- SoA;
- controles;
- aplicabilidad;
- evidencias;
- validación/aprobación/rechazo de evidencia;
- hallazgos;
- no conformidades;
- planes de acción;
- actualizaciones de progreso;
- cierre/completitud de acciones;
- riesgos;
- matriz de riesgos;
- asociaciones riesgo-control;
- efectividad de controles;
- auditorías;
- activación/desactivación de normas;
- activación/desactivación de operaciones;
- continuidad y otros dominios que ya estén conectados a fórmulas/source contracts.

Para cada mutación documenta internamente:

```text
endpoint o service
→ tabla(s) escrita(s)
→ hecho canónico esperado
→ source contract consumido
→ fórmula(s) afectada(s)
→ metric key(s) afectadas
→ cómo se dispara hoy el cálculo
→ consumidor(es) que deberían cambiar
```

No diseñes nada todavía hasta conocer esta cadena real.

---

# 8. FASE B — VERIFICAR SOURCE CONTRACTS Y FÓRMULAS EXISTENTES

Inspecciona la implementación real de:

```text
officialCalculationOrchestrator
official_formula_versions
metric_source_bindings
calculation_runs
calculation_outputs
calculation_snapshots
metric_snapshots
canonicalHealthProjection
```

Localiza las fórmulas oficiales actuales, incluyendo como mínimo:

```text
F5_5_GRC_HEALTH
F5_5_RESIDUAL_RISK
F5_5_COMPLIANCE_WEIGHTED
F5_5_WEIGHTED_PROGRESS
F5_5_FRESHNESS_CONTINUOUS
F5_C3_DATA_TRUST
```

No asumas que los nombres de tablas escritos en este prompt son suficientes: verifica los source contracts reales en código y schema.

Para cada fórmula relevante identifica la fuente exacta que consume.

---

# 9. FASE C — DIAGNÓSTICO / SoA: UNA SOLA VERDAD DE CUMPLIMIENTO

Éste es uno de los focos principales.

Verifica exactamente qué ocurre actualmente cuando un usuario marca un control como:

```text
Cumple
Parcial
No cumple
No evaluado
```

Debes seguir la mutación desde frontend/API hasta persistencia.

Comprueba si se está escribiendo sólo:

```text
tenant_controls.status
```

o si se actualiza también la fuente oficial esperada, por ejemplo:

```text
control_soa_assessments
```

según el contrato real.

La solución debe garantizar:

```text
respuesta diagnóstica
→ autoridad canónica de assessment
→ source contract
→ F5_5_COMPLIANCE_WEIGHTED
→ snapshot oficial
→ Dashboard / Health / KPI / Diagnóstico
```

No arregles Dashboard leyendo directamente un estado operacional si la fórmula oficial usa otra fuente.

Diagnóstico Express debe usar la misma autoridad de cumplimiento que Diagnóstico/SoA.

---

# 10. FASE D — RESTAURAR ORQUESTACIÓN POST-MUTACIÓN

Busca todos los lugares donde una antigua recalculación fue eliminada o reemplazada por read-only/no-op, incluyendo patrones equivalentes a:

```text
canonical_health_projection_read_only
legacy_function_removed
refresh_mode
```

La eliminación de funciones legacy puede ser correcta.

Lo incorrecto es que una operación llamada “recalcular”, “actualizar diagnóstico”, “refresh”, “recalculate” o una mutación relevante ya no produzca cálculo.

Reemplaza esos no-op **sólo donde funcionalmente corresponda** por integración con:

```text
officialCalculationOrchestrator
```

No recalcules indiscriminadamente todo el tenant si existe una forma segura de resolver sólo indicadores afectados.

Pero prima corrección e integridad sobre micro-optimizaciones prematuras.

---

# 11. FASE E — EVIDENCIAS

Traza todas las operaciones existentes relevantes:

```text
crear
asociar
enviar
aprobar
rechazar
validar
vencer
actualizar
```

Verifica que actualicen la fuente oficial que corresponde a:

```text
F5_5_FRESHNESS_CONTINUOUS
F5_C3_DATA_TRUST
```

u otras fórmulas existentes según contratos reales.

No usar:

```text
evidence_count > 0 => 100
```

como autoridad oficial.

Las vistas SQL de Health pueden ser proyecciones, pero no deben sustituir al motor de cálculo.

---

# 12. FASE F — HALLAZGOS Y NO CONFORMIDADES

Traza:

- creación;
- edición relevante;
- severidad;
- apertura;
- cierre;
- vencimiento;
- relación con control;
- relación con auditoría;
- relación con acciones.

Determina mediante source contracts existentes qué métricas deben cambiar.

No inventes una penalización de Health.

Conecta sólo lo que formalmente corresponda a las fórmulas existentes.

---

# 13. FASE G — PLANES DE ACCIÓN

Debes verificar causalmente:

```text
acción creada
→ progreso 20%
→ progreso 50%
→ progreso 100%
→ completada/cerrada
```

La fuente oficial de progreso debe alimentar:

```text
F5_5_WEIGHTED_PROGRESS
```

cuando corresponda.

Debe generarse una nueva medición real si el contrato la afecta.

No basta con que la tabla de acciones muestre el nuevo porcentaje.

---

# 14. FASE H — RIESGOS

Preserva el módulo existente.

Verifica:

```text
P × I
```

para riesgo inherente según contrato vigente.

Verifica:

```text
riesgo
→ relación con control
→ efectividad
→ riesgo residual
→ F5_5_RESIDUAL_RISK
→ GRC Health
```

cuando el contrato real lo defina.

Monte Carlo / Beta-PERT deben mantenerse bajo entitlement y no son requisito para que el cálculo determinista base funcione.

No convertir un 403 comercial legítimo en “error técnico”.

---

# 15. FASE I — ALCANCE / APLICABILIDAD

Conservar el cierre ya realizado:

```text
controls_catalog
controls_catalog_standards como relación
tenant_controls
tenant_applicable_controls
catalog_mode
effective control catalog
```

Debes comprobar que:

- activar/desactivar norma;
- activar/desactivar operación;
- cambiar aplicabilidad;

recalcule correctamente denominadores/alcance de las métricas afectadas.

No crear duplicados.

No borrar exclusiones humanas válidas.

---

# 16. FASE J — IDENTIDAD NORMATIVA

Debes localizar representaciones como:

```text
ISO_27001_2022
ISO27001
ISO27001:2022
```

y verificar si actualmente existe un resolver canónico reutilizable.

Si existe, úsalo.

Si existe fragmentado, consolida la resolución con el mínimo cambio necesario, evitando crear otra autoridad.

Debe reconciliar según contrato real:

```text
tenant_standards
iso_standard_versions
iso_controls
iso_control_catalog_links
controls_catalog
controls_catalog_standards
tenant_controls
control_soa_assessments
```

No modificar códigos persistidos arbitrariamente.

---

# 17. FASE K — CONSUMIDORES

Revisa explícitamente:

```text
Dashboard
Health / Salud ISO
KPI
Diagnóstico
Diagnóstico Express
BI
Reportes
IA Compliance
```

Todos deben consumir resultados canónicos compatibles con el mismo instante lógico de medición.

No significa igual UI.

Sí significa ausencia de verdades incompatibles.

Ejemplo que debe quedar imposible:

```text
Diagnóstico: 1 control cumple
Dashboard: 0 evaluados
Health: 0% artificial
KPI: N/A
```

después de que el cálculo oficial haya sido publicado.

---

# 18. FASE L — HEALTH SIN DATOS

Revisa todas las conversiones como:

```javascript
Number(value || 0)
```

o equivalentes que puedan transformar “sin medición” en cero.

En todos los consumidores canónicos debe preservarse:

```text
NULL
sin_datos
unmeasured
insufficient_coverage
not_configured
not_calculable
```

según corresponda.

`0` sólo es válido cuando una fórmula oficial ejecutada realmente produce 0.

Respeta `minimum_coverage`.

---

# 19. FASE M — IA

IA Compliance debe:

- operar bajo capability/RBAC existentes;
- consumir contexto canónico;
- no inventar score;
- no ser requisito del cálculo determinista;
- degradar correctamente cuando el motor IA esté inaccesible;
- distinguir feature deshabilitada de falla técnica real.

NO ampliar permisos para “hacer que funcione”.

---

# 20. CAMBIOS DE SCHEMA

Antes de crear cualquier migración pregunta técnicamente:

```text
¿el schema actual ya soporta el contrato correcto?
```

Si sí:

**NO crear migración.**

Sólo crear migración si existe una ausencia física real que impide implementar la arquitectura ya aprobada.

Toda migración nueva debe ser:

- multi-tenant;
- idempotente;
- sin datos demo;
- sin hardcodes;
- con runner;
- con checksum;
- con ledger;
- registrada sólo si es estrictamente necesaria.

---

# 21. TEST E2E CAUSAL OBLIGATORIO

Éste es el gate que faltó históricamente.

Debes crear una prueba reproducible que demuestre:

```text
MUTACIÓN
→ PERSISTENCIA CANÓNICA
→ SOURCE CONTRACT
→ CÁLCULO OFICIAL
→ SNAPSHOT
→ CONSUMIDORES
```

No mocks superficiales de la cadena.

Debe existir evidencia PostgreSQL aislada o fixture realista controlado.

## Tenant A

Usar un tenant aislado de test.

Configurar una norma soportada y controles aplicables.

Estado inicial:

```text
controles presentes
sin evaluación
```

Esperado:

```text
no score artificial 0
sin_datos/unmeasured/insufficient_coverage
```

### Mutación 1 — cumplimiento

```text
control → Cumple
```

Probar:

```text
assessment canónico guardado
calculation_run nuevo
calculation_output nuevo
snapshot nuevo
métrica de cumplimiento actualizada
consumidores reconciliados
```

### Mutación 2 — evidencia

Agregar/aprobar evidencia válida.

Probar cambio sólo en métricas oficialmente asociadas.

### Mutación 3 — hallazgo

Abrir y luego cerrar un hallazgo.

Probar efectos oficiales definidos.

### Mutación 4 — plan de acción

```text
20% → 50% → 100%
```

Probar evolución de remediación.

### Mutación 5 — riesgo

```text
P=4
I=5
```

Probar inherente = 20 según contrato vigente.

Luego asociación/control/efectividad y riesgo residual cuando corresponda.

## Tenant B

Crear un segundo tenant aislado con configuración diferente.

Preferentemente otra norma soportada para demostrar transversalidad.

Probar:

```text
sin leakage
catálogo independiente
assessment independiente
runs independientes
snapshots independientes
resultados independientes
```

No usar IDs productivos.

---

# 22. RECONCILIACIÓN CROSS-VIEW AUTOMATIZADA

La prueba debe verificar que, después de cada mutación relevante, los valores o estados expuestos por los servicios detrás de:

```text
Dashboard
Health
KPI
Diagnóstico
BI/Reportes cuando corresponda
IA cuando presenta contexto cuantitativo
```

provengan del mismo resultado oficial o sean matemáticamente consistentes con él.

No se acepta simplemente comprobar que todos responden HTTP 200.

---

# 23. REGRESIÓN EXISTENTE

Debes conservar y volver a ejecutar los gates ya existentes.

Como mínimo:

```bash
git diff --check

npm --prefix backend test

npm --prefix frontend run typecheck

node scripts/deploy-vms-strategy.test.js

node scripts/release-rbac/check-release-rbac-contract.js

node scripts/release-rbac/check-residual-role-authority.js

node scripts/release-rbac/check-role-alias-equivalence.js

node scripts/release-rbac/check-frontend-backend-authorization-consistency.js
```

Además ejecuta los tests específicos relevantes que ya existan para:

- officialCalculationOrchestrator;
- fórmulas oficiales;
- source resolver;
- GRC decision center;
- risk matrix;
- compliance;
- evidence;
- actions;
- canonical Health.

Si un test existente contradice la arquitectura aprobada, no lo “hagas pasar” a ciegas: explica la contradicción y corrige la regresión real.

---

# 24. SCAN DE AUTORIDADES LEGACY

Al finalizar, demuestra que runtime activo no depende como autoridad de:

```text
refresh_kpi_health_snapshots
control_health_scores
KPI-HLT
controls_catalog_standards.clause
```

Las referencias históricas en migraciones/demo/docs antiguos pueden existir si son patrimonio histórico y no runtime activo.

No borres historia innecesariamente.

---

# 25. DOCUMENTACIÓN DE CONTINUIDAD

Actualiza sólo lo necesario en:

```text
docs/codex/CURRENT_STATE.md
docs/codex/WORK_QUEUE.md
docs/codex/DECISIONS.md
docs/codex/CONTRACTS_REGISTRY.md
docs/codex/ARCHITECTURE_MAP.md
docs/codex/REGRESSION_COMMANDS.md
```

Crea un handoff nuevo, por ejemplo:

```text
docs/codex/handoffs/TCDX-GRC-CALCULATION-ORCHESTRATION-SYSTEMIC-CLOSEOUT.md
```

Debe contener:

- root causes confirmados;
- arquitectura final;
- productores reparados;
- source contracts usados;
- fórmulas afectadas;
- consumidores reconciliados;
- archivos modificados;
- migración si realmente fue necesaria;
- tests;
- resultados E2E;
- riesgos residuales.

---

# 26. CRITERIO DE ÉXITO

No declares éxito por:

```text
compila
typecheck pasa
tests unitarios pasan
no hay 500
deploy levanta
```

El cierre sólo está listo para human review si demuestras causalmente:

```text
hecho GRC
→ fuente correcta
→ fórmula correcta
→ calculation_run
→ calculation_output
→ snapshot
→ publicación
→ Dashboard / Health / KPI / Diagnóstico reconciliados
```

y lo haces al menos para:

```text
cumplimiento
evidencia
hallazgo/no conformidad según contrato
plan de acción
riesgo
```

más aislamiento entre dos tenants.

---

# 27. NO PRODUCCIÓN

Durante este trabajo:

```text
NO editar .env
NO conectar/escribir tcdx_saasv2
NO ejecutar deploy
NO commit
NO push
NO merge
```

Puedes usar PostgreSQL aislado/local/efímero para pruebas.

Si necesitas validar algo productivo que sólo pueda comprobarse allí, detente y entrega el comando exacto para revisión humana; no lo ejecutes tú.

---

# 28. SALIDA FINAL OBLIGATORIA

Tu respuesta final debe tener exactamente este enfoque:

```text
TCDX_GRC_CALCULATION_ORCHESTRATION_SYSTEMIC_CLOSEOUT_READY_FOR_HUMAN_REVIEW
```

y resumir:

1. HEAD base.
2. Git status.
3. Root causes confirmados.
4. Qué hipótesis del documento rector fueron verificadas y cuáles descartadas.
5. Autoridad final de cumplimiento.
6. Autoridad final de Health.
7. Cómo quedó la orquestación post-mutación.
8. Productores reparados.
9. Source contracts involucrados.
10. Fórmulas oficiales involucradas.
11. Consumidores reconciliados.
12. Resultado E2E causal por cada tipo de hecho.
13. Resultado Tenant A.
14. Resultado Tenant B.
15. Evidencia de no leakage.
16. Evidencia de no score inventado.
17. Migraciones creadas o confirmación de que no fueron necesarias.
18. Gates ejecutados y resultado.
19. `git diff --stat`.
20. `git status --short`.
21. Riesgos residuales reales, no hipotéticos.
22. Confirmación expresa:

```text
NO commit
NO push
NO merge
NO deploy
NO .env
NO escritura productiva
```

---

# 29. RECORDATORIO FINAL

No estamos construyendo otra plataforma.

No estamos agregando producto.

No estamos parcheando pantallas.

Estamos terminando correctamente la arquitectura que ya existe.

La pregunta rectora para cada cambio debe ser:

> ¿Este cambio conecta un hecho GRC existente con la autoridad canónica existente y hace que todos los consumidores vean el mismo resultado oficial, sin introducir otra fuente de verdad?

Si la respuesta es no, no implementes ese cambio.
