# Plan maestro — Intelligence Layer Cognitiva Transversal TCDX ISO SaaS v4

**Proyecto:** TCDX ISO SaaS v4  
**Etapa:** Capa cognitiva transversal definitiva  
**Duración objetivo:** 1 semana de trabajo intensivo  
**División:** 5 fases / sprints completos  
**Objetivo central:** transformar la plataforma desde un SaaS ISO/GRC funcional con módulos IA hacia un producto cognitivamente inteligente, capaz de orquestar datos, contexto, métricas, narrativa, reglas, auditoría, evidencia y decisión.

---

## 1. Diagnóstico de partida

El sistema ya tiene una base funcional avanzada: SaaS multi-tenant, roles, módulos, dashboards, health ISO, auditorías, evidencias, riesgos, planes de acción, reportes, administración SaaS e IA. Sin embargo, todavía no se percibe como un producto verdaderamente inteligente porque la IA existe como funcionalidad, pero no como capa cognitiva transversal del producto.

El problema no es que falten módulos. El problema es que la información aún no está suficientemente orquestada.

Actualmente el sistema puede mostrar datos, métricas y estados. Lo que falta es que el sistema interprete esos datos como un consultor senior ISO/GRC:

- Qué está ocurriendo.
- Por qué ocurre.
- Qué riesgo implica.
- Qué evidencia lo respalda.
- Qué tan confiable es la conclusión.
- Qué se debe hacer primero.
- Quién debería actuar.
- Qué impacto tendrá no actuar.
- Qué tan preparado está el tenant para auditoría.
- Qué brechas son críticas, no solo visibles.
- Qué reporte ejecutivo debería recibir gerencia.

La Intelligence Layer debe resolver esta brecha y convertirse en el diferencial principal del producto.

---

## 2. Visión de producto final

La plataforma debe dejar de comportarse como un sistema de registro y comenzar a comportarse como un **copiloto ISO/GRC enterprise**.

La experiencia esperada:

> “TCDX no solo almacena controles, evidencias, riesgos y auditorías. TCDX interpreta el estado real del sistema de gestión, anticipa riesgos de auditoría, prioriza brechas, explica métricas, genera reportes ejecutivos y recomienda acciones trazables con criterio profesional.”

La salida única frente a otros sistemas similares debe ser:

1. **Lectura ejecutiva inteligente por tenant.**
2. **Audit readiness score explicable.**
3. **Motor de reglas ISO/GRC + IA.**
4. **Next Best Actions trazables.**
5. **Narrativa profesional automática para reportes y auditorías.**
6. **Explicabilidad de métricas.**
7. **Control de confianza y calidad de datos.**
8. **Contexto transversal de tenant.**
9. **IA contextual, no genérica.**
10. **Preparación auditora continua.**

---

## 3. Principios técnicos obligatorios

La Intelligence Layer debe cumplir estos principios:

### 3.1 No inventar datos

Ninguna conclusión debe presentarse como hecho si no existe respaldo en datos del sistema. Toda respuesta debe distinguir:

- Dato confirmado.
- Inferencia de regla.
- Inferencia IA.
- Recomendación.
- Limitación por falta de datos.

### 3.2 IA gobernada por reglas

El LLM no debe ser la fuente primaria de verdad. La fuente primaria debe ser:

1. Datos del sistema.
2. Reglas determinísticas.
3. Scoring.
4. Evidencia trazable.
5. IA para razonamiento, síntesis, redacción, priorización contextual y explicación.

### 3.3 Multi-tenant estricto

Toda consulta debe respetar:

- JWT.
- RBAC.
- Tenant scope.
- Estado de servicio del tenant.
- Permisos por módulo.
- Restricción para dealer si no existe autorización explícita.

### 3.4 Degradación segura

Si faltan datos, servicios o métricas, el sistema debe responder con:

- `ok: true` si puede entregar lectura parcial.
- `data_quality_warnings`.
- `confidence: baja`.
- Mensaje claro de limitación.

Nunca debe inventar valores para “verse inteligente”.

### 3.5 Inteligencia visible

La inteligencia debe aparecer en pantallas clave, no quedar escondida en un endpoint:

- Dashboard.
- Health ISO.
- Cumplimiento/Auditoría.
- Auditorías.
- Evidencias.
- Riesgos.
- Planes de acción.
- Reportes.
- IA Compliance.

### 3.6 Explicabilidad

Toda métrica relevante debe tener:

- Valor.
- Estado.
- Tendencia si existe.
- Causa probable.
- Impacto.
- Acción recomendada.
- Evidencia usada.
- Nivel de confianza.

### 3.7 Trazabilidad

Cada conclusión debe poder responder: “¿por qué el sistema dice esto?”.

---

## 4. Arquitectura objetivo

### 4.1 Nueva capa backend

Crear una capa explícita:

```text
backend/src/intelligence/
  index.js
  intelligence.routes.js
  intelligence.service.js
  intelligence.repository.js
  intelligence.rules.js
  intelligence.scoring.js
  intelligence.narrative.js
  intelligence.ai-orchestrator.js
  intelligence.types.js
  intelligence.cache.js
  intelligence.audit-log.js
```

Si el proyecto mantiene convención actual en `routes/` y `services/`, se puede usar:

```text
backend/src/routes/intelligence.routes.js
backend/src/services/intelligence/
```

La decisión final debe respetar estilo existente del repositorio.

### 4.2 Componentes principales

#### Intelligence Repository

Responsable de obtener datos normalizados del tenant.

Fuentes:

- Dashboard.
- Health ISO.
- KPIs.
- Controles.
- Evidencias.
- Evidence library.
- Riesgos.
- Riesgos operacionales.
- Activos.
- Planes de acción.
- Auditorías.
- Hallazgos.
- No conformidades.
- SOA.
- Lifecycle.
- Tenant standards.
- Tenant processes.
- Tenant operations.
- Company profile.
- IA traces/feedback si aplica.
- Report jobs si aplica.

#### Intelligence Normalizer

Convierte fuentes heterogéneas en un modelo común.

#### Rules Engine

Ejecuta reglas determinísticas ISO/GRC.

#### Scoring Engine

Calcula:

- `overall_intelligence_score`.
- `audit_readiness_score`.
- `evidence_maturity_score`.
- `risk_pressure_score`.
- `action_execution_score`.
- `data_quality_score`.
- `control_health_score`.
- `management_system_maturity_score`.

#### AI Orchestrator

Usa LLM solo con contexto curado, limitado y trazable.

#### Narrative Engine

Genera textos ejecutivos, técnicos y auditoría.

#### Evidence Basis Builder

Lista datos usados para cada conclusión.

#### Confidence Engine

Calcula confianza en la salida.

#### Action Prioritizer

Genera acciones priorizadas.

---

## 5. Modelo de datos lógico de la Intelligence Layer

### 5.1 Payload principal

