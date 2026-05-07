# Fase 1.11-1.13 - Consolidacion Operativa ISO

## Objetivo

Consolidar la experiencia ISO operativa en una vista diaria de trabajo, conectando diagnostico express, riesgos, documentos, acciones recomendadas, conversiones y preauditoria asistida.

Esta fase no implementa reportes ejecutivos premium. Ese alcance queda reservado para Fase 1.14.

## Alcance Implementado

- Centro de Control ISO Unificado en `/centro-control-iso`.
- Endpoint agregador `GET /api/iso-command-center/unified`.
- Auditor ISO asistido deterministico inicial en `/auditor-iso`.
- Endpoint `GET /api/iso-auditor/preview`.
- Workflow basico no destructivo para acciones recomendadas mediante eventos.
- Validaciones dedicadas para centro unificado, auditor y workflow.

## Regla Multi-Tenant Critica

La fuente de verdad para visibilidad normativa es `tenant_standards`.

El Centro de Control y Auditor ISO:

- muestran solo normas activas/contratadas del tenant;
- no muestran normas no contratadas con metricas en cero;
- no crean `tenant_standards`;
- no activan normas automaticamente;
- tratan `ISO9001 / 2026_FDIS` solo como transicion no certificable.

Las versiones `transition_prep` quedan fuera de las tarjetas operativas principales y se devuelven como `transition_items` o alertas informativas.

## Endpoints

### `GET /api/iso-command-center/unified`

Devuelve:

- `summary`: readiness global, cobertura, acciones, riesgos y planes;
- `standard_cards`: tarjetas operativas por norma contratada;
- `transition_items`: versiones de transicion no certificables;
- `workflow`: avance de sugerencias, conversiones y objetos abiertos;
- `priorities`: proximas prioridades;
- `activity`: actividad reciente;
- `alerts`: advertencias ejecutivas;
- `quick_links`: enlaces a modulos ISO.

### `GET /api/iso-auditor/preview`

Devuelve una preauditoria deterministica:

- normas contratadas;
- readiness por norma;
- areas de revision;
- preguntas sugeridas desde `iso_audit_questions` si existe;
- preguntas fallback propias si no hay preguntas en BD;
- foco de evidencia y brechas;
- advertencias y limitaciones.

### Workflow Acciones Recomendadas

- `GET /api/iso-recommended-actions/workflow-summary`
- `GET /api/iso-recommended-actions/:id/workflow`
- `POST /api/iso-recommended-actions/:id/workflow/transition`
- `POST /api/iso-recommended-actions/:id/workflow/comment`

El workflow registra eventos en `iso_recommended_action_workflow_events` sin cambiar masivamente tablas operativas.

## Modelo de Datos Nuevo

Migracion:

`database/migrations/20260507_iso_recommended_action_workflow.sql`

Tabla:

`iso_recommended_action_workflow_events`

Campos principales:

- `suggestion_id`
- `tenant_id`
- `previous_status`
- `new_status`
- `event_type`
- `comment`
- `user_id`
- `metadata`
- `created_at`

## Seguridad

- Todos los endpoints requieren JWT y RBAC.
- Los endpoints filtran por tenant desde `req.user`.
- Solo roles de lectura pueden consultar Centro y Auditor.
- Transiciones de workflow requieren roles operativos por la regla RBAC existente de `/api/iso-recommended-actions`.
- No se crean evidencias.
- No se modifican `tenant_controls`.
- No se crean acciones operativas al abrir vistas.

## Readiness

El endpoint unificado reutiliza el scoring transparente del Command Center:

- cobertura normativa-operativa;
- diagnostico/brechas;
- riesgos;
- acciones recomendadas/convertidas;
- documentos/evidencia disponible.

Cuando faltan fuentes, `data_quality` queda como `partial` o `limited`.

## Validacion

Backend:

```bash
node -c backend/src/services/isoCommandCenter.service.js
node -c backend/src/routes/iso-command-center.routes.js
node -c backend/src/services/isoAuditor.service.js
node -c backend/src/routes/iso-auditor.routes.js
node -c backend/src/services/isoRecommendedActions.service.js
node -c backend/src/routes/iso-recommended-actions.routes.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js
```

Frontend:

```bash
cd frontend
npm run build
```

Scripts:

```bash
bash scripts/validate-iso-unified-command-center.sh
bash scripts/validate-iso-auditor.sh
bash scripts/validate-iso-action-workflow.sh
bash scripts/validate-iso-phase-1-11-1-13.sh
```

Migracion workflow:

```bash
psql "$DATABASE_URL" -f database/migrations/20260507_iso_recommended_action_workflow.sql
```

Conteos criticos esperados:

- `standards`: 26
- `tenant_standards`: 23
- `tenant_controls`: 1358
- `evidences`: 205

## Limitaciones

- Auditor ISO es deterministico inicial; no llama ai-engine en esta fase.
- Workflow registra seguimiento no destructivo, pero no reemplaza el estado fisico de objetos operativos existentes.
- Reporte Ejecutivo Premium queda fuera de alcance hasta Fase 1.14.

## Proxima Fase

Fase 1.14 debe abordar reportes ejecutivos premium HTML/PDF con branding, historial de exportes, logo tenant y diseno imprimible.
