# Docs quarantine B.1

Fecha: 2026-06-12
Rama: `chore/cleanup-b1-legacy-quarantine`

Dependency scan ejecutado por nombre de documento. No se movieron documentos en B.1 porque `docs/docs-index.md` esta protegido por alcance y varios movimientos requeririan actualizarlo para no dejar patrones/rutas obsoletas.

| Documento | Clasificacion previa | Referencias encontradas | Accion | Motivo | Rollback |
| --------- | -------------------- | ----------------------- | ------ | ------ | -------- |
| `docs/FASE_1_10_COMMAND_CENTER_ISO.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Mover FASE requiere actualizar indice documental protegido. | No aplica. |
| `docs/FASE_1_11_1_13_CONSOLIDACION_OPERATIVA_ISO.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Mover FASE requiere actualizar indice documental protegido. | No aplica. |
| `docs/FASE_1_14_DASHBOARD_CONSOLIDADO_PARIDAD_FUNCIONAL.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto dashboard todavia util para B.2 merge/delete. | No aplica. |
| `docs/FASE_1_14A_DASHBOARD_V2_BASE.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto dashboard v2 todavia util para B.2. | No aplica. |
| `docs/FASE_1_14B_DASHBOARD_V2_SALUD_CICLO.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto dashboard v2 todavia util para B.2. | No aplica. |
| `docs/FASE_1_14C_DASHBOARD_V2_OPERACION.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto dashboard v2 todavia util para B.2. | No aplica. |
| `docs/FASE_1_14D_DASHBOARD_V2_PERSONALIZACION.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene preferencias dashboard v2; requiere decision antes de mover. | No aplica. |
| `docs/FASE_1_14E1_DASHBOARD_VISUAL_KPI_SALUD.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto de migracion KPI a dashboard. | No aplica. |
| `docs/FASE_1_14E2_DASHBOARD_OPERATIVO_PERSONALIZABLE.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Contiene contexto de dashboard operativo. | No aplica. |
| `docs/FASE_1_8_FRONTEND_ACCIONES_RECOMENDADAS_ISO.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Mover FASE requiere actualizar indice documental protegido. | No aplica. |
| `docs/FASE_1_9_CONVERSION_ACCIONES_RECOMENDADAS_ISO.md` | legacy_do_not_use_for_coding / historico | `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Mover FASE requiere actualizar indice documental protegido. | No aplica. |
| `docs/ai-auditor-history.md` | historical_reference | `docs/runbooks-index.md`, indices historicos | no_movido_requires_review | Referenciado por indice de runbooks; no mover sin reconciliar runbooks. | No aplica. |
| `docs/ai-legacy-suggest-endpoints.md` | legacy_do_not_use_for_coding | `docs/docs-index.md`, `docs/cleanup/documentation-source-of-truth.md`, `docs/sprint-0/repo-tree.txt` | no_movido_por_alcance | Moverlo requiere actualizar `docs/docs-index.md`, protegido en B.1. | No aplica. |

## Resultado

No se movieron documentos en B.1. Se mantiene la decision documental previa: son legacy o historicos, pero no se reubican hasta autorizar actualizacion de indices vigentes.
