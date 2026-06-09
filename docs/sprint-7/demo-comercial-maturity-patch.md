# Sprint 7.1B - Patch de madurez demo comercial

## Objetivo

Madurar el tenant `Empresa Demo TCDX Compliance` despues de ejecutar el seed base de Sprint 7.1. El objetivo comercial es que la demo no se vea como una empresa casi sin implementacion, sino como una organizacion con avance real, evidencias suficientes y brechas utiles para demostrar valor.

Archivo SQL:

```text
database/demo/demo_comercial_tcdx_maturity_patch.sql
```

## Que corrige

El patch corrige dos frentes:

- Corrige datos fuente para que Dashboard, Health/KPIs, Cumplimiento/Auditoria, Evidencias, Riesgos, Planes de Accion, Reportes Premium y Ciclo ISO tengan una senal comercial madura.
- Evita repetir el problema detectado en `findings`: el patch usa `finding_type = 'observacion'` o `oportunidad de mejora`, y no inserta `tenant_control_id` en hallazgos demo.

El SQL base tambien fue corregido en:

```text
database/demo/demo_comercial_tcdx.sql
```

## Por que la demo base se veia inmadura

El seed base inicializaba muchos controles por operaciones/normas, pero solo una cantidad limitada de evidencias quedaba vinculada a controles. Como Health se calcula desde datos fuente, especialmente `tenant_controls`, `evidences`, `findings`, `tenant_nonconformities` y `action_plans`, muchos controles quedaban sin evidencia y empujaban el cumplimiento global hacia abajo.

## Datos que actualiza

- `tenant_controls`: ajusta `status`, `score`, `health_status`, `applicability` y `priority` solo para el tenant demo.
- `evidences`: agrega evidencias metadata-only para controles cubiertos/parciales y algunas pendientes.
- `document_index`: agrega documentos metadata-only asociados a evidencias de madurez.
- `tenant_evidence_semantic_profiles`: marca parte de documentos como `processed` y mantiene otros `not_processed` si la tabla existe.
- `action_plans`: deja mezcla de acciones completadas, en progreso, abiertas y 1-2 vencidas.
- `asset_risks` e `iso_risk_matrix_items`: balancea riesgos con ISO 9001 mas controlada e ISO 27001 con mas riesgo residual.
- `iso_express_assessment_gaps`: mantiene 4-8 brechas con 1 critica y varias medias/altas.
- `findings`: usa tipos validos y no escribe `tenant_control_id`.
- `audits`: mantiene auditorias demo activas/pendientes.
- `standard_lifecycle_status` y `standard_lifecycle_stage_requests`: deja ISO 9001 en verificacion/auditoria e ISO 27001 en implementacion/tratamiento de riesgos si existen.

## Como evita errores de constraints/FK

- Aborta si no existe `Empresa Demo TCDX Compliance`.
- Usa `to_regclass` antes de operar tablas opcionales.
- Valida columnas requeridas con `information_schema.columns`.
- No inserta `tenant_control_id` en `findings`, porque el esquema real puede referenciar `public.controls`, no `public.tenant_controls`.
- Usa solo valores observados en backend:
  - `findings.finding_type`: `observacion`, `oportunidad de mejora`.
  - `findings.status`: `abierto`, `accion definida`.
  - `findings.severity`: `alta`, `media`, `baja`.
  - `action_plans.status`: `abierto`, `en progreso`, `completado`.
  - `evidences.status`: `aprobada`, `pendiente`.
  - `document_index.status`: `analyzed`, `indexed`.

## Copiar a la VM DB

Desde la maquina local:

```bash
scp database/demo/demo_comercial_tcdx_maturity_patch.sql tecdex@db.tcdx.int:/tmp/demo_comercial_tcdx_maturity_patch.sql
```

## Ejecutar en db.tcdx.int

```bash
ssh tecdex@db.tcdx.int
```

```bash
sudo -u postgres psql -d tecdex_saas -v ON_ERROR_STOP=1 -f /tmp/demo_comercial_tcdx_maturity_patch.sql
```

## Validaciones SQL

Tenant demo:

```sql
SELECT id, name
FROM tenants
WHERE lower(name) = lower('Empresa Demo TCDX Compliance');
```

Controles por estado:

```sql
SELECT cc.iso, tc.status, tc.health_status, count(*) AS total
FROM tenant_controls tc
JOIN controls_catalog cc ON cc.id = tc.control_id
JOIN tenants t ON t.id = tc.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
GROUP BY cc.iso, tc.status, tc.health_status
ORDER BY cc.iso, tc.status, tc.health_status;
```

