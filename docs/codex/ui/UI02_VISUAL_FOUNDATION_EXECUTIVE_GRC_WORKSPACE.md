# UI-02 Visual Foundation
# TCDX ISO SaaS v4 - Executive GRC Workspace

Estado: especificacion final de UI-02, read-only respecto del repositorio productivo.
Direccion seleccionada: B - Executive GRC Workspace.
Objetivo: definir una base visual enterprise suficientemente precisa para implementar despues en `Tecdex-SpA/tcdx-iso-saas-v4` sin reinterpretacion arbitraria.

---

## 1. Decision de diseno

La direccion oficial es **Executive GRC Workspace**.

Esta direccion equilibra:

| Necesidad | Respuesta de la foundation |
|---|---|
| Vender rapido | Interfaz ejecutiva, moderna, sobria y confiable |
| Uso diario eficiente | Tablas, filtros, tabs, detalle contextual y densidad intermedia-alta |
| No perder capacidades | Mantiene 97 rutas como anclas, subvistas, detalles o deep links segun UI-01 |
| Reducir complejidad | Navegacion principal en 9 dominios maximos |
| IA madura | IA contextual dentro del flujo, no como silo ni chatbot permanente |
| GRC serio | Data Trust, evidencia, trazabilidad, riesgo, controles y auditoria visibles |

No se deben modificar reglas funcionales, backend, APIs, base de datos, RBAC, Math Governance, Data Trust, Observation, Gap, Impact Graph, Priority Engine, Knowledge Base, RAG, Regulatory Intelligence, Operational Memory ni AI Governance para acomodar esta UI.

---

## 2. Principios rectores

1. **Menos navegacion, mas contexto.** La aplicacion no debe exponer 90 paginas como menu. Debe usar dominios y workspaces.
2. **Tablas primero cuando el trabajo es operacional.** Riesgos, controles, evidencias, hallazgos, planes, proveedores y auditorias requieren tablas potentes.
3. **Dashboard no es landing page.** El Centro Ejecutivo debe mostrar decisiones, prioridades, confianza de datos y trabajo pendiente.
4. **Color con significado operacional.** Ningun color debe ser decorativo si puede confundirse con estado.
5. **Data Trust visible, no invasivo.** Debe aparecer junto a datos, KPIs, evidencias, metricas e IA.
6. **IA como copiloto contextual.** La IA explica, resume, sugiere, compara y detecta insuficiencia; no aprueba cumplimiento ni cierra riesgos.
7. **Cero no es falta de datos.** La UI debe distinguir cero, dato inexistente, dato insuficiente, no calculable, no disponible y error.
8. **Densidad profesional.** Intermedia-alta, con aire suficiente para leer, pero sin componentes gigantes.
9. **TECDEX reinterpretado como SaaS enterprise.** Usar tokens de marca, no copiar mecanicamente la web corporativa.
10. **Deep links preservados.** Consolidar visualmente no significa eliminar rutas ni fusionar entidades.

---

## 3. Arquitectura visual objetivo

### 3.1 Nueve dominios principales

| Dominio | Uso principal | Entrada visual |
|---|---|---|
| Inicio | Centro Ejecutivo, prioridades, salud y mi trabajo | Sidebar nivel 1 |
| Cumplimiento | ISO, diagnostico, health, SOA, ciclo de vida | Sidebar nivel 1 |
| Riesgo y Control | Registro de riesgos, matriz, controles, activos, cuantitativo | Sidebar nivel 1 |
| Auditoria y Mejora | Auditorias, ejecucion, hallazgos, NC, planes | Sidebar nivel 1 |
| Operacion y Resiliencia | Procesos, servicios, BIA, continuidad, crisis, incidentes | Sidebar nivel 1 |
| Datos y Evidencia | Evidencias, calidad, catalogo, lineage, semantica, importacion | Sidebar nivel 1 |
| Inteligencia | Metricas, indicadores, Priority, recomendaciones, analisis GRC | Sidebar nivel 1 |
| Reportes | BI, Report Studio, exportes, generaciones | Sidebar nivel 1 |
| Administracion | Tenant, usuarios, perfil, conectores, SaaS admin, dealer | Sidebar nivel 1 restringido |

