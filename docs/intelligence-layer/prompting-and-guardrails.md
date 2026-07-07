# Prompting and Guardrails

## Principio

La IA no decide el estado primario de auditoria, riesgo, evidencia o accion. La decision primaria viene de datos tenant, reglas deterministicas, scoring y Knowledge Base filtrada.

## Prohibiciones

- No enviar la base completa de 1.000 registros al LLM.
- No enviar secretos, tokens, passwords ni archivos completos.
- No enviar texto protegido extenso de normas ISO.
- No usar internet runtime como criterio auditor directo.
- No presentar inferencias como datos confirmados.

## Contexto permitido

Solo contexto curado:

- extractos de datos tenant necesarios
- `knowledge_basis` compacto
- `action_basis`
- metric explanations
- findings deterministicas
- limitaciones y confidence

## Salida IA esperada

Toda narrativa debe separar:

- dato confirmado
- inferencia de regla
- inferencia IA
- recomendacion
- limitacion

Si la IA falla, devuelve JSON invalido, timeout o respuesta sin `knowledge_basis`, el sistema debe usar fallback deterministico y degradar confidence.
