# IA.3-C - Reemplazo de apply IA directo por borrador revisable

Fecha: 2026-06-15
Rama: `chore/ia3-replace-ai-apply-with-action-draft`
Base local: `main` con B.8 (`05de4d4`) e IA.2 (`cfb9ec2`) integrados.

## 1. Objetivo

Reemplazar el flujo legacy `PUT /api/ai/apply/:tenant_control_id` para que una
recomendacion IA no marque controles como cumplidos, no resuelva no
conformidades y no cree evidencias automaticamente. El flujo seguro para MVP
queda:

`Recomendacion IA -> Borrador de plan de accion -> Revision humana -> Seguimiento normal`

## 2. Problema detectado en IA.2

IA.2 clasifico `PUT /api/ai/apply/:tenant_control_id` como
`requires_replacement_by_action_plan_draft_flow` porque el handler legacy:

| Efecto anterior | Riesgo |
|---|---|
| Actualizaba `tenant_controls.status = 'cumple'` | Cerraba cumplimiento sin revision humana. |
| Marcaba `tenant_nonconformities.status = 'resuelta'` | Cerraba NC sin aprobacion ni evidencia revisada. |
| Insertaba una fila en `evidences` | Creaba evidencia automatica con descripcion fija. |
| Devolvia `{ success: true }` | No informaba trazabilidad ni plan revisable. |

## 3. Consumidores detectados

Busqueda ejecutada:

| Busqueda | Resultado |
|---|---|
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "api/ai/apply" -n frontend backend docs scripts` | Consumidor runtime: `frontend/src/app/matriz-riesgo/page.tsx`. Referencias documentales en Sprint 0, cleanup e IA.2. |
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "apply/:tenant_control_id" -n backend frontend docs scripts` | Definicion runtime: `backend/src/routes/ai.routes.js`. Referencias documentales. |
| `grep -R --exclude-dir=node_modules --exclude-dir=.next "auditor_explicacion" -n backend frontend docs scripts` | Campo runtime solo en `backend/src/routes/ai.routes.js`; referencias IA.2. |

Resultado funcional:

| Consumidor | Estado IA.3 |
|---|---|
| `/ia` (`frontend/src/app/ia/page.tsx`) | No llama `PUT /api/ai/apply`; solo consume recomendaciones. Se actualizo copy para declarar que IA no aplica cambios directamente. |
| `/matriz-riesgo` (`frontend/src/app/matriz-riesgo/page.tsx`) | Si llamaba `PUT /api/ai/apply`. Se ajusto el texto de confirmacion, progreso, boton y exito a "Crear borrador IA". |

## 4. Estrategia elegida

Estrategia elegida: **B - Reemplazar PUT apply por creacion de borrador de plan de accion**.

Motivo:

- `action_plans` ya permite `source_type = 'ia'`.
- `action_plans` ya tiene `tenant_control_id`, `source_id`, `created_by`,
  `status`, `priority`, `approval_status`, `ai_source_label`,
  `ai_orchestration_json` y `ai_enhanced_answer_json`.
- `action_plan_updates` ya registra comentario inicial, usuario, tenant y
  estado.
