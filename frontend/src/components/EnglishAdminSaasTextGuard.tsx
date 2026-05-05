'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const ADMIN_SAAS_PHRASES: Array<[RegExp, string]> = [
  // TCDX-I18N-ADMIN-SAAS-DEEP-RESIDUALS-START
  [/Selecciona una Company para Manage\./gi, 'Select a company to manage.'],
  [/Selecciona una Company para administrar\./gi, 'Select a company to manage.'],
  [/Selecciona una empresa para Manage\./gi, 'Select a company to manage.'],
  [/Nueva\s+Company/gi, 'New Company'],
  [/Sear\s*ch/gi, 'Search'],
  [/Refresh Modules/gi, 'Refresh modules'],
  [/Refresh Audit/gi, 'Refresh audit'],
  [/Refresh Prices/gi, 'Refresh prices'],

  [/Define el Plan Comercial, estado Contractual y datos de referencia para preBilling y CRM\./gi, 'Define the commercial plan, contract status, and reference data for prebilling and CRM.'],
  [/Define el plan comercial, estado contractual y datos de referencia para prefacturación y CRM\./gi, 'Define the commercial plan, contract status, and reference data for prebilling and CRM.'],
  [/ESTADO CONTRACT/gi, 'CONTRACT STATUS'],
  [/Estado Contract/gi, 'Contract status'],
  [/END \/ RENOVACIÓN/gi, 'END / RENEWAL'],
  [/End \/ renovación/gi, 'End / renewal'],
  [/MÁX\. ACTIVE STANDARDS/gi, 'MAX. ACTIVE STANDARDS'],
  [/Máx\. Active Standards/gi, 'Max. active standards'],
  [/MÁX\. MODULES PREMIUM/gi, 'MAX. PREMIUM MODULES'],
  [/Máx\. Modules Premium/gi, 'Max. premium modules'],
  [/AI QUOTA INCLUIDA/gi, 'AI QUOTA INCLUDED'],
  [/AI quota incluida/gi, 'AI quota included'],
  [/NOTAS COMMERCIALES/gi, 'COMMERCIAL NOTES'],
  [/Notas Commerciales/gi, 'Commercial notes'],
  [/Contrato creado desde cotización aceptada/gi, 'Contract created from accepted quotation'],
  [/Servicio reactivado/gi, 'Service reactivated'],
  [/Prueba reactivación manual/gi, 'Manual reactivation test'],
  [/Al Save el Contract, recalcula la preBilling para aplicar el Price del Plan seleccionado\./gi, 'When saving the contract, prebilling is recalculated to apply the selected plan price.'],
  [/Al guardar el contrato, recalcula la prefacturación para aplicar el precio del plan seleccionado\./gi, 'When saving the contract, prebilling is recalculated to apply the selected plan price.'],
  [/PreBilling mensual SaaS/gi, 'Monthly SaaS prebilling'],
  [/Prebilling mensual SaaS/gi, 'Monthly SaaS prebilling'],
  [/Estimación Commercial mensual del servicio Contracted, Additionales y cuotas\. No corresponde a factura legal\./gi, 'Monthly commercial estimate for contracted service, add-ons, and quotas. This is not a legal invoice.'],
  [/Estimación comercial mensual del servicio contratado, adicionales y cuotas\. No corresponde a factura legal\./gi, 'Monthly commercial estimate for contracted service, add-ons, and quotas. This is not a legal invoice.'],
  [/mayo de 2026/gi, 'May 2026'],
  [/No existe prefactura para este mes\. Presiona Recalcular prefactura para generar la estimación mensual\./gi, 'There is no prebilling record for this month. Press Recalculate prebilling to generate the monthly estimate.'],
  [/Recalcular prefactura/gi, 'Recalculate prebilling'],

  [/Modules Contracted/gi, 'Contracted modules'],
  [/Active o desActive Modules SaaS respetando el máximo Contracted\. Los Modules no se habilitan automáticamente al convertir una quotation\./gi, 'Activate or deactivate SaaS modules while respecting the contracted maximum. Modules are not enabled automatically when converting a quotation.'],
  [/Activa o desactiva módulos SaaS respetando el máximo contratado\. Los módulos no se habilitan automáticamente al convertir una cotización\./gi, 'Activate or deactivate SaaS modules while respecting the contracted maximum. Modules are not enabled automatically when converting a quotation.'],
  [/MÁXIMO CONTRACTED/gi, 'MAXIMUM CONTRACTED'],
  [/Máximo Contracted/gi, 'Maximum contracted'],
  [/AVAILABLES CATÁLOGO/gi, 'AVAILABLE CATALOG'],
  [/Availables catálogo/gi, 'Available catalog'],
  [/Según Contract SaaS/gi, 'According to SaaS contract'],
  [/Campo max_premium_modules/gi, 'max_premium_modules field'],
  [/Modules SaaS configurados/gi, 'Configured SaaS modules'],
  [/Esta Company ya alcanzó el máximo de Modules premium Contracteds\. Para habilitar otro Module, primero deshabilita uno Active o aumenta el máximo en Contract SaaS\./gi, 'This company has already reached the maximum number of contracted premium modules. To enable another module, first disable an active one or increase the maximum in the SaaS contract.'],
  [/Esta empresa ya alcanzó el máximo de módulos premium contratados\. Para habilitar otro módulo, primero deshabilita uno activo o aumenta el máximo en el contrato SaaS\./gi, 'This company has already reached the maximum number of contracted premium modules. To enable another module, first disable an active one or increase the maximum in the SaaS contract.'],
  [/ÚLTIMO CAMBIO/gi, 'LAST CHANGE'],
  [/Último cambio/gi, 'Last change'],
  [/Habilitado/gi, 'Enabled'],
  [/Deshabilitado/gi, 'Disabled'],
  [/Deshabilitar/gi, 'Disable'],
  [/Habilitar/gi, 'Enable'],
  [/Dashboard de salud ISO, KPIs y remedición\./gi, 'ISO health dashboard, KPIs, and remediation.'],
  [/Gestión y revisión de controles ISO\./gi, 'ISO control management and review.'],
  [/Carga, revisión y aprobación de evidencias\./gi, 'Upload, review, and approval of evidence.'],
  [/Gestión de acciones correctivas y remedición\./gi, 'Corrective action and remediation management.'],
  [/Gestión de no conformidades\./gi, 'Nonconformity management.'],
  [/Module habilitado desde SaaS Administration/gi, 'Module enabled from SaaS Administration'],
  [/Module deshabilitado desde SaaS Administration/gi, 'Module disabled from SaaS Administration'],
  [/Cambio realizado desde SaaS Administration/gi, 'Change made from SaaS Administration'],

  [/Respaldo externo IA/gi, 'External AI support'],
  [/Configura paquetes mensuales de 100 consultas\. Cada paquete cuesta \$4\.990; consultas Additionales cuestan \$100 previa aceptación\./gi, 'Configure monthly packages of 100 queries. Each package costs $4,990; additional queries cost $100 with prior acceptance.'],
  [/Configura paquetes mensuales de 100 consultas\. Cada paquete cuesta \$4\.990; consultas adicionales cuestan \$100 previa aceptación\./gi, 'Configure monthly packages of 100 queries. Each package costs $4,990; additional queries cost $100 with prior acceptance.'],
  [/CONSULTAS CONTRACTEDS/gi, 'CONTRACTED QUERIES'],
  [/Consultas Contracteds/gi, 'Contracted queries'],
  [/USADAS/gi, 'USED'],
  [/Usadas/gi, 'Used'],
  [/REMAININGS/gi, 'REMAINING'],
  [/Remainings/gi, 'Remaining'],
  [/VALOR MENSUAL/gi, 'MONTHLY VALUE'],
  [/Valor mensual/gi, 'Monthly value'],
  [/Paquetes de 100/gi, 'Packages of 100'],
  [/Mes actual/gi, 'Current month'],
  [/Antes de bloquear/gi, 'Before blocking'],
  [/Base: \$4\.990 \/ 100 consultas/gi, 'Base: $4,990 / 100 queries'],
  [/CONSULTAS CONTRACTEDS \/ MES/gi, 'CONTRACTED QUERIES / MONTH'],
  [/Consultas Contracteds \/ Mes/gi, 'Contracted queries / month'],
  [/Ingresa 100, 200, 300, etc\. Si ingresas un valor intermedio, se redondeará al paquete superior\. Consulta Additional: \$100 previa aceptación\./gi, 'Enter 100, 200, 300, etc. If you enter an intermediate value, it will be rounded up to the next package. Additional query: $100 with prior acceptance.'],
  [/Ingresa 100, 200, 300, etc\. Si ingresas un valor intermedio, se redondeará al paquete superior\. Consulta adicional: \$100 previa aceptación\./gi, 'Enter 100, 200, 300, etc. If you enter an intermediate value, it will be rounded up to the next package. Additional query: $100 with prior acceptance.'],
  [/Paquete respaldo externo IA: 0 paquete\(s\) de 100 consultas/gi, 'External AI support package: 0 package(s) of 100 queries'],
  [/Save quota/gi, 'Save quota'],
  [/Audit de cambios de quota/gi, 'Quota change audit'],
  [/Audit de cambios de cuota/gi, 'Quota change audit'],
  [/Registro de cambios realizados por superUsers sobre la Monthly quota\./gi, 'Record of changes made by superusers to the monthly quota.'],
  [/Registro de cambios realizados por superusuarios sobre la cuota mensual\./gi, 'Record of changes made by superusers to the monthly quota.'],
  [/CUOTA ANTERIOR/gi, 'PREVIOUS QUOTA'],
  [/Cuota anterior/gi, 'Previous quota'],
  [/CUOTA NUEVA/gi, 'NEW QUOTA'],
  [/Cuota nueva/gi, 'New quota'],
  [/MOTIVO/gi, 'REASON'],
  [/Motivo/gi, 'Reason'],
  [/SOURCE/gi, 'SOURCE'],
  [/Source/gi, 'Source'],

  [/Partners asignados a esta Company\./gi, 'Partners assigned to this company.'],
  [/Partners asignados a esta empresa\./gi, 'Partners assigned to this company.'],
  [/Seleccionar Dealer/gi, 'Select dealer'],
  [/Assign\s*ar/gi, 'Assign'],
  [/No hay Assigned Dealers a esta Company\./gi, 'There are no assigned dealers for this company.'],
  [/No hay dealers asignados a esta empresa\./gi, 'There are no assigned dealers for this company.'],
  [/Users del Tenant/gi, 'Tenant users'],
  [/Usuarios del Tenant/gi, 'Tenant users'],
  [/Users asociados a esta Company\./gi, 'Users associated with this company.'],
  [/Usuarios asociados a esta empresa\./gi, 'Users associated with this company.'],
  [/Solicitudes Commerciales u operativas enviadas por partners\./gi, 'Commercial or operational requests submitted by partners.'],
  [/Solicitudes comerciales u operativas enviadas por partners\./gi, 'Commercial or operational requests submitted by partners.'],
  [/SOLICITUD/gi, 'REQUEST'],
  [/Solicitud/gi, 'Request'],
  [/TIPO/gi, 'TYPE'],
  [/Tipo/gi, 'Type'],
  [/No hay Dealer requests para esta Company\./gi, 'There are no dealer requests for this company.'],
  [/No hay solicitudes dealer para esta empresa\./gi, 'There are no dealer requests for this company.'],

  [/Audit log administrative/gi, 'Administrative audit log'],
  [/Audit log administrativo/gi, 'Administrative audit log'],
  [/Últimos eventos de SaaS Governance para esta Company\./gi, 'Latest SaaS governance events for this company.'],
  [/Últimos eventos de gobernanza SaaS para esta empresa\./gi, 'Latest SaaS governance events for this company.'],
  [/ACTOR/gi, 'ACTOR'],
  [/ENTIDAD/gi, 'ENTITY'],
  [/Entidad/gi, 'Entity'],
  [/DETAIL/gi, 'DETAIL'],
  [/Detail/gi, 'Detail'],
  [/Tenant_Contract/gi, 'Tenant contract'],
  [/Tenant_standard/gi, 'Tenant standard'],
  [/Tenant_module/gi, 'Tenant module'],
  [/Tenant_Contract\.updated/gi, 'Tenant contract updated'],
  [/Tenant_standard\.controls_initialized/gi, 'Tenant standard controls initialized'],
  [/Tenant_module\.enabled/gi, 'Tenant module enabled'],
  [/Tenant_module\.disabled/gi, 'Tenant module disabled'],

  [/CatáLogo de Prices SaaS/gi, 'SaaS price catalog'],
  [/Catálogo de Prices SaaS/gi, 'SaaS price catalog'],
  [/Catálogo de precios SaaS/gi, 'SaaS price catalog'],
  [/Administra Prices Commerciales para Planes, normas, Modules y consumos Additionales\. Los cambios impactan al recalcular preBilling\./gi, 'Manage commercial prices for plans, standards, modules, and additional consumption. Changes take effect when prebilling is recalculated.'],
  [/Administra precios comerciales para planes, normas, módulos y consumos adicionales\. Los cambios impactan al recalcular prefacturación\./gi, 'Manage commercial prices for plans, standards, modules, and additional consumption. Changes take effect when prebilling is recalculated.'],
  [/CONCEPTO/gi, 'CONCEPT'],
  [/Concepto/gi, 'Concept'],
  [/FRECUENCIA/gi, 'FREQUENCY'],
  [/Frecuencia/gi, 'Frequency'],
  [/Cuota mensual respaldo externo IA/gi, 'Monthly external AI support quota'],
  [/Paquete mensual de 100 consultas de respaldo externo IA\. Se cobra completo aunque/gi, 'Monthly package of 100 external AI support queries. It is charged in full even if'],
  [/Consulta adicional respaldo externo IA/gi, 'Additional external AI support query'],
  [/Consulta adicional cobrada cuando el cliente supera su bolsa mensual contratada/gi, 'Additional query charged when the client exceeds the contracted monthly package'],
  [/Módulo SaaS adicional/gi, 'Additional SaaS module'],
  [/Cargo mensual referencial por módulo premium habilitado\./gi, 'Reference monthly charge per enabled premium module.'],
  [/Plan Demo/gi, 'Demo plan'],
  [/Plan demo comercial para pruebas controladas\./gi, 'Commercial demo plan for controlled testing.'],
  [/Plan_base/gi, 'Base plan'],
  [/base_100/gi, 'base_100'],
  [/extra_query/gi, 'extra_query'],
  [/premium_module/gi, 'premium_module'],
  [/monthly/gi, 'monthly'],
  [/usage/gi, 'usage'],
  // TCDX-I18N-ADMIN-SAAS-DEEP-RESIDUALS-END
  // TCDX-I18N-ADMIN-SAAS-DETAIL-RESIDUALS-START
  [/Permiso/gi, 'Permission'],
  [/Administrar/gi, 'Manage'],
  [/Refrescar/gi, 'Refresh'],
  [/Gobierno de Companies, Modules, Contracted standards, Dealers y Audit log administrativa\./gi, 'Governance of companies, modules, contracted standards, dealers, and administrative audit log.'],
  [/Gobierno de empresas, módulos, normas contratadas, dealers y bitácora administrativa\./gi, 'Governance of companies, modules, contracted standards, dealers, and administrative audit log.'],
  [/Partners comerciales/gi, 'Commercial partners'],
  [/Company seleccionada/gi, 'Selected company'],
  [/Empresa seleccionada/gi, 'Selected company'],
  [/Nueva Company/gi, 'New company'],
  [/Search Company/gi, 'Search company'],
  [/Selecciona una Company para administrar\./gi, 'Select a company to manage.'],
  [/Selecciona una empresa para administrar\./gi, 'Select a company to manage.'],
  [/Client SaaS creado desde cotización/gi, 'SaaS client created from quotation'],
  [/Cliente SaaS creado desde cotización/gi, 'SaaS client created from quotation'],
  [/Servicios Demo/gi, 'Demo services'],
  [/Servicios tecnológicos y gestión documental/gi, 'Technology services and document management'],
  [/Casa matriz/gi, 'Headquarters'],
  [/ninguno/gi, 'none'],
  [/ninguna/gi, 'none'],
  [/Datos básicos de Company/gi, 'Basic company data'],
  [/Datos básicos de empresa/gi, 'Basic company data'],
  [/Edita la información base del Tenant seleccionado\./gi, 'Edit the base information of the selected tenant.'],
  [/Edita la información base de la empresa seleccionada\./gi, 'Edit the base information of the selected company.'],
  [/Save datos Company/gi, 'Save company data'],
  [/Guardar datos Company/gi, 'Save company data'],
  [/Guardar datos empresa/gi, 'Save company data'],
  [/Business sector \/ business activity/gi, 'Business sector / business activity'],
  [/BUSINESS SECTOR \/ BUSINESS ACTIVITY/gi, 'BUSINESS SECTOR / BUSINESS ACTIVITY'],
  [/Seleccionar archivo Sin archivos seleccionados/gi, 'Choose file No file selected'],
  [/Seleccionar archivo/gi, 'Choose file'],
  [/Sin archivos seleccionados/gi, 'No file selected'],
  [/Normas activas/gi, 'Active standards'],
  [/Normas Active/gi, 'Active standards'],
  [/ISO activas/gi, 'Active ISO standards'],
  [/ISO activas:/gi, 'Active ISO standards:'],
  [/ISO inactivas/gi, 'Inactive ISO standards'],
  [/0 inactivas/gi, '0 inactive'],
  [/1 inactivas/gi, '1 inactive'],
  [/2 inactivas/gi, '2 inactive'],
  [/3 inactivas/gi, '3 inactive'],
  [/inactivas/gi, 'inactive'],
  [/inactiva/gi, 'inactive'],
  [/Activas/gi, 'Active'],
  [/Activa/gi, 'Active'],
  [/Modules Active/gi, 'Active modules'],
  [/Modules Actives/gi, 'Active modules'],
  [/Módulos Active/gi, 'Active modules'],
  [/Módulos activos/gi, 'Active modules'],
  [/Dealers asignados/gi, 'Assigned dealers'],
  [/Dealers Asignados/gi, 'Assigned dealers'],
  [/Assigned dealers/gi, 'Assigned dealers'],
  [/Company Demo/gi, 'Demo company'],
  [/Demo Company/gi, 'Demo company'],
  [/Company/gi, 'Company'],
  [/Contract/gi, 'Contract'],
  [/Normas y Modules/gi, 'Standards and modules'],
  [/Normas y módulos/gi, 'Standards and modules'],
  [/Standards y Modules/gi, 'Standards and modules'],
  [/IA externa/gi, 'External AI'],
  [/IA External/gi, 'External AI'],
  [/Comercial/gi, 'Commercial'],
  [/Auditoría/gi, 'Audit'],
  [/Auditoria/gi, 'Audit'],
  [/Prices/gi, 'Prices'],
  [/Precios/gi, 'Prices'],
  [/Contrato activo/gi, 'Active contract'],
  [/Contract active/gi, 'Active contract'],
  [/Contrato: active/gi, 'Contract: active'],
  [/Contrato: activo/gi, 'Contract: active'],
  [/Contract: activo/gi, 'Contract: active'],
  [/Plan: Company/gi, 'Plan: Company'],
  [/Start:/gi, 'Start:'],
  [/End:/gi, 'End:'],
  [/Last event:/gi, 'Last event:'],
  [/Último evento:/gi, 'Last event:'],
  [/a\. m\./gi, 'AM'],
  [/p\. m\./gi, 'PM'],
  [/Superadmin/gi, 'Superadmin'],
  [/admin global/gi, 'global admin'],
  [/administrativa/gi, 'administrative'],
  [/administrativo/gi, 'administrative'],
  [/cotización/gi, 'quotation'],
  [/cotizacion/gi, 'quotation'],
  [/procesamiento de datos/gi, 'data processing'],
  [/PROCESAMIENTO DE DATOS/gi, 'DATA PROCESSING'],
  [/tecnológicos/gi, 'technology'],
  [/tecnologicos/gi, 'technology'],
  [/gestión documental/gi, 'document management'],
  [/gestion documental/gi, 'document management'],
  [/Información Credex SPA/gi, 'Credex Information LLC'],
  [/Servicios de Información Credex SPA/gi, 'Credex Information Services LLC'],
  // TCDX-I18N-ADMIN-SAAS-DETAIL-RESIDUALS-END
  [/Administración SaaS/gi, 'SaaS Administration'],
  [/Gobierno SaaS/gi, 'SaaS Governance'],
  [/Gobernanza/gi, 'Governance'],
  [/Empresas/gi, 'Companies'],
  [/Empresa/gi, 'Company'],
  [/Tenant/gi, 'Tenant'],
  [/Tenants/gi, 'Tenants'],
  [/Cliente/gi, 'Client'],
  [/Clientes/gi, 'Clients'],
  [/Crear empresa/gi, 'Create company'],
  [/Nueva empresa/gi, 'New company'],
  [/Editar empresa/gi, 'Edit company'],
  [/Eliminar empresa/gi, 'Delete company'],
  [/Eliminación lógica/gi, 'Soft deletion'],
  [/Empresa eliminada lógicamente/gi, 'Company soft-deleted'],
  [/Empresa descontratada/gi, 'Decontracted company'],
  [/Servicio suspendido/gi, 'Service suspended'],
  [/Servicio reactivado/gi, 'Service reactivated'],
  [/Suspensión manual por no pago/gi, 'Manual suspension for non-payment'],
  [/Reactivación manual de servicio/gi, 'Manual service reactivation'],
  [/Motivo de suspensión por no pago/gi, 'Reason for non-payment suspension'],
  [/Motivo de reactivación/gi, 'Reactivation reason'],
  [/Motivo de eliminación lógica/gi, 'Soft deletion reason'],
  [/Confirmación inválida/gi, 'Invalid confirmation'],
  [/No se eliminó la empresa/gi, 'The company was not deleted'],
  [/Contratos/gi, 'Contracts'],
  [/Contrato/gi, 'Contract'],
  [/Contrato SaaS/gi, 'SaaS contract'],
  [/Guardar contrato SaaS/gi, 'Save SaaS contract'],
  [/Error guardando contrato SaaS/gi, 'Error saving SaaS contract'],
  [/Plan contratado/gi, 'Contracted plan'],
  [/Plan/gi, 'Plan'],
  [/Estado contrato/gi, 'Contract status'],
  [/Estado del contrato/gi, 'Contract status'],
  [/Fecha inicio/gi, 'Start date'],
  [/Fecha término/gi, 'End date'],
  [/Inicio/gi, 'Start'],
  [/Término/gi, 'End'],
  [/Notas comerciales/gi, 'Commercial notes'],
  [/Referencia CRM/gi, 'CRM reference'],
  [/Moneda/gi, 'Currency'],
  [/Facturación/gi, 'Billing'],
  [/Prefacturación/gi, 'Prebilling'],
  [/Prefacturación mensual/gi, 'Monthly prebilling'],
  [/Mes de facturación/gi, 'Billing month'],
  [/Generar prefacturación/gi, 'Generate prebilling'],
  [/Recalcular prefacturación/gi, 'Recalculate prebilling'],
  [/Líneas de prefacturación/gi, 'Prebilling lines'],
  [/Subtotal/gi, 'Subtotal'],
  [/Descuento/gi, 'Discount'],
  [/Adicional/gi, 'Additional'],
  [/Impuesto/gi, 'Tax'],
  [/Total/gi, 'Total'],
  [/Precio/gi, 'Price'],
  [/Precio unitario/gi, 'Unit price'],
  [/Cantidad/gi, 'Quantity'],
  [/Ítem/gi, 'Item'],
  [/Item/gi, 'Item'],
  [/Catálogo de precios/gi, 'Price catalog'],
  [/Actualizar precio SaaS/gi, 'Update SaaS price'],
  [/Error actualizando precio SaaS/gi, 'Error updating SaaS price'],
  [/Normas contratadas/gi, 'Contracted standards'],
  [/Norma contratada/gi, 'Contracted standard'],
  [/Norma contratada\/activada/gi, 'Contracted/active standard'],
  [/Contratada \/ activa/gi, 'Contracted / active'],
  [/Contratada\/activa/gi, 'Contracted/active'],
  [/No contratada/gi, 'Not contracted'],
  [/Pausada/gi, 'Paused'],
  [/Desactivada/gi, 'Deactivated'],
  [/Activar norma/gi, 'Activate standard'],
  [/Pausar norma/gi, 'Pause standard'],
  [/Desactivar norma/gi, 'Deactivate standard'],
  [/Contratar\/activar/gi, 'Contract/activate'],
  [/Desactivar definitivamente/gi, 'Permanently deactivate'],
  [/Norma pausada desde Administración SaaS/gi, 'Standard paused from SaaS Administration'],
  [/Norma desactivada definitivamente desde Administración SaaS/gi, 'Standard permanently deactivated from SaaS Administration'],
  [/Norma contratada\/activada desde Administración SaaS/gi, 'Standard contracted/activated from SaaS Administration'],
  [/Error actualizando norma contratada/gi, 'Error updating contracted standard'],
  [/Controles catálogo/gi, 'Catalog controls'],
  [/Controles tenant/gi, 'Tenant controls'],
  [/Módulos/gi, 'Modules'],
  [/Módulo/gi, 'Module'],
  [/Módulos premium/gi, 'Premium modules'],
  [/Módulos habilitados/gi, 'Enabled modules'],
  [/Módulos deshabilitados/gi, 'Disabled modules'],
  [/Habilitar módulo/gi, 'Enable module'],
  [/Deshabilitar módulo/gi, 'Disable module'],
  [/Módulo habilitado desde Administración SaaS/gi, 'Module enabled from SaaS Administration'],
  [/Módulo deshabilitado desde Administración SaaS/gi, 'Module disabled from SaaS Administration'],
  [/Error actualizando módulo del tenant/gi, 'Error updating tenant module'],
  [/Máx\. normas activas/gi, 'Max. active standards'],
  [/Máx\. módulos premium/gi, 'Max. premium modules'],
  [/Máximo de normas activas/gi, 'Maximum active standards'],
  [/Máximo de módulos premium/gi, 'Maximum premium modules'],
  [/Cuotas IA/gi, 'AI quotas'],
  [/Cuota IA/gi, 'AI quota'],
  [/Consultas IA/gi, 'AI queries'],
  [/Búsqueda externa IA/gi, 'AI external search'],
  [/Cuota mensual/gi, 'Monthly quota'],
  [/Límite mensual/gi, 'Monthly limit'],
  [/Usado/gi, 'Used'],
  [/Disponible/gi, 'Available'],
  [/Restante/gi, 'Remaining'],
  [/Activo/gi, 'Active'],
  [/Inactivo/gi, 'Inactive'],
  [/Activar cuota/gi, 'Activate quota'],
  [/Desactivar cuota/gi, 'Deactivate quota'],
  [/Guardar cuota/gi, 'Save quota'],
  [/Historial de cuotas/gi, 'Quota history'],
  [/Bitácora/gi, 'Audit log'],
  [/Bitácora administrativa/gi, 'Administrative log'],
  [/Eventos administrativos/gi, 'Administrative events'],
  [/Último evento/gi, 'Last event'],
  [/Último uso/gi, 'Last use'],
  [/Última actualización/gi, 'Last update'],
  [/Última búsqueda/gi, 'Last search'],
  [/Logs de búsqueda externa/gi, 'External search logs'],
  [/Dealer/gi, 'Dealer'],
  [/Dealers/gi, 'Dealers'],
  [/Solicitudes dealer/gi, 'Dealer requests'],
  [/Asignar dealer/gi, 'Assign dealer'],
  [/Dealer asignado/gi, 'Assigned dealer'],
  [/Sin dealer/gi, 'No dealer'],
  [/Usuarios/gi, 'Users'],
  [/Usuario/gi, 'User'],
  [/Usuarios activos/gi, 'Active users'],
  [/Total usuarios/gi, 'Total users'],
  [/Nombre/gi, 'Name'],
  [/Nombre empresa/gi, 'Company name'],
  [/Razón social/gi, 'Legal name'],
  [/RUT/gi, 'Tax ID'],
  [/Dirección/gi, 'Address'],
  [/Rubro/gi, 'Business sector'],
  [/Giro/gi, 'Business activity'],
  [/Sucursales/gi, 'Branches'],
  [/Logo/gi, 'Logo'],
  [/Buscar empresa/gi, 'Search company'],
  [/Seleccionar empresa/gi, 'Select company'],
  [/Empresa seleccionada/gi, 'Selected company'],
  [/Detalle empresa/gi, 'Company detail'],
  [/Resumen empresa/gi, 'Company summary'],
  [/Información empresa/gi, 'Company information'],
  [/Información comercial/gi, 'Commercial information'],
  [/Información contractual/gi, 'Contract information'],
  [/Datos generales/gi, 'General data'],
  [/Resumen ejecutivo/gi, 'Executive summary'],
  [/Estado servicio/gi, 'Service status'],
  [/Suspender servicio/gi, 'Suspend service'],
  [/Reactivar servicio/gi, 'Reactivate service'],
  [/Eliminar lógicamente/gi, 'Soft delete'],
  [/No borra físicamente/gi, 'Does not physically delete'],
  [/Fuera de operación normal/gi, 'Outside normal operation'],
  [/Guardar cambios/gi, 'Save changes'],
  [/Guardar/gi, 'Save'],
  [/Cancelar/gi, 'Cancel'],
  [/Editar/gi, 'Edit'],
  [/Actualizar/gi, 'Update'],
  [/Eliminar/gi, 'Delete'],
  [/Crear/gi, 'Create'],
  [/Cerrar/gi, 'Close'],
  [/Buscar/gi, 'Search'],
  [/Filtrar/gi, 'Filter'],
  [/Limpiar filtros/gi, 'Clear filters'],
  [/Exportar/gi, 'Export'],
  [/Descargar/gi, 'Download'],
  [/Ver detalle/gi, 'View details'],
  [/Error obteniendo gobernanza/gi, 'Error getting governance'],
  [/Respuesta inválida del backend/gi, 'Invalid backend response'],
  [/Error backend/gi, 'Backend error'],
  [/Error cargando/gi, 'Error loading'],
  [/Error guardando/gi, 'Error saving'],
  [/Error actualizando/gi, 'Error updating'],
  [/Error eliminando/gi, 'Error deleting'],
  [/No se pudo determinar el nombre de la empresa/gi, 'The company name could not be determined'],
  [/Confirmas la suspensión/gi, 'Do you confirm the suspension'],
  [/Confirmas la reactivación/gi, 'Do you confirm the reactivation'],
  [/Confirmas la eliminación lógica/gi, 'Do you confirm the soft deletion'],
  [/¿Deseas/gi, 'Do you want to'],
  [/para esta empresa/gi, 'for this company'],
  [/esta empresa/gi, 'this company'],
  [/La empresa no se elimina y la información histórica se mantiene/gi, 'The company is not deleted and historical information is preserved'],
  [/La información histórica se mantiene/gi, 'Historical information is preserved'],
  [/No disponible/gi, 'Not available'],
  [/Sin datos/gi, 'No data'],
  [/Sin información/gi, 'No information'],
  [/No informado/gi, 'Not reported'],
  [/No informada/gi, 'Not reported'],
  [/Pendiente/gi, 'Pending'],
  [/Aprobado/gi, 'Approved'],
  [/Rechazado/gi, 'Rejected'],
  [/Demo/gi, 'Demo'],
  [/Trial/gi, 'Trial'],
  [/Suspendido/gi, 'Suspended'],
  [/Suspendida/gi, 'Suspended'],
  [/Eliminado/gi, 'Deleted'],
  [/Eliminada/gi, 'Deleted'],
  [/Contratado/gi, 'Contracted'],
  [/Contratada/gi, 'Contracted'],
  [/Administración/gi, 'Administration'],
];

