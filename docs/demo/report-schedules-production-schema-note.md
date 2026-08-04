# Compatibilidad productiva de `report_schedules`

El esquema productivo de `report_schedules` usa las columnas `report_type_code`, `frequency`, `day_of_month`, `recipients`, `is_active`, `created_by`, `last_sent_at`, `next_run_at`, `notes`, `metadata`, `created_at` y `updated_at`.

No existen en producción las columnas `report_definition_id`, `schedule_key`, `timezone`, `last_run_at` ni `status`.

La migración `20260803_demo_tenant_visual_completion.sql` debe usar identificadores determinísticos y `ON CONFLICT (id)` para mantener idempotencia.
