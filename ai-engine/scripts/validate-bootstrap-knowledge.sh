#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BOOTSTRAP_DIR="${AI_ENGINE_DIR}/knowledge/bootstrap"
TOPICS_FILE="${BOOTSTRAP_DIR}/topics/bootstrap_topics.json"
SEEDS_DIR="${BOOTSTRAP_DIR}/seeds"

python3 - "$BOOTSTRAP_DIR" "$TOPICS_FILE" "$SEEDS_DIR" <<'PY'
import json
import re
import sys
from pathlib import Path

bootstrap_dir = Path(sys.argv[1])
topics_file = Path(sys.argv[2])
seeds_dir = Path(sys.argv[3])

errors = []

required_dirs = [
    "topics",
    "sources",
    "generated",
    "approved",
    "pending_review",
    "rejected",
    "logs",
    "seeds",
]

topic_required = {
    "code",
    "title",
    "query_templates",
    "domain",
    "module",
    "standard_code",
    "knowledge_types",
    "priority",
    "max_results",
}

seed_required = {
    "title",
    "knowledge_type",
    "domain",
    "module",
    "standard_code",
    "summary",
    "content",
    "recommended_application",
    "tags",
    "confidence_score",
    "origin",
    "status",
}

sensitive_patterns = [
    ("email", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
    ("private_ip_10", re.compile(r"\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")),
    ("private_ip_172", re.compile(r"\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b")),
    ("private_ip_192", re.compile(r"\b192\.168\.\d{1,3}\.\d{1,3}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")),
    ("rut", re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b")),
    ("secret_like", re.compile(r"\b(?:sk|pk|api|key|token|secret)[-_]?[A-Za-z0-9]{20,}\b", re.I)),
    ("env_file", re.compile(r"\.env\b", re.I)),
    ("tenant_id", re.compile(r"\btenant_id\b", re.I)),
    ("known_client_rieltec", re.compile(r"\brieltec\b", re.I)),
]


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{path}: invalid_json line={exc.lineno} col={exc.colno}")
    except OSError as exc:
        errors.append(f"{path}: read_error {exc}")
    return None


def scan_sensitive(path: Path, value):
    raw = json.dumps(value, ensure_ascii=False)
    for label, pattern in sensitive_patterns:
        if pattern.search(raw):
            errors.append(f"{path}: sensitive_pattern_detected={label}")


for dirname in required_dirs:
    path = bootstrap_dir / dirname
    if not path.is_dir():
        errors.append(f"missing_dir={path}")

topics = load_json(topics_file)
if not isinstance(topics, list):
    errors.append(f"{topics_file}: expected list")
    topics = []

topic_codes = set()
for index, topic in enumerate(topics):
    if not isinstance(topic, dict):
        errors.append(f"{topics_file}: topic[{index}] is not object")
        continue

    missing = sorted(topic_required - set(topic.keys()))
    if missing:
        errors.append(f"{topics_file}: topic[{index}] missing={','.join(missing)}")

    code = str(topic.get("code") or "").strip()
    if not code:
        errors.append(f"{topics_file}: topic[{index}] empty code")
    elif code in topic_codes:
        errors.append(f"{topics_file}: duplicate topic code={code}")
    else:
        topic_codes.add(code)

    queries = topic.get("query_templates")
    if not isinstance(queries, list) or not queries:
        errors.append(f"{topics_file}: topic[{index}] query_templates must be non-empty list")
    elif any(not isinstance(item, str) or len(item.strip()) < 8 for item in queries):
        errors.append(f"{topics_file}: topic[{index}] has invalid query template")

    max_results = topic.get("max_results")
    if not isinstance(max_results, int) or max_results < 1 or max_results > 10:
        errors.append(f"{topics_file}: topic[{index}] max_results must be 1..10")

    scan_sensitive(topics_file, topic)

seed_files = sorted(seeds_dir.glob("*.json"))
if not seed_files:
    errors.append(f"{seeds_dir}: no seed json files found")

seed_titles = set()
seed_count = 0
for seed_file in seed_files:
    data = load_json(seed_file)
    if not isinstance(data, list):
        errors.append(f"{seed_file}: expected list")
        continue

    for index, item in enumerate(data):
        seed_count += 1
        if not isinstance(item, dict):
            errors.append(f"{seed_file}: item[{index}] is not object")
            continue

        missing = sorted(seed_required - set(item.keys()))
        if missing:
            errors.append(f"{seed_file}: item[{index}] missing={','.join(missing)}")

        title = str(item.get("title") or "").strip().lower()
        if not title:
            errors.append(f"{seed_file}: item[{index}] empty title")
        elif title in seed_titles:
            errors.append(f"{seed_file}: duplicate seed title={title}")
        else:
            seed_titles.add(title)

        score = item.get("confidence_score")
        if not isinstance(score, int) or score < 0 or score > 100:
            errors.append(f"{seed_file}: item[{index}] confidence_score must be 0..100")

        if item.get("origin") != "bootstrap_seed":
            errors.append(f"{seed_file}: item[{index}] origin must be bootstrap_seed")

        if item.get("status") != "bootstrap_approved":
            errors.append(f"{seed_file}: item[{index}] status must be bootstrap_approved")

        scan_sensitive(seed_file, item)

if errors:
    print("ERROR bootstrap knowledge validation failed:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"OK bootstrap dirs: {bootstrap_dir}")
print(f"OK topics: {len(topics)}")
print(f"OK seed files: {len(seed_files)}")
print(f"OK seed items: {seed_count}")
print("OK sensitive scan")
PY
