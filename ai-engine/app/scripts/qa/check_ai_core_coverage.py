import json
import sys
from pathlib import Path

BASE_DIR = Path("/home/tecdex/ai-engine")
sys.path.insert(0, str(BASE_DIR))

from app.services.ai_core_db import fetch_all, fetch_one


def check_count(label, query, minimum):
    row = fetch_one(query)
    total = int(row["total"] or 0)

    return {
        "label": label,
        "total": total,
        "minimum_expected": minimum,
        "ok": total >= minimum,
    }


def main():
    checks = []

    checks.append(check_count(
        "Normas ISO registradas",
        "SELECT COUNT(*)::int AS total FROM ai_core.standards_catalog WHERE is_active = true",
        26,
    ))

    checks.append(check_count(
        "Dominios registrados",
        "SELECT COUNT(*)::int AS total FROM ai_core.domains_catalog WHERE is_active = true",
        40,
    ))

    checks.append(check_count(
        "Mapeos norma-dominio",
        "SELECT COUNT(*)::int AS total FROM ai_core.standard_domain_map WHERE is_active = true",
        250,
    ))

    checks.append(check_count(
        "Mapeos dominio-problema",
        "SELECT COUNT(*)::int AS total FROM ai_core.domain_problem_type_map WHERE is_active = true",
        120,
    ))

    checks.append(check_count(
        "Evidencias por dominio",
        "SELECT COUNT(*)::int AS total FROM ai_core.domain_evidence_expectations WHERE is_active = true",
        30,
    ))

    checks.append(check_count(
        "Playbooks por dominio",
        "SELECT COUNT(*)::int AS total FROM ai_core.domain_solution_playbooks WHERE is_active = true",
        15,
    ))

    checks.append(check_count(
        "Criterios de cierre por dominio",
        "SELECT COUNT(*)::int AS total FROM ai_core.domain_closure_criteria WHERE is_active = true",
        15,
    ))

    standards_without_domains = fetch_all("""
        SELECT sc.standard_code, sc.display_code, sc.name
        FROM ai_core.standards_catalog sc
        LEFT JOIN ai_core.standard_domain_map sdm
          ON sdm.standard_code = sc.standard_code
         AND sdm.is_active = true
        WHERE sc.is_active = true
          AND sdm.id IS NULL
        ORDER BY sc.standard_code
    """)

    domains_without_mapping = fetch_all("""
        SELECT dc.domain_code, dc.domain_name
        FROM ai_core.domains_catalog dc
        LEFT JOIN ai_core.standard_domain_map sdm
          ON sdm.domain_code = dc.domain_code
         AND sdm.is_active = true
        WHERE dc.is_active = true
          AND sdm.id IS NULL
        ORDER BY dc.domain_code
    """)

    problem_domains_without_knowledge = fetch_all("""
        SELECT dptm.domain_code, dc.domain_name, COUNT(*)::int AS problem_types
        FROM ai_core.domain_problem_type_map dptm
        JOIN ai_core.domains_catalog dc
          ON dc.domain_code = dptm.domain_code
        LEFT JOIN ai_core.domain_evidence_expectations dee
          ON dee.domain_code = dptm.domain_code
         AND dee.is_active = true
        LEFT JOIN ai_core.domain_solution_playbooks dsp
          ON dsp.domain_code = dptm.domain_code
         AND dsp.is_active = true
        LEFT JOIN ai_core.domain_closure_criteria dcc
          ON dcc.domain_code = dptm.domain_code
         AND dcc.is_active = true
        WHERE dptm.is_active = true
        GROUP BY dptm.domain_code, dc.domain_name
        HAVING COUNT(dee.id) = 0
            OR COUNT(dsp.id) = 0
            OR COUNT(dcc.id) = 0
        ORDER BY dptm.domain_code
    """)

    overall_ok = (
        all(item["ok"] for item in checks)
        and len(standards_without_domains) == 0
        and len(domains_without_mapping) == 0
    )

    result = {
        "ok": overall_ok,
        "checks": checks,
        "standards_without_domains": standards_without_domains,
        "domains_without_mapping": domains_without_mapping,
        "domains_with_partial_knowledge": problem_domains_without_knowledge[:50],
    }

    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))

    if not overall_ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
