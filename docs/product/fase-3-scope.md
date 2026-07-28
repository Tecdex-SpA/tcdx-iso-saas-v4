# Fase 3 - Alcance operacional GRC

## Objetivo

Integrar la operación real del tenant con el núcleo GRC existente mediante unidades,
procesos, servicios, BIA, continuidad, KPI/KRI y riesgo cuantitativo simplificado.

## Incluido

- Unidades organizacionales y vistas 360.
- Extensión versionada de procesos y servicios.
- Dependencias operacionales explícitas.
- BIA con impactos por dimensión, RTO, RPO y MTPD/MAO.
- Planes, pruebas y activaciones de crisis.
- Definiciones y mediciones KPI/KRI.
- Riesgo cuantitativo mediante estimación PERT simplificada y pérdida anualizada.
- Eventos, reglas, alertas y cambios explicables de readiness.
- Relaciones con modelos comunes de riesgo, control, requisito, evidencia, incidente,
  proveedor, auditoría, hallazgo, no conformidad y acción.

## Exclusiones

No incluye IA avanzada, ISO/IEC 42001, Monte Carlo, VaR, correlación estocástica,
centro de comando avanzado, notificaciones masivas ni integraciones cloud profundas.

## Capability

`grc_phase3_operations` está deshabilitada por defecto y se habilita de forma
persistente solo para `tcdx.local` en la migración Fase 3.

## Estado de esta pasada

Implementación revisada estáticamente. No se ejecutaron migraciones, pruebas
funcionales, builds, scripts de QA ni deploy. La aceptación funcional requiere deploy
manual y validación web.
