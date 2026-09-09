-- DB-N05 controlled QA reference catalog export.
--
-- Run manually against authorized QA/read-only PostgreSQL only.
-- Do not run from Codex against db-v4. This script emits CSV sections to stdout;
-- Each copy command occupies one physical line for psql.
-- Inactive/version status is preserved; catalog mappings have no version authority.
-- convert reviewed outputs into database/reference/iso/* versioned files.

\set ON_ERROR_STOP on
\pset pager off
\pset format csv
\pset tuples_only off

BEGIN READ ONLY;

SELECT
  current_database() AS database_name,
  current_user AS db_user,
  version() AS postgres_version,
  now() AS export_timestamp,
  current_setting('transaction_read_only') AS transaction_read_only;

\echo 'DBN05_EXPORT_SECTION standards'
\copy (SELECT standard_code, display_name, family, description, is_active, created_at, updated_at FROM public.iso_standards WHERE standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') ORDER BY standard_code) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION standard_versions'
\copy (SELECT sv.id AS standard_version_id, sv.standard_code, sv.version_code, sv.display_name, sv.publication_status, sv.certifiable, sv.replaces_version, sv.effective_from, sv.transition_until, sv.source_policy, sv.notes, sv.is_active FROM public.iso_standard_versions sv WHERE sv.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') ORDER BY sv.standard_code, sv.version_code) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION controls_catalog'
\copy (SELECT cc.id AS qa_control_id, cc.iso AS qa_standard_code, cc.clause, cc.category, cc.description, cc.source_type, cc.is_active, cc.base_control_id, cc.created_at, cc.updated_at FROM public.controls_catalog cc WHERE cc.tenant_id IS NULL AND cc.iso IN ('ISO9001', 'ISO27001', 'ISO42001') AND cc.source_type !~* '(^|[^a-z])(demo|test|preview|backup)([^a-z]|$)' ORDER BY cc.iso, cc.clause, cc.id) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION control_standard_mappings'
\copy (SELECT ccs.control_id AS qa_control_id, cc.iso AS qa_catalog_standard_code, ccs.standard_code AS mapped_standard_code, ccs.clause AS mapped_clause, ccs.is_primary, ccs.created_at, ccs.updated_at FROM public.controls_catalog_standards ccs JOIN public.controls_catalog cc ON cc.id = ccs.control_id WHERE cc.tenant_id IS NULL AND cc.iso IN ('ISO9001', 'ISO27001', 'ISO42001') AND ccs.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') AND cc.source_type !~* '(^|[^a-z])(demo|test|preview|backup)([^a-z]|$)' ORDER BY cc.iso, ccs.standard_code, ccs.clause, ccs.control_id) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION iso_controls'
\copy (SELECT ic.id AS iso_control_id, ic.standard_version_id, ic.standard_code, ic.version_code, ic.control_code, ic.title, ic.description, ic.control_type, ic.domain, ic.default_priority, ic.default_frequency, ic.owner_role_suggested, ic.copyright_safe_summary, ic.is_active, ic.created_at, ic.updated_at FROM public.iso_controls ic WHERE ic.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') ORDER BY ic.standard_code, ic.version_code, ic.control_code) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION iso_evidence_expectations'
\copy (SELECT standard_code, version_code, control_code, evidence_name, evidence_type, description, required_level, freshness_days, validation_criteria, ai_review_guidance, created_at, updated_at FROM public.iso_evidence_expectations WHERE standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') ORDER BY standard_code, version_code, control_code, evidence_type, evidence_name) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION version_coverage'
\copy (SELECT sv.standard_code, sv.version_code, sv.publication_status, sv.source_policy, sv.is_active, count(ic.id) AS control_rows, count(ic.id) FILTER (WHERE ic.is_active IS TRUE) AS active_control_rows FROM public.iso_standard_versions sv LEFT JOIN public.iso_controls ic ON ic.standard_version_id = sv.id AND ic.standard_code = sv.standard_code AND ic.version_code = sv.version_code WHERE sv.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') GROUP BY sv.standard_code, sv.version_code, sv.publication_status, sv.source_policy, sv.is_active ORDER BY sv.standard_code, sv.version_code) TO STDOUT WITH CSV HEADER

\echo 'DBN05_EXPORT_SECTION data_quality'
\copy (WITH approved_controls AS ( SELECT cc.id, cc.iso, cc.clause FROM public.controls_catalog cc WHERE cc.tenant_id IS NULL AND cc.iso IN ('ISO9001', 'ISO27001', 'ISO42001') AND cc.source_type !~* '(^|[^a-z])(demo|test|preview|backup)([^a-z]|$)' ), duplicate_catalog AS ( SELECT iso, clause FROM approved_controls GROUP BY iso, clause HAVING count(*) > 1 ), duplicate_mappings AS ( SELECT ccs.control_id, ccs.standard_code FROM public.controls_catalog_standards ccs JOIN approved_controls cc ON cc.id = ccs.control_id WHERE ccs.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') GROUP BY ccs.control_id, ccs.standard_code HAVING count(*) > 1 ), scoped_controls AS ( SELECT ic.standard_version_id, ic.standard_code, ic.version_code, ic.control_code, ic.title FROM public.iso_controls ic WHERE ic.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') ) SELECT 'catalog_missing_clause' AS check_name, count(*)::text AS result FROM approved_controls WHERE NULLIF(trim(clause), '') IS NULL UNION ALL SELECT 'catalog_duplicate_natural_codes', count(*)::text FROM duplicate_catalog UNION ALL SELECT 'mapping_duplicate_groups', count(*)::text FROM duplicate_mappings UNION ALL SELECT 'iso_control_missing_code_or_title', count(*)::text FROM scoped_controls WHERE NULLIF(trim(control_code), '') IS NULL OR NULLIF(trim(title), '') IS NULL UNION ALL SELECT 'iso_control_duplicate_version_codes', count(*)::text FROM ( SELECT standard_code, version_code, control_code FROM scoped_controls GROUP BY standard_code, version_code, control_code HAVING count(*) > 1 ) duplicates UNION ALL SELECT 'iso_control_unresolved_version', count(*)::text FROM scoped_controls ic WHERE NOT EXISTS (SELECT 1 FROM public.iso_standard_versions sv WHERE sv.id = ic.standard_version_id AND sv.standard_code = ic.standard_code AND sv.version_code = ic.version_code) UNION ALL SELECT 'evidence_unresolved_control', count(*)::text FROM public.iso_evidence_expectations ie WHERE ie.standard_code IN ('ISO9001', 'ISO27001', 'ISO42001') AND NOT EXISTS (SELECT 1 FROM public.iso_controls ic WHERE ic.standard_code = ie.standard_code AND ic.version_code = ie.version_code AND ic.control_code = ie.control_code)) TO STDOUT WITH CSV HEADER

ROLLBACK;
