# IA.3-C - Implementation notes

Fecha: 2026-06-15

| Archivo | Cambio | Motivo | Riesgo |
|---|---|---|---|
| `backend/src/routes/ai.routes.js` | Agrega helpers de rol, usuario, prioridad y explicacion deterministica. | Reutilizar la misma semantica de recomendaciones legacy en el borrador de plan sin duplicar reglas en el handler. | Bajo; no cambia el contrato `GET /recommendations`, solo centraliza logica existente. |
| `backend/src/routes/ai.routes.js` | `PUT /apply/:tenant_control_id` valida rol localmente para crear borrador: plataforma, `admin`, `tenant_admin`, `operativo`. | Alinear con RBAC global `/api/ai` write y excluir aplicacion por `auditor`. | Bajo; endurece el handler si se usa fuera del mount normal. |
| `backend/src/routes/ai.routes.js` | El handler deriva tenant desde `tenant_controls`, valida tenant con JWT y valida alcance operativo activo. | Mantener multi-tenant y no aceptar tenant libre desde cliente. | Medio; controles fuera de alcance operativo ahora devuelven `AI_ACTION_DRAFT_OUT_OF_SCOPE` en vez de aplicar cambios. |
| `backend/src/routes/ai.routes.js` | Reemplaza updates sobre `tenant_nonconformities`, `tenant_controls` e `evidences` por insert/reuse en `action_plans`. | Evitar efectos reales automaticos de IA y crear un artefacto revisable. | Medio; consumidores que esperaban cierre automatico deben tratar el `action_plan_id`. |
| `backend/src/routes/ai.routes.js` | Inserta `action_plan_updates` inicial con usuario, tenant y comentario de origen IA. | Trazabilidad minima sin inventar infraestructura nueva. | Bajo; usa tabla existente. |
| `backend/src/routes/ai.routes.js` | Guarda metadata IA minima en `ai_source_label`, `ai_orchestration_json` y `ai_enhanced_answer_json`. | Preservar origen, accion, evidencia y revision humana requerida. | Bajo; columnas existen y tienen defaults jsonb. |
| `frontend/src/app/ia/page.tsx` | Cambia copy del banner a "La IA no aplica cambios directamente...". | Cumplir criterio de diseno seguro sin redisenar `/ia`. | Bajo; texto visible solamente. |
| `frontend/src/app/matriz-riesgo/page.tsx` | Cambia confirmacion, estado, error y exito de apply a creacion de borrador IA. | Consumidor runtime detectado de `PUT /api/ai/apply`; evita UX enganosa. | Bajo; mantiene endpoint y flujo de boton. |
| `docs/ai/ia3-replace-ai-apply-with-action-draft.md` | Documenta estrategia, evidencia, RBAC, tenant-scope, trazabilidad y decision IA.4. | Cerrar IA.3-C con evidencia auditable. | Bajo. |
| `docs/ai/ia3-validation-report.md` | Registra validaciones ejecutadas. | Evidencia de cierre. | Bajo. |
| `docs/cleanup/cleanup-debt-register-b8.md` | Actualiza B8-01 para reflejar que IA.3 reemplazo apply directo. | Mantener deuda vigente y no cerrar `/ia` prematuramente. | Bajo. |
| `docs/cleanup/post-cleanup-next-phases.md` | Actualiza Fase IA con siguiente paso IA.4. | Separar retiro de `/ia` de la mitigacion de apply. | Bajo. |
| `docs/product/official-frontend-surface.md` | Actualiza accion futura de `/ia` y nota de retenidas. | Reflejar que IA.3 preparo IA.4 sin archivar `/ia`. | Bajo. |
