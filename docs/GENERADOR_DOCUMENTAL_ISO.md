# Generador Documental ISO

## Objetivo

La Fase 1.5 agrega un generador documental multinorma para politicas, procedimientos y documentos de preparacion. Usa la base `iso_*`, plantillas gobernadas y diagnosticos express para producir borradores utiles sin modificar datos operativos.

## Modelo de Datos

Tablas nuevas:

- `iso_generated_documents`: documento generado, markdown, variables y trazabilidad.
- `iso_generated_document_sections`: secciones del documento.
- `iso_document_generation_runs`: ejecuciones del generador.
- `iso_document_audit_log`: acciones sobre documentos.

Vistas nuevas:

- `v_iso_generated_documents_latest`: ultima version activa por tenant/norma/tipo/template.
- `v_iso_document_summary_by_tenant`: resumen de documentos por tenant y norma.

## Endpoints

Todos requieren JWT/RBAC:

- `GET /api/iso-document-generator/:tenantId/options`
- `GET /api/iso-document-generator/:tenantId/templates`
- `GET /api/iso-document-generator/:tenantId/documents`
- `GET /api/iso-document-generator/:tenantId/documents/:documentId`
- `POST /api/iso-document-generator/:tenantId/generate`
- `POST /api/iso-document-generator/:tenantId/documents/:documentId/regenerate`
- `POST /api/iso-document-generator/:tenantId/documents/:documentId/archive`
- `GET /api/iso-document-generator/:tenantId/summary`

## Como Genera Politicas

El motor arma una estructura deterministica:

- Objetivo
- Alcance
- Referencias internas
- Roles y responsabilidades
- Principios de cumplimiento
- Reglas principales
- Evidencias requeridas
- Seguimiento y revision
- Mejora continua
- Control documental
- Disclaimer

La fuente preferida es `iso_policy_templates`. Si no hay plantilla para una norma especifica, usa una plantilla virtual gobernada y conservadora para que el flujo comercial funcione.

## Como Genera Procedimientos

El motor arma:

- Objetivo
- Alcance
- Entradas
- Responsables
- Actividades paso a paso
- Registros/evidencias
- Indicadores sugeridos
- Riesgos y controles asociados
- Frecuencia de revision
- Control de cambios
- Disclaimer

La fuente preferida es `iso_procedure_templates`.

## Relacion con Diagnostico Express

Si se envia `source_assessment_id`, el documento incluye:

- nivel de readiness;
- brechas principales;
- recomendaciones;
- evidencias esperadas;
- prioridades de revision.

No crea `action_plans`, `findings` ni `evidences`.

## Reglas ISO9001 2026_FDIS

`ISO9001 / 2026_FDIS` solo permite `document_type=transition_guidance`.

El documento incluye disclaimer obligatorio:

- no es version final certificable;
- no reemplaza ISO9001:2015;
- no habilita certificacion final;
- no crea controles tenant.

## Reglas ISO42001

Puede generar documentos de gobierno IA, inventario, evaluacion de impacto, supervision humana, transparencia, proveedores, datos y monitoreo. Si no hay cobertura operativa, el resultado debe tratarse como borrador preliminar.

## Seguridad Multitenant

El `tenantId` de la URL se valida contra `req.user.tenant_id`, salvo roles plataforma. El body no es fuente de tenant. Las consultas son parametrizadas y no se guardan tokens ni secretos en trazas.

## Aplicar Migracion

```bash
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f database/migrations/20260506_iso_document_generator.sql
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT USAGE ON SCHEMA public TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT, INSERT, UPDATE ON iso_generated_documents, iso_generated_document_sections, iso_document_generation_runs, iso_document_audit_log TO tecdex_user;"
psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "GRANT SELECT ON v_iso_generated_documents_latest, v_iso_document_summary_by_tenant TO tecdex_user;"
```

## Validar

```bash
export API="http://bk.tcdx.int:3000"
export TOKEN="PEGAR_TOKEN_VALIDO"
export TENANT_ID="PEGAR_TENANT_ID_VALIDO"

bash scripts/validate-iso-document-generator.sh
```

## Que No Hace Todavia

- No exporta PDF.
- No gestiona aprobaciones formales.
- No firma documentos.
- No crea evidencias.
- No crea planes de accion.
- No crea findings.
- No modifica controles operativos.
- No usa `ai-engine`.

## Proximos Pasos

La siguiente fase natural es exportacion PDF/Word premium con portada, metadatos, versionado visible y paquete ejecutivo para auditoria/demo.