```json
{
  "ok": true,
  "tenant_id": "uuid",
  "generated_at": "ISO_DATE",
  "locale": "es",
  "scope": {
    "tenant_name": "Empresa",
    "standards": ["ISO 9001", "ISO 27001"],
    "modules": ["health", "evidences", "risks", "audits", "ai"]
  },
  "overall": {
    "state": "saludable|atencion|critico|sin_datos",
    "score": 0,
    "label": "Atención",
    "summary": "Resumen ejecutivo"
  },
  "audit_readiness": {
    "score": 0,
    "label": "Preparación media",
    "state": "alta|media|baja|critica|sin_datos",
    "main_blockers": []
  },
  "metric_explanations": [],
  "main_risks": [],
  "next_best_actions": [],
  "narratives": {
    "executive": "",
    "technical": "",
    "audit": "",
    "commercial_demo": ""
  },
  "data_quality": {
    "score": 0,
    "warnings": [],
    "missing_sources": []
  },
  "confidence": {
    "level": "alta|media|baja",
    "score": 0,
    "reasons": []
  },
  "evidence_basis": [],
  "metadata": {
    "rules_version": "v1",
    "ai_used": true,
    "ai_model": "configured",
    "cache_status": "hit|miss|bypass"
  }
}
```

### 5.2 Estructura de hallazgo inteligente

```json
{
  "id": "generated-id",
  "type": "risk|gap|warning|opportunity|audit_blocker",
  "severity": "critica|alta|media|baja",
  "title": "Controles críticos sin evidencia suficiente",
  "description": "Descripción profesional",
  "impact": "Impacto en cumplimiento/auditoría/operación",
  "source": "rule|ai|metric",
  "confidence": "alta|media|baja",
  "related_entities": [
    {
      "entity_type": "control",
      "entity_id": "uuid",
      "label": "A.5.1"
    }
  ],
  "recommended_action": "Acción sugerida",
  "evidence_basis": []
}
```

### 5.3 Estructura Next Best Action

```json
{
  "priority": 1,
  "urgency": "inmediata|7_dias|30_dias|planificada",
  "title": "Completar evidencia de controles críticos",
  "description": "Acción concreta",
  "reason": "Motivo",
  "expected_impact": "Impacto esperado",
  "owner_role": "admin_cumplimiento|auditor|operativo",
  "effort": "bajo|medio|alto",
  "risk_if_ignored": "Riesgo si no se ejecuta",
  "source": "rule|ai|mixed",
  "confidence": "alta"
}
```

---

## 6. Reglas base obligatorias

### 6.1 Reglas de evidencia

1. Control crítico sin evidencia aprobada → riesgo alto.
2. Control activo sin evidencia → brecha de preparación.
3. Evidencia no oficial en control crítico → advertencia.
4. Evidencia vencida o antigua → advertencia de vigencia.
5. Evidencia sin asociación a control → oportunidad de ordenamiento.
6. Alto volumen de evidencia sin revisión → riesgo de calidad documental.

### 6.2 Reglas de auditoría

1. Auditoría próxima + readiness bajo → alerta crítica.
2. Hallazgos abiertos vinculados a auditoría previa → riesgo recurrente.
3. No conformidades abiertas > 30 días → riesgo alto.
4. Plan de acción vencido en hallazgo alto → riesgo crítico.
5. Auditoría sin preparación/documentos mínimos → bloqueo auditor.
6. Controles sin responsable → riesgo de gobernanza.

### 6.3 Reglas de riesgo

1. Riesgos altos/críticos sin plan → riesgo ejecutivo.
2. Riesgo crítico sin evidencia de tratamiento → brecha de gestión.
3. Activo crítico sin controles asociados → riesgo operacional.
4. Riesgo residual alto → recomendación prioritaria.
5. Riesgo sin owner → brecha de responsabilidad.

### 6.4 Reglas de planes de acción

1. Acción vencida → alerta.
2. Acción vencida en control crítico → alerta alta.
3. Acción sin responsable → brecha de ejecución.
4. Muchas acciones abiertas sin avance → presión operacional.
5. Acción cerrada sin evidencia → cierre débil.

### 6.5 Reglas de calidad de datos

1. Sin company profile → baja confianza contextual.
2. Sin procesos definidos → baja trazabilidad operacional.
3. Sin estándares activos → sin lectura ISO confiable.
4. Sin controles cargados → sistema sin base de evaluación.
5. Sin evidencias → lectura limitada.
6. Sin responsables → baja madurez de gestión.
7. Datos contradictorios → advertencia.

### 6.6 Reglas de madurez

1. Controles + evidencias + acciones + auditoría conectados → madurez alta.
2. Controles sin evidencias → madurez baja.
3. Evidencias sin controles → madurez documental baja.
4. Hallazgos sin acciones → madurez correctiva baja.
5. KPIs sin trazabilidad → madurez ejecutiva baja.

---

## 7. Scoring inicial recomendado

### 7.1 Audit Readiness Score

```text
audit_readiness_score =
  25% evidencia aprobada/oficial en controles activos
+ 20% controles cumplidos o parcialmente cumplidos con evidencia
+ 15% acciones no vencidas
+ 15% hallazgos cerrados o controlados
+ 10% no conformidades controladas
+ 10% riesgos altos/críticos con tratamiento
+ 5% calidad de datos mínima
```

Estados:

- 85–100: Alta preparación.
- 70–84: Preparación aceptable.
- 50–69: Preparación media/riesgosa.
- 30–49: Preparación baja.
- 0–29: Preparación crítica.
- Sin datos: no evaluable.

### 7.2 Overall Intelligence Score

```text
overall_score =
  20% health ISO
+ 15% audit readiness
+ 15% evidence maturity
+ 15% risk control
+ 15% action execution
+ 10% data quality
+ 10% management maturity
```

### 7.3 Data Quality Score

```text
data_quality_score =
  presencia de tenant profile
+ estándares activos
+ controles activos
+ evidencias asociadas
+ responsables definidos
+ procesos/operaciones definidas
+ auditorías/hallazgos trazables
```

### 7.4 Confidence Score

```text
confidence_score =
  data_quality_score * 0.6
+ source_coverage_score * 0.3
+ consistency_score * 0.1
```

---

## 8. Fase 1 — Fundaciones de Intelligence Layer y modelo canónico

**Duración sugerida:** Día 1  
**Objetivo:** crear la base técnica sólida: estructura, contrato, repositorio de datos, normalización y endpoint inicial de brief sin IA o con IA desactivable.

### 8.1 Entregables backend

Crear estructura:

```text
backend/src/services/intelligence/intelligence.service.js
backend/src/services/intelligence/intelligence.repository.js
backend/src/services/intelligence/intelligence.normalizer.js
backend/src/services/intelligence/intelligence.rules.js
backend/src/services/intelligence/intelligence.scoring.js
backend/src/services/intelligence/intelligence.narrative.js
backend/src/services/intelligence/intelligence.types.js
backend/src/routes/intelligence.routes.js
```

Agregar ruta en `backend/src/app.js`:

```js
app.use('/api/intelligence', intelligenceRoutes);
```

Actualizar RBAC:

```js
{
  prefix: '/api/intelligence',
  read: [...TENANT_READ_ROLES, 'admin_cumplimiento', 'compliance_admin'],
  write: []
}
```

### 8.2 Funciones mínimas

- `buildTenantIntelligenceBrief({ tenantId, user, locale })`
- `getTenantIntelligenceDataset({ tenantId, user })`
- `normalizeTenantDataset(rawDataset)`
- `buildDataQualityProfile(dataset)`
- `buildFallbackNarrative(normalizedDataset)`

### 8.3 Endpoints fase 1

```text
GET /api/intelligence/brief/:tenantId
GET /api/intelligence/dataset/:tenantId   // solo admin/platform o deshabilitable en producción
```

### 8.4 Salida esperada fase 1

El endpoint debe responder aunque el tenant tenga datos incompletos.

Debe devolver:

- Estado global.
- Resumen ejecutivo simple.
- Data quality.
- Confidence.
- Evidence basis.
- Warnings.
- Métricas base normalizadas.

### 8.5 Validaciones fase 1

- Usuario sin token → 401.
- Usuario de otro tenant → 403.
- Viewer puede leer.
- Dealer no accede salvo regla explícita futura.
- Tenant sin datos no produce 500.
- Sin IA configurada no produce 500.
- `npm run check`.
- Tests mínimos del service.

### 8.6 Criterio de aceptación

La Intelligence Layer queda montada y consumible por API. Aunque aún no sea sofisticada, ya existe contrato estable y respuesta segura.

---

## 9. Fase 2 — Motor de reglas, scoring y explicabilidad

**Duración sugerida:** Día 2 y parte del Día 3  
**Objetivo:** implementar inteligencia determinística confiable antes de usar IA generativa.

### 9.1 Entregables

Completar:

```text
intelligence.rules.js
intelligence.scoring.js
intelligence.explainability.js
```

Agregar tests:

```text
backend/src/services/intelligence/intelligence.rules.test.js
backend/src/services/intelligence/intelligence.scoring.test.js
```

### 9.2 Implementar reglas obligatorias

Categorías:

- Evidencia.
- Auditoría.
- Riesgo.
- Planes de acción.
- Calidad de datos.
- Madurez.
- Gobernanza.

Cada regla debe tener:

```js
{
  id,
  category,
  severity,
  condition(dataset),
  buildFinding(dataset),
  evidenceBuilder(dataset)
}
```

### 9.3 Implementar scoring

Funciones:

- `calculateAuditReadinessScore(dataset, findings)`
- `calculateOverallIntelligenceScore(dataset, findings)`
- `calculateEvidenceMaturityScore(dataset)`
- `calculateRiskPressureScore(dataset)`
- `calculateActionExecutionScore(dataset)`
- `calculateDataQualityScore(dataset)`
- `calculateConfidenceScore(dataset, findings)`

### 9.4 Implementar explicación de métricas

Crear:

```js
explainMetric(metricKey, dataset, findings)
```

Métricas mínimas:

- Compliance score.
- Health score.
- Audit readiness.
- Evidencia oficial/aprobada.
- Acciones vencidas.
- Hallazgos abiertos.
- No conformidades abiertas.
- Riesgos altos/críticos.
- Data quality.
- Management maturity.

Cada explicación debe incluir:

- `value`
- `state`
- `why`
- `impact`
- `recommended_action`
- `basis`
- `confidence`

### 9.5 Salida esperada fase 2

El sistema debe poder decir, sin LLM:

- “El readiness es bajo por evidencia faltante y acciones vencidas.”
- “El riesgo principal está en controles críticos sin evidencia.”
- “La confianza es baja porque faltan procesos y responsables.”
- “La próxima acción recomendada es cerrar acciones vencidas de alto impacto.”

### 9.6 Criterio de aceptación

La inteligencia determinística debe ser útil, estable, testeable y no depender del modelo IA.

---

## 10. Fase 3 — Orquestación IA contextual, narrativa profesional y memoria operativa

**Duración sugerida:** Día 3 y Día 4  
**Objetivo:** conectar IA como capa de síntesis y criterio profesional, usando reglas y datos como base.

### 10.1 Entregables

Crear:

```text
intelligence.ai-orchestrator.js
intelligence.prompt-builder.js
intelligence.narrative.js
intelligence.guardrails.js
intelligence.audit-log.js
```

### 10.2 Funciones IA

- `generateExecutiveNarrative(context)`
- `generateAuditNarrative(context)`
- `generateTechnicalNarrative(context)`
- `generateNextBestActionsNarrative(context)`
- `answerContextualQuestion({ tenantId, question, intelligenceBrief })`

### 10.3 Prompting obligatorio

El prompt debe incluir:

- Rol: asesor ISO/GRC senior.
- Contexto tenant.
- Métricas normalizadas.
- Hallazgos de reglas.
- Scoring.
- Warnings de calidad de datos.
- Evidencia base.
- Instrucción explícita de no inventar.
- Salida JSON validable.
- Separación dato/inferencia/recomendación.
- Idioma del usuario.

### 10.4 Guardrails

El AI Orchestrator debe:

- Limitar datos sensibles.
- No enviar archivos completos.
- No enviar passwords/tokens/secrets.
- No enviar evidencia completa salvo extractos seguros.
- Usar timeout.
- Tener fallback determinístico.
- Registrar uso en AI traces si existe.
- Manejar costos y errores.
- Permitir `AI_DISABLED=true`.

### 10.5 Narrativas mínimas

#### Narrativa ejecutiva

Para gerencia general.

Debe responder:

- Estado general.
- Riesgo ejecutivo.
- Causa principal.
- Acción prioritaria.
- Preparación auditora.

#### Narrativa técnica

Para responsable ISO/TI.

Debe responder:

- Brechas por dominio.
- Datos involucrados.
- Controles afectados.
- Riesgos asociados.
- Acciones técnicas.

#### Narrativa auditora

Para auditor/preauditor.

Debe responder:

- Preparación.
- Bloqueadores.
- Evidencia débil.
- Hallazgos/no conformidades.
- Riesgo de observación.

#### Narrativa comercial demo

Para demos, sin inventar datos, explicando valor.

### 10.6 Integración con IA Compliance

La pantalla o endpoint de IA Compliance debe recibir el `intelligenceBrief` como contexto.

La IA debe dejar de responder de forma genérica y comenzar a responder:

- “Según el estado actual del tenant…”
- “Con la información disponible…”
- “La confianza de esta recomendación es media porque…”
- “No hay evidencia suficiente para afirmar…”

### 10.7 Criterio de aceptación

La IA debe sonar como consultor senior, pero con prudencia técnica. Debe ser profesional, útil, trazable y no alucinatoria.

---

## 11. Fase 4 — UX cognitiva transversal y reportes inteligentes

**Duración sugerida:** Día 5 y parte del Día 6  
**Objetivo:** hacer visible la inteligencia en el producto. Si no se ve, no existe comercialmente.

### 11.1 Componentes frontend

Crear:

```text
frontend/src/components/intelligence/ExecutiveIntelligenceBrief.tsx
frontend/src/components/intelligence/AuditReadinessCard.tsx
frontend/src/components/intelligence/MetricExplanationPanel.tsx
frontend/src/components/intelligence/NextBestActionsPanel.tsx
frontend/src/components/intelligence/DataQualityWarnings.tsx
frontend/src/components/intelligence/IntelligenceConfidenceBadge.tsx
frontend/src/hooks/useIntelligenceBrief.ts
```

### 11.2 Ubicaciones obligatorias

Insertar inteligencia en:

1. Dashboard principal.
2. Health ISO.
3. Cumplimiento/Auditoría.
4. Auditorías.
5. Reportes/exportes.
6. IA Compliance.

Prioridad si el tiempo es limitado:

1. Dashboard.
2. Cumplimiento/Auditoría.
3. Reportes.
4. Auditorías.
5. IA Compliance.
6. Health ISO.

### 11.3 Diseño UX

Debe ser:

- Enterprise.
- Sobrio.
- Profesional.
- Orientado a decisión.
- No decorativo.
- No parecer chatbot.
- No parecer plantilla genérica.
- Con colores semánticos: verde, ámbar, rojo, azul, gris.
- Con texto ejecutivo.
- Con “ver fundamento” para explicabilidad.

