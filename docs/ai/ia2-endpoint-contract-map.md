# IA.2 - Mapa de contrato de endpoints IA legacy

Fecha: 2026-06-15
Rama: `chore/ia2-backend-contract-traceability`
Alcance: analisis documental, sin cambios productivos.

## 1. Contrato consumido por `/ia`

Fuente frontend: `frontend/src/app/ia/page.tsx`.

| Elemento | Valor |
|---|---|
| Endpoints llamados | `GET ${API_URL}/api/ai/recommendations/${user.tenant_id}` |
| Metodo HTTP | `GET` |
| Payload enviado | Ninguno. Solo header `Authorization: Bearer ${token}`. |
| Respuesta esperada por UI | Objeto con `summary`, `riskLevel`, `riskScore`, `topRisks`, `recommendations`. |
| Campos usados por UI | `data.summary`, `data.riskLevel`, `data.riskScore`, `data.topRisks[].clause`, `data.topRisks[].status`, `data.recommendations[].clause`, `data.recommendations[].level`, `data.recommendations[].message`. |
| Acciones con efectos reales | Ninguna desde la pantalla `/ia` actual. No hay botones ni llamadas `PUT/POST`. |
| Validaciones cliente | Espera fin de `useTenantEntitlements`; redirige a `/dashboard` si `canUseAiFeature('suggestions')` es falso; solo llama backend si `user?.tenant_id` existe. |
| Manejo de error | No hay `catch`, no se valida `res.ok`, no hay estado de error. Si la respuesta no calza, el render puede romper por `data.topRisks.map` o `data.recommendations.map`. |
| Token/JWT usado | `localStorage.getItem('token')`; `getUserFromToken()` para leer `tenant_id`. |
| Tenant source | `user.tenant_id` decodificado del JWT en frontend y enviado como path param. Backend compara con `req.user.tenant_id` salvo `superadmin`. |
| Dependencia de roles o modulos | Frontend: entitlement `suggestions`. `AppLayout` bloquea `/ia` si IA/suggestions no esta habilitado. RBAC backend para `/api/ai`: read `admin`, `tenant_admin`, `auditor`, `operativo`; write `admin`, `tenant_admin`, `operativo`. |

## 2. Contrato backend real legacy IA

Fuente backend: `backend/src/routes/ai.routes.js`.

| Endpoint | Metodo | Handler | Auth/RBAC | Tenant source | Query principal | Respuesta real | Trazabilidad | Riesgo |
|---|---|---|---|---|---|---|---|---|
| `/api/ai/recommendations/:tenant_id` | GET | `router.get('/recommendations/:tenant_id', auth, async (req,res) => ...)` | `auth` local en route; ademas en `backend/src/app.js` pasa por `app.use('/api', auth, enforceApiAccess)` y `app.use('/api', enforceTenantRequestScope)`. RBAC global permite read `/api/ai` a `admin`, `tenant_admin`, `auditor`, `operativo`. | Path param `tenant_id`; valida UUID; `ensureTenantAccess` permite `superadmin` o `req.user.tenant_id === tenant_id`. `tenantScope.middleware` tambien captura `/api/ai/recommendations/:tenant_id` como path tenant generico via params. | SELECT sobre `tenant_controls tc`, `controls_catalog cc`, `tenant_standards ts`, `iso_clause_guides g`, filtrado por `tc.tenant_id = $1`, norma activa y control activo. | Array de objetos: `tenant_control_id`, `tenant_id`, `iso`, `clause`, `category`, `description`, `prioridad`, `accion`, `evidencia`, `catalog_control_id`, `auditor_explicacion`. | No guarda `ai_prompt_logs`, `ai_suggestions`, `ai_feedback` ni `ai_core.ai_response_traces`; no devuelve `trace`, `source_trace`, `confidence`, `limitations` ni `engine`. | Drift fuerte con frontend `/ia`; sin entitlement backend especifico `suggestions`; salida puede ser util, pero no es trazable como IA MVP. |
| `/api/ai/apply/:tenant_control_id` | PUT | `router.put('/apply/:tenant_control_id', auth, async (req,res) => ...)` | `auth` local; RBAC global `/api/ai` write: `admin`, `tenant_admin`, `operativo`. `auditor` no puede escribir por RBAC global. | Path param `tenant_control_id`; busca control y deriva `control.tenant_id`; `ensureTenantAccess` permite `superadmin` o mismo tenant. | Busca `tenant_controls` con `controls_catalog` y `tenant_standards`; si hay NC abierta en `tenant_nonconformities`, la marca `resuelta`; actualiza `tenant_controls.status = 'cumple'`; inserta una fila en `evidences`. | `{ success: true }` o errores simples. | No registra `ai_prompt_logs`, `ai_suggestions`, `ai_feedback`, `ai_core.ai_response_traces` ni audit log visible en el handler. | Alto: aplica cambios reales y crea evidencia automaticamente con descripcion fija. No hay gate de revision humana ni conversion a borrador. |

## 3. Relacion con rutas IA modernas

| Superficie | Endpoints modernos relevantes | Diferencia clave frente a `/api/ai` legacy |
|---|---|---|
| `/ia-compliance` | `GET /api/ai-compliance/engine-health`, `GET /api/ai-compliance/health-summary`, `GET /api/ai-compliance/suggestions`, `GET /api/ai-compliance/executive-brief` | Usa entitlement backend `suggestions`, `resolveTenantId()`, `ai_prompt_logs`, `structured_result`, `source_trace`, `confidence`, `limitations`, engine/metrics y mensajes de revision humana. |
| `/ia-compliance/sugerencias` | `GET /api/ai-compliance/suggestions`, `POST /api/ai-compliance/suggestions/:id/apply` | Filtra `ai_suggestions` por `tenant_id`; puede marcar aplicada o crear borrador de plan de accion desde sugerencias elegibles. |
| Respuesta IA trazable | `POST /api/ai-compliance/answer` | Guarda en `ai_core.ai_response_traces` y devuelve `trace` + `search_trace`; puede usar tenant internal, TCDX knowledge, benchmark y external lookup bajo condiciones. |
| Feedback IA | `/api/ai-feedback` | Guarda feedback supervisado en `ai_core.ai_response_feedback`; no es usado por `/ia`. |
| Traces IA | `/api/ai-traces` | Registra/lista trazas por tenant o plataforma; no es usado por `/api/ai/recommendations` ni `/api/ai/apply`. |

## 4. Evidencia de montaje y guardas transversales

| Archivo | Evidencia |
|---|---|
| `backend/src/app.js` | `app.use('/api', auth, enforceApiAccess)`, `app.use('/api', enforceTenantRequestScope)`, `app.use('/api/ai', aiRoutes)`; rate limit aplica a rutas que empiezan con `/api/ai`. |
| `backend/src/middleware/rbac.middleware.js` | Regla `/api/ai`: read `admin`, `tenant_admin`, `auditor`, `operativo`; write `admin`, `tenant_admin`, `operativo`. |
| `backend/src/middleware/tenantScope.middleware.js` | Extrae tenant ids desde params/query/body y bloquea mismatch para roles no plataforma/no dealer. |
| `frontend/src/components/AppLayout.tsx` | Trata `/ia`, `/ia-compliance` y `/ia-compliance/*` como `aiComplianceRoute` y exige IA habilitada + feature `suggestions`; tambien `/ia` esta dentro de rutas ocultas para clientes no plataforma. |
