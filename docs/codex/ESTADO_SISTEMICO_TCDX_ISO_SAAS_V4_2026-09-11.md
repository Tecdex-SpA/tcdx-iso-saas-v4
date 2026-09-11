# TCDX ISO SaaS v4 — Estado sistémico, hallazgos, conclusiones y guía de reparación

**Fecha de consolidación:** 2026-09-11  
**Repositorio:** `Tecdex-SpA/tcdx-iso-saas-v4`  
**Rango histórico revisado:** `7c9a183306845f91d5fb87a9466273a501128348` → `56c38f482bdd7a9527d1e9aaabf961ae963c7308`  
**Objetivo del documento:** servir como guía técnica obligatoria para el cierre sistémico definitivo de TCDX ISO SaaS v4, evitando nuevas divergencias, arquitecturas paralelas, hotfixes aislados o funcionalidades nuevas no solicitadas.

---

## 1. Propósito y regla rectora

Este documento no define funcionalidades nuevas.

Su propósito es establecer con precisión:

- qué arquitectura ya existe y debe conservarse;
- qué regresiones se introdujeron durante la evolución del repositorio;
- qué autoridades de datos y cálculo son las correctas;
- qué piezas legacy no deben revivirse;
- cómo deben conectarse los productores de hechos GRC con el cálculo oficial;
- cómo deben consumir los resultados Dashboard, Health, KPI, Diagnóstico, BI, Reportes e IA;
- qué pruebas deben demostrar que la plataforma funciona realmente como producto integrado.

La regla central es:

> **No agregar funcionalidades nuevas. No simplificar destruyendo comportamiento existente. No crear autoridades paralelas. Reparar la orquestación de lo que ya existe para que el sistema avance sin retroceder ni complejizarse.**

---

## 2. Estado general del producto

TCDX ISO SaaS v4 no está estructuralmente perdido y no debe reconstruirse desde cero.

La revisión histórica muestra que el sistema ya contiene la mayor parte de la arquitectura funcional necesaria:

- multi-tenancy;
- RBAC;
- planes y capacidades comerciales;
- catálogo ISO y catálogo operacional;
- SoA y diagnóstico;
- evidencias;
- hallazgos;
- no conformidades;
- planes de acción;
- riesgos;
- auditorías;
- continuidad y otros dominios GRC;
- fórmulas oficiales;
- source contracts;
- motor de cálculo oficial;
- snapshots de cálculo;
- proyección canónica de Health;
- Dashboard, KPI, BI, Reportes e IA como consumidores.

El defecto principal no es la ausencia de funcionalidades, sino una **ruptura de la cadena de propagación funcional** entre hechos GRC y resultados oficiales.

En términos simples:

```text
hecho operacional guardado
        ↓
la vista local puede mostrarlo
        ↓
pero el motor oficial no siempre recalcula
        ↓
snapshots permanecen antiguos o inexistentes
        ↓
Dashboard / Health / KPI / Reportes quedan desalineados
```

---

## 3. Veredicto técnico principal

Durante la evolución del producto se construyeron progresivamente mejores autoridades de datos y cálculo.

Sin embargo, al retirar mecanismos legacy, no todos los productores, disparadores y consumidores fueron migrados de manera atómica hacia la nueva arquitectura.

El patrón de regresión fue:

```text
autoridad legacy existente
        ↓
se crea autoridad canónica nueva
        ↓
se elimina la pieza legacy
        ↓
algunos consumidores/productores quedan desconectados
        ↓
se reemplaza error técnico por comportamiento read-only/no-op
        ↓
el sistema compila y pasa tests aislados
        ↓
pero la operación funcional deja de propagarse
```

Esto explica que un deploy pueda finalizar correctamente, sin 5xx ni errores de esquema, y aun así el usuario vea:

- controles que cambian sólo en la vista local;
- Dashboard que permanece en 0 o sin actualización;
- Health que no refleja acciones realizadas;
- Diagnóstico o Diagnóstico Express sin efecto sistémico;
- riesgos, evidencias, hallazgos o acciones que no modifican adecuadamente el estado global.

---

## 4. Contrato sistémico definitivo aprobado

La arquitectura funcional aprobada para el cierre es la siguiente:

```text
┌─────────────────────────────────────────────┐
│             CONFIGURACIÓN TENANT            │
│ plan / módulos / normas / RBAC / unidades   │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│             ALCANCE APLICABLE               │
│ tenant_standards                            │
│ tenant_operations                           │
│ effective control catalog                   │
│ tenant_controls                             │
│ tenant_applicable_controls                  │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│              HECHOS GRC                     │
│                                             │
│ SoA / diagnóstico                           │
│ Evidencias                                  │
│ Hallazgos                                   │
│ No conformidades                            │
│ Planes de acción                            │
│ Riesgos                                     │
│ Auditorías                                  │
│ Continuidad / otros dominios                │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
          SOURCE CONTRACTS OFICIALES
                      │
                      ▼
┌─────────────────────────────────────────────┐
│     officialCalculationOrchestrator         │
│                                             │
│    UNA SOLA AUTORIDAD DE CÁLCULO            │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
             calculation_runs
             calculation_outputs
             calculation_snapshots
             metric_snapshots
                      │
                      ▼
             CANONICAL PROJECTION
                      │
      ┌───────────────┼─────────────────┐
      ▼               ▼                 ▼
 Dashboard          Health             KPI
      │               │                 │
      ├──────── Diagnóstico ────────────┤
      ├──────── BI / Reportes ──────────┤
      └────────────── IA ───────────────┘
```

Este contrato debe tratarse como **invariante arquitectónica**.

---

## 5. Cinco decisiones arquitectónicas ya validadas

Las siguientes decisiones quedan aprobadas y no deben reabrirse durante el cierre:

1. `officialCalculationOrchestrator` será la vía oficial para recalcular métricas después de hechos GRC relevantes.

2. `F5_5_GRC_HEALTH v2` y sus componentes actuales seguirán siendo la autoridad Health. No se debe revivir `KPI-HLT-*`, `control_health_scores` ni mecanismos equivalentes como nueva autoridad.

3. Diagnóstico y SoA deben representar evaluación de cumplimiento en la fuente canónica consumida por las fórmulas oficiales. No debe existir un estado visual aislado que no repercuta en el motor oficial.

4. Dashboard, KPI, Health, BI, Reportes, Diagnóstico e IA deben converger sobre las mismas mediciones publicadas.

5. Un tenant nuevo comienza en estado **sin datos / no medido**, no en `0%`. Sólo debe obtener valores cuando existan hechos reales suficientes para calcularlos.

---

## 6. Autoridad oficial de Health

La evolución del repositorio estableció correctamente una autoridad canónica basada en:

```text
official_formula_versions
+
calculation_runs
+
calculation_outputs
+
metric_snapshots
+
metric_source_bindings
```

La fórmula global oficial es:

```text
F5_5_GRC_HEALTH v2
```

Con componentes actuales:

```text
Riesgo          20% → F5_5_RESIDUAL_RISK
Cumplimiento    25% → F5_5_COMPLIANCE_WEIGHTED
Acciones        15% → F5_5_WEIGHTED_PROGRESS
Evidencia       20% → F5_5_FRESHNESS_CONTINUOUS
Data Trust      20% → F5_C3_DATA_TRUST
```

La existencia de `canonicalHealthProjection.service.js` fue una decisión correcta y debe mantenerse.

La proyección canónica debe **leer y presentar resultados oficiales**, no transformarse en un motor alternativo de cálculo.

---

## 7. Cadena funcional probada en la base limpia

El trabajo de baseline limpio ya había demostrado una cadena coherente:

```text
tenant
   ↓
tenant_standards
   ↓
tenant_operations
   ↓
tenant_controls
   ↓
control_soa_assessments
   ↓
evidences
   ↓
action_plans / action_plan_updates
   ↓
risks / risk_control_relations
   ↓
officialCalculationOrchestrator
   ↓
calculation_runs
   ↓
calculation_outputs
   ↓
calculation_snapshots
   ↓
metric_snapshots
   ↓
Health projection / API consumers
```

Esta cadena fue utilizada en pruebas con tenants separados y resultados diferenciados, sin leakage cross-tenant.

Por lo tanto, el problema no es diseñar una cadena nueva: es hacer que **todas las operaciones reales de producción utilicen la cadena ya definida**.

---

## 8. Regresión crítica identificada: reemplazo de recalculación por no-op/read-only

Uno de los defectos más importantes aparece en cierres recientes.

Existían consumidores que anteriormente ejecutaban mecanismos de refresh como:

```sql
SELECT *
FROM refresh_kpi_health_snapshots($1::uuid)
```

Eliminar esa función legacy era correcto.

El error fue reemplazarla, en algunos puntos, por respuestas equivalentes a:

```javascript
{
  tenant_id: tenantId,
  refresh_mode: 'canonical_health_projection_read_only',
  legacy_function_removed: true
}
```

