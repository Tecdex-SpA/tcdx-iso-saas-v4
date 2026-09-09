#!/usr/bin/env python3
"""Deterministically materialize the manually supplied CSV transcript; no DB access."""
import csv
import hashlib
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'artifacts/db-n05/qa-catalog-audit/DB-N05_REFERENCE_EXPORT_RESULT.txt'
DEST = ROOT / 'database/reference/iso'
CHECK = '--check' in sys.argv

def sha(data):
    return hashlib.sha256(data).hexdigest()

def parse_export():
    text = SOURCE.read_text()
    assert text.rstrip().endswith('ROLLBACK'), 'Incomplete export'
    # csv.reader preserves commas/newlines/escaped quotes. No quoted empty strings
    # occur in this approved input; fail instead of conflating them with SQL NULL.
    assert not re.search(r'(?:^|,)""(?:,|\r?$)', text, re.M), 'Quoted empty requires explicit null-aware parser'
    header = text.index('database_name,')
    meta = next(csv.DictReader(io.StringIO(text[header:text.index('DBN05_EXPORT_SECTION')])) )
    assert meta['transaction_read_only'] == 'on' and 'PostgreSQL 16.15' in meta['postgres_version']
    parts = re.split(r'^DBN05_EXPORT_SECTION (\w+)\s*\n', text, flags=re.M)
    sections = {}
    for i in range(1, len(parts), 2):
        body = parts[i+1].removesuffix('ROLLBACK\n')
        sections[parts[i]] = list(csv.DictReader(io.StringIO(body)))
    assert len(sections) == 8
    dq = {r['check_name']: int(r['result']) for r in sections['data_quality']}
    for key in ['iso_control_missing_code_or_title', 'iso_control_duplicate_version_codes', 'iso_control_unresolved_version', 'evidence_unresolved_control', 'mapping_duplicate_groups']:
        assert dq[key] == 0, (key, dq[key])
    assert dq['catalog_duplicate_natural_codes'] == 16
    return meta, sections

def normalize(row, fields):
    result = {key: row[key] if row[key] != '' else None for key in fields}
    for key in ['is_active', 'certifiable']:
        if key in result:
            assert result[key] in ('t', 'f')
            result[key] = result[key] == 't'
    if 'freshness_days' in result and result['freshness_days'] is not None:
        result['freshness_days'] = int(result['freshness_days'])
    if 'validation_criteria' in result:
        result['validation_criteria'] = json.loads(result['validation_criteria'])
    return result

def write_json(path, value, jsonl=False):
    text = ''.join(json.dumps(row, ensure_ascii=False, separators=(',', ':'))+'\n' for row in value) if jsonl else json.dumps(value, ensure_ascii=False, indent=2)+'\n'
    data = text.encode('utf-8')
    if CHECK:
        assert path.read_bytes() == data, f'Materialized source drift: {path}'
    else:
        path.write_bytes(data)
    return sha(data)

