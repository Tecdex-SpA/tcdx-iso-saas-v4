# Fase 5A — Capa de traducción visual para datos provenientes desde BD

## Objetivo

Permitir que usuarios en modo English visualicen en inglés datos del sistema, catálogos ISO, estados, prioridades, severidades, cláusulas, controles y frases conocidas provenientes desde BD, sin modificar la información original guardada.

## Regla principal

La traducción es visual, reversible y no destructiva.

No se modifica:

- BD;
- datos cliente;
- estados internos;
- códigos;
- IDs;
- payloads enviados al backend;
- migraciones;
- `.env`.

## Tipos de datos

### 1. UI hardcodeada

Debe usar `useTranslation` y diccionarios.

### 2. Datos de sistema/catálogos

Se traducen visualmente mediante `frontend/src/i18n/displayText.ts`.

Ejemplos:

- estados;
- prioridades;
- severidades;
- normas;
- cláusulas;
- categorías;
- módulos;
- roles;
- textos operativos conocidos.

### 3. Datos semi-estructurados generados por el sistema

Se traducen mediante coincidencias exactas o patrones determinísticos.

Ejemplos:

- `Contrato creado desde cotización aceptada`;
- `Servicio reactivado`;
- `Cláusula 8: Operación`.

### 4. Texto libre del cliente

No se traduce destructivamente. Si no hay coincidencia segura, se muestra el original.

## Helpers

Archivo:

```text
frontend/src/i18n/displayText.ts
```

Funciones principales:

```ts
translateDisplayText(value, locale, domain?)
translateSystemLabel(value, locale, domain?)
translateStatusLabel(value, locale)
translatePriorityLabel(value, locale)
translateSeverityLabel(value, locale)
translateStandardLabel(value, locale)
translateClauseLabel(value, locale)
translateControlLabel(value, locale)
translateModuleLabel(value, locale)
translateRoleLabel(value, locale)
translateAuditEventLabel(value, locale)
translateBillingConceptLabel(value, locale)
translateIsoText(value, locale)
```

## Reglas de uso

Correcto:

```tsx
{translateDisplayText(item.title, locale, 'finding')}
{translateStatusLabel(item.status, locale)}
{translateClauseLabel(control.clause, locale)}
```

Incorrecto:

```tsx
item.status = translateStatusLabel(item.status, locale)
```

Incorrecto:

```tsx
body: { status: translateStatusLabel(status, locale) }
```

## Selects

El `value` mantiene el valor interno. Solo cambia el label visible.

```tsx
<option value="en_progreso">
  {translateStatusLabel('en_progreso', locale)}
</option>
```

## Límites conocidos

- Texto libre no reconocido no se traduce automáticamente.
- Traducción IA/caché/revisión humana queda para una fase posterior.
- Los guards visuales se mantienen como red de seguridad, pero no reemplazan la capa de render controlado.

## QA

Script:

```bash
bash scripts/qa-i18n-db-display.sh
```

## Criterio de aceptación Fase 5A.1

- helper central creado;
- QA creado;
- diccionarios siguen válidos;
- no se toca BD;
- no se toca backend;
- no se tocan `.env`;
- no se modifican payloads;
- español sigue intacto;
- English mejora textos de sistema reconocibles.


## Integración Fase 5A.2.1

Vistas integradas con render visual seguro para datos provenientes desde BD:

- `frontend/src/app/controles/page.tsx`
- `frontend/src/app/evidencias/page.tsx`
- `frontend/src/app/plan-accion/page.tsx`

La integración se limita a etiquetas visibles: cláusulas, normas, controles, categorías, estados, descripciones reconocibles, planes vinculados y evidencias asociadas. No se alteran valores internos, estados de formularios ni payloads enviados al backend.


## Integración Fase 5A.2.2

Se extendió la traducción visual no destructiva a:

- `frontend/src/app/hallazgos/page.tsx`
- `frontend/src/app/no-conformidades/page.tsx`
- `frontend/src/app/auditorias/page.tsx`
- `frontend/src/app/auditorias/ejecucion/page.tsx`

Reglas aplicadas:

