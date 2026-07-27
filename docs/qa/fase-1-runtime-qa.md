# Fase 1R - Runtime QA

## Camino soportado

Runtime QA se ejecuta en la VM backend, donde existen conectividad PostgreSQL y Chromium. El Mac solo inicia el runner después de publicar y desplegar el SHA:

```bash
./scripts/deploy-vms.sh
npm run phase1:closeout
```

El runner verifica que la VM use el SHA exacto, carga `/home/tecdex/.config/tcdx/phase1-runtime-qa.env` con modo `600`, prepara el tenant, ejecuta fixture preflight, exige `13/13` críticos y solo entonces ejecuta la suite completa `30/30`. No se permite retry, skip ni resultado `did-not-run`.

## Configuración

`config/phase1/runtime-qa.env.example` contiene únicamente nombres y coordenadas no secretas. Contraseñas, tokens y `DATABASE_URL` permanecen en el archivo protegido de la VM. Antes de crear datos, `scripts/phase1/check-phase1-runtime-env.js` informa de forma consolidada cualquier variable ausente.

## Manifiesto y limpieza

Cada ejecución usa un `run_id`, prefijo y manifest exclusivos. Los helpers registran inmediatamente cada ID creado. La limpieza:

- exige ambiente `qa`, tenant exacto y `CLEAN_PHASE1_QA:<run_id>`;
- congela los IDs antes de borrar;
- verifica ownership y prefijos QA;
- elimina dependencias en orden FK;
- deshabilita solo los triggers inmutables necesarios dentro de una transacción;
- vuelve a habilitarlos y verifica estado antes de commit;
- limpia el ledger de bootstrap exacto del run;
- conserva el manifest hasta confirmar limpieza;
- entrega `CLEANED` o `ALREADY_CLEAN`.

Si una prueba falla, el runner preserva evidencia en `/tmp/tcdx-phase1-evidence/<run_id>`, intenta la limpieza y deja el manifest disponible cuando la limpieza no puede completarse.

## Evidencia

La evidencia no sensible se copia al Mac bajo `/tmp/tcdx-phase1-evidence/<run_id>` e incluye resultados targeted/full, reportes Playwright, resumen, conteos de limpieza, SHA y estado Git. El cierre requiere simultáneamente:

```text
targeted: 13/13
full: 30/30
retries: 0
cleanup: CLEANED o ALREADY_CLEAN
immutability_triggers: enabled
VM worktree: clean
```

No se usa un runner hospedado de GitHub para esta prueba: no tiene acceso seguro a la base QA interna necesaria para una limpieza transaccional.
