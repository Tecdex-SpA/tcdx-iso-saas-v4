# Fase 3 - Plan de validación web

Tenant: `tcdx.local`

## Rutas

- `/operaciones-grc`
- `/unidades`
- `/procesos`
- `/servicios`
- `/bia`
- `/continuidad`
- `/continuidad/pruebas`
- `/crisis`
- `/indicadores`
- `/riesgo-cuantitativo`

## Flujo

1. Crear unidad.
2. Crear proceso y servicio asociados.
3. Vincular proveedor, sistema, riesgo, control y requisito.
4. Crear y aprobar BIA con RTO <= MTPD.
5. Crear y aprobar plan.
6. Crear prueba y registrar resultado.
7. Crear KPI/KRI y registrar medición.
8. Crear evaluación cuantitativa.
9. Confirmar alertas y cambio explicable de readiness.
10. Abrir vistas 360 y comprobar relaciones bidireccionales.
11. Recargar y confirmar persistencia.
12. Confirmar que otro tenant no ve los registros.
13. Archivar o eliminar los datos QA por los flujos autorizados.

## Cierre

Registrar ruta, actor, resultado, fecha, SHA y evidencia visual. Un error funcional
mantiene la fase pendiente de corrección; no debe ocultarse ni reclasificarse como éxito.