function shouldSkipElement(element: Element | null) {
  if (!element) return true;

  const tag = element.tagName.toLowerCase();
  return ['script', 'style', 'textarea', 'input', 'code', 'pre'].includes(tag);
}

function translateText(value: string) {
  if (!value || !value.trim()) return value;

  let next = value;
  ADMIN_SAAS_PHRASES.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });

  return next;
}

function translateNode(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    const translated = translateText(node.nodeValue || '');
    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  });

  if (root instanceof HTMLElement || root instanceof Document) {
    const elements = root instanceof Document
      ? root.querySelectorAll('[placeholder], [title], [aria-label]')
      : root.querySelectorAll('[placeholder], [title], [aria-label]');

    elements.forEach((element) => {
      ['placeholder', 'title', 'aria-label'].forEach((attr) => {
        const current = element.getAttribute(attr);
        if (!current) return;
        const translated = translateText(current);
        if (translated !== current) {
          element.setAttribute(attr, translated);
        }
      });
    });
  }
}

export default function EnglishAdminSaasTextGuard() {
  const { locale } = useTranslation();

  useEffect(() => {
    if (locale !== 'en') return;
    if (typeof document === 'undefined') return;

    translateNode(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const translated = translateText(textNode.nodeValue || '');
            if (translated !== textNode.nodeValue) {
              textNode.nodeValue = translated;
            }
            return;
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            translateNode(node as Element);
          }
        });

        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          const translated = translateText(textNode.nodeValue || '');
          if (translated !== textNode.nodeValue) {
            textNode.nodeValue = translated;
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}