Ese cambio elimina el fallo SQL, pero también elimina la operación funcional.

Resultado:

```text
usuario solicita recalcular
        ↓
no existe 500
        ↓
pero tampoco existe recalculación
        ↓
se leen snapshots antiguos o inexistentes
```

El cierre debe eliminar estos no-op funcionales y sustituirlos por la ruta oficial de cálculo.

---

## 9. Error conceptual adicional: estado operacional vs fuente canónica

Un dato guardado no necesariamente es la fuente consumida por la fórmula oficial.

Ejemplo crítico:

```text
tenant_controls.status
```

puede existir como estado operacional o de presentación, mientras el contrato de cumplimiento oficial obtiene sus hechos desde:

```text
control_soa_assessments
```

Por tanto, si Diagnóstico permite marcar:

- Cumple;
- Parcial;
- No cumple;
- No evaluado;

la acción debe impactar la entidad canónica que alimenta `F5_5_COMPLIANCE_WEIGHTED`.

El flujo correcto debe ser:

```text
Diagnóstico / SoA
        ↓
control_soa_assessments
        ↓
source contract oficial
        ↓
F5_5_COMPLIANCE_WEIGHTED
        ↓
COMPLIANCE
        ↓
F5_5_GRC_HEALTH
```

No se debe “arreglar” haciendo que Dashboard lea directamente `tenant_controls.status` si ésa no es la autoridad formal.

---

## 10. Catálogo ISO y catálogo operacional

Debe mantenerse la separación entre:

```text
iso_controls
```

como catálogo normativo/versionado, y:

```text
controls_catalog
```

como catálogo operacional reutilizable por la plataforma.

La relación entre ambos debe permanecer gobernada mediante mapping explícito.

`controls_catalog_standards` debe ser tratada como una **tabla relacional**, no como duplicado del control.

Su semántica debe ser:

> este control operacional está relacionado/aplica a esta norma.

Por lo tanto:

- no debe duplicar `clause` si la autoridad del control está en `controls_catalog`;
- no debe transformarse en una segunda fuente descriptiva del control;
- no debe competir con `iso_controls` ni `controls_catalog`.

Las correcciones recientes que eliminaron dependencias como `ccs.clause` son conceptualmente correctas y deben conservarse.

---

## 11. Identidad normativa y aliases

Durante la evolución se utilizaron distintas representaciones para normas y versiones, por ejemplo:

```text
ISO_27001_2022
ISO27001
ISO27001:2022
```

No deben tratarse como normas independientes.

Debe existir un único resolver canónico que reconcilie:

```text
tenant_standards
        ↕
iso_standard_versions
        ↕
iso_controls
        ↕
iso_control_catalog_links
        ↕
controls_catalog
        ↕
tenant_controls
        ↕
control_soa_assessments
```

No se deben introducir hardcodes por tenant, IDs específicos, fechas específicas ni excepciones comerciales ad hoc.

---

## 12. Diagnóstico y Diagnóstico Express

El historial demuestra que estas funciones ya fueron desarrolladas en distintas etapas:

- Diagnóstico Express;
- diagnóstico determinista reforzado;
- enriquecimiento contextual con IA;
- UI reforzada;
- integración con controles y Health.

Por tanto, el objetivo no es reescribirlas como funcionalidades nuevas.

La reparación debe asegurar que:

```text
selección norma
→ alcance correcto
→ preguntas/controles correctos
→ respuesta guardada en fuente canónica
→ recalculación oficial
→ snapshots publicados
→ Dashboard/Health/KPI/Diagnóstico reconciliados
```

Diagnóstico Express puede tener una experiencia distinta, pero no una autoridad de cumplimiento distinta.

---

## 13. Evidencias

La evolución histórica demuestra que el producto llegó a tener flujo de evidencia integrado con actualización de Health.

La arquitectura correcta debe preservar esta semántica:

```text
evidencia creada
→ asociada al control/entidad correspondiente
→ validada/aprobada/rechazada
→ vigencia y calidad evaluadas
→ source contract de evidencia actualizado
→ F5_5_FRESHNESS_CONTINUOUS / Data Trust según corresponda
→ recalculación oficial
→ nuevos snapshots
→ consumidores actualizados
```

No toda evidencia debe equivaler automáticamente a 100% de salud.

Las vistas pueden contar evidencias y mostrar estados, pero no deben inventar puntuaciones oficiales fuera del motor de cálculo.

---

## 14. Hallazgos y no conformidades

Los hallazgos y no conformidades forman parte de los hechos GRC y deben permanecer orquestados.

