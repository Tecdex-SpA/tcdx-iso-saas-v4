# BUGFIX-04R-05-06-07 Closeout

Fecha: 2026-09-03
Repo: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
Base commit: `caba0de53e832a4a2297a26e0d290e4d5280b91c`
Branch local: `main`
Commit/push/deploy: NO

## Preflight

- `git status --short`: clean al inicio.
- `git rev-parse HEAD`: `caba0de53e832a4a2297a26e0d290e4d5280b91c`.
- `git rev-parse origin/main`: `caba0de53e832a4a2297a26e0d290e4d5280b91c`.
- `git diff --check`: PASS al inicio.

## Autoridad focal de evidencia

- A) Documento: `document_index` representa documentos de Biblioteca; `evidences` representa evidencia formal subida/registrada.
- B) Evidencia formal: `evidences.status` y `evidences.validated` conservan la semántica de revisión/aprobación formal.
- C) Link a control: `tenant_document_object_links` con `target_type='control'`, `target_id=tenant_controls.id`.
- D) Link a plan: `tenant_document_object_links` con `target_type='action'`, `target_id=action_plans.id`.
- E) `evidence_usage`: Workbench de controles cuenta usos de evidencia primaria/soporte/remediación; planes cuentan evidencia de acción/remediación/soporte/primaria.
- F) Active/inactive: sólo cuentan asociaciones `is_active=true`, `status='active'` y `relation_type='associated'`; `reference`, inactivas o no asociadas quedan excluidas.
- G) Revisión/aprobación: links a `source_type='evidence'` reutilizan el estado formal; links a `source_type='document_index'` prueban presencia y quedan pendientes si no existe aprobación formal.
- H) Consulta Workbench: `backend/src/routes/controls.routes.js` combina `tenant_document_object_links`, `evidences` y `v_iso_control_effective_health`.
- I) Health/evidence quality: `v_iso_control_effective_health` sigue siendo autoridad efectiva de Health/calidad; no se modificaron fórmulas.
- J) Consulta Plan: `backend/src/routes/action-plans.routes.js` alimenta aprobadas, pendientes, última evidencia y detalle.

## BUG-04R

Root cause: el frontend de Workbench usaba cualquier Health no saludable como si siempre fuera falta/refuerzo de evidencia. Por eso un control con evidencia aprobada podía mostrar `Atención` junto con un mensaje que atribuía el problema a evidencia.

Solución: `frontend/src/app/controles/page.tsx` ahora separa causa de mensaje:

- sin evidencia o `sin_evidencia`: pide evidencia trazable;
- evidencia pendiente: pide revisión;
- evidencia rechazada: pide corrección/reemplazo;
- Health efectivo no saludable con evidencia existente: pide revisar Health efectivo, hallazgos, no conformidades, planes o trazabilidad oficial.

Health score, Health status y fórmulas no fueron modificados.

## BUG-05

Root cause: algunos `req.file.originalname` llegaban desde multipart/multer como UTF-8 interpretado como latin1 antes de `safeUploadFileName`, por lo que el nombre ya entraba con mojibake.

Solución: `backend/src/services/evidenceLibrary.service.js` agrega reparación defensiva sólo cuando el nombre contiene marcadores de mojibake y la conversión latin1->utf8 mejora objetivamente el score sin generar `U+FFFD`. `safeUploadFileName` mantiene `path.basename`, remoción de control chars/comillas, safelist Unicode y límite de longitud.

Casos focales preservados:

- `DEMO — Verificación de eficacia AC-2026-014.pdf`
- `TECDEX - Políticas de Privacidad y Consentimiento.docx`
- `evidence-simple.pdf`

## BUG-06

Root cause: `/hallazgos` posteaba feedback IA a `${apiBase}/ai-feedback`, mientras el backend público real está montado en `/api/ai-feedback`.

Solución: `frontend/src/app/hallazgos/page.tsx` alinea el frontend con el endpoint existente `POST /api/ai-feedback`. No se creó endpoint duplicado y no se tocaron generación, prompts, modelo, AI add-on, permisos ni runtime IA.

Contrato real: `POST /api/ai-feedback` con payload de feedback IA y autenticación existente.

## BUG-07

Root cause: la consulta enriquecida de Planes de Acción sólo contaba `evidences` enlazadas por metadata/control y omitía asociaciones válidas de Biblioteca en `tenant_document_object_links` con `target_type='action'`.

Solución: `backend/src/routes/action-plans.routes.js` deduplica una proyección común de evidencia formal y links documentales activos para alimentar `evidence_count`, `approved_evidence_count`, `pending_evidence_count`, `latest_evidence_at`, `latest_evidence_status` y `evidences_json`. No crea segunda asociación, no copia documento y no inventa aprobación.

## Archivos

- `backend/src/routes/action-plans.routes.js`
- `backend/src/services/evidenceLibrary.service.js`
- `frontend/src/app/controles/page.tsx`
- `frontend/src/app/hallazgos/page.tsx`
- `frontend/src/i18n/dictionaries/en.json`
- `frontend/src/i18n/dictionaries/es.json`
- `frontend/src/i18n/statusLabels.ts`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/BUGFIX-04R-05-06-07-CLOSEOUT.md`

## Validación

- `node -c backend/src/routes/action-plans.routes.js`: PASS.
- `node -c backend/src/services/evidenceLibrary.service.js`: PASS.
- `npm --prefix backend run check`: PASS.
- `npm --prefix frontend run typecheck`: PASS con ejecución escalada por `EPERM` del sandbox al escribir `frontend/tsconfig.tsbuildinfo`.
- `npm --prefix frontend run lint`: PASS.
- `npm --prefix frontend run test:phase6-sidebar-rbac`: PASS.
- `npm --prefix frontend run test:phase6-commercial-multitenant`: PASS.
- `git diff --check`: PASS.
- `npm --prefix frontend run build`: PASS con ejecución escalada por `EPERM` del sandbox al escribir `frontend/.next/trace`.
- Test focal de filenames Unicode/ASCII/mojibake simulado: PASS.

`frontend/tsconfig.json` fue restaurado tras el ajuste automático de Next.

## Autoridades protegidas

- Database modificada: NO.
- Migraciones modificadas: NO.
- RBAC/roles/permisos modificados: NO.
- Autoridad comercial/subscriptions modificada: NO.
- Health formulas modificadas: NO.
- AI add-on authority/runtime modificados: NO.
- Lógica tenant-specific: NO.
- Hardcode por tenant/control/action_plan/finding/document/UUID/filename: NO.

## Runtime

`RUNTIME_VALIDATION=DEFERRED_TO_POSTDEPLOY_HUMAN_REVIEW`

Next gate: `HUMAN_REVIEW -> COMMIT -> PUSH -> OFFICIAL_DEPLOY -> POSTDEPLOY_RUNTIME_VALIDATION`.
