# Inventario de dominios para importación universal

## Criterio

Este inventario clasifica entidades persistentes según su aptitud real para importación. Una
entidad bloqueada no se muestra como acción operativa. El catálogo declarativo ejecutable está
en `backend/src/services/imports/importDefinitions.js`.

Clasificaciones:

- `importable_now`: plantilla, preview, confirmación, auditoría y rollback disponibles.
- `importable_after_code`: requiere clave natural tenant-scoped o adaptador transaccional.
- `not_importable_by_design`: el alta masiva contradice el flujo de negocio.
- `system_managed`: catálogo o dato administrado por el sistema.
- `derived`: resultado calculado, no fuente importable.
- `security_sensitive`: contiene credenciales, datos personales o archivos sujetos a controles.

## Ola 1 - Datos maestros y operación

| Dominio | Clasificación | Clave legible | Decisión |
| --- | --- | --- | --- |
| Tenants/empresas | security_sensitive | tenant slug | Solo SaaS Admin; fuera del centro tenant |
| Unidades | importable_now | `code` | Operable |
| Usuarios | security_sensitive | `email` | Bloqueado: requiere invitación e identidad; nunca contraseña |
| Roles y asignaciones | security_sensitive | `email` + role | Bloqueado: RBAC debe aprobarse por flujo de administración |
| Perfil empresa | importable_after_code | tenant | Bloqueado: único registro versionado |
| Procesos | importable_now | `code` | Operable después de unidades |
| Servicios | importable_now | `code` | Operable después de procesos |
| Activos | importable_after_code | pendiente | Bloqueado hasta código natural único para todas sus variantes |
| Proveedores | importable_now | `code` | Operable con servicio TPRM oficial |
| BIA | importable_now | `code` | Operable por proceso o servicio |
| Planes de continuidad | importable_now | `code` | Operable después de BIA |
| Pruebas de continuidad | importable_now | plan + fecha + tipo | Operable, solo creación |
| Indicadores KPI/KRI/KCI | importable_now | `code` | Operable |
| Mediciones | importable_now | indicador + período | Operable e idempotente por lote |
| Riesgo cuantitativo | importable_now | `code` | Operable después de riesgos |
| Crisis y bitácoras | not_importable_by_design | código de crisis | Se crean durante operación y requieren trazabilidad temporal |

## Ola 2 - GRC central

| Dominio | Clasificación | Motivo |
| --- | --- | --- |
| Riesgos y matrices | importable_after_code | La matriz calcula nivel y mantiene versiones |
| Amenazas y vulnerabilidades | importable_after_code | Requieren códigos y relación inequívoca con activos |
| Controles | importable_after_code | Conviven catálogo, control tenant y operación |
| Tratamientos | importable_after_code | Dependen de riesgo, acción y aprobación |
| Relaciones riesgo-control | importable_after_code | Requieren claves estables en ambos extremos |
| Normas | system_managed | Catálogo normativo central |
| Requisitos | system_managed | Pertenecen a versiones de framework |
| Mapeos | importable_after_code | Requieren revisión tenant |
| Cumplimiento, SoA y GAP | derived | Se evalúan desde controles, requisitos y evidencias |
| Evidencias y documentos | security_sensitive | El binario debe usar carga segura, hash y revisión |
| Metadatos de evidencias | importable_after_code | Deben asociarse a un archivo ya cargado |
| Hallazgos | importable_after_code | Requieren origen y workflow |
| No conformidades | importable_after_code | Requieren causa, resolución y evidencias |
| Acciones y seguimientos | importable_after_code | Requieren responsables, aprobación y relaciones |

## Ola 3 - Auditoría, privacidad y terceros

| Dominio | Clasificación | Motivo |
| --- | --- | --- |
| Planes, programas y auditorías | importable_after_code | Equipo, alcance e independencia deben validarse juntos |
| Pruebas y muestras | importable_after_code | Dependen de programa y universo |
| Papeles de trabajo | security_sensitive | Archivo y supervisión obligatorios |
| Actividades de tratamiento | importable_after_code | Requieren versionado y bases legales |
| DPIA | derived | Se genera desde actividad y riesgo evaluado |
| Solicitudes de titulares | security_sensitive | Contienen datos personales |
| Brechas de privacidad | security_sensitive | Requieren incidente y notificación controlada |
| Incidentes, impactos y cronología | importable_after_code | El cierre depende de reglas de dominio |
| Evaluaciones de proveedores | importable_after_code | Dependen de proveedor y cuestionario publicado |
| Plantillas y versiones de cuestionarios | system_managed | Versiones publicadas inmutables |
| Respuestas de proveedor | security_sensitive | Deben ingresar por portal autenticado |

## Datos excluidos

No son importables: contraseñas, hashes, secretos, tokens, sesiones, API keys, credenciales de
conectores, claves privadas, cookies, códigos de recuperación, jobs internos, logs, eventos de
auditoría, resultados derivados y estados calculados.

## Condición para habilitar una entidad bloqueada

Debe existir clave natural única por tenant, servicio de dominio transaccional, validación RBAC,
aislamiento tenant, prueba de preview/confirmación/rollback y tratamiento explícito de cambios
posteriores. Agregar solo columnas a una planilla no habilita el dominio.
