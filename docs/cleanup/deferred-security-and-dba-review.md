# Deferred security and DBA review - cleanup stage 2

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-2-controlled-cleanup`

| Superficie | Motivo de diferimiento | Riesgo | Etapa sugerida |
| ---------- | ---------------------- | ------ | -------------- |
| Google OAuth (`backend/src/routes/document-integrations-google.routes.js`) | Montada antes de middleware global por callbacks/OAuth; tocarla requiere pruebas de reconnect, state y tenant. | Alto: auth/token/state y acceso a documentos. | Etapa 3 seguridad integraciones. |
| Zoho OAuth (`backend/src/routes/document-integrations-zoho.routes.js`) | Montada antes de middleware global por callbacks/OAuth; requiere pruebas provider-specific. | Alto: OAuth, revocacion y tenant source lifecycle. | Etapa 3 seguridad integraciones. |
| Sync Agent (`backend/src/routes/sync-agent.routes.js`) | Usa pairing code, bearer token propio y uploads; no debe tocarse sin pruebas runtime del agente. | Alto: subida local, token de agente y tenant/source binding. | Etapa 3 seguridad integraciones/agente. |
| IA traces (`backend/src/routes/ai-traces.routes.js`) | Puede contener contexto IA sensible; requiere auditoria de payloads y RBAC sin imprimir contenido. | Alto: exposicion de contexto, prompt, metadata o datos tenant. | Etapa 3 seguridad IA. |
| External lookup (`backend/src/routes/ai-external-lookup.routes.js`) | Busqueda externa y cuotas; requiere revision de data minimization y logging. | Alto: fuga de contexto y consumo externo. | Etapa 3 seguridad IA. |
| `database/qa-fixes/*.sql` | Son hotfixes/QA fixes con `DROP VIEW/TABLE`; no deben moverse sin criterio DBA. | Alto si se ejecutan por error. | Etapa DBA/operaciones. |
| Seeds con `DELETE FROM` | Pueden ser idempotentes, pero modifican datos de conocimiento IA; requieren confirmacion DBA/producto. | Medio/alto segun entorno. | Etapa DBA/AI knowledge. |

## Acciones no ejecutadas

- No se modifico OAuth Google.
- No se modifico OAuth Zoho.
- No se modifico Sync Agent.
- No se modifico IA traces ni external lookup.
- No se ejecuto ni edito SQL.
- No se conecto a base de datos.