Como mínimo, cambios relevantes como:

- creación;
- severidad;
- apertura;
- cierre;
- vencimiento;
- relación con acciones;
- relación con auditorías/controles;

deben afectar los contratos oficiales que correspondan.

La fórmula y el source contract, no la vista visual, determinan el impacto exacto.

No se debe crear una fórmula nueva sólo para “hacer que se vea reflejado” si ya existe una fórmula oficial aplicable.

---

## 15. Planes de acción y remediación

La autoridad de progreso debe provenir de hechos reales de acción.

Flujo esperado:

```text
acción creada
→ responsable / plazo / estado
→ actualizaciones reales de progreso
→ action_plan_updates
→ source contract de remediación
→ F5_5_WEIGHTED_PROGRESS
→ ACTIONS / REMEDIATION
→ F5_5_GRC_HEALTH cuando corresponda
```

Un cambio de progreso de 20% a 80% debe ser capaz de producir un resultado diferente si el resto de las condiciones permanece constante.

---

## 16. Riesgos

No se debe reconstruir el módulo de riesgo.

La evolución ya consolidó:

- matriz de riesgo;
- probabilidad e impacto;
- riesgo inherente;
- controles relacionados;
- efectividad;
- riesgo residual;
- Monte Carlo;
- Beta-PERT;
- integración con GRC.

La semántica base aprobada continúa siendo:

```text
riesgo inherente = Probabilidad × Impacto
```

cuando corresponde al contrato de la matriz.

El impacto en Health debe producirse mediante la métrica oficial de riesgo, especialmente:

```text
F5_5_RESIDUAL_RISK
```

Monte Carlo y Beta-PERT son capacidades complementarias y deben respetar plan/entitlements.

Un módulo no contratado debe producir un estado controlado de capacidad no habilitada, no un error técnico ni un valor inventado.

---

## 17. Auditorías, continuidad y otros dominios

El mismo principio aplica al resto de dominios GRC.

Cada dominio debe:

```text
registrar hechos reales
→ exponerlos mediante su source contract oficial
→ usar fórmula oficial existente cuando corresponda
→ publicar snapshots
→ alimentar consumidores
```

No todos los dominios deben afectar necesariamente `GRC-HEALTH` de forma directa.

El impacto exacto debe respetar las fórmulas, bindings y contratos oficiales ya registrados.

---

## 18. IA Compliance y motor IA

La IA no debe ser autoridad de score.

Su rol es:

```text
leer contexto
→ analizar
→ explicar
→ recomendar
→ proponer acciones
```

No debe:

```text
inventar cumplimiento
inventar riesgo
alterar Health unilateralmente
crear scores oficiales fuera del orchestrator
```

El flujo correcto es:

```text
hechos reales
→ cálculo oficial
→ snapshots
→ canonical projection
→ contexto IA
→ explicación/recomendación
```

La caída del AI Engine no debe impedir el funcionamiento determinista de:

- Diagnóstico;
- Riesgo;
- Health;
- Dashboard;
- KPI;
- operaciones GRC básicas.

Los entitlements y RBAC de IA deben mantenerse.

---

## 19. Qué NO se debe revivir

El cierre sistémico no debe restaurar autoridades legacy sólo para recuperar comportamiento.

No revivir como autoridad:

```text
control_health_scores
refresh_kpi_health_snapshots()
KPI-HLT-* como score canónico
scores calculados directamente en frontend
scores inventados en vistas SQL de compatibilidad
```

La eliminación de esas autoridades fue correcta.

Lo incorrecto fue no conectar todos los productores a la autoridad nueva.

---

## 20. Vistas Health recientes

Las vistas de Health creadas para compatibilidad pueden conservarse si sirven como:

- agregaciones;
- consultas de lectura;
- proyecciones;
- compatibilidad con consumidores existentes.

Pero no deben convertirse en nuevas autoridades de cálculo.

Regla:

```text
vista SQL = proyecta / organiza
orchestrator = calcula
snapshot = publica resultado oficial
canonical projection = expone resultado
```

Por ejemplo, una regla como:

```sql
WHEN evidence_count > 0 THEN 100
```

no debe utilizarse como score oficial si la métrica oficial de evidencia tiene otra semántica.

---

## 21. Regla de no inventar cero

Regla absoluta:

```text
SIN MEDICIÓN ≠ 0
```

Estados aceptables según contrato:

```text
NULL
sin_datos
unmeasured
insufficient_coverage
not_configured
not_calculable
```

`0` sólo es válido cuando una fórmula oficial ejecutada con datos reales produce cero.

