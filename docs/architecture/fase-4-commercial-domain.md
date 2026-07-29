# Fase 4 - Dominio comercial SaaS

Fase 4 agrega un dominio comercial aditivo sobre la base multi-tenant existente. PostgreSQL sigue como fuente de verdad; el frontend solo muestra decisiones que el backend ya resolvió.

Cadena implementada:

ProductFamily -> CommercialEdition -> CommercialPlanVersion -> CommercialModule -> CommercialAddon -> CommercialFeature -> TechnicalCapability -> mapping plan/modulo/feature -> TenantSubscription -> TenantEntitlement efectivo -> UsageLimit -> UsageMeasurement -> Effective Access Decision -> CommercialEvent.

Compatibilidad preservada:

- `tenant_contracts.plan_key` se mantiene y se mapea a suscripciones versionadas.
- `saas_modules`, `tenant_module_settings`, `tenant_standards`, IA, prefacturación, dealers y Admin SaaS legacy no se eliminan.
- Los historicos no se borran en downgrade; el cambio de plan cambia entitlement futuro y conserva lectura cuando la politica lo permite.

Tablas principales: `product_families`, `commercial_editions`, `commercial_plans`, `commercial_plan_versions`, `commercial_modules`, `commercial_addons`, `commercial_features`, `commercial_technical_capabilities`, `tenant_subscriptions`, `tenant_feature_overrides`, `tenant_usage_limits`, `usage_measurements`, `trials`, `commercial_events`, `pack_definitions`, `risk_methodology_versions` y `audit_workpaper_template_versions`.
