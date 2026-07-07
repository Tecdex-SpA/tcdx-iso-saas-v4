# Demo Script - Intelligence Layer

## Objetivo

Mostrar que TCDX interpreta datos reales del tenant con Knowledge Base, reglas, scoring y recomendaciones trazables. No se debe presentar como reemplazo de auditoria externa ni certificacion.

## Guion

1. Entrar al dashboard del tenant.
2. Mostrar lectura inteligente o endpoint de brief.
3. Explicar `audit_readiness.score`, estado y `metric_explanations`.
4. Abrir un finding y mostrar:
   - entidad tenant original
   - `knowledge_basis`
   - regla activada
   - evidencia o limitacion
5. Mostrar `next_best_actions`:
   - prioridad
   - owner_role
   - expected_impact
   - risk_if_ignored
   - `action_basis`
6. Ir a auditoria o cumplimiento.
7. Mostrar bloqueadores: hallazgos abiertos, NC antiguas, SOA sin evidencia o acciones vencidas.
8. Generar o visualizar reporte inteligente cuando el modulo consumidor este conectado.
9. Preguntar a IA Compliance algo contextual.
10. Mostrar que la respuesta usa datos tenant + KB filtrada y declara limitaciones.
11. Cerrar con disclaimer: TCDX ayuda a preparar y explicar, pero no reemplaza criterio auditor humano ni certificacion oficial.

## Mensaje recomendado

“La Intelligence Layer no inventa cumplimiento. Lee datos del tenant, los cruza con una Knowledge Base derivada, aplica reglas deterministicas y muestra fundamento, confianza y acciones.”
