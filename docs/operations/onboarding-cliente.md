# Onboarding de Cliente SaaS / Tenant

Estado: operativo para alta controlada de clientes reales.

## 1. Objetivo

Definir un proceso repetible, seguro y verificable para crear, configurar y validar un cliente SaaS/tenant en TCDX ISO SaaS v4 sin depender de memoria tecnica ni cargas improvisadas.

## 2. Alcance

Aplica a altas de tenants productivos, pilotos controlados y clientes en preparacion comercial. No cubre portal autoservicio, migraciones destructivas, cargas masivas no revisadas ni integraciones productivas sin aprobacion separada.

## 3. Precondiciones

- Solicitud comercial aprobada.
- Responsable TCDX asignado.
- Plantillas de `docs/templates/` completas y revisadas.
- Acceso platform admin autorizado solo para ejecucion de alta.
- Sin contrasenas, tokens ni datos sensibles en documentos compartidos.
- Backup o punto de restauracion operacional validado segun runbook vigente antes de altas productivas.

## 4. Responsable de ejecucion

- Responsable operativo TCDX: coordina alta, evidencia y aprobacion interna.
- Responsable tecnico TCDX: ejecuta o supervisa configuracion.
- Responsable cliente: valida accesos, alcance, usuarios y aprobacion de salida a produccion.

## 5. Informacion minima requerida del cliente

Usar `docs/templates/cliente-onboarding-template.csv` y `docs/templates/cliente-onboarding-template.md`. Campos minimos: nombre tenant, razon social, nombre comercial, tax ID/RUT placeholder o validado, pais, industria, contacto principal, contacto facturacion, normas ISO, email admin inicial, fecha objetivo de go-live, clasificacion de datos y notas operativas.

## 6. Paso 1: alta tenant

1. Validar que el cliente no exista previamente en `tenants`.
2. Crear tenant desde la interfaz autorizada o endpoint administrativo `POST /api/tenants` con platform admin.
3. Registrar `tenant_id`, nombre, fecha/hora, ejecutor y evidencia.
4. No crear tenants por SQL directo salvo procedimiento de emergencia aprobado y registrado.

## 7. Paso 2: alta usuarios

1. Revisar `docs/templates/usuarios-onboarding-template.csv`.
2. Crear solo usuarios necesarios para arranque.
3. No usar credenciales demo.
4. No guardar contrasenas en CSV, tickets o documentos.
5. Registrar usuarios creados por email, rol y estado.

## 8. Paso 3: asignacion de roles

Asignar el menor privilegio necesario segun `docs/operations/roles-permisos-saas.md`.

Roles operativos esperados:

- Tenant admin: administracion interna del tenant.
- Auditor interno: auditoria, evidencias y hallazgos.
- Responsable de proceso/control: operacion asignada.
- Viewer/lector: lectura ejecutiva.

Platform admin no debe usarse para operacion diaria del cliente.

## 9. Paso 4: asignacion de normas ISO

1. Completar `docs/templates/normas-iso-onboarding-template.csv`.
2. Activar normas mediante flujo autorizado de tenant standards.
3. Validar que `tenant_standards` refleje normas activas.
4. Si aplica alcance operacional, validar `tenant_operations` y `tenant_standard_operations`.

## 10. Paso 5: perfil empresa/aplicabilidad

Si el cliente operara IA Compliance o aplicabilidad, completar perfil empresa:

- industria/subindustria,
- tamano,
- madurez,
- apetito de riesgo,
- uso permitido de contexto documental,
- notas de aplicabilidad.

Validar que exista o se actualice `tenant_company_profiles` para el tenant cuando aplique.

## 11. Paso 6: carga inicial de procesos/areas

1. Definir procesos/areas/sedes en plantilla de cliente o anexo operativo.
2. Cargar solo procesos aprobados por el cliente.
3. Si no hay detalle inicial, usar alcance general y marcar procesos como "No aplica por ahora".

## 12. Paso 7: carga inicial de riesgos

1. Usar `docs/templates/carga-inicial-riesgos-template.csv`.
2. Validar impacto/probabilidad con el responsable cliente.
3. No importar riesgos no revisados.
4. Registrar omision explicita si el cliente parte sin riesgos iniciales.

## 13. Paso 8: carga inicial de evidencias

1. Usar `docs/templates/carga-inicial-evidencias-template.csv`.
2. No cargar archivos sensibles sin aprobacion de clasificacion.
3. Validar que cada evidencia tenga owner, norma/control y estado.
4. Registrar fuentes externas o integraciones como pendientes si no estan aprobadas.

## 14. Paso 9: carga inicial de auditorias

1. Definir auditorias iniciales, alcance y responsables.
2. Si no hay auditoria inicial, registrar "No aplica" en checklist.
3. No prometer certificacion ni cumplimiento automatico.

## 15. Paso 10: carga inicial de planes de accion

1. Usar `docs/templates/carga-inicial-planes-template.csv`.
2. Cada plan debe tener owner, prioridad, vencimiento y criterio de aceptacion.
3. Registrar fuente del plan: riesgo, hallazgo, auditoria, evidencia o decision cliente.

## 16. Paso 11: validacion de login

Validar login individual con usuarios controlados:

- tenant admin,
- viewer/lector,
- auditor interno si aplica.

No compartir contrasenas en reportes. Registrar solo resultado y hora.

## 17. Paso 12: validacion de permisos

Validar que cada rol vea solo las rutas esperadas y que acciones no permitidas respondan con bloqueo claro. Usar `docs/operations/roles-permisos-saas.md` como referencia.

## 18. Paso 13: validacion cross-tenant

Ejecutar `docs/operations/cross-tenant-validation.md`. Debe quedar evidencia de que un usuario tenant A no accede a datos tenant B, incluyendo reportes, IA Compliance y archivos/uploads.

## 19. Paso 14: validacion de reportes

Validar `/exportes`:

- carga de plantillas,
- preview/narrativa si aplica,
- PDF/ZIP si el rol esta autorizado,
- descarga por HTTPS publica,
- revision humana clara.

## 20. Paso 15: validacion de IA Compliance

Validar `/ia-compliance`:

- contenido util en menos de 3 segundos,
- fallback formal si AI Engine no responde,
- sin textos tecnicos visibles,
- tenant_id correcto en endpoint Intelligence Brief.

## 21. Criterio de tenant listo para produccion

El tenant queda listo solo si:

- login y roles validados,
- normas asignadas,
- datos iniciales cargados o formalmente omitidos,
- reportes e IA Compliance validados si estan contratados,
- cross-tenant sin fallas,
- sin errores consola/red criticos,
- aprobacion responsable cliente y TCDX registrada.

## 22. Registro de evidencias del onboarding

Guardar evidencia operacional fuera de Git con:

- fecha/hora,
- ejecutor,
- tenant_id,
- screenshots sin tokens,
- resultados de checklists,
- rutas validadas,
- incidencias y resolucion.

## 23. Checklist de aprobacion interna

- [ ] Responsable comercial aprueba alta.
- [ ] Responsable tecnico confirma configuracion.
- [ ] Responsable seguridad confirma aislamiento.
- [ ] Responsable cliente valida accesos.
- [ ] TCDX aprueba salida a produccion.