- traducir solo render visual;
- mantener `value` de selects intacto;
- no alterar payloads enviados al backend;
- traducir estados, severidades, prioridades, tipos, normas, cláusulas, títulos y descripciones reconocibles;
- mantener fallback al original para texto libre no reconocido.

## Integración Fase 5A.2.3

Se extiende la capa visual de traducción a vistas administrativas y comerciales:

- Administración SaaS;
- Prefacturación;
- Cotizador;
- Dashboard KPI;
- Administración de KPIs.

La regla se mantiene: traducir únicamente labels visibles. No se modifican valores internos, payloads, contratos de API, BD ni scripts de deploy.

## Cobertura Fase 5A.2.4

Se extiende la capa visual i18n BD a vistas de diagnóstico, riesgo, SoA, exportes e IA:

- `frontend/src/app/diagnostico/page.tsx`
- `frontend/src/app/matriz-riesgo/page.tsx`
- `frontend/src/app/soa/page.tsx`
- `frontend/src/app/exportes/page.tsx`
- `frontend/src/app/ia-auditor/page.tsx`
- `frontend/src/app/ia-compliance/page.tsx`

La regla se mantiene: solo render visual, sin modificar BD, payloads ni valores internos.

## Fase 5A.3 — Depuración de residuos visuales reales

Se agregó `EnglishDbDisplayTextGuard` como red de seguridad visual para residuos dinámicos que provienen desde BD, catálogos o textos semiestructurados no capturados por los renders directos.

Reglas:

- Solo opera cuando `locale === 'en'`.
- No toca BD.
- No toca backend.
- No modifica payloads.
- No altera inputs, textareas, scripts, estilos, código ni contenido editable.
- Conserva fallback al texto original si no hay coincidencia segura.
- Mantiene `displayText.ts` como fuente central para mapeos determinísticos.


## Fase 5A.4 — Depuración manual de residuos reales

Se amplía la capa visual para cubrir residuos detectados manualmente en English:

- SOA: menú desplegable, estado de implementación, fecha de revisión, justificación, notas y crear acción.
- Controles: nombres frecuentes de controles/categorías que seguían en español.
- Evidencias: detected risks, next step, acciones sugeridas y evidencia requerida.
- IA Compliance: resumen, recomendaciones, brechas y frases semiestructuradas generadas en español.

La corrección sigue siendo visual y no destructiva. No modifica BD, payloads, valores internos ni texto libre no reconocido.


## Fase 5A.5 — Depuración profunda de residuos visuales

Se amplió la corrección visual para residuos reales detectados manualmente en English:

- SOA: opciones, placeholders, estado de implementación, justificación, notas y cláusulas.
- Evidencias: Central AI summary, sugerencias de evidencia, próximos pasos, narrativa IA y frases semiestructuradas.
- Plan de Acción: redacciones propuestas, evidencia objetiva, riesgo/impacto y acción correctiva sugerida.
- IA Compliance: resumen de salud, señales relevantes y prioridades recomendadas.

La solución sigue siendo visual-only. No modifica valores internos, payloads, BD ni backend.

## Fase 5B — Language enforcement IA/backend

Esta fase agrega una capa no destructiva en backend para mejorar consistencia de idioma en respuestas narrativas provenientes de IA, evidencias, planes de acción, reportes y módulos relacionados.

Reglas:

- Solo actúa cuando `locale=en` o `x-tcdx-locale: en`.
- No modifica BD.
- No modifica `.env`.
- No cambia códigos internos, UUIDs, URLs, emails, tokens ni enums.
- No altera payloads enviados desde frontend.
- Traduce visualmente/narrativamente respuestas JSON antes de enviarlas al frontend.
- Agrega helpers de instrucción de idioma para ai-engine.

Archivos principales:

- `backend/src/utils/aiLocaleText.js`
- `backend/src/middleware/aiLocaleResponseGuard.js`
- `ai-engine/app/services/language_service.py`
- `scripts/qa-ai-locale-consistency.sh`

QA:

```bash
bash scripts/qa-ai-locale-consistency.sh
```

Límite conocido: la traducción sigue siendo determinística. Texto libre no reconocido o respuestas IA muy variables pueden requerir una fase posterior con prompts específicos por endpoint o traducción IA controlada con caché/revisión humana.
