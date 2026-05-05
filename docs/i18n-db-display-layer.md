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
