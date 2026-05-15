# Preparación documental ISO 27001:2022 - base inicial

## Alcance

La salida comercial inicial soporta ISO 9001:2015 y deja una base funcional para ISO 27001:2022 usando el mismo motor documental multi-standard.

Esta pasada no implementa todo el universo documental SGSI. Agrega plantillas mínimas para que un tenant con ISO 27001 activo pueda crear paquete, construir contexto, generar documentos base, revisar pendientes y exportar ZIP.

## Seed

Archivo:

```txt
database/seeds/20260515_seed_audit_document_templates_iso27001.sql
```

Plantillas:

- `alcance_sgsi`
- `politica_seguridad_informacion`
- `declaracion_aplicabilidad_soa`
- `matriz_riesgos_sgsi`
- `procedimiento_gestion_incidentes_seguridad`
- `procedimiento_control_accesos`
- `revision_direccion_sgsi`
- `programa_auditoria_interna_sgsi`
- `indice_evidencias_sgsi`

## AI engine

Prompt:

```txt
ai-engine/prompts/iso27001_audit_document_generator_v1.md
```

El generador mantiene reglas de no invención:

- no inventar riesgos;
- no inventar incidentes;
- no inventar responsables;
- no inventar controles aplicables;
- no presentar riesgos inferidos como matriz formal aprobada;
- marcar pendientes y evidencias faltantes.

## Validación

```sql
SELECT COUNT(*) AS templates_iso27001
FROM audit_document_templates
WHERE standard_code = 'ISO27001';
```

Resultado esperado:

```txt
templates_iso27001 = 9
```

## Limitaciones

- La profundidad del SGSI depende de que existan controles, evidencias, incidentes, activos, SoA o matriz formal en plataforma.
- Si no hay matriz formal, el sistema usa fallback desde controles, hallazgos, no conformidades, acciones y ZIP, marcado como inferencia no aprobada.
- No se crean módulos nuevos de riesgos, proveedores, incidentes o activos en esta pasada.
