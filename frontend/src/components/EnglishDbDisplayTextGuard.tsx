'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translateDisplayText } from '@/i18n/displayText';

// Phase 5A.4: SELECT/OPTION labels are allowed; option values are not modified.
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'CANVAS',
  'SVG',
  'CODE',
  'PRE',
  'INPUT',
  'TEXTAREA',
]);

const EXACT_REPLACEMENTS: Record<string, string> = {
  // Generic UI/data words
  'diagnóstico': 'Diagnostic',
  'diagnostico': 'Diagnostic',
  'diagnóstico inicial': 'Initial diagnostic',
  'diagnostico inicial': 'Initial diagnostic',
  'matriz de riesgo': 'Risk matrix',
  'matriz de riesgos': 'Risk matrix',
  'declaración de aplicabilidad': 'Statement of Applicability',
  'declaracion de aplicabilidad': 'Statement of Applicability',
  'soa': 'SOA',
  'cumplimiento': 'Compliance',
  'riesgo': 'Risk',
  'riesgos': 'Risks',
  'activo': 'Asset',
  'activos': 'Assets',
  'control': 'Control',
  'controles': 'Controls',
  'cláusula': 'Clause',
  'clausula': 'Clause',
  'categoría': 'Category',
  'categoria': 'Category',
  'categorías': 'Categories',
  'categorias': 'Categories',
  'descripción': 'Description',
  'descripcion': 'Description',
  'observación': 'Observation',
  'observacion': 'Observation',
  'observaciones': 'Observations',
  'recomendación': 'Recommendation',
  'recomendacion': 'Recommendation',
  'recomendaciones': 'Recommendations',
  'justificación': 'Justification',
  'justificacion': 'Justification',
  'aplicabilidad': 'Applicability',
  'responsable': 'Owner',
  'sin responsable': 'No owner',
  'estado': 'Status',
  'prioridad': 'Priority',
  'severidad': 'Severity',
  'salud': 'Health',
  'avance': 'Progress',
  'fecha': 'Date',
  'fecha límite': 'Due date',
  'fecha limite': 'Due date',
  'vencimiento': 'Due date',
  'última revisión': 'Last review',
  'ultima revision': 'Last review',
  'última actualización': 'Last update',
  'ultima actualizacion': 'Last update',
  'creado por': 'Created by',
  'subido por': 'Uploaded by',

  // SOA / diagnostics
  'aplican': 'Applicable',
  'no aplican': 'Not applicable',
  'implementados': 'Implemented',
  'implementado': 'Implemented',
  'implementada': 'Implemented',
  'pendientes': 'Pending',
  'pendiente': 'Pending',
  'estado diagnóstico': 'Diagnostic status',
  'estado diagnostico': 'Diagnostic status',
  'incluido': 'Included',
  'incluida': 'Included',
  'excluido': 'Excluded',
  'excluida': 'Excluded',
  'anexo a': 'Annex A',
  'control de seguridad': 'Security control',
  'controles aplicables': 'Applicable controls',
  'controles no aplicables': 'Non-applicable controls',
  'brecha': 'Gap',
  'brechas': 'Gaps',
  'sin brechas': 'No gaps',
  'completitud': 'Completeness',
  'madurez': 'Maturity',
  'evaluación': 'Assessment',
  'evaluacion': 'Assessment',
  'evaluación de cumplimiento': 'Compliance assessment',
  'evaluacion de cumplimiento': 'Compliance assessment',
  'parcialmente implementado': 'Partially implemented',
  'parcialmente implementada': 'Partially implemented',
  'requiere atención': 'Requires attention',
  'requiere atencion': 'Requires attention',

  // Controls / evidence / actions
  'evidencia': 'Evidence',
  'evidencias': 'Evidence',
  'tipo de evidencia': 'Evidence type',
  'motivo de rechazo': 'Rejection reason',
  'archivo': 'File',
  'archivos': 'Files',
  'validada': 'Validated',
  'validado': 'Validated',
  'rechazada': 'Rejected',
  'rechazado': 'Rejected',
  'plan de acción': 'Action plan',
  'plan de accion': 'Action plan',
  'planes de acción': 'Action plans',
  'planes de accion': 'Action plans',
  'acción': 'Action',
  'accion': 'Action',
  'acciones': 'Actions',
  'acción correctiva': 'Corrective action',
  'accion correctiva': 'Corrective action',
  'última acción': 'Last action',
  'ultima accion': 'Last action',
  'comentario': 'Comment',
  'comentarios': 'Comments',
  'último comentario': 'Last comment',
  'ultimo comentario': 'Last comment',
  'bloqueo': 'Blocker',
  'bloqueos': 'Blockers',
  'último bloqueo': 'Last blocker',
  'ultimo bloqueo': 'Last blocker',
  'tarea': 'Task',
  'tareas': 'Tasks',
  'actividad': 'Activity',
  'actividades': 'Activities',

  // System/catalogs frequently seen in DB/demo data
  'gestión documental': 'Document management',
  'gestion documental': 'Document management',
  'gestión de riesgos': 'Risk management',
  'gestion de riesgos': 'Risk management',
  'gestión de incidentes': 'Incident management',
  'gestion de incidentes': 'Incident management',
  'control de cambios': 'Change control',
  'auditoría interna': 'Internal audit',
  'auditoria interna': 'Internal audit',
  'mejora continua': 'Continual improvement',
  'seguridad de la información': 'Information security',
  'seguridad de la informacion': 'Information security',
  'sistema de gestión': 'Management system',
  'sistema de gestion': 'Management system',
  'operación': 'Operation',
  'operacion': 'Operation',
  'apoyo': 'Support',
  'liderazgo': 'Leadership',
  'planificación': 'Planning',
  'planificacion': 'Planning',
  'evaluación del desempeño': 'Performance evaluation',
  'evaluacion del desempeno': 'Performance evaluation',
  'contexto de la organización': 'Context of the organization',
  'contexto de la organizacion': 'Context of the organization',

  // AI compliance
  'ia compliance': 'AI Compliance',
  'ia auditor': 'AI Auditor',
  'auditor ia': 'AI Auditor',
  'sugerencia': 'Suggestion',
  'sugerencias': 'Suggestions',
  'tipo de sugerencia': 'Suggestion type',
  'vista previa': 'Preview',
  'generada por ia': 'Generated by AI',
  'generado por ia': 'Generated by AI',
  'crear plan de acción': 'Create action plan',
  'crear plan de accion': 'Create action plan',
  'crear hallazgo': 'Create finding',
  'crear evidencia': 'Create evidence',
  'crear no conformidad': 'Create nonconformity',

  // Statuses
  'en progreso': 'In progress',
  'en curso': 'In progress',
  'borrador': 'Draft',
  'abierto': 'Open',
  'abierta': 'Open',
  'cerrado': 'Closed',
  'cerrada': 'Closed',
  'resuelto': 'Resolved',
  'resuelta': 'Resolved',
  'pendiente aprobación': 'Pending approval',
  'pendiente aprobacion': 'Pending approval',
  'aprobado': 'Approved',
  'aprobada': 'Approved',
  'cancelado': 'Cancelled',
  'cancelada': 'Cancelled',
  'completado': 'Completed',
  'completada': 'Completed',
  'bloqueado': 'Blocked',
  'bloqueada': 'Blocked',
  'atrasado': 'Overdue',
  'atrasada': 'Overdue',
  'vencido': 'Overdue',
  'vencida': 'Overdue',

  // Priority/severity
  'crítico': 'Critical',
  'critico': 'Critical',
  'crítica': 'Critical',
  'critica': 'Critical',
  'alto': 'High',
  'alta': 'High',
  'medio': 'Medium',
  'media': 'Medium',
  'bajo': 'Low',
  'baja': 'Low',
  'mayor': 'Major',
  'menor': 'Minor',
};

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Cláusula\s+(\d+)\s*:\s*/gi, 'Clause $1: '],
  [/Clausula\s+(\d+)\s*:\s*/gi, 'Clause $1: '],
  [/cláusula\s+(\d+)/gi, 'clause $1'],
  [/clausula\s+(\d+)/gi, 'clause $1'],

  [/Declaración de Aplicabilidad/gi, 'Statement of Applicability'],
  [/Declaracion de Aplicabilidad/gi, 'Statement of Applicability'],
  [/Estado diagnóstico/gi, 'Diagnostic status'],
  [/Estado diagnostico/gi, 'Diagnostic status'],
  [/Matriz de Riesgo/gi, 'Risk Matrix'],
  [/Matriz de riesgos/gi, 'Risk Matrix'],
  [/Plan de acción/gi, 'Action plan'],
  [/Plan de accion/gi, 'Action plan'],
  [/Acción correctiva/gi, 'Corrective action'],
  [/Accion correctiva/gi, 'Corrective action'],
  [/Tipo de evidencia/gi, 'Evidence type'],
  [/Motivo de rechazo/gi, 'Rejection reason'],
  [/Última acción/gi, 'Last action'],
  [/Ultima accion/gi, 'Last action'],
  [/Último comentario/gi, 'Last comment'],
  [/Ultimo comentario/gi, 'Last comment'],
  [/Último bloqueo/gi, 'Last blocker'],
  [/Ultimo bloqueo/gi, 'Last blocker'],

  [/Gestión documental/gi, 'Document management'],
  [/Gestion documental/gi, 'Document management'],
  [/Gestión de riesgos/gi, 'Risk management'],
  [/Gestion de riesgos/gi, 'Risk management'],
  [/Gestión de incidentes/gi, 'Incident management'],
  [/Gestion de incidentes/gi, 'Incident management'],
  [/Control de cambios/gi, 'Change control'],
  [/Auditoría interna/gi, 'Internal audit'],
  [/Auditoria interna/gi, 'Internal audit'],
  [/Mejora continua/gi, 'Continual improvement'],
  [/Seguridad de la información/gi, 'Information security'],
  [/Seguridad de la informacion/gi, 'Information security'],
  [/Sistema de gestión/gi, 'Management system'],
  [/Sistema de gestion/gi, 'Management system'],
  [/Evaluación del desempeño/gi, 'Performance evaluation'],
  [/Evaluacion del desempeno/gi, 'Performance evaluation'],
  [/Contexto de la organización/gi, 'Context of the organization'],
  [/Contexto de la organizacion/gi, 'Context of the organization'],

  [/Revisión de accesos privilegiados/gi, 'Privileged access review'],
  [/Revision de accesos privilegiados/gi, 'Privileged access review'],
  [/Proveedores evaluados/gi, 'Evaluated suppliers'],
  [/Casa matriz/gi, 'Headquarters'],
  [/Contrato creado desde cotización aceptada/gi, 'Contract created from accepted quotation'],
  [/Contrato creado desde cotizacion aceptada/gi, 'Contract created from accepted quotation'],

  [/Tipo de sugerencia/gi, 'Suggestion type'],
  [/Vista previa/gi, 'Preview'],
  [/Generada por IA/gi, 'Generated by AI'],
  [/Generado por IA/gi, 'Generated by AI'],
];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;

  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[data-i18n-skip="true"]')) return true;
  if (parent.closest('[contenteditable="true"]')) return true;
  if (parent.closest('input, textarea, script, style, code, pre')) return true;

  return false;
}

