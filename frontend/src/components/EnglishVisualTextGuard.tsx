'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const PROTECTED_SPANISH_UI_TEXT = new Set([
  'Cumplimiento y Auditoría',
]);

const EXACT_TEXT: Record<string, string> = {
  // TCDX-I18N-NC-DETAIL-ONLY-EXACT-START
  'Detalle de no conformidad': 'Nonconformity detail',
  'Detalle de la no conformidad': 'Nonconformity detail',
  'Información general': 'General information',
  'Datos generales': 'General data',
  'Información de la no conformidad': 'Nonconformity information',
  'Descripción de la no conformidad': 'Nonconformity description',
  'Detalle': 'Detail',
  'Detalles': 'Details',
  'Fecha de detección': 'Detection date',
  'Fecha de resolución': 'Resolution date',
  'Fecha detectada': 'Detection date',
  'Fecha resuelta': 'Resolution date',
  'Detectado por': 'Detected by',
  'Causa raíz': 'Root cause',
  'Análisis de causa': 'Cause analysis',
  'Tratamiento': 'Treatment',
  'Corrección': 'Correction',
  'Corrección inmediata': 'Immediate correction',
  'Acción correctiva propuesta': 'Proposed corrective action',
  'Acción correctiva asociada': 'Associated corrective action',
  'Plan correctivo': 'Corrective plan',
  'Plan relacionado': 'Related plan',
  'Evidencia asociada': 'Associated evidence',
  'Evidencias asociadas': 'Associated evidence',
  'Aprobación': 'Approval',
  'Aprobador': 'Approver',
  'Observaciones': 'Observations',
  'Comentarios': 'Comments',
  'Historial': 'History',
  'Trazabilidad': 'Traceability',
  'Última actualización': 'Last update',
  'Creado por': 'Created by',
  'Actualizado por': 'Updated by',
  'Sin responsable': 'No owner',
  'Sin evidencia': 'No evidence',
  'Sin observaciones': 'No observations',
  'Sin comentarios': 'No comments',
  'Sin causa raíz': 'No root cause',
  'Sin acción correctiva': 'No corrective action',
  'Sin plan relacionado': 'No related plan',
  'Cerrar detalle': 'Close detail',
  'Ocultar detalle': 'Hide details',
  'Volver': 'Back',
  'Guardar cambios': 'Save changes',
  'Actualizar estado': 'Update status',
  'Estado actual': 'Current status',
  'Nuevo estado': 'New status',
  'Cambiar estado': 'Change status',
  'Norma asociada': 'Associated standard',
  'Control asociado': 'Associated control',
  'Cláusula asociada': 'Associated clause',
  'Operación asociada': 'Associated operation',
  'Empresa': 'Company',
  'Toda la empresa': 'Entire company',
  // TCDX-I18N-NC-DETAIL-ONLY-EXACT-END
  // TCDX-I18N-NC-EXACT-START
  'Gestión de no conformidades': 'Nonconformity management',
  'GESTIÓN DE NO CONFORMIDADES': 'NONCONFORMITY MANAGEMENT',
  'Alcance operativo + trazabilidad + IA': 'Operational scope + traceability + AI',
  'ALCANCE OPERATIVO + TRAZABILIDAD + IA': 'OPERATIONAL SCOPE + TRACEABILITY + AI',
  'Controla el ciclo completo de la no conformidad: apertura, avance, aprobación, evidencia automática y enlace directo al plan correctivo.': 'Control the full nonconformity lifecycle: opening, progress, approval, automatic evidence, and direct link to the corrective action plan.',
  'ABIERTO': 'OPEN',
  'Abierto': 'Open',
  'abierto': 'open',
  'RESUELTA': 'RESOLVED',
  'RESUELTO': 'RESOLVED',
  'IN PROGRESS': 'IN PROGRESS',
  'Pend. aprobación': 'Pending approval',
  'PEND. APROBACIÓN': 'PENDING APPROVAL',
  'Con acción activa': 'With active action',
  'CON ACCIÓN ACTIVA': 'WITH ACTIVE ACTION',
  'Solo lectura': 'Read only',
  'SOLO LECTURA': 'READ ONLY',
  'STANDARD': 'STANDARD',
  'ESTADO': 'STATUS',
  'Detectada': 'Detected',
  'DETECTADA': 'DETECTED',
  'Operación': 'Operation',
  'OPERACIÓN': 'OPERATION',
  'Código op.': 'Operation code',
  'CÓDIGO OP.': 'OPERATION CODE',
  'Acción abierta existente': 'Existing open action',
  'IA redactar NC': 'AI draft NC',
  'Abrir plan relacionado': 'Open related plan',
  'Ver detalle': 'View details',
  'Trazabilidad de acción correctiva': 'Corrective action traceability',
  'Plan activo': 'Active plan',
  'Aprobadas': 'Approved',
  'APROBADAS': 'APPROVED',
  'Avance': 'Progress',
  'AVANCE': 'PROGRESS',
  'Seguridad de la información': 'Information Security',
  'Proveedores evaluados': 'Evaluated suppliers',
  'Operación :': 'Operation:',
  'Operación:': 'Operation:',
  'Categoría:': 'Category:',
  'Cláusula:': 'Clause:',
  'Prioridad:': 'Priority:',
  'Aprobadas:': 'Approved:',
  'Avance:': 'Progress:',
  // TCDX-I18N-NC-EXACT-END
  'Cargando...': 'Loading...',
  'Cargando normas operativas...': 'Loading operational standards...',
  'No Conformidades': 'Nonconformities',
  'No conformidades': 'Nonconformities',
  'No conformidad': 'Nonconformity',
  'No hay normas operativas para esta empresa': 'There are no operational standards for this company',
  'Primero debes dejar una norma activa con al menos una operación activa asignada.': 'You must first leave an active standard with at least one assigned active operation.',
  'IA Auditor Senior': 'Senior AI Auditor',
  'Borrador preparado por IA Auditor Senior': 'Draft prepared by Senior AI Auditor',
  'Borrador preparado por IA Auditor Senior. Revísalo antes de guardar.': 'Draft prepared by Senior AI Auditor. Review it before saving.',
  'Debe ser revisado y confirmado por un humano antes de guardar.': 'It must be reviewed and confirmed by a human before saving.',
  'Descartar borrador': 'Discard draft',
  'Aplicar borrador': 'Apply draft',
  'Orquestación IA TCDX': 'TCDX AI Orchestration',
  'Este borrador fue enriquecido por el motor central usando capas de conocimiento y trazabilidad.': 'This draft was enriched by the central engine using knowledge layers and traceability.',
  'Origen': 'Source',
  'Confianza': 'Confidence',
  'Ruta': 'Path',
  'No informada': 'Not reported',
  'Mejor esfuerzo': 'Best effort',
  'Base TCDX': 'TCDX Knowledge Base',
  'Motor IA TCDX': 'TCDX AI Engine',
  'Internet': 'Internet',
  'Benchmark': 'Benchmark',
  'Tenant': 'Tenant',
  'Abiertas': 'Open',
  'Resueltas': 'Resolved',
  'En progreso': 'In progress',
  'Pendientes aprobación': 'Pending approval',
  'Pendiente aprobación': 'Pending approval',
  'Pendiente de aprobación': 'Pending approval',
  'Norma': 'Standard',
  'Estado': 'Status',
  'Categoría': 'Category',
  'Cláusula': 'Clause',
  'Control': 'Control',
  'Descripción': 'Description',
  'Responsable': 'Owner',
  'Fecha': 'Date',
  'Fecha objetivo': 'Target date',
  'Vencimiento': 'Due date',
  'Severidad': 'Severity',
  'Prioridad': 'Priority',
  'Acciones': 'Actions',
  'Acción': 'Action',
  'Generar con IA': 'Generate with AI',
  'Redactar con IA': 'Draft with AI',
  'Guardar borrador IA': 'Save AI draft',
  'Crear acción desde IA': 'Create action from AI',
  'Ver borrador IA': 'View AI draft',
  'Ocultar borrador IA': 'Hide AI draft',
  'Borrador IA': 'AI draft',
  'Evidencia objetiva': 'Objective evidence',
  'Riesgo': 'Risk',
  'Acción correctiva': 'Corrective action',
  'No hay no conformidades para mostrar.': 'There are no nonconformities to show.',
  'Sin descripción': 'No description',
  'Sin cláusula': 'No clause',
  'General': 'General',
  'Abierta': 'Open',
  'abierta': 'open',
  'Resuelta': 'Resolved',
  'resuelta': 'resolved',
  'Bloqueado': 'Blocked',
  'bloqueado': 'blocked',
  'Completado': 'Completed',
  'completado': 'completed',
  'Cancelado': 'Cancelled',
  'cancelado': 'cancelled',
  'Alta': 'High',
  'alta': 'high',
  'Media': 'Medium',
  'media': 'medium',
  'Baja': 'Low',
  'baja': 'low',
  'Crítica': 'Critical',
  'crítica': 'critical',
  'Crítico': 'Critical',
  'crítico': 'critical',
  'Guardar': 'Save',
  'Cancelar': 'Cancel',
  'Editar': 'Edit',
  'Actualizar': 'Update',
  'Eliminar': 'Delete',
  'Cerrar': 'Close',
  'Buscar': 'Search',
  'Filtrar': 'Filter',
  'Limpiar filtros': 'Clear filters',
  'Exportar': 'Export',
  'Descargar': 'Download',
  'Aprobado': 'Approved',
  'Rechazado': 'Rejected',
  'En revisión': 'Under review',
  'No aplica': 'Not applicable',
  'Cumple': 'Compliant',
  'No cumple': 'Non-compliant',
  'Parcial': 'Partial',
  'Pendiente': 'Pending',
};

