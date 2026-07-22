# Fase 1 — Informe de dependencias de Fase 0

## Estado

FASE 1 NO INICIADA — DEPENDENCIAS DE FASE 0 ABIERTAS

## Fecha

2026-07-22

## Repositorio

- Ruta local: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`
- Remoto: `https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git`
- Rama evaluada: `main`
- SHA evaluado: `b77a7d23e140e6ae06593911ace3c4a034fdb2e2`
- `HEAD == origin/main`: sí

## Preflight

| Control | Resultado | Evidencia |
|---|---|---|
| Ruta obligatoria | OK | `pwd` retornó `/Users/andresbarouh/repos/tcdx-iso-saas-v4` |
| Rama base `main` | OK | `git branch --show-current` retornó `main` |
| Remoto correcto | OK | `origin` apunta a `https://github.com/Tecdex-SpA/tcdx-iso-saas-v4.git` |
| Worktree inicial limpio | OK | antes de ejecutar generadores Fase 0 |
| `HEAD == origin/main` | OK | ambos en `b77a7d23e140e6ae06593911ace3c4a034fdb2e2` |

## Puerta Fase 0

| Requisito | Resultado | Evidencia |
|---|---|---|
| Catálogo de capacidades existe | OK | `config/capabilities/catalog.json` |
| Matriz de autorización existe | OK | `config/security/authorization-matrix.json` |
| Gate `phase0:contracts:check` operativo | OK | `npm --prefix backend run phase0:contracts:check` |
| Sin regresiones nuevas | OK | estado `BASELINE_ACCEPTED`, regresiones `0` |
| Sin críticos nuevos | OK | críticos nuevos `0` |
| Fase 0 cerrada | FAILED | `docs/product/fase-0-closeout.md` declara `FASE 0 NO CERRADA` |
| E2E crítico Fase 0 | FAILED | ledger indica `No tests found` |
| Aislamiento tenant dinámico | FAILED | ledger indica ausencia de fixtures/E2E cross-tenant |
| Observabilidad mínima | PENDING | ledger indica no verificada |
| Restore/RPO/RTO | BLOCKED | ledger indica restore QA no ejecutado |
| Deploy oficial `./scripts/deploy-vm.sh` | FAILED | no existe `scripts/deploy-vm.sh`; existe `scripts/deploy-vms.sh` |

## Resultado actual de `phase0:contracts:check`

```json
{
  "status": "BASELINE_ACCEPTED",
  "phaseStatus": "OPEN",
  "currentFindings": 328,
  "maximumAllowedFindings": 328,
  "variation": 0,
  "newFindings": 0,
  "removedFindings": 0,
  "newCriticalFindings": 0,
  "regressions": 0
}
```

Categorías actuales:

| Categoría | Conteo |
|---|---:|
| `non_productive_visible_without_feature_flag` | 35 |
| `productive_capability_without_e2e` | 5 |
| `endpoint_without_tenant_scope_signal` | 111 |
| `endpoint_without_auth_signal` | 176 |
| `capabilities_without_endpoint_association` | 1 |

## Validaciones locales ejecutadas

| Comando | Resultado |
|---|---|
| `git fetch origin --prune` | OK |
| `git switch main` | OK |
| `git pull --ff-only origin main` | OK |
| `npm --prefix backend run phase0:inventory` | OK |
| `npm --prefix backend run phase0:contracts:check` | OK: `BASELINE_ACCEPTED` |
| `npm --prefix backend run check` | OK |
| `npm --prefix backend test` | OK |
| `npm --prefix frontend run lint` | OK |
| `npm --prefix frontend run check` | OK |
| `npm --prefix frontend run build` | OK |
| `git diff --check` | OK |

## Bloqueantes de Fase 0 que impiden iniciar Fase 1

1. Contratos funcionales: Fase 0 permanece abierta con 328 hallazgos baseline.
2. Autorización: existen 176 endpoints sin señal estática de auth cercana; requiere validación/corrección antes de ampliar workflows, evidencia, readiness y auditoría avanzada.
3. Tenant scope: existen 111 endpoints sin señal estática tenant/data-scope cercana; Fase 1 ampliaría entidades multi-tenant críticas.
4. E2E crítico: no existen los 12 recorridos Fase 0; Fase 1 exige 19 recorridos adicionales y no debe construirse sobre una base sin E2E crítico.
5. Aislamiento cross-tenant: no hay pruebas dinámicas Tenant A/B para lectura, escritura, búsqueda, exportaciones, archivos, reportes e IA.
6. Observabilidad mínima: correlation ID, métricas, alertas y dashboard operacional no están verificados.
7. Restore: no se ejecutó restore QA aislado ni se midieron RPO/RTO.
8. Deploy oficial: el prompt exige `./scripts/deploy-vm.sh`, pero el repositorio versiona `./scripts/deploy-vms.sh`; no se verificó último deploy exitoso del SHA actual.

## Decisión

No se crea rama `codex/fase-1-nucleo-grc-automatizacion` y no se inicia implementación de dominio Fase 1. Hacerlo violaría la condición estricta del prompt: la baseline aceptada con deuda conocida no equivale a cierre de Fase 0.

## Próximo paso exacto

Retomar Fase 0 y reducir bloqueantes antes de reintentar Fase 1:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
npm --prefix backend run phase0:inventory
npm --prefix backend run phase0:contracts:check
```

Prioridad recomendada:

1. Resolver/autenticar endpoints críticos sin señal auth.
2. Validar/corregir tenant scope en endpoints críticos.
3. Crear fixtures Tenant A/B y E2E crítico Fase 0.
4. Verificar observabilidad mínima.
5. Ejecutar restore QA aislado y medir RPO/RTO.
6. Aclarar script oficial de deploy: `deploy-vm.sh` vs `deploy-vms.sh`.
