# Pipeline Knowledge Base a Intelligence

## Pipeline tecnico

```text
Markdown KB
-> JSONL validado
-> PostgreSQL global
-> knowledge service
-> dataset tenant normalizado
-> matching por entidad
-> knowledge_basis
-> rules
-> scoring
-> explainability
-> next best actions
-> API / reportes / IA Compliance
```

## Enriquecimiento por entidad

Cada entidad conserva su identidad original del tenant y suma campos derivados:

- `knowledge_matches`
- `expected_evidence`
- `audit_questions`
- `common_gaps`
- `recommended_actions`
- `rule_hints`
- `explicit_rules`
- `knowledge_coverage`

## Acoplamiento validado

| Entidad | Matching | Salida |
|---|---|---|
| controles | norma, control, dominio | findings, expected evidence, owner gaps |
| SOA | ISO 27001, control, dominio | blockers de auditoria |
| evidencias | control/proceso/dominio | evidence strength |
| riesgos | severidad, dominio, titulo | critical risk findings |
| planes de accion | estado, vencimiento, vinculos | next best actions |
| auditorias | fecha/readiness | audit blockers |
| hallazgos | estado, severidad, accion | findings sin plan |
| no conformidades | antiguedad, estado | blockers |
| reportes | payload explicable | fundamento para narrativa |
| IA Compliance | knowledge_context filtrado | confidence y guardrails |

## No sustitucion

La KB no crea controles, riesgos, evidencias ni hallazgos tenant. Solo fundamenta reglas, explicaciones y acciones.
