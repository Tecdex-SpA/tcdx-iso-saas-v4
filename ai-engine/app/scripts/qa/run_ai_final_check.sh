#!/usr/bin/env bash
set -euo pipefail

cd /home/tecdex/ai-engine

echo "============================================================"
echo "TCDX AI ENGINE - FINAL CHECK"
echo "============================================================"

echo ""
echo "1) Estado servicio ai-engine"
echo "------------------------------------------------------------"
systemctl is-active --quiet ai-engine
systemctl status ai-engine --no-pager --lines=12

echo ""
echo "2) Health HTTP"
echo "------------------------------------------------------------"
curl -s http://127.0.0.1:8001/health | python3 -m json.tool

echo ""
echo "3) Validación cobertura ai_core"
echo "------------------------------------------------------------"
PYTHONPATH=/home/tecdex/ai-engine ./venv/bin/python app/scripts/qa/check_ai_core_coverage.py

echo ""
echo "4) Regresión multi-norma"
echo "------------------------------------------------------------"
AI_HOST="127.0.0.1" \
AI_PORT="8001" \
AI_TOKEN="tecdex_ai_internal_2026" \
TENANT_ID="697eefa4-3b56-4c8a-a7d4-6d512c40233e" \
PYTHONPATH=/home/tecdex/ai-engine \
./venv/bin/python app/scripts/qa/test_ai_regression_multinorma.py

echo ""
echo "============================================================"
echo "FINAL CHECK OK"
echo "============================================================"
