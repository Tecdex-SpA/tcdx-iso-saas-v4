# Fase 1.9 - Conversion segura de Acciones Recomendadas ISO

## Objetivo

La Fase 1.9 agrega una capa explicita para convertir recomendaciones ISO en objetos operativos reales del SaaS con flujo seguro:

1. Revisar opciones de conversion.
2. Ejecutar `dry-run`.
3. Confirmar conversion real.
4. Registrar trazabilidad en `iso_recommended_action_conversions`.

La conversion nunca ocurre por listar recomendaciones ni por abrir `/acciones-recomendadas`.

## Endpoints

Ruta nueva protegida por JWT/RBAC:

- `GET /api/iso-recommended-actions/:id/conversion-options`
- `POST /api/iso-recommended-actions/:id/dry-run-convert`
- `POST /api/iso-recommended-actions/:id/convert`

La vista `/acciones-recomendadas` usa estos endpoints para simular y convertir. La generacion/listado sigue usando los endpoints de Fase 1.7:

- `GET /api/iso-operational-execution/summary`
- `GET /api/iso-operational-execution/suggestions`
- `POST /api/iso-operational-execution/generate`
- `POST /api/iso-operational-execution/:id/reject`

## Destinos soportados

- `action_plan`: crea plan de accion.
- `finding`: crea hallazgo si hay control operativo con equivalente legacy y severidad suficiente.
- `nonconformity`: crea no conformidad solo si hay control de catalogo y justificacion suficiente.
- `evidence_request`: no crea evidencia real; crea plan de accion para reunir evidencia.
- `audit_task`: crea plan de accion trazado a tarea de auditoria.
- `risk_mitigation`: crea plan de accion de mitigacion.
- `control_review`: no modifica `tenant_controls`; crea plan de accion de revision.

## Tabla de trazabilidad

La migracion `database/migrations/20260507_iso_recommended_action_conversions.sql` crea:

- `iso_recommended_action_conversions`

Registra:

- tenant;
- recomendacion;
- tipo destino solicitado;
- tabla destino;
- id creado;
- usuario conversor;
- payload de origen;
- resultado minimo;
- fecha/hora.

Los `dry-run` no insertan filas en esta tabla para preservar el principio de no escritura durante simulacion.

## Seguridad multi-tenant

- El backend resuelve `tenant_id` desde JWT.
- Solo roles plataforma pueden usar `tenant_id` externo.
- RBAC permite lectura a roles de lectura y conversion a roles operativos.
- La recomendacion debe pertenecer al tenant resuelto.
- `read_only/viewer` queda bloqueado por RBAC para POST.

## Reglas conservadoras

- No se crean evidencias falsas.
- No se actualiza `tenant_controls`.
- No se crean no conformidades sin control asociado.
- No se crean hallazgos sin control operativo compatible.
- `ISO9001 2026_FDIS` queda bloqueado para conversion automatica porque es transicion no certificable.

## Validacion

Backend:

```bash
node -c backend/src/services/isoRecommendedActions.service.js
node -c backend/src/routes/iso-recommended-actions.routes.js
node -c backend/src/services/isoOperationalExecution.service.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js
```

Frontend:

```bash
cd frontend
npm run build
npx eslint src/app/acciones-recomendadas/page.tsx src/components/acciones-recomendadas
```

Script:

```bash
bash scripts/validate-iso-recommended-action-conversions.sh
```

Por defecto el script no ejecuta conversion real. Para prueba controlada:

```bash
ALLOW_WRITE_TEST=true bash scripts/validate-iso-recommended-action-conversions.sh
```

## Rollback logico

La fase no borra datos. Si una conversion real fue incorrecta, se debe:

- revisar `iso_recommended_action_conversions`;
- cerrar/cancelar el objeto operativo creado segun su flujo normal;
- dejar la fila de trazabilidad como evidencia historica.

No se recomienda borrar conversiones.
