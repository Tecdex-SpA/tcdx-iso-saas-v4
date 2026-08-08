# Seguridad, RBAC y límites

La lectura funcional, lectura técnica, administración metodológica, revisión, publicación, snapshots, comparaciones, propuestas, revisión de propuestas y jobs tienen capabilities separadas. Las rutas exigen `requireTenant`, capability comercial y permiso RBAC. Auditor puede leer negocio/técnica autorizada; solo roles con escritura pueden calcular, publicar o proponer. Aceptar una propuesta registra decisión, pero nunca ejecuta una acción irreversible.

Todas las consultas de mediciones, trust, snapshots, comparaciones, propuestas y jobs incluyen `tenant_id` de sesión. Una referencia cross-tenant se comporta como inexistente. Catálogo global publicado puede leerse; una variante tenant prevalece solo dentro del tenant.

Los límites backend cubren definiciones por tenant, snapshots mensuales, retención, frecuencia, jobs concurrentes, comparaciones y exportaciones. Excederlos devuelve el error comercial existente sin alterar rate limiting, `public_auth_login` ni infraestructura.

## Separación de funciones

Las permissions y capabilities diferencian lectura funcional, lectura técnica/lineage, administración de metodología, review, publish, cálculo, snapshots, comparaciones, propuestas, decisión sobre propuestas, jobs y exportación. La UI es una conveniencia; la autorización decisiva se ejecuta en middleware y servicio.

Las consultas tenant-specific filtran por el tenant autenticado y no aceptan el tenant del body. IDs cross-tenant de snapshot, propuesta, comparación o job responden como inexistentes. Las definiciones globales solo son legibles cuando están publicadas; las variantes tenant no son enumerables desde otro tenant.

Los límites registrados son indicadores activos, versiones por indicador, snapshots mensuales, snapshots retenidos, jobs concurrentes, comparaciones mensuales y exports mensuales. Los tests de `authenticatedRateLimit` y `publicRateLimit` permanecen verdes y el diff no toca `public_auth_login`.
