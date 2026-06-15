# IA.2 - Contrato backend, trazabilidad y seguridad de `/ia`

Fecha: 2026-06-15
Rama: `chore/ia2-backend-contract-traceability`

## 1. Resumen

IA.2 confirma que `/ia` consume un unico endpoint legacy:
`GET /api/ai/recommendations/:tenant_id`.

El contrato real backend no coincide con el contrato esperado por la UI. El
frontend espera un objeto ejecutivo con resumen, nivel de riesgo, top risks y
recommendations, mientras el backend devuelve un array plano de recomendaciones
por control. Esto bloquea una migracion directa y tambien justifica no archivar
`/ia` sin decidir primero el contrato IA.3.

Tambien se reviso `PUT /api/ai/apply/:tenant_control_id`. Aunque `/ia` no lo
consume hoy, pertenece a la misma superficie legacy `/api/ai` y ejecuta efectos
reales: marca control como `cumple`, resuelve una no conformidad abierta y crea
una evidencia automatica. No tiene trazabilidad IA ni gate explicito de revision
humana.

## 2. Contrato esperado vs contrato real

| Campo esperado por `/ia` | Existe en backend | Fuente real | Brecha | Accion recomendada |
|---|---:|---|---|---|
| `summary` | No | No detectado en `GET /api/ai/recommendations/:tenant_id`. | Frontend renderiza `data.summary`, pero backend devuelve array. | No adaptar UI en IA.2; en IA.3 elegir contrato canonical o retirar vista. |
| `riskLevel` | No | No detectado. | Frontend espera `ALTO/MEDIO/...`; backend solo calcula `prioridad` por control. | Si se migra, derivar nivel desde health summary o excluir. |
| `topRisks` | No | No detectado. | Frontend llama `data.topRisks.map`; backend no devuelve objeto `topRisks`. | Mapear recomendaciones de control a un bloque nuevo o no migrar. |
| `recommendations` | No como contenedor | Backend devuelve array raiz de recomendaciones. | Frontend espera `data.recommendations[].level/message`; backend entrega `prioridad/accion/evidencia/auditor_explicacion`. | En IA.3 transformar a contrato nuevo o usar `/ia-compliance` existente. |
| `action` | No con ese nombre | `accion` | Campo util, pero en espanol y sin trazabilidad. | Migrar como accion recomendada solo si se etiqueta fuente y revision humana. |
| `evidence` | No con ese nombre | `evidencia` | Campo util, pero no como evidencia aprobada. | Migrar a `/ia-compliance` o sugerencias como recomendacion pendiente. |
| `priority` | No con ese nombre | `prioridad` | Semantica existe; nombre y valores no coinciden con frontend. | Mapear a `priority` en contrato nuevo o conservar solo en documento de decision. |
| `auditorExplanation` | No con ese nombre | `auditor_explicacion` | Semantica existe; nombre snake_case y texto deterministico por status. | Mantener como explicacion deterministica, no como respuesta IA trazable. |
| `controlId` | Parcial | `catalog_control_id` | ID catalogo existe, pero no es el control tenant. | Evitar usarlo para acciones sobre tenant; preferir `tenant_control_id`. |
| `tenantControlId` | No con ese nombre | `tenant_control_id` | Semantica existe con snake_case. | Mapear si IA.3 crea contrato frontend nuevo. |
| `status` | Si | `status` usado en SQL y respuesta. | Existe por control, no como estado global. | Usar solo en filas de control. |
| `health` | No | No detectado en legacy `/api/ai`. | La salud ejecutiva existe en `/api/ai-compliance/health-summary`, no en legacy. | Cubierto por `/ia-compliance`; no migrar desde `/ia`. |
| `source` | No | Fuente inferible por SQL: `tenant_controls`, `controls_catalog`, `tenant_standards`, `iso_clause_guides`. | No se devuelve al cliente. | Si se absorbe, exponer fuente deterministica minima. |
| `confidence` | No | No detectado. | No hay confianza IA ni scoring de trace. | Usar IA Compliance v2 si se requiere confidence. |
| `trace` | No | No detectado. | No hay `trace.id`, `search_trace` ni trace persistido. | Bloquear aplicacion/migracion directa sin trace o etiqueta deterministica. |
| `limitations` | No | No detectado. | No comunica limitaciones ni ausencia de IA generativa. | Agregar en contrato futuro o mantener fuera de MVP. |

## 3. Trazabilidad y seguridad de endpoints legacy