Esto es especialmente importante para tenants recién creados o alcances recién activados.

---

## 22. Mutaciones que deben disparar recalculación

No toda escritura en la base de datos debe iniciar una recalculación global.

Sí deben hacerlo las mutaciones que cambian fuentes oficiales.

Como mínimo revisar y asegurar propagación para:

| Hecho existente | Resultado potencial |
|---|---|
| Evaluar control / SoA | Cumplimiento / cobertura |
| Cambiar respuesta diagnóstica | Cumplimiento |
| Cambiar aplicabilidad | Alcance / denominadores |
| Aprobar/rechazar evidencia | Evidencia / Data Trust / Health |
| Vencer evidencia | Evidencia / Health |
| Crear/cambiar hallazgo | Severidad / acciones / indicadores asociados |
| Cerrar hallazgo | Severidad / acciones |
| Crear/cambiar no conformidad | Cumplimiento/remediación según contrato |
| Crear plan de acción | Remediación |
| Actualizar progreso | Remediación |
| Completar/cerrar acción | Remediación |
| Crear/modificar riesgo | Riesgo inherente/residual |
| Asociar control a riesgo | Riesgo residual |
| Cambiar efectividad de control | Riesgo residual |
| Activar/desactivar norma | Recalcular alcance completo |
| Activar/desactivar operación | Recalcular alcance afectado |

Después de una mutación relevante, la secuencia debe ser:

```text
persistir hecho
→ commit transaccional coherente
→ identificar métricas afectadas
→ officialCalculationOrchestrator
→ calculation_runs / outputs / snapshots
→ metric_snapshots
→ canonical projection actualizada
→ respuesta al consumidor
```

Evitar recalcular todo indiscriminadamente si el motor ya puede determinar indicadores afectados.

---

## 23. Problema de testing identificado

Los gates existentes se concentraron fuertemente en:

- sintaxis;
- typecheck;
- schema;
- checksum;
- RBAC;
- tenant isolation;
- funciones individuales;
- migraciones;
- PostgreSQL aislado;
- contratos estáticos;
- ausencia de referencias legacy.

Esos tests son útiles pero insuficientes.

Faltó demostrar de forma obligatoria:

```text
MUTACIÓN REAL
→ CÁLCULO
→ PUBLICACIÓN
→ RECONCILIACIÓN CROSS-VIEW
```

Por esta razón podían coexistir:

```text
backend test PASS
frontend typecheck PASS
RBAC PASS
migration PASS
```

con:

```text
marcar control como Cumple
→ Dashboard no cambia
```

El cierre debe corregir esta deficiencia de pruebas.

---

## 24. Gate E2E funcional mínimo obligatorio

Antes de declarar el sistema listo para comercialización, debe existir una prueba sistémica reproducible.

### 24.1 Tenant A — ISO 27001

Estado inicial esperado:

```text
norma activa
controles aplicables presentes
ninguno evaluado
```

Resultado esperado:

```text
Cumplimiento = sin_datos/no medido
Health = sin_datos/no medido o insufficient_coverage
NO score artificial 0
```

### 24.2 Evaluación de un control

Acción:

```text
control A.x → Cumple
```

Debe comprobarse:

```text
assessment canónico guardado
→ source contract actualizado
→ fórmula ejecutada
→ calculation_run creado
→ calculation_output creado
→ snapshots publicados
→ Dashboard reconciliado
→ Health reconciliado
→ KPI reconciliado
→ Diagnóstico reconciliado
```

### 24.3 Evidencia

Acción:

```text
evidencia creada/aprobada/vigente
```

Debe cambiar únicamente los componentes oficiales correspondientes.

### 24.4 Hallazgo

Acción:

```text
hallazgo abierto
```

Debe afectar las métricas oficiales que correspondan.

Luego:

```text
hallazgo cerrado
```

Debe producir una nueva medición cuando aplique.

### 24.5 Plan de acción

Secuencia:

```text
acción creada
→ 20%
→ 50%
→ 100% / completada
```

Debe observarse evolución real de la métrica de remediación.

### 24.6 Riesgo

Ejemplo:

```text
Probabilidad = 4
Impacto = 5
```

Debe calcular correctamente riesgo inherente.

Luego asociar control y efectividad real.

Debe actualizar riesgo residual y componentes de GRC Health cuando corresponda.

### 24.7 Tenant B

Crear/usar un segundo tenant con otra configuración normativa.

Verificar:

