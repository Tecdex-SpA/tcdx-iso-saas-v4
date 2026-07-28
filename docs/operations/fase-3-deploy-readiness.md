# Fase 3 - Preparación de deploy

## Orden

1. Confirmar `main` limpio y SHA aprobado.
2. Ejecutar desde el Mac `./scripts/deploy-vms.sh`.
3. El deploy actualiza backend.
4. Ejecuta Fase 2 idempotente y luego `scripts/phase3/apply-phase3-migration.js`.
5. Reinicia backend.
6. Actualiza AI Engine y frontend mediante wrappers oficiales.
7. Ejecuta las validaciones post-deploy ya incluidas en el script.
8. Realizar el plan web Fase 3.

## Dependencias

- Fase 1 core aplicada.
- Fase 2 integrada aplicada.
- `pgcrypto`.
- Tenant `70000000-0000-0000-0000-000000000701`.

## Riesgos

- La extensión de checks de `grc_phase2_relations` requiere que los datos existentes
  respeten los tipos declarados por Fase 2.
- La migración agrega índices; debe observarse tiempo de aplicación en producción.
- No ejecutar loaders ni seeds junto con la migración.

## Forward-fix

La migración es aditiva. Ante error, PostgreSQL revierte la transacción completa. Los
ajustes deben realizarse mediante una nueva migración forward-fix; no borrar datos ni
resetear el esquema.
