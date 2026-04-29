# Guía de mantenimiento del motor IA TCDX

## Estado actual

El motor IA funciona con la lógica:

standard_code + domain_code + problem_type

Ejemplos:

- ISO9001 + supplier_management + supplier_without_evaluation
- ISO27001 + access_management + access_review_missing
- ISO17025 + calibration_metrological_traceability + expired_evidence
- ISO14001 + environmental_management + expired_evidence
- ISO22000 + food_safety + control_not_executed
- ISO50001 + energy_asset_performance + kpi_deteriorated

## Cómo validar que el motor está funcionando

Ejecutar:

```bash
cd /home/tecdex/ai-engine
./app/scripts/qa/run_ai_final_check.sh
