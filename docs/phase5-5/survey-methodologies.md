# Survey Methodologies

Estado: Paquete 4 completed.

## Formulas

- Survey Score: `sum(w_i * s_i) / sum(w_i * s_max_i) * 100`.
- Response Rate: `completedResponses / validInvitations * 100`.
- Dropout Rate: `(started - completed) / started * 100`.
- Cronbach Alpha: `k/(k-1)*(1-sum(var_i)/var_total)`.

## Reglas

- `not_applicable` y preguntas no visibles quedan excluidas del denominador.
- Respuestas invalidas se rechazan.
- Sin respuesta no equivale a cero; reduce cobertura.
- Cronbach solo aplica a dimensiones compatibles con al menos dos items y muestra suficiente.
- Propuestas GRC requieren aprobacion; no ejecutan consecuencias irreversibles.
