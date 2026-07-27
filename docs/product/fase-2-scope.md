# Fase 2 — Alcance implementado

## Resultado funcional

La Fase 2 incorpora un módulo tenant-scoped, deshabilitado por defecto, para
privacidad, incidentes, riesgo de terceros e integraciones. Reutiliza usuarios,
procesos, operaciones, activos, controles, evidencias, riesgos, hallazgos,
acciones, auditorías y requisitos existentes.

El alcance implementado comprende:

- registro versionado de actividades de tratamiento, DPIA, solicitudes,
  consentimientos y brechas;
- gestión de incidentes desde reporte hasta postmortem, cierre y eficacia;
- ciclo TPRM, cuestionarios versionados, evaluación humana, portal limitado y
  salida verificable;
- framework de conectores con Microsoft, Google Workspace, Jira/Confluence y
  GitHub;
- relaciones transversales tipadas, eventos, reglas deterministas, alertas,
  KPI/KRI, procedencia y auditoría;
- vistas 360, portafolios, salud de integraciones, vista ejecutiva y exportes
  CSV auditados.

## Límites

Los adapters live requieren autorización OAuth y scopes del cliente. Sin esas
autorizaciones, el modo productivo disponible para QA es el sandbox
determinista, que usa exactamente el mismo pipeline de normalización,
deduplicación, procedencia, reglas y persistencia.

No se incorporan SIEM, EDR, CMDB, posture cloud profundo, ServiceNow, SAP,
Salesforce, procurement integral, continuidad integral, SSO/SCIM, API pública,
marketplace, white label ni capacidades de Fases 3 o 4.

## Condiciones operativas

El backend es autoritativo para tenant, RBAC, workflows, precondiciones de
cierre, scoring, eventos y exportes. El frontend solo presenta acciones que el
backend vuelve a autorizar. El portal no comparte sesión con la aplicación
interna y devuelve DTO explícitos.
