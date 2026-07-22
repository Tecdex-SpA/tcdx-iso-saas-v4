# Fase 0 — Clasificación de hallazgos contractuales

## Resultado

- Hallazgos originales clasificados: 328
- Hallazgos removidos con evidencia: 328
- Hallazgos restantes: 0
- Baseline vigente: 0

## Clasificación

| Clasificación | Conteo |
|---|---:|
| `critical` | 35 |
| `high` | 6 |
| `repository_scope_not_detected` | 111 |
| `middleware_global_not_detected` | 176 |
| `capability_contract_completed` | 35 |
| `e2e_coverage_added` | 5 |
| `endpoint_mapping_completed` | 1 |

## Evidencia de falsos positivos corregidos

El detector ahora reconoce que `backend/src/app.js` monta la mayoría de routers bajo:

```js
app.use('/api', auth, enforceApiAccess);
app.use('/api', enforceTenantRequestScope);
```

Esto corrige falsos positivos de endpoints protegidos por middleware global que antes solo buscaba señales cercanas al handler.

## Hallazgos resueltos

Los 41 hallazgos que permanecían se resolvieron mediante asociación API basada en imports, clasificación explícita de rutas frontend-only y escenarios E2E versionados. El detalle vigente se obtiene de `artifacts/fase-0/phase0-contracts-check.json` y debe indicar `VERIFIED`.

## Registro histórico anterior

| # | Categoría | Severidad | Hallazgo |
|---:|---|---|---|
| 1 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: acciones_recomendadas |
| 2 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: activos |
| 3 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: admin_saas |
| 4 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: administrar_kpis |
| 5 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: auditorias.ejecucion |
| 6 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: auditorias.ia |
| 7 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: auditorias |
| 8 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: ciclo_vida |
| 9 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: configuracion |
| 10 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: controles |
| 11 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: cotizador |
| 12 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: cumplimiento_auditoria |
| 13 | `productive_capability_without_e2e` | `high` | Productive capability without E2E proof: dashboard_v2 |
| 14 | `productive_capability_without_e2e` | `high` | Productive capability without E2E proof: dashboard |
| 15 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: dealer |
| 16 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: diagnostico |
| 17 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: documentos |
| 18 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: ejecucion_iso |
| 19 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: empresas |
| 20 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: evidencias |
| 21 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: exportes |
| 22 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: hallazgos |
| 23 | `productive_capability_without_e2e` | `high` | Productive capability without E2E proof: health |
| 24 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: ia_auditor |
| 25 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: ia_compliance |
| 26 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: ia_compliance.sugerencias |
| 27 | `productive_capability_without_e2e` | `high` | Productive capability without E2E proof: ia |
| 28 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: iso_health |
| 29 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: login |
| 30 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: matriz_riesgo |
| 31 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: no_conformidades |
| 32 | `productive_capability_without_e2e` | `high` | Productive capability without E2E proof: root.home |
| 33 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: perfil_empresa |
| 34 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: perfil |
| 35 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: plan_accion |
| 36 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: planes_accion |
| 37 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: prefacturacion |
| 38 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: riesgos |
| 39 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: soa |
| 40 | `non_productive_visible_without_feature_flag` | `critical` | Non-productive visible capability without feature flag: usuarios |
| 41 | `capabilities_without_endpoint_association` | `high` | 31 capabilities lack backend endpoint association by static inventory |

## Artefacto máquina

- `artifacts/fase-0/finding-classification.json`
