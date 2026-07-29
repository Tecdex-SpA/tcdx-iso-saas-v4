# Hotfix Fase 5: tenant, shell y analítica GRC

## Diagnóstico confirmado

- Las páginas nuevas importaban `Phase5Workspace` directamente y no heredaban `AppLayout`; por eso se renderizaban sin header/sidebar.
- `Phase5Workspace` ejecutaba `fetch()` directo con `Authorization`, pero sin `X-Tenant-Id`, request id ni manejo común de errores.
- `scope(req)` en rutas Fase 5 tomaba `req.tenantId` o campos ambiguos del usuario. Para platform admin sin tenant seleccionado, el backend podía recibir un tenant faltante o no UUID.
- La caché frontend de entitlements usaba `default-tenant`, lo que podía mezclar decisiones cuando un platform admin cambiaba empresa.
- El CHECK de `data_lineage_edges.relation_type` no incluía relaciones GRC necesarias para assurance, pérdidas e impacto.

## Corrección implementada

- Backend incorpora `resolveEffectiveTenant`, que diferencia usuario tenant y platform admin, valida UUID, verifica existencia del tenant y bloquea cross-tenant.
- Frontend usa `apiRequestJson`, que agrega token, request id y `X-Tenant-Id` desde sesión o empresa seleccionada.
- Administración SaaS persiste `activeTenantId` al seleccionar empresa y limpia la caché de entitlements.
- Todas las rutas `/datos`, `/metricas`, `/encuestas`, `/evaluaciones`, `/tests`, `/eventos-perdida`, `/bi`, `/reportes` y `/grc` heredan `AppLayout` mediante layouts de segmento.
- `/api/grc/overview` entrega bloques independientes con `status`, `data`, `freshness`, `trust`, `source_count`, `warnings` y `last_updated_at`.
- `/grc` consume el agregador backend y muestra estado operativo sin inventar ceros.
- La migración `20260730_phase5_tenant_shell_grc_data_integration.sql` amplía relaciones, agrega reglas de impacto, eventos analíticos y versión v2 del Data Trust Score.

## Códigos de error

- `TENANT_REQUIRED`: no hay tenant efectivo; platform admin debe seleccionar empresa.
- `TENANT_INVALID`: el tenant recibido no es UUID válido.
- `TENANT_FORBIDDEN`: usuario tenant intentó operar otro tenant.
- `CAPABILITY_NOT_INCLUDED`: capability no incluida por plan, módulo, override o trial.
- `PERMISSION_DENIED`: rol/permisos insuficientes.

## Analítica incorporada

- Mediciones registran lineage hacia métrica, fórmula y evidencia cuando existe.
- Tests de assurance registran relación `tests` hacia la entidad objetivo y `affects` cuando fallan.
- Eventos de pérdida registran relaciones con proceso, servicio, riesgo, proveedor, incidente, control fallido, evidencia y acción si existen.
- Widgets de BI registran consumo de métricas.
- Snapshots de dashboards/reportes y generaciones de reportes quedan enlazados.
- Data Trust Score v2 incorpora disponibilidad de fuente, resultado de assurance, trazabilidad a evidencia y calidad dimensional.
