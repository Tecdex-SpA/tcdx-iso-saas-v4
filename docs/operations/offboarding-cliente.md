# Offboarding, Suspension y Baja de Cliente SaaS

## 1. Causales de suspension

- Mora o suspension comercial aprobada.
- Solicitud formal del cliente.
- Riesgo de seguridad temporal.
- Incumplimiento contractual que exige bloqueo reversible.
- Incidente operativo bajo investigacion.

## 2. Causales de baja

- Termino de contrato.
- Solicitud formal de cierre.
- Migracion a otro servicio.
- Decision legal/comercial aprobada.

## 3. Suspension vs eliminacion

Suspension significa desactivar acceso sin borrar informacion. Baja significa cierre operacional con exportacion, conservacion auditada y revocacion de accesos. El borrado fisico no es el proceso por defecto y requiere aprobacion legal, tecnica y de seguridad.

## 4. Que se desactiva

- Login de usuarios tenant.
- Generacion de nuevos reportes si corresponde.
- Integraciones y cargas nuevas.
- Jobs o automatizaciones no criticas.
- Accesos de usuarios externos.

## 5. Que se conserva

- Tenant y trazabilidad.
- Usuarios historicos como registros auditables.
- Evidencias, reportes, auditorias, riesgos, hallazgos y planes.
- Logs de acciones relevantes.
- Configuracion necesaria para auditoria posterior.

## 6. Que se exporta

Segun contrato y aprobacion:

- Reportes finales PDF/ZIP.
- Listado de usuarios y roles.
- Evidencias y metadata permitida.
- Riesgos, hallazgos, auditorias y planes.
- Registro de configuracion de normas.

No exportar tokens, secretos, prompts internos, stack traces ni rutas internas.

## 7. Quien autoriza

- Responsable comercial TCDX.
- Responsable operacional TCDX.
- Responsable seguridad si hay revocacion por incidente.
- Responsable cliente autorizado.

## 8. Evidencia de solicitud

Registrar:

- fecha/hora,
- solicitante,
- causal,
- alcance,
- aprobadores,
- fecha efectiva,
- evidencia de comunicacion.

## 9. Registro de auditoria

Toda suspension/baja debe quedar asociada a tenant_id, usuarios afectados, ejecutor y resultado de validacion posterior. Si el sistema no registra automaticamente un evento especifico, adjuntar evidencia operacional en repositorio de evidencias interno, fuera de Git.

## 10. Checklist de revocacion de usuarios

| Item | Estado | Evidencia |
|---|---|---|
| Admin tenant desactivado o bloqueado | [ ] Pendiente |  |
| Usuarios viewer desactivados | [ ] Pendiente |  |
| Auditores desactivados | [ ] Pendiente |  |
| Responsables de proceso/control desactivados | [ ] Pendiente |  |
| Platform admin no usado para operacion diaria | [ ] Pendiente |  |
| Intento de login posterior falla | [ ] Pendiente |  |

## 11. Checklist de revocacion de integraciones

| Item | Estado | Evidencia |
|---|---|---|
| Document sources pausadas o desconectadas | [ ] Pendiente |  |
| Credenciales externas revocadas si aplica | [ ] Pendiente |  |
| Jobs programados pausados | [ ] Pendiente |  |
| Webhooks o agentes sincronizadores desactivados | [ ] Pendiente |  |

## 12. Checklist de respaldo/exportacion

| Item | Estado | Evidencia |
|---|---|---|
| Alcance de exportacion aprobado | [ ] Pendiente |  |
| Exportes generados por HTTPS publico autorizado | [ ] Pendiente |  |
| Tamano/nombre de archivos registrado | [ ] Pendiente |  |
| Entrega al cliente confirmada | [ ] Pendiente |  |
| Retencion interna definida | [ ] Pendiente |  |

## 13. Validacion de no acceso posterior

- Login con usuario tenant debe fallar o mostrar estado suspendido.
- Token previo no debe permitir navegacion normal.
- Viewer no debe acceder a reportes.
- IA Compliance y descargas deben quedar bloqueadas para usuarios suspendidos.
- Platform admin solo debe poder auditar segun autorizacion interna.

## 14. Criterios de cierre

- Solicitud y aprobaciones completas.
- Accesos revocados.
- Integraciones revocadas o pausadas.
- Exportacion/retencion resuelta.
- Validacion de no acceso posterior ejecutada.
- Cierre comunicado a responsable cliente y TCDX.
