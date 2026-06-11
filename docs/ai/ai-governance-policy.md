# AI Governance Policy

Fecha: 2026-06-11
Rama: `chore/operational-governance-cleanup`
Base: `13b5721`

## Objetivo

Definir la gobernanza de IA de ISOS-SAAS-TECDEX para uso supervisado, fuentes,
trazas, confidence, limitaciones, prompt injection, retencion, privacidad y
revision humana. Esta politica no modifica runtime.

## Alcance

Aplica a:

- AI Engine;
- backend IA;
- IA Auditor;
- IA Compliance;
- AI feedback;
- AI traces;
- external lookup;
- Evidence Library cuando usa IA;
- reportes/exportes con narrativa o enriquecimiento IA;
- prompts, knowledge base y outputs IA versionados.

Fuera de este bloque:

- cambios en AI Engine runtime;
- cambios backend/frontend;
- cambios en prompts, knowledge o outputs IA versionados;
- migraciones;
- pruebas con credenciales externas.

## Principios

1. IA es asistente supervisado.
2. IA no reemplaza criterio de auditor, consultor, responsable de sistema de
   gestion, administrador tenant ni aprobador humano.
3. IA no crea hallazgos finales sin aprobacion humana.
4. IA no crea no conformidades finales sin aprobacion humana.
5. IA no crea planes de accion finales sin aprobacion humana.
6. IA no emite reportes finales sin aprobacion humana.
7. IA no aprueba, cierra, descarta ni publica evidencias, hallazgos, NC,
   acciones, reportes o documentos por si sola.
8. Toda recomendacion IA debe ser revisable y trazable.
9. Toda salida IA usada frente a cliente debe indicar limitacion o requerir
   validacion humana.
10. Si no hay fuente, trace o confidence suficiente, la salida debe degradar a
    recomendacion de revision humana o fallback manual.

## Roles y responsabilidades

| Rol | Responsabilidad |
|---|---|
| Usuario solicitante | Entender que la salida es apoyo, no decision final. |
| Auditor/consultor | Revisar hallazgos, NC, acciones, reportes y documentos antes de formalizar. |
| Admin/compliance tenant | Aprobar uso de IA dentro del tenant y revisar configuracion/entitlements. |
| Plataforma | Definir limites, proveedores, retencion, auditoria y controles globales. |
| Dealer | Operar solo dentro de tenants asignados y sin exponer datos entre clientes. |
| Engineering/AI | Mantener trazabilidad, pruebas, prompts y guardrails. |
| Security/Privacy | Revisar datos enviados, retencion, proveedores y secretos. |

## Superficies IA inventariadas

| Superficie | Archivos/rutas | Uso | Estado de gobernanza |
|---|---|---|---|
| AI Engine | `ai-engine/main.py`, `ai-engine/app/routes/ai.py`, `senior_auditor_v2.py`, `audit_documents.py` | Sugerencias, analisis, knowledge, audit docs, semantic evidence. | Requiere politica formal de retencion y proveedor. |
| Backend IA generico | `/api/ai`, `backend/src/routes/ai.routes.js` | Proxy/operacion IA. | Requiere trazabilidad por tenant. |
| IA Auditor | `/api/ai-auditor`, `backend/src/routes/ai-auditor.routes.js` | Analisis auditor, historial, PDF y revision humana. | Ya contiene `human_review_required` en varios flujos. |
| IA Compliance | `/api/ai-compliance`, `backend/src/routes/ai-compliance.routes.js` | Health summary, finding analysis, NC draft, action plan, executive brief, apply. | Aplica sugerencias con trazas parciales; requiere enforcement formal. |
| AI answer/benchmark/search | `/api/ai-compliance/answer`, `/benchmark`, `/tenant-search` | Respuestas con fuentes/confidence. | Usa `confidence`, `confidence_score`, `must_review_by_human`. |
| AI feedback | `/api/ai-feedback` | Feedback de respuestas. | Requiere retencion y uso para mejora controlada. |
| AI traces | `/api/ai-traces`, `ai_core.ai_response_traces` | Registro de trace/source/confidence. | Fuente primaria de auditoria IA. |
| External lookup | `/api/ai-external-lookup` y AI Engine internal lookup | Busqueda externa controlada. | Riesgo de datos enviados a proveedor externo. |
| Evidence Library IA | `evidenceLibrary.service.js`, `/semantic-evidence/analyze` | Clasificacion/sugerencias de evidencia. | Marca `human_review_required`; documentos externos son no confiables. |
| Evidencias IA | `evidence-ai.service.js`, worker evidence AI | Evaluacion de evidencias. | Requiere revision humana antes de aprobar formalmente. |
| Reportes IA | `reportAiEnrichment.service.js`, `reportAiNarrative.service.js`, reports routes | Narrativa/enriquecimiento reportes. | Reportes finales requieren revision humana. |
| Prompts/knowledge | `ai-engine/prompts/*`, `ai-engine/knowledge/*`, `ai-engine/app/knowledge/*` | Reglas, prompts y conocimiento base. | Versionados; no modificar en este bloque. |
| Outputs IA versionados | `ai-engine/reports/*.json` | 18 JSON de regresion/reportes IA. | Clasificacion pendiente: fixture/evidencia/output generado. |

