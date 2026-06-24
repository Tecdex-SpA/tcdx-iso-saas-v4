# SoA Intelligence y recomendaciones IA gobernadas

## Propósito

SoA Intelligence agrega una capa de señales, reglas determinísticas y recomendaciones IA sobre el Statement of Applicability oficial. El SoA oficial sigue siendo `control_soa`; las recomendaciones se guardan por separado en `control_soa_assessments`.

## SoA oficial vs SoA sugerido

- SoA oficial: campos editables y auditables en `control_soa` (`applicable`, `implementation_status`, `justification`, `owner`, `review_date`, `notes`).
- SoA sugerido: assessments en `control_soa_assessments` con aplicabilidad/estado/justificación sugeridos, confianza, señales usadas, resultado IA y acciones recomendadas.
- Regla de gobierno: ninguna sugerencia modifica el SoA oficial sin aprobación explícita de un usuario autorizado.

## Fuentes de datos

La fuente oficial del SoA editable es `controls` + `control_soa`. Para enriquecer señales operativas se usa `controls.catalog_control_id` para relacionar con `tenant_controls` y tablas asociadas:

- `evidences`
- `findings`
- `tenant_nonconformities`
- `action_plans`
- `iso_risk_matrix_items`
- `control_health_scores`
- `audits`
- `v_latest_health_kpi_snapshots`

Cuando la relación no es directa, el resumen indica relación por catálogo/control tenant o por estándar.

## Reglas determinísticas

El motor rule-based evalúa evidencia, hallazgos, no conformidades, acciones vencidas, riesgos, Health/KPI, responsable y revisión. Genera:

- `suggested_applicable`
- `suggested_implementation_status`
- `suggested_justification`
- `confidence_score` y `confidence_level`
- `rule_results`
- `recommended_actions`

El motor nunca sugiere no aplicabilidad con confianza alta salvo señales explícitas de fuera de alcance operacional.

## Rol de ai-engine

El endpoint `POST /api/ai/soa/assess-control` recibe el control, el SoA oficial, señales y sugerencia determinística. Devuelve JSON estructurado con explicación, confianza y acciones recomendadas. Si el LLM no está disponible, ai-engine devuelve fallback controlado usando la sugerencia de sistema.

## Endpoints backend

- `GET /api/soa/:tenant_id/intelligence?iso=ISO27001`
- `GET /api/soa/:tenant_id/intelligence/:tenant_control_id?iso=ISO27001`
- `POST /api/soa/:tenant_id/assessments/run?iso=ISO27001`
- `POST /api/soa/:tenant_id/assessments/run-batch?iso=ISO27001`
- `GET /api/soa/:tenant_id/assessments?iso=ISO27001`
- `POST /api/soa/:tenant_id/assessments/:assessment_id/apply`
- `POST /api/soa/:tenant_id/assessments/:assessment_id/reject`
- `GET /api/soa/:tenant_id/change-log?iso=ISO27001`

## Tablas nuevas

- `control_soa_assessments`: histórico no único de recomendaciones de sistema/IA/híbridas.
- `control_soa_change_log`: registro campo a campo de cambios aplicados al SoA oficial desde sugerencias aprobadas.

## Seguridad y roles

- Lectura de inteligencia: usuarios autorizados del tenant, incluyendo auditor.
- Ejecutar assessments, aplicar o rechazar: `admin`, `tenant_admin`, `superadmin`.
- Auditor permanece read-only.
- Todas las consultas validan `tenant_id` y no exponen datos cross-tenant.

## Validación manual sugerida

Con token admin y tenant autorizado:

```bash
curl -sS "$API_URL/api/soa/$TENANT_ID/intelligence?iso=ISO27001" -H "Authorization: Bearer $TOKEN" | jq '.summary'
curl -sS -X POST "$API_URL/api/soa/$TENANT_ID/assessments/run-batch?iso=ISO27001" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"limit":10,"use_ai":false}' | jq
curl -sS "$API_URL/api/soa/$TENANT_ID/assessments?iso=ISO27001" -H "Authorization: Bearer $TOKEN" | jq 'length'
```

## Riesgos pendientes

- Algunas señales pueden ser de estándar completo si la tabla no contiene relación directa por control.
- La auditoría se limita a cambios aplicados desde assessments; ediciones manuales existentes siguen su comportamiento previo.
- El uso de IA depende de configuración y disponibilidad del ai-engine.
