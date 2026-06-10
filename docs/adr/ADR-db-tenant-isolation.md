# ADR: postura de aislamiento tenant a nivel base de datos

Fecha: 2026-06-10
Estado: Propuesta para revision Mario/Andres

## 1. Contexto actual

TCDX Compliance by TECDEX opera como SaaS multi-tenant. El flujo MVP esperado es:

```text
tenant -> norma -> control -> evidencia -> brecha -> accion -> reporte -> IA trazable
```

La aplicacion ya tiene JWT, RBAC, middleware de tenant scope, filtros SQL por `tenant_id` y validaciones por ruta en modulos criticos. La revision estructural previa indica que la base de datos viva no debe asumirse protegida por RLS: el aislamiento depende principalmente de backend, queries y grants.

Sprint 1 agrega hardening central path-aware y una suite QA cross-tenant, pero esto no convierte `tenant_id` en una barrera DB por si solo.

## 2. Riesgo

No se debe asumir que una columna `tenant_id` implica aislamiento efectivo. Un bug puntual en una consulta, join, export, descarga, job async, integracion documental o endpoint IA puede filtrar datos entre tenants si la base no impone una segunda barrera.

Impacto:

- Lectura cross-tenant de controles, evidencias, hallazgos, reportes o documentos.
- Escritura o borrado en tenant incorrecto.
- Descargas de archivos o PDFs por ID opaco sin validar tenant.
- Contexto IA contaminado con datos de otro tenant.
- Mayor riesgo durante migraciones, scripts repair y jobs async.

## 3. Alternativas evaluadas

### RLS PostgreSQL

Ventajas:

- Defensa fuerte en DB por fila.
- Reduce blast radius de errores en backend.
- Auditable con politicas por tabla.

Costos/riesgos:

- Requiere setear contexto tenant por conexion/transaccion.
- Puede romper queries legacy, jobs, reportes y superadmin si se activa de golpe.
- Necesita pruebas por modulo antes de produccion.

### Roles minimos DB por runtime

Ventajas:

- Limita permisos de la aplicacion.
- Reduce dano de credenciales runtime.
- Compatible con despliegue incremental.

Costos/riesgos:

- No aisla filas por tenant por si solo.
- Requiere separar permisos para app, migrations, read-only analytics, backups y jobs.

### Vistas seguras

Ventajas:

- Permite exponer subsets controlados para modulos sensibles.
- Puede encapsular joins con tenant.

Costos/riesgos:

- Duplica contratos si se mezcla con tablas directas.
- Requiere disciplina para que backend use vistas y no tablas crudas.

### Controles equivalentes en backend + pruebas cross-tenant

Ventajas:

- Menor riesgo de compatibilidad inmediata.
- Aprovecha JWT/RBAC y middleware existente.
- Rapido para MVP/piloto controlado.

Costos/riesgos:

- Defensa concentrada en backend.
- Cada endpoint nuevo o legacy necesita pruebas negativas.
- No cubre scripts DB manuales, jobs mal configurados o queries directas.

### Enfoque incremental hibrido

Ventajas:

- Mantiene compatibilidad MVP.
- Agrega pruebas obligatorias y reduce riesgo antes de activar cambios DB.
- Permite empezar por tablas criticas y roles minimos.

Costos/riesgos:

- Requiere seguimiento disciplinado.
- La fase inicial sigue teniendo riesgo residual mientras no haya RLS/roles/vistas en tablas criticas.

## 4. Decision recomendada para MVP/piloto

Adoptar enfoque incremental hibrido:

1. Mantener backend JWT/RBAC/tenant middleware como barrera inmediata.
2. Ejecutar suite cross-tenant core antes de demo comercial sensible, piloto o migracion.
3. Formalizar que piloto con datos reales requiere backup/restore gate exitoso y no acepta defaults demo.
4. Preparar roles DB minimos para runtime, migrations y backup.
5. Disenar RLS por tabla critica en ambiente staging, sin activarla en produccion hasta aprobar pruebas de compatibilidad.
6. Para endpoints de descargas/jobs por ID opaco, exigir lookup con `tenant_id` antes de devolver contenido.

No ejecutar migraciones destructivas ni activar RLS en produccion sin aprobacion explicita de Mario/Andres.

## 5. Riesgos residuales

- Rutas legacy o aliases pueden escapar al set de pruebas si no se inventarian.
- Dealer/superadmin necesitan reglas especiales y pruebas propias.
- Jobs async y reportes cacheados pueden conservar artefactos generados antes del hardening.
- Archivos en filesystem deben mapearse siempre a tenant y entidad autorizada.
- IA debe operar como asistente supervisado y no como decisor autonomo.

## 6. Tablas criticas iniciales

- `tenants`
- `users`
- `tenant_controls`
- `evidences`
- `findings`
- `tenant_nonconformities`
- `action_plans`
- `audits`
- `assets`
- `reports` o tablas relacionadas a reportes/jobs/exportes
- Tablas IA con `tenant_id`
- Tablas documentales/integraciones con `tenant_id`, incluyendo `document_index`, fuentes, credenciales y logs de sync

## 7. Plan incremental

### Fase 0 - Sprint 1/P0

- Middleware path-aware para tenant en path/query/body.
- Suite `scripts/qa-cross-tenant-core.sh`.
- Politica de credenciales demo.
- Gate backup/restore.
- ADR aprobada por Mario/Andres.

### Fase 1 - Antes de primer cliente asistido

- Inventario contractual de endpoints publicos, internos y legacy.
- Tests negativos por ID opaco en descargas, reportes, evidencias, documentos y jobs.
- Roles DB minimos para usuario runtime.
- Smoke test de reportes, evidencias, auditorias, IA y documentos con dos tenants.

### Fase 2 - Staging

- Prototipo RLS en tablas criticas.
- Seteo seguro de tenant context por request/transaccion.
- Pruebas con platform/superadmin/dealer.
- Validacion de jobs async y report exports.

### Fase 3 - Produccion controlada

- Activacion gradual por tabla o modulo aprobada.
- Monitoreo de errores `permission denied`/RLS.
- Rollback preparado por tabla/politica.

## 8. Criterios de aceptacion

- Toda operacion cross-tenant core devuelve `403` o `404`.
- Operacion same-tenant equivalente devuelve `200`, `201`, `202`, `204` o codigo funcional documentado.
- Ninguna descarga por ID opaco omite lookup tenant.
- Runtime DB no opera con rol owner/superuser.
- RLS staging pasa suite core antes de aprobar produccion.
- Superadmin/dealer conservan capacidades autorizadas.
- No se agregan secretos, dumps ni backups al repo.

## 9. Rollback o mitigacion

Si RLS, roles o vistas rompen compatibilidad:

1. Desactivar solo la politica, vista o rol afectado; no revertir datos.
2. Mantener backend tenant middleware y suite cross-tenant como barrera compensatoria.
3. Registrar endpoint, tabla, query y rol afectado.
4. Agregar test de regresion antes de reintentar.
5. Restaurar desde backup solo si hay corrupcion o perdida de datos, siguiendo `docs/runbooks/pre-customer-backup-restore-gate.md`.
