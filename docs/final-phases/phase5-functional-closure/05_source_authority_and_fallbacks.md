# Fase 5 - Fuentes autoritativas y fallbacks

## Reglas implementadas

- Cada formula oficial resuelve un `source_code` desde `FORMULA_SOURCE_MAP`.
- Cada `source_code` tiene contrato versionado y checksum en `sourceContracts.service.js`.
- El resolver no acepta SQL configurable por usuario.
- El resolver valida tenant, permisos, esquema fisico, dataset y minimum sample size.
- Los fallbacks legacy conservados quedan advertidos como: `Fuente primaria <tabla> sin filas utilizables; se uso fallback legacy explicito <tabla>.`
- Los fallos funcionales devuelven `data_requirements` para que UI/BI/reporting expliquen la ausencia en vez de mostrar cero.

## Fallbacks conservados

| Source | Fuente primaria | Fallbacks | Regla |
|---|---|---|---|
| `compliance_requirements_assessments` | `grc_requirement_control_mappings` | `control_soa_assessments`, `tenant_controls` | Fallback solo si primaria existe sin filas utilizables; warning obligatorio. |
| `risk_register_controls` | `grc_quantitative_risk_assessments` | `iso_risk_matrix_items`, `asset_risks`, `privacy_dpia_risks` | No mezcla escalas sin normalizacion de formula. |
| `control_assurance_evidence` | `grc_control_assurance` | `control_soa_assessments`, `control_health_scores`, `tenant_controls` | Fallback metodologico visible. |
| `audit_findings_actions` | `grc_readiness_findings` o `action_plans` segun formula | `findings` | Separar severidad de hallazgos y progreso de acciones. |
| `maturity_assessments` | `survey_evaluations` | `metric_measurements`, `grc_metric_measurements` | No inferir nivel sin datos. |

## Retiro futuro

Los fallbacks se pueden retirar cuando existan datasets oficiales suficientes y equivalencia comprobada por tenant. Mientras existan, no pueden alterar el significado semantico del indicador ni ocultar la fuente usada.
