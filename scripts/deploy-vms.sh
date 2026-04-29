#!/usr/bin/env bash
set -Eeuo pipefail

echo "======================================"
echo " DEPLOY GLOBAL TCDX ISO SAAS"
echo "======================================"

echo ""
echo "1) Desplegando backend..."
ssh tecdex@192.168.100.120 '/home/tecdex/deploy-backend.sh'

echo ""
echo "2) Desplegando frontend..."
ssh tecdex@192.168.100.130 '/home/tecdex/deploy-frontend.sh'

echo ""
echo "3) Desplegando AI Engine..."
ssh tecdex@192.168.100.140 '/home/tecdex/deploy-ai-engine.sh'

echo ""
echo "======================================"
echo " DEPLOY GLOBAL FINALIZADO"
echo "======================================"
