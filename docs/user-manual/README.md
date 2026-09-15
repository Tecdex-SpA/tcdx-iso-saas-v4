# TCDX ISO SaaS - captura automatizada de manuales

Esta carpeta documenta la infraestructura de evidencia visual para los manuales de usuario ISO 9001, ISO/IEC 27001 y sistema integrado.

## Objetivo

Generar capturas reales y reproducibles desde los tenants documentales `demo.9001`, `demo.27001` y `demo.isos` usando Playwright y GitHub Actions, sin depender de ejecución local ni de Codex.

## Seguridad operacional

Los tenants documentales existen en el ambiente productivo, pero contienen cuentas y empresas ficticias. La primera versión del pipeline es deliberadamente de solo lectura: autentica, valida rol/tenant/alcance ISO y captura vistas. No crea, modifica ni elimina registros de negocio.

La automatización de carga y remediación del Dataset Maestro Documental se habilitará en una etapa posterior y deberá cumplir estas reglas:

- operar exclusivamente en `demo.9001`, `demo.27001` y `demo.isos`;
- usar identificadores documentales propios (`DOC-*`);
- no usar SQL manual como parte del flujo de usuario;
- no modificar otros tenants;
- ser idempotente;
- preservar RBAC y aislamiento multi-tenant;
- no habilitar módulos GRC ni Riesgo Operativo para completar artificialmente los manuales.

## Escenarios

| Escenario | Tenant | Normas esperadas |
| --- | --- | --- |
| `iso9001` | `demo.9001` | ISO9001 |
| `iso27001` | `demo.27001` | ISO27001 |
| `integrated` | `demo.isos` | ISO9001 + ISO27001 |

Cada escenario utiliza los roles `admin`, `operativo`, `auditor` y `viewer` definidos para el tenant.

## Ejecución

El workflow `.github/workflows/documentation-capture.yml` se ejecuta manualmente desde GitHub Actions y permite elegir `all`, `iso9001`, `iso27001` o `integrated`.

Requiere el GitHub Environment `documentation` con estos secretos:

- `DOC_API_BASE_URL`: URL base real de la API productiva utilizada por el frontend.
- `DOC_DEMO_PASSWORD`: contraseña común de las doce cuentas documentales.

La URL web queda fijada en el workflow a `https://tcdx-iso.tecdex.net` para impedir que esta automatización se ejecute accidentalmente contra otro frontend.

## Evidencias generadas

Cada ejecución publica un artifact `tcdx-documentation-<scenario>-<run_id>` con:

- capturas PNG por escenario y rol;
- `manifest.json` con trazabilidad de cada captura;
- `validation.json` con tenant, rol y normas operativas verificadas;
- resultados JSON de Playwright;
- trazas y test-results cuando exista una falla.

## Gate inicial

Antes de capturar, cada cuenta debe:

1. autenticar correctamente;
2. devolver su tenant desde `/api/me`;
3. coincidir con el rol esperado;
4. exponer exactamente las normas operativas esperadas desde `/api/tenant-standards/scope/:tenant_id`;
5. no producir respuestas 5xx durante la navegación;
6. no mostrar errores de aplicación o capabilities bloqueadas en las vistas incluidas.

SoA solo se captura en `iso27001` e `integrated`.

## Siguiente etapa

Después de validar esta capa de solo lectura, se agregará `dataset-setup` y los flujos transaccionales del Dataset Maestro Documental v1: Perfil Empresa, procesos, operaciones, diagnóstico, controles, evidencias, auditorías, hallazgos, no conformidades, planes de acción, remediación, KPI/Health, IA Compliance y Auditor IA.

La importación Excel permanece fuera del pipeline mientras `/importaciones` dependa contractualmente de `grc_phase3_operations`.
