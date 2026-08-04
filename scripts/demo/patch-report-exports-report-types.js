#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../../database/migrations/20260803_demo_tenant_visual_completion.sql');
const before = "(ARRAY['executive_iso_status','risk_register','compliance_status','audit_summary'])[((gs-1)%4)+1]";
const after = "(ARRAY['executive_iso_status','iso_risk_report','control_health_report','internal_audit_report'])[((gs-1)%4)+1]";

const sql = fs.readFileSync(file, 'utf8');
const occurrences = sql.split(before).length - 1;

if (occurrences !== 1) {
  throw new Error(`Expected exactly one legacy report type mapping, found ${occurrences}`);
}

fs.writeFileSync(file, sql.replace(before, after));
process.stdout.write('report_exports report type mapping updated for production catalog\n');
