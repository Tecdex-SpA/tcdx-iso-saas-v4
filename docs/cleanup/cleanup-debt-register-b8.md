# Registro de deuda remanente B.8

Fecha: 2026-06-12

| ID | Frente | Hallazgo | Severidad | Estado | Bloquea MVP | Proxima accion | Fase sugerida |
| -- | ------ | -------- | --------- | ------ | ----------: | -------------- | ------------- |
| B8-01 | IA frontend | `/ia` conserva recomendaciones legacy por control y contrato desalineado con su UI; IA.2 confirma que `PUT /api/ai/apply/:tenant_control_id` tiene efectos reales sin trazabilidad IA suficiente. | Alta | `blocked_pending_ia3_safe_replacement` | No | IA.3 debe reemplazar aplicacion directa por borrador revisable, decidir contrato de lectura y solo despues archivar `/ia`. | Fase IA |
| B8-02 | Documentos | `/documentos` mantiene generacion, archivo, deep links y contratos backend. | Alta | `blocked_by_backend_contract_review` | No | Inventariar endpoints, integraciones, persistencia y enlaces runtime. | Documentos/integraciones |
| B8-03 | Dashboard legacy | `/dashboard-v2` sigue requerido por siete validadores y docs QA/demo. | Media | `kept_temporarily_qa_demo_dependency` | No | Migrar checks a `/dashboard` y retirar compatibilidad solo con evidencia. | Dashboard QA |
| B8-04 | Ejecucion ISO | `/ejecucion-iso` genera y somete sugerencias a aprobacion humana. | Media | `kept_enterprise_post_mvp` | No | Definir acceso, empaquetado y ownership enterprise. | Producto enterprise |
| B8-05 | Backend reports | `backend/src/routes/report.routes.js` no esta montada y convive con `reports.routes.js`. | Alta | `requires_review` | No | Comparar contratos, referencias y cobertura de reportes antes de cuarentena. | Backend routes |
| B8-06 | Scripts legacy | Validadores y `patch_*.py` conservan referencias o vigencia no confirmada. | Media | `requires_review` | No | Clasificar por ejecucion real, CI, runbook y owner. | Fase scripts |
| B8-07 | DB QA fixes | `database/qa-fixes` contiene operaciones `DROP` y hotfixes historicos. | Alta | `revisar_dba` | No | Separar runbooks, precondiciones, backups y prohibicion de migracion normal. | Fase DBA |
| B8-08 | Seeds/migraciones | Existen `DROP`/`DELETE FROM` que requieren distinguir DDL esperado de riesgo operativo. | Alta | `revisar_dba` | No | Revisar idempotencia, entorno permitido, rollback y datos afectados. | Fase DBA |
| B8-09 | OAuth Google/Zoho | Callbacks y tokens requieren revision de state, tenant binding y lifecycle. | Crítica | `internal_security_review` | No | Auditoria dedicada con pruebas de reconnect, revocacion y cross-tenant. | Seguridad/integraciones |
| B8-10 | Sync Agent | Pairing, bearer token, uploads y source binding no fueron auditados en cleanup. | Crítica | `internal_security_review` | No | Revisar autenticacion, scope tenant, replay, upload y revocacion. | Seguridad/integraciones |
| B8-11 | IA traces/external lookup | Pueden exponer contexto, prompts, metadata tenant o datos a proveedores externos. | Alta | `internal_security_review` | No | Revisar RBAC, minimizacion, redaccion, logs, cuotas y retencion. | Seguridad IA |
| B8-12 | Calidad frontend | Lint mantiene 636 warnings preexistentes. | Baja | `accepted_temporarily` | No | Reducir por regla y modulo con commits sin cambio funcional. | Calidad frontend |
| B8-13 | Entorno local | `env-check.sh` reporta 46 WARN por variables no cargadas y 0 FAIL. | Baja | `accepted_local_warning` | No | Definir perfil CI y documentar variables requeridas sin leer secretos. | Entorno/CI |
| B8-14 | Archivo legacy | `frontend/legacy-pages-archive` permanece versionado e incluido por TS/ESLint. | Baja | `historical_retention` | No | Definir plazo de retencion y criterio de borrado definitivo. | Gobierno de repositorio |

## Regla de priorizacion

Las severidades Crítica y Alta requieren una fase con owner, alcance, pruebas y
rollback propios. Este registro no autoriza ejecucion de SQL, cambios OAuth,
movimientos de rutas ni eliminacion de archivos.
