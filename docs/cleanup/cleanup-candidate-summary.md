# Cleanup candidate summary - stage 1

Fecha: 2026-06-12  
Rama: `chore/cleanup-stage-1-inventory`

| Prioridad | Candidato | Tipo | Accion recomendada | Motivo | Riesgo de eliminar |
| --------- | --------- | ---- | ------------------ | ------ | ------------------ |
| P0 | Rutas montadas antes de auth global: Google OAuth, Zoho OAuth, Sync Agent | revisar_seguridad | Auditar auth local, rate limit, logs y flujo de tokens; no eliminar | Superficie externa antes del middleware global | Alto si se elimina; puede romper OAuth/agente. |
| P0 | `qa-results/**/*.response` y JSON historicos | mover_fuera_del_repo | Revisar seguridad y mover a artifact store | Pueden contener payloads/respuestas de QA | Bajo para runtime, medio para evidencia historica. |
| P0 | `backend/src/routes/ai-traces.routes.js` | revisar_seguridad | Mantener oculto/deny y revisar datos expuestos | Trazas IA pueden contener contexto sensible | Alto si se elimina sin revisar consumidores. |
| P0 | `backend/src/routes/ai-external-lookup.routes.js` | revisar_seguridad | Mantener oculto/deny; revisar cuotas y data exposure | Busqueda externa y riesgo de fuga de contexto | Alto si se elimina sin revisar integraciones. |
| P1 | `backend/src/routes/2evidences.routes.js` | legacy_probable | Mover a legacy tras confirmar cero imports externos | Ruta no montada; duplica evidencias | Bajo si no hay consumidores. |
| P1 | `backend/src/routes/report.routes.js` | legacy_probable | Mover a legacy tras confirmar cero imports externos | Ruta singular no montada; `reports.routes.js` es canonical | Bajo/medio. |
| P1 | `/dashboard-v2` y `/dashboard-kpi` | duplicada_probable | Mantener ocultas; migrar valor util a `/dashboard` | Duplican dashboard principal | Medio; pueden servir como referencia. |
| P1 | `/ia`, `/ia-auditor`, `/auditorias/ia`, `/auditor-iso` | legacy_probable/enterprise_post_mvp | Mantener ocultas; clasificar con producto | Multiples rutas IA fuera de IA Compliance basica | Medio/alto; pueden tener demos o flujos enterprise. |
| P1 | `database/qa-fixes/*.sql` con `DROP` | revisar_dba | Mover a legacy DBA o documentar como hotfix historico | No apto para migracion normal | Alto si se ejecuta por error; bajo si solo se archiva. |
| P2 | `qa-results/` completos | mover_fuera_del_repo | Conservar resumenes vigentes; mover archivos completos | 40M de evidencia historica versionada/local | Bajo para runtime. |
| P2 | `ai-engine/reports/*.json` | mover_a_legacy | Mover a legacy o artifact store | Regresiones IA historicas | Bajo. |
| P2 | `docs/FASE_*.md` y documentos historicos | legacy | Mantener indexados como historicos; no borrar aun | Confunden fuentes vigentes | Medio por perdida de contexto. |
| P2 | Scripts `validate-*` de fases antiguas | legacy_probable | Clasificar en manifest QA; mantener hasta mapear vigencia | Ruido operacional alto | Medio; pueden servir como regresion. |
| P2 | Scripts `patch_*.py` | legacy_probable/riesgo_operacional | Mover a legacy tras confirmar uso nulo | Parches puntuales historicos | Medio si se usan en runbook. |
| P3 | `.DS_Store` en raiz, `database`, `docs` | eliminar_candidato | Borrar en etapa aprobada y reforzar ignore | Basura SO | Nulo para runtime. |

## Top 10 para ejecutar primero

1. Revisar rutas antes de auth global: OAuth Google/Zoho y Sync Agent.
2. Mover fuera del repo respuestas completas bajo `qa-results/**/*.response`.
3. Mover fuera del repo JSON historicos de `qa-results`.
4. Cuarentenar `2evidences.routes.js` si no hay referencias.
5. Cuarentenar `report.routes.js` si no hay referencias.
6. Confirmar producto para `/dashboard-v2` y `/dashboard-kpi`.
7. Confirmar producto para rutas IA legacy/enterprise.
8. Separar `database/qa-fixes` de migraciones normales.
9. Consolidar scripts QA vigentes vs validate legacy.
10. Eliminar `.DS_Store`.
