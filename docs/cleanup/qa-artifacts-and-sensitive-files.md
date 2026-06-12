# QA artifacts and sensitive files - cleanup stage 1

Fecha: 2026-06-12  
Rama: `chore/cleanup-stage-1-inventory`  
Regla aplicada: no se abrio ni imprimio contenido sensible. `token.txt` se busco por metadata solamente.

| Ruta | Tipo | Tamano | Riesgo | Accion recomendada |
| ---- | ---- | -----: | ------ | ------------------ |
| `qa-results/` | Directorio QA historico | 40M, 44 directorios, 718 archivos | Medio: respuestas JSON/response pueden contener datos de QA y headers | `mover_fuera_del_repo` para historicos; conservar solo evidencia resumida vigente. |
| `qa-results/cross-tenant-core-*` | QA cross-tenant | 13 directorios | Bajo/medio: evidencia util, ruido alto | Conservar ultimos 1-2 como evidencia o mover a artifact store. |
| `qa-results/reports-rbac-p1-*` | QA RBAC reportes | 9 directorios | Bajo/medio: evidencia util, ruido alto | Conservar ultimo resumen; mover respuestas completas fuera del repo. |
| `qa-results/tenant-path-p1-*` | QA tenant path | 8 directorios | Bajo/medio | Conservar ultimo resumen; mover respuestas completas fuera del repo. |
| `qa-results/e2e-minimal-*` | QA E2E minima | 8 directorios | Bajo | Conservar ultimo resumen; mover historicos. |
| `qa-results/sprint1-audit-*` | npm audit snapshots | 6 directorios | Bajo | Conservar ultimo resumen vigente; mover historicos. |
| `qa-results/**/*.json` | Respuestas/audits QA | 541 archivos | Medio: potencial informacion operativa | `mover_fuera_del_repo` salvo evidencia vigente. |
| `qa-results/**/*.response` | Respuestas QA HTTP | 133 archivos | Medio: posible payload/header de QA | `mover_fuera_del_repo`; revisar seguridad antes de publicar. |
| `qa-results/**/*.md` | Resumen QA | 31 archivos | Bajo | Conservar ultimos resumenes o mover a `docs` si son fuente vigente. |
| `qa-results/**/*.txt` | Resumen/log QA | 13 archivos | Bajo/medio | Revisar; conservar solo resumenes sin secretos. |
| `qa-results/**/token.txt` | Token QA | 0 detectados | P0 si aparece | `revisar_seguridad`; nunca imprimir contenido. |
| `./.DS_Store` | Artefacto SO | 14340 bytes | Bajo | `eliminar_candidato`. |
| `./database/.DS_Store` | Artefacto SO | 8196 bytes | Bajo | `eliminar_candidato`. |
| `./docs/.DS_Store` | Artefacto SO | 10244 bytes | Bajo | `eliminar_candidato`. |
| `ai-engine/reports/*.json` | Regresiones IA historicas | 260K | Bajo/medio: artifact de prueba historico | `mover_a_legacy` o fuera del repo si no es fuente vigente. |
| `backend/qa-results/` | QA local backend | Presente en arbol de trabajo, ignorado por Git | Medio | Mantener ignorado; no versionar. |
| `*.zip` fuera de node_modules/.next | ZIP historico | 0 detectados | Medio si aparece | Revisar seguridad antes de conservar. |
| `*.log` fuera de node_modules/.next | Logs | 0 detectados por barrido principal | Medio si aparece | Mover fuera del repo; revisar secretos. |
| `*.pdf` fuera de node_modules/.next | Reportes generados | 0 detectados por barrido principal | Bajo/medio | Versionar solo si es deliverable aprobado. |

## Conteo por extension en `qa-results`

| Extension | Archivos | Accion |
| --------- | -------: | ------ |
| `json` | 541 | Revisar seguridad y mover fuera del repo salvo snapshots vigentes. |
| `response` | 133 | Mover fuera del repo; posible payload sensible. |
| `md` | 31 | Conservar solo resumenes vigentes. |
| `txt` | 13 | Revisar y conservar solo resumenes sin secretos. |

## Reglas para etapa siguiente

- Si aparece un `token.txt`, reportar solo ruta, tamano, fecha y hash SHA256; no imprimir contenido.
- Antes de borrar `qa-results`, confirmar si algun resumen debe quedar en `docs/sprint-*` o `docs/security`.
- Agregar `.DS_Store` a limpieza aprobada y verificar `.gitignore` si vuelve a aparecer.
