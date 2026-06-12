# QA results archived - cleanup stage 2

Fecha: 2026-06-12
Rama: `chore/cleanup-stage-2-controlled-cleanup`

## Resumen

El directorio historico `qa-results/` fue movido fuera del repositorio para reducir basura local y evitar que respuestas QA completas queden mezcladas con codigo y documentacion versionada.

No se leyo ni imprimio contenido de archivos `.json`, `.response`, `.txt` o `.md`. La operacion uso solo metadata agregada.

## Metadata archivada

| Campo | Valor |
| ----- | ----- |
| Origen | `/Users/andresbarouh/repos/tcdx-iso-saas/qa-results` |
| Destino local | `/Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953` |
| Directorios archivados | 44 |
| Archivos archivados | 718 |
| Tamano aproximado | 40M |
| `token.txt` detectados | 0 |
| Contenido sensible impreso | No |

## Rollback manual

```bash
mv /Users/andresbarouh/repos/tcdx-iso-saas-archive/qa-results-archive/qa-results-20260612_103953 /Users/andresbarouh/repos/tcdx-iso-saas/qa-results
```

## Notas

- `qa-results/` no estaba versionado por Git (`git ls-files qa-results` devolvio 0).
- `.gitignore` conserva `qa-results/` para evitar reingreso accidental.
- No se creo un nuevo `qa-results/` vacio.
