# Fase 5 - Reconciliacion Dashboard y BI

## Dashboard

`/dashboard` consume `/api/metrics/official/dashboard` para el bloque oficial de indicadores. El servicio backend entrega `latest_snapshot`, estado, valor, cobertura, trust, freshness, sufficiency e interpretacion.

Riesgo conservado: la pagina mantiene secciones operacionales legacy con agregados directos. Estas secciones pueden permanecer solo si no se presentan como indicadores oficiales equivalentes. Cualquier card oficial debe derivar de snapshot publicado.

## BI

`OfficialAnalyticsPanel` y `GrcDecisionCenter` consumen catalogo oficial. El valor ausente se muestra como `Sin medicion oficial`; no se transforma en cero.

Cambio de esta ejecucion: `FormulaCatalog` muestra `data_requirements` para estados no calculados, incluyendo poblacion actual/requerida y ruta de correccion.

## Regla de igualdad

Para indicadores oficiales:

`Dashboard value = BI value = Metricas value = metric_snapshot.payload.result.value`

Si falta snapshot o medicion, el estado es no numerico y debe mostrar requisitos accionables.