### 3.2 Workspaces oficiales

| Workspace | Patron principal |
|---|---|
| Centro Ejecutivo | Dashboard ejecutivo + lista de prioridades |
| Cumplimiento e ISO | Tabs + filtros + matriz/lista + detalle |
| Riesgo y Control | Tabs + filtros + tabla + drawer derecho |
| Auditoria y Mejora | Master-detail + workflow + actividad |
| Operacion GRC | Catalogo/lista + relaciones + detalle |
| Resiliencia / BCM | Ciclo BIA -> continuidad -> pruebas -> crisis/incidentes |
| Privacidad | Tabs para actividades, DPIA, brechas y solicitudes |
| Riesgo de Proveedores | Tabla + evaluaciones + cuestionarios + portal externo separado |
| Datos y Evidencia | Evidencia + Data Trust + lineage + calidad |
| Inteligencia GRC | Analisis, explicaciones, metricas, recomendaciones |
| BI y Reportes | Dashboards, studio, exportaciones y generaciones |
| Administracion | Shell restringido separado del negocio GRC |

---

## 4. App Shell

### 4.1 Layout desktop

Estructura base:

1. Sidebar izquierdo fijo.
2. Topbar horizontal discreta.
3. Breadcrumb visible.
4. Selector de tenant/contexto.
5. Selector de periodo.
6. Busqueda global.
7. Notificaciones.
8. Usuario/perfil.
9. Area principal con ancho maximo controlado.
10. Drawer/panel contextual derecho cuando corresponde.

### 4.2 Sidebar

| Propiedad | Especificacion |
|---|---|
| Ancho expandido | 248-264 px |
| Ancho colapsado | 72-80 px |
| Fondo | Grafito/navy oscuro TECDEX |
| Active state | Banda o borde izquierdo naranja TECDEX + fondo sutil |
| Iconos | Lineales, simples, 18-20 px |
| Labels | 13-14 px, peso 600 |
| Agrupacion | 9 dominios maximos, filtrados por rol/entitlement |
| Footer | Estado/version y opcion colapsar, discreto |

Regla: el sidebar no debe mezclar negocio GRC con plataforma/dealer si el rol no corresponde.

### 4.3 Topbar

| Elemento | Regla |
|---|---|
| Altura | 56-64 px |
| Fondo | Blanco o superficie casi blanca |
| Borde inferior | 1 px, gris suave |
| Breadcrumb | Izquierda, texto compacto |
| Tenant selector | Centro/derecha, visible en multitenant |
| Period selector | Junto al tenant cuando afecte metricas |
| Search | 280-360 px desktop, command palette futuro |
| Notificaciones | Icono con badge semantico |
| Usuario | Avatar iniciales + menu |

---

## 5. Color System

Los valores deben mapearse a tokens reales del repositorio y del design system TECDEX. Si existen tokens equivalentes, reutilizarlos.

### 5.1 Brand

| Token | Valor sugerido | Uso |
|---|---:|---|
| `brand.orange` | `#F0721D` | CTA primario, active accent, foco de accion |
| `brand.orange.dark` | `#A4460D` | Hover/pressed o compatibilidad con token actual |
| `brand.teal` | `#51ABA8` | Acento secundario, info operacional no critica |
| `brand.teal.dark` | `#24736F` | Hover/acento secundario fuerte |
| `brand.navy` | `#2B3944` | Sidebar/superficies oscuras |
| `brand.navy.deep` | `#00133B` | Profundidad en sidebar y estados oscuros |

### 5.2 Surfaces

| Token | Valor | Uso |
|---|---:|---|
| `surface.app` | `#F5F7FA` | Fondo general |
| `surface.app.alt` | `#F8FAFC` | Bandas suaves |
| `surface.base` | `#FFFFFF` | Cards, tablas, paneles |
| `surface.muted` | `#F2F4F7` | Areas secundarias |
| `surface.raised` | `#FFFFFF` | Drawers, modals |
| `surface.dark` | `#2B3944` | Sidebar |

