'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const EXACT_TEXT: Record<string, string> = {
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
  'Plan de acción': 'Action plan',
  'Planes de acción': 'Action plans',
  'Crear plan de acción': 'Create action plan',
  'Generar plan de acción': 'Generate action plan',
  'Ver plan de acción': 'View action plan',
  'Ir al plan de acción': 'Go to action plan',
  'Plan generado': 'Plan generated',
  'Sin plan de acción': 'No action plan',
  'Generar con IA': 'Generate with AI',
  'Redactar con IA': 'Draft with AI',
  'Guardar borrador IA': 'Save AI draft',
  'Crear acción desde IA': 'Create action from AI',
  'Ver borrador IA': 'View AI draft',
  'Ocultar borrador IA': 'Hide AI draft',
  'Borrador IA': 'AI draft',
  'Evidencia objetiva': 'Objective evidence',
  'Riesgo': 'Risk',
  'Corrección inmediata': 'Immediate correction',
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
  return ['script', 'style', 'textarea', 'input', 'select', 'option', 'code', 'pre'].includes(tag);
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
