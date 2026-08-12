# Scripts quarantine B.1

Fecha: 2026-06-12
Rama: `chore/cleanup-b1-legacy-quarantine`

Dependency scan ejecutado con `rg` por nombre de archivo y basename sin extension, excluyendo `node_modules`, `.next` y dependencias instaladas. No se ejecuto ningun script.

| Script | Clasificacion previa | Referencias encontradas | Accion | Motivo | Rollback |
| ------ | -------------------- | ----------------------- | ------ | ------ | -------- |
| `scripts/patch_action_plans_direct_evidence.py` | legacy_candidate / repair DB | `docs/database/database-scripts-manifest.md`, `docs/cleanup/scripts-manifest.md`, `docs/sprint-0/repo-tree.txt` | no_movido_requires_review | Referenciado por manifest DB vigente como repair alto. | No aplica. |
| `scripts/patch_controls_workbench_effective_health_view.py` | legacy_candidate / repair DB | `docs/database/database-scripts-manifest.md`, `docs/cleanup/scripts-manifest.md`, `docs/sprint-0/repo-tree.txt` | no_movido_requires_review | Referenciado por manifest DB vigente como repair alto. | No aplica. |
| `scripts/patch_controls_workbench_map_effective_health.py` | legacy_candidate / repair DB | `docs/database/database-scripts-manifest.md`, `docs/cleanup/scripts-manifest.md`, `docs/sprint-0/repo-tree.txt` | no_movido_requires_review | Referenciado por manifest DB vigente como repair alto. | No aplica. |
| `scripts/patch_controls_workbench_operational_scope.py` | legacy_candidate / repair DB | `docs/database/database-scripts-manifest.md`, `docs/cleanup/scripts-manifest.md`, `docs/sprint-0/repo-tree.txt` | no_movido_requires_review | Referenciado por manifest DB vigente como repair alto. | No aplica. |
| `scripts/qa-phase4-final.sh` | legacy_candidate | Auto-referencias internas, `docs/phase-4-final-summary.md`, `docs/phase-4-qa-matrix.md`, manifests e indices historicos | no_movido_requires_review | Agregador amplio de QA historico con referencias documentales; moverlo podria romper trazabilidad Phase 4. | No aplica. |
| `scripts/validate-ai-knowledge.sh` | legacy_candidate | `docs/ai-engine-knowledge-base.md`, manifests e indices | no_movido_requires_review | Referenciado por doc AI vigente con revision. | No aplica. |
| `scripts/validate-iso-action-workflow.sh` | legacy_candidate | Invocado por `scripts/validate-iso-phase-1-11-1-13.sh`, docs FASE, manifests | no_movido_requires_review | Referencia viva desde otro script legacy no movido; puede crear/actualizar acciones. | No aplica. |
| `scripts/validate-iso-auditor.sh` | legacy_candidate | Invocado por `scripts/validate-iso-phase-1-11-1-13.sh`, docs FASE, manifests | no_movido_requires_review | Referencia viva desde otro script legacy no movido; puede invocar IA. | No aplica. |
| `scripts/validate-iso-command-center.sh` | legacy_candidate | `docs/FASE_1_10_COMMAND_CENTER_ISO.md`, manifests | no_movido_requires_review | Command center requiere decision B.2; conservar trazabilidad hasta entonces. | No aplica. |
| `scripts/validate-iso-control-mapping.sh` | qa_manual | `docs/MAPEO_ISO_CONTROLS_CATALOGO.md`, manifests | conservar | Marcado QA manual; no legacy directo. | No aplica. |
| `scripts/validate-iso-coverage-extension.sh` | qa_manual | Manifests | conservar | Marcado QA manual/revisar; puede depender de seeds. | No aplica. |
| `scripts/validate-iso-document-generator.sh` | qa_manual | `docs/GENERADOR_DOCUMENTAL_ISO.md`, manifests | conservar | Enterprise/manual; no mover en B.1. | No aplica. |
| `scripts/validate-iso-express-diagnostic.sh` | qa_manual | `docs/DIAGNOSTICO_ISO_EXPRESS.md`, manifests | conservar | Enterprise/manual; puede crear diagnosticos. | No aplica. |
| `scripts/validate-iso-knowledge.sh` | qa_manual | `docs/BASE_CONOCIMIENTO_ISO.md`, manifests | conservar | QA manual IA/knowledge. | No aplica. |
| `scripts/validate-iso-operational-execution.sh` | legacy_candidate | `docs/EJECUCION_OPERATIVA_ISO.md`, manifests | no_movido_requires_review | Puede crear/actualizar ejecucion; requiere revision. | No aplica. |
| `scripts/validate-iso-phase-1-11-1-13.sh` | legacy_candidate | Invoca otros scripts legacy; docs FASE, manifests | no_movido_requires_review | Orquestador historico; moverlo requiere mover/revisar dependencias internas. | No aplica. |
| `scripts/validate-iso-recommended-action-conversions.sh` | qa_manual | Docs FASE, manifests | conservar | Marcado QA manual; puede crear conversiones. | No aplica. |
| `scripts/validate-iso-recommended-actions.sh` | qa_manual | Docs FASE, manifests | conservar | Marcado QA manual; puede crear sugerencias/acciones. | No aplica. |
| `scripts/validate-iso-risk-matrix.sh` | qa_manual | `docs/MATRIZ_RIESGOS_AUTOMATIZADA.md`, manifests | conservar | Marcado QA manual; conservar. | No aplica. |
| `scripts/validate-iso-unified-command-center.sh` | legacy_candidate | Invocado por `scripts/validate-iso-phase-1-11-1-13.sh`, docs FASE, manifests | no_movido_requires_review | Referencia viva desde orquestador historico; requiere B.2/B.3. | No aplica. |

## Resultado

No se movieron scripts en B.1. La reduccion efectiva se concentro en reportes IA historicos versionados, dejando scripts para una etapa posterior con decision por familias.
