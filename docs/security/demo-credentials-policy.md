# Politica de credenciales demo y laboratorio

Fecha: 2026-06-10

## Objetivo

Evitar que scripts, pruebas, documentacion operativa o runbooks ejecuten acciones contra entornos piloto o cliente con usuarios, passwords, tokens o secretos demo por defecto.

Esta politica aplica a `scripts/`, `backend/`, `frontend/`, `ai-engine/`, `deploy/`, `agent/` y documentacion operativa.

## Reglas obligatorias

1. Ningun script no marcado como demo-only puede definir email, password, token, JWT secret, API key o credencial de base de datos por defecto.
2. Las credenciales deben venir de variables de entorno, un gestor de secretos o un archivo de entorno externo al repo y aprobado para el ambiente.
3. Los scripts deben fallar antes de login si falta una credencial obligatoria.
4. Los tokens completos no deben imprimirse en consola, logs, reportes de QA ni artefactos versionables.
5. `.env.example` solo puede contener placeholders no funcionales.
6. Usuarios demo o laboratorio deben estar deshabilitados, rotados o aislados antes de un piloto con datos reales.
7. Backups, dumps, `.env`, llaves privadas, archivos de evidencia reales y PDFs de cliente no se suben al repo.

## Convencion para scripts demo-only

Un script demo-only debe declarar en el encabezado:

```bash
# DEMO_ONLY=true
# Uso permitido: laboratorio local o demo asistida sin datos reales.
# Prohibido: piloto/cliente/produccion.
```

Si el script necesita credenciales demo, debe exigirlas por variables de entorno incluso en demo. La marca demo-only no autoriza hardcodear secretos.

## Cambios Sprint 1

Se eliminaron defaults demo inseguros de scripts QA/operativos. En particular, los scripts que antes usaban credenciales demo como fallback ahora deben recibir variables de entorno o fallar antes de autenticarse.

Scripts P0 ajustados:

- `scripts/test-tcdx-system-master.sh`
- `scripts/generate-deep-report-cli.sh`
- `scripts/qa-ai-auditor-full.sh`

Limpieza mecanica aplicada:

- Defaults `admin@...` como fallback de variables en `scripts/*.sh` y `scripts/qa/*.sh`.
- Defaults `123456` como fallback de variables en `scripts/*.sh` y `scripts/qa/*.sh`.
- Un test negativo de login usa `qa.invalid@example.invalid` en vez de un usuario realista.

## Hallazgos de escaneo

Comando usado sin imprimir secretos completos:

```bash
rg -l "password|passwd|secret|token|jwt|admin@|demo|123456|changeme" scripts backend frontend ai-engine docs deploy agent --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
find . -name ".env" -o -name "*.env" -o -name "token.txt" -o -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.dump" -o -name "*.sql.gz" -o -name "*.zip"
```

Resultado Sprint 1:

- No se detectaron `.env`, llaves privadas, dumps o backups versionables fuera de dependencias instaladas.
- Se detectaron archivos comprimidos dentro de `node_modules`; se ignoran por dependencia local.
- Persisten referencias a tokens, JWT, secretos y demo en codigo y documentacion por uso legitimo de configuracion, seguridad, ejemplos placeholder o conocimiento IA. Deben revisarse por ruta antes de publicar docs externas.

## Operacion segura

Ejemplo permitido:

```bash
export TCDX_EMAIL="<qa-user-email>"
export TCDX_PASSWORD="<qa-user-password>"
export TCDX_BASE_URL="https://example.internal"
bash scripts/generate-deep-report-cli.sh
```

Ejemplo prohibido:

```bash
TCDX_PASSWORD="<qa-user-password>" bash scripts/generate-deep-report-cli.sh
```

## Criterio pre-cliente

Antes de usar datos reales de cliente:

- Ejecutar escaneo de secretos.
- Confirmar que no hay usuarios demo activos en el tenant cliente.
- Confirmar rotacion o baja de credenciales temporales de QA.
- Confirmar que los artefactos de QA no contienen tokens completos.
- Registrar responsable, fecha y ambiente validado.
