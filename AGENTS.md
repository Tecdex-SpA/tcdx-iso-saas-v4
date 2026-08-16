# AGENTS.md — TCDX ISO SaaS V4

Antes de ejecutar cualquier trabajo en este repositorio:

1. Lee `docs/codex/PLAN_MAESTRO_TCDX_ISO_SAAS_V4.md`.
2. Lee `docs/codex/CURRENT_STATE.md`.
3. Lee `docs/codex/SHARED_BASELINE.md`.
4. Lee `docs/codex/WORK_QUEUE.md`.
5. Lee `docs/codex/DECISIONS.md`.
6. Lee `docs/codex/CONTRACTS_REGISTRY.md` si el trabajo afecta contratos.
7. Lee `docs/codex/ARCHITECTURE_MAP.md` si afecta arquitectura.
8. Lee `docs/codex/REGRESSION_COMMANDS.md` antes de inventar comandos de prueba.
9. Lee `docs/codex/handoffs/<ID>.md` correspondiente.

Reglas obligatorias:
- El Plan Maestro es la autoridad de alcance.
- Ownership fijo: `codex`=CODEX A Data/Backend/GRC; `tecdex2-codex`=CODEX B AI/Knowledge/RAG/Regulatory; `tecdex3-codex`=CODEX C Frontend/UX/Product E2E.
- No hacer repo-wide scan por defecto.
- Respetar `Do not rediscover` y decisiones `VERIFIED`.
- No reabrir capacidades PROTECTED sin evidencia objetiva.
- No hardcodear tenants, UUID, clientes, emails, periodos ni datasets demo.
- No convertir null/no-data/insufficient en cero.
- Preservar RBAC y aislamiento multi-tenant.
- No duplicar motores existentes si pueden extenderse.
- `CODEX_VALIDATION_MODE = FOCUSED_MINIMAL`.
- No full CI, full regression, repeated test cycles, push, merge ni deploy desde Codex.
- Sí: continuity files, focused paths, implementation, diff review, máximo 1 test focal útil, handoff y atomic commit.
- El usuario ejecuta manualmente push, PR, CI, merge, deploy y validación runtime.
- Antes de terminar, actualizar handoff, CURRENT_STATE y WORK_QUEUE; contratos/arquitectura/ADR si cambian.
