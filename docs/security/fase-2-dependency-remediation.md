# Fase 2 — Remediación de dependencias

## Alcance y método

Inventario ejecutado el 27 de julio de 2026 sobre los lockfiles de `backend`,
`frontend` y `agent/tcdx-sync-agent`. No se utilizó `npm audit fix --force`.
Cada actualización se instaló desde el lockfile y se validó con tests, lint y
build.

## Línea base

| Workspace | Total | Críticas | Altas | Moderadas | Bajas |
|---|---:|---:|---:|---:|---:|
| Backend | 5 | 0 | 0 | 4 | 1 |
| Frontend | 11 | 0 | 11 | 0 | 0 |
| Sync agent | 0 | 0 | 0 | 0 | 0 |

### Hallazgos backend iniciales

| Paquete | Tipo | Severidad | Disposición |
|---|---|---|---|
| `body-parser@2.2.2` | Transitivo de Express | Baja | Corregido con override compatible `2.3.0` |
| `uuid@9.0.1` | Transitivo de Google APIs | Moderada | Corregido al actualizar Google APIs |
| `gaxios@6.7.1` | Transitivo de Google APIs | Moderada | Corregido con `gaxios@7.3.0` |
| `googleapis-common@7.2.0` | Transitivo | Moderada | Corregido con la línea 8 |
| `googleapis@144.0.0` | Directo | Moderada | Actualización mayor controlada a `173.0.0` |

`googleapis@173.0.0` incorporaba transitoriamente `gaxios@7.1.3`, cuyo
`rimraf/glob/minimatch` produjo seis hallazgos altos nuevos. Se fijó
`gaxios@7.3.0`, misma línea mayor y sin la dependencia vulnerable. El resultado
final del backend es cero vulnerabilidades.

### Hallazgos frontend iniciales

| Cadena | Uso | Disposición |
|---|---|---|
| `next → postcss@8.5.10` | Runtime/build | Corregido con Next `16.2.12` y override `postcss@8.5.23` |
| `@tailwindcss/postcss → postcss` | Build | Corregido con `@tailwindcss/postcss@4.3.3`, Tailwind `4.3.3` y `postcss@8.5.23` |
| `eslint → minimatch → brace-expansion` | Desarrollo | Excepción técnica no corregible, detallada abajo |
| `eslint-config-next → plugins → minimatch → brace-expansion` | Desarrollo | Excepción técnica no corregible, detallada abajo |

También se actualizó Playwright de `1.61.1` a `1.62.0`. Se conservó
`eslint-config-next@16.2.6` y se fijó `eslint-plugin-react-hooks@7.0.1` porque la
resolución más reciente habilitaba reglas incompatibles con la base actual y
producía 144 errores de lint; la configuración fijada mantiene el gate de lint
en verde.

## Excepción técnica: toolchain ESLint

El audit completo del frontend conserva nueve entradas altas, todas derivadas
de una sola cadena de desarrollo:

- `eslint@9.39.5`;
- `@eslint/config-array`;
- `@eslint/eslintrc`;
- `eslint-config-next`;
- `eslint-plugin-import`;
- `eslint-plugin-jsx-a11y`;
- `eslint-plugin-react`;
- `minimatch@3.1.5`;
- `brace-expansion@1.1.16`.

No existe al momento del inventario una combinación soportada que elimine la
cadena:

1. Las versiones vigentes de los plugins oficiales todavía declaran
   `minimatch@^3.1.2`.
2. Los mismos plugins declaran peer support hasta ESLint 9. La prueba con
   ESLint `10.8.0` produjo dependencias peer inválidas.
3. Forzar `minimatch@10` o `brace-expansion@5` no es compatible con la API
   CommonJS usada por esos plugins: `minimatch@3` espera que
   `require("brace-expansion")` devuelva una función, mientras la línea 5
   exporta `expand` como miembro nombrado.
4. La recomendación automática de bajar `eslint-config-next` a `0.2.4` no es
   compatible con Next 16 y eliminaría controles actuales.

### Impacto y mitigación

La cadena se instala únicamente como `devDependency`, no se copia al runtime de
Next y solo procesa archivos y patrones controlados del repositorio durante
CI/desarrollo. `npm audit --omit=dev` entrega cero vulnerabilidades. La
mitigación consiste en:

- no ejecutar lint sobre repositorios o patrones aportados por usuarios;
- mantener CI y build con recursos limitados;
- conservar lockfile reproducible;
- no usar overrides binariamente incompatibles;
- revisar la excepción cuando `eslint-plugin-import`,
  `eslint-plugin-jsx-a11y`, `eslint-plugin-react` y `eslint-config-next`
  publiquen soporte conjunto para ESLint 10/minimatch corregido.

La condición de revisión es cualquier release compatible de esos plugins o una
actualización de `eslint-config-next` que elimine `minimatch@3`.

## Estado posterior a remediación

| Workspace / alcance | Total | Críticas | Altas | Moderadas | Bajas |
|---|---:|---:|---:|---:|---:|
| Backend completo | 0 | 0 | 0 | 0 | 0 |
| Frontend producción (`--omit=dev`) | 0 | 0 | 0 | 0 | 0 |
| Frontend completo | 9 | 0 | 9 | 0 | 0 |
| Sync agent completo | 0 | 0 | 0 | 0 | 0 |

Las nueve entradas frontend restantes están cubiertas exclusivamente por la
excepción dev-only anterior y no tienen alternativa soportada disponible.

## Regresión ejecutada

- Backend: suite completa exitosa.
- Frontend: ESLint exitoso.
- Frontend: Next `16.2.12` build y TypeScript exitosos.
- Sync agent: syntax check exitoso.
- Audit backend: 0.
- Audit frontend runtime: 0.
- Audit sync agent: 0.

La regresión global se repetirá antes del cierre y deploy.
