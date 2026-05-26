# Auditoría de Seguridad y Calidad de Código

Fecha: 2026-05-26  
Alcance: `backend/src`, `frontend/src`, `ai-engine/app`, `database/migrations`, `scripts`, `docs`.

## Metodología
- Scans con `git grep`/`rg` para IPs legacy, uso directo de `ai_features_json`, fallback silencioso, HTML en APIs, secretos, SQL sensible y deuda explícita.
- Revisión de servicios críticos: entitlements IA, reportes, document mapping, aplicabilidad, health, frontend entitlements y scripts QA.
- Validación de sintaxis/build definida en el runbook de salida piloto.

## Hallazgos corregidos

### Media - Hosts legacy activos en script de deploy
`scripts/deploy-vms.sh` contenía IPs legacy como defaults runtime. Se removieron los defaults y ahora los hosts legacy sólo pueden usarse si se declaran explícitamente por variables de entorno.

### Media - Falta de orquestador único de readiness
No existía un script maestro que consolidara QA funcional, seguridad básica y artefactos. Se agregó `scripts/test-market-readiness-flow.sh`.

### Media - Evidencia documental sin mapping seguro
El flujo documento-sugerencia-evidencia ya devuelve `CONTROL_MAPPING_REQUIRED` si no puede resolver control aplicable tenant-scoped, evitando evidencia huérfana o asociación a control excluido.

### Baja - Trazabilidad comercial/operativa dispersa
Se agregaron documentos de checklist, runbook, alcance comercial, limitaciones y auditoría.

## Hallazgos no corregidos en esta pasada

### Media - Deuda lint frontend
`npm run lint` reporta warnings preexistentes, principalmente `any`, hooks dependencies e imágenes `<img>`. No bloquea build, pero debe reducirse antes de escalar desarrollo.

### Media - Compatibilidad legacy interna
Persisten referencias `legacy` en adaptadores, reportes y mapeos históricos. No se eliminaron para evitar romper datos y rutas existentes. Deben tratarse como deuda controlada.

### Media - Validación funcional completa requiere entorno
Flujos con PDF, DB directa, IA real y journalctl deben ejecutarse post-deploy en VMs. En local se validan sintaxis/build/scripts.

### Baja - Superficie RBAC amplia
RBAC fue endurecido previamente, pero nuevas rutas deben revisarse en cada entrega con `test-rbac-health-flow.sh` y master QA.

## Riesgos residuales
- Joins de vistas aplicables deben seguir monitoreándose con `test-db-applicability-consistency.sh`.
- La calidad de recomendaciones depende del Perfil Empresa y evidencias reales.
- Sin GPU, IA debe permanecer en qwen2.5:3b y procesos largos deben ser async.
- SaaS autoservicio masivo requiere monitoreo, alertas, soporte y onboarding autoservicio.

## Recomendación antes de piloto
- Ejecutar `scripts/test-market-readiness-flow.sh` con credenciales QA.
- Ejecutar prueba manual cliente sin IA y cliente con IA.
- Revisar logs backend post-prueba.
- Confirmar backup/restore reciente.

## Recomendación antes de SaaS masivo
- Reducir warnings frontend.
- Automatizar CI con scripts QA críticos.
- Añadir monitoreo y alertas.
- Ensayar restore.
- Pruebas multi-tenant con más de dos tenants reales.
- Definir política de soporte y respuesta a incidentes.