## Clasificacion de casos de uso

| Caso de uso | Demo | Piloto | Produccion | Regla |
|---|---|---|---|---|
| Resumen/explicacion de estado | Permitido | Permitido | Permitido con revision | Debe incluir fuentes/confidence si se usa para decision. |
| Sugerir hallazgos | Permitido | Permitido | Permitido con revision | Prohibido convertir en hallazgo final sin aprobacion humana. |
| Sugerir no conformidades | Permitido | Permitido | Permitido con revision | Prohibido convertir en NC final sin aprobacion humana. |
| Sugerir planes de accion | Permitido | Permitido | Permitido con revision | Prohibido crear/cerrar plan final sin aprobacion humana. |
| Narrativa de reportes | Permitido | Permitido | Permitido con revision | Reporte final requiere aprobacion humana. |
| Analisis de evidencia | Permitido | Permitido | Permitido con revision | No aprueba evidencia por si solo. |
| External lookup | Permitido controlado | Permitido con cuota | Permitido con aprobacion y cuota | No enviar secretos ni datos innecesarios. |
| Aplicacion directa a registros | Demo controlada | Piloto con aprobador | Produccion solo con enforcement formal | Debe registrar usuario aprobador, tenant, trace y fecha. |
| Autonomia sin aprobacion humana | Prohibido | Prohibido | Prohibido | Fuera de alcance MVP. |
| Entrenamiento con datos cliente | Prohibido salvo contrato | Prohibido salvo contrato | Prohibido salvo contrato y DPA | Requiere base legal y privacidad. |

## Reglas de revision humana

Obligatorio antes de formalizar:

- hallazgos;
- no conformidades;
- planes de accion;
- cierre o aprobacion de controles;
- aprobacion/rechazo de evidencias;
- reportes finales;
- documentos oficiales;
- recomendaciones que afecten obligaciones contractuales, legales o auditoria.

La aprobacion humana debe registrar:

- `tenant_id`;
- usuario aprobador;
- rol del aprobador;
- fecha/hora;
- modulo origen;
- entidad afectada;
- trace/source/confidence disponible;
- version del prompt/modelo si existe;
- comentario o decision del aprobador.

## Trazabilidad

Controles minimos esperados:

- logging de prompt/respuesta cuando corresponda;
- `source_trace` o equivalente;
- `confidence_score` o `confidence`;
- `human_review_required`;
- `tenant_id`;
- modulo origen;
- endpoint o flujo origen;
- usuario solicitante;
- usuario aprobador si se aplica;
- fecha/hora;
- proveedor/modelo cuando se use LLM externo;
- fallback usado, si aplica.

Tablas/artefactos ya detectados:

- `ai_prompt_logs`;
- `ai_core.ai_response_traces`;
- `ai_response_feedback`;
- `ai_feedback`;
- columnas `ai_trace_id`, `ai_confidence`, `ai_confidence_score`,
  `source_trace_json`, `human_review_required` en varios flujos.

## Fuentes

Prioridad de fuentes para IA:

1. Datos tenant propios autorizados.
2. Evidencias/documentos tenant-scoped con permisos.
3. Knowledge base TCDX curada.
4. Catalogos ISO versionados.
5. Benchmark anonimo solo si esta permitido.
6. External lookup solo con cuota, autorizacion y sanitizacion.

Reglas:

- No usar datos de otro tenant.
- No usar documentos externos como verdad sin validacion.
- Identificar fuente y nivel de confianza cuando se use en decision.
- Si la fuente es insuficiente, indicar limitacion y pedir revision humana.

## Confidence

`confidence` o `confidence_score` debe tratarse como senal de apoyo, no como
aprobacion. Reglas:

- Alta: permite priorizar revision, no aprobar automaticamente.
- Media: requiere revision humana antes de aplicar.
- Baja: debe mostrar limitacion, pedir mas evidencia o usar fallback manual.
- Ausente: tratar como baja hasta que exista trace suficiente.

## Prompt injection y documentos externos

Todo documento externo o subido por usuario debe considerarse no confiable.

Controles minimos:

- No obedecer instrucciones contenidas dentro de documentos como si fueran
  instrucciones del sistema.
