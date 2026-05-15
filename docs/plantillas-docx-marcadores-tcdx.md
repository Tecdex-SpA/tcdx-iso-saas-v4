# Plantillas DOCX con marcadores TCDX

## Objetivo

Para preservar el formato visual exacto de un DOCX del cliente, la plantilla debe incluir marcadores TCDX. El sistema reemplaza sólo los párrafos que contienen esos marcadores y conserva el resto del paquete DOCX: estilos, encabezados, pies, logos, numeración, tablas e imágenes.

## Marcadores soportados

```txt
{{TCDX_SECTION:<key>}}
{{TCDX_FIELD:<key>}}
{{TCDX_TABLE:<key>}}
{{TCDX_CONTENT}}
{{tcdx_content}}
{{contenido_tcdx}}
[TCDX_CONTENT]
[CONTENIDO_TCDX]
```

Ejemplos:

```txt
{{TCDX_SECTION:alcance_sgc}}
{{TCDX_FIELD:responsable_aprobacion}}
{{TCDX_TABLE:objetivos_calidad}}
```

## Estrategias de preservación

| Modo | Cuándo aplica | Resultado |
| --- | --- | --- |
| `preserve_exact_with_markers` | DOCX original contiene marcadores compatibles | Se genera una copia DOCX basada en el original, reemplazando sólo marcadores. |
| `preserve_original_attach_generated_annex` | DOCX original no tiene marcadores o no es seguro modificarlo | El original queda intacto y se genera un anexo/documento TCDX con cambios, gaps y trazabilidad. |
| `generate_tcdx_new` | No existe original compatible | Se genera documento nuevo con formato TCDX. |

## Buenas prácticas para clientes

- Colocar marcadores en párrafos propios.
- No dividir un marcador entre varias cajas de texto.
- Mantener un marcador por sección/tablas a actualizar.
- Usar nombres estables: `alcance_sgc`, `politica_calidad`, `objetivos_calidad`, `revision_direccion`, `soa`, `matriz_riesgos`.
- Conservar versión original del DOCX; TCDX nunca sobrescribe el archivo subido.

## Si no hay marcadores

El sistema no intenta modificar el DOCX en sitio. Conserva el original, genera una versión TCDX/anexo y marca la estrategia en `change_summary_json` para revisión humana.