- No se requieren migraciones ni cambios de modelo de datos.

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/src/routes/ai.routes.js` | `PUT /apply/:tenant_control_id` deja de modificar controles, NCs y evidencias; crea o reutiliza un borrador de plan de accion. |
| `frontend/src/app/ia/page.tsx` | Copy explicito: la IA no aplica cambios directamente y genera borrador revisable. |
| `frontend/src/app/matriz-riesgo/page.tsx` | Consumidor vivo actualizado para "Crear borrador IA" en vez de "aplicar accion IA". |

## 6. Endpoint antes/despues

| Aspecto | Antes | Despues IA.3 |
|---|---|---|
| Metodo/ruta | `PUT /api/ai/apply/:tenant_control_id` | Igual por compatibilidad. |
| Efecto principal | Aplicaba correccion IA sobre control. | Crea o reutiliza borrador en `action_plans`. |
| Control | `tenant_controls.status = 'cumple'` | No modifica `tenant_controls`. |
| No conformidad | Marcaba primera NC abierta como `resuelta`. | No modifica `tenant_nonconformities`. |
| Evidencia | Insertaba evidencia automatica. | No inserta evidencia. |
| Respuesta | `{ success: true }` | `success`, `code`, `message`, `direct_apply_disabled`, `action_plan_id`, `tenant_control_id`, `tenant_id`, `status`, `reused`. |
| Compatibilidad | Cliente esperaba exito simple. | Mantiene `success: true` y agrega datos del borrador. |

Codigos nuevos:

| Codigo | Significado |
|---|---|
| `AI_ACTION_DRAFT_CREATED` | Se creo un nuevo borrador revisable de plan de accion. |
| `AI_ACTION_DRAFT_REUSED` | Ya existia un borrador IA abierto/en progreso/bloqueado para ese control y se reutilizo. |
| `AI_ACTION_DRAFT_FORBIDDEN` | Rol sin permiso para crear borrador desde IA. |
| `AI_ACTION_DRAFT_OUT_OF_SCOPE` | Control fuera del alcance operativo activo requerido por planes de accion. |

## 7. Comportamiento frontend antes/despues

| Superficie | Antes | Despues IA.3 |
|---|---|---|
| `/ia` | Mostraba recomendaciones y decia revision no destructiva. | Mantiene layout; declara que IA no aplica cambios directamente y genera borrador revisable. |
| `/matriz-riesgo` | Confirmaba "aplicar correccion IA" y mostraba "Aplicando...". | Confirma creacion de borrador; boton "Crear borrador IA"; exito muestra `action_plan_id` si backend lo devuelve. |

## 8. RBAC

El endpoint conserva las capas existentes:

- `auth` local en `ai.routes.js`;
- `app.use('/api', auth, enforceApiAccess)` en `backend/src/app.js`;
- regla RBAC global `/api/ai` con escritura para `admin`, `tenant_admin` y
  `operativo`;
- validacion local adicional `canCreateAiActionDraft`, que permite roles
  plataforma y `admin`, `tenant_admin`, `operativo`.

`auditor` conserva lectura de recomendaciones por RBAC global, pero no puede
crear borrador via `PUT /api/ai/apply`.

## 9. Tenant-scope

Tenant source del `PUT`:

1. El cliente envia solo `tenant_control_id` por path.
2. El backend busca `tenant_controls` y deriva `control.tenant_id`.
3. `ensureTenantAccess` valida tenant del JWT contra `control.tenant_id`, salvo
   roles plataforma.
4. `enforceTenantRequestScope` sigue activo para `/api`.
5. El borrador inserta `tenant_id` derivado del control, no desde body libre.

Ademas se valida que la norma/control pertenezcan al alcance operativo activo
mediante `tenant_standard_operations` y `tenant_operations`, siguiendo la
expectativa del modulo de planes de accion.

## 10. Trazabilidad

| Trazabilidad | Estado IA.3 |
|---|---|
| Usuario que solicita | `action_plans.created_by` y `action_plan_updates.created_by`. |
| Tenant | `action_plans.tenant_id` y `action_plan_updates.tenant_id`. |
| Control asociado | `action_plans.tenant_control_id` y `source_id`. |
| Accion sugerida | Incluida en `description` y `ai_enhanced_answer_json.action`. |
| Evidencia sugerida | Incluida en `description` y `ai_enhanced_answer_json.evidence`. |
| Fuente IA legacy | `source_type = 'ia'`, `ai_source_label = 'legacy_ai_recommendations'`, `ai_orchestration_json.origin = 'legacy_ai_apply_replacement'`. |
| Estado inicial del plan | `status = 'abierto'`, `approval_status = 'no_requerida'`. |
| Revision humana requerida | Mensaje visible y `ai_enhanced_answer_json.human_review_required = true`. |

Brecha remanente: el flujo legacy aun no registra `ai_prompt_logs` ni
`ai_core.ai_response_traces`. IA.3 evita efectos directos y deja trazabilidad
minima en planes, pero no convierte el endpoint en IA Compliance trazable plena.

## 11. Riesgos remanentes

| Riesgo | Estado | Mitigacion |
|---|---|---|
| `/ia` conserva contrato read desalineado | Pendiente | IA.4 debe decidir archivo o migracion de lectura a `/ia-compliance/sugerencias`. |
| `PUT /api/ai/apply` conserva nombre legacy | Aceptado temporalmente | Compatibilidad con consumidor existente; respuesta declara `direct_apply_disabled`. |
| Trazabilidad IA no plena | Pendiente | IA.4/IA posterior debe migrar a `ai_suggestions`/traces si se conserva valor. |
| Duplicados de borrador | Mitigado | Se reutiliza un borrador IA abierto/en progreso/bloqueado por control. |
| Consumidores documentales antiguos | Pendiente | Referencias Sprint 0 quedan historicas; no son runtime. |

## 12. Decision para IA.4

Recomendacion unica: **IA.4-B - Migrar lectura de recomendaciones a `/ia-compliance/sugerencias`**.

Motivo:

- IA.3 ya elimina la aplicacion directa automatica.
- El valor util que queda en `/ia` es lectura por control: accion, evidencia,
  prioridad y explicacion auditor.
- Ese valor encaja mejor como sugerencia revisable en la bandeja moderna, no
  como superficie legacy separada.
- Despues de migrar o descartar esa lectura, una fase posterior podra archivar
  `/ia` con menor riesgo.

## 13. Bloqueo remoto

Se intento `git pull --ff-only origin main` desde `main`; fallo por
`Permission denied (publickey)` tanto en ejecucion normal como escalada. Se
trabajo desde `main` local porque la evidencia local muestra el merge de IA.2
(`c139bf4`) y contiene B.8 (`05de4d4`) e IA.2 (`cfb9ec2`).
