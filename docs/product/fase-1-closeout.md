# Fase 1 - Closeout

## Control de cierre

La implementación local se evalúa con `npm run phase1:check`. El cierre runtime se evalúa exclusivamente con `npm run phase1:closeout` después del deploy oficial. El estado vigente de cada ejecución queda en su artifact `/tmp/tcdx-phase1-evidence/<run_id>/phase1-closeout-result.json`; este documento no sustituye esa evidencia.

La remediación Fase 1R agrega configuración explícita por tenant, bootstrap auditable e idempotente, integración PostgreSQL real, administración tenant del módulo, feedback UI verificable, métricas específicas y Runtime QA reproducible. `grc_phase1_core` continúa deshabilitado por defecto y ningún bootstrap lo habilita globalmente.

## Evidencia exigida para cierre definitivo

1. Gate local sin excepciones.
2. Migraciones `20260722` y `20260723` aplicadas por el flujo autorizado.
3. Deploy del SHA exacto.
4. Suite crítica con exactamente `13 passed`, sin retry.
5. Suite completa con exactamente `30 passed`, sin skip, retry ni `did-not-run`.
6. Evidencia derivada del JSON Playwright exitoso.
7. Limpieza manifest-based exitosa y triggers inmutables habilitados.
8. Repositorios Mac y VM limpios sobre el SHA validado.

Separar validación local y runtime no elimina controles: ubica cada uno donde dispone de infraestructura real. Fase 1 solo puede declararse cerrada cuando un mismo SHA cumple ambos gates.
