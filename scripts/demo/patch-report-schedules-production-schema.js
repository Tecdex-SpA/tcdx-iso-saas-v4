#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../../database/migrations/20260803_demo_tenant_visual_completion.sql');
const source = fs.readFileSync(file, 'utf8');

const before = `INSERT INTO report_schedules (\n  id, tenant_id, report_definition_id, schedule_key, frequency, timezone,\n  next_run_at, last_run_at, status, created_by, created_at, updated_at, metadata\n)\nSELECT pg_temp.demo_visual_uuid('report-schedule-'||report_key), c.tenant_id,\n       pg_temp.demo_base_uuid('report-'||report_key), 'demo_schedule_'||report_key,\n       CASE WHEN report_key='executive_grc' THEN 'monthly' WHEN report_key='risks' THEN 'quarterly' ELSE 'monthly' END,\n       'America/Santiago', date_trunc('month',now())+interval '1 month 8 hours',\n       date_trunc('month',now())+interval '8 hours', 'active', c.admin_id,\n       now()-interval '8 months', now(),\n       jsonb_build_object('source','demo_visual_completion','recipients',jsonb_build_array('admin','auditor'))\nFROM demo_visual_context c CROSS JOIN (VALUES ('executive_grc'),('risks'),('compliance'),('data_quality')) r(report_key)\nON CONFLICT (tenant_id, schedule_key) DO UPDATE SET frequency=EXCLUDED.frequency,\n  next_run_at=EXCLUDED.next_run_at, last_run_at=EXCLUDED.last_run_at,\n  status='active', metadata=EXCLUDED.metadata, updated_at=now();`;

const after = `INSERT INTO report_schedules (\n  id, tenant_id, report_type_code, frequency, day_of_month, recipients,\n  is_active, created_by, last_sent_at, next_run_at, notes, metadata,\n  created_at, updated_at\n)\nSELECT pg_temp.demo_visual_uuid('report-schedule-'||report_key), c.tenant_id,\n       CASE report_key\n         WHEN 'executive_grc' THEN 'executive_iso_status'\n         WHEN 'risks' THEN 'iso_risk_report'\n         WHEN 'compliance' THEN 'control_health_report'\n         WHEN 'data_quality' THEN 'maturity_gap_diagnostic'\n       END,\n       CASE WHEN report_key='risks' THEN 'quarterly' ELSE 'monthly' END,\n       CASE WHEN report_key='executive_grc' THEN 1 WHEN report_key='risks' THEN 15 ELSE 5 END,\n       jsonb_build_array('admin.demo@tcdx.demo','auditor.demo@tcdx.demo'),\n       true, c.admin_id,\n       date_trunc('month',now())+interval '8 hours',\n       date_trunc('month',now())+interval '1 month 8 hours',\n       'Programación demo determinística para cobertura comercial.',\n       jsonb_build_object('source','demo_visual_completion','report_key',report_key,'timezone','America/Santiago'),\n       now()-interval '8 months', now()\nFROM demo_visual_context c\nCROSS JOIN (VALUES ('executive_grc'),('risks'),('compliance'),('data_quality')) r(report_key)\nON CONFLICT (id) DO UPDATE SET\n  report_type_code=EXCLUDED.report_type_code,\n  frequency=EXCLUDED.frequency,\n  day_of_month=EXCLUDED.day_of_month,\n  recipients=EXCLUDED.recipients,\n  is_active=true,\n  created_by=EXCLUDED.created_by,\n  last_sent_at=EXCLUDED.last_sent_at,\n  next_run_at=EXCLUDED.next_run_at,\n  notes=EXCLUDED.notes,\n  metadata=EXCLUDED.metadata,\n  updated_at=now();`;

if (!source.includes(before)) {
  throw new Error('Expected legacy report_schedules block was not found; no changes written.');
}

const updated = source.replace(before, after);
fs.writeFileSync(file, updated);
process.stdout.write('report_schedules migration block updated for production schema\n');
