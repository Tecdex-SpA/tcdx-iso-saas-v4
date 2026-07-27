# Conector GitHub

El adapter cubre repositorios, visibilidad, rama principal, protección,
reviews, workflows, alertas y señal de dependencias. Los scopes declarados son
`repo:read`, `workflow:read` y `security_events:read`.

El sandbox emite repositorio, protección de rama deshabilitada y alerta de
seguridad abierta. El pipeline crea assurance/alerta según mapping, conserva
procedencia y deduplica el replay.

OAuth, refresh y webhook firmado están implementados. La prueba PostgreSQL
verifica HMAC e idempotencia con credenciales controladas no conectadas a
GitHub; una conexión live exige autorización del propietario correspondiente.
