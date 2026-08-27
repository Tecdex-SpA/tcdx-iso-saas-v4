# UI LAYOUT PATTERNS

## A. Centro Ejecutivo

App shell + header contextual + KPI strip + franja de prioridades + tendencias relevantes + alertas/actividad + Data Trust. No usar un mosaico de graficos decorativos.

## B. Workspace operacional

App shell + workspace header + acciones + KPIs compactos + tabs + filter bar + tabla principal + drawer de detalle. Es el patron de referencia para Riesgo y Control.

## C. Analisis GRC

Header + contexto/filtros + KPIs + una visualizacion principal + tabla o desglose verificable + Data Trust. Heatmap, matriz o tendencia solo cuando responde una pregunta operacional.

## D. Cumplimiento e ISO

Contexto normativo + tabs + filtros compartidos + obligaciones/controles/evidencias + detalle trazable. Los estados de cumplimiento y Data Trust permanecen separados.

## E. Detail view

Resumen + clasificacion + relaciones + controles + evidencias + acciones + actividad + IA contextual. Usar drawer si preservar la lista mejora el flujo; usar ruta dedicada cuando el objeto requiere deep link o trabajo extenso.

## Responsive

- 1440: shell completo y drawer persistente cuando hay espacio.
- 1280: reducir anchos y columnas secundarias; conservar acciones principales.
- Tablet: sidebar colapsable, filtros resumidos, drawer overlay y tabla con scroll/columnas priorizadas.
- Mobile: consulta y tareas basicas mediante lista adaptada o detalle; no comprimir una tabla enterprise completa.

No sustituir estos patrones por landing pages, hero sections ni mosaicos genericos de cards.
