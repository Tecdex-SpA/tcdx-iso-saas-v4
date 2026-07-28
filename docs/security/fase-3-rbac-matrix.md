# Fase 3 - Matriz RBAC

| Rol | Lectura | Gestión | Aprobación/activación |
|---|---|---|---|
| Platform admin | Acceso administrativo trazable | Solo soporte autorizado | Alto riesgo |
| Tenant admin / compliance admin | Todas las vistas | Unidades, procesos, servicios, BIA, continuidad, métricas y riesgo | Sí |
| Auditor | Todas las vistas relevantes | Sin mutación operacional | No |
| Responsable de área | Operación, continuidad, métricas y 360 | Procesos, servicios, BIA, planes, pruebas y mediciones | No |
| Viewer | Sin permisos Fase 3 por defecto | No | No |

## Permisos

Los 26 permisos se agrupan en `operations`, `continuity`, `metrics` y `risk`. Backend
valida capability, tenant y permiso antes de cada consulta o mutación. Frontend usa el
mapa autoritativo para presentar acciones, pero nunca reemplaza el control backend.

## Separación

Habilitar la capability no concede permisos. Asignar permisos no habilita la capability.
Ambas condiciones y un contexto tenant válido son obligatorias.
