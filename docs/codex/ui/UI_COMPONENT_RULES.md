# UI COMPONENT RULES

La especificacion exhaustiva vive en `UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md`. Este archivo resume las reglas de implementacion obligatorias.

## Reutilizacion

- Buscar primero equivalentes en el proyecto y en `tecdex-design-system` READ ONLY.
- Adaptar componentes existentes a tokens semanticos antes de crear nuevos.
- No introducir una segunda libreria visual ni variantes locales sin necesidad real.
- Usar el set de iconos existente; los controles solo-icono requieren tooltip y nombre accesible.

## Componentes principales

- App shell: sidebar oscuro, topbar compacta, breadcrumb, tenant/contexto, periodo, busqueda, notificaciones y usuario.
- KPI: compacto, titulo breve, valor, comparacion, alcance y Data Trust cuando corresponda.
- Tabla: sorting, filtros, seleccion, estados, prioridad, owner, fecha, acciones, paginacion, sticky header y bulk actions.
- Detail drawer: mantiene la lista visible en desktop; overlay o pantalla completa en anchos menores.
- Status chip: icono o texto ademas del color; un estado por concepto.
- Data Trust: `Trusted`, `Trusted with warnings`, `Low confidence`, `Insufficient data`; nunca convertirlo en score arbitrario.
- IA contextual: insight o recomendacion ligada al objeto actual, con fundamento, evidencia, limites y accion humana.

## Estados obligatorios

Todo componente de datos debe contemplar:

`default`, `hover`, `active`, `selected`, `focus-visible`, `disabled`, `loading`, `empty`, `insufficient-data`, `not-calculable`, `not-available`, `error` y `permission-denied` cuando corresponda.

`0` es un valor valido. `null`, ausencia, insuficiencia, no calculable, no disponible y error son estados diferentes y no pueden presentarse como cero o exito.

## Restricciones visuales

- Radios de 8 px o menos salvo modal/drawer definido por la foundation.
- Sombras solo para elevacion funcional: menus, tooltips, drawers y modals.
- No anidar cards ni convertir secciones completas en cards flotantes.
- El color no debe ser el unico medio para comunicar estado.
- No crear graficos sin una pregunta de negocio clara.
