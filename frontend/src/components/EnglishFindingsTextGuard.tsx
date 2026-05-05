'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const FINDINGS_PHRASES: Array<[RegExp, string]> = [
  // TCDX-I18N-FINDINGS-DETAIL-RESIDUALS-START
  [/Plan vinculado/gi, 'Linked plan'],
  [/Acción derivada/gi, 'Derived action'],
  [/Acción ya creada/gi, 'Action already created'],
  [/IA análisis/gi, 'AI analysis'],
  [/IA plan sugerido/gi, 'AI suggested plan'],
  [/Plan sugerido/gi, 'Suggested plan'],
  [/Status plan/gi, 'Plan status'],
  [/Estado plan/gi, 'Plan status'],
  [/Con acción/gi, 'With action'],
  [/Asociado/gi, 'Associated'],
  [/Asociada/gi, 'Associated'],
  [/Operaciones/gi, 'Operations'],
  [/Revisión de accesos privilegiados/gi, 'Privileged access review'],
  [/accesos privilegiados/gi, 'privileged access'],
  [/acciones correctivas/gi, 'corrective actions'],
  [/Corrective actions/gi, 'Corrective actions'],
  [/Durante la revisión demo se observó que/gi, 'During the demo review, it was observed that'],
  [/Durante la revisión se observó que/gi, 'During the review, it was observed that'],
  [/la validación periódica de accesos privilegiados/gi, 'the periodic validation of privileged access'],
  [/no cuenta con Evidence consolidada del último periodo/gi, 'does not have consolidated evidence for the latest period'],
  [/no cuenta con evidencia consolidada del último periodo/gi, 'does not have consolidated evidence for the latest period'],
  [/Resumen:/gi, 'Summary:'],
  [/El Finding indica/gi, 'The finding indicates'],
  [/Debe verificarse que/gi, 'It must be verified that'],
  [/cada acceso elevado sea necesario, aprobado y trazable/gi, 'each elevated access is necessary, approved, and traceable'],
  [/Mejora salud de Controles de acceso/gi, 'Improves access control health'],
  [/reduce exposición por privilegios excesivos/gi, 'reduces exposure from excessive privileges'],
  [/Exportar usuarios y roles privilegiados del sistema/gi, 'Export privileged users and roles from the system'],
  [/Identificar dueño del sistema o activo/gi, 'Identify the system or asset owner'],
  [/Validar necesidad de cada privilegio/gi, 'Validate the need for each privilege'],
  [/Delete o ajustar accesos innecesarios/gi, 'Delete or adjust unnecessary access'],
  [/Eliminar o ajustar accesos innecesarios/gi, 'Delete or adjust unnecessary access'],
  [/Registrar aprobación del dueño del sistema/gi, 'Record approval from the system owner'],
  [/Definir próxima revisión periódica/gi, 'Define the next periodic review'],
  [/revisión periódica/gi, 'periodic review'],
  [/privilegios/gi, 'privileges'],
  [/privilegiados/gi, 'privileged'],
  [/dueño del sistema/gi, 'system owner'],
  [/sistema o activo/gi, 'system or asset'],
  [/aprobación/gi, 'approval'],
  [/necesidad/gi, 'need'],
  [/acceso elevado/gi, 'elevated access'],
  [/accesos elevados/gi, 'elevated access'],
  [/trazable/gi, 'traceable'],
  [/trazables/gi, 'traceable'],
  [/último periodo/gi, 'latest period'],
  [/último período/gi, 'latest period'],
  // TCDX-I18N-FINDINGS-DETAIL-RESIDUALS-END
  // TCDX-I18N-FINDINGS-ACTIONS-CONTROL-START
  [/Acciones disponibles/gi, 'Available actions'],
  [/Acciones del hallazgo/gi, 'Finding actions'],
  [/Acciones para este hallazgo/gi, 'Actions for this finding'],
  [/Opciones disponibles/gi, 'Available options'],
  [/Acciones recomendadas/gi, 'Recommended actions'],
  [/Acciones sugeridas/gi, 'Suggested actions'],
  [/Gestionar hallazgo/gi, 'Manage finding'],
  [/Actualizar hallazgo/gi, 'Update finding'],
  [/Editar hallazgo/gi, 'Edit finding'],
  [/Cerrar hallazgo/gi, 'Close finding'],
  [/Reabrir hallazgo/gi, 'Reopen finding'],
  [/Resolver hallazgo/gi, 'Resolve finding'],
  [/Analizar hallazgo/gi, 'Analyze finding'],
  [/Analizar con IA/gi, 'Analyze with AI'],
  [/Generar análisis IA/gi, 'Generate AI analysis'],
  [/Generar sugerencia IA/gi, 'Generate AI suggestion'],
  [/Sugerir plan/gi, 'Suggest plan'],
  [/Crear desde hallazgo/gi, 'Create from finding'],
  [/Crear acción correctiva/gi, 'Create corrective action'],
  [/Crear evidencia/gi, 'Create evidence'],
  [/Adjuntar evidencia/gi, 'Attach evidence'],
  [/Ver evidencia/gi, 'View evidence'],
  [/Ver evidencias/gi, 'View evidence'],
  [/Ver trazabilidad/gi, 'View traceability'],
  [/Ver historial/gi, 'View history'],
  [/Ir a evidencia/gi, 'Go to evidence'],
  [/Ir a evidencias/gi, 'Go to evidence'],
  [/Ir a control/gi, 'Go to control'],
  [/Ir al control/gi, 'Go to control'],
  [/Ir a norma/gi, 'Go to standard'],
  [/Abrir control/gi, 'Open control'],
  [/Abrir evidencia/gi, 'Open evidence'],
  [/Abrir evidencias/gi, 'Open evidence'],
  [/Abrir hallazgo/gi, 'Open finding'],
  [/Control relacionado/gi, 'Related control'],
  [/Control asociado/gi, 'Associated control'],
  [/Control auditado/gi, 'Audited control'],
  [/Control evaluado/gi, 'Evaluated control'],
  [/Control afectado/gi, 'Affected control'],
  [/Control ISO/gi, 'ISO control'],
  [/Norma relacionada/gi, 'Related standard'],
  [/Norma asociada/gi, 'Associated standard'],
  [/Norma auditada/gi, 'Audited standard'],
  [/Norma evaluada/gi, 'Evaluated standard'],
  [/Cláusula relacionada/gi, 'Related clause'],
  [/Cláusula asociada/gi, 'Associated clause'],
  [/Operación relacionada/gi, 'Related operation'],
  [/Operación asociada/gi, 'Associated operation'],
  [/Área relacionada/gi, 'Related area'],
  [/Área afectada/gi, 'Affected area'],
  [/Proceso relacionado/gi, 'Related process'],
  [/Proceso afectado/gi, 'Affected process'],
  [/Información del control/gi, 'Control information'],
  [/Información del hallazgo/gi, 'Finding information'],
  [/Resumen del hallazgo/gi, 'Finding summary'],
  [/Contexto del hallazgo/gi, 'Finding context'],
  [/Datos del hallazgo/gi, 'Finding data'],
  [/Datos del control/gi, 'Control data'],
  [/Salud del control/gi, 'Control health'],
  [/Estado del control/gi, 'Control status'],
  [/Puntaje del control/gi, 'Control score'],
  [/Score del control/gi, 'Control score'],
  [/Responsable del control/gi, 'Control owner'],
  [/Última revisión/gi, 'Last review'],
  [/Última revisión del control/gi, 'Last control review'],
  [/Sin control asociado/gi, 'No associated control'],
  [/Sin norma asociada/gi, 'No associated standard'],
  [/Sin operación asociada/gi, 'No associated operation'],
  [/Sin cláusula asociada/gi, 'No associated clause'],
  [/Sin responsable asignado/gi, 'No assigned owner'],
  [/Hallazgo vinculado a control/gi, 'Finding linked to control'],
  [/Hallazgo sin control/gi, 'Finding without control'],
  [/Hallazgo operativo/gi, 'Operational finding'],
  [/Hallazgo de auditoría/gi, 'Audit finding'],
  [/Hallazgo IA/gi, 'AI finding'],
  [/Borrador de hallazgo/gi, 'Finding draft'],
  [/Origen del hallazgo/gi, 'Finding source'],
  [/Origen IA/gi, 'AI source'],
  [/Fuente del hallazgo/gi, 'Finding source'],
  [/Fuente IA/gi, 'AI source'],
  [/Revisión humana/gi, 'Human review'],
  [/Requiere revisión humana/gi, 'Requires human review'],
  [/No crea registros automáticamente/gi, 'Does not create records automatically'],
  [/No se crean registros automáticamente/gi, 'No records are created automatically'],
  [/Guardar como borrador/gi, 'Save as draft'],
  [/Aplicar sugerencia/gi, 'Apply suggestion'],
  [/Descartar sugerencia/gi, 'Discard suggestion'],
  [/Usar sugerencia/gi, 'Use suggestion'],
  [/Ver recomendación/gi, 'View recommendation'],
  [/Ocultar recomendación/gi, 'Hide recommendation'],
  [/Recomendación IA/gi, 'AI recommendation'],
  [/Recomendaciones IA/gi, 'AI recommendations'],
  [/Causa probable/gi, 'Likely cause'],
  [/Causas probables/gi, 'Likely causes'],
  [/Impacto estimado/gi, 'Estimated impact'],
  [/Impacto potencial/gi, 'Potential impact'],
  [/Riesgo asociado/gi, 'Associated risk'],
  [/Prioridad sugerida/gi, 'Suggested priority'],
  [/Confianza IA/gi, 'AI confidence'],
  [/Sin análisis IA/gi, 'No AI analysis'],
  [/Análisis IA disponible/gi, 'AI analysis available'],
  [/Análisis del hallazgo/gi, 'Finding analysis'],
  // TCDX-I18N-FINDINGS-ACTIONS-CONTROL-END
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
