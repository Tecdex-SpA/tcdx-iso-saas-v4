# Estado operacional de conectores

Fecha de auditoría: 2026-07-28

## Conclusión

Ningún conector externo de Fase 2 está certificado como productivo para tenants.
Todos quedan clasificados como `prototipo` y se muestran como **No disponible**. La
creación, consulta de instancias y sincronización se rechazan en backend para roles
tenant. Los adaptadores sandbox permanecen accesibles únicamente a roles de
plataforma para QA interno.

Esta corrección no implementa conectores de Fase 6.

## Matriz auditada

| Conector | Estado | Autenticación real | Credenciales seguras | API externa | Persistencia | Sync completo | Incremental | Health/retries | Mapping/métricas/GRC | Auditoría/tenant |
|---|---|---|---|---|---|---|---|---|---|---|
| Microsoft Graph / Microsoft 365 | prototipo | OAuth y bearer implementados, no certificados | Envelope cifrado | `/users` | Sí | No; solo usuarios | Parcial por `nextLink` | Parcial | Parcial; usuarios y alertas controladas | Sí en flujo interno |
| Google Workspace / Drive | prototipo | OAuth y bearer implementados, no certificados | Envelope cifrado | Directory `/users` | Sí | No; Drive y grupos declarados no tienen cobertura live completa | No | Parcial | Parcial; usuarios | Sí en flujo interno |
| Jira / Confluence | prototipo | OAuth/API token implementados, no certificados | Envelope cifrado | Jira search | Sí | No; Confluence live no está implementado | Parcial por token declarado | Parcial | Parcial; issues/remediales | Sí en flujo interno |
| GitHub | prototipo | OAuth/bearer implementado, no certificado | Envelope cifrado | `/user/repos` | Sí | No; ramas, reviews, workflows y alerts declarados no tienen cobertura live completa | No | Parcial | Parcial; repositorios | Sí en flujo interno |

## Evidencia técnica

- Los adaptadores live realizan llamadas reales, pero cubren solo una fracción de las
  capacidades publicadas en catálogo.
- El modo sandbox usa fixtures deterministas y no demuestra interoperabilidad real.
- Existen persistencia tenant-scoped, ejecuciones, dead-letter, health, retries,
  normalización, alertas y auditoría.
- No existe evidencia de certificación extremo a extremo, credenciales productivas,
  cobertura completa, pruebas contractuales contra proveedores ni operación soportada.

## Gobierno aplicado

- UI tenant: no muestra botones “Conectar” ni “Sincronizar”.
- API tenant: `CONNECTOR_NOT_AVAILABLE` con HTTP 403.
- UI: cada proveedor indica “No disponible” y remite su implementación a Fase 6.
- Roles de plataforma: conservan sandbox interno para QA; esto no cambia la
  clasificación operacional.
