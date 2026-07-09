# Checklist Tenant Listo para Produccion

Un tenant solo puede liberarse cuando todos los items aplicables estan `Validado` o `No aplica` con justificacion.

| Item | Estado | Evidencia requerida |
|---|---|---|
| Login tenant admin validado | [ ] Pendiente | Screenshot posterior a login sin token visible |
| Login viewer validado | [ ] Pendiente | Screenshot de vista permitida |
| Login auditor validado si aplica | [ ] Pendiente | Screenshot de auditoria/evidencias |
| Roles validados | [ ] Pendiente | Resultado matriz roles |
| Normas asignadas | [ ] Pendiente | `tenant_standards`/UI |
| Menu visible correcto por rol | [ ] Pendiente | Screenshots por rol |
| Dashboard carga | [ ] Pendiente | Screenshot y red limpia |
| Evidencias carga | [ ] Pendiente | Screenshot o omision aprobada |
| Riesgos carga | [ ] Pendiente | Screenshot o omision aprobada |
| Planes carga | [ ] Pendiente | Screenshot o omision aprobada |
| Reportes Premium carga | [ ] Pendiente | `/exportes` visible segun rol |
| PDF/ZIP genera o esta validado | [ ] Pendiente | Nombre/tamano o estado aprobado |
| IA Compliance carga | [ ] Pendiente | Contenido util < 3s |
| Cross-tenant validado | [ ] Pendiente | Casos de `cross-tenant-validation.md` |
| No hay errores consola criticos | [ ] Pendiente | Playwright/devtools |
| No hay 4xx/5xx inesperados | [ ] Pendiente | Network log |
| No hay mixed content | [ ] Pendiente | Network log |
| No hay requests a IPs internas | [ ] Pendiente | Network log |
| Responsable cliente aprueba acceso | [ ] Pendiente | Email/ticket |
| Responsable TCDX aprueba liberacion | [ ] Pendiente | Registro interno |

## Criterio de bloqueo

Bloquea produccion cualquier caso donde:

- un usuario no pueda iniciar sesion,
- un rol vea acciones no autorizadas,
- exista fuga cross-tenant,
- reportes o IA Compliance rompan la pagina,
- aparezcan tokens, secretos, stack traces o errores tecnicos crudos,
- se usen URLs internas desde navegador publico.

## Criterio de cierre

Estado final permitido:

```text
TENANT LISTO PARA PRODUCCION
```

Solo se declara si no hay bloqueantes y todas las observaciones no bloqueantes tienen responsable y fecha.
