# Runbook de migración 5-C2

Migración: `20260803_phase5_c2_semantic_layer`. Runner: `scripts/phase5-c2/apply-phase5-c2-migration.js`.

1. Configurar `MIGRATION_DATABASE_URL` en el archivo protegido del host backend.
2. Ejecutar `node scripts/phase5-c2/apply-phase5-c2-migration.js --preflight`.
3. Ejecutar `node scripts/phase5-c2/apply-phase5-c2-migration.js --apply`.
4. Verificar seis tablas, triggers, capability, bootstrap y ledger.
5. Repetir apply: debe informar idempotencia con el mismo checksum.

El deploy oficial ejecuta 5-C2 después de Fase 5 y antes de reiniciar servicios. Usa advisory lock, transacción, ledger/checksum y postcondiciones. Un checksum diferente sobre estado applied se rechaza; estado failed puede reintentarse. No se ejecutó deploy ni migración remota en esta rama.
