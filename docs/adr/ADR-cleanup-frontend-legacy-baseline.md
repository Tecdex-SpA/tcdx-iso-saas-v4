# ADR: Baseline final de cleanup frontend y legacy

Estado: Aceptado

Fecha: 2026-06-12

## Contexto

El repositorio acumulaba rutas frontend duplicadas, redirects historicos,
superficies enterprise mezcladas con el MVP y artefactos que dificultaban
identificar la navegacion oficial. Las etapas 1 a B.7 inventariaron, ocultaron,
desacoplaron y archivaron candidatos sin alterar el flujo core de compliance,
RBAC ni separacion multi-tenant.

## Decision

Se adopta como baseline oficial la superficie cliente MVP de diez rutas. Los
cuatro redirects desacoplados permanecen archivados fuera del App Router y de
`frontend/src`. Las cuatro rutas con dependencias o valor funcional pendiente
se mantienen activas, ocultas para cliente MVP y sujetas a fases separadas.

El control automatizado oficial es
`scripts/qa/qa-official-surface.sh`. El build esperado del baseline es de 42
paginas.

## Resultado

- La navegacion cliente queda limitada a la superficie MVP aprobada.
- Cuatro redirects legacy dejaron de generar rutas Next.
- Las rutas retenidas tienen estado y condicion de salida explicitos.
- El archivo historico conserva rollback trazable.
- La deuda no resuelta queda separada del cleanup general.

## Rutas MVP oficiales

```text
/dashboard
/cumplimiento-auditoria
/evidencias
/riesgos
/planes-accion
/exportes
/ia-compliance
/configuracion
/perfil-empresa
/usuarios
```

`/perfil-empresa` y `/usuarios` pertenecen al MVP bajo Configuracion aunque no
sean items principales del Sidebar.

## Rutas archivadas

```text
/dashboard-kpi
/centro-control-iso
/command-center-iso
/auditor-iso
```

Ubicacion de retencion:

```text
frontend/legacy-pages-archive/
```

No forman parte del App Router ni de `frontend/src`.

## Rutas retenidas por decision

| Ruta | Estado | Motivo |
| ---- | ------ | ------ |
| `/dashboard-v2` | `kept_temporarily_qa_demo_dependency` | Validadores y documentacion QA/demo mantienen la compatibilidad URL. |
| `/ia` | `blocked_pending_mvp_merge` | Conserva recomendaciones no demostradas en `/ia-compliance`. |
| `/ejecucion-iso` | `kept_enterprise_post_mvp` | Flujo enterprise con generacion y aprobacion humana. |
| `/documentos` | `blocked_by_backend_contract_review` | Mantiene deep links y contratos de generacion documental. |

## Deuda remanente

- Fusion funcional de `/ia` con `/ia-compliance`.
- Revision de `/documentos`, document integrations y deep links.
- Desacople de validadores/documentacion que mantienen `/dashboard-v2`.
- Decision de producto para acceso enterprise a `/ejecucion-iso`.
- Revision separada de rutas backend duplicadas/no montadas, SQL, scripts e
  integraciones de seguridad.
- Reduccion de warnings frontend.

## Riesgos aceptados

- Enlaces externos antiguos hacia rutas archivadas pueden responder 404.
- `frontend/legacy-pages-archive` sigue versionado como retencion historica.
- `/ia` sigue activa hasta una fase especifica de fusion IA.
- `/documentos` sigue activa hasta revisar el contrato backend e integraciones.
- `/dashboard-v2` sigue activa por QA/demo vigente.
- `/ejecucion-iso` sigue activa como enterprise/post-MVP.
- Persisten 636 warnings frontend preexistentes.
- `env-check.sh` mantiene WARN local por variables no cargadas, con 0 FAIL.

## Consecuencias

- Cualquier alta o retiro de una ruta MVP debe actualizar el manifest de
  producto y el guard oficial en el mismo cambio.
- Las rutas archivadas no deben volver a `frontend/src/app` sin una decision
  explicita y validacion completa.
- Las rutas retenidas no se consideran aprobadas para navegacion cliente MVP.
- Los siguientes trabajos deben ejecutarse por frente, con alcance y pruebas
  propios, no como una continuacion generica de cleanup.

## Rollback general

La documentacion B.8 puede revertirse con `git revert` sobre su commit. Para
restaurar redirects archivados se debe seguir el rollback documentado en B.5,
moviendo cada carpeta desde `frontend/legacy-pages-archive` hacia
`frontend/src/app`, restaurando sus reglas y ejecutando guard, lint, build y
TypeScript.
