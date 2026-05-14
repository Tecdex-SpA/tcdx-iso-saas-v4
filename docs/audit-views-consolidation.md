# Consolidación de vistas de auditoría

## Mapa de vistas

| view | current route | current purpose | backend endpoints | reusable components | target tab | action |
| --- | --- | --- | --- | --- | --- | --- |
| Auditorías | `/auditorias` | Programa operativo de auditorías, ejecución, hallazgos, acciones y reportes | Rutas de auditorías existentes | `AuditProgramPanel` en `frontend/src/app/auditorias/page.tsx` | `programa` | Se mantiene como tab principal y ruta por defecto |
| IA Auditor | `/ia-auditor` | Análisis IA senior, historial, PDF y revisión humana | `backend/src/routes/ai-auditor.routes.js` | `frontend/src/components/auditorias/IaAuditorPanel.tsx` | `ia` | Se movió a `/auditorias?view=ia`; la ruta legacy redirige |
| Auditor ISO | `/auditor-iso` | Preauditoría ISO, preparación y foco de evidencia | `backend/src/routes/iso-auditor.routes.js` | `frontend/src/components/auditor-iso/IsoAuditorPreview.tsx` | `preauditoria` | Se monta en `/auditorias?view=preauditoria`; la ruta legacy redirige |
| Centro Control ISO | `/dashboard?view=iso` | Vista interna ISO del dashboard | Endpoints KPI/effective health existentes | Dashboard existente | No aplica | Se oculta como entrada separada del sidebar; sigue disponible dentro de `/dashboard` |

## Estructura final

- `/auditorias` abre `Programa de auditorías`.
- `/auditorias?view=programa` abre `Programa de auditorías`.
- `/auditorias?view=preauditoria` abre `Preauditoría ISO`.
- `/auditorias?view=ia` abre `IA Auditor Senior`.
- Valores inválidos de `view` caen de forma segura a `programa`.

## Navegación y rutas legacy

El sidebar expone una sola entrada del dominio de auditoría: `Auditorías`.

Las rutas legacy se conservan como wrappers mínimos para no romper URLs externas:

- `/ia-auditor` redirige a `/auditorias?view=ia`.
- `/auditor-iso` redirige a `/auditorias?view=preauditoria`.

Las páginas legacy ya no contienen la vista completa duplicada.

## RBAC

`/auditorias`, `/ia-auditor` y `/auditor-iso` quedan protegidas por el módulo `audits` en `AppLayout`. Los redirects legacy no abren una experiencia paralela ni relajan permisos.

## Post-deploy checks

1. Sidebar muestra solo `Auditorías` para el dominio de auditoría.
2. Sidebar no muestra `IA Auditor`.
3. Sidebar no muestra `Auditor ISO`.
4. Sidebar no muestra `Centro Control ISO`.
5. `/auditorias` abre `Programa de auditorías`.
6. `/auditorias?view=preauditoria` abre preauditoría ISO.
7. `/auditorias?view=ia` abre IA Auditor Senior.
8. `/ia-auditor` redirige a `/auditorias?view=ia`.
9. `/auditor-iso` redirige a `/auditorias?view=preauditoria`.
10. `/dashboard` sigue exponiendo Centro Control ISO como vista interna.
