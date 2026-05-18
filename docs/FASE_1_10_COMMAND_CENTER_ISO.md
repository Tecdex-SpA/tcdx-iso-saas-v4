# Fase 1.10 - Command Center ISO Ejecutivo

## Objetivo

El Command Center ISO centraliza el estado ejecutivo de cumplimiento por tenant y norma. Consolida diagnostico express, cobertura ISO-operativa, riesgos, documentos, acciones recomendadas, conversiones, hallazgos, no conformidades y planes de accion.

La fase es de lectura/consolidacion. No crea acciones, evidencias, controles ni conversiones por abrir la vista.

## Arquitectura

Backend:

- `backend/src/services/isoCommandCenter.service.js`
- `backend/src/routes/iso-command-center.routes.js`
- Ruta base: `/api/iso-command-center`

Frontend:

- `/command-center-iso`
- Componentes en `frontend/src/components/command-center-iso`

No se crea migracion: el servicio usa tablas existentes y detecta fuentes opcionales.

## Endpoints

- `GET /api/iso-command-center/summary`
- `GET /api/iso-command-center/standards`
- `GET /api/iso-command-center/standards/:standard_code/:version_code`
- `GET /api/iso-command-center/readiness`
- `GET /api/iso-command-center/activity`

Todos requieren JWT y RBAC.

## Fuentes de datos

Fuentes principales:

- `tenant_standards`
- `iso_standard_versions`
- `v_iso_control_catalog_coverage`
- `iso_express_assessments`
- `iso_express_assessment_gaps`
- `iso_risk_matrix_items`
- `iso_operational_suggestions`
- `iso_recommended_action_conversions`
- `iso_generated_documents`
- `action_plans`
- `findings`
- `tenant_nonconformities`

Si una fuente opcional no existe, la API no falla: devuelve `data_quality.level` como `partial` o `limited` y agrega una nota.

## Formula de readiness

Readiness por norma:

- 30% cobertura normativa-operativa.
- 25% diagnostico/brechas.
- 20% riesgos.
- 15% acciones recomendadas/convertidas.
- 10% documentos/evidencia documental disponible.

Si falta una dimension, se recalcula con las dimensiones disponibles y se marca calidad de datos parcial.

Etiquetas:

- 85-100: `listo`
- 70-84: `avanzado`
- 50-69: `en_progreso`
- 0-49: `requiere_atencion`

Semaforo:

- `saludable`
- `atencion`
- `critico`
- `transicion`

Las versiones no certificables o `transition_prep`, como `ISO9001 2026_FDIS`, se muestran como transicion.

## Seguridad multi-tenant

- `tenant_id` se resuelve desde JWT.
- Solo roles plataforma pueden consultar otro tenant mediante query.
- Todas las consultas operativas filtran por tenant.
- Las fuentes globales ISO se cruzan contra normas activas del tenant.
- No hay escrituras en esta fase.

## Validacion

Backend:

```bash
node -c backend/src/services/isoCommandCenter.service.js
node -c backend/src/routes/iso-command-center.routes.js
node -c backend/src/app.js
node -c backend/src/middleware/rbac.middleware.js
```

Frontend:

```bash
cd frontend
npm run build
npx eslint src/app/command-center-iso/page.tsx src/components/command-center-iso
```

Script:

```bash
export API_URL="http://bk.tcdx.int:3000"
export FRONTEND_URL="https://181.212.166.187:8443"
export TEST_EMAIL="admin@rieltec.com"
export TEST_PASSWORD="123456"
bash scripts/validate-iso-command-center.sh
```

## Limitaciones

- No reemplaza reportes formales.
- No genera PDF.
- No crea planes, evidencias, hallazgos ni conversiones.
- La calidad del readiness depende de las fuentes disponibles y de que haya diagnosticos/matrices/documentos recientes.

## Proximos pasos

- Agregar drill-down por norma.
- Integrar export ejecutivo.
- Agregar tendencias historicas de readiness.
- Integrar filtros por tenant para roles plataforma.