### 5.3 Text

| Token | Valor | Uso |
|---|---:|---|
| `text.primary` | `#161616` | Titulos y texto principal |
| `text.body` | `#444444` | Texto de lectura |
| `text.secondary` | `#545454` | Metadatos |
| `text.muted` | `#6B7280` | Ayudas y labels secundarios |
| `text.disabled` | `#9CA3AF` | Disabled |
| `text.onDark` | `#FFFFFF` | Sidebar/topbar oscuro |

### 5.4 Borders

| Token | Valor | Uso |
|---|---:|---|
| `border.subtle` | `#E5E7EB` | Separacion general |
| `border.default` | `#D8D8D8` | Inputs, cards, tablas |
| `border.strong` | `#C7D3E4` | Separacion de panels/drawers |
| `border.focus` | `rgba(240, 114, 29, 0.55)` | Focus visible |

### 5.5 Interactive

| Token | Valor | Uso |
|---|---:|---|
| `interactive.primary` | `#F0721D` | CTA primario |
| `interactive.primary.hover` | `#C75A12` | Hover |
| `interactive.primary.pressed` | `#A4460D` | Pressed |
| `interactive.secondary` | `#FFFFFF` | Boton secundario |
| `interactive.secondary.hover` | `#F2F4F7` | Hover secundario |
| `interactive.link` | `#1B75D0` | Links |
| `interactive.focusRing` | `0 0 0 3px rgba(240,114,29,.28)` | Foco WCAG |

### 5.6 Semantic

| Estado | Foreground | Background | Border |
|---|---:|---:|---:|
| Success / Cumple / Control efectivo | `#168A3A` | `#EAF7EE` | `#BFE7CC` |
| Warning / Pendiente / Riesgo medio | `#B77900` | `#FFF7E0` | `#F7D98A` |
| Danger / Critico / Vencido / NC | `#C62828` | `#FDECEC` | `#F5B5B5` |
| Info / Analisis / IA | `#1B75D0` | `#EAF3FC` | `#B8D7F3` |
| Neutral | `#545454` | `#F2F4F7` | `#D8D8D8` |

### 5.7 Risk Levels

| Nivel | Color | UI |
|---|---:|---|
| Critico | `#B91C1C` | Chip rojo oscuro, prioridad maxima |
| Alto | `#DC2626` | Chip rojo |
| Medio | `#F59E0B` | Chip ambar |
| Bajo | `#16A34A` | Chip verde |
| No evaluado | `#6B7280` | Chip neutral |

### 5.8 Compliance States

| Estado | UI |
|---|---|
| Cumple | Verde |
| Cumple parcial | Ambar |
| No cumple | Rojo |
| No aplica | Neutral |
| Pendiente evidencia | Ambar + icono evidencia |
| Sin evaluacion | Neutral + texto explicito |

### 5.9 Data Trust States

| Estado | Color | Icono | Copy recomendado |
|---|---|---|---|
| Trusted | Verde | Check | Datos confiables |
| Trusted with warnings | Ambar | Warning | Con advertencias |
| Low confidence | Naranja/rojo suave | Alert | Baja confianza |
| Insufficient data | Azul/neutral | Info | Datos insuficientes |

Regla: Data Trust no es un score arbitrario visible como nota escolar. Es un estado explicable con provenance, warnings y conteos.

### 5.10 Charts

| Serie | Uso |
|---|---|
| Verde | Cumplimiento, controles efectivos, mejoras |
| Ambar | Riesgo medio, pendiente, advertencia |
| Rojo | Riesgo alto, vencido, no conformidad |
| Azul | Informacion, tendencia, analisis |
| Teal | Comparacion secundaria |
| Gris | Baseline, sin dato, inactivo |

Evitar paletas arcoiris. Maximo 5-6 colores simultaneos salvo heatmaps.

