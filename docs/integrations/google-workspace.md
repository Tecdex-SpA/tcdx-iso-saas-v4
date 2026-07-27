# Conector Google Workspace

El adapter cubre usuarios, grupos, cuentas inactivas y metadata de Drive,
incluidos propietario y timestamps cuando el proveedor los entrega.

Scopes declarados: `admin.directory.user.readonly`,
`admin.directory.group.readonly` y `drive.metadata.readonly`. OAuth exige
consentimiento offline; tokens y refresh quedan cifrados.

El sandbox genera usuario inactivo, grupo y documento de Drive con procedencia.
La prueba contractual confirma normalización, alerta, cursor e idempotencia. La
conexión live requiere autorización de un administrador Workspace.
