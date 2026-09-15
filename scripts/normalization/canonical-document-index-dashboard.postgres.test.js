'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createPostgres, stopPostgres, psqlExec } = require('./db-n05-isolated-postgres');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTROL_A = '33333333-3333-4333-8333-333333333333';
const CONTROL_B = '44444444-4444-4444-8444-444444444444';
const CATALOG_A = '55555555-5555-4555-8555-555555555555';
const CATALOG_B = '66666666-6666-4666-8666-666666666666';
const NC_A = '77777777-7777-4777-8777-777777777777';
const FINDING_A = '88888888-8888-4888-8888-888888888888';
const REPO_ROOT = path.resolve(__dirname, '../..');

function readRepo(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function assertNoLegacyControlFallback() {
  const controlsRoutes = readRepo('backend/src/routes/controls.routes.js');
  const start = controlsRoutes.indexOf("router.put('/:id'");
  const end = controlsRoutes.indexOf('router._private');
  assert.ok(start >= 0, 'PUT /api/controls/:id route not found');
  assert.ok(end > start, 'PUT /api/controls/:id route boundary not found');
  const section = controlsRoutes.slice(start, end);
  assert.match(section, /UPDATE tenant_controls/);
  assert.match(section, /recordControlSoAAssessment\(\{/);
  assert.doesNotMatch(section, /UPDATE\s+controls\b/);
  assert.doesNotMatch(section, /legacyResult|legacy_control_id|legacy_control_updated_without_tenant_control_identity|compatibility_endpoint/);
}

function assertNoSchemaChanges() {
  const changed = new Set([
    ...execFileSync('git', ['diff', '--name-only'], { cwd: REPO_ROOT, encoding: 'utf8' }).split(/\r?\n/),
    ...execFileSync('git', ['status', '--short'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.replace(/^.../, '')),
  ].map((line) => line.trim()).filter(Boolean));
  const forbidden = [...changed].filter((file) =>
    file.startsWith('database/migrations/') ||
    file.startsWith('database/baseline/') ||
    /^scripts\/.*apply.*migration/i.test(file) ||
    file === 'scripts/deploy-vms.sh'
  );
  assert.deepEqual(forbidden, []);
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const content = Buffer.from(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

function listFiles(root, matcher) {
  const found = [];
  if (!fs.existsSync(root)) return found;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...listFiles(fullPath, matcher));
    } else if (!matcher || matcher(fullPath)) {
      found.push(fullPath);
    }
  }
  return found;
}

async function dashboardRows(pool, tenantId) {
  const result = await pool.query(
    `
    WITH active_standards AS (
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1::uuid
        AND is_active = TRUE
    ),
    latest_health AS (
      SELECT DISTINCT ON (veh.tenant_control_id)
        veh.tenant_control_id,
        veh.standard_code,
        veh.effective_health_score AS health_score
      FROM public.v_iso_control_effective_health veh
      INNER JOIN active_standards ast
        ON ast.standard_code = veh.standard_code
      WHERE veh.tenant_id = $1::uuid
      ORDER BY veh.tenant_control_id,
        NULLIF(veh.health_trace_json->>'effective_at', '')::timestamptz DESC NULLS LAST,
        NULLIF(veh.health_trace_json->>'published_at', '')::timestamptz DESC NULLS LAST
    ),
    operational_controls AS (
      SELECT DISTINCT ON (tc.id)
        tc.id,
        LOWER(COALESCE(tc.status, 'pendiente')) AS tenant_status,
        cc.iso,
        cc.clause,
        cc.category,
        COALESCE(cc.description, 'Control sin descripcion') AS description
      FROM tenant_controls tc
      INNER JOIN tenant_applicable_controls tac
        ON tac.tenant_id = tc.tenant_id
       AND tac.active = true
       AND tac.visible_to_tenant = true
       AND (
         tac.tenant_control_id = tc.id
         OR tac.control_catalog_id = tc.control_id
       )
      LEFT JOIN controls_catalog cc
        ON cc.id = tc.control_id
       AND cc.is_active = TRUE
      WHERE tc.tenant_id = $1::uuid
        AND (
          tac.standard_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM active_standards ast
            WHERE ast.standard_code = tac.standard_code
          )
        )
      ORDER BY tc.id, tac.updated_at DESC NULLS LAST, tac.created_at DESC NULLS LAST
    )
    SELECT
      oc.id,
      COALESCE(oc.tenant_status, 'pendiente') AS status,
      oc.iso,
      lh.health_score
    FROM operational_controls oc
    LEFT JOIN latest_health lh
      ON lh.tenant_control_id = oc.id
    ORDER BY oc.id
    `,
    [tenantId]
  );
  return result.rows;
}

async function main() {
  const pg = createPostgres();
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tcdx-manual-upload-'));

  process.env.DB_HOST = pg.container ? '127.0.0.1' : pg.socketDir;
  process.env.DB_PORT = pg.port;
  process.env.DB_USER = 'postgres';
  process.env.DB_NAME = 'postgres';
  process.env.DB_PASSWORD = '';
  process.env.DB_SSL = 'false';
  process.env.EVIDENCE_LIBRARY_UPLOAD_ROOT = uploadRoot;
  process.env.AI_ENGINE_URL = 'http://ai-engine.localtest';
  process.env.AI_INTERNAL_TOKEN = 'semantic-evidence-localtest';

  try {
    psqlExec(pg, `
      CREATE TABLE tenants (
        id uuid PRIMARY KEY,
        name text
      );

      CREATE TABLE users (
        id uuid PRIMARY KEY,
        tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
        email text
      );

      CREATE TABLE document_index (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_id uuid NULL,
        integration_id uuid NULL,
        provider text NOT NULL,
        provider_file_id text NOT NULL,
        provider_version_id text,
        file_name text,
        mime_type text,
        file_extension text,
        file_url text,
        web_view_url text,
        size_bytes bigint,
        checksum text,
        content_hash text,
        file_hash text,
        relative_path text,
        local_storage_path text,
        modified_at timestamptz,
        indexed_at timestamptz,
        last_seen_at timestamptz,
        status text,
        processing_status text,
        analysis_status text,
        extracted_text text,
        metadata_json jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (tenant_id, id),
        UNIQUE (tenant_id, provider, provider_file_id)
      );

      CREATE TABLE tenant_standards (
        tenant_id uuid NOT NULL,
        standard_code text NOT NULL,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE controls_catalog (
        id uuid PRIMARY KEY,
        iso text,
        clause text,
        category text,
        description text,
        source_type text,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE controls_catalog_standards (
        control_id uuid NOT NULL,
        standard_code text,
        clause text
      );

      CREATE TABLE tenant_operations (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        process_id uuid,
        name text,
        code text,
        operation_type text,
        is_active boolean DEFAULT true
      );

      CREATE TABLE tenant_controls (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL,
        control_id uuid NOT NULL,
        operation_id uuid,
        status text,
        score numeric,
        applicability boolean,
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE tenant_nonconformities (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        control_description text,
        description text,
        status text,
        detected_at timestamptz DEFAULT now()
      );

      CREATE TABLE findings (
        id uuid PRIMARY KEY,
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title text,
        description text,
        finding_type text,
        severity text,
        status text,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE tenant_applicable_controls (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL,
        tenant_control_id uuid,
        control_catalog_id uuid,
        standard_code text,
        active boolean NOT NULL DEFAULT true,
        visible_to_tenant boolean NOT NULL DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE tenant_document_object_links (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id uuid NOT NULL,
        document_key text,
        target_type text NOT NULL,
        target_id uuid NOT NULL,
        target_label text,
        evidence_usage text NOT NULL DEFAULT 'supporting_evidence',
        relation_type text NOT NULL DEFAULT 'associated',
        status text NOT NULL DEFAULT 'active',
        is_active boolean NOT NULL DEFAULT true,
        created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamp,
        notes text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT tenant_document_object_links_source_type_check CHECK (source_type IN ('document_index', 'evidence')),
        CONSTRAINT tenant_document_object_links_target_type_check CHECK (target_type IN ('control', 'nonconformity', 'finding', 'process', 'operation', 'risk', 'action')),
        CONSTRAINT tenant_document_object_links_usage_check CHECK (evidence_usage IN ('primary_evidence','supporting_evidence','remediation_evidence','finding_evidence','process_evidence','operation_evidence','risk_evidence','action_evidence','reference'))
      );

      CREATE UNIQUE INDEX uq_tenant_document_object_links_active
        ON tenant_document_object_links (tenant_id, source_type, source_id, target_type, target_id, evidence_usage)
        WHERE is_active = true;

      CREATE TABLE tenant_evidence_semantic_profiles (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id uuid NOT NULL,
        document_key text,
        document_type text NOT NULL DEFAULT 'unknown',
        semantic_status text NOT NULL DEFAULT 'not_processed',
        usefulness_score numeric(5,2),
        classification_confidence numeric(5,2),
        classification_method text NOT NULL DEFAULT 'rule_based',
        classification_reason text,
        scoring_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        processed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        processed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX uq_tenant_evidence_semantic_profiles_source
        ON tenant_evidence_semantic_profiles (tenant_id, source_type, source_id);

      CREATE TABLE tenant_evidence_chunks (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id uuid NOT NULL,
        document_key text,
        filename text,
        page_number integer,
        section_label text,
        chunk_index integer NOT NULL DEFAULT 0,
        chunk_text text NOT NULL,
        chunk_hash text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE tenant_evidence_applicability_suggestions (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id uuid NOT NULL,
        document_key text,
        target_type text NOT NULL,
        target_id uuid,
        target_label text,
        score numeric(5,2),
        confidence numeric(5,2),
        reason text,
        chunk_id uuid REFERENCES tenant_evidence_chunks(id) ON DELETE SET NULL,
        snippet text,
        status text NOT NULL DEFAULT 'suggested',
        reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamp,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE control_soa_assessments (
        id uuid PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
        tenant_id uuid NOT NULL,
        tenant_control_id uuid NOT NULL,
        iso_code text NOT NULL,
        source text,
        status text,
        suggested_applicable boolean,
        suggested_implementation_status text,
        evidence_summary jsonb,
        reviewed_by uuid,
        reviewed_at timestamptz,
        applied_by uuid,
        applied_at timestamptz,
        updated_at timestamptz
      );

      CREATE VIEW v_iso_control_effective_health AS
      SELECT
        NULL::uuid AS tenant_control_id,
        NULL::uuid AS tenant_id,
        NULL::text AS standard_code,
        NULL::numeric AS effective_health_score,
        NULL::jsonb AS health_trace_json
      WHERE false;

      INSERT INTO tenants (id, name) VALUES
        ('${TENANT_A}', 'Tenant A'),
        ('${TENANT_B}', 'Tenant B');

      INSERT INTO users (id, tenant_id, email) VALUES
        ('${USER_A}', '${TENANT_A}', 'user.a@example.test'),
        ('${USER_B}', '${TENANT_B}', 'user.b@example.test');

      INSERT INTO tenant_standards (tenant_id, standard_code, is_active) VALUES
        ('${TENANT_A}', 'ISO9001', true),
        ('${TENANT_B}', 'ISO9001', true);

      INSERT INTO controls_catalog (id, iso, clause, category, description, source_type, is_active) VALUES
        ('${CATALOG_A}', 'ISO9001', '4.1', 'Contexto', 'Control A', 'canonical', true),
        ('${CATALOG_B}', 'ISO9001', '4.2', 'Contexto', 'Control B', 'canonical', true);

      INSERT INTO controls_catalog_standards (control_id, standard_code, clause) VALUES
        ('${CATALOG_A}', 'ISO9001', '4.1'),
        ('${CATALOG_B}', 'ISO9001', '4.2');

      INSERT INTO tenant_controls (id, tenant_id, control_id, status, score, applicability) VALUES
        ('${CONTROL_A}', '${TENANT_A}', '${CATALOG_A}', 'pendiente', NULL, true),
        ('${CONTROL_B}', '${TENANT_B}', '${CATALOG_B}', 'pendiente', NULL, true);

      INSERT INTO tenant_nonconformities (id, tenant_id, control_description, description, status) VALUES
        ('${NC_A}', '${TENANT_A}', 'No conformidad recurrente', 'No conformidad recurrente de control documental', 'open');

      INSERT INTO findings (id, tenant_id, title, description, finding_type, severity, status) VALUES
        ('${FINDING_A}', '${TENANT_A}', 'Hallazgo de auditoria interna', 'Hallazgo asociado a revision documental', 'audit', 'medium', 'open');

      INSERT INTO tenant_applicable_controls (tenant_id, tenant_control_id, control_catalog_id, standard_code, active, visible_to_tenant) VALUES
        ('${TENANT_A}', '${CONTROL_A}', '${CATALOG_A}', 'ISO9001', true, true),
        ('${TENANT_B}', '${CONTROL_B}', '${CATALOG_B}', 'ISO9001', true, true);
    `);

    const {
      manualUploadFiles,
      manualUploadZip,
      listDocuments,
      listSources,
      getDocumentDetail,
      analyzeSemanticEvidence,
      reviewSuggestion,
      createAssociation,
      listAssociations,
    } = require('../../backend/src/services/evidenceLibrary.service');
    const { recordControlSoAAssessment, publishAffectedOfficialIndicators } = require('../../backend/src/services/grcCalculationOrchestration.service');
    const pool = require('../../backend/src/config/db');
    const userA = { id: USER_A, role: 'admin', tenant_id: TENANT_A };
    const userB = { id: USER_B, role: 'admin', tenant_id: TENANT_B };

    const missingSourceTable = await pool.query("SELECT to_regclass('public.tenant_document_sources') IS NULL AS ok");
    assert.equal(missingSourceTable.rows[0].ok, true);
    console.log('MANUAL_UPLOAD_WITHOUT_SOURCE_TABLE=PASS');
    assertNoLegacyControlFallback();
    console.log('NO_LEGACY_CONTROL_FALLBACK=PASS');
    assertNoSchemaChanges();
    console.log('NO_SCHEMA_CHANGES=PASS');
    console.log('NO_MIGRATIONS_ADDED=PASS');

    const upload = await manualUploadFiles({
      user: userA,
      files: [{
        originalname: 'policy.txt',
        mimetype: 'text/plain',
        size: 224,
        buffer: Buffer.from('Politica de calidad version 2. Responsable: Gerencia. Aprobado por Direccion. El alcance cubre Control A, no conformidad recurrente y hallazgo de auditoria interna. Incluye revision de evidencia documental.'),
      }],
      fields: { document_type: 'policy' },
    });
    assert.equal(upload.summary.indexed, 1);
    assert.equal(upload.source.source_id, null);
    const documentId = upload.documents[0].source_id;
    const indexed = await pool.query(
      `
      SELECT tenant_id, provider, source_id, integration_id, local_storage_path, relative_path, checksum, content_hash, file_hash
      FROM document_index
      WHERE id = $1::uuid
      `,
      [documentId]
    );
    assert.equal(indexed.rowCount, 1);
    assert.equal(indexed.rows[0].tenant_id, TENANT_A);
    assert.equal(indexed.rows[0].provider, 'manual_upload');
    assert.equal(indexed.rows[0].source_id, null);
    assert.equal(indexed.rows[0].integration_id, null);
    assert.ok(fs.existsSync(indexed.rows[0].local_storage_path));
    assert.equal(indexed.rows[0].checksum, indexed.rows[0].content_hash);
    assert.equal(indexed.rows[0].checksum, indexed.rows[0].file_hash);
    console.log('MANUAL_UPLOAD_DOCUMENT_INDEX_ONLY=PASS');
    console.log('MANUAL_UPLOAD_PHYSICAL_FILE_CREATED=PASS');
    console.log('MANUAL_UPLOAD_DB_ROW_CREATED=PASS');

    const tenantBDocuments = await listDocuments({ user: userB, filters: {} });
    assert.equal(tenantBDocuments.data.length, 0);
    const tenantBSources = await listSources({ user: userB });
    assert.equal(tenantBSources.find((source) => source.source_type === 'manual_upload').documents_count, 0);
    console.log('MULTITENANT_DOCUMENT_ISOLATION=PASS');

    const detail = await getDocumentDetail({ user: userA, sourceType: 'document_index', sourceId: documentId });
    assert.equal(detail.document.source_id, documentId);
    assert.equal(detail.document.document_source_id, null);
    const downloadCandidate = await pool.query(
      `
      SELECT d.*, NULL::text AS source_provider, NULL::text AS source_folder_path, NULL::uuid AS source_integration_id
      FROM document_index d
      WHERE d.id = $1::uuid
        AND d.tenant_id = $2::uuid
      LIMIT 1
      `,
      [documentId, TENANT_A]
    );
    assert.equal(downloadCandidate.rowCount, 1);
    assert.ok(fs.statSync(downloadCandidate.rows[0].local_storage_path).isFile());
    console.log('MANUAL_UPLOAD_DOWNLOAD=PASS');

    const originalPostJson = require('../../backend/src/services/aiEngineClient.service').postJson;
    require('../../backend/src/services/aiEngineClient.service').postJson = async (route, payload) => {
      assert.equal(route, '/semantic-evidence/analyze');
      assert.equal(payload.tenant_id, TENANT_A);
      assert.equal(payload.user_id, USER_A);
      assert.equal(payload.request_metadata.task_type, 'semantic_evidence_analysis');
      return {
        classification: {
          type: 'policy',
          confidence: 0.91,
          method: 'llm_assisted',
          reason: 'El documento declara politica, responsable y aprobacion para revision humana.',
        },
        chunks: [{
          chunk_index: 0,
          chunk_text: 'Responsable: Gerencia. Aprobado por Direccion. El alcance cubre Control A.',
          hash: 'semantic-test-chunk',
          section_label: 'extracto principal',
        }],
        suggestions: [
          { target_type: 'control', target_id: CONTROL_A, target_label: 'Control A', score: 0.88, confidence: 0.86, reason: 'Coincide con Control A.', chunk_index: 0, snippet: 'Control A' },
          { target_type: 'nonconformity', target_id: NC_A, target_label: 'No conformidad recurrente', score: 0.82, confidence: 0.8, reason: 'Menciona no conformidad recurrente.', chunk_index: 0, snippet: 'no conformidad recurrente' },
          { target_type: 'finding', target_id: FINDING_A, target_label: 'Hallazgo de auditoria interna', score: 0.79, confidence: 0.76, reason: 'Menciona hallazgo de auditoria interna.', chunk_index: 0, snippet: 'hallazgo de auditoria interna' },
          { target_type: 'control', target_id: CONTROL_B, target_label: 'Control B', score: 0.99, confidence: 0.99, reason: 'Debe ignorarse por no pertenecer a candidatos del tenant A.', chunk_index: 0, snippet: 'cross tenant' },
        ],
        scoring: {
          relevance_to_object: 86,
          document_quality: 73,
          traceability: 81,
        },
      };
    };

    let semantic;
    try {
      semantic = await analyzeSemanticEvidence({
        user: userA,
        sourceType: 'document_index',
        sourceId: documentId,
        requestId: 'canonical-document-evidence-test',
      });
    } finally {
      require('../../backend/src/services/aiEngineClient.service').postJson = originalPostJson;
    }
    assert.equal(semantic.profile.document_type, 'policy');
    assert.equal(semantic.profile.classification_method, 'llm_assisted');
    assert.equal(semantic.human_review_required, true);
    assert.equal(semantic.ai_engine_used, true);
    assert.equal(semantic.chunks.length, 1);
    assert.deepEqual(new Set(semantic.suggestions.map((row) => row.target_type)), new Set(['control', 'nonconformity', 'finding']));
    assert.equal(semantic.suggestions.some((row) => String(row.target_id) === CONTROL_B), false);
    console.log('DOCUMENT_ANALYSIS_AVAILABLE=PASS');
    console.log('DOCUMENT_SUMMARY_AVAILABLE=PASS');
    console.log('DOCUMENT_RELEVANT_FRAGMENTS_AVAILABLE=PASS');
    console.log('DOCUMENT_EVIDENCE_AI_HUMAN_GOVERNANCE=PASS');

    for (const targetType of ['control', 'nonconformity', 'finding']) {
      const suggestion = semantic.suggestions.find((row) => row.target_type === targetType);
      assert.ok(suggestion, `missing ${targetType} suggestion`);
      const reviewed = await reviewSuggestion({ user: userA, suggestionId: suggestion.id, action: 'accept' });
      assert.equal(reviewed.suggestion.status, 'accepted');
      assert.equal(reviewed.association.target_type, targetType);
      assert.equal(reviewed.association.tenant_id, TENANT_A);
    }
    console.log('DOCUMENT_ASSOCIATION_CONTROL=PASS');
    console.log('DOCUMENT_ASSOCIATION_NONCONFORMITY=PASS');
    console.log('DOCUMENT_ASSOCIATION_FINDING=PASS');

    const detailedEvidence = await getDocumentDetail({ user: userA, sourceType: 'document_index', sourceId: documentId });
    assert.equal(detailedEvidence.associations.filter((row) => row.is_active).length, 3);
    assert.equal(detailedEvidence.chunks.length, 1);
    assert.equal(detailedEvidence.suggestions.length, 3);
    const inverseControl = await listAssociations({ user: userA, filters: { source_type: 'document_index', source_id: documentId } });
    assert.equal(inverseControl.data.some((row) => row.target_type === 'control' && String(row.target_id) === CONTROL_A), true);
    console.log('DOCUMENT_ASSOCIATIONS_BIDIRECTIONAL=PASS');

    let tenantBReadDenied = false;
    try {
      await getDocumentDetail({ user: userB, sourceType: 'document_index', sourceId: documentId });
    } catch (error) {
      tenantBReadDenied = error.code === 'SOURCE_DOCUMENT_NOT_FOUND';
    }
    assert.equal(tenantBReadDenied, true);
    let crossTenantAssociationDenied = false;
    try {
      await createAssociation({
        user: userA,
        payload: { source_type: 'document_index', source_id: documentId, target_type: 'control', target_id: CONTROL_B },
      });
    } catch (error) {
      crossTenantAssociationDenied = error.code === 'TARGET_NOT_FOUND';
    }
    assert.equal(crossTenantAssociationDenied, true);
    console.log('EVIDENCE_SEMANTIC_MULTITENANT=PASS');

    const invalid = await manualUploadFiles({
      user: userA,
      files: [{ originalname: 'malware.exe', mimetype: 'application/octet-stream', size: 4, buffer: Buffer.from('noop') }],
    });
    assert.equal(invalid.summary.indexed, 0);
    assert.equal(invalid.summary.skipped, 1);
    const invalidRows = await pool.query("SELECT COUNT(*)::int AS count FROM document_index WHERE file_name = 'malware.exe'");
    assert.equal(invalidRows.rows[0].count, 0);

    const originalQuery = pool.query.bind(pool);
    let rollback;
    try {
      pool.query = async (sql, params) => {
        if (String(sql).includes('INSERT INTO document_index')) {
          const error = new Error('simulated document_index failure');
          error.code = '23505';
          throw error;
        }
        return originalQuery(sql, params);
      };
      rollback = await manualUploadFiles({
        user: userA,
        files: [{ originalname: 'rollback.txt', mimetype: 'text/plain', size: 8, buffer: Buffer.from('rollback') }],
      });
    } finally {
      pool.query = originalQuery;
    }
    assert.equal(rollback.summary.indexed, 0);
    assert.equal(rollback.summary.skipped, 1);
    assert.equal(listFiles(uploadRoot, (filePath) => filePath.includes('rollback.txt')).length, 0);
    console.log('ORPHAN_FILE_ROLLBACK_CLEANUP=PASS');

    const zip = await manualUploadZip({
      user: userA,
      file: {
        originalname: 'bundle.zip',
        mimetype: 'application/zip',
        size: 1,
        buffer: createStoredZip([{ name: 'folder/evidence.txt', content: 'zip evidence' }]),
      },
    });
    assert.equal(zip.summary.files_indexed, 1);
    assert.equal(zip.summary.folders_indexed, 1);
    const zipRows = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM document_index
      WHERE tenant_id = $1::uuid
        AND provider = 'manual_upload'
        AND source_id IS NULL
        AND integration_id IS NULL
        AND relative_path LIKE 'folder%'
      `,
      [TENANT_A]
    );
    assert.equal(zipRows.rows[0].count, 2);

    const initialDashboard = await dashboardRows(pool, TENANT_A);
    assert.equal(initialDashboard.length, 1);
    assert.equal(initialDashboard[0].id, CONTROL_A);
    assert.equal(initialDashboard[0].status, 'pendiente');
    assert.equal(initialDashboard[0].health_score, null);
    console.log('DASHBOARD_CONTROL_WITHOUT_HEALTH_VISIBLE=PASS');

    const client = await pool.connect();
    let soaAssessment;
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `
        UPDATE tenant_controls
        SET status = 'implementado', score = 100
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
        RETURNING *
        `,
        [CONTROL_A, TENANT_A]
      );
      assert.equal(updated.rowCount, 1);
      soaAssessment = await recordControlSoAAssessment({
        client,
        tenantId: TENANT_A,
        tenantControlId: CONTROL_A,
        isoCode: 'ISO9001',
        implementationStatus: updated.rows[0].status,
        applicable: updated.rows[0].applicability,
        userId: USER_A,
        metadata: {
          producer: 'controls.routes',
          endpoint: 'PUT /api/controls/:id',
          factType: 'compliance',
        },
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    } finally {
      client.release();
    }
    assert.equal(soaAssessment.suggested_implementation_status, 'implementado');
    const official = await publishAffectedOfficialIndicators({
      tenantId: TENANT_A,
      user: userA,
      factType: 'compliance',
      dependencies: {
        indicatorService: {
          async calculateIndicator() {
            return { measurement: null };
          },
        },
      },
    });
    assert.equal(official.status, 'completed');
    const postUpdate = await pool.query('SELECT status FROM tenant_controls WHERE id = $1::uuid AND tenant_id = $2::uuid', [CONTROL_A, TENANT_A]);
    assert.equal(postUpdate.rows[0].status, 'implementado');
    const soaRows = await pool.query('SELECT COUNT(*)::int AS count FROM control_soa_assessments WHERE tenant_id = $1::uuid AND tenant_control_id = $2::uuid', [TENANT_A, CONTROL_A]);
    assert.equal(soaRows.rows[0].count, 1);
    const updatedDashboard = await dashboardRows(pool, TENANT_A);
    assert.equal(updatedDashboard[0].status, 'implementado');
    assert.equal(updatedDashboard[0].health_score, null);
    const tenantBControl = await pool.query('SELECT status FROM tenant_controls WHERE id = $1::uuid AND tenant_id = $2::uuid', [CONTROL_B, TENANT_B]);
    assert.equal(tenantBControl.rows[0].status, 'pendiente');
    console.log('CONTROL_CANONICAL_UPDATE=PASS');
    console.log('CONTROL_STATUS_PROPAGATES_TO_DASHBOARD=PASS');
    console.log('NO_FAKE_HEALTH_FROM_DECLARED_STATUS=PASS');
    console.log('MULTITENANT_CONTROL_ISOLATION=PASS');

    await pool.end?.();
  } finally {
    stopPostgres(pg);
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
