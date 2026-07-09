# Checklist Operativo de Onboarding SaaS

Usar un estado por linea:

```text
[ ] Pendiente
[ ] Ejecutado
[ ] Validado
[ ] Bloqueado
[ ] No aplica
```

## Datos comerciales y legales

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Datos comerciales minimos recibidos | [ ] Pendiente | Comercial | Plantilla cliente completa |
| Datos legales minimos recibidos | [ ] Pendiente | Comercial | Razon social/tax ID validado o placeholder aprobado |
| Contacto principal confirmado | [ ] Pendiente | Comercial | Email corporativo |
| Contacto facturacion confirmado | [ ] Pendiente | Comercial | Email corporativo |
| Clasificacion de datos definida | [ ] Pendiente | Seguridad | Publico/interno/confidencial |

## Configuracion tenant

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Tenant creado | [ ] Pendiente | Operaciones | tenant_id registrado |
| Dominio/nombre comercial configurado | [ ] Pendiente | Operaciones | Nombre visible validado |
| Logo/branding cargado si aplica | [ ] Pendiente | Operaciones | Screenshot sin tokens |
| Normas ISO asignadas | [ ] Pendiente | Cumplimiento | `tenant_standards` validado |
| Perfil empresa/aplicabilidad configurado si aplica | [ ] Pendiente | Cumplimiento | `tenant_company_profiles` o omision registrada |

## Usuarios y roles

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Usuarios creados | [ ] Pendiente | Operaciones | Lista de emails sin contrasenas |
| Roles asignados | [ ] Pendiente | Operaciones | Matriz aprobada |
| Usuario admin tenant validado | [ ] Pendiente | QA | Login y permisos |
| Usuario viewer validado | [ ] Pendiente | QA | Lectura sin administracion |
| Usuario auditor validado si existe | [ ] Pendiente | QA | Acceso auditoria/evidencias |
| Platform admin auditado | [ ] Pendiente | Seguridad | Accion trazable y no operacion diaria |

## Datos iniciales

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Procesos/areas cargados o explicitamente omitidos | [ ] Pendiente | Cumplimiento | Plantilla/anexo |
| Evidencias iniciales cargadas o explicitamente omitidas | [ ] Pendiente | Cumplimiento | Conteo y muestra |
| Riesgos iniciales cargados o explicitamente omitidos | [ ] Pendiente | Cumplimiento | Conteo y muestra |
| Planes de accion cargados o explicitamente omitidos | [ ] Pendiente | Cumplimiento | Conteo y muestra |
| Auditorias iniciales cargadas o explicitamente omitidas | [ ] Pendiente | Cumplimiento | Alcance/fechas |

## Validacion funcional

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Dashboard carga | [ ] Pendiente | QA | Screenshot |
| Evidencias carga | [ ] Pendiente | QA | Screenshot |
| Riesgos carga | [ ] Pendiente | QA | Screenshot |
| Planes de accion carga | [ ] Pendiente | QA | Screenshot |
| Reportes Premium validados | [ ] Pendiente | QA | Preview/PDF/ZIP segun rol |
| IA Compliance validada | [ ] Pendiente | QA | Carga rapida/fallback formal |
| Cross-tenant validado | [ ] Pendiente | Seguridad | Casos ejecutados |
| Offboarding documentado para el cliente | [ ] Pendiente | Operaciones | Responsable y causal definidos |

## Aprobacion

| Item | Estado | Responsable | Evidencia/nota |
|---|---|---|---|
| Bloqueantes cerrados | [ ] Pendiente | Operaciones | Lista vacia o plan aprobado |
| Responsable cliente aprueba acceso | [ ] Pendiente | Cliente | Email/ticket |
| Responsable TCDX aprueba liberacion | [ ] Pendiente | TCDX | Registro interno |