---

## 6. Typography

Usar Roboto/Lato o los tokens tipograficos existentes del design system. Evitar hero text.

| Nivel | Size | Weight | Line height | Uso |
|---|---:|---:|---:|---|
| Display compacto | 28-32 px | 700-800 | 1.15 | Centro Ejecutivo, muy limitado |
| Page title | 24-28 px | 700-800 | 1.2 | Titulo de workspace |
| Section title | 18-20 px | 700 | 1.3 | Secciones principales |
| Card title | 14-16 px | 700 | 1.35 | Cards/KPIs |
| Body | 14 px | 400-500 | 1.5 | Texto general |
| Table body | 13 px | 400-500 | 1.4 | Tablas |
| Table header | 12 px | 700 | 1.25 | Encabezados |
| Labels | 12 px | 600-700 | 1.3 | Filtros, metadata |
| Metadata | 11-12 px | 500 | 1.3 | Fechas, fuente, confidence |
| Button | 13-14 px | 700 | 1.15 | Acciones |

Regla: no usar tracking negativo. Uppercase solo para labels pequenos, badges o secciones de sistema.

---

## 7. Spacing

Escala oficial:

| Token | Valor | Uso |
|---|---:|---|
| `space.1` | 4 px | Micro gap |
| `space.2` | 8 px | Gap compacto |
| `space.3` | 12 px | Inputs/chips |
| `space.4` | 16 px | Padding base |
| `space.5` | 20 px | Panel compacto |
| `space.6` | 24 px | Secciones |
| `space.8` | 32 px | Separacion mayor |
| `space.10` | 40 px | Solo paginas amplias |

Patrones:

| Elemento | Padding |
|---|---|
| Page container desktop | 20-24 px |
| Workspace header | 0 0 16 px |
| KPI card | 16-18 px |
| Enterprise card | 16-20 px |
| Table cell | 10-12 px horizontal |
| Drawer | 20-24 px |
| Modal | 24 px |

---

## 8. Radius

La UI actual tiene radios altos. Para enterprise B se deben moderar.

| Token | Valor | Uso |
|---|---:|---|
| `radius.xs` | 4 px | Chips pequenos, indicators |
| `radius.sm` | 6 px | Inputs, buttons compactos |
| `radius.md` | 8 px | Cards, table shell, drawers |
| `radius.lg` | 12 px | Modals y panels destacados |
| `radius.pill` | 999 px | Badges/chips circulares |

Regla: no usar `20px+` como default enterprise salvo excepcion de marketing o logo container.

---

## 9. Borders and Elevation

### Borders

| Nivel | Uso |
|---|---|
| Subtle 1 px | Cards, tablas, inputs |
| Strong 1 px | Drawer, modal, separacion shell |
| Accent 2-3 px | Active state, critical alerts, selected row |

### Elevation

| Nivel | Sombra |
|---|---|
| None | Mayor parte de cards y tablas |
| Low | `0 1px 2px rgba(16,24,40,.06)` |
| Medium | `0 8px 24px rgba(16,24,40,.08)` |
| High | Modals/dropdowns solamente |

Regla: sombras son funcionales para capas flotantes, no decoracion permanente.

---

## 10. Componentes

### 10.1 Buttons

| Variante | Uso | Estilo |
|---|---|---|
| Primary | Crear, guardar, ejecutar accion principal | Naranja TECDEX, texto blanco |
| Secondary | Exportar, personalizar, acciones normales | Blanco, borde gris |
| Tertiary | Acciones de baja jerarquia | Texto/link, sin caja fuerte |
| Danger | Eliminar, rechazar, cerrar criticamente | Rojo, confirmar |
| Icon | Ver, editar, mas, descargar | 32-36 px, tooltip obligatorio |
| Compact | Bulk actions, tabla | 32-36 px alto |

Estados: default, hover, active, disabled, loading, focus visible.

### 10.2 Form Controls

