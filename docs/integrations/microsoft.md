# Conector Microsoft

Provider principal: `microsoft_graph`. El adapter contempla usuarios, grupos,
cuentas inactivas, cuentas privilegiadas, MFA, documentos y metadata de
SharePoint/OneDrive según scopes concedidos.

Scopes declarados: `User.Read.All`, `Group.Read.All`, `Directory.Read.All`,
`Files.Read.All` y `Sites.Read.All`. OAuth usa Microsoft identity platform,
state hash, redirect HTTPS, access/refresh token cifrado y renovación previa al
vencimiento.

El sandbox produce identidad activa, cuenta privilegiada sin MFA y documento
versionado. Así valida métrica, alerta, evidencia/procedencia y deduplicación
sin afirmar acceso live.
