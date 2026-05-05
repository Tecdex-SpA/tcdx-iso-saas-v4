# Fase 4 — Risk Register

| Riesgo | Impacto | Probabilidad | Estado | Mitigación | Dueño sugerido |
|---|---|---:|---|---|---|
| AI Engine opera en 8001 aunque el objetivo futuro menciona 8000 | Medio | Media | Controlado | Documentar 8001 como estado real y decidir normalización en Fase 5 | Técnico |
| Capacidad real Oracle Free Tier | Alto | Media | Pendiente | Verificar límites OCI vigentes antes de sizing definitivo | Técnico/Comercial |
| Backups sin restore real probado | Alto | Media | Pendiente | Ejecutar restore-test con dump real en DB temporal antes de piloto crítico | Operaciones |
| RBAC avanzado puede requerir DB/migraciones | Medio | Media | Pendiente | Mantener baseline y diseñar permisos avanzados en fase separada | Producto/Técnico |
| Monitoreo avanzado pendiente | Medio | Alta | Pendiente | Evaluar Prometheus/Grafana/Oracle Monitoring después de piloto | Operaciones |
| Secretos dependen de operación manual fuera de Git | Alto | Media | Controlado | Usar `.env` fuera de Git; evaluar Vault/Secret Manager | Operaciones |
| Uploads requieren estrategia externa futura | Medio | Media | Pendiente | Evaluar Object Storage o volumen persistente con backup | Técnico |
| SSL/DNS pendiente en cloud real | Alto | Alta | Pendiente | Resolver en cutover cloud con Nginx/Certbot/DNS | Técnico |
| IA no reemplaza revisión humana | Alto | Alta | Controlado | Mensajes, PDF, revisión humana y disclaimers | Producto |
| Scripts QA dependen de usuario admin demo | Medio | Media | Controlado | Mantener credenciales fuera de Git y documentar usuario QA por ambiente | Operaciones |

## Riesgo Fase 5A — Texto libre no reconocido

**Riesgo:** texto libre ingresado por clientes puede permanecer en español en modo English si no corresponde a catálogos, estados, frases conocidas o patrones seguros.

**Mitigación:** aplicar `translateDisplayText` solo como capa visual determinística con fallback al original. La traducción IA/caché/revisión humana queda para fase posterior.
