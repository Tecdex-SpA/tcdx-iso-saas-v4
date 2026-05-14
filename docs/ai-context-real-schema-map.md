# AI Context Real Schema Map

Fecha: 2026-05-14

Esta pasada endurece `backend/src/services/aiContextBuilder.service.js` contra diferencias reales de esquema. El objetivo es evitar errores visibles como `42703` y mantener respuestas IA útiles aunque una tabla opcional no exista o tenga columnas distintas.

| entity | table_or_view | columns_found | current_query_file | current_problem | action |
|---|---|---|---|---|---|
| Salud efectiva por control | `public.v_iso_control_effective_health` | `tenant_id`, `tenant_control_id`, `iso`, `clause`, `operation_id`, `effective_health_score`, `effective_health_status`, `compliance_bucket`, `evidence_quality_status`, contadores de evidencias/hallazgos/NC/planes | `backend/src/services/aiContextBuilder.service.js` | Fuente primaria correcta | Se mantiene como fuente obligatoria y filtrada por tenant. |
| Resumen efectivo KPI | `public.v_iso_effective_kpi_summary` | `tenant_id`, `iso`, `operation_id`, `active_scope_controls`, `compliance_percentage`, `official_evidence_percentage`, `kpi_health_status`, contadores efectivos | `backend/src/services/aiContextBuilder.service.js` | Fuente primaria correcta | Se mantiene para preanálisis, readiness y resumen. |
| Hallazgos | `findings` | Uso real observado: `tenant_id`, `tenant_control_id`, `title`, `description`, `finding_type`, `severity`, `status`, `owner`, `due_date`, `iso_code`, `created_at` según rutas/reportes | `backend/src/services/aiContextBuilder.service.js` | Antes podía asumir columnas no presentes | Ahora consulta columnas vía `information_schema` y filtra por norma solo si existe columna compatible. |
| No conformidades | `tenant_nonconformities` | Uso real observado: `tenant_id`, `control_id`, `control_description`, `status`, `detected_at`; no siempre existe `created_at` | `backend/src/services/aiContextBuilder.service.js` | Antes podía ordenar por columnas inexistentes | Ahora ordena por `detected_at` o `created_at` solo si existen. |
| Riesgos ISO | `iso_risk_matrix_items` | Uso real observado: `tenant_id`, `standard_code`, `risk_code`, `risk_title`, `risk_description`, `residual_risk_score`, `residual_risk_level`, `created_at`, `updated_at` | `backend/src/services/dashboardV2.service.js`, `backend/src/services/aiContextBuilder.service.js` | Antes buscaba tabla genérica `risks` | Ahora usa `iso_risk_matrix_items` como fuente preferente si existe. |
| Riesgos de activos | `asset_risks` + `assets` | Uso real observado: `asset_risks.asset_id`, `risk`, `impact`, `probability`, `level`; `assets.id`, `tenant_id`, `name`, `type`, `criticality`, `iso` | `backend/src/reports/services/reportData.service.js`, `backend/src/services/aiContextBuilder.service.js` | Fallback de riesgo no estaba alineado | Ahora se usa como fallback si no existe matriz ISO. |
| Activos | `assets` | Uso real observado: `tenant_id`, `name`, `type`, `criticality`, `iso`, `created_at` cuando existe | `backend/src/services/aiContextBuilder.service.js` | Puede faltar en algunos entornos | Ahora se consulta solo si existe y tiene `tenant_id`. |
| Evidencias | `evidences` | Uso real observado: `tenant_id`, `status`, `created_at`, `uploaded_at`, referencias a control/evidencia | `backend/src/services/aiContextBuilder.service.js` | Fuente estable pero columnas de fecha pueden variar | Ahora ordena por columna existente. |
| Planes de acción | `action_plans` | Uso real observado: `tenant_id`, `status`, `due_date`, `created_at`, posibles vínculos a control/riesgo | `backend/src/services/aiContextBuilder.service.js` | Fuente estable pero fechas/estado pueden variar | Ahora filtra abiertos solo si existe `status` y prioriza vencidos si existe `due_date`. |
| Auditorías | `audits` | Uso real observado: `tenant_id`, `created_at`, `scheduled_date` | `backend/src/services/aiContextBuilder.service.js` | Puede variar por entorno | Ahora consulta solo si existe y tiene `tenant_id`. |
| KPIs | `kpi_snapshots` + `kpi_definitions` | Uso real observado: `kpi_snapshots.tenant_id`, `kpi_id`, `standard_code`, `calculated_at`, `period_start`; `kpi_definitions.id`, `code`, `name`, `category` | `backend/src/routes/ai-compliance.routes.js`, `backend/src/services/aiContextBuilder.service.js` | Antes buscaba tabla genérica `kpis` | Ahora usa snapshots + definitions si existen. |
| Documentos indexados | `document_index` | Columnas variables: `tenant_id`, `provider`, `file_name` o `title`, `mime_type`, `file_extension`, `metadata_json`, `web_view_url`, `file_url`, `modified_at`, `indexed_at`, `status` | `backend/src/services/aiContextBuilder.service.js` | Antes asumía columnas fijas | Ahora selecciona expresiones seguras según columnas existentes. |

## Resultado

- No se consulta una tabla opcional sin confirmar existencia.
- No se asumen columnas opcionales.
- Todas las consultas operativas mantienen filtro `tenant_id`.
- Las limitaciones visibles al usuario quedan en español operacional, sin SQLSTATE ni stack trace.