function translateVisualText(value: string) {
  const original = value;
  const trimmed = original.trim();

  if (!trimmed) return original;

  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  const normalized = normalize(trimmed);

  const direct = EXACT_REPLACEMENTS[trimmed.toLowerCase()] || EXACT_REPLACEMENTS[normalized];

  if (direct) return `${leading}${direct}${trailing}`;

  const central = translateDisplayText(trimmed, 'en', 'generic');
  if (central && central !== trimmed) return `${leading}${central}${trailing}`;

  let translated = trimmed;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  if (translated !== trimmed) return `${leading}${translated}${trailing}`;

  return original;
}

export default function EnglishDbDisplayTextGuard() {
  const { locale } = useLanguage();
  const originalsRef = useRef<WeakMap<Text, string>>(new WeakMap());

  useEffect(() => {
    const root = document.body;
    if (!root) return;

    const originals = originalsRef.current;

    const restore = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;

      while (node) {
        const original = originals.get(node);
        if (original !== undefined && node.nodeValue !== original) {
          node.nodeValue = original;
        }
        node = walker.nextNode() as Text | null;
      }
    };

    const apply = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;

      while (node) {
        if (!shouldSkipNode(node)) {
          const current = node.nodeValue ?? '';
          if (!originals.has(node)) {
            originals.set(node, current);
          }

          const source = originals.get(node) ?? current;
          const translated = translateVisualText(source);

          if (translated !== current) {
            node.nodeValue = translated;
          }
        }

        node = walker.nextNode() as Text | null;
      }
    };

    if (locale !== 'en') {
      restore();
      return;
    }

    apply();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(apply);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}
