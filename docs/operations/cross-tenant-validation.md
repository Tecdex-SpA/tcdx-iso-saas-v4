# Validacion Cross-Tenant

Objetivo: comprobar que usuarios de un tenant no ven, modifican ni descargan datos de otro tenant.

## Preparacion

Usar usuarios controlados de dos tenants de prueba o piloto, nunca datos sensibles reales.

Variables sugeridas, sin imprimir tokens completos:

```bash
export API_BASE_URL="https://tcdx-iso.tecdex.net"
export TENANT_A_ID="TENANT_A_UUID"
export TENANT_B_ID="TENANT_B_UUID"
export TENANT_A_TOKEN="token-redactado"
export TENANT_B_TOKEN="token-redactado"
```

Scripts reutilizables existentes:

```bash
bash scripts/qa-cross-tenant-core.sh
bash scripts/qa-tenant-path-p1.sh
bash scripts/qa-reports-rbac-p1.sh
```

Estos scripts deben ejecutarse con variables de entorno seguras, sin hardcodear credenciales.

## Caso 1 — Usuario tenant A no ve datos tenant B

- Precondicion: token de usuario tenant A y `TENANT_B_ID`.
- Pasos: llamar endpoints tenant-scoped usando token A y path/query de tenant B.
- Resultado esperado: `403`, `404` o lista vacia; nunca datos tenant B.
- Evidencia: status HTTP, endpoint, timestamp, token redactado.
- Criterio de bloqueo: cualquier dato tenant B visible.

## Caso 2 — Usuario tenant B no ve datos tenant A

- Precondicion: token de usuario tenant B y `TENANT_A_ID`.
- Pasos: repetir endpoints tenant-scoped en sentido inverso.
- Resultado esperado: `403`, `404` o lista vacia; nunca datos tenant A.
- Evidencia: status HTTP, endpoint, timestamp.
- Criterio de bloqueo: cualquier dato tenant A visible.

## Caso 3 — Viewer no administra usuarios

- Precondicion: token viewer del tenant.
- Pasos: intentar listar/crear usuarios por `/api/users`.
- Resultado esperado: bloqueo claro para acciones administrativas.
- Evidencia: status HTTP y mensaje no tecnico.
- Criterio de bloqueo: viewer crea, edita o lista usuarios fuera de su permiso.

## Caso 4 — Tenant admin no accede a platform admin

- Precondicion: token `admin` o `tenant_admin`.
- Pasos: abrir rutas/API de administracion platform.
- Resultado esperado: redireccion o `403`.
- Evidencia: screenshot o status HTTP.
- Criterio de bloqueo: tenant admin accede a consola platform.

## Caso 5 — Platform admin puede auditar, pero queda trazable

- Precondicion: token platform admin autorizado.
- Pasos: listar tenant o validar acceso global permitido.
- Resultado esperado: acceso permitido solo para auditoria/operacion autorizada.
- Evidencia: ticket/aprobacion y registro de accion.
- Criterio de bloqueo: uso platform admin sin aprobacion o sin evidencia.

## Caso 6 — Reportes no mezclan datos entre tenants

- Precondicion: tokens A/B y export/report id de tenant A.
- Pasos: descargar o consultar reporte A con token B.
- Resultado esperado: `403` o `404`, nunca archivo ni metadata de A.
- Evidencia: status HTTP y nombre de endpoint.
- Criterio de bloqueo: descarga cross-tenant.

## Caso 7 — IA Compliance no mezcla tenant_id

- Precondicion: tokens A/B.
- Pasos: llamar `/api/intelligence/brief/:tenant_id` de A con token B.
- Resultado esperado: `403`, `404` o respuesta del tenant autenticado solamente.
- Evidencia: metadata `tenant_id` no sensible y status.
- Criterio de bloqueo: brief de A visible a B.

## Caso 8 — Archivos/uploads no exponen otro tenant

- Precondicion: archivo o URL de tenant A.
- Pasos: intentar acceso con token B o URL no autorizada.
- Resultado esperado: bloqueo o archivo no encontrado.
- Evidencia: status HTTP, sin copiar archivo sensible.
- Criterio de bloqueo: archivo tenant A descargable por tenant B.

## Comandos directos de referencia

```bash
curl -s -o /tmp/tcdx-cross-tenant-a-to-b.json -w "%{http_code}\n" \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  "${API_BASE_URL}/api/tenant-standards/${TENANT_B_ID}"

curl -s -o /tmp/tcdx-cross-tenant-b-to-a.json -w "%{http_code}\n" \
  -H "Authorization: Bearer ${TENANT_B_TOKEN}" \
  "${API_BASE_URL}/api/intelligence/brief/${TENANT_A_ID}"
```

No subir outputs con tokens, secretos, documentos completos o datos personales.
