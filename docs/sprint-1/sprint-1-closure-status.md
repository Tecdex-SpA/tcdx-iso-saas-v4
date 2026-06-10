# Sprint 1 - Estado de cierre

Fecha de validacion: 2026-06-10 15:50:05 aproximadamente

## Validacion cross-tenant core

La suite cross-tenant real fue ejecutada desde un entorno local contra:

```text
https://tcdx.dedyn.io:8443
```

Resultado:

```text
PASS=44
FAIL=0
SKIP=2
```

Los resultados locales quedaron almacenados en:

```text
./qa-results/cross-tenant-core-20260610_155005
```

`qa-results/` esta excluido del control de versiones.

## Manejo de credenciales

- La suite no imprimio tokens completos.
- Los tokens fueron cargados desde una ruta segura fuera del repositorio.
- No se registraron tokens, passwords ni otros valores sensibles en este documento.
- Cualquier token previamente expuesto debe considerarse rotado o invalidado.

## Validaciones pendientes

Las siguientes pruebas quedaron omitidas porque no se proporcionaron IDs de recursos:

- `reports/download`: requiere `REPORT_EXPORT_ID`.
- `evidences/download`: requiere `EVIDENCE_ID`.

Estas pruebas deben completarse para validar descargas por ID opaco y confirmar que el recurso solicitado pertenece al tenant autenticado.

## IA Compliance

La operacion same-tenant de IA Compliance respondio HTTP `403`. Este resultado se interpreta como endpoint protegido o funcionalidad no habilitada para el usuario utilizado.

El `403` no representa una fuga cross-tenant, pero tampoco constituye una validacion funcional positiva de IA Compliance.

## Mitigacion runtime de SheetJS

El audit runtime inicial ejecutado contra las VMs reales reporto en backend:

```text
critical=0
high=1
moderate=5
```

El hallazgo `high` correspondia a `xlsx@0.18.5`. Se considero un bloqueante real porque la dependencia procesa inputs no confiables provenientes de ZIP subido por usuarios, uploads manuales, mounted shares, agente local y Google Drive/Sheets dentro de Evidence Library y preparacion documental.

La correccion aplicada fue sustituir la version obsoleta del registro npm por la distribucion oficial SheetJS `0.20.3` desde el CDN oficial, manteniendo la API actual.

El audit posterior local sobre el manifiesto y lock actualizados reporto:

```text
critical=0
high=0
moderate=5
low=0
```

- El bloqueante `xlsx` desaparecio del resultado.
- No aparecieron vulnerabilidades `high` o `critical` nuevas.
- Los cinco hallazgos `moderate` permanecen para revision separada.
- Los smoke checks sanitizados de lectura XLSX desde ZIP, extraccion desde upload local y generacion XLSX fueron exitosos.
- `auditPreparation.service.js` cargo correctamente y `import-kpi-staging.js` paso validacion sintactica.

La version actualizada fue desplegada en la VM backend y el script de audit runtime se repitio contra las VMs reales el 2026-06-10 a las 16:25:52 -0400. El script termino con exit code `0`.

Resultado backend:

```text
critical=0
high=0
moderate=5
low=0
```

Resultado frontend:

```text
critical=0
high=0
moderate=2
low=0
```

El resultado confirma que `xlsx` ya no aparece como vulnerabilidad runtime y que Sprint 1 no tiene bloqueantes `critical` o `high` en las dependencias auditadas. Los hallazgos `moderate` de backend y frontend quedan clasificados como `REVIEW`.

Los archivos de evidencia se almacenaron localmente fuera del control de versiones en:

```text
qa-results/sprint1-audit-20260610_162552/
```

Queda pendiente ejecutar con fixtures XLS/XLSX sanitizados el export completo de preparacion documental y el importador KPI en un entorno de pruebas con base de datos desechable.

## Decision

Sprint 1 pasa la validacion cross-tenant core:

- 44 verificaciones aprobadas.
- 0 fallos.
- Sin respuestas `500` reportadas.
- Los accesos cross-tenant cubiertos fueron rechazados con el comportamiento esperado.

El cierre permanece pendiente de:

1. Validacion de descarga de reportes con `REPORT_EXPORT_ID`.
2. Validacion de descarga de evidencias con `EVIDENCE_ID`.
3. Smoke test funcional de los flujos habilitados para el piloto.
4. Prueba con fixtures sanitizados del export completo de preparacion documental y del importador KPI.

Estado: **Sprint 1 validado en aislamiento cross-tenant core, pendiente de descargas por ID opaco y smoke test funcional.**