Evidencias de madurez:

```sql
SELECT e.status, e.validated, e.metadata->>'standard_code' AS standard_code, count(*) AS total
FROM evidences e
JOIN tenants t ON t.id = e.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND e.metadata->>'demo_maturity_patch' = 'sprint-7.1B'
GROUP BY e.status, e.validated, e.metadata->>'standard_code'
ORDER BY standard_code, e.status;
```

Documentos procesados:

```sql
SELECT di.status, count(*) AS total
FROM document_index di
JOIN tenants t ON t.id = di.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND di.metadata_json->>'demo_maturity_patch' = 'sprint-7.1B'
GROUP BY di.status
ORDER BY di.status;
```

Findings seguros:

```sql
SELECT finding_type, severity, status, count(*) AS total
FROM findings f
JOIN tenants t ON t.id = f.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
GROUP BY finding_type, severity, status
ORDER BY finding_type, severity, status;
```

Planes de accion:

```sql
SELECT iso_code, status, priority, count(*) AS total,
       count(*) FILTER (WHERE status NOT IN ('completado', 'cancelado') AND due_date < CURRENT_DATE) AS vencidas
FROM action_plans ap
JOIN tenants t ON t.id = ap.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
GROUP BY iso_code, status, priority
ORDER BY iso_code, status, priority;
```

Riesgos:

```sql
SELECT a.iso, ar.level, count(*) AS total
FROM asset_risks ar
JOIN assets a ON a.id = ar.asset_id
JOIN tenants t ON t.id = a.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
GROUP BY a.iso, ar.level
ORDER BY a.iso, ar.level;
```

Brechas:

```sql
SELECT g.standard_code, g.severity, g.metadata->>'commercial_state' AS commercial_state, count(*) AS total
FROM iso_express_assessment_gaps g
JOIN tenants t ON t.id = g.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
  AND g.metadata->>'demo_seed' = 'sprint-7.1'
GROUP BY g.standard_code, g.severity, g.metadata->>'commercial_state'
ORDER BY g.standard_code, g.severity;
```

Lifecycle:

```sql
SELECT sls.standard_code, sls.effective_stage_code, sls.health_status, sls.maturity_score, sls.evidence_coverage_pct
FROM standard_lifecycle_status sls
JOIN tenants t ON t.id = sls.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
ORDER BY sls.standard_code;
```

Health efectivo si la vista existe:

```sql
SELECT iso,
       round(avg(effective_health_score), 1) AS avg_health,
       count(*) FILTER (WHERE evidence_quality_status = 'sin_evidencia') AS sin_evidencia,
       count(*) FILTER (WHERE effective_health_status = 'saludable') AS saludables,
       count(*) FILTER (WHERE effective_health_status = 'atencion') AS atencion,
       count(*) FILTER (WHERE effective_health_status IN ('deteriorado', 'critico')) AS deteriorados
FROM v_iso_control_effective_health v
JOIN tenants t ON t.id = v.tenant_id
WHERE lower(t.name) = lower('Empresa Demo TCDX Compliance')
GROUP BY iso
ORDER BY iso;
```

## Validacion web esperada

Despues del patch y refresh:

- `/dashboard`: health mas maduro y cumplimiento razonable, idealmente sobre 55%.
- Vista KPI: valores mas presentables.
- `/health`: baja drastica de controles sin evidencia.
- `/cumplimiento-auditoria`: mezcla realista de controles saludables, atencion y deteriorados.
- `/evidencias`: biblioteca documental mas completa.
- `/riesgos`: ISO 27001 con mas riesgo residual que ISO 9001.
- `/planes-accion`: acciones en distintos estados y 1-2 vencidas.
- `/exportes`: reportes premium con contenido suficiente.

## Rollback recomendado

Usar backup/restore si se requiere volver exactamente al estado anterior.

Si se requiere rollback SQL manual, hacerlo solo con el `tenant_id` de `Empresa Demo TCDX Compliance`, revisando conteos antes de confirmar. No borrar catalogos globales ni otros tenants. El patch no usa `DELETE`; por eso el rollback operacional recomendado es restaurar backup o reejecutar el seed base seguido de ajustes manuales controlados.

## Riesgos remanentes

- Algunas tablas base historicas no tienen DDL completo en `database/`; el patch valida tablas/columnas antes de operar, pero no puede simular todas las constraints de la BD real sin conexion a esa BD.
- La biblioteca documental sigue siendo metadata-only; no hay archivos fisicos.
- Si la instalacion real tiene columnas adicionales con checks mas estrictos no reflejados en backend/migraciones, puede requerirse ajuste puntual.
