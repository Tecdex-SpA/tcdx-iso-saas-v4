# Fase 2 — Eventos y reglas

## Contrato

Los eventos se escriben transaccionalmente con el cambio de estado. Cada uno
incluye tenant, agregado, versión, payload, procedencia, correlación, causación,
actor e idempotency key. `phase2Rules.js` contiene el catálogo cerrado y las
funciones puras de transición, severidad, scoring y evaluación.

## Eventos cubiertos

El catálogo implementa los 38 eventos requeridos: ciclos de tratamiento, DPIA,
solicitudes y brechas; incidentes; proveedores, evaluaciones y salida;
sincronización y normalización; evidencia y assurance; riesgos, hallazgos, no
conformidades, acciones, eficacia y obligaciones.

## Reglas deterministas

| Entrada | Efecto |
|---|---|
| Evidencia vencida o rechazada | alerta y assurance degradado/ineficaz |
| Incidente alto o crítico | alerta y evento de reevaluación |
| Incidente repetido | KRI de recurrencia y alerta |
| Proveedor crítico sin evaluación | brecha crítica |
| Incidente de proveedor | reevaluación |
| Inicio de salida | evidencia de revocación obligatoria |
| Tratamiento sensible sin DPIA | brecha crítica y evento DPIA |
| Tratamiento sin retención | alerta alta |
| Encargado sin TPRM vigente | riesgo de privacidad |
| Brecha | alerta con plazo y reevaluación |
| Remedial vencido | bloqueo operativo |
| Obligación próxima/vencida | escalamiento |
| Registro externo | métrica, alerta o efecto GRC según mapping |
| Requisito/control/evidencia incompletos | brecha de diseño u operación |

Cada ejecución registra código, versión, inputs, outputs, resultado y
explicación. La severidad de incidentes usa pesos versionados y conserva
calculada, confirmada, override, motivo, aprobador y fecha. El score de
proveedor informa la revisión, pero nunca aprueba automáticamente.
