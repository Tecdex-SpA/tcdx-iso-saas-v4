# Fase 5-C2 — diagnóstico de deudas post-deploy

Fecha de diagnóstico: 2026-08-06. Baseline: `f7beee8cd3fe59800e5b8636722f8740470ea7e7` (PR #56). La evidencia runtime citada fue obtenida por la auditoría post-deploy descrita en el encargo; el diagnóstico de consumidores y contratos se verificó contra el código de este baseline.

## 1. Bootstrap duplicado de módulos

- Evidencia: tenant 1/tenant 2, admin/auditor, rutas como `/dashboard` y `/evidencias`: exactamente 2 `GET /api/me/modules`, HTTP 200, policy `authenticated_read`.
- Consumidor directo principal: `AppLayout.validateAccess`, mediante `fetchAccessBootstrap`.
- Consumidor directo secundario: el efecto de `Sidebar`, mediante un `fetch` independiente.
- Consumidores indirectos: todas las páginas envueltas en `AppLayout`; el drawer móvil puede montar una segunda instancia de `Sidebar` al abrirse.
- Secuencia: `AppLayout` valida token, rol, servicio y módulo; al terminar monta el sidebar de escritorio. `Sidebar` desconoce el resultado ya obtenido y vuelve a consultar. El drawer móvil repite el mismo efecto en cada montaje.
- Causa raíz: hay más de un owner del mismo estado de acceso y solo uno usa el registro single-flight/cache. `globalThis` no puede deduplicar una llamada que evita `fetchAccessBootstrap`.
- Por qué #56 no corrigió: el PR solo incorporó el helper; no migró `Sidebar` a datos compartidos ni eliminó su owner. El script residual tampoco modifica `Sidebar`.
- Solución mínima: `AppLayout` conserva ownership, guarda el `module_map` validado y lo entrega como prop a todas las instancias de `Sidebar`. `Sidebar` deja de hacer red. El helper mantiene single-flight por identidad completa de sesión y URL, con invalidación explícita al cambiar sesión.
- Riesgos: no ocultar navegación mientras el mapa aún no está resuelto; preservar bypass de roles platform/dealer y default compatible cuando el backend no declara una clave.
- Pruebas: dos consumidores concurrentes producen una solicitud; montar layout/sidebar produce una solicitud total; navegación conserva la sesión; token/tenant nuevo genera una nueva solicitud y no reutiliza datos del tenant anterior.

## 2. Solicitudes prohibidas en `/bi`

- Evidencia: ambos auditores generaron exactamente 2 `GET /api/dashboards` 403 y dos errores de recurso; también 3 `GET /api/grc/official/analytics/catalog`.
- Consumidor directo 1 de dashboards: `Phase5Workspace`, porque `/bi/page.tsx` configura `endpoint="/api/dashboards"`.
- Consumidor directo 2 de dashboards: `DashboardBuilder` → `OperationalBuilder.loadHistory()`.
- Consumidores del catálogo: `GrcDecisionCenter`, `OfficialAnalyticsPanel` montado por `analyticsDomain=""`, y `OperationalBuilder`.
- Secuencia: la página monta siempre el workspace, centro de decisiones y builder. Los efectos de los tres hijos arrancan en paralelo; no existe decisión de rol anterior al montaje.
- Causa raíz: una vista mixta de lectura/administración monta superficies administrativas para auditores. La duplicación de dashboards corresponde a dos owners de la misma colección, no a un fallo backend. El catálogo se solicita por tres superficies solapadas.
- Por qué #56 no corrigió: el cambio propuesto por el script solo ocultaba `DashboardBuilder`; dejaba activo el fetch de `Phase5Workspace`, por lo que el auditor aún habría producido un 403. El script no fue aplicado a `main` de todos modos.
- Solución mínima: resolver la identidad cliente antes de montar; para auditor renderizar solo el cockpit permitido. Para admin, mantener el builder como único owner de `/api/dashboards`, desactivar la carga de colección redundante del workspace y compartir/deduplicar la lectura del catálogo por sesión.
- Riesgos: evitar un mismatch de hidratación al leer `localStorage`; mantener builder completo para administradores; no convertir el 403 backend en 200.
- Pruebas: auditor no emite `/api/dashboards` ni error de consola; admin emite una carga inicial y conserva builder; catálogo single-flight; respuestas permanecen tenant-scoped por token/tenant.

## 3. Solicitud prohibida en `/usuarios`

- Evidencia: tenant 1 y tenant 2 auditor emitieron `GET /api/users` 403 antes de terminar en `/cumplimiento-auditoria`, con `RBAC_DENIED` en consola; una corrida previa no lo observó, consistente con timing de efectos/redirect.
- Consumidor directo: `UsuariosPage.loadUsers`.
- Consumidor indirecto: el primer efecto de carga y el segundo efecto dependiente de `selectedTenantId`.
- Secuencia: hidratación obtiene token/usuario y asigna tenant. El primer efecto entra por la rama `else` para todo rol no-superadmin y llama `loadUsers`; el cambio de tenant activa el segundo efecto y puede repetir la carga. El gate/redirect exterior no impide que estos efectos ya montados corran.
- Causa raíz: autorización evaluada después de montar el consumidor y ausencia de `isAdmin` en ambos guards; además hay dos owners de la carga inicial.
- Por qué #56 no corrigió: el script proponía guards correctos y retirar la primera carga, pero esos cambios generados no forman parte de `main`.
- Solución mínima: resolver rol antes de efectos de datos, terminar limpio para no-admin/no-superadmin y dejar un solo efecto de carga, activado únicamente con tenant autorizado.
- Riesgos: superadmin debe cargar tenants antes de usuarios; admin tenant debe conservar su tenant del token; no exponer selector cross-tenant.
- Pruebas: auditor de ambos tenants produce cero requests y cero `RBAC_DENIED`; admin carga una vez; superadmin sigue enviando tenant explícito.

## 4. Identificador de proceso rechazado en `/configuracion`

- Evidencia: tenant 2 admin, ambas corridas: `GET /api/tenant-process-links/by-process/a6534ef8-2a87-2d80-38bb-bcea295a9a1e` → 400, policy `authenticated_read`.
- Consumidor directo: `ProcessesOperationsPanel.loadLinks`.
- Consumidor indirecto: la selección inicial creada a partir de `/api/tenant-processes`.
- Secuencia: el endpoint de procesos entrega el ID almacenado; el panel lo codifica correctamente y consulta links; `tenantProcessLinks.service.getProcess` rechaza antes de consultar SQL.
- Contrato verificado: `tenant_processes.id`, `tenant_process_entity_links.process_id` y las consultas usan el tipo PostgreSQL `uuid` y casts `$n::uuid`. El identificador observado tiene forma hexadecimal 8-4-4-4-12 y es aceptado por PostgreSQL `uuid`, pero su grupo de variante empieza en `3`.
- Causa raíz: `tenantProcessLinks.service` aplica una regex RFC limitada a versiones 1–5 y variante 8/9/a/b, más restrictiva que el tipo real de persistencia. El listado no impone esa restricción, creando una inconsistencia entre endpoints.
- Por qué #56 no corrigió: el script proponía filtrar el proceso en frontend con la misma regex restrictiva. Eso ocultaría un proceso legítimo y perdería operaciones/asociaciones; además el cambio no fue aplicado a `main`.
- Solución mínima: alinear la validación de IDs del servicio con la representación segura que acepta PostgreSQL (`8-4-4-4-12` hexadecimal), conservar queries parametrizadas, casts `uuid` y filtro obligatorio de `tenant_id`. No se requiere migración ni escritura de datos.
- Riesgos: una forma inválida debe seguir fallando 400 antes de SQL; un UUID-like válido nunca puede cruzar tenant porque toda consulta combina `tenant_id` e ID.
- Pruebas: el ID observado pasa validación y llega a query tenant-scoped; formas no hexadecimales siguen rechazadas; proceso válido conserva links y otro tenant recibe no encontrado.

## Decisión de alcance

No se modifica RBAC backend, rate limiting, `public_auth_login`, infraestructura ni datos. 5-C3 permanece bloqueada. El cierre productivo requiere merge/deploy autorizados y una auditoría post-deploy nueva.
