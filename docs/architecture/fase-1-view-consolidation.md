# Fase 1 - Consolidación de vistas

## Decisión

No se crean rutas superiores nuevas. Las capacidades se integran en las superficies operacionales existentes mediante `frontend/src/components/grc/GrcPhase1Panel.tsx`.

| Capacidad | Vista evaluada | Decisión | Motivo |
|---|---|---|---|
| Administración de workflows | `/configuracion` | `extend_existing_view` | Es configuración tenant y requiere permisos administrativos. |
| Evidencia continua | `/evidencias` | `extend_existing_view` | Conserva el contexto de biblioteca, aprobación y archivos. |
| Readiness | `/dashboard` | `extend_existing_view` | El resumen y drill-down pertenecen al control ejecutivo actual. |
| Cruces normativos | `/controles` | `extend_existing_view` | La cobertura se interpreta desde controles existentes. |
| Auditoría avanzada | `/auditorias` | `extend_existing_view` | Planificación, ejecución y revisión permanecen en el mismo dominio. |

## Vistas rechazadas

Se rechazaron un dashboard de readiness separado y una ruta paralela para diseñador de workflow. Ambos aumentarían navegación y duplicarían contexto sin una necesidad funcional independiente.

## Impacto

- Menú principal: sin cambios.
- Rutas: sin cambios.
- Permisos existentes: sin reducción.
- Nuevas capacidades: invisibles mientras `grc_phase1_core` esté deshabilitado.
- Matriz legible por máquina: `artifacts/fase-1/view-consolidation-matrix.json`.
