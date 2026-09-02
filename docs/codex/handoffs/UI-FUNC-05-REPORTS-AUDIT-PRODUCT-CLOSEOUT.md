# UI-FUNC-05 — Reports + Audit Product Closeout

Fecha: 2026-09-02
Base commit: `274278f62b78c64c1f8ea3ce00983bb3c4bbd61b`
Estado: `READY_FOR_HUMAN_REVIEW`

## Alcance cerrado

- Report Studio: se retiró el listado primario de definiciones desde `Phase5Workspace` en `/reportes/studio`; la vista queda centrada en el flujo guiado. Las configuraciones guardadas se muestran como configuraciones, sin `REPORT ...`, lineage, impacto ni confianza técnica en el flujo primario.
- Generación real: el estado de éxito se toma desde `generation.status === generated` y sólo se habilita descarga/ver informe generado cuando existe generación real descargable desde `/api/report-generations/:id/download`.
- Informes generados: `/reportes/generaciones` ya no monta un `AppLayout` interior bajo `frontend/src/app/reportes/layout.tsx`; consume `/api/report-generations` como fuente primaria y usa `/api/reports` sólo para nombres/contenido visibles.
- Auditoría operacional: `/auditorias/ejecucion` conserva selector de auditorías reales y agrega secuencia comprensible de 8 pasos con estados derivados del audit/checklist existente, sin input libre de ID técnico.
- PDF de auditoría: se agregó `GET /api/audits/generated-report/:id`, read-only y tenant-authorized, que genera PDF al vuelo con empresa, norma, periodo, estado, equipo auditor, checklist, hallazgos y acciones reales cuando existen. No reemplaza la descarga existente de informe subido `/api/audits/report/:id`.
- IA Auditor Senior: root cause de contraste cerrado por cascade global `.tcdx-premium-view h1/h2/...`; se añadió alcance `.ia-auditor-dark-surface` con override local para título, subtítulo, Modo seguro y bloque consultivo en superficie oscura.

## Archivos cambiados

- `backend/src/routes/audits.routes.js`
- `frontend/src/app/reportes/studio/page.tsx`
- `frontend/src/app/reportes/generaciones/page.tsx`
- `frontend/src/components/math-governance/OperationalBuilder.tsx`
- `frontend/src/app/auditorias/ejecucion/page.tsx`
- `frontend/src/components/auditorias/IaAuditorPanel.tsx`
- `frontend/src/app/globals.css`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/CONTRACTS_REGISTRY.md`
- `docs/codex/handoffs/UI-FUNC-05-REPORTS-AUDIT-PRODUCT-CLOSEOUT.md`

## Contratos

- Nuevo endpoint focal read-only: `GET /api/audits/generated-report/:id`.
- Autoridad preservada: auth/RBAC existente de `audits.routes.js`, `ensureTenantAccess`, datos `audits`, `tenants`, `audit_control_reviews`, `findings`, `action_plans`.
- Sin cambios en contratos de Report Studio, generaciones, descarga de artefactos, comercial, RBAC, Health ni runtime IA.

## Validación local

- `git diff --check`: PASS
- `node --check backend/src/services/phase5/phase5.service.js`: PASS
- `node --check backend/src/routes/audits.routes.js`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run lint`: PASS
- `npm --prefix frontend run test:phase6-sidebar-rbac`: PASS
- `npm --prefix frontend run test:phase6-commercial-multitenant`: PASS
- `npm --prefix frontend run build`: PASS

`frontend/tsconfig.json` fue restaurado tras la modificación automática de Next.

## Runtime

- `FOCAL_RUNTIME_E2E=DEFERRED_TO_HUMAN_POSTDEPLOY`.
- No se ejecutaron mutaciones productivas desde Codex.

## Do not rediscover

- UI-FUNC-04 ya corrigió el `report_type` CHECK y selector real de auditorías.
- `/reportes/generaciones` debe seguir mostrando sólo generaciones reales, no definiciones.
- El PDF operacional generado es una salida read-only al vuelo; el archivo subido existente sigue disponible por `/api/audits/report/:id`.
- El contraste de IA Auditor Senior depende de la cascada `.tcdx-premium-view`, no de repetir `text-white` en el `h1`.

## Gates

- `DATABASE_MODIFIED=NO`
- `MIGRATIONS_MODIFIED=NO`
- `RBAC_MODIFIED=NO`
- `COMMERCIAL_AUTHORITY_MODIFIED=NO`
- `HEALTH_FORMULAS_MODIFIED=NO`
- `AI_RUNTIME_MODIFIED=NO`
- `TENANT_SPECIFIC_LOGIC=NO`
- `COMMIT=NO`
- `PUSH=NO`
- `DEPLOY=NO`

Siguiente acción: revisión humana, commit/push/deploy manual y validación runtime focal de Report Studio, Informes generados, ejecución auditoría/PDF e IA Auditor Senior.
