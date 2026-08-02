# Baseline runtime de Fase 5-C1

Fecha de ejecución: 2026-08-02. Entorno: local, PostgreSQL 16 descartable en Docker, backend Node.js y frontend Next.js locales. No se utilizaron URL, credenciales ni datos de producción.

## Línea base comprobada

| Superficie | Evidencia | Estado |
| --- | --- | --- |
| Backend | `npm --prefix backend test` | PASS |
| Frontend | lint, typecheck y build de producción | PASS |
| Fase 3 | `npm run phase3:check` | PASS |
| Fase 4 | `npm run phase4:check` | PASS |
| Fase 5 | `npm run phase5:check` | PASS |
| Fase 5.5 | registro, fórmulas, estadística, fuentes, paquetes 3 a 6 y artefactos | PASS |
| PostgreSQL | `npm run phase5-5:postgres-integration` | PASS |
| Navegador | Chromium local sobre backend y frontend reales | PASS: 10/10, sin reintentos |

El entorno usa fixtures sintéticos de Tenant A y Tenant B y se destruye al terminar. El runner controla PostgreSQL, backend y frontend mediante un `trap`; no deja datos persistentes, contenedores ni puertos del entorno QA.

## Correcciones realizadas en C1

1. Se eliminó un warning real de `latestSnapshot` no utilizado en `GrcDecisionCenter`.
2. Se corrigieron contrastes de acciones primarias, secundarias y texto secundario para cumplir WCAG AA sobre sus superficies declaradas.
3. Se hizo enfocable y etiquetada la región desplazable de historial y bitácora en `OperationalBuilder`.
4. Se añadió una prueba Axe WCAG 2 A/AA sobre login, Portal GRC, métricas, BI y Report Studio; su resultado fue cero violaciones críticas o serias.
5. Se corrigieron dos falsos negativos de verificadores 5.5: dependencia indirecta válida de BI y evidencia asociada a la rama de auditoría, sin relajar la comprobación funcional.
6. El runner local pasa un límite AI específico de QA y arranca los procesos directamente para que el cleanup termine los PID correctos. No altera límites de producción.

## Límites de la baseline

La baseline no valida VMs, producción, secretos administrados, backup/restore remoto, conectores con terceros ni MSP. Esas superficies quedan `NO_VERIFICADO_RUNTIME` y están asignadas a 5-C11, Fase 6 o Fase 7 según el backlog rector. 5-C1 no implementa el modelo semántico de 5-C2.
