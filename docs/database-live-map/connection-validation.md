# Connection Validation

## Consulta ejecutada
`SELECT current_database(), current_user, inet_client_addr(), inet_server_addr(), inet_server_port();`

## Resultado
| Campo | Valor |
|---|---|
| Host configurado | `192.168.2.30` |
| Puerto configurado | `5432` |
| Base configurada | `tecdex_saas` |
| Usuario configurado | `tecdex_user` |
| current_database() | `tecdex_saas` |
| current_user | `tecdex_user` |
| inet_client_addr() | `192.168.2.1/32` |
| inet_server_addr() | `192.168.2.30/32` |
| inet_server_port() | `5432` |
| PostgreSQL server_version | `16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)` |

## Observaciones
- La conexión fue exitosa.
- El cliente aparece como `192.168.2.1/32`.
- No se incluyó contraseña en este documento.
- No se consultaron datos de negocio; solo funciones de conexión y metadatos del sistema.

Fuente: funciones de sesión PostgreSQL y `current_setting('server_version')`.