### 11.4 Dashboard

Agregar bloque superior:

**Lectura inteligente del sistema de gestión**

Debe mostrar:

- Estado general.
- Score global.
- Audit readiness.
- Riesgo principal.
- Resumen ejecutivo.
- 3 acciones prioritarias.
- Confianza.
- Advertencias de datos.

### 11.5 Health ISO

Agregar:

- Explicación de score.
- Factores que suben/bajan score.
- Controles que más impactan.
- Evidencias faltantes críticas.
- Acciones sugeridas.

### 11.6 Cumplimiento/Auditoría

Agregar:

- Preparación auditora.
- Bloqueadores.
- Controles críticos.
- Riesgo de observación.
- Acciones para pasar auditoría.

### 11.7 Reportes inteligentes

Modificar generación o composición de reportes para incluir:

- Resumen ejecutivo inteligente.
- Estado general.
- Preparación auditora.
- Principales brechas.
- Principales riesgos.
- Acciones prioritarias.
- Nivel de confianza.
- Limitaciones de datos.
- Anexo de fundamentos.

### 11.8 IA Compliance

Agregar panel lateral o contexto visible:

- “Contexto usado por IA”.
- Estado tenant.
- Score.
- Riesgos.
- Acciones.
- Warnings.

### 11.9 Estados de UI

La UI debe manejar:

- Loading.
- Sin datos.
- Error parcial.
- IA desactivada.
- Tenant suspendido.
- Sin permisos.
- Bajo confidence.
- API timeout.

### 11.10 Criterio de aceptación

En una demo, un usuario debe entender en menos de 30 segundos:

- Cómo está su sistema.
- Qué riesgo tiene.
- Qué debe hacer.
- Qué tan preparado está para auditoría.
- Por qué el sistema recomienda eso.

---

## 12. Fase 5 — QA enterprise, performance, seguridad, validación demo y cierre

**Duración sugerida:** Día 6 y Día 7  
**Objetivo:** asegurar que la capa cognitiva queda bien implementada, estable, segura, rápida y demostrable.

### 12.1 Pruebas backend

Crear o completar tests:

```text
backend/src/services/intelligence/intelligence.service.test.js
backend/src/services/intelligence/intelligence.rules.test.js
backend/src/services/intelligence/intelligence.scoring.test.js
backend/src/services/intelligence/intelligence.narrative.test.js
```

Casos obligatorios:

1. Tenant sin datos.
2. Tenant saludable.
3. Tenant con evidencia baja.
4. Tenant con acciones vencidas.
5. Tenant con hallazgos abiertos.
6. Tenant con no conformidades antiguas.
7. Tenant con riesgos críticos sin plan.
8. Tenant con datos contradictorios.
9. Usuario de otro tenant.
10. Viewer solo lectura.
11. Dealer denegado.
12. IA desactivada.
13. LLM timeout.
14. Respuesta IA inválida.
15. Fallback determinístico.

### 12.2 Pruebas frontend

Validar:

- Dashboard carga aunque falle intelligence.
- No hay bloqueo de UI.
- Estados visuales correctos.
- Responsive desktop/mobile.
- Componentes no muestran undefined/null.
- Acciones tienen texto claro.
- Confidence visible.
- Warnings visibles.
- No se filtran datos de otro tenant.

### 12.3 Validaciones técnicas

Ejecutar:

```bash
cd backend
npm run check
npm test

cd ../frontend
npm run lint
npm run check
```

Si hay más suites disponibles, ejecutarlas.

### 12.4 Performance

Requisitos:

- Endpoint brief debe responder idealmente < 2s sin IA.
- Con IA, usar cache o job si tarda.
- Debe existir timeout.
- Debe existir fallback.
- Debe evitar queries N+1.
- Debe evitar enviar datasets enormes al LLM.
- Puede cachearse por tenant por 5–15 minutos.

### 12.5 Seguridad

Validar:

- RBAC.
- Tenant scope.
- No exposición de secrets.
- No exposición de tokens.
- No exposición de archivos completos.
- No prompt injection desde evidencia textual sin sanitización.
- No HTML inseguro en narrativa.
- No datos entre tenants.
- No logs con payload sensible completo.

### 12.6 Observabilidad

Registrar:

- request_id.
- tenant_id.
- user_id.
- intelligence_version.
- rules_version.
- ai_used.
- latency_ms.
- cache_status.
- confidence.
- error_code si falla.

### 12.7 Documentación

Crear:

```text
docs/intelligence-layer/architecture.md
docs/intelligence-layer/rules-catalog.md
docs/intelligence-layer/scoring-model.md
docs/intelligence-layer/prompting-and-guardrails.md
docs/intelligence-layer/demo-script.md
docs/intelligence-layer/qa-checklist.md
```

### 12.8 Demo script

Preparar guion de demo:

1. Entrar al dashboard.
2. Mostrar lectura inteligente.
3. Explicar audit readiness.
4. Abrir fundamentos.
5. Ver acciones recomendadas.
6. Ir a auditoría.
7. Mostrar bloqueadores.
8. Generar reporte.
9. Mostrar resumen ejecutivo inteligente.
10. Preguntar a IA Compliance algo contextual.
11. Mostrar que responde con datos del tenant.

### 12.9 Criterio de aceptación final

El producto debe quedar listo para venta masiva cuando:

- La Intelligence Layer está montada.
- Dashboard muestra lectura ejecutiva.
- Audit readiness funciona.
- Reglas críticas funcionan.
- IA contextual funciona o degrada correctamente.
- Reportes tienen resumen inteligente.
- Tests críticos pasan.
- No se rompen rutas existentes.
- No hay exposición cross-tenant.
- La demo muestra diferencia clara frente a sistemas tradicionales.

---

## 13. Backlog técnico consolidado

### Backend

- Crear Intelligence Repository.
- Crear Normalizer.
- Crear Rules Engine.
- Crear Scoring Engine.
- Crear Narrative Engine.
- Crear AI Orchestrator.
- Crear Evidence Basis Builder.
- Crear Confidence Engine.
- Crear Next Best Actions.
- Crear rutas API.
- Montar rutas.
- Actualizar RBAC.
- Agregar tests.
- Agregar documentación.

### Frontend

- Crear hook `useIntelligenceBrief`.
- Crear componentes intelligence.
- Insertar en Dashboard.
- Insertar en Health ISO.
- Insertar en Cumplimiento/Auditoría.
- Insertar en Auditorías.
- Insertar en Reportes.
- Integrar IA Compliance.
- Manejar estados de error/loading/fallback.
- Mantener diseño enterprise.

### IA

- Crear prompt builder.
- Crear JSON schema esperado.
- Crear fallback determinístico.
- Crear guardrails.
- Registrar trazas.
- Controlar timeout.
- Sanitizar contexto.
- No enviar datos sensibles innecesarios.

### Producto

- Redefinir propuesta comercial.
- Documentar diferenciador.
- Crear demo script.
- Crear casos demo.
- Crear ejemplo de tenant saludable.
- Crear ejemplo de tenant con brechas.

---

## 14. Criterios de calidad definitivos

### Calidad técnica

- Código modular.
- Bajo acoplamiento.
- Servicios testeables.
- Rutas simples.
- Sin lógica pesada en componentes frontend.
- Sin duplicación innecesaria.
- Manejo robusto de errores.
- Fallbacks claros.
- Sin inventar datos.

