'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const ADMIN_SAAS_PHRASES: Array<[RegExp, string]> = [
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
