# RBAC-01 DB Audit

Este paquete ejecuta una auditoria read-only de roles, permisos, planes, modulos, entitlements y asignaciones dealer/MSP en PostgreSQL.

No extrae passwords, hashes, tokens, secretos, MFA, contenido documental, contenido de evidencias ni PII innecesaria. Los CSV usan IDs tecnicos, roles, conteos, capacidades, estados y metadata funcional de autorizacion.

Ejecucion:

```bash
cd ~/repos/tcdx-iso-saas-v4
./run-rbac01-db-audit.sh
```

El wrapper solicita la contraseña PostgreSQL de forma interactiva y no la guarda. Si la conexion directa a `db-v4.tcdx.int:5432` no esta disponible, intenta un tunel SSH temporal hacia `tecdex@192.168.2.40`.

Archivos producidos en esta carpeta:

- `RBAC01_DB_AUDIT_RESULTS_<timestamp>.txt`
- `roles.csv`, si existe una fuente de roles
- `users_by_role.csv`, si existe `users`
- `tenant_plans.csv`, si existen suscripciones o contratos
- `tenant_modules.csv`, si existen vistas/tablas de modulos tenant
- `entitlements.csv`, si existen capabilities/entitlements
- `role_permissions.csv`, si existe `role_permissions`
- `dealer_assignments.csv`, si existen asignaciones dealer/MSP

Para continuar RBAC-01, entrega a Codex el archivo `RBAC01_DB_AUDIT_RESULTS_<timestamp>.txt` y los CSV generados. Sin esos resultados reales no se debe crear migracion de datos de roles.
