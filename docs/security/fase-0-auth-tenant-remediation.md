# Fase 0 — Auth y tenant remediation

## Corrección aplicada

Se corrigió el detector Fase 0 para reconocer controles globales reales en Express:

- Autenticación: `app.use('/api', auth, enforceApiAccess)`.
- Autorización/RBAC: `enforceApiAccess` en `backend/src/middleware/rbac.middleware.js`.
- Tenant request guard: `app.use('/api', enforceTenantRequestScope)`.
- Tenant scope local en Health: `resolveTenantScope`, `requireTenantForNonSuper`, `addTenantCondition`.

## Resultado

- Endpoints sin auth signal: 176 -> 0.
- Endpoints sin tenant/data scope contractual: 111 -> 0 hallazgos, con 1 excepción exacta not_applicable para `GET /api/auth/validate`.
- Hallazgos contractuales totales: 328 -> 0.

## Pendiente

La corrección estática queda cerrada. La prueba dinámica está implementada en `scripts/phase0/check-tenant-isolation.js` y `frontend/tests/e2e/phase0-critical.spec.ts`; su ejecución requiere fixtures QA reales y se realiza con `npm run phase0:vm-check`.
