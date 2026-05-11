# Checklist QA Primera Venta

Usar antes de cada demo, onboarding o despliegue para piloto controlado.

## Acceso y sesión

- [ ] Login correcto con usuario válido.
- [ ] Login incorrecto muestra error controlado.
- [ ] Token expirado o inválido redirige a `/login`.
- [ ] Tenant activo entra a su dashboard.
- [ ] Tenant suspendido queda bloqueado o muestra mensaje claro.
- [ ] Frontend no muestra errores técnicos crudos al usuario.
- [ ] No existen textos plantilla Next/Vercel en `/`.

## Roles

- [ ] `superadmin` accede a Admin SaaS.
- [ ] `admin` / `tenant_admin` gestiona módulos del tenant.
- [ ] `auditor` accede a auditoría/preauditoría según permisos.
- [ ] `operativo` solo ve/ejecuta acciones permitidas.
- [ ] `viewer` no puede escribir ni convertir acciones.
- [ ] `dealer` no ve módulos no autorizados.
- [ ] Usuario de un tenant no ve datos de otro tenant.

## Módulos principales

- [ ] Dashboard carga sin errores.
- [ ] Normas activas/contratadas visibles y filtradas por tenant.
- [ ] Controles cargan por tenant y norma.
- [ ] Evidencias: listar.
- [ ] Evidencias: subir archivo permitido por tipo de documento.
- [ ] Evidencias: descargar archivo autorizado.
- [ ] Matriz de riesgo: cargar.
- [ ] Matriz de riesgo: calcular/simular.
- [ ] Matriz de riesgo: guardar matriz real solo con acción explícita.
- [ ] Planes de acción: crear.
- [ ] Planes de acción: editar.
- [ ] Planes de acción: cerrar.
- [ ] Hallazgos cargan y filtran por tenant.
- [ ] No conformidades cargan y filtran por tenant.
- [ ] Auditorías cargan y permiten flujo esperado.
- [ ] IA Auditor / preauditoría genera análisis sin crear registros críticos.
- [ ] Generación PDF premium descarga y abre correctamente.

## Seguridad funcional

- [ ] Viewer no escribe.
- [ ] Dealer no accede a módulos fuera de alcance.
- [ ] APIs tenant-specific validan `tenant_id` desde JWT/RBAC.
- [ ] No se crean evidencias falsas.
- [ ] No se crean hallazgos/no conformidades por solo abrir vistas.
- [ ] IA Auditor declara revisión humana obligatoria.

## Comandos mínimos

```bash
cd ~/repos/tcdx-iso-saas
bash scripts/preventa-check.sh

cd backend
npm run check
npm test

cd ../frontend
npm run build
```
