# Fase 4 — QA Matrix

| Script | Objetivo | Cuándo ejecutarlo | Comando | Criterio PASS |
|---|---|---|---|---|
| `scripts/env-check.sh` | Validar entorno y referencias sensibles | Antes de commit/deploy | `bash scripts/env-check.sh` | Sin FAIL |
| `scripts/qa-security-basic.sh` | Seguridad básica | Pre/post deploy | `API_URL=... FRONTEND_URL=... EMAIL=... PASSWORD=... bash scripts/qa-security-basic.sh` | FAIL 0 |
| `scripts/qa-rbac-basic.sh` | RBAC baseline | Pre/post deploy | `API_URL=... FRONTEND_URL=... EMAIL=... PASSWORD=... bash scripts/qa-rbac-basic.sh` | FAIL 0 |
| `scripts/qa-cloud-readiness.sh` | Readiness Oracle Cloud | Antes de cutover | `bash scripts/qa-cloud-readiness.sh` | FAIL 0 |
| `scripts/qa-backup-readiness.sh` | Backup/restore readiness | Antes de piloto/cloud | `bash scripts/qa-backup-readiness.sh` | FAIL 0 |
| `scripts/qa-observability.sh` | Observabilidad | Pre/post deploy | `API_URL=... FRONTEND_URL=... AI_ENGINE_URL=... EMAIL=... PASSWORD=... bash scripts/qa-observability.sh` | FAIL 0 |
| `scripts/qa-ai-auditor-full.sh` | IA Auditor E2E | Pre/post deploy | `API_URL=... FRONTEND_URL=... EMAIL=... PASSWORD=... bash scripts/qa-ai-auditor-full.sh` | FAIL 0 |
| `scripts/qa-bilingual-full.sh` | i18n básico | Cambios frontend/i18n | `bash scripts/qa-bilingual-full.sh` | FAIL 0 |
| `scripts/monitor-runtime.sh` | Monitor runtime | Operación diaria/post-deploy | `AI_ENGINE_URL=http://192.168.100.140:8001 bash scripts/monitor-runtime.sh` | FAIL 0 |
| `scripts/backup-runtime.sh` | Backup real/dry-run | Pre-cambio y operación | `DRY_RUN=true bash scripts/backup-runtime.sh` | OK |
| `scripts/restore-test.sh` | Restore seguro | Restore drill | `DRY_RUN=true bash scripts/restore-test.sh` | OK |
| `scripts/collect-runtime-inventory.sh` | Inventario | Auditoría técnica | `bash scripts/collect-runtime-inventory.sh` | Archivo generado |
| `scripts/collect-ops-logs.sh` | Logs snapshot | Incidente/soporte | `bash scripts/collect-ops-logs.sh` | Archivo generado |
| `scripts/qa-phase4-final.sh` | Cierre final Fase 4 | Antes de cerrar fase | `API_URL=... FRONTEND_URL=... AI_ENGINE_URL=... EMAIL=... PASSWORD=... bash scripts/qa-phase4-final.sh` | FAIL 0 |

## Extensión Fase 5A

| QA | Objetivo |
|---|---|
| `scripts/qa-i18n-db-display.sh` | Valida la capa visual de traducción para datos provenientes desde BD. |
