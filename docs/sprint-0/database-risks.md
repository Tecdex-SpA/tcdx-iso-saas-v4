# Sprint 0 - Riesgos base de datos

## Migraciones o scripts con palabras peligrosas
- `database/migrations/20260430_reportes_rbac_access.sql`: contiene `DROP`, `DELETE FROM`, `TRUNCATE` o backups auxiliares; revisar antes de ejecutar.
- `database/seeds/20260515_seed_ai_knowledge_iso9001_audit_documents.sql`: contiene `DROP`, `DELETE FROM`, `TRUNCATE` o backups auxiliares; revisar antes de ejecutar.
- `database/qa-fixes/20260513_create_iso_effective_health_view.sql`: contiene `DROP`, `DELETE FROM`, `TRUNCATE` o backups auxiliares; revisar antes de ejecutar.
- `database/qa-fixes/20260513_create_iso_effective_kpi_summary_view.sql`: contiene `DROP`, `DELETE FROM`, `TRUNCATE` o backups auxiliares; revisar antes de ejecutar.
- `database/qa-fixes/20260513_fix_iso_remaining_integrity.sql`: contiene `DROP`, `DELETE FROM`, `TRUNCATE` o backups auxiliares; revisar antes de ejecutar.

## Riesgos observados
- No se conectó a la DB real `192.168.2.30`; por tanto constraints, índices reales y drift productivo quedan pendientes manuales.
- Existen scripts `database/qa-fixes` con backups en schema `qa_audit`, drops de vistas y rollbacks. No deben ejecutarse como migraciones normales.
- Hay migraciones que crean tablas backup dentro de `public` o `qa_audit`; conviene separar runbooks de reparación de migraciones de producto.
- Varias tablas inferidas por código no aparecen creadas en migraciones recientes del repo, probablemente pertenecen a una base inicial no versionada o heredada: `tenants`, `users`, `tenant_controls`, `evidences`, `findings`, `action_plans`, `kpi_*`, `control_health_scores`.
- Alto uso de `tenant_id` en módulos operativos, pero rutas que aceptan tenant por params deben validar contra JWT o rol platform/dealer.
- Riesgo de escalabilidad: endpoints de dashboard/health/reportes combinan vistas, agregaciones y recálculos; confirmar índices reales en `tenant_id`, `standard_code`, `operation_id`, `created_at`, `status`.

## Pendientes manuales DBA
- Comparar `information_schema.tables` productivo contra migraciones versionadas.
- Verificar constraints FK y ON DELETE en tablas operativas críticas.
- Verificar que tablas con datos de cliente tengan `tenant_id NOT NULL` salvo catálogos globales justificados.
- Validar planes de consulta para health, dashboard, reportes y búsqueda global.