const PHRASES: Array<[RegExp, string]> = [
  // TCDX-I18N-NC-DETAIL-ONLY-PHRASES-START
  [/Detalle de la no conformidad/gi, 'Nonconformity detail'],
  [/Detalle de no conformidad/gi, 'Nonconformity detail'],
  [/Información general/gi, 'General information'],
  [/Datos generales/gi, 'General data'],
  [/Información de la no conformidad/gi, 'Nonconformity information'],
  [/Descripción de la no conformidad/gi, 'Nonconformity description'],
  [/Fecha de detección/gi, 'Detection date'],
  [/Fecha de resolución/gi, 'Resolution date'],
  [/Detectado por/gi, 'Detected by'],
  [/Causa raíz/gi, 'Root cause'],
  [/Análisis de causa/gi, 'Cause analysis'],
  [/Corrección inmediata/gi, 'Immediate correction'],
  [/Acción correctiva propuesta/gi, 'Proposed corrective action'],
  [/Acción correctiva asociada/gi, 'Associated corrective action'],
  [/Plan correctivo/gi, 'Corrective plan'],
  [/Plan relacionado/gi, 'Related plan'],
  [/Evidencias asociadas/gi, 'Associated evidence'],
  [/Evidencia asociada/gi, 'Associated evidence'],
  [/Última actualización/gi, 'Last update'],
  [/Creado por/gi, 'Created by'],
  [/Actualizado por/gi, 'Updated by'],
  [/Sin responsable/gi, 'No owner'],
  [/Sin evidencia/gi, 'No evidence'],
  [/Sin observaciones/gi, 'No observations'],
  [/Sin comentarios/gi, 'No comments'],
  [/Sin causa raíz/gi, 'No root cause'],
  [/Sin acción correctiva/gi, 'No corrective action'],
  [/Sin plan relacionado/gi, 'No related plan'],
  [/Cerrar detalle/gi, 'Close detail'],
  [/Ocultar detalle/gi, 'Hide details'],
  [/Guardar cambios/gi, 'Save changes'],
  [/Actualizar estado/gi, 'Update status'],
  [/Estado actual/gi, 'Current status'],
  [/Nuevo estado/gi, 'New status'],
  [/Cambiar estado/gi, 'Change status'],
  [/Norma asociada/gi, 'Associated standard'],
  [/Control asociado/gi, 'Associated control'],
  [/Cláusula asociada/gi, 'Associated clause'],
  [/Operación asociada/gi, 'Associated operation'],
  // TCDX-I18N-NC-DETAIL-ONLY-PHRASES-END
  // TCDX-I18N-NC-PHRASES-START
  [/Gestión de no conformidades/gi, 'Nonconformity management'],
  [/Alcance operativo \+ trazabilidad \+ IA/gi, 'Operational scope + traceability + AI'],
  [/Controla el ciclo completo de la no conformidad: apertura, avance, aprobación, evidencia automática y enlace directo al plan correctivo\./gi, 'Control the full nonconformity lifecycle: opening, progress, approval, automatic evidence, and direct link to the corrective action plan.'],
  [/Categoría:\s*/gi, 'Category: '],
  [/Cláusula:\s*/gi, 'Clause: '],
  [/Operación\s*:\s*/gi, 'Operation: '],
  [/Código op\./gi, 'Operation code'],
  [/Seguridad de la información/gi, 'Information Security'],
  [/Proveedores evaluados/gi, 'Evaluated suppliers'],
  [/Toda la empresa/gi, 'Entire company'],
  [/Con acción activa/gi, 'With active action'],
  [/Solo lectura/gi, 'Read only'],
  [/Pend\. aprobación/gi, 'Pending approval'],
  [/Acción abierta existente/gi, 'Existing open action'],
  [/IA redactar NC/gi, 'AI draft NC'],
  [/Abrir plan relacionado/gi, 'Open related plan'],
  [/Ver detalle/gi, 'View details'],
  [/Trazabilidad de acción correctiva/gi, 'Corrective action traceability'],
  [/Plan activo/gi, 'Active plan'],
  [/Borrador IA/gi, 'AI draft'],
  [/Prioridad:\s*/gi, 'Priority: '],
  [/Aprobadas:\s*/gi, 'Approved: '],
  [/Avance:\s*/gi, 'Progress: '],
  [/abierto/gi, 'open'],
  [/resuelta/gi, 'resolved'],
  [/resuelto/gi, 'resolved'],
  [/media/gi, 'medium'],
  [/alta/gi, 'high'],
  [/baja/gi, 'low'],
  // TCDX-I18N-NC-PHRASES-END
  [/No conformidad cláusula/gi, 'Nonconformity clause'],
  [/No conformidad IA/gi, 'AI nonconformity'],
  [/No conformidad sin descripción/gi, 'Nonconformity without description'],
  [/Error actualizando no conformidad/gi, 'Error updating nonconformity'],
  [/Error creando plan de acción/gi, 'Error creating action plan'],
  [/No puedes crear acciones sobre una norma fuera del alcance operativo\./gi, 'You cannot create actions for a standard outside the operational scope.'],
  [/La no conformidad pertenece a una norma fuera del alcance operativo\./gi, 'The nonconformity belongs to a standard outside the operational scope.'],
  [/Borrador IA guardado correctamente/gi, 'AI draft saved successfully'],
  [/Primero debes generar el borrador IA\./gi, 'You must generate the AI draft first.'],
  [/Plan de acción generado o reutilizado correctamente desde IA/gi, 'Action plan generated or reused successfully from AI'],
  [/Plan de acción generado o reutilizado correctamente/gi, 'Action plan generated or reused successfully'],
  [/No fue posible guardar el borrador IA\./gi, 'The AI draft could not be saved.'],
  [/No fue posible crear una acción desde el borrador IA\./gi, 'An action could not be created from the AI draft.'],
  [/No fue posible redactar la no conformidad con IA\./gi, 'The nonconformity could not be drafted with AI.'],
  [/Sesión no disponible/gi, 'Session unavailable'],
  [/Respuesta inválida desde/gi, 'Invalid response from'],
  [/Error consultando IA/gi, 'Error querying AI'],
];

function translateText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (PROTECTED_SPANISH_UI_TEXT.has(trimmed)) {
    return value;
  }

  if (EXACT_TEXT[trimmed]) {
    return value.replace(trimmed, EXACT_TEXT[trimmed]);
  }

  let next = value;
  PHRASES.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });

  return next;
}

function shouldSkipElement(element: Element | null) {
  if (!element) return true;

  const tag = element.tagName.toLowerCase();
  return ['script', 'style', 'textarea', 'input', 'code', 'pre'].includes(tag);
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
    const elements = root instanceof Document ? root.querySelectorAll('[placeholder], [title], [aria-label]') : root.querySelectorAll('[placeholder], [title], [aria-label]');
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

export default function EnglishVisualTextGuard() {
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