| Control | Especificacion |
|---|---|
| Input | 36-40 px, radius 6, label 12 px, helper opcional |
| Select | 36-40 px, caret visible, soporta clear |
| Search | Icono izquierda, placeholder especifico, shortcut futuro |
| Textarea | Min 96 px, resize vertical controlado |
| Checkbox | 16 px, foco visible, indeterminate para bulk |
| Radio | 16 px, labels claros |
| Switch | Solo booleanos operativos, no para opciones complejas |
| Date | Formato local claro, soporte vencido/proximo |
| File upload | Dropzone compacta, estado de validacion y progreso |

### 10.3 Data Tables

| Propiedad | Especificacion |
|---|---|
| Row height compact | 40-44 px |
| Row height standard | 44-48 px |
| Header height | 40-44 px |
| Header style | Fondo `surface.muted`, texto 12 px bold |
| Sticky header | Obligatorio en tablas largas |
| Sticky first column | Cuando hay ID/nombre critico |
| Hover | Gris muy suave |
| Selected | Banda izquierda naranja + fondo sutil |
| Bulk actions | Barra contextual sobre tabla |
| Sorting | Icono visible en columnas sortables |
| Filtering | Franja arriba, no filtros escondidos si son esenciales |
| Column config | P1/P2, especialmente en tablas densas |
| Pagination | Abajo derecha; resumen abajo izquierda |
| Empty | Estado explicito segun tipo de ausencia |
| Expandable rows | Solo para resumen breve; detalle completo en drawer |

Columnas frecuentes:

| Tipo | Columnas recomendadas |
|---|---|
| Riesgos | ID, riesgo, dominio, nivel, control, owner, vencimiento, Data Trust, acciones |
| Controles | ID, control, norma, cobertura, efectividad, evidencia, owner, estado |
| Evidencias | ID, evidencia, control/requisito, vigencia, aprobacion, fuente, Data Trust |
| Hallazgos | ID, hallazgo, severidad, auditoria, owner, SLA, estado, plan |
| Planes | ID, accion, origen, prioridad, responsable, fecha, estado, evidencia |

### 10.4 Cards

Usar cards para:

- KPIs.
- Items repetidos cuando no conviene tabla.
- Panels de contexto.
- Alerts/insights.
- Modals/drawers.

No usar cards para:

- Cada seccion de pagina sin necesidad.
- Envolver tablas dentro de multiples cards anidadas.
- Crear dashboards tipo mosaico decorativo.
- Sustituir listas operativas densas.

### 10.5 KPI Cards

| Elemento | Regla |
|---|---|
| Titulo | 12-13 px, claro |
| Valor | 26-32 px, dominante |
| Delta | 11-12 px, semantico |
| Contexto | Periodo/fuente |
| Data Trust | Chip pequeno si aplica |
| Icono | Opcional, no decorativo grande |

### 10.6 Tabs

| Tipo | Uso |
|---|---|
| Workspace tabs | Subvistas principales: Registro, Matriz, Controles |
| Entity tabs | Resumen, Evidencias, Relaciones, Actividad |
| Admin tabs | Configuracion separada |

Altura 40-44 px. Active con borde inferior teal/naranja o fondo sutil. No usar mas de 7 tabs visibles sin overflow/menu.

### 10.7 Badges and Status Chips

| Tipo | Ejemplo |
|---|---|
| Riesgo | Alto, Medio, Bajo |
| Cumplimiento | Cumple, Parcial, No cumple |
| Tiempo | Vencido, En 7 dias, Vigente |
| Data Trust | Trusted, Con advertencias, Low confidence |
| Workflow | Borrador, En revision, Aprobado, Rechazado |

Cada chip debe incluir texto; color solo no basta.

### 10.8 Alerts

| Tipo | Uso |
|---|---|
| Inline | Advertencia en seccion |
| Banner | Problema transversal de pagina |
| Critical | Riesgo alto, error de carga, permiso |
| Data quality | Datos insuficientes, baja confianza |

Alerts deben ser accionables: que paso, impacto, que hacer.

