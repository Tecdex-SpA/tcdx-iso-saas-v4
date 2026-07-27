# Conector Jira y Confluence

El provider `jira` reúne issues, comentarios y páginas de Confluence con
responsable, fecha, estado, evidencia y procedencia. Los scopes declarados son
`read:jira-work` y `read:confluence-content.all`.

El mapping puede crear una señal de remedial y evidencia documental, pero un
estado cerrado en Jira no cierra una acción TCDX: el cierre interno conserva su
aprobación, evidencia y verificación de eficacia.

El sandbox incluye issue vencido, comentario y página. OAuth Atlassian usa
audience de API, state hash y token cifrado.