def main():
    export_meta, sections = parse_export()
    evidence_sha = sha(SOURCE.read_bytes())
    manifest = {'schema':'tcdx.iso_reference_manifest', 'version':2, 'source_type':'migrated_reference_from_qa', 'source_audit':str(SOURCE.relative_to(ROOT)), 'source_sha256':evidence_sha, 'export_timestamp':export_meta['export_timestamp'], 'status':'approved_with_transition_only', 'standards':[]}
    compatibility = {('ISO9001','2015'):'ISO_9001_2015', ('ISO27001','2022'):'ISO_27001_2022', ('ISO42001','2023'):'ISO_42001'}
    counts = {('ISO9001','2015'):16, ('ISO9001','2026_FDIS'):8, ('ISO27001','2022'):21, ('ISO42001','2023'):16}
    controls_fields = ['standard_code','version_code','control_code','title','description','control_type','domain','default_priority','default_frequency','owner_role_suggested','copyright_safe_summary','is_active']
    evidence_fields = ['standard_code','version_code','control_code','evidence_name','evidence_type','description','required_level','freshness_days','validation_criteria','ai_review_guidance']
    for version in sections['standard_versions']:
        key = (version['standard_code'],version['version_code'])
        assert key in counts
        transition = key == ('ISO9001','2026_FDIS')
        assert (version['publication_status'],version['certifiable']) == (('transition_prep','f') if transition else ('published','t'))
        folder = DEST / (version['standard_code'].replace('ISO','ISO-',1)+'-'+version['version_code'].replace('_','-'))
        if not CHECK:
            folder.mkdir(exist_ok=True, parents=True)
        controls = [normalize(row,controls_fields) for row in sections['iso_controls'] if (row['standard_code'],row['version_code']) == key]
        controls.sort(key=lambda row: row['control_code'])
        assert len(controls) == counts[key]
        codes = {r['control_code'] for r in controls}
        assert len(codes) == len(controls) and all(r['title'] and r['control_code'] for r in controls)
        evidence = [normalize(row,evidence_fields) for row in sections['iso_evidence_expectations'] if (row['standard_code'],row['version_code']) == key]
        evidence.sort(key=lambda row:(row['control_code'],row['evidence_type'],row['evidence_name']))
        assert all(row['control_code'] in codes for row in evidence)
        assert len({(r['control_code'],r['evidence_type'],r['evidence_name']) for r in evidence}) == len(evidence)
        standard = next(r for r in sections['standards'] if r['standard_code'] == key[0])
        metadata = normalize(version, [k for k in version if k != 'standard_version_id'])
        metadata['standard'] = normalize(standard,['standard_code','display_name','family','description','is_active'])
        metadata.update(source_audit=manifest['source_audit'], source_sha256=evidence_sha, status='transition_only' if transition else 'approved_for_loader')
        hashes = {'controls':write_json(folder/'controls.jsonl', controls, True), 'evidence_expectations':write_json(folder/'evidence_expectations.jsonl', evidence, True), 'metadata':write_json(folder/'metadata.json', metadata)}
        manifest['standards'].append(dict(standard_code=key[0],version_code=key[1],product_standard_code=compatibility.get(key),source_type='migrated_reference_from_qa',source_audit=manifest['source_audit'], publication_status=metadata['publication_status'],certifiable=metadata['certifiable'],loader_status=metadata['status'],status=metadata['status'],controls_file=str((folder/'controls.jsonl').relative_to(DEST)),evidence_expectations_file=str((folder/'evidence_expectations.jsonl').relative_to(DEST)),metadata_file=str((folder/'metadata.json').relative_to(DEST)),row_count=len(controls),evidence_row_count=len(evidence),sha256=hashes))
    assert len(manifest['standards']) == 4
    write_json(DEST/'manifest.json',manifest)
    groups=defaultdict(list)
    for row in sections['controls_catalog']: groups[(row['qa_standard_code'],row['clause'])].append(row)
    duplicates={k:v for k,v in groups.items() if len(v)>1}
    assert len(duplicates)==16
    lines=['# DB-N05 controls_catalog duplicate analysis','',f'Source SHA-256: `{evidence_sha}`. Immutable source: `{manifest["source_audit"]}`.','', 'All 16 groups are excluded from the versioned loader. Semantic identity is (standard_code, version_code, control_code) from iso_controls. QA UUIDs below are evidence references only. No rows deleted, merged or selected arbitrarily.','', '| Standard | Clause | Rows | Classification | Evidence / decision |','| --- | --- | ---: | --- | --- |']
    for (code,clause),rows in sorted(duplicates.items()):
        payloads={(r['category'],r['description'],r['source_type'],r['is_active']) for r in rows}
        classification='SAME_SEMANTIC_DIFFERENT_ROW' if len(payloads)==1 else 'REQUIRES_MANUAL_REVIEW'
        lines.append(f'| {code} | {clause} | {len(rows)} | {classification} | {len(payloads)} distinct payloads; no version authority; compatibility only, does not block versioned load |')
    lines+=['','Distinct descriptions under a reused clause do not establish semantic equivalence. LEGACY_DUPLICATE or COMPATIBILITY_DUPLICATE is not asserted without lineage proving that classification. Manual review applies only to a future legacy migration, not to the present versioned source.','']
    for key,rows in sorted(duplicates.items()):
        lines += [f'## {key[0]} / {key[1]}','']
        for r in rows:lines.append(f'- `{r["qa_control_id"]}`: {r["description"]} (source_type={r["source_type"]}, active={r["is_active"]}).')
        lines.append('')
    report = ROOT/'artifacts/db-n05/CONTROLS_CATALOG_DUPLICATE_ANALYSIS.md'
    if CHECK:
        assert report.read_text() == '\n'.join(lines), 'Duplicate analysis drift'
    else:
        report.write_text('\n'.join(lines))
    print('MATERIALIZATION_CHECK PASS' if CHECK else 'MATERIALIZED',[(s['standard_code'],s['version_code'],s['row_count'],s['evidence_row_count'],s['status']) for s in manifest['standards']])
    print('SOURCE_SHA256',evidence_sha)

if __name__=='__main__': main()
