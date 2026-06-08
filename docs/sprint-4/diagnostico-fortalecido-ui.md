# Sprint 4.3 - Diagnostico fortalecido UI

## Objetivo

Exponer en la vista consolidada **Cumplimiento y Auditoria** la experiencia funcional de diagnostico fortalecido por norma activa y proceso/operacion, consumiendo el diagnostico deterministico de Sprint 4.1 y el enriquecimiento IA trazable de Sprint 4.2.

La IA se muestra solo como sugerencia operacional. No aprueba cumplimiento, no certifica, no cierra brechas y no crea planes de accion sin intervencion humana.

## Ruta UI

- Ruta: `/cumplimiento-auditoria`
- Componente agregado: `frontend/src/components/diagnostics/StrengthenedDiagnosticPanel.tsx`
- Shell reutilizado: `frontend/src/components/mvp/MvpViewShell.tsx`

No se agregaron carpetas con parentesis en Next.js y no se modifico sidebar.

## Componentes y flujo

La seccion **Diagnostico fortalecido** incluye:

- Selector de norma activa desde `GET /api/diagnostics/standards`.
- Selector opcional de proceso/operacion desde `GET /api/diagnostics/processes`.
- Boton **Ejecutar diagnostico**.
- Resumen de cobertura.
- Tabla de controles evaluados.
- Evidencias existentes y faltantes.
- Evidencias recomendadas con formato, campos minimos, responsable, frecuencia y uso ISO.
- Boton **Analizar con auditor IA** desde `POST /api/diagnostics/ai-contextual-recommendations`.
- Trazabilidad documental con fuente, fragmento o razon de ausencia.
- Acciones humanas para crear brecha o plan de accion.

Estados visibles cubiertos:

- Sin norma: `Seleccione una norma activa para iniciar diagnostico.`
- Sin proceso: se permite diagnostico general por norma.
- Sin controles: `No se encontraron controles aplicables para la norma/proceso seleccionado.`
- Sin evidencias: `No se encontraron evidencias activas asociadas.`
- Sin IA: `No fue posible enriquecer con IA. Se muestra recomendacion deterministica.`
- Excluded: `Las evidencias excluidas no se consideran cobertura activa.`
- Sin permiso: `No tiene permiso para ejecutar esta accion.`

## Endpoints consumidos

Lectura diagnostica:

- `GET /api/diagnostics/standards`
- `GET /api/diagnostics/processes?standard_id=<id>`
- `GET /api/diagnostics/process-detail?standard_id=<id>&process_id=<id>`
- `GET /api/diagnostics/process-detail?standard_id=<id>&operation_id=<id>`
- `POST /api/diagnostics/recommendations`
- `POST /api/diagnostics/ai-contextual-recommendations`

Aceptacion humana agregada:

- `POST /api/diagnostics/suggestions/accept-gap`
- `POST /api/diagnostics/suggestions/accept-action`

Los mismos endpoints funcionan bajo el alias `/api/diagnostic/*` porque el router existente esta montado en ambos prefijos.

## Aceptacion humana

La UI nunca crea brechas ni acciones al generar diagnostico o al ejecutar IA. Para persistir una sugerencia:

1. El usuario debe presionar **Crear brecha** o **Crear plan de accion**.
2. El navegador muestra confirmacion explicita.
3. El backend vuelve a resolver el diagnostico con `diagnosticService.buildDiagnostic`.
4. El backend valida que el control este visible para el usuario, tenant y filtro solicitados.
5. El backend inserta el registro formal con `created_by`, tenant desde JWT y origen `diagnostic_recommendation`.

Persistencia usada:

- Brecha formal: tabla `findings`, `source_type = diagnostic`, `source_id = tenant_controls.id`, descripcion con `Origen: diagnostic_recommendation`.
- Plan de accion: tabla `action_plans`, `source_type = ia`, `source_id = tenant_controls.id`, `ai_source_label = diagnostic_recommendation`, `ai_orchestration_json.origin = diagnostic_recommendation`.

No hubo migraciones. Se respetaron los `CHECK` existentes de `source_type`.

## Permisos

Lectura de diagnostico:

- Roles de lectura tenant existentes en RBAC.

Ejecutar IA contextual:

- `admin`
- `tenant_admin`
- `admin_cumplimiento`
- `compliance_admin`
- `auditor`
- `operativo`
- `responsable_area`
- `area_owner`

Aceptar brecha:

- `admin`
- `tenant_admin`
- `admin_cumplimiento`
- `compliance_admin`
- `auditor`

Aceptar plan de accion:

- `admin`
- `tenant_admin`
- `admin_cumplimiento`
- `compliance_admin`
- `operativo`
- `responsable_area`
- `area_owner`

Roles ejecutivos quedan solo lectura y no pueden crear brechas ni acciones. Dealer/partner no entra al flujo cliente interno.

## Seguridad

- Todo endpoint usa JWT y `enforceApiAccess`.
- El servicio de aceptacion deriva tenant y visibilidad desde `diagnosticService.buildDiagnostic`.
- Responsable de area solo puede aceptar sobre controles visibles por sus filtros/ownership.
- No se aceptan IDs externos de proveedor documental como IDs internos.
- Las evidencias/chunks excluidos ya quedan fuera del diagnostico 4.1/4.2 y la UI avisa que no cuentan como cobertura activa.
- No se exponen prompts, tokens, OAuth, traces internos ni datos fuera del tenant.

## Ejemplo de prueba manual

1. Iniciar sesion como Admin Cumplimiento.
2. Abrir `/cumplimiento-auditoria`.
3. Cargar normas.
4. Seleccionar ISO 9001, ISO 27001 o ISO/IEC 42001 activa.
5. Opcionalmente seleccionar proceso.
6. Ejecutar diagnostico.
7. Ver controles, cobertura, evidencias existentes, brechas y acciones.
8. Ejecutar **Analizar con auditor IA**.
9. Confirmar que cada recomendacion muestra:
   - brecha o razon de ausencia;
   - evidencia recomendada;
   - formato;
   - campos minimos;
   - responsable;
   - frecuencia;
   - uso ISO;
   - accion sugerida;
   - confianza;
   - fuente o ausencia.
10. Crear brecha desde una sugerencia y confirmar que se crea solo tras aceptar.
11. Crear plan de accion desde una sugerencia y confirmar que se crea solo tras aceptar.
12. Repetir con ejecutivo y confirmar bloqueo de creacion.

## Criterios de aceptacion

- La UI vive dentro de `Cumplimiento y Auditoria`.
- Consume diagnostico deterministico 4.1.
- Consume enriquecimiento IA 4.2.
- Muestra evidencia recomendada contextualizada con campos minimos, responsable, frecuencia, valor ISO y trazabilidad.
- Permite crear brecha/accion solo con confirmacion humana y rol autorizado.
- No crea nada automaticamente.
- No modifica Google Drive, Zoho WorkDrive ni carga manual.
- No rompe Biblioteca Documental ni Sprint 3.5.
- No introduce migraciones.

## Riesgos pendientes

- La asociacion directa de evidencia existente al control sigue delegada a `/evidencias`; un flujo inline queda pendiente.
- Las pruebas cross-tenant requieren tokens reales de tenants distintos.
- La aceptacion formal usa tablas actuales `findings` y `action_plans`; si se crea una tabla futura de sugerencias, conviene mover trazabilidad de origen a esa entidad.
