# Fase 2 — Plan de pruebas

## Capas

1. Syntax y contratos puros.
2. Migración PostgreSQL 16 aplicada dos veces.
3. Integración PostgreSQL con workflows reales.
4. RBAC, tenant, reglas, scoring, normalización, firma e idempotencia.
5. ESLint, TypeScript y build Next.
6. Playwright targeted: 16 pruebas.
7. Prerrequisito de idempotencia Fase 1: 13 pruebas dirigidas.
8. Playwright full: 46 pruebas, incluidas las 30 de regresión Fase 1.
9. Runtime público y cleanup idempotente.

## Cobertura dirigida

- Privacidad: actividad sensible, alertas, DPIA/riesgo/aprobación, solicitud,
  evidencia, brecha y cierre.
- Incidentes: severidad, clasificación, impacto, contención, recuperación,
  causa, postmortem, bloqueo, eficacia y cierre.
- TPRM: dos proveedores, servicio, contrato, cuestionario, invitación vencida,
  portal, archivo, deduplicación, aprobación humana y salida.
- Integraciones: catálogo, cuatro sandbox adapters, registros, alertas,
  procedencia, replay y redacción de secretos.
- Global: páginas, vista ejecutiva, exporte, RBAC y tenant.

## Criterios

No se acepta retry, skip, fixme, did-not-run ni fixture fuera de manifest. El
parser de resultados debe confirmar exactamente 16/16 targeted y 46/46 full.
El prerrequisito Fase 1 se valida 13/13 con el mismo manifest antes de full y
no altera esos conteos oficiales.
El cleanup PostgreSQL se prueba y luego se ejecuta dos veces en runtime.
