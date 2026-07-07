# Scoring Model

## Version

`intelligence_scoring_v1`

## Scores

- `calculateAuditReadinessScore`
- `calculateOverallIntelligenceScore`
- `calculateEvidenceMaturityScore`
- `calculateRiskPressureScore`
- `calculateActionExecutionScore`
- `calculateDataQualityScore`
- `calculateKnowledgeCoverageScore`
- `calculateConfidenceScore`

## Formula confidence

```text
confidence_score =
  data_quality_score * 0.45
+ source_coverage_score * 0.20
+ knowledge_coverage_score * 0.25
+ consistency_score * 0.10
```

## Estados

| Score | Estado |
|---:|---|
| 75-100 | alta |
| 45-74 | media |
| 0-44 | baja |

## Degradadores

- Knowledge coverage menor a 35.
- Datos operacionales insuficientes.
- Respuesta IA sin `knowledge_basis`.
- Evidence mismatch con expected_evidence KB.
- Score alto con data quality bajo.

## Explicabilidad

Cada metrica principal devuelve:

- `metric`
- `value`
- `state`
- `why`
- `impact`
- `recommended_action`
- `evidence_basis`
- `knowledge_basis`
- `confidence`
