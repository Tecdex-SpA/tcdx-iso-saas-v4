# UI-OPT-03 - Reporting, contraste y localizacion productiva

Fecha: 2026-09-02

Base verificada:

- Branch: `main`
- Base/HEAD: `5236f4904463d5b422a6167564ba35a2aab7483c`
- `origin/main`: `5236f4904463d5b422a6167564ba35a2aab7483c`
- Working tree inicial: limpio

## Alcance

UI-OPT-03 cierra sintomas post UI-OPT-01/UI-OPT-02 en frontend:

- Diseñador de reportes entendible para usuario funcional.
- Formula/codigos internos fuera del flujo principal de `/reportes/studio`.
- Contraste corregido en `/exportes` para `Lectura ejecutiva del sistema`.
- Contraste reforzado en `IA Auditor Senior`.
- Categorias/enums visibles localizados por `presentationLabels`.

No se modificaron backend, DB, migraciones, RBAC, autoridad comercial, Health/KPI, AI runtime ni tenant isolation.

## Archivos modificados

- `frontend/src/app/reportes/studio/page.tsx`
- `frontend/src/components/math-governance/ReportStudioWorkspace.tsx`
- `frontend/src/components/math-governance/OperationalBuilder.tsx`
- `frontend/src/components/intelligence/ExecutiveIntelligenceBrief.tsx`
- `frontend/src/components/reports/PremiumReportsPanel.tsx`
- `frontend/src/app/exportes/page.tsx`
- `frontend/src/components/auditorias/IaAuditorPanel.tsx`
- `frontend/src/utils/presentationLabels.ts`
- `docs/codex/CURRENT_STATE.md`
- `docs/codex/WORK_QUEUE.md`
- `docs/codex/handoffs/UI-OPT-03-REPORTING-CONTRAST-LOCALIZATION-CLOSEOUT.md`

## Report Studio

Contrato real confirmado:

- Entrada/catalogo: `GET /api/grc/official/analytics/catalog`
- Definicion: `POST /api/reports`
- Generacion: `POST /api/reports/:id/generate`
- Historial: `GET /api/report-generations`
- Descarga: `GET /api/report-generations/:id/download`
- Preview propio de definicion Studio: no implementado por backend.

Flujo visible:

1. Seleccionar contenido.
2. Configurar informe con nombre, tipo, formato y periodo.
3. Revisar configuracion.
4. Generar informe.
5. Ir al historial o descargar si existe salida.

El CTA `Generar informe` prepara la definicion si aun no existe y luego llama el endpoint real de generacion. La pantalla conserva `Revisar configuracion` como revision local, no como vista previa backend. La palabra `Vista previa` queda reservada para `/exportes`, donde existe `POST /api/reports/preview`.

Clasificacion de "formula publicada":

- `FRONTEND_ONLY_REQUIREMENT` para el usuario de Report Studio.
- El backend usa resultados oficiales y resuelve formula/corrida internamente cuando genera el reporte.
- El usuario ya no debe conocer `formula_code`, `source_contract`, `snapshot`, `binding`, `metric key` ni `formula version` para generar.
- Los codigos internos quedan solo como detalle tecnico colapsado o payload interno.

## Exportes premium

`/exportes` mantiene la diferencia de producto:

- `/reportes/studio`: construir, revisar, generar, consultar historial y descargar informes.
- `/exportes`: reportes premium con vista previa real, narrativa, fuentes y exportacion PDF/ZIP.

Cambios:

- `ExecutiveIntelligenceBrief` ahora acepta `surface="dark"`.
- `PremiumReportsPanel` usa la variante oscura para `Lectura ejecutiva del sistema`.
- Titulos, subtitulos, metadata y botones sobre fondo oscuro usan contraste alto (`slate-50`, `slate-100`, `slate-200/300`, blanco para accion secundaria).
- Textos de preview en `/exportes` se presentan como `vista previa`.

## IA Auditor Senior

Se reforzo contraste en las superficies oscuras de `IaAuditorPanel`:

- Titulo principal explicito en `text-slate-50`.
- Descripcion en `text-slate-100`.
- Callout consultivo en amber de alto contraste.
- `Modo seguro` y detalle de historial en tonos claros legibles.

No se modificaron API, prompts, AI engine, permisos, RBAC, runtime ni comportamiento funcional.

## Localizacion

`frontend/src/utils/presentationLabels.ts` se amplio para cubrir:

- `actions`, `remediation`, `coverage`, `audit-assurance`
- `health`, `risk`, `compliance`, `evidence`, `data`, `metrics`, `audit`
- `operational`, `executive`, `custom`
- `daily`, `weekly`, `monthly`, `on_demand`
- `higher_is_better`, `lower_is_better`
- `official_indicator`

`/exportes` usa `presentationLabel` como fallback para categorias si i18n no trae una clave especifica.

## Validacion

Validacion focal durante implementacion:

- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run lint`: PASS
- Busqueda focal en archivos tocados para enums/campos tecnicos reportados: PASS; los matches restantes son claves internas, payloads, detalle tecnico o copia inglesa bajo `locale === 'en'`.

Validacion final obligatoria:

- `git diff --check`: PASS
- `npm --prefix frontend run lint`: PASS
- `npm --prefix frontend run typecheck`: PASS
- `npm --prefix frontend run test:phase6-sidebar-rbac`: PASS
- `npm --prefix frontend run test:phase6-commercial-multitenant`: PASS
- `npm --prefix frontend run build`: PASS

No existe script focal de reportes en `frontend/package.json`.

Nota: Next agrego automaticamente `.next/dev/types/**/*.ts` a `frontend/tsconfig.json` durante `build`; se restauro solo esa modificacion generada.

## Regresiones protegidas

- `/grc-global` oculto de navegacion: preservado.
- Fuentes visibles de evidencias: Google Drive y Carga manual, preservado.
- `/datos = DataTraceabilityCenter`: preservado.
- AuditReadinessCard duplicado: no reintroducido.
- IA Compliance funcional: no tocado.
- ISO Health funcional: no tocado.
- Cumplimiento-Auditoria funcional: no tocado.
- Health authority canonica: no tocada.
- AI add-on authority: no tocada.

## Deuda

No queda deuda mayor dentro del alcance UI-OPT-03. La validacion humana debe confirmar visualmente en produccion/staging:

- `/reportes/studio`
- `/reportes/generaciones`
- `/exportes`
- `/ia-auditor`

Next gate: `HUMAN_REVIEW_THEN_COMMIT_PUSH_DEPLOY`.
