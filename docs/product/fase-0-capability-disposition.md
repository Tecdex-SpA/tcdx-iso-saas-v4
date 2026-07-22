# Fase 0 — Disposición de capacidades

## Decisión ejecutada

El inventario dejó de inferir productividad por coincidencia entre el nombre de una página y un archivo de rutas. Ahora recorre imports frontend, extrae familias API reales y las contrasta con endpoints Express montados. Las rutas sin backend propio se declaran `backendContractRequired: false`; las capacidades sin contrato quedan `disabled` con flag autoritativo.

Las 35 capacidades antes clasificadas como visibles no productivas quedaron asociadas a contratos reales y a escenarios E2E. Su decisión es `productive`, pendiente únicamente de ejecución runtime VM, no de implementación interna.

| Capacidad | Ruta | Decisión | Contrato y tenant | Evidencia E2E |
|---|---|---|---|---|
| acciones_recomendadas | /acciones-recomendadas | productive | API real; auth/RBAC y tenant global | authorized-route |
| activos | /activos | productive | API real; auth/RBAC y tenant global | authorized-route |
| admin_saas | /admin-saas | productive | API real; RBAC plataforma | authorized-route |
| administrar_kpis | /administrar-kpis | productive | API real; auth/RBAC y tenant global | authorized-route |
| auditorias.ejecucion | /auditorias/ejecucion | productive | API real; auth/RBAC y tenant global | authorized-route |
| auditorias.ia | /auditorias/ia | productive | API real; auth/RBAC y tenant global | authorized-route |
| auditorias | /auditorias | productive | API real; auth/RBAC y tenant global | authorized-route |
| ciclo_vida | /ciclo-vida | productive | API real; auth/RBAC y tenant global | authorized-route |
| configuracion | /configuracion | productive | API real; auth/RBAC y tenant global | authorized-route |
| controles | /controles | productive | API real; auth/RBAC y tenant global | authorized-route |
| cotizador | /cotizador | productive | API real; RBAC plataforma/dealer | authorized-route |
| cumplimiento_auditoria | /cumplimiento-auditoria | productive | API real; auth/RBAC y tenant global | authorized-route |
| dealer | /dealer | productive | API real; RBAC dealer | authorized-route |
| diagnostico | /diagnostico | productive | API real; auth/RBAC y tenant global | authorized-route |
| documentos | /documentos | productive | API real; auth/RBAC y tenant global | authorized-route |
| ejecucion_iso | /ejecucion-iso | productive | API real; auth/RBAC y tenant global | authorized-route |
| empresas | /empresas | productive | alias frontend hacia /admin-saas | authorized-route |
| evidencias | /evidencias | productive | API real; auth/RBAC y tenant global | authorized-route |
| exportes | /exportes | productive | API real; auth/RBAC y tenant global | authorized-route |
| hallazgos | /hallazgos | productive | API real; auth/RBAC y tenant global | authorized-route |
| ia_auditor | /ia-auditor | productive | API real; auth/RBAC y tenant global | authorized-route |
| ia_compliance | /ia-compliance | productive | API real; auth/RBAC y tenant global | authorized-route |
| ia_compliance.sugerencias | /ia-compliance/sugerencias | productive | API real; auth/RBAC y tenant global | authorized-route |
| iso_health | /iso-health | productive | API real; auth/RBAC y tenant global | authorized-route |
| login | /login | productive | POST /api/auth/login público controlado | login-valid-invalid |
| matriz_riesgo | /matriz-riesgo | productive | API real; auth/RBAC y tenant global | authorized-route |
| no_conformidades | /no-conformidades | productive | API real; auth/RBAC y tenant global | authorized-route |
| perfil_empresa | /perfil-empresa | productive | API real; auth/RBAC y tenant global | authorized-route |
| perfil | /perfil | productive | API real; auth/RBAC y tenant global | authorized-route |
| plan_accion | /plan-accion | productive | API real; auth/RBAC y tenant global | authorized-route |
| planes_accion | /planes-accion | productive | API real; auth/RBAC y tenant global | authorized-route |
| prefacturacion | /prefacturacion | productive | API real; RBAC plataforma/dealer | authorized-route |
| riesgos | /riesgos | productive | API real; auth/RBAC y tenant global | authorized-route |
| soa | /soa | productive | API real; auth/RBAC y tenant global | authorized-route |
| usuarios | /usuarios | productive | API real; RBAC administración | authorized-route |

Los campos completos por capacidad —menu/ruta, componentes frontend, endpoints, permisos detectados, tenant scope, feature flag, estado comercial y evidencia— están versionados en `config/capabilities/catalog.json` y `artifacts/fase-0/capability-matrix.json`.

## Gate

`scripts/phase0/check-capability-disposition.js` falla ante estados parciales, capacidad visible no productiva sin flag o capacidad productiva sin escenario E2E.
