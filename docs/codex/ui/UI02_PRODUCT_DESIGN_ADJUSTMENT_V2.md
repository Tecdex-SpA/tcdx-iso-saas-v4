# UI-02 Product Design Adjustment V2
# TCDX ISO SaaS v4 - Executive GRC Workspace

Estado: ajuste Product Design sobre la foundation UI-02.
Direccion oficial: **B - Executive GRC Workspace**.
Imagen de referencia V2: `docs/codex/ui/references/ui02-executive-grc-workspace-v2.png`

---

## 1. Que se ajusta respecto de la foundation inicial

La foundation inicial queda vigente. Este ajuste V2 la precisa para implementacion posterior con Codex.

Cambios de criterio:

| Area | Ajuste V2 |
|---|---|
| Jerarquia | Priorizar un workspace real sobre un dashboard generico |
| Venta rapida | La pantalla debe verse ejecutiva y operable al mismo tiempo |
| Densidad | Mantener densidad intermedia-alta, pero con mejor respiracion visual |
| Prioridades | Incluir una franja ejecutiva de senales accionables debajo de KPIs |
| Tabla | Tabla como superficie principal de trabajo, no solo decoracion |
| Drawer | Drawer derecho como detalle contextual estable |
| Data Trust | Separar visualmente estado de confianza de estado de riesgo |
| IA | IA como card contextual con sugerencia, evidencia y limite humano |
| Color | Naranja solo para accion/activo/CTA; semanticos para estados |
| Implementacion | Codex debe implementar por etapas, no redisenar toda la plataforma de golpe |

---

## 2. Referencia visual principal

La imagen V2 debe usarse como **referencia visual principal** para la Etapa 1 y Etapa 2 de implementacion UI.

La imagen no es contrato funcional ni fuente de datos. Es referencia de:

- Layout.
- Jerarquia.
- Densidad.
- Sidebar.
- Topbar.
- KPI strip.
- Priority band.
- Filtros.
- Tabla enterprise.
- Drawer derecho.
- Data Trust.
- IA contextual.

No debe copiarse literalmente pixel a pixel si el repositorio ya tiene componentes reutilizables. Codex debe traducirla al sistema existente.

---

## 3. Layout V2 objetivo

### 3.1 Shell

| Elemento | Decision |
|---|---|
| Sidebar | Dark graphite/navy TECDEX, active state naranja |
| Topbar | Blanca, compacta, con breadcrumb, tenant, periodo, search, notificaciones y usuario |
| Main area | Fondo gris muy claro, contenido en superficies blancas |
| Drawer | Panel derecho persistente en desktop, overlay/fullscreen en mobile |

### 3.2 Main content

Orden recomendado:

1. Header del workspace.
2. Acciones principales: Personalizar, Exportar, Nuevo riesgo.
3. KPI strip compacto.
4. Priority band con senales accionables.
5. Tabs del workspace.
6. Filter bar en una fila.
7. Tabla enterprise.
8. Paginacion.
9. Drawer de detalle contextual.

---

## 4. Componentes reforzados por V2

### 4.1 KPI Strip

KPIs esperados:

- Cumplimiento.
- Riesgos altos.
- Controles efectivos.
- Hallazgos abiertos.
- Data Trust.

Reglas:

- 5 cards maximas en desktop.
- Valor dominante, metadata secundaria.
- Data Trust no debe parecer KPI numerico arbitrario.
- Iconos pequenos y funcionales.

### 4.2 Priority Band

Debe mostrar 2-3 senales ejecutivas accionables.

Ejemplos:

- `3 riesgos vencidos`.
- `2 controles sin evidencia suficiente`.
- `Data Trust con advertencias`.

Cada item debe tener:

- Icono semantico.
- Titulo corto.
- Subtexto de impacto.
- Indicador de navegacion o accion.

### 4.3 Table

Columnas recomendadas para Riesgo y Control:

| Columna | Regla |
|---|---|
| Select | Checkbox, soporta bulk |
| ID | Sticky/estable |
| Riesgo | Texto principal, max 2 lineas |
| Dominio | Categoria |
| Nivel | Chip semantico |
| Estado | Chip workflow |
| Responsable | Avatar iniciales + nombre |
| Vencimiento | Fecha + estado temporal |
| Data Trust | Chip separado |
| Acciones | Icon buttons con tooltip |

