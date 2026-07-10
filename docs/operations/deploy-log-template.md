# Deploy log template

## Registro

| Campo | Valor |
| --- | --- |
| Fecha/hora |  |
| Responsable |  |
| Fase |  |
| Ambiente | piloto / produccion / demo |
| Commit anterior |  |
| Commit nuevo |  |
| Rama | main |
| Comando de deploy |  |
| VMs afectadas | backend / frontend / DB / AI Engine |
| Archivos principales |  |
| Migraciones | si / no |
| Backup previo | si / no |
| Restore smoke test previo | si / no / no aplica |
| Validaciones pre-deploy |  |
| Validaciones post-deploy |  |
| Incidentes |  |
| Rollback requerido | si / no |
| Decision final | aprobado / revertido / pausado |

## Checklist pre-deploy

- [ ] Repo correcto: `/Users/andresbarouh/repos/tcdx-iso-saas-v4`.
- [ ] Rama `main`.
- [ ] Working tree limpio.
- [ ] Commit anterior registrado.
- [ ] Commit nuevo registrado.
- [ ] Backup previo definido si aplica.
- [ ] Migraciones revisadas si existen.
- [ ] Plan de rollback definido.
- [ ] Ventana y responsable confirmados.

## Checklist post-deploy

- [ ] Public HTTPS responde.
- [ ] Backend responde.
- [ ] Frontend/Nginx responde.
- [ ] DB readiness OK.
- [ ] AI Engine OK o degradado con fallback.
- [ ] Logs backend sin errores sostenidos.
- [ ] Flujos criticos revisados.
- [ ] Decision final registrada.

## Notas

```text
Resumen:

Evidencias:

Riesgos residuales:

Proxima accion:
```
