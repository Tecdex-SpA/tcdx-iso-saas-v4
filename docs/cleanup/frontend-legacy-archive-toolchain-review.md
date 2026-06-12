# Frontend legacy archive toolchain review

Fecha: 2026-06-12
Rama: `chore/cleanup-b6-legacy-consolidation`

Se reviso `frontend/legacy-pages-archive`, `frontend/tsconfig.json`,
`frontend/eslint.config.mjs`, `frontend/package.json` y la salida real de las
herramientas.

| Herramienta | Incluye archive | Evidencia | Riesgo | Decisión |
| ----------- | --------------: | --------- | ------ | -------- |
| TypeScript | Si | `tsconfig.json` incluye `**/*.ts` y `**/*.tsx`; `npx tsc --noEmit --listFiles` enumera los cuatro `page.tsx` archivados. | Un error futuro en el archivo puede bloquear type-check/build. | keep_in_frontend_archive |
| ESLint | Si | `eslint.config.mjs` no ignora el archive; `npx eslint . --debug` muestra lectura y lint de los cuatro archivos. | El archivo puede sumar warnings o errores al lint global. | keep_in_frontend_archive |
| Next build | No como rutas | El build B.5 genera 42 paginas y no lista las cuatro rutas; el archive esta fuera de `src/app`. | Bajo mientras no vuelva al App Router. | keep_in_frontend_archive |
| QA superficie | Si, intencional | `qa-official-surface.sh` exige los cuatro archivos en `frontend/legacy-pages-archive`. | El guard fallara ante borrado o reactivacion accidental. | keep_in_frontend_archive |
| Otros scripts QA | No detectado | La busqueda de `legacy-pages-archive` solo encuentra guard y documentacion de cleanup/producto. | Bajo; no existe contrato operativo adicional. | keep_in_frontend_archive |

## Decision B.6

Se mantiene `frontend/legacy-pages-archive` sin cambios porque lint, TypeScript
y build pasan, y el archivo conserva rollback trazable. Estar fuera de
`frontend/src` no lo excluye de TypeScript ni ESLint debido a sus globs
actuales.

Para B.7 hay dos opciones coherentes:

1. `exclude_from_toolchain` si se requiere un periodo de retencion dentro de
   `frontend`.
2. `delete_after_retention` cuando producto confirme que los enlaces externos
   legacy ya no requieren rollback.

B.6 no modifica `tsconfig.json`, `eslint.config.mjs` ni el archive.
