# Fase 3 - Restricciones de recursos

## Esta pasada

Por instrucción explícita no se ejecutaron:

- builds;
- tests unitarios, integración o E2E;
- Playwright, Chromium o navegadores;
- scripts funcionales o QA;
- migraciones;
- consultas runtime;
- operaciones en VM;
- deploy.

La revisión se limitó a código, modelos, rutas, permisos, relaciones, migraciones,
navegación, copy y consistencia estática.

## Deploy

El usuario ejecutará el deploy manual. No ejecutar suites pesadas en `bk-v4`; la
validación funcional se realiza desde las vistas web con carga controlada.

## Evidencia

No presentar esta revisión estática como runtime validado. El estado correcto previo al
deploy es `READY_FOR_MANUAL_DEPLOY_AND_WEB_VALIDATION`.
