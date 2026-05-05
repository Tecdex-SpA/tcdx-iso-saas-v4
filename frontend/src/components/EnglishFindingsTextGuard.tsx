'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const FINDINGS_PHRASES: Array<[RegExp, string]> = [
  [/Cargando hallazgos/gi, 'Loading findings'],
  [/Gestión de hallazgos/gi, 'Findings management'],
  [/Hallazgos/gi, 'Findings'],
  [/Hallazgo/gi, 'Finding'],
  [/Nuevo hallazgo/gi, 'New finding'],
  [/Crear hallazgo/gi, 'Create finding'],
  [/Guardar hallazgo/gi, 'Save finding'],
  [/Listado de hallazgos/gi, 'Findings list'],
  [/No hay hallazgos para mostrar/gi, 'There are no findings to show'],
  [/No hay hallazgos registrados/gi, 'There are no registered findings'],
  [/Sin hallazgos/gi, 'No findings'],
  [/Tipo de hallazgo/gi, 'Finding type'],
  [/Tipo/gi, 'Type'],
  [/Observación/gi, 'Observation'],
  [/Observacion/gi, 'Observation'],
  [/Oportunidad de mejora/gi, 'Improvement opportunity'],
  [/No conformidad potencial/gi, 'Potential nonconformity'],
  [/Fortaleza/gi, 'Strength'],
  [/Debilidad/gi, 'Weakness'],
  [/Descripción del hallazgo/gi, 'Finding description'],
  [/Título del hallazgo/gi, 'Finding title'],
  [/Sin descripción/gi, 'No description'],
  [/Sin responsable/gi, 'No owner'],
  [/Responsable/gi, 'Owner'],
  [/Detectado por/gi, 'Detected by'],
  [/Fecha de detección/gi, 'Detection date'],
  [/Fecha detectada/gi, 'Detection date'],
  [/Fecha objetivo/gi, 'Target date'],
  [/Fecha límite/gi, 'Due date'],
  [/Vencimiento/gi, 'Due date'],
  [/Norma/gi, 'Standard'],
  [/Control/gi, 'Control'],
  [/Cláusula/gi, 'Clause'],
  [/Categoría/gi, 'Category'],
  [/Operación/gi, 'Operation'],
  [/Código op\./gi, 'Operation code'],
  [/Toda la empresa/gi, 'Entire company'],
  [/Estado/gi, 'Status'],
  [/Prioridad/gi, 'Priority'],
  [/Severidad/gi, 'Severity'],
  [/Riesgo/gi, 'Risk'],
  [/Abierto/gi, 'Open'],
  [/Abierta/gi, 'Open'],
  [/En progreso/gi, 'In progress'],
  [/Pendiente/gi, 'Pending'],
  [/Pendiente aprobación/gi, 'Pending approval'],
  [/Pend\. aprobación/gi, 'Pending approval'],
  [/Cerrado/gi, 'Closed'],
  [/Cerrada/gi, 'Closed'],
  [/Resuelto/gi, 'Resolved'],
  [/Resuelta/gi, 'Resolved'],
  [/Cancelado/gi, 'Cancelled'],
  [/Cancelada/gi, 'Cancelled'],
  [/Alta/gi, 'High'],
  [/Media/gi, 'Medium'],
  [/Baja/gi, 'Low'],
  [/Crítica/gi, 'Critical'],
  [/Crítico/gi, 'Critical'],
  [/Plan de acción/gi, 'Action plan'],
  [/Planes de acción/gi, 'Action plans'],
  [/Crear plan de acción/gi, 'Create action plan'],
  [/Generar plan de acción/gi, 'Generate action plan'],
  [/Ver plan de acción/gi, 'View action plan'],
  [/Ir al plan de acción/gi, 'Go to action plan'],
  [/Abrir plan relacionado/gi, 'Open related plan'],
  [/Plan relacionado/gi, 'Related plan'],
  [/Sin plan de acción/gi, 'No action plan'],
  [/Acción correctiva/gi, 'Corrective action'],
  [/Acciones correctivas/gi, 'Corrective actions'],
  [/Acción abierta existente/gi, 'Existing open action'],
  [/Evidencia/gi, 'Evidence'],
  [/Evidencias/gi, 'Evidence'],
  [/Evidencia asociada/gi, 'Associated evidence'],
  [/Evidencias asociadas/gi, 'Associated evidence'],
  [/Aprobadas/gi, 'Approved'],
  [/Avance/gi, 'Progress'],
  [/Trazabilidad/gi, 'Traceability'],
  [/Trazabilidad IA/gi, 'AI traceability'],
  [/Trazabilidad de acción correctiva/gi, 'Corrective action traceability'],
  [/Guía IA enriquecida/gi, 'Enriched AI guidance'],
  [/Resolver este hallazgo/gi, 'Resolve this finding'],
  [/La IA resume qué hacer, qué evidencia entregar y cuándo puede cerrarse\./gi, 'AI summarizes what to do, what evidence to provide, and when it can be closed.'],
  [/Solución recomendada/gi, 'Recommended solution'],
  [/Siguiente mejor acción/gi, 'Next best action'],
  [/Qué hacer/gi, 'What to do'],
  [/Qué evidencia entregar/gi, 'What evidence to provide'],
  [/Cuándo se puede cerrar/gi, 'When it can be closed'],
  [/Ver detalle técnico IA/gi, 'View technical AI detail'],
  [/Todas las acciones concretas/gi, 'All concrete actions'],
  [/Todos los entregables esperados/gi, 'All expected deliverables'],
  [/Contenido mínimo de evidencia/gi, 'Minimum evidence content'],
  [/Evidencia que NO sirve/gi, 'Evidence that is NOT useful'],
  [/Condiciones completas de cierre/gi, 'Full closure conditions'],
  [/Impacto en salud/gi, 'Health impact'],
  [/Impacto en KPI/gi, 'KPI impact'],
  [/Contexto detectado/gi, 'Detected context'],
  [/Respaldo externo controlado/gi, 'Controlled external support'],
  [/Consulta fuentes confiables autorizadas y guarda trazabilidad\./gi, 'Queries authorized trusted sources and stores traceability.'],
  [/Buscar respaldo externo/gi, 'Search external support'],
  [/Buscando/gi, 'Searching'],
  [/Resultado/gi, 'Result'],
  [/Búsqueda ejecutada/gi, 'Search executed'],
  [/Respaldo reutilizado desde caché\. No se consumió API externa\./gi, 'Support reused from cache. No external API was consumed.'],
  [/Fecha original/gi, 'Original date'],
  [/Límite mensual/gi, 'Monthly limit'],
  [/Usado/gi, 'Used'],
  [/Disponible/gi, 'Available'],
  [/Recomendaciones comunes/gi, 'Common recommendations'],
  [/Cómo aplicarlo/gi, 'How to apply it'],
  [/Evidencia a recolectar/gi, 'Evidence to collect'],
  [/Precauciones/gi, 'Cautions'],
  [/Dominios usados/gi, 'Domains used'],
  [/Borrador IA/gi, 'AI draft'],
  [/Redactar con IA/gi, 'Draft with AI'],
  [/Generar con IA/gi, 'Generate with AI'],
  [/Analizar con IA/gi, 'Analyze with AI'],
  [/Guardar borrador IA/gi, 'Save AI draft'],
  [/Crear acción desde IA/gi, 'Create action from AI'],
  [/Borrador preparado por IA Auditor Senior/gi, 'Draft prepared by Senior AI Auditor'],
  [/Revísalo antes de guardar/gi, 'Review it before saving'],
  [/Descartar borrador/gi, 'Discard draft'],
  [/Aplicar borrador/gi, 'Apply draft'],
  [/Filtro/gi, 'Filter'],
  [/Filtros/gi, 'Filters'],
  [/Limpiar filtros/gi, 'Clear filters'],
  [/Buscar/gi, 'Search'],
  [/Guardar/gi, 'Save'],
  [/Cancelar/gi, 'Cancel'],
  [/Editar/gi, 'Edit'],
  [/Actualizar/gi, 'Update'],
  [/Eliminar/gi, 'Delete'],
  [/Cerrar/gi, 'Close'],
  [/Ver detalle/gi, 'View details'],
  [/Ocultar detalle/gi, 'Hide details'],
  [/Sin datos/gi, 'No data'],
  [/No informado/gi, 'Not reported'],
  [/No informada/gi, 'Not reported'],
  [/Sesión no disponible/gi, 'Session unavailable'],
  [/Respuesta inválida desde/gi, 'Invalid response from'],
  [/Error consultando IA/gi, 'Error querying AI'],
  [/No hay token activo para ejecutar búsqueda externa/gi, 'There is no active token to run external search'],
  [/Consulta adicional no aceptada\. No se ejecutó búsqueda externa nueva\./gi, 'Additional query was not accepted. No new external search was executed.'],
  [/Se terminaron las consultas contratadas\. Consulta adicional \$100\. ¿Acepta continuar\?/gi, 'The contracted queries have been used. Additional query $100. Do you accept to continue?'],
  [/Error ejecutando búsqueda externa/gi, 'Error running external search'],
  [/No puedes crear acciones sobre una norma fuera del alcance operativo\./gi, 'You cannot create actions for a standard outside the operational scope.'],
  [/El hallazgo pertenece a una norma fuera del alcance operativo\./gi, 'The finding belongs to a standard outside the operational scope.'],
];

function shouldSkipElement(element: Element | null) {
  if (!element) return true;

  const tag = element.tagName.toLowerCase();
  return ['script', 'style', 'textarea', 'input', 'code', 'pre'].includes(tag);
}

function translateText(value: string) {
  if (!value || !value.trim()) return value;

  let next = value;
  FINDINGS_PHRASES.forEach(([pattern, replacement]) => {
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

export default function EnglishFindingsTextGuard() {
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
