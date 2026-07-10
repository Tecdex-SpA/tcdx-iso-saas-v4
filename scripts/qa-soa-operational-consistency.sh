#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOA_ROUTE="$ROOT_DIR/backend/src/routes/soa.routes.js"
ACTION_ROUTE="$ROOT_DIR/backend/src/routes/action-plans.routes.js"
UTIL_DIR="$ROOT_DIR/backend/src/utils"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

grep -q "router.get('/:tenant_id'" "$SOA_ROUTE" || fail "GET SOA route not found"
grep -q "requires_initialization" "$SOA_ROUTE" || fail "GET SOA does not expose requires_initialization"
grep -q "buildSoAMetrics(rows)" "$SOA_ROUTE" || fail "GET SOA does not use canonical backend metrics"
! grep -q "bootstrapSoA(pool" "$SOA_ROUTE" || fail "SOA still bootstraps with pool outside transaction"
grep -q "bootstrapSoA(client, tenant_id, iso)" "$SOA_ROUTE" || fail "initialize does not bootstrap with transaction client"
grep -q "source: 'initialize'" "$SOA_ROUTE" || fail "initialize change log source missing"
grep -q "source: 'manual'" "$SOA_ROUTE" || fail "manual update change log source missing"
grep -q "validateSoAState(next)" "$SOA_ROUTE" || fail "manual SOA validation missing"
grep -q "FOR UPDATE OF a" "$ROOT_DIR/backend/src/services/soaIntelligence.service.js" || fail "applyAssessment does not lock assessment with FOR UPDATE OF a"
perl -0ne 'exit 1 if /LEFT JOIN control_soa[\s\S]{0,200}FOR UPDATE/' "$ROOT_DIR/backend/src/services/soaIntelligence.service.js" || fail "applyAssessment still uses FOR UPDATE on LEFT JOIN control_soa"
grep -q "resolveSoAControlReference" "$ACTION_ROUTE" || fail "action plans do not resolve modern/legacy SOA control IDs"
grep -q "valid_evidence_count" "$UTIL_DIR/soaMetrics.js" || fail "SOA metrics do not track valid evidence"
grep -q "IMPLEMENTED_WITH_REJECTED_EVIDENCE" "$UTIL_DIR/soaValidation.js" || fail "SOA inconsistencies missing rejected evidence rule"
grep -q "NOT_APPLICABLE_WITH_HIGH_RISK" "$UTIL_DIR/soaValidation.js" || fail "SOA inconsistencies missing high-risk no-applicable rule"

echo "SOA operational consistency static QA OK"
