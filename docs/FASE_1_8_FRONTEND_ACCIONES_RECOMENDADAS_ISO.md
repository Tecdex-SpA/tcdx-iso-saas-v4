# Fase 1.8 - Frontend Acciones Recomendadas ISO

## Objetivo

La vista `/acciones-recomendadas` presenta el puente visual entre la inteligencia ISO y la ejecucion operativa del SaaS. Permite revisar sugerencias generadas por el backend de ejecucion operativa ISO, filtrarlas, validar conversiones con `dry_run`, descartarlas y convertirlas solo con confirmacion explicita del usuario.

La pantalla no crea planes de accion, evidencias, hallazgos ni no conformidades al cargar.

## Endpoints consumidos

La vista usa los endpoints reales de Fase 1.7:

- `GET /api/iso-operational-execution/summary`
- `GET /api/iso-operational-execution/suggestions`
- `GET /api/iso-operational-execution/:id`
- `POST /api/iso-operational-execution/generate`
- `POST /api/iso-operational-execution/:id/approve`
- `POST /api/iso-operational-execution/:id/reject`

`approve` se consume primero con `dry_run=true`. La conversion real se ejecuta solo despues de confirmacion humana.

## Comportamiento seguro

- Sin JWT se muestra un mensaje controlado.
- `401` y `403` se muestran como sesion invalida o falta de permisos.
- Roles de solo lectura pueden revisar recomendaciones, pero no generar, convertir ni descartar.
- El frontend no inventa escrituras directas: solo llama endpoints backend existentes.
- La generacion usa simulacion previa y luego pide confirmacion para guardar sugerencias pendientes.
- La conversion usa simulacion previa y luego pide confirmacion para crear el registro operativo.

## Informacion mostrada

La vista muestra:

- KPIs ejecutivos de recomendaciones.
- Resumen por norma ISO.
- Filtros por estado, norma, prioridad, tipo, origen y texto libre.
- Cards por recomendacion con prioridad, estado, origen, tipo, destino, responsable, fechas y links relacionados.
- Modal de detalle con justificacion, impacto, riesgo si no se ejecuta, proximo paso y trazabilidad.

## Navegacion

El sidebar expone la entrada `Acciones ISO`, apuntando a `/acciones-recomendadas`. La ruta previa `/ejecucion-iso` queda intacta para compatibilidad manual.

## Validacion

Validacion local:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas/frontend
npm run build
```

Validacion contra API desplegada:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas
export API_URL="http://bk.tcdx.int:3000"
export TEST_EMAIL="admin@rieltec.com"
export TEST_PASSWORD="123456"
bash scripts/validate-iso-recommended-actions.sh
```

Consulta de seguridad en BD:

```sql
SELECT 'standards' AS table_name, COUNT(*) AS total FROM standards
UNION ALL
SELECT 'tenant_standards', COUNT(*) FROM tenant_standards
UNION ALL
SELECT 'tenant_controls', COUNT(*) FROM tenant_controls
UNION ALL
SELECT 'evidences', COUNT(*) FROM evidences
ORDER BY table_name;
```

La carga de `/acciones-recomendadas` no debe modificar estos conteos.

## Pendientes

- Convertir preview de `dry_run` a un panel enriquecido si el backend entrega mas detalle estructurado.
- Agregar deep links adicionales cuando los modulos destino soporten filtros por `id`.
- Agregar aprobacion granular por tipo de destino si se separa `accept` de `convert` en backend.