### Calidad analítica

- Reglas explícitas.
- Scores explicables.
- Métricas con causa e impacto.
- Acciones priorizadas.
- Confidence visible.
- Data quality visible.
- Trazabilidad de evidencia.

### Calidad IA

- Prompt controlado.
- Contexto curado.
- Salida estructurada.
- No alucinación.
- Fallback.
- Trazas.
- Limitación declarada.
- Tono profesional.

### Calidad UX

- Inteligencia visible.
- Diseño sobrio.
- Acción clara.
- Estado comprensible.
- Lectura ejecutiva.
- No sobrecarga visual.
- No chatbot dominante.
- No texto genérico.

### Calidad comercial

- Diferenciador evidente.
- Demo impactante.
- Mensaje simple.
- Valor para gerencia.
- Valor para responsable ISO.
- Valor para auditor.
- Valor para sostenedor/comercial SaaS.

---

## 15. Prompts posteriores desde este plan maestro

Cada fase debe convertirse posteriormente en un prompt independiente para Codex o ChatGPT con acceso al repositorio. Cada prompt debe incluir:

1. Contexto del proyecto.
2. Objetivo de fase.
3. Archivos esperados.
4. Restricciones.
5. Entregables.
6. Criterios de aceptación.
7. Validaciones.
8. Prohibición de commit/push sin aprobación.
9. Requisito de reporte final.
10. Instrucción de no romper funcionalidades existentes.

### 15.1 Prompt Fase 1 debe pedir

- Crear arquitectura base Intelligence Layer.
- Crear contrato de respuesta.
- Crear endpoint `brief`.
- Crear normalización inicial.
- Crear data quality inicial.
- Crear fallback narrative.
- Tests mínimos.

### 15.2 Prompt Fase 2 debe pedir

- Crear motor de reglas completo.
- Crear scoring.
- Crear explicación de métricas.
- Crear next best actions determinísticas.
- Tests de reglas y scoring.

### 15.3 Prompt Fase 3 debe pedir

- Crear AI Orchestrator.
- Crear prompt builder.
- Crear guardrails.
- Crear narrativas IA.
- Integrar IA Compliance con contexto.
- Crear fallback y trazas.

### 15.4 Prompt Fase 4 debe pedir

- Crear componentes frontend.
- Insertar inteligencia en pantallas.
- Crear estados UX.
- Agregar reportes inteligentes.
- Asegurar diseño enterprise.

### 15.5 Prompt Fase 5 debe pedir

- QA completo.
- Tests.
- Seguridad.
- Performance.
- Observabilidad.
- Documentación.
- Demo script.
- Validación final.

---

## 16. Riesgos principales y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| IA inventa conclusiones | Alto | Reglas determinísticas, evidence basis, JSON schema, guardrails |
| Datos incompletos | Medio/Alto | Data quality warnings y confidence |
| Lentitud | Alto | Cache, timeout, fallback sin IA |
| Cross-tenant data leak | Crítico | Tenant scope, RBAC, tests negativos |
| UI sobrecargada | Medio | Componentes ejecutivos compactos |
| Scores cuestionables | Medio | Fórmulas documentadas y explicables |
| Reportes genéricos | Alto | Narrativa con datos reales y fundamentos |
| Prompts inseguros | Alto | Sanitización, contexto mínimo, no archivos completos |
| Romper pantallas existentes | Alto | Integración no bloqueante, fallback UI |
| Falta de demo convincente | Alto | Demo script y tenants de ejemplo |

---

## 17. Definición de “terminado”

La etapa se considera terminada cuando:

1. Existe Intelligence Layer backend operativa.
2. Existe motor de reglas determinístico.
3. Existe scoring explicable.
4. Existe narrativa ejecutiva.
5. Existe audit readiness.
6. Existen next best actions.
7. Existe confidence/data quality.
8. IA Compliance usa contexto del tenant.
9. Dashboard muestra lectura inteligente.
10. Reportes incluyen resumen ejecutivo inteligente.
11. Hay tests críticos.
12. Hay documentación.
13. Hay demo script.
14. Validaciones pasan.
15. El sistema no solo muestra datos: interpreta y recomienda.

---

## 18. Resultado esperado al final de la semana

Al terminar estas 5 fases, TCDX ISO SaaS debe sentirse como una plataforma distinta:

Antes:

> “Sistema para gestionar cumplimiento ISO con módulos de IA.”

Después:

> “Copiloto ISO/GRC enterprise que interpreta el estado real del sistema de gestión, anticipa riesgos de auditoría, prioriza brechas, genera narrativa ejecutiva y orienta decisiones con evidencia trazable.”

Ese es el salto de madurez que debe marcar diferencia frente a sistemas similares del mercado.

---

## 19. Recomendación de ejecución

Orden recomendado:

- Día 1: Fase 1.
- Día 2: Fase 2 reglas/scoring.
- Día 3: Fase 2 cierre + Fase 3 inicio.
- Día 4: Fase 3 cierre.
- Día 5: Fase 4 UX/reportes.
- Día 6: Fase 4 cierre + Fase 5 QA.
- Día 7: Fase 5 validación final, documentación, demo y estabilización.

No avanzar a fase siguiente si:

- El endpoint base no responde.
- Tenant scope falla.
- Tests críticos fallan.
- El sistema inventa datos.
- La UI bloquea pantallas existentes.
- La IA no tiene fallback.
---

## 20. Extensión definitiva — Knowledge Base ampliada ISO/GRC/IA de 1.000 registros

Esta sección reemplaza y amplía la definición anterior de Knowledge Base inicial. A partir de esta versión, la Intelligence Layer debe usar como artefacto oficial de entrada la base ampliada:

```text
database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md
```

Archivo fuente generado:

```text
base_conocimiento_iso_grc_ia_tcdx_1000_registros.md
```

Cantidad objetivo:

```text
1.000 registros útiles de conocimiento estructurado
```

Distribución de la base ampliada:

| Familia | Registros |
|---|---:|
| ISO 9001 | 288 |
| ISO/IEC 27001 | 399 |
| NIST CSF 2.0 | 132 |
| NIST AI RMF | 80 |
| Auditoría ISO/GRC | 60 |
| Riesgos | 41 |
| **Total** | **1.000** |

La base ampliada no contiene texto completo de normas ISO. Está redactada como conocimiento derivado, operacional y estructurado para uso del sistema: intención, evidencia esperada, pregunta de auditoría, brecha común, acción recomendada, pista de regla, severidad, licencia y uso esperado.

Esta Knowledge Base es ahora un componente nuclear de la Intelligence Layer. No debe tratarse como documentación auxiliar.

---

## 21. Objetivo técnico de la Knowledge Base ampliada

La Knowledge Base ampliada debe permitir que TCDX ISO SaaS v4 interprete datos del tenant con criterio profesional sin depender de datos históricos de clientes.

Debe alimentar:

1. Rules Engine.
2. Scoring Engine.
3. Metric Explanation Engine.
4. Audit Readiness Engine.
5. Evidence Strength Engine.
6. Next Best Actions Engine.
7. AI Prompt Builder.
8. Narrative Engine.
9. Intelligent Reports.
10. IA Compliance contextual.
11. “Ver fundamento” en UI.
12. Demo enterprise diferenciada.

El sistema debe cruzar permanentemente:

```text
datos del tenant + reglas determinísticas + base de conocimiento + scoring + narrativa + IA gobernada
```

Resultado esperado:

> La plataforma no solo muestra métricas. Interpreta su significado usando una base de conocimiento ISO/GRC/IA estructurada, reglas trazables, evidencia esperada y criterio profesional.

---

## 22. Restricción legal, licencias y fuente de verdad

La base ampliada usa referencias oficiales y abiertas, pero no copia normas ISO completas.

Clasificación obligatoria:

| license_class | uso permitido |
|---|---|
| `derived_summary` | Uso interno en reglas, scoring, narrativa y recomendaciones. No representa texto normativo oficial. |
| `public_official` | Fuente oficial abierta, usable como referencia complementaria. |
| `open_framework` | Marco abierto o públicamente utilizable según sus condiciones. |
| `licensed_iso` | Usar solo si Tecdex cuenta con licencia válida y permiso aplicable. |
| `restricted` | No enviar a LLM, no mostrar en UI, no usar en outputs visibles. |

Reglas obligatorias:

1. No copiar texto completo de normas ISO en la base.
2. No exponer texto protegido en UI.
3. No enviar contenido ISO licenciado completo al LLM.
4. No usar documentos encontrados en internet sin validar origen/licencia.
5. No mezclar Knowledge Base global con datos de tenants.
6. No permitir que IA emita conclusiones normativas sin `knowledge_basis`.
7. Toda salida relevante debe distinguir dato confirmado, regla, inferencia, recomendación y limitación.

---

## 23. Ubicación de archivos en repositorio

Agregar estos archivos al repositorio:

```text
database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md
database/seeds/knowledge/knowledge_base_seed_v2.jsonl
database/seeds/knowledge/knowledge_base_seed_v2.summary.json
docs/intelligence-layer/knowledge-base.md
docs/intelligence-layer/knowledge-base-ingestion.md
docs/intelligence-layer/knowledge-base-license-policy.md
docs/intelligence-layer/knowledge-base-coverage.md
```

La versión Markdown es la fuente documental legible.  
La versión JSONL es la fuente técnica para carga en PostgreSQL.  
El archivo `summary.json` debe permitir validaciones automáticas.

---

## 24. Conversión obligatoria de Markdown a JSONL

Crear script:

```text
backend/scripts/convert-knowledge-md-to-jsonl.js
```

Entrada:

```text
../database/seeds/knowledge/base_conocimiento_iso_grc_ia_tcdx_1000_registros.md
```

Salida:

```text
../database/seeds/knowledge/knowledge_base_seed_v2.jsonl
../database/seeds/knowledge/knowledge_base_seed_v2.summary.json
```

El script debe:

1. Leer la tabla Markdown de 1.000 registros.
2. Detectar columnas por encabezado.
3. Validar presencia de columnas obligatorias.
4. Convertir cada fila en `knowledge_item`.
5. Expandir:
   - `evidence_expectation` a `knowledge_evidence_expectations`.
   - `audit_question` a `knowledge_audit_questions`.
   - `common_gap` a `knowledge_common_gaps`.
   - `recommended_action` a `knowledge_recommended_actions`.
   - `rule_hint` a regla sugerida o `knowledge_rule_hint`.
6. Mantener `item_key` como clave idempotente.
7. Rechazar filas sin `item_key`.
8. Rechazar filas sin `intent_summary`.
9. Rechazar filas con `license_class` no permitido.
10. Generar resumen por familia, estándar y severidad.
11. Fallar si total de registros válidos < 950.
12. Advertir si registros válidos != 1.000.

Formato JSONL esperado por registro convertido:

```json
{
  "record_type": "knowledge_item_bundle",
  "id": "KB-0001",
  "item_key": "iso_9001.contexto.alcance.governance",
  "standard_family": "ISO_9001",
  "standard_code": "ISO 9001:2015 + Amd 1:2024",
  "source_key": "iso_9001_2015",
  "clause_or_control": "4.3",
  "domain": "Alcance del sistema de gestión de calidad",
  "item_type": "governance_guidance",
  "title": "Gobernanza — Alcance del sistema de gestión de calidad",
  "intent_summary": "...",
  "evidence_expectations": [],
  "audit_questions": [],
  "common_gaps": [],
  "recommended_actions": [],
  "rule_hint": "...",
  "severity_default": "alta",
  "license_class": "derived_summary",
  "use_in_system": [
    "rules_engine",
    "scoring",
    "metric_explanation",
    "next_best_actions",
    "audit_readiness",
    "narrative"
  ]
}
```

---

## 25. Modelo PostgreSQL definitivo para Knowledge Base v2

Mantener las tablas ya definidas y agregar campos para soportar 1.000 registros y conversión desde Markdown.

### 25.1 `knowledge_items`

Agregar o confirmar campos:

```sql
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS source_record_id TEXT,
  ADD COLUMN IF NOT EXISTS use_in_system JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_text TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
```

### 25.2 Tabla adicional: `knowledge_rule_hints`

```sql
CREATE TABLE IF NOT EXISTS knowledge_rule_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  rule_hint_key TEXT NOT NULL,
  rule_hint_text TEXT NOT NULL,
  severity_default TEXT NOT NULL DEFAULT 'media',
  suggested_condition_key TEXT,
  suggested_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 25.3 Tabla adicional: `knowledge_import_runs`

```sql
CREATE TABLE IF NOT EXISTS knowledge_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key TEXT NOT NULL,
  source_file TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
