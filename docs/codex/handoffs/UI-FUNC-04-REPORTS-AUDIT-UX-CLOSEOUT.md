# UI-FUNC-04 — Reports + Audit UX Closeout

Fecha: 2026-09-02
Base commit: `adc92877a5ecc5b5a84f29396ec60a218c6f4541`
Estado: `READY_FOR_HUMAN_REVIEW`

## Alcance Cerrado

- Report Studio: root cause productivo confirmado previamente en `POST /api/reports/`: `SQLSTATE=23514`, constraint `report_definitions_report_type_check`, por `report_type` frontend fuera del CHECK real. Se alinearon valores permitidos y CTAs; no se declara runtime postdeploy PASS.
- Informes generados: `/reportes/generaciones` queda como pantalla específica `Informes generados` con fuentes reales `/api/report-generations` y `/api/reports`, descarga por `/api/report-generations/:id/download`.
- Descargas de reporte: backend evita exponer tenant UUID, generation ID, snapshot IDs y formula/run IDs como contenido visible para cliente; trazabilidad permanece en BD.
- Auditorías: `/auditorias/ejecucion` y `GrcPhase1Panel` usan selector real de auditorías por tenant desde `/api/audits/{tenantId}`; UUID queda interno y no hay input libre de ID de auditoría en el flujo normal.
- Contraste: `ExecutiveIntelligenceBrief` e `IaAuditorPanel` ajustados para alto contraste en superficies oscuras.
- Localización focal: categorías y estados visibles pasan por `presentationLabel`/diccionarios focales.

## Validación Local

- `git diff --check`: PASS
- `node --check backend/src/services/phase5/phase5.service.js`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run lint`: PASS
- `npm --prefix frontend run test:phase6-sidebar-rbac`: PASS
- `npm --prefix frontend run test:phase6-commercial-multitenant`: PASS
- `npm --prefix frontend run build`: PASS

## Deuda / Gate Siguiente

- `FOCAL_RUNTIME_E2E=DEFERRED_TO_HUMAN_POSTDEPLOY`
- Sin cambios de BD, migraciones, RBAC, autoridad comercial, Health formulas ni AI runtime.
- Siguiente gate: revisión humana, commit/push/deploy y validación runtime postdeploy por el usuario.