| Riesgo | Estado | Evidencia | Recomendacion |
|---|---|---|---|
| `tenant_id` recibido por params | Controlado parcialmente | `GET /recommendations/:tenant_id`; `isUUID`; `ensureTenantAccess`; `tenantScope.middleware` revisa ids solicitados para roles no plataforma/no dealer. | Preferir tenant desde JWT/backend en cualquier contrato IA.3 nuevo. |
| Comparacion tenant params vs JWT | Existe | `ensureTenantAccess(req, tenant_id)` permite `superadmin`; otros requieren `req.user.tenant_id === tenant_id`. | Mantener pruebas negativas cross-tenant si se toca contrato. |
| Roles platform/dealer | Parcial | Plataforma pasa RBAC; dealer queda bloqueado por `rbac.middleware` porque `/api/ai` no permite dealer. | Correcto para dealer; documentar plataforma como excepcion controlada. |
| Roles auditor/admin/viewer | Parcial | `/api/ai` read: admin, tenant_admin, auditor, operativo. Viewer/ejecutivo no puede leer. `/api/ai` write: admin, tenant_admin, operativo; auditor no escribe. | Si IA.3 migra valor a MVP, alinear con roles de `/ia-compliance` y producto. |
| Efectos reales del PUT apply | Alto riesgo | Actualiza `tenant_controls.status`, resuelve `tenant_nonconformities`, inserta `evidences`. | Clasificar como `requires_replacement_by_action_plan_draft_flow`. |
| Registro audit log | No detectado en handler legacy | No se observo insert a audit log ni bitacora de aplicacion. | No usar apply directo en MVP. Si se conserva, agregar auditoria formal antes. |
| Registro `ai_prompt_logs` | No detectado en legacy | `ai-compliance.routes.js` si usa `savePromptLog`; `ai.routes.js` no. | No presentar legacy como IA trazable. |
| Registro `ai_suggestions` | No detectado en legacy | `ai-compliance.routes.js` usa `ai_suggestions`; `ai.routes.js` no. | Migrar valor util como sugerencia guardada si IA.3 decide absorberlo. |
| Registro `ai_feedback` | No detectado en legacy | `ai-feedback.routes.js` existe, pero `/api/ai` legacy no lo usa. | Feedback queda fuera del flujo legacy. |
| Registro `ai_traces` | No detectado en legacy | `ai-answer.routes.js` y `ai-traces.routes.js` guardan `ai_core.ai_response_traces`; `ai.routes.js` no. | Requerir trace o declarar salida deterministica sin IA generativa. |
| Control de entitlement IA | Parcial | Frontend y `AppLayout` exigen `suggestions`; backend legacy `/api/ai` no llama `isTenantAiFeatureEnabled`. | Cualquier contrato IA.3 debe usar entitlement backend uniforme. |
| Control de modulo contratado | Parcial | `AppLayout` valida modulo/ruta y feature IA en frontend; backend legacy solo RBAC. | No depender solo de UI para entitlement. |
| Degradacion si AI Engine no responde | No aplica | Legacy `/api/ai/recommendations` no llama AI Engine; es SQL deterministico. | Etiquetar como deterministico y no prometer AI Engine. |
| Exposicion cross-tenant | Mitigada parcialmente | `ensureTenantAccess` y `tenantScope.middleware`; no se ejecuto prueba runtime. | Mantener pruebas negativas antes de cualquier cambio IA.3. |

## 4. Clasificacion de `PUT /api/ai/apply/:tenant_control_id`

Clasificacion IA.2: **`requires_replacement_by_action_plan_draft_flow`**.

Motivo:

- aplica cambios reales sobre registros de cumplimiento;
- puede resolver una no conformidad abierta;
- crea evidencia automatica con texto fijo;
- no registra trace IA ni prompt log;
- no exige aprobacion humana explicita en el contrato;
- no es consumido por `/ia` actual, por lo que puede excluirse de la migracion
  sin perder funcionalidad visible.

Decision tecnica recomendada: IA.3 no debe migrar este endpoint a
`/ia-compliance`. El reemplazo seguro es crear o reutilizar un flujo de
borrador revisable de plan de accion, similar a
`POST /api/ai-compliance/suggestions/:id/apply` con
`apply_mode=create_action_plan_draft`.

## 5. Observaciones de alcance

- No se ejecuto SQL.
- No se modifico UI.
- No se movio ni borro `/ia`.
- No se cambio comportamiento productivo.
- `git pull --ff-only origin main` fallo por `Permission denied (publickey)`
  aun con ejecucion escalada; la rama IA.2 partio desde `main` local, que al
  hacer checkout indicaba estar alineada con `origin/main` local.

## 6. Validaciones

Resultados finales registrados en `docs/ai/ia2-decision-for-ia3.md`.
