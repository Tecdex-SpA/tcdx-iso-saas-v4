# IA Auditor Senior — Cierre Fase 3

## Resumen ejecutivo

La Fase 3 deja IA Auditor Senior como primera versión productiva inicial dentro de TCDX ISO SaaS.

El módulo queda integrado como un auditor asistido por IA que analiza información real del tenant, genera recomendaciones, prepara borradores seguros, conserva historial, permite revisión humana y exporta reportes PDF ejecutivos.

La IA no reemplaza al auditor humano. No aprueba, no cierra, no modifica evidencias, no crea hallazgos definitivos ni altera registros críticos sin intervención humana.

## Arquitectura funcional

Componentes principales:

- Frontend: `/ia-auditor`.
- Backend: `/api/ai-auditor`.
- Motor IA: `ai-engine`, invocado por backend.
- Base de datos: `ai_auditor_runs` para historial y revisión humana.
- QA: `scripts/qa-ai-auditor-full.sh`.
- PDF: reporte ejecutivo desde análisis actual o historial.

## Endpoints productivos

### Alcance y análisis

- `GET /api/ai-auditor/scope`
- `POST /api/ai-auditor/analyze`

### Sugerencias accionables

- `POST /api/ai-auditor/suggestions/:type/prepare`

Tipos soportados:

- `finding`
- `action_plan`
- `evidence`
- `nonconformity`

### Historial

- `GET /api/ai-auditor/history`
- `GET /api/ai-auditor/history/:id`

### Revisión humana

- `PATCH /api/ai-auditor/history/:id/review`

Estados:

- `pending`
- `reviewed`
- `accepted`
- `rejected`
- `needs_more_evidence`

### PDF

- `POST /api/ai-auditor/report`
- `GET /api/ai-auditor/history/:id/report`

## Flujo funcional

1. Usuario abre `/ia-auditor`.
2. Selecciona norma, foco y profundidad.
3. Ejecuta análisis.
4. Backend construye scope real del tenant.
5. Backend llama a ai-engine.
6. Si ai-engine falla, backend mantiene fallback seguro.
7. Resultado conserva:
   - `human_review_required=true`
   - `can_create_records=false`
   - `trace.db_write=false`
8. Se guarda historial en `ai_auditor_runs`.
9. Usuario puede preparar sugerencias.
10. Usuario puede revisar ejecución histórica.
11. Usuario puede descargar PDF ejecutivo.

## Flujo de seguridad

IA Auditor es no destructivo.

No realiza automáticamente:

- creación de hallazgos reales;
- creación de planes reales;
- creación de evidencias reales;
- creación de no conformidades reales;
- cierre de controles;
- aprobación de auditorías;
- modificación de evidencia histórica.

El endpoint de revisión humana solo actualiza campos de gobernanza en `ai_auditor_runs`.

## Historial

El historial permite conservar trazabilidad por:

- tenant;
- usuario;
- norma;
- foco;
- profundidad;
- score;
- readiness;
- uso de ai-engine;
- resultado completo;
- trazabilidad;
- revisión humana.

## Revisión humana

La revisión humana registra:

- estado de revisión;
- comentario;
- usuario revisor;
- fecha de revisión.

Esta revisión no equivale a cierre formal de auditoría ni aprobación de controles.

## PDF ejecutivo

El PDF incluye:

- encabezado TCDX by Tecdex;
- score;
- readiness;
- cobertura;
- resumen ejecutivo;
- opinión auditora;
- brechas;
- sugerencias;
- trazabilidad;
- revisión humana;
- gobernanza;
- advertencia de no reemplazo humano.

## QA

El script principal es:

```bash
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:3000 EMAIL=admin@rieltec.com PASSWORD=123456 bash ./scripts/qa-ai-auditor-full.sh
```

Valida:

- login;
- scope;
- analyze en/es;
- ai-engine/fallback;
- historial;
- revisión humana;
- PDF;
- prepare;
- rutas frontend;
- flags de seguridad.

## Límites actuales

IA Auditor no hace todavía:

- permisos finos por rol a nivel funcional granular;
- comparación histórica visual avanzada;
- benchmarking externo automático;
- cierre formal de ciclo de vida ISO;
- aprobación automática de hallazgos;
- firma digital avanzada;
- versionado formal de PDF en módulo exportes.

## Qué no hace la IA

- No reemplaza auditor humano.
- No aprueba controles.
- No cierra planes.
- No crea registros críticos.
- No modifica evidencia.
- No decide certificación.
- No cambia datos del cliente.

## Checklist de aceptación Fase 3

- [ ] Backend compila.
- [ ] Frontend compila.
- [ ] ai-engine py_compile OK.
- [ ] QA IA Auditor FAIL 0.
- [ ] Curl final FAIL 0.
- [ ] PDF actual funciona.
- [ ] PDF histórico funciona.
- [ ] Revisión humana funciona.
- [ ] Historial funciona.
- [ ] Prepare/drafts funcionan.
- [ ] Navegación funciona.
- [ ] No se crean registros críticos automáticamente.

## Próximos pasos recomendados Fase 4

1. Permisos finos y roles avanzados.
2. Dashboard ejecutivo histórico IA Auditor.
3. Comparación temporal de auditorías IA.
4. Integración con ciclo de vida ISO.
5. Exportes premium consolidados.
6. Demo comercial final SaaS.