### 10.9 Toasts

| Tipo | Duracion |
|---|---|
| Success | 4 s |
| Info | 5 s |
| Warning | Persistente o 8 s |
| Error | Persistente hasta cerrar si afecta accion |

No usar toast para errores criticos que requieren lectura.

### 10.10 Modals

Usar para decisiones bloqueantes: confirmar eliminacion, aprobar/rechazar evidencia, crear entidad breve.

No usar modal para detalles complejos de riesgo, auditoria o proveedor; usar drawer/page detail.

### 10.11 Drawers

Drawer derecho es patron oficial para detalle contextual.

| Uso | Ancho |
|---|---:|
| Detalle compacto | 360-420 px |
| Detalle operativo | 480-560 px |
| Analisis profundo | 640-720 px |

Debe conservar contexto de lista/tabla. En mobile se convierte en pantalla completa.

### 10.12 Tooltips

Obligatorios en:

- Icon-only buttons.
- Data Trust.
- Confidence.
- Formulas/metrica.
- Abreviaciones tecnicas.

Contenido maximo 2-3 lineas. Para explicacion larga usar popover/drawer.

---

## 11. Estados universales

La UI debe distinguir explicitamente:

| Estado | Significado | UI recomendada |
|---|---|---|
| Zero | Valor real calculado igual a 0 | Mostrar `0` y contexto: "0 hallazgos abiertos" |
| Dato inexistente | No hay registro fuente | Empty state: "No existen registros para este contexto" |
| Dato insuficiente | Hay datos, pero no alcanzan para calcular | Chip `Datos insuficientes`, explicar requerimientos |
| No calculable | Regla/formula no puede ejecutarse con entradas actuales | Alert/info con causa |
| No disponible | Fuente temporalmente no accesible o no configurada | Estado neutral + accion/configuracion |
| Error | Fallo tecnico o respuesta invalida | Error state con reintentar y soporte |
| Loading | Carga inicial | Skeleton, no spinner aislado si hay layout |
| Refreshing | Actualizacion sobre datos existentes | Indicador discreto |
| Permission denied | Usuario no autorizado | Mensaje RBAC sin exponer datos |
| Stale | Datos antiguos | Badge "Desactualizado" + timestamp |
| Partial dataset | Dataset incompleto | Warning + conteos recibidos/usables/excluidos |

Prohibicion: nunca convertir `null`, `undefined`, dataset vacio o error en `0`, verde o "cumple".

---

## 12. Data Trust

### 12.1 Proposito

Data Trust indica si el dato mostrado es confiable para decision. No reemplaza juicio profesional ni crea una verdad nueva.

### 12.2 Representacion

| Estado | Visual | Detalle al abrir |
|---|---|---|
| Trusted | Chip verde pequeno | Fuente, timestamp, cobertura, sin warnings |
| Trusted with warnings | Chip ambar | Warnings, campos faltantes, exclusions |
| Low confidence | Chip naranja/rojo suave | Causas, fuentes debiles, muestra insuficiente |
| Insufficient data | Chip azul/neutral | Que falta para calcular |

### 12.3 Ubicacion

Data Trust debe aparecer en:

- KPI cards.
- Tablas de metricas/riesgos/controles/evidencias.
- Detail view.
- IA contextual.
- Reportes.
- Charts cuando la serie dependa de datos parciales.

### 12.4 Copy recomendado

| Caso | Texto |
|---|---|
| Trusted | "Datos confiables para este periodo." |
| Warning | "Datos confiables con advertencias." |
| Low | "Baja confianza: revisar fuente antes de decidir." |
| Insufficient | "Datos insuficientes para calcular esta metrica." |

---

## 13. IA contextual

### 13.1 Principio

La IA aparece en el objeto o workflow donde ayuda. No debe presentarse principalmente como destino de navegacion.

### 13.2 Patrones

