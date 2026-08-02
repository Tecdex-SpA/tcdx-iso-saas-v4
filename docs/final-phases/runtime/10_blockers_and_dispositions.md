# Bloqueantes y disposiciones de 5-C1

## Bloqueantes internos cerrados

| Hallazgo | Causa | Corrección | Evidencia |
| --- | --- | --- | --- |
| Contraste insuficiente | Tokens visuales no cumplían AA sobre blanco/gris | Tokens de acción y texto ajustados | Axe PASS |
| Región scroll no accesible | Contenedor sin foco | `tabIndex=0` y `aria-label` | Axe PASS |
| Límite QA de Report Studio | Limiter AI local insuficiente para la suite serial | Variable solo del runner QA | Browser 10/10 PASS |
| Cleanup incompleto del runner | `npm` dejaba hijo Next | `exec` directo para PID controlable | trap valida proceso directo |
| Checker BI falso negativo | Consumo de analytics indirecto por workspace | Regla reconoce el consumidor efectivo | package6 PASS |

## Disposiciones fuera de C1

| Área | Estado | Asignación |
| --- | --- | --- |
| Modelo canónico y observaciones semánticas | No implementado por alcance | 5-C2 |
| Validación de VMs, deploy, backup/restore y secretos administrados | NO_VERIFICADO_RUNTIME | 5-C11 |
| Conectores con credenciales de tenant | NO_VERIFICADO_RUNTIME | Fase 6 |
| MSP | No implementado por alcance | Fase 7 |
| Auditoría completa de accesibilidad en producción | NO_VERIFICADO_RUNTIME | 5-C11 |
| Carga y stress | NO_VERIFICADO_RUNTIME | 5-C11 |

Las disposiciones no son bypasses: no bloquean la reproducibilidad local de 5-C1 ni se afirman como validadas.
