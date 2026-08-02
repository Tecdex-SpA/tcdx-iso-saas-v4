# Prompt 5-C9/C10 — Seguridad comercial y UX premium

## Rol

Actúa como principal security engineer SaaS, product designer enterprise, especialista WCAG y autorización multi-tenant.

## Contexto y objetivo

Cierra seguridad comercial y experiencia premium de Fase 5. Las capacidades operacionales deben respetar RBAC, capabilities, entitlements y límites; la UI debe ocultar detalle técnico a negocio sin ocultar estado, causa, impacto o acción.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c9-c10-security-premium-ux
```

Exige `main` actual, origin oficial y worktree limpio; registra el SHA resultante.

## Restricciones

- No autorización basada solo en UI.
- No elevar roles para resolver pruebas.
- No fallbacks permisivos ni límites solo visuales.
- No rediseño comercial decorativo ni texto promocional.
- No producción, merge ni deploy.

## Alcance

Reconciliar catálogo de capabilities, matriz RBAC, middleware, endpoints y consumers. Aplicar límites atómicos. Refinar navegación, jerarquía, formularios, tablas, visualizaciones, estados, responsive, teclado, foco, contraste y lenguaje funcional en todas las vistas Fase 5.

## Modelo de datos

Reutilizar catálogo comercial y authorization matrix. Agregar solo persistencia faltante para grants versionados, consumo/reservas de límites o auditoría de decisiones; tenant-scoped, con unicidad y concurrencia segura.

## Migración

Solo migración aditiva si una brecha confirmada requiere persistencia. Probar upgrade, concurrencia, idempotencia, rollback y no alteración de permisos existentes.

## Backend

- autorización explícita por endpoint y acción;
- capability y entitlement efectivos;
- reserva/consumo/liberación atómica de límites;
- errores sanitizados;
- auditoría y correlation ID;
- endpoints de estado comercial sin datos internos indebidos.

## Frontend

Aplicar la experiencia de `05_especificacion_experiencia_grc_premium.md`. Negocio ve concepto, resultado, tendencia, coverage, trust, interpretación y acción. Administración técnica autorizada accede a metodología secundaria. Completar todos los estados y viewports.

## Seguridad, permisos, capabilities y límites

Usar `06_matriz_rbac_capabilities_limites.md` como contrato. Probar positivos, negativos, IDOR, archivos, exportación, platform tenant selection, feature disabled, límite agotado y concurrencia.

## Jobs

Verificar que workers reapliquen tenant, permisos del actor/sistema, capability y límites; no confiar en contexto de enqueue. Auditar cada ejecución.

## Pruebas y CI

Security tests, PostgreSQL, race conditions, tenant A/B, API, componentes, Playwright, axe u otra medición real WCAG, viewports y performance. No considerar un grep como prueba funcional. Integrar checks bloqueantes y `git diff --check`.

## Documentación

Actualizar RBAC, capabilities, límites, seguridad, UX, accesibilidad, consumer map, runbook y evidencia adversarial.

## Criterios de cierre

- matriz y runtime coinciden;
- límites no se exceden bajo concurrencia;
- cero IDOR/cross-tenant;
- WCAG AA medido en flujos críticos;
- no hay detalle técnico como experiencia principal;
- no se pierde capacidad funcional.

## Salida obligatoria

Entregar SHA, permisos, capabilities, límites, endpoints, vistas, pruebas de seguridad/accesibilidad, hallazgos, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR; no merge, no deploy ni cambios en producción.
