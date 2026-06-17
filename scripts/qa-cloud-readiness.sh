#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p qa-results
TXT="qa-results/qa-cloud-readiness-$TS.txt"
JSON="qa-results/qa-cloud-readiness-$TS.json"
MD="qa-results/qa-cloud-readiness-$TS.md"
ITEMS="qa-results/qa-cloud-readiness-$TS.items.jsonl"
: > "$ITEMS"
PASS=0; WARN=0; FAIL=0
record(){ STATUS="$1"; NAME="$2"; DETAIL="$3"; case "$STATUS" in PASS) PASS=$((PASS+1));; WARN) WARN=$((WARN+1));; FAIL) FAIL=$((FAIL+1));; esac; echo "[$STATUS] $NAME — $DETAIL"; python3 - "$ITEMS" "$STATUS" "$NAME" "$DETAIL" <<'PY'
import json, sys
path,status,name,detail=sys.argv[1:5]
with open(path,'a',encoding='utf-8') as fh: fh.write(json.dumps({'status':status,'name':name,'detail':detail},ensure_ascii=False)+'\n')
PY
}
check_file(){ [ -f "$2" ] && record PASS "$1" "$2 existe" || record FAIL "$1" "$2 no existe"; }
check_dir(){ [ -d "$2" ] && record PASS "$1" "$2 existe" || record FAIL "$1" "$2 no existe"; }
run_check(){ NAME="$1"; shift; if "$@" >/tmp/tcdx-cloud-readiness-check.log 2>&1; then record PASS "$NAME" OK; else record FAIL "$NAME" "falló: $*"; sed -n '1,80p' /tmp/tcdx-cloud-readiness-check.log || true; fi; }
{
 echo "======================================"; echo " TCDX QA CLOUD READINESS"; echo "======================================"; echo "Fecha: $(date)"; echo ""
 check_dir repo.backend backend; check_dir repo.frontend frontend; check_dir repo.ai-engine ai-engine; check_dir repo.scripts scripts; check_dir repo.docs docs
 if git status --porcelain | grep -E '(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.production$|(^|/)\.env\.development$|bak_' >/dev/null 2>&1; then record FAIL git.env "hay .env reales o backups en cambios"; else record PASS git.env "no hay .env reales ni backups en cambios"; fi
 check_file docs.production_runbook docs/oracle-cloud-production-runbook.md; check_file docs.vm_setup docs/oracle-cloud-vm-setup.md; check_file docs.cutover docs/oracle-cloud-cutover-checklist.md; check_file docs.backup_restore docs/oracle-cloud-backup-restore.md
 check_file systemd.backend deploy/templates/systemd/tecdex-backend.service; check_file systemd.frontend deploy/templates/systemd/tecdex-frontend.service; check_file systemd.ai_engine deploy/templates/systemd/ai-engine.service
 check_file nginx.frontend_http deploy/templates/nginx/tcdx-frontend-http.conf; check_file nginx.frontend_https deploy/templates/nginx/tcdx-frontend-https.conf; check_file nginx.backend_api deploy/templates/nginx/tcdx-backend-api.conf
 check_file env.root .env.example; check_file env.backend backend/.env.example; [ -f frontend/.env.example ] && record PASS env.frontend "frontend/.env.example existe" || record WARN env.frontend "frontend/.env.example no existe; revisar si se mantiene solo .env raíz"; check_file env.ai_engine ai-engine/.env.example
 run_check node.app node -c backend/src/app.js; run_check node.ai_auditor node -c backend/src/routes/ai-auditor.routes.js; run_check node.ai_compliance node -c backend/src/routes/ai-compliance.routes.js; run_check node.auth_middleware node -c backend/src/middleware/auth.js; run_check node.rbac_middleware node -c backend/src/middleware/rbac.middleware.js
 run_check python.ai_main python3 -m py_compile ai-engine/main.py; run_check python.ai_route python3 -m py_compile ai-engine/app/routes/ai.py
 run_check bash.env_check bash -n scripts/env-check.sh; run_check bash.qa_security bash -n scripts/qa-security-basic.sh; run_check bash.qa_rbac bash -n scripts/qa-rbac-basic.sh; run_check bash.qa_ai_auditor bash -n scripts/qa-ai-auditor-full.sh; run_check bash.qa_cloud bash -n scripts/qa-cloud-readiness.sh
 grep -q "PORT=3001" deploy/templates/systemd/tecdex-frontend.service && record PASS template.frontend_port "frontend systemd usa PORT=3001" || record FAIL template.frontend_port "frontend systemd no declara PORT=3001"
 grep -q "127.0.0.1:3001" deploy/templates/nginx/tcdx-frontend-http.conf && record PASS template.nginx_frontend_proxy "HTTP proxy a Next 3001" || record FAIL template.nginx_frontend_proxy "HTTP no proxy a Next 3001"
 grep -q "127.0.0.1:3000" deploy/templates/nginx/tcdx-backend-api.conf && record PASS template.nginx_api_proxy "API proxy a backend 3000" || record FAIL template.nginx_api_proxy "API no proxy a backend 3000"
 echo ""; echo "Resumen:"; echo "PASS: $PASS"; echo "WARN: $WARN"; echo "FAIL: $FAIL"; echo "TXT : $TXT"; echo "JSON: $JSON"; echo "MD  : $MD"
} | tee "$TXT"
python3 - "$JSON" "$PASS" "$WARN" "$FAIL" "$ITEMS" <<'PY'
import json, sys
path,p,w,f,items_path=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),sys.argv[5]
items=[]
try:
    with open(items_path,encoding='utf-8') as fh:
        for line in fh:
            if line.strip(): items.append(json.loads(line))
except FileNotFoundError: pass
with open(path,'w',encoding='utf-8') as fh: json.dump({'pass':p,'warn':w,'fail':f,'items':items},fh,ensure_ascii=False,indent=2)
PY
{ echo "# TCDX QA Cloud Readiness"; echo ""; echo "- PASS: $PASS"; echo "- WARN: $WARN"; echo "- FAIL: $FAIL"; echo ""; echo "Ver TXT: \`$TXT\`"; } > "$MD"
rm -f "$ITEMS"
test "$FAIL" -eq 0
