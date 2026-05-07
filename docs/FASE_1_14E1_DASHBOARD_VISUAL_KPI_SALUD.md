# Fase 1.14E1 - Dashboard visual, KPI y Salud ISO

## Objetivo

Mejorar el nuevo Dashboard para que recupere recursos visuales del dashboard anterior y consolide, con paridad funcional razonable, las areas de:

- resumen ejecutivo;
- readiness de auditoria;
- Salud ISO;
- KPIs;
- alertas ejecutivas;
- calidad de datos sin errores tecnicos visibles.

Quedan fuera de esta fase:

- Ciclo de Vida operativo con drag/drop;
- consolidacion completa de Riesgos ISO;
- consolidacion completa de Acciones Recomendadas;
- limpieza del sidebar;
- Evidencias y Documentos como operacion principal dentro del Dashboard.

## Inventario de recursos revisados

| Vista origen | Funcionalidad/componente visual encontrado | Archivo origen | Se reutiliza | Archivo destino | Observacion |
|---|---|---|---|---|---|
| Dashboard antiguo | Tarjetas ejecutivas, Recharts, distribuciones, microtendencias, badges semanticos | `frontend/src/app/dashboard/page.tsx` | Si | `frontend/src/components/dashboard-v2/DashboardV2Header.tsx`, `DashboardV2Panel.tsx` | Se mantiene header ejecutivo, metric cards, barras y graficos Recharts equivalentes. |
| Dashboard KPI | Pie/Bar/Line charts, KPI score, estados verde/amarillo/rojo/gris, detalle de KPIs | `frontend/src/app/dashboard-kpi/page.tsx` | Si | `frontend/src/components/dashboard-v2/DashboardV2Panel.tsx` | Se agregaron distribucion KPI, barras por norma y microtendencia KPI. |
| Salud ISO actual | Salud global, salud por norma, controles en riesgo, remediacion, evidencias, bitacora | `frontend/src/app/health/page.tsx` | Si | `frontend/src/components/dashboard-v2/DashboardV2HealthSection.tsx` | La seccion ya consume endpoints reales de Salud ISO; se agregaron graficos de distribucion y barras por norma. |
| Dashboard v2 base | Readiness, tarjetas por norma contratada, tabs internas, preferencias por usuario | `frontend/src/components/dashboard-v2/*` | Si | `frontend/src/components/dashboard-v2/*` | Se mantiene estructura nueva y personalizacion ya implementada. |
| Backend Dashboard v2 | Agregador ISO consolidado, paneles operativos y preferencias | `backend/src/services/dashboardV2.service.js` | Si | mismo archivo | Se verifico la consulta segura de tenant para evitar `42703` y mensajes tecnicos visibles. |

## Recursos visuales recuperados

Se incorporaron/fortalecieron recursos visuales equivalentes al dashboard anterior:

- graficos `PieChart`, `BarChart` y `LineChart` de `recharts`;
- cards KPI por estado;
- barras apiladas por norma;
- microtendencia KPI;
- donut de distribucion de salud;
- colores semanticos de salud y KPI;
- layout con secciones premium y jerarquia visual clara.

## Salud ISO consolidada

`DashboardV2HealthSection` reutiliza endpoints existentes:

- `/health/dashboard`;
- `/health/standards`;
- `/health/root-causes`;
- `/health/root-causes/standards`;
- `/health/controls-risk`;
- `/health/remediation-summary`;
- `/health/remediation-plan`;
- `/health/evidence-approval-queue`;
- `/health/audit-log`;
- `/health/refresh`.

Capacidades mantenidas:

- salud global;
- salud por norma contratada;
- controles saludables/en atencion/deteriorados/criticos;
- causas raiz;
- controles en riesgo;
- plan de remediacion;
- creacion explicita de plan desde Salud ISO;
- evidencias pendientes como resumen/acceso;
- bitacora operacional.

Mejora E1:

- grafico donut de distribucion de salud;
- grafico de barras apiladas por norma.

## KPIs consolidados

`DashboardV2Panel` ahora muestra:

- score KPI;
- medidos;
- verdes/amarillos/rojos/grises;
- donut de distribucion KPI;
- barras apiladas por norma contratada;
- microtendencia compacta;
- lista de indicadores que requieren mirada.

La vista completa `/dashboard-kpi` sigue disponible para gestion avanzada.

## Readiness ejecutivo

El bloque superior mantiene:

- readiness de auditoria;
- explicacion ejecutiva;
- normas activas;
- cobertura;
- acciones pendientes;
- riesgos altos;
- ultima actualizacion;
- boton de refrescar.

El calculo proviene del agregador `dashboardV2.service.js`, que a su vez reutiliza el command center y paneles operativos.

## Correccion error 42703

Error observado:

```text
Calidad de datos Parcial — No se pudo consultar tenant: 42703
```

Causa:

El backend consultaba columnas opcionales de `tenants`, como `legal_name`, sin confirmar que existieran en el esquema real.

Correccion vigente verificada:

- `getTenant()` consulta `information_schema.columns`.
- El `SELECT` se arma solo con columnas existentes.
- Se agregan fallbacks para nombre, estado, fecha y logo.
- Los errores tecnicos se registran con `console.error`.
- Las notas al usuario usan mensajes funcionales y no codigos SQL.

## Multi-tenant y normas contratadas

La visibilidad por norma sigue filtrada por `tenant_standards` y por los endpoints actuales:

- no se muestran normas no contratadas;
- no se muestran tarjetas 0% de normas fuera del tenant;
- ISO9001 `2026_FDIS` no se muestra como certificable operativa.

## Vistas separadas

Se mantienen separadas:

- Evidencias;
- Documentos generados/sugeridos.

El Dashboard solo mantiene accesos/resumen si esos datos afectan readiness o Salud ISO.

## Validacion

Script:

```bash
bash scripts/validate-dashboard-visual-kpi-salud.sh
```

Valida:

- `/dashboard` responde;
- `/dashboard-v2` responde;
- endpoints de resumen, Salud ISO y KPIs responden;
- no aparece `42703`;
- no aparece `undefined_column`;
- solo se muestran normas contratadas;
- ISO9001 `2026_FDIS` no aparece como certificable operativa;
- conteos criticos intactos si `DATABASE_URL` esta disponible.

## Pendiente para 1.14E2

- Ciclo de Vida con paridad operativa completa dentro del Dashboard.
- Riesgos ISO completos con acciones de revision.
- Acciones Recomendadas con conversion segura dentro del Dashboard.
- Limpieza progresiva del sidebar.
- Eventual reemplazo controlado de `/dashboard` por el nuevo Dashboard.
