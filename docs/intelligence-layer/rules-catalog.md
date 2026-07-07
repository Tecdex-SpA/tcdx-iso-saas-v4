# Rules Catalog

## Version

`intelligence_rules_v1`

## Prioridad de reglas

1. Reglas explicitas activas en DB cuando existan.
2. `rule_hints` desde Knowledge Base.
3. Reglas hardcoded de seguridad minima.
4. IA solo para narrativa posterior, no decision primaria.

## Reglas implementadas

| rule_key | Categoria | Severidad base | Descripcion |
|---|---|---:|---|
| control_active_without_verifiable_evidence | evidence | media/alta | control activo sin evidencia verificable |
| critical_control_without_owner | governance | alta | control critico sin owner |
| evidence_without_control_or_process | evidence | media | evidencia sin control/proceso |
| evidence_does_not_match_expected_kb | evidence | media | evidencia no coincide con expected_evidence |
| soa_applicable_without_evidence | audit | alta | SOA aplicable sin evidencia |
| action_plan_overdue | action_plan | media/alta | accion vencida |
| closed_action_without_evidence | action_plan | media | accion cerrada sin evidencia |
| open_finding_without_action_plan | audit | media/alta | hallazgo abierto sin plan |
| old_nonconformity | audit | alta/critica | no conformidad antigua abierta |
| high_risk_without_treatment | risk | critica | riesgo critico sin tratamiento |
| risk_without_owner | risk | media/alta | riesgo sin owner |
| upcoming_audit_low_readiness | audit | alta | auditoria proxima con readiness bajo |
| score_high_data_quality_low | data_quality | media | score alto con data quality bajo |
| active_standard_without_kb | data_quality | media | estandar activo sin cobertura KB |
| ai_response_without_knowledge_basis | ai_governance | media | respuesta IA sin knowledge_basis |

## Estructura finding

Cada finding incluye:

- `id`
- `rule_key`
- `type`
- `severity`
- `title`
- `description`
- `impact`
- `source`
- `confidence`
- `related_entities`
- `recommended_action`
- `evidence_basis`
- `knowledge_basis`
