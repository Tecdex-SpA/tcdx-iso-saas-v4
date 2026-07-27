# Fase 2 — Runtime QA

## Estado

La evidencia local verificada incluye:

- migración repetible en PostgreSQL 16: 43 tablas, 22 permisos y 4 adapters;
- integración PostgreSQL: 23 eventos y 10 ejecuciones de regla;
- aislamiento tenant sin hallazgos;
- idempotencia de conector y webhook firmado;
- DTO de portal sin campos internos;
- cleanup PostgreSQL `CLEANED` y segunda pasada `ALREADY_CLEAN`;
- backend tests, frontend lint, TypeScript y build exitosos;
- discovery exacto: 16 targeted y 46 full.

La sección de runtime desplegado se completa con SHA, timestamps, resultados
Playwright y reportes de cleanup después del deploy oficial. No se atribuye
estado live a Microsoft, Google, Atlassian o GitHub sin OAuth del cliente.