### 4.4 Drawer de riesgo

Secciones:

1. Header de entidad: ID, nombre, nivel, vencimiento.
2. Tabs: Resumen, Analisis, Evidencia, Historial.
3. Metadata clave: dominio, responsable, clasificacion, estado, impacto, probabilidad.
4. Controles vinculados.
5. Evidencia vinculada.
6. Proxima accion.
7. Actividad reciente.
8. IA contextual.

### 4.5 IA contextual

Debe incluir:

- Label `IA contextual`.
- Tipo: `Sugerencia`, `Explicacion` o `Revision de evidencia`.
- Insight breve.
- Evidencia o fuente.
- Frase limite: `La IA no reemplaza el juicio profesional.`

No debe ocupar todo el workspace.

---

## 5. Reglas para Codex

Codex debe entender que hay tres niveles:

| Nivel | Responsable | Resultado |
|---|---|---|
| Product Design | ChatGPT Work / Product Design | Define direccion visual, imagenes, foundation y criterios |
| Codex implementacion | Codex CLI/App sobre el repo | Traduce foundation a codigo real |
| QA/validacion | Codex + usuario | Verifica rutas, build, visual, RBAC y no perdida funcional |

Product Design no reemplaza Codex. Product Design define **que construir y como debe verse**. Codex implementa **en el repositorio real**.

---

## 6. Como debe funcionar el flujo de trabajo

### Paso 1 - Aqui en ChatGPT Work con Product Design

Objetivo:

- Definir visualmente.
- Ajustar foundation.
- Generar referencias visuales.
- Preparar instrucciones.

Salida:

- Archivos `.md`.
- Imagenes de referencia.
- Prompt para Codex.

### Paso 2 - Preparacion del repo local

Los archivos ya deben estar disponibles en:

```text
docs/codex/ui/UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md
docs/codex/ui/UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md
docs/codex/ui/UI02_CODEX_IMPLEMENTATION_REFERENCE.md
docs/codex/ui/UI02_PROMPT_CODEX_IMPLEMENTACION.md
docs/codex/ui/references/ui02-executive-grc-workspace-v2.png
```

Los cinco archivos UI-01 deben estar en la misma carpeta `docs/codex/ui`.

### Paso 3 - Codex implementa

Codex debe leer primero:

1. UI-01.
2. UI-02 foundation.
3. UI-02 ajuste V2.
4. Referencias internas existentes del repo.
5. Imagen V2.

Luego debe implementar por etapas, comenzando por:

**Etapa 1 - Visual Foundation tecnica**

No debe comenzar intentando remodelar los 97 routes.

### Paso 4 - Validacion

Validar:

- `git diff`.
- `frontend` lint/build.
- Screenshots desktop/laptop.
- Rutas principales.
- Que no se tocaron backend/API/BD/RBAC.

---

## 7. Prompt recomendado para Codex - nota de uso

Cuando ejecutes el prompt en Codex, indica:

```text
Antes de editar, lee estos archivos:
- docs/codex/ui/UI02_VISUAL_FOUNDATION_EXECUTIVE_GRC_WORKSPACE.md
- docs/codex/ui/UI02_PRODUCT_DESIGN_ADJUSTMENT_V2.md
- docs/codex/ui/UI02_CODEX_IMPLEMENTATION_REFERENCE.md
- docs/codex/ui/UI02_PROMPT_CODEX_IMPLEMENTACION.md
- docs/codex/ui/references/ui02-executive-grc-workspace-v2.png
```

Y exige:

```text
No implementes mas alla de Etapa 1 sin detenerte y reportar.
```

---

## 8. Decision final Product Design

El diseño objetivo no es A ni C.

La direccion final es:

**B - Executive GRC Workspace, refinada por V2**

Con:

- Sidebar enterprise oscuro.
- Topbar utilitaria.
- KPI strip compacto.
- Priority band accionable.
- Tabla principal.
- Drawer derecho.
- Data Trust separado de riesgo.
- IA contextual dentro del workflow.
- Implementacion incremental por Codex.
