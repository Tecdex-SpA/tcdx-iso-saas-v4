# Runbook de migración 5-C3

Preflight: desplegar exactamente el SHA autorizado; respaldar PostgreSQL; verificar estado healthy; ejecutar `npm run phase5-c3:migration:checksum` y luego `MIGRATION_DATABASE_URL=… npm run phase5-c3:migration:preflight`. No registrar secretos en logs.

Aplicación: el deploy oficial ejecuta las migraciones registradas en orden Fase 3, 4, 5, 5-C2 y 5-C3. El runner toma advisory lock, valida dependencias, registra ledger running/applied/failed, aplica DDL aditivo en transacción, bootstrappea catálogo y verifica postcondiciones. `--apply` es idempotente; un checksum aplicado distinto se rechaza; un ledger failed se puede reintentar.

Validación: comprobar 22 definiciones/bindings, política de ocho dimensiones, capabilities, triggers y endpoints tenant-scoped. Rollback de aplicación: volver al SHA previo sin borrar tablas; snapshots publicados son historial. Una reversión de datos requiere migración aditiva autorizada, nunca SQL manual productivo.

## Orden exacto post-merge

1. Confirmar que el SHA aprobado es ancestro del artefacto y ejecutar checksum/preflight con una cuenta de migración.
2. Tomar backup y registrar ventana/correlation ID de cambio.
3. Ejecutar el runner oficial; no ejecutar el SQL manualmente.
4. Verificar ledger `applied`, checksum esperado, 22 definiciones/bindings, 53 fórmulas registradas, 18 contratos semánticos, policies, índices y triggers.
5. Desplegar backend y frontend del mismo SHA.
6. Ejecutar smoke autenticado Tenant A/B, cálculo controlado, draft/publicación, historia, comparación y export.
7. Ejecutar auditoría browser sin interceptar APIs y comprobar igualdad multicanal, 0 5xx, 0 hydration, 0 RBAC inesperado y máximo un bootstrap por carga.

## Rollback

Ante fallo antes de commit, la transacción y el ledger `failed` permiten corregir y reintentar. Ante fallo de aplicación, volver binarios al SHA anterior: el DDL aditivo permanece compatible. No borrar ni editar snapshots publicados. Cualquier corrección de datos o schema debe ser otra migración forward con checksum, preflight y auditoría.
