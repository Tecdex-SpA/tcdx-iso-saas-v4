# Quality, freshness y suficiencia

Quality evalúa nulos obligatorios, tipos, duplicados y cobertura utilizable. Freshness usa timestamp de fuente, timezone normalizado y edad máxima; devuelve `fresh`, `attention`, `stale` o `unknown`. Suficiencia combina inputs requeridos, muestra mínima, cobertura, estados aceptables, unidad y período.

`metric_sufficiency_rules` es versionada y publicada de forma inmutable. Estados negativos permanecen explícitos; no se publican como medición calculada ni se sustituyen por cero.