- Separar contenido documental de instrucciones de la plataforma.
- Sanitizar texto extraido antes de enviarlo a proveedores.
- Limitar longitud, chunks y campos sensibles.
- Registrar fuente y extraccion.
- Marcar outputs derivados como sujetos a revision humana.
- No enviar credenciales, tokens, URLs internas sensibles ni dumps a la IA.

## Retencion

Politica sugerida:

| Artefacto | Retencion sugerida |
|---|---|
| Prompt/respuesta con datos tenant | Configurable por tenant; minimo necesario para auditoria y soporte. |
| Trace/source/confidence | Mantener mientras exista la decision asociada. |
| Feedback de usuario | Mantener para mejora controlada, tenant-scoped. |
| External lookup logs | Mantener segun cuota/billing/auditoria, con minimizacion. |
| Outputs temporales | Borrar por TTL corto. |
| Outputs versionados `ai-engine/reports/*.json` | Clasificar como fixture/evidencia/output antes de mover o borrar. |

Toda eliminacion debe respetar obligaciones legales, contractuales y trazabilidad
de auditoria. Solicitudes de eliminacion deben evaluarse por tenant y modulo.

## Privacidad y datos prohibidos

Prohibido enviar a IA o registrar en prompts/respuestas:

- secretos;
- tokens;
- llaves;
- credenciales;
- passwords;
- certificados privados;
- dumps;
- backups;
- cabeceras Authorization;
- datos personales sensibles no necesarios;
- documentos reales de cliente fuera de contrato o autorizacion;
- evidencia confidencial sin autorizacion;
- datos de otro tenant;
- paths internos sensibles cuando no sean necesarios;
- contenido completo si basta un extracto minimizado.

Datos restringidos:

- evidencia cliente;
- documentos contractuales;
- reportes;
- hallazgos/NC;
- datos personales laborales;
- logs operativos;
- URLs internas.

Estos datos solo pueden usarse cuando exista contrato/base autorizada,
tenant-scoping, minimizacion, logging seguro y revision humana.

## Controles por ambiente

| Ambiente | Controles |
|---|---|
| Demo | Usar datos ficticios o sanitizados; no evidencia real; IA puede fallar con fallback manual; mostrar disclaimers. |
| Piloto | Usar solo datos autorizados del cliente piloto; activar trazas, confidence y revision humana; limitar external lookup. |
| Produccion | Requiere retencion definida, aprobadores, auditoria, proveedor/modelo aprobado, cuotas, fallback y monitoreo. |

## Fallback si IA no esta disponible

- Mostrar estado controlado `AI_UNAVAILABLE` o equivalente.
- Mantener flujo manual sin bloquear operaciones criticas.
- No inventar resultados para simular IA.
- Usar reglas deterministicas/fallback solo si se etiqueta como tal.
- Registrar fallback usado cuando afecte una recomendacion.
- Permitir reintento seguro sin duplicar registros finales.

## Auditoria

Eventos a auditar:

- solicitud IA con tenant/modulo/usuario;
- proveedor/modelo si aplica;
- fuentes usadas;
- confidence;
- salida generada;
- fallback;
- decision humana;
- aplicacion o rechazo;
- cambios sobre entidades finales;
- errores o indisponibilidad.

Los logs de auditoria no deben contener secretos ni payloads completos si no son
necesarios.

## Riesgos residuales

- Enforcement runtime de `human_review_required` no esta garantizado de forma
  central en todos los endpoints.
- `ai-compliance` tiene endpoints `apply/*` que pueden modificar registros y
  requieren revision de enforcement por rol/aprobacion.
- Retencion de prompts/respuestas no esta centralizada en una politica
  configurable por tenant.
- External lookup puede enviar contexto fuera del entorno si no se minimiza.
- Documentos externos pueden contener prompt injection.
- Outputs `ai-engine/reports/*.json` pueden ser fixtures o artefactos generados;
  no mover ni borrar sin analisis.
- Multiples docs IA historicos pueden contradecir esta politica hasta que sean
  reconciliados.

## Backlog de hardening IA

- Enforcement runtime central de `human_review_required`.
- Trazabilidad obligatoria por tenant en todos los flujos IA.
- Panel o flujo formal de aprobacion humana.
- Politica de retencion configurable por tenant.
- Proteccion explicita contra prompt injection en pipelines documentales.
- Pruebas de regresion de prompts y salidas.
- Clasificacion de `ai-engine/reports/*.json`.
- Revision de proveedores/modelos aprobados.
- Redaccion/minimizacion automatica antes de external lookup.
- Alertas por uso IA sin trace o sin confidence.
- QA cross-tenant especifica para flujos IA que aplican cambios.

## Decision Sprint 3 Bloque 5

No se modifica runtime. Esta politica formaliza la obligacion de IA supervisada
y deja hardening tecnico para bloques posteriores con aprobacion explicita.