| Patron | Uso |
|---|---|
| Insight card | Resumen de riesgo, evidencia o hallazgo |
| Recommendation card | Proxima accion sugerida |
| Explanation panel | Explicar metrica, formula, variacion o causa |
| Evidence review panel | Revisar suficiencia de evidencia |
| Audit assistant panel | Preparar preguntas, hallazgos o resumen |
| Report narrative assist | Ayudar a redactar reporte, con revision humana |

### 13.3 Anatomia de AI card

1. Titulo: `IA contextual`.
2. Contexto: objeto y fuente.
3. Insight breve.
4. Evidencia/provenance.
5. Confidence/Data Trust.
6. Accion sugerida.
7. Limite: decision humana requerida.

### 13.4 Copy boundaries

Usar:

- "Sugerencia".
- "Posible causa".
- "Evidencia insuficiente".
- "Revisar antes de aprobar".
- "Fuente: evidencias y controles vinculados".

No usar:

- "Cumplimiento certificado".
- "Riesgo aceptado automaticamente".
- "Hallazgo cerrado por IA".
- "Verdad legal definitiva".
- "Decision tomada".

### 13.5 Acciones permitidas

| Accion | Permitida |
|---|---|
| Explicar | Si |
| Resumir | Si |
| Sugerir plan | Si, como borrador |
| Comparar evidencia | Si |
| Detectar brechas | Si, con confidence |
| Crear borrador | Si, con aprobacion humana |
| Aprobar cumplimiento | No |
| Aceptar riesgo | No |
| Cerrar gap/NC | No |
| Ejecutar cambios backend/SQL | No |

---

## 14. Charts

### 14.1 Lineamientos generales

- Usar charts para explicar tendencia, composicion, distribucion o relacion.
- No llenar dashboards con graficos decorativos.
- Todo chart debe tener titulo, periodo, leyenda clara y estado Data Trust si aplica.
- Si los datos son insuficientes, mostrar estado explicito en lugar de chart vacio.

### 14.2 Tipos aprobados

| Tipo | Uso |
|---|---|
| Trend line | Evolucion de cumplimiento, riesgo residual, aging |
| Bar | Comparacion por dominio, unidad, norma, owner |
| Stacked bar | Distribucion de estados |
| Donut | Composicion simple, max 5 segmentos |
| Heatmap | Matriz de riesgo, cobertura por dominio |
| Risk matrix | Probabilidad x impacto |
| Gauge | Solo si representa meta operativa clara; uso excepcional |

---

## 15. Responsive

### 15.1 Prioridades

1. Desktop 1440.
2. Laptop 1280.
3. Tablet.
4. Mobile para consulta y acciones basicas.

### 15.2 Desktop 1440

- Sidebar expandido.
- Topbar completa.
- KPIs en 4-5 columnas.
- Tabla + drawer derecho.
- Filtros completos en una franja.

### 15.3 Laptop 1280

- Sidebar colapsable recomendado.
- KPIs 3-4 columnas.
- Drawer puede superponerse si no cabe.
- Filtros compactos con overflow controlado.

### 15.4 Tablet

- Sidebar como overlay o rail.
- KPIs 2 columnas.
- Tabla con columnas prioritarias.
- Filtros en panel plegable.
- Drawer full height overlay.

### 15.5 Mobile

No intentar comprimir tabla enterprise completa.

Estrategias:

- Convertir tabla en lista de cards compactas.
- Mostrar columnas esenciales: ID, titulo, estado, owner, fecha.
- Acciones en menu.
- Detail como pantalla completa.
- Dashboards solo lectura y acciones basicas.
- Report Studio, matrices complejas y builders avanzados pueden requerir desktop.

---

## 16. Accesibilidad

Objetivo WCAG AA.

| Area | Regla |
|---|---|
| Contraste | Texto normal minimo 4.5:1 |
| Focus | Visible en todos los controles |
| Teclado | Navegacion completa en menus, tabs, tablas, drawers |
| Color | Nunca depender solo de color; usar texto/icono |
| Touch targets | Minimo 40 px, ideal 44 px |
| ARIA | Tabs, modals, drawers, table actions y alerts correctos |
| Motion | Transiciones 150-200 ms, respetar reduced motion |
| Error forms | Mensaje asociado al campo |