```

### 25.4 Índices adicionales

```sql
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_key ON knowledge_items(source_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_record_id ON knowledge_items(source_record_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_use_in_system ON knowledge_items USING GIN(use_in_system);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_search_text ON knowledge_items USING GIN(to_tsvector('spanish', coalesce(search_text, '')));
CREATE INDEX IF NOT EXISTS idx_knowledge_rule_hints_item ON knowledge_rule_hints(knowledge_item_id);
```

Si el proyecto usa pgvector o embeddings en una etapa posterior, agregar búsqueda semántica; no bloquear esta fase por eso.

---

## 26. Loader definitivo de Knowledge Base v2

Crear script:

```text
backend/scripts/load-knowledge-base-seed.js
```

Debe aceptar:

```bash
cd backend
node scripts/load-knowledge-base-seed.js ../database/seeds/knowledge/knowledge_base_seed_v2.jsonl
```

Debe realizar carga idempotente:

- Upsert `knowledge_sources` por `source_key`.
- Upsert `knowledge_items` por `item_key`.
- Reemplazo controlado de hijos por `knowledge_item_id`:
  - evidence expectations.
  - audit questions.
  - common gaps.
  - recommended actions.
  - rule hints.
- Upsert reglas globales si existen en seed.
- Upsert templates narrativos si existen.
- Crear `knowledge_import_runs`.

Validaciones obligatorias:

1. Total de registros válidos >= 950.
2. `license_class` permitido.
3. `standard_family` permitido.
4. `source_key` conocido.
5. `intent_summary` no vacío.
6. `evidence_expectation` no vacío.
7. `audit_question` no vacío.
8. `common_gap` no vacío.
9. `recommended_action` no vacío.
10. `use_in_system` no vacío.
11. No hay datos de tenant.
12. No hay tokens/secrets.
13. No hay textos excesivamente largos de normas.
14. No hay HTML/script.
15. No hay duplicados de `item_key`.

Salida esperada:

```text
Knowledge Base v2 loaded
source_file: knowledge_base_seed_v2.jsonl
valid_records: 1000
inserted_items: N
updated_items: N
warnings: 0
errors: 0
status: completed
```

---

## 27. Servicios backend obligatorios para Knowledge Base

Crear:

```text
backend/src/services/knowledge-base/knowledge.repository.js
backend/src/services/knowledge-base/knowledge.service.js
backend/src/services/knowledge-base/knowledge.search.js
backend/src/services/knowledge-base/knowledge.coverage.js
backend/src/services/knowledge-base/knowledge.guardrails.js
backend/src/services/knowledge-base/knowledge.types.js
```

### 27.1 Funciones mínimas

```js
searchKnowledge({
  query,
  standardFamily,
  standardCode,
  domain,
  clauseOrControl,
  itemType,
  useInSystem,
  limit
})

getKnowledgeForControl({
  standardFamily,
  clauseOrControl,
  domain
})

getEvidenceExpectations({
  standardFamily,
  clauseOrControl,
  domain
})

getAuditQuestions({
  standardFamily,
  clauseOrControl,
  domain
})

getRecommendedActions({
  standardFamily,
  clauseOrControl,
  domain,
  severity
})

getRuleHints({
  standardFamily,
  category,
  severity
})

buildKnowledgeContextForTenantDataset({
  tenantDataset,
  standards,
  activeControls,
  risks,
  evidences,
  audits
})

calculateKnowledgeCoverage({
  tenantDataset,
  knowledgeItems
})
```

### 27.2 Knowledge Coverage

El sistema debe calcular cobertura:

```json
{
  "coverage_score": 0,
  "standards_covered": [],
  "domains_covered": [],
  "items_used": [],
  "missing_coverage": [],
  "license_warnings": []
}
```

Uso:

- Si `coverage_score < 40`, bajar confidence.
- Si tenant usa estándar sin coverage suficiente, agregar warning.
- Si conclusión no tiene knowledge item asociado, limitar severidad o marcar como inferencia débil.

---

## 28. Integración obligatoria con Intelligence Layer

La Intelligence Layer debe usar Knowledge Base v2 en todo el pipeline.

### 28.1 Dataset enrichment

Antes de correr reglas:

```text
tenantDataset -> normalizedDataset -> knowledgeEnrichedDataset
```

El `knowledgeEnrichedDataset` debe agregar:

- `knowledge_matches`.
- `expected_evidence`.
- `audit_questions`.
- `common_gaps`.
- `recommended_actions`.
- `rule_hints`.
- `knowledge_coverage`.

### 28.2 Rules Engine

Las reglas hardcoded pasan a ser fallback. El motor debe priorizar:

1. Reglas explícitas activas.
2. Rule hints desde Knowledge Base.
3. Reglas hardcoded de seguridad mínima.
4. Inferencia IA solo para narrativa, no para decisión primaria.

### 28.3 Scoring Engine

El scoring debe usar:

- Severidad del hallazgo.
- Familia del estándar.
- Cobertura de conocimiento.
- Fuerza de evidencia.
- Mapeo control/riesgo/evidencia.
- Calidad de datos.

Agregar al score:

```text
knowledge_coverage_score = porcentaje de dominios/controles evaluados con base de conocimiento asociada
```

Actualizar confidence:

```text
confidence_score =
  data_quality_score * 0.45
+ source_coverage_score * 0.20
+ knowledge_coverage_score * 0.25
+ consistency_score * 0.10
```

### 28.4 Metric Explanation

Cada métrica debe usar al menos un knowledge item cuando aplique:

```json
{
  "metric": "audit_readiness",
  "value": 68,
  "why": "...",
  "impact": "...",
  "recommended_action": "...",
  "knowledge_basis": [
    {
      "item_key": "...",
      "standard_family": "ISO_27001",
      "basis_type": "evidence_expectation",
      "license_class": "derived_summary"
    }
  ]
}
```

### 28.5 Next Best Actions

Las acciones recomendadas deben combinar:

1. Brecha detectada.
2. Severidad.
3. Evidencia faltante.
4. Acción recomendada desde Knowledge Base.
5. Rol responsable.
6. Urgencia.
7. Riesgo si se ignora.

No se deben generar acciones genéricas si existe acción específica en Knowledge Base.

### 28.6 AI Orchestrator

El prompt debe incluir solo un contexto curado:

```json
{
  "tenant_summary": "...",
  "scores": {},
  "findings": [],
  "knowledge_context": {
    "items_used": [],
    "evidence_expectations": [],
    "common_gaps": [],
    "recommended_actions": [],
    "rules_used": []
  },
  "data_quality_warnings": [],
  "output_contract": "structured_json"
}
```

Prohibido enviar:

- Markdown completo de 1.000 registros.
- Texto largo de normas.
- Documentos completos del tenant.
- Evidencias completas sin filtrado.
- Secretos, tokens, contraseñas o datos sensibles.

### 28.7 Narrative Engine

Las narrativas deben mezclar:

- Datos del tenant.
- Hallazgos.
- Knowledge basis.
- Nivel de confianza.
- Limitaciones.
- Recomendación concreta.

---

## 29. Cambios obligatorios al payload Intelligence Layer v2

Extender payload principal:

```json
{
  "knowledge_context": {
    "source_file": "base_conocimiento_iso_grc_ia_tcdx_1000_registros.md",
    "seed_version": "v2",
    "total_available_items": 1000,
    "sources_used": [],
    "standards_covered": [],
    "knowledge_items_used": [],
    "rules_used": [],
    "coverage_score": 0,
    "license_warnings": [],
    "missing_coverage": []
  }
}
```

Extender cada hallazgo:

```json
{
  "knowledge_basis": [
    {
      "item_key": "...",
      "source_record_id": "KB-0001",
      "standard_family": "ISO_9001",
      "standard_code": "ISO 9001:2015 + Amd 1:2024",
      "clause_or_control": "4.3",
      "basis_type": "evidence_expectation|audit_question|common_gap|recommended_action|rule_hint",
      "license_class": "derived_summary"
    }
  ]
}
```

Extender cada acción:

```json
{
  "action_basis": {
    "source": "knowledge_base",
    "item_key": "...",
    "source_record_id": "KB-0001",
    "derived_from": "recommended_action"
  }
}
```

---

## 30. Ajuste definitivo de las 5 fases para usar KB v2

### 30.1 Fase 1 ajustada — Fundaciones + ingestión KB v2

Agregar a Fase 1:

- Incorporar `base_conocimiento_iso_grc_ia_tcdx_1000_registros.md`.
- Crear script de conversión Markdown → JSONL.
- Crear migración Knowledge Base v2.
- Crear loader idempotente.
- Cargar 1.000 registros.
- Crear servicios `knowledge-base`.
- Crear endpoint interno de búsqueda.
- Integrar `knowledge_context` vacío/inicial en payload Intelligence.
- Validar que no se rompa si KB no está cargada.
- Crear documentación de ingestión.

Criterio de aceptación adicional:

- La base de 1.000 registros puede convertirse y cargarse.
- `knowledge_items` contiene al menos 950 registros válidos.
- `knowledge_context.total_available_items` refleja cantidad real.
- No hay datos de tenant en KB.
- No hay salida de texto protegido.

### 30.2 Fase 2 ajustada — Rules + scoring con KB v2

Agregar a Fase 2:

- Rules Engine consulta Knowledge Base.
- Se crean findings desde `rule_hint`.
- Scoring usa `knowledge_coverage_score`.
- Metric Explanation usa evidencia esperada y brechas comunes.
- Next Best Actions prioriza acciones recomendadas desde KB.
- Tests de reglas con ISO 9001, ISO 27001, NIST CSF, auditoría y riesgos.

Criterio de aceptación adicional:

- Cada finding crítico tiene `knowledge_basis`.
- Cada métrica principal tiene explicación con fundamento.
- Cada next best action tiene `action_basis`.
- Si no existe KB aplicable, el sistema reduce confidence.

### 30.3 Fase 3 ajustada — IA contextual con KB v2

Agregar a Fase 3:

- Prompt Builder incluye `knowledge_context` filtrado.
- AI Orchestrator recibe máximo N knowledge items relevantes.
- Guardrails bloquean envío de base completa.
- Respuesta IA debe devolver `knowledge_basis`.
- Si IA devuelve conclusión sin fundamento, degradar o descartar.
- IA Compliance responde contextualizada con KB + tenant data.

Criterio de aceptación adicional:

- IA no inventa requisitos.
- IA no cita texto normativo protegido.
- IA declara limitaciones de datos.
- IA usa conocimiento derivado y reglas como fundamento.

### 30.4 Fase 4 ajustada — UX cognitiva + fundamento visible

Agregar a Fase 4:

- En Dashboard, Health ISO, Auditoría y Reportes agregar “Ver fundamento”.
- Mostrar:
  - estándar relacionado.
  - dominio.
  - regla o brecha.
  - evidencia usada.
  - acción recomendada.
  - confidence.
  - licencia/clase de fuente si corresponde.
- No mostrar texto extenso de norma.
- Mostrar “Base de conocimiento usada: ISO/GRC/IA v2”.

Criterio de aceptación adicional:

- Usuario puede entender por qué el sistema recomienda algo.
- Reportes incluyen anexo de fundamentos.
- UI no expone datos protegidos ni información excesiva.

### 30.5 Fase 5 ajustada — QA KB v2 + seguridad + demo

Agregar a Fase 5:

- Test de conversión Markdown → JSONL.
- Test de carga idempotente.
- Test de búsqueda por familia, estándar, dominio, cláusula.
- Test de `knowledge_coverage_score`.
- Test de findings con y sin KB.
- Test de prompt guardrails.
- Test de no exposición de base completa al LLM.
- Test de no HTML/script en registros.
- Test de licencia.
- Documentación final.

Criterio de aceptación adicional:

- 1.000 registros cargados o al menos 950 válidos justificados.
- Import idempotente sin duplicados.
- Intelligence Layer funciona con KB cargada.
- Intelligence Layer degrada si KB falla.
- Reportes y UI muestran fundamento.
- Demo evidencia diferenciador.

---

## 31. Documentación obligatoria adicional

Crear:

```text
docs/intelligence-layer/knowledge-base.md
docs/intelligence-layer/knowledge-base-ingestion.md
docs/intelligence-layer/knowledge-base-license-policy.md
docs/intelligence-layer/knowledge-base-coverage.md
docs/intelligence-layer/knowledge-base-to-intelligence-pipeline.md
```

### 31.1 `knowledge-base.md`

Debe explicar:

- Qué es la Knowledge Base.
- Qué cubre.
- Qué no cubre.
- Por qué no contiene datos históricos.
- Cómo se relaciona con Intelligence Layer.

### 31.2 `knowledge-base-ingestion.md`

Debe explicar:

- Ubicación del Markdown.
- Conversión a JSONL.
- Carga a PostgreSQL.
- Validaciones.
- Comandos.
- Errores comunes.

### 31.3 `knowledge-base-license-policy.md`

Debe explicar:

- Clases de licencia.
- Prohibiciones.
- Uso con LLM.
- Uso en UI.
- Uso en reportes.
- Proceso de aprobación de nuevas fuentes.

### 31.4 `knowledge-base-coverage.md`

Debe explicar:

- Cómo se calcula coverage.
- Cómo afecta confidence.
- Cómo se interpreta en UI/reportes.
- Cómo detectar brechas de cobertura.

### 31.5 `knowledge-base-to-intelligence-pipeline.md`

Debe explicar:

```text
Markdown KB -> JSONL -> PostgreSQL -> Knowledge Service -> Intelligence Dataset -> Rules -> Scoring -> Narrative -> UI/Reports/IA
```

---

## 32. Nuevos criterios de aceptación finales

La etapa Intelligence Layer no queda aceptada si ocurre cualquiera de estos puntos:

1. La base de 1.000 registros no está incorporada al repo.
2. No existe conversión Markdown → JSONL.
3. No existe loader idempotente.
4. No existen tablas o servicios KB.
5. Intelligence Layer no consulta Knowledge Base.
6. Los findings no incluyen `knowledge_basis`.
7. Las acciones no incluyen `action_basis`.
8. Las métricas no usan fundamento.
9. IA Compliance responde genérico sin KB.
10. Reportes no muestran fundamento.
11. UI no permite ver por qué se recomienda algo.
12. El sistema expone texto protegido.
13. El LLM recibe la base completa sin filtrado.
14. No hay tests de carga, coverage y guardrails.
15. No hay documentación de licencia/fuentes.

---

## 33. Resultado comercial esperado con KB v2

Con la base ampliada, el diferencial comercial cambia.

Antes:

> “Tenemos IA para cumplimiento ISO.”

Después:

> “TCDX incorpora una base de conocimiento ISO/GRC/IA de 1.000 registros operacionales, reglas determinísticas y scoring explicable para interpretar el estado real del sistema de gestión, anticipar riesgos de auditoría y recomendar acciones trazables.”

Este mensaje debe usarse en demo y venta, sin prometer certificación automática ni reemplazo del auditor.

---

## 34. Prompt base obligatorio para fases posteriores

Todos los prompts posteriores deben incluir este bloque:

```text
IMPORTANTE — Knowledge Base v2:
El sistema debe usar la base `base_conocimiento_iso_grc_ia_tcdx_1000_registros.md` como fuente inicial de conocimiento estructurado. Debes convertirla a JSONL técnico, cargarla idempotentemente en PostgreSQL y hacer que Intelligence Layer la use en reglas, scoring, explicabilidad, audit readiness, next best actions, IA Compliance y reportes. No copies texto completo de normas ISO. No expongas texto protegido. No envíes la base completa al LLM. Toda conclusión relevante debe incluir `knowledge_basis`; toda acción debe incluir `action_basis`; toda respuesta IA debe declarar fundamento y limitaciones.
```

---

## 35. Orden actualizado de ejecución semanal

| Día | Foco | Resultado mínimo |
|---|---|---|
| Día 1 | KB v2 + migración + conversión + loader + estructura Intelligence | 1.000 registros convertidos/cargados y endpoint base funcionando |
| Día 2 | Rules Engine + Scoring + Knowledge Coverage | Findings, scores y métricas con fundamento |
| Día 3 | Next Best Actions + IA Orchestrator + Prompt Guardrails | IA contextual con KB filtrada y fallback |
| Día 4 | Narrativas + IA Compliance + Report payload | Resumen ejecutivo y auditor con `knowledge_basis` |
| Día 5 | UX cognitiva Dashboard/Health/Auditoría | Inteligencia visible y “Ver fundamento” |
| Día 6 | Reportes inteligentes + QA técnico | Reportes con anexo de fundamento y tests principales |
| Día 7 | Seguridad, performance, documentación y demo | Cierre enterprise listo para venta masiva controlada |
