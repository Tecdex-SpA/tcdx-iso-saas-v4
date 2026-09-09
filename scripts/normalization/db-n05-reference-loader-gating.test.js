#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ISO_REFERENCE_MANIFEST, loadVersionedIsoReferenceCatalogs, readIsoReferenceManifest } = require('./load-production-reference-catalogs');
(async () => {
  const calls=[];
  const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[{id:'synthetic-test-only'}]};}};
  const original=readIsoReferenceManifest({required:true});
  const directory=fs.mkdtempSync(path.join(path.dirname(ISO_REFERENCE_MANIFEST),'.loader-test-'));
  const clone=()=>JSON.parse(JSON.stringify(original));
  const badFile=(mutate, kind='controls')=>{
    const manifest=clone(); const source=manifest.standards[0];
    const field=kind==='controls'?'controls_file':'evidence_expectations_file';
    const rows=fs.readFileSync(path.join(path.dirname(ISO_REFERENCE_MANIFEST),source[field]),'utf8').trim().split('\n').map(JSON.parse);
    mutate(rows);
    const file=path.join(directory,`${kind}.jsonl`);fs.writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    source[field]=path.relative(path.dirname(ISO_REFERENCE_MANIFEST),file);
    source.sha256[kind]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return manifest;
  };
  const run=manifest=>loadVersionedIsoReferenceCatalogs(client,{manifest});
  try {
    let manifest=clone();manifest.standards[0].status=manifest.standards[0].loader_status='requires_additional_readonly_export';
    await assert.rejects(()=>run(manifest),/Unapproved/);
    manifest=clone();manifest.standards[0].controls_file='missing.jsonl';await assert.rejects(()=>run(manifest),/missing or outside/);
    manifest=clone();manifest.standards[0].sha256.controls='bad';await assert.rejects(()=>run(manifest),/checksum mismatch/);
    manifest=clone();manifest.standards[0].row_count++;await assert.rejects(()=>run(manifest),/row_count mismatch/);
    await assert.rejects(()=>run(badFile(rows=>{rows[1].control_code=rows[0].control_code;})),/Duplicate ISO reference control code/);
    await assert.rejects(()=>run(badFile(rows=>{rows[0].title='';})),/without title/);
    await assert.rejects(()=>run(badFile(rows=>{rows[0].control_code='unresolved';},'evidence_expectations')),/Unresolved ISO evidence/);
    await assert.rejects(()=>run(badFile(rows=>{rows[0].version_code='different';},'evidence_expectations')),/Unresolved ISO evidence/);
    manifest=clone();manifest.standards.at(-1).certifiable=true;await assert.rejects(()=>run(manifest),/certification\/transition/);
    assert.equal(calls.length,0,'all invalid sources must fail before any write');
    const first=await run(original);const firstCalls=calls.splice(0);
    assert.deepEqual(await run(original),first);assert.deepEqual(calls,firstCalls);
    assert.deepEqual(first,{standards:3,versions:4,controls:61,evidenceExpectations:54,sources:4});
    for(const call of calls) assert.match(call.sql,/ON CONFLICT/);
    const sellable=calls.filter(c=>/INSERT INTO standards \(/.test(c.sql));
    assert.equal(sellable.length,3);
    assert.ok(sellable.every(c=>!c.params.some(p=>typeof p==='string' && p.includes('2026'))));
    console.log('REFERENCE_LOADER_GATING PASS invalid-source/no-write/version-isolation/transition/deterministic-upserts');
  } finally {fs.rmSync(directory,{recursive:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