---

## 17. Patrones por workspace

### 17.1 Centro Ejecutivo

Contenido minimo:

- Cumplimiento global.
- Riesgos altos/criticos.
- Hallazgos abiertos.
- Controles efectivos.
- Planes vencidos/proximos.
- Data Trust global.
- Top prioridades.
- Tendencias.
- Alertas y decisiones pendientes.

No debe mostrar catalogo de modulos.

### 17.2 Riesgo y Control

Tabs:

- Registro.
- Matriz.
- Controles.
- Activos.
- Cuantitativo.
- Planes.

Estructura:

- Header del workspace.
- KPIs compactos.
- Tabs.
- Filtros persistentes.
- Tabla principal.
- Drawer derecho para riesgo/control seleccionado.
- IA contextual en drawer.

### 17.3 Cumplimiento e ISO

Tabs:

- Overview.
- Diagnostico.
- Health.
- SOA.
- Controles.
- Ciclo de vida.
- Evidencias.

Debe conectar norma, requisito, control, evidencia, estado y responsable.

### 17.4 Auditoria y Mejora

Tabs:

- Auditorias.
- Ejecucion.
- Hallazgos.
- No conformidades.
- Planes.
- Recomendaciones.

Debe conectar hallazgo -> NC -> accion -> evidencia -> effectiveness.

### 17.5 Datos y Evidencia

Tabs:

- Evidencias.
- Calidad.
- Catalogo.
- Lineage.
- Semantica.
- Importaciones.

Debe mostrar provenance, vigencia, aprobacion, fuente y Data Trust.

### 17.6 Inteligencia GRC

Tabs:

- Prioridades.
- Metricas.
- Indicadores.
- Analisis.
- Recomendaciones.
- Gobierno IA.

Debe explicar fuentes, formulas, confidence y limites.

### 17.7 Reportes

Tabs:

- BI.
- Dashboards.
- Studio.
- Generaciones.
- Exportes.

Debe diferenciar reporte ejecutivo, operativo, auditoria y evidencia.

### 17.8 Administracion

Separar:

- Tenant admin.
- Usuarios.
- Perfil empresa.
- Conectores.
- SaaS admin.
- Dealer/canal.

No mezclar con la navegacion de negocio para roles cliente.

---

## 18. Reglas de implementacion futura

1. Reusar componentes `Enterprise*` existentes cuando sirvan.
2. Antes de crear componente nuevo, buscar equivalente local.
3. No introducir una segunda libreria visual.
4. No modificar `tecdex-design-system`; solo leerlo.
5. Mantener compatibilidad de rutas.
6. Mantener RBAC/entitlements actuales.
7. No cambiar contratos de datos para que la UI "calce".
8. No sustituir datos insuficientes por cero.
9. No crear paginas IA aisladas nuevas como solucion principal.
10. Validar visualmente desktop, laptop, tablet y mobile basico.

---

## 19. Criterios de aceptacion UI-02

| Gate | Resultado esperado |
|---|---|
| `UI02_DIRECTION_SELECTED` | Executive GRC Workspace |
| `DESIGN_SYSTEM_RESPECTED` | Tokens TECDEX usados como fuente |
| `MAIN_NAV_MAX_DOMAINS` | 9 dominios maximos |
| `ROUTES_PRESERVED` | 97 rutas sin perdida funcional |
| `AI_CONTEXTUAL` | IA integrada en workflows |
| `DATA_TRUST_VISIBLE` | Estados visibles y explicables |
| `INSUFFICIENT_DATA_EXPLICIT` | Sin conversion a cero |
| `ENTERPRISE_DENSITY` | Densidad intermedia-alta |
| `NO_BACKEND_CHANGE` | Backend/API/BD/RBAC intactos |
| `NO_DEPLOY` | Sin deploy |
| `NO_COMMITS` | Sin commits en esta fase |
