# Legacy redirect references B.3

Fecha: 2026-06-12
Rama: `chore/cleanup-b3-decouple-legacy-redirects`

Se ejecuto `rg` para las cuatro rutas legacy en `frontend`, `backend`, `docs` y `scripts`, excluyendo dependencias y `.next`. La tabla distingue referencias de navegacion viva de referencias historicas, de cleanup o de nombres de componentes.

| Ruta legacy | Archivo | Linea/contexto | Tipo referencia | Acción B.3 | Reemplazo | Motivo |
| ----------- | ------- | -------------- | --------------- | ---------- | --------- | ------ |
| `/dashboard-kpi` | `frontend/src/app/dashboard-kpi/page.tsx` | Pagina redirect a dashboard KPI. | frontend_redirect_page | conservar hasta B.4 | `/dashboard` | B.3 no mueve paginas. |
| `/dashboard-kpi` | `scripts/qa-bilingual-full.sh` | Lista de rutas HTTP frontend. | qa_script | actualizada | `/dashboard` | `/dashboard` ya cubre la superficie cliente KPI. |
| `/dashboard-kpi` | `scripts/qa-i18n-db-display.sh` | Archivo incluido en cobertura visual i18n. | qa_script | actualizada | `frontend/src/app/dashboard/page.tsx` | El dashboard oficial reemplaza la pagina redirect sin contenido i18n propio. |
| `/dashboard-kpi` | `docs/demo/official-demo-routes.md` | Alias de demo. | documentation_demo | retirada referencia legacy | `/dashboard` | La demo oficial no debe contratar el alias. |
| `/dashboard-kpi` | `docs/qa-effective-health-sources.md` | Fuente QA de vistas KPI. | documentation_demo | retirada referencia legacy | `/dashboard` | QA actual debe probar la superficie consolidada. |
| `/dashboard-kpi` | `docs/FASE_*.md`, `docs/sprint-0/**`, `docs/sprint-1/route-view-map.md` | Implementacion e inventarios anteriores. | documentation_historical | conservada | N/A | Trazabilidad historica; no es contrato vivo. |
| `/dashboard-kpi` | `docs/product/official-frontend-surface.md`, `docs/cleanup/**`, ADR | Manifest y decisiones cleanup. | manifest_cleanup | actualizada/conservada | `/dashboard` | Debe seguir identificando la ruta hasta B.4. |
| `/dashboard-kpi` | `frontend/src/utils/mvpPermissions.ts`, `scripts/qa/qa-official-surface.sh` | Hidden route y guard de retiro. | manifest_cleanup | conservada | N/A | Control necesario mientras la pagina exista y durante B.4. |
| `/centro-control-iso` | `frontend/src/app/centro-control-iso/page.tsx` | Pagina redirect a dashboard ISO. | frontend_redirect_page | conservar hasta B.4 | `/dashboard` | B.3 no mueve paginas. |
| `/centro-control-iso` | `scripts/validate-iso-unified-command-center.sh` | Check HTTP frontend. | qa_script | actualizada | `/dashboard` | El validador conserva endpoints command center y usa la entrada frontend oficial. |
| `/centro-control-iso` | `docs/demo/official-demo-routes.md`, `docs/qa-effective-health-sources.md` | Demo y QA vigentes. | documentation_demo | retirada referencia legacy | `/dashboard` | Ya no es contrato demo/QA. |
| `/centro-control-iso` | `docs/FASE_*.md`, `docs/sprint-0/**`, `docs/sprint-1/route-view-map.md` | Implementacion e inventarios anteriores. | documentation_historical | conservada | N/A | Trazabilidad historica. |
| `/centro-control-iso` | `frontend/src/components/**`, `frontend/src/app/auditorias/page.tsx` | Nombre de carpeta/import de componentes reutilizados. | unknown_requires_review | conservada | N/A | No es URL/deep link; renombrar componentes queda fuera de B.3. |
| `/centro-control-iso` | `docs/product/official-frontend-surface.md`, `docs/cleanup/**`, ADR, `mvpPermissions.ts`, guard | Manifest y control legacy. | manifest_cleanup | actualizada/conservada | `/dashboard` | Control necesario hasta B.4. |
| `/command-center-iso` | `frontend/src/app/command-center-iso/page.tsx` | Pagina redirect a dashboard ISO. | frontend_redirect_page | conservar hasta B.4 | `/dashboard` | B.3 no mueve paginas. |
| `/command-center-iso` | `scripts/validate-iso-command-center.sh` | Check HTTP frontend. | qa_script | actualizada | `/dashboard` | Los endpoints command center siguen validados; cambia solo la entrada frontend. |
| `/command-center-iso` | `docs/demo/official-demo-routes.md`, `docs/qa-effective-health-sources.md` | Demo y QA vigentes. | documentation_demo | retirada referencia legacy | `/dashboard` | Ya no es contrato demo/QA. |
| `/command-center-iso` | `docs/FASE_*.md`, `docs/sprint-0/**`, `docs/sprint-1/route-view-map.md` | Implementacion e inventarios anteriores. | documentation_historical | conservada | N/A | Trazabilidad historica. |
| `/command-center-iso` | `frontend/src/components/**` | Nombre de carpeta/import de componentes reutilizados. | unknown_requires_review | conservada | N/A | No es URL/deep link; renombrar componentes queda fuera de B.3. |
| `/command-center-iso` | `docs/product/official-frontend-surface.md`, `docs/cleanup/**`, ADR, `mvpPermissions.ts`, guard | Manifest y control legacy. | manifest_cleanup | actualizada/conservada | `/dashboard` | Control necesario hasta B.4. |
| `/auditor-iso` | `frontend/src/app/auditor-iso/page.tsx` | Wrapper redirect a vista de preauditoria. | frontend_redirect_page | conservar hasta B.4 | `/cumplimiento-auditoria` | B.3 no mueve paginas; destino oficial cliente es el agregador. |
| `/auditor-iso` | `backend/src/services/isoCommandCenter.service.js` | Quick link `Auditor ISO`. | backend_deeplink | actualizada | `/cumplimiento-auditoria` | Es solo un enlace recomendado; no cambia scoring, IA, permisos ni DB. |
| `/auditor-iso` | `scripts/validate-iso-auditor.sh` | Check HTTP frontend posterior a validacion API. | qa_script | actualizada | `/cumplimiento-auditoria` | Mantiene la validacion API y prueba la entrada cliente oficial. |
| `/auditor-iso` | `docs/demo/official-demo-routes.md` | Ruta interna/beta. | documentation_demo | retirada referencia legacy | `/cumplimiento-auditoria` | La demo cliente usa el agregador oficial. |
| `/auditor-iso` | `docs/audit-views-consolidation.md`, `docs/FASE_*.md`, `docs/sprint-0/**`, `docs/sprint-1/route-view-map.md` | Historia de consolidacion. | documentation_historical | nota B.3 agregada / conservada | `/cumplimiento-auditoria` | Conserva trazabilidad sin autorizar nuevos enlaces. |
| `/auditor-iso` | `frontend/src/components/**`, `frontend/src/app/auditorias/page.tsx` | Nombre de carpeta/import de componente reutilizado. | unknown_requires_review | conservada | N/A | No es URL/deep link; renombrar componentes queda fuera de B.3. |
| `/auditor-iso` | `docs/product/official-frontend-surface.md`, `docs/cleanup/**`, ADR, `mvpPermissions.ts`, guard | Manifest y control legacy. | manifest_cleanup | actualizada/conservada | `/cumplimiento-auditoria` | Control necesario hasta B.4. |

## Resultado

No quedan referencias de navegacion viva en los archivos QA, backend deep link, demo o QA documental controlados por B.3. Las cuatro paginas redirect quedan listas para cuarentena fuera del App Router en B.4.