```text
catálogo independiente
aplicabilidad independiente
evaluaciones independientes
métricas independientes
snapshots independientes
NO cross-tenant leakage
```

---

## 25. Reconciliación cross-view obligatoria

Para el mismo tenant y mismo instante lógico de medición deben coincidir las fuentes oficiales expuestas en:

- Dashboard;
- Health;
- KPI;
- Diagnóstico;
- Diagnóstico Express;
- BI;
- Reportes;
- IA Compliance cuando muestre contexto cuantitativo.

No significa que todas las vistas tengan exactamente el mismo layout o nivel de detalle.

Significa que no pueden mostrar verdades incompatibles.

Ejemplo inválido:

```text
Diagnóstico: 1 control cumple
Dashboard: 0 evaluados
Health: 0% artificial
KPI: N/A
```

si todos están consultando el mismo tenant y el cálculo oficial ya fue ejecutado.

---

## 26. Qué debe conservarse del trabajo reciente

No se debe desechar el cierre técnico reciente.

Conservar:

- fresh baseline `tcdx_saasv2`;
- migraciones registradas e idempotentes;
- lifecycle de catálogo y controles;
- función de catálogo efectivo;
- deduplicación;
- `controls_catalog_standards` como relación;
- `source_type` / provenance;
- `catalog_mode`;
- multi-tenant isolation;
- RBAC canónico;
- entitlements comerciales;
- `canonicalHealthProjection`;
- registry de fórmulas oficiales;
- `officialCalculationOrchestrator`;
- source contracts;
- calculation ledger y snapshots;
- correcciones de incompatibilidad de schema;
- estados `sin_datos`/equivalentes;
- estrategia de deploy `fresh-baseline`;
- guards de DB y runtime role;
- eliminación de referencias legacy realmente obsoletas.

---

## 27. Cinco frentes de reparación sistémica

El cierre debe concentrarse en cinco frentes, no en múltiples hotfixes aislados.

### Frente 1 — Restaurar propagación operacional

Toda mutación GRC relevante debe:

```text
actualizar su hecho canónico
→ invalidar/recalcular métricas afectadas
→ officialCalculationOrchestrator
→ publicar snapshots
```

Eliminar no-op read-only introducidos como sustitutos de refresh legacy.

### Frente 2 — Reconciliar Diagnóstico / SoA

Validar exactamente dónde escribe cada acción de Diagnóstico y Diagnóstico Express.

Debe existir una sola autoridad funcional para evaluación de cumplimiento.

No dejar estados duplicados inconexos entre:

```text
tenant_controls
control_soa_assessments
otras tablas auxiliares
```

### Frente 3 — Normalizar identidad normativa

Definir y usar un resolver canónico único para norma/versiones/aliases.

Debe funcionar para cualquier tenant soportado sin IDs hardcodeados.

### Frente 4 — Convertir consumidores en consumidores reales

Dashboard, Health, KPI, BI, Reportes, Diagnóstico e IA deben leer resultados canónicos.

No deben recalcular scores propios ni depender de funciones legacy eliminadas.

### Frente 5 — Crear gate E2E causal

No aprobar release sólo con pruebas unitarias/contractuales.

Debe pasar el flujo:

```text
hecho GRC
→ cálculo oficial
→ snapshot
→ consumidores reconciliados
```

para al menos dos tenants.

---

## 28. Prohibiciones para el cierre

El trabajo de reparación NO debe:

1. agregar nuevos módulos de producto;
2. agregar nuevas funcionalidades no necesarias para reparar comportamiento existente;
3. crear una segunda arquitectura de Health;
4. crear un segundo orchestrator;
5. volver a usar `control_health_scores` como autoridad;
6. volver a crear `refresh_kpi_health_snapshots()` sólo para compatibilidad;
7. calcular scores en frontend;
8. inventar valores para evitar `NULL`;
9. hardcodear tenant IDs;
10. hardcodear fechas;
11. hardcodear una norma específica como solución general;
12. duplicar columnas/contratos sólo para satisfacer una query antigua;
13. mantener silenciosamente errores de schema mediante catch genéricos;
14. silenciar typos o columnas inexistentes fuera de fallbacks explícitamente permitidos;
15. modificar fórmulas oficiales para hacer pasar un test si el problema es de fuente/orquestación;
16. modificar fixtures esperados para acomodar un resultado incorrecto;
17. crear migraciones innecesarias si el schema actual ya soporta el contrato correcto;
18. hacer deploy o cambios productivos durante la implementación sin gate humano previo;
19. considerar `typecheck PASS` o `HTTP 200` como prueba de funcionamiento funcional completo;
20. declarar cierre mientras una mutación no se refleje de forma coherente en sus consumidores.

