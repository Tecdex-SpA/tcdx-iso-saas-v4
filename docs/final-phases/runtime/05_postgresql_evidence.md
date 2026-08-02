# Evidencia PostgreSQL de 5-C1

Se ejecutó `npm run phase5-5:postgres-integration` contra PostgreSQL 16 efímero.

Resultado observado:

```json
{"status":"VERIFIED_PHASE5_5_POSTGRES","tables":22,"formulas":50,"versions":50,"contracts":17,"ledger":"applied","immutability":"verified","idempotent":"verified","package4_runs":2,"package4_snapshots":2,"package4_lineage":2,"package4_tenants":2,"package5_consumers":3,"package5_comparisons":1}
```

La comprobación cubre aplicación y segunda aplicación de la migración, ledger, checksum, inmutabilidad de versiones publicadas, 22 tablas de gobierno matemático, 50 fórmulas, 17 contratos, cálculo persistido, snapshots, lineage y aislamiento entre los dos tenants sintéticos. Las mediciones sin dato conservan estado `unmeasured`/`source_unavailable`; no se convierten a cero.

No se conectó ni se modificó una base remota. Backup, restore y el runner de migración sobre VMs quedan `NO_VERIFICADO_RUNTIME` para 5-C11.
