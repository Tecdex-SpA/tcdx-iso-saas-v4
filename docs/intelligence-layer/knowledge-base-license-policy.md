# Knowledge Base v2 - License Policy

## Politica base

La Knowledge Base v2 contiene resumenes derivados, criterios operativos, preguntas de auditoria, evidencias esperadas, brechas tipicas, acciones recomendadas y reglas internas. No debe exponer texto protegido de normas ISO ni enviar la base completa a un LLM.

## Clases permitidas

- `derived_summary`: resumen derivado propio. Uso permitido para reglas, scoring y narrativa sin citar texto protegido.
- `open_reference`: fuente abierta. Puede usarse como referencia complementaria.
- `internal_methodology`: criterio interno TCDX. Uso permitido dentro del producto.
- `licensed_internal`: contenido con restriccion interna. No se publica en UI ni se envia completo a IA.

## Guardrails

- No enviar tokens, secretos, passwords ni archivos completos al LLM.
- No enviar la base completa de 1000 registros al LLM.
- No usar internet en runtime para criterio auditor directo.
- No presentar inferencias como datos confirmados.
- Toda conclusion relevante debe distinguir dato confirmado, inferencia de regla, inferencia IA, recomendacion y limitacion.
- Toda recomendacion debe incluir `action_basis`.
- Toda conclusion con fundamento debe incluir `knowledge_basis`.

## Uso en UI, reportes e IA Compliance

La UI y los reportes pueden mostrar:

- Clave `item_key`.
- Norma/familia/dominio.
- Resumen operativo derivado.
- Expectativa de evidencia derivada.
- Pregunta de auditoria sugerida.
- Accion recomendada.
- `knowledge_basis` y `action_basis`.

No deben mostrar:

- Texto completo protegido de normas ISO.
- Archivos fuente completos.
- Material marcado como `licensed_internal` fuera de contexto autorizado.
- Respuestas que oculten si una conclusion es inferida o limitada por datos faltantes.