---

## 29. Criterio de eficiencia

“No regresión” significa:

> avanzar usando correctamente las capacidades existentes, sin retroceder y sin introducir complejidad innecesaria.

No significa:

- conservar bugs históricos;
- mantener funciones muertas;
- añadir capas de compatibilidad indefinidas;
- crear tablas nuevas para cada síntoma;
- parchear cada vista por separado.

Toda reparación debe preferir:

```text
una autoridad existente
+
un contrato existente
+
una integración correcta
```

antes que:

```text
nueva tabla
nueva vista
nuevo endpoint
nuevo score
nuevo fallback
```

---

## 30. Secuencia técnica recomendada para el cierre

### Etapa A — Inventario de productores

Mapear todas las mutaciones reales existentes en:

- SoA;
- Diagnóstico;
- Diagnóstico Express;
- evidencias;
- hallazgos;
- no conformidades;
- planes de acción;
- riesgos;
- auditorías;
- continuidad;
- aplicabilidad;
- activación de normas y operaciones.

Para cada una documentar:

```text
endpoint/service
→ tablas escritas
→ source contract esperado
→ fórmulas afectadas
→ métricas publicadas
```

### Etapa B — Corregir autoridad de escritura

Cada operación debe escribir en la entidad canónica apropiada.

Eliminar duplicidades que no tengan función contractual real.

### Etapa C — Orquestación

Después de commit de una mutación relevante:

```text
resolver indicadores afectados
→ ejecutar orchestrator
→ persistir outputs/snapshots
```

### Etapa D — Consumidores

Revisar todos los consumidores y eliminar:

- cálculos locales divergentes;
- lecturas de tablas legacy;
- dependencia de refresh eliminados;
- heurísticas que inventen score.

### Etapa E — E2E sistémico

Ejecutar escenarios funcionales de dos tenants.

### Etapa F — Human review

Entregar evidencia antes de commit/deploy final:

- diff;
- archivos tocados;
- tablas afectadas;
- endpoints afectados;
- pruebas ejecutadas;
- resultados de reconciliación;
- riesgos residuales.

---

## 31. Criterios de aceptación funcional

El cierre sólo puede considerarse correcto si se cumplen simultáneamente:

### Integridad funcional

- una evaluación modifica las métricas esperadas;
- una evidencia modifica las métricas esperadas;
- un hallazgo modifica las métricas esperadas;
- una acción modifica las métricas esperadas;
- un riesgo modifica las métricas esperadas;
- cambios de aplicabilidad modifican denominadores y alcance;
- la desactivación de una norma elimina correctamente su impacto del alcance activo.

### Integridad cross-view

- Dashboard coherente;
- Health coherente;
- KPI coherente;
- Diagnóstico coherente;
- BI/Reportes coherentes;
- IA consume el mismo contexto cuantitativo.

### Integridad multi-tenant

- cero leakage;
- ningún hardcode específico;
- fórmulas y catálogos resueltos por contexto real del tenant.

### Integridad de datos

- no scores inventados;
- no registros duplicados artificiales;
- no columnas paralelas con significado ambiguo;
- no migraciones destructivas innecesarias.

### Integridad comercial

- módulos no contratados → estado de capacidad no habilitada;
- no errores técnicos por gating comercial;
- RBAC y plan se aplican consistentemente.

---

## 32. Criterio de aceptación de Health

Health sólo puede mostrar un score cuando exista medición oficial publicable.

Estados esperados:

```text
measured
insufficient_coverage
unmeasured
not_configured
```

según corresponda.

Debe respetarse el `minimum_coverage` definido por el contrato oficial.

Una vista no puede reemplazar `insufficient_coverage` por `0` sólo para facilitar el render.

---

## 33. Criterio de aceptación de Diagnóstico

Diagnóstico y Diagnóstico Express deben poder demostrar:

```text
respuesta de usuario
→ persistencia canónica
→ lectura inmediata coherente
→ cálculo oficial
→ propagación a Dashboard/Health/KPI
```

Si una norma está marcada como `Cumple`, esa evaluación debe reflejarse sistémicamente cuando exista cobertura suficiente para calcular.

No basta con que la propia vista de Diagnóstico muestre el valor guardado.

---

## 34. Criterio de aceptación de Evidencias

Una evidencia debe afectar score sólo si el contrato oficial le asigna impacto.

Debe distinguirse:

- evidencia inexistente;
- evidencia cargada;
- evidencia pendiente;
- evidencia aprobada;
- evidencia rechazada;
- evidencia vigente;
- evidencia vencida;
- calidad/suficiencia cuando aplique.

No utilizar simplemente `evidence_count > 0` como sustituto universal de salud.

---

## 35. Criterio de aceptación de acciones y hallazgos

Los estados de hallazgos y acciones deben afectar únicamente las métricas formalmente asociadas.

No debe existir una regla visual como:

```text
hallazgo abierto = Health -X
```

salvo que esté definida por una fórmula oficial.

El cierre debe respetar el registry y source contracts existentes.

---

## 36. Criterio de aceptación de riesgo

Debe comprobarse como mínimo:

```text
P × I = riesgo inherente correcto
```

más la relación real entre controles y riesgo residual según los contratos existentes.

Cambiar efectividad de un control debe poder modificar el riesgo residual si ese control participa de la evaluación.

El resultado debe llegar al componente Risk de GRC Health cuando corresponda.

---

## 37. Criterio de aceptación de IA

IA Compliance debe:

- operar cuando el plan/RBAC lo permita;
- degradar controladamente cuando no esté habilitada;
- no ser requisito para cálculo determinista;
- consumir resultados canónicos;
- no crear scores oficiales propios;
- no inventar datos ausentes.

---

## 38. Riesgos residuales actuales

Aun con la base limpia y los últimos cierres, permanecen riesgos que deben ser tratados en el cierre sistémico:

1. productores que escriben en tablas distintas a la fuente consumida por la fórmula;
2. rutas de refresh convertidas en read-only/no-op;
3. consumidores que aún usan proyecciones operacionales distintas de la autoridad oficial;
4. aliases normativos inconsistentes;
5. vistas de compatibilidad que pueden insinuar scores simplificados;
6. ausencia de E2E causal obligatorio;
7. funcionamiento de IA real post-deploy pendiente de validación comercial/entitlement;
8. dependencias npm reportadas por `npm audit`, separadas de este cierre funcional y que no deben mezclarse salvo que bloqueen ejecución real.

---

## 39. Estado recomendado antes del próximo prompt Codex

Este documento debe ser tratado como **fuente de verdad funcional y arquitectónica** para el próximo trabajo.

El prompt de cierre sistémico debe obligar a Codex a:

1. leer este documento completo antes de modificar código;
2. inspeccionar el runtime actual y confirmar cada afirmación contra código/schema;
3. no asumir que un componente está roto sólo porque este documento lo menciona como riesgo;
4. reparar únicamente divergencias verificadas;
5. no introducir funcionalidades nuevas;
6. mantener todos los contratos aprobados;
7. ejecutar pruebas por productor, fórmula, snapshot y consumidor;
8. demostrar reconciliación cross-view;
9. demostrar aislamiento multi-tenant;
10. detenerse para revisión humana antes de commit/push/deploy.

---

## 40. Resultado esperado del cierre

Al finalizar correctamente, TCDX ISO SaaS v4 debe comportarse como un sistema integrado:

```text
usuario cambia un hecho GRC
        ↓
se actualiza la fuente correcta
        ↓
se recalculan sólo las métricas afectadas
        ↓
se publican snapshots oficiales
        ↓
la proyección canónica refleja el nuevo estado
        ↓
Dashboard, Health, KPI, Diagnóstico, BI, Reportes e IA quedan coherentes
```

Sin:

- 0 inventados;
- cálculos paralelos;
- refresh legacy;
- dependencias de schema muerto;
- divergencia entre vistas;
- hardcodes por tenant;
- regresiones introducidas para arreglar síntomas locales.

---

## 41. Conclusión final

La reparación no requiere un nuevo producto ni una reconstrucción desde cero.

El sistema ya posee la arquitectura necesaria.

La tarea pendiente es cerrar correctamente la transición entre arquitectura histórica y arquitectura canónica moderna:

```text
HECHOS GRC
→ SOURCE CONTRACTS
→ OFFICIAL CALCULATION ORCHESTRATOR
→ SNAPSHOTS
→ CANONICAL PROJECTION
→ CONSUMIDORES
```

Ésa debe ser la única ruta oficial.

El próximo trabajo de Codex debe tratar esta reparación como un **cierre sistémico integral**, no como una colección de bugs independientes.

---

**Estado del documento:** APROBADO COMO GUÍA DE ARQUITECTURA Y REPARACIÓN PREVIA AL PROMPT DE CIERRE SISTÉMICO.  
**No autoriza por sí solo commit, push, merge ni deploy.**
