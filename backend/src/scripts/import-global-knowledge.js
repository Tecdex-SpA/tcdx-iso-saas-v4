const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const fs = require('fs');
const pool = require('../config/db');

function normalizeStandardKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isDraftRecord(record = {}) {
  const raw = [
    record.norma,
    record.edicion_estado,
    record.status,
    record.embedding_text,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return raw.includes('draft') || raw.includes('borrador') || raw.includes('iso/dis');
}

function jsonb(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function buildSearchText(record) {
  return [
    record.norma,
    record.edicion_estado,
    record.coverage_type,
    record.clausula_o_control,
    record.titulo,
    record.descripcion_resumen,
    record.que_exige,
    ...(record.ejemplos_evidencia || []),
    ...(record.hallazgos_tipicos || []),
    ...(record.acciones_correctivas_sugeridas || []),
    ...(record.palabras_clave_tags || []),
    ...(record.related_norms || []),
    record.embedding_text,
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildFallbackRecordId(record, index) {
  const norma = normalizeStandardKey(record.norma || 'UNKNOWN');
  const clause = String(
    record.clausula_o_control ||
      record.titulo ||
      record.coverage_type ||
      `ROW_${index + 1}`
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:/.-]/g, '');

  return `${norma}__${clause || `row_${index + 1}`}`;
}

function dedupeRecordIds(records) {
  const used = new Map();
  const duplicates = [];

  const normalized = records.map((record, index) => {
    const originalRecordId = String(record.record_id || '').trim();
    const baseRecordId = originalRecordId || buildFallbackRecordId(record, index);

    const seen = used.get(baseRecordId) || 0;
    const nextCount = seen + 1;
    used.set(baseRecordId, nextCount);

    const finalRecordId =
      nextCount === 1 ? baseRecordId : `${baseRecordId}__dup${nextCount}`;

    if (nextCount > 1) {
      duplicates.push({
        original_record_id: baseRecordId,
        reassigned_record_id: finalRecordId,
        norma: record.norma || null,
        clausula_o_control: record.clausula_o_control || null,
        titulo: record.titulo || null,
      });
    }

    return {
      ...record,
      source_record_id: originalRecordId || baseRecordId,
      record_id: finalRecordId,
    };
  });

  return { normalized, duplicates };
}

async function main() {
  const inputPath =
    process.argv[2] ||
    '/home/tecdex/backend/data/knowledge/base_tecnica_iso_operable_llm_2026-04-20.json';

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el archivo: ${inputPath}`);
  }

  console.log('Usando configuración DB:', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
  });

  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);

  if (
    !data?.dataset_name ||
    !Array.isArray(data?.standards) ||
    !Array.isArray(data?.records_flat)
  ) {
    throw new Error('El JSON no tiene la estructura esperada.');
  }

  const { normalized: normalizedRecords, duplicates } = dedupeRecordIds(
    data.records_flat
  );

  if (duplicates.length > 0) {
    console.log(`Duplicados detectados en record_id: ${duplicates.length}`);
    console.log('Primeros duplicados corregidos automáticamente:');
    duplicates.slice(0, 10).forEach((dup) => {
      console.log(
        `- ${dup.original_record_id} -> ${dup.reassigned_record_id} (${dup.norma || '-'} / ${dup.clausula_o_control || '-'})`
      );
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const datasetInsert = await client.query(
      `
      INSERT INTO ai_knowledge_datasets (
        dataset_name,
        schema_version,
        generated_on,
        language,
        scope,
        source_file_name,
        metadata_json,
        is_active
      )
      VALUES ($1, $2, $3, $4, 'global', $5, $6::jsonb, true)
      ON CONFLICT (dataset_name, schema_version, generated_on, scope)
      DO UPDATE SET
        language = EXCLUDED.language,
        source_file_name = EXCLUDED.source_file_name,
        metadata_json = EXCLUDED.metadata_json,
        is_active = true,
        updated_at = now(),
        imported_at = now()
      RETURNING id
      `,
      [
        data.dataset_name,
        data.schema_version || null,
        data.generated_on || null,
        data.language || 'es',
        path.basename(inputPath),
        jsonb(
          {
            purpose: data.purpose || [],
            coverage_notes: data.coverage_notes || [],
            record_schema: data.record_schema || {},
            common_hls_annex_sl: data.common_hls_annex_sl || {},
            import_notes: {
              duplicate_record_ids_fixed: duplicates.length,
            },
          },
          {}
        ),
      ]
    );

    const datasetId = datasetInsert.rows[0].id;

    await client.query(`DELETE FROM ai_knowledge_records WHERE dataset_id = $1`, [datasetId]);
    await client.query(`DELETE FROM ai_knowledge_standards WHERE dataset_id = $1`, [datasetId]);

    for (const standard of data.standards) {
      await client.query(
        `
        INSERT INTO ai_knowledge_standards (
          dataset_id,
          norma,
          norma_key,
          edicion_estado,
          status,
          standard_type,
          uses_hls_annex_sl,
          certifiable_or_assurable,
          objective,
          principal_control_areas_json,
          related_standards_json,
          verified_public_crosswalks_json,
          notes_json,
          source_refs_json,
          scope_public_summary,
          key_definitions_json,
          structure_profile_json,
          record_count,
          raw_json
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,
          $15,$16::jsonb,$17::jsonb,$18,$19::jsonb
        )
        `,
        [
          datasetId,
          standard.norma,
          normalizeStandardKey(standard.norma),
          standard.edicion_estado || null,
          standard.status || null,
          standard.standard_type || null,
          standard.uses_hls_annex_sl === true,
          standard.certifiable_or_assurable ?? null,
          standard.objective || null,
          jsonb(standard.principal_control_areas, []),
          jsonb(standard.related_standards, []),
          jsonb(standard.verified_public_crosswalks, []),
          jsonb(standard.notes, []),
          jsonb(standard.source_refs, []),
          standard.scope_public_summary || null,
          jsonb(standard.key_definitions_paraphrased, []),
          jsonb(standard.structure_profile, {}),
          Number(standard.record_count || 0),
          jsonb(standard, {}),
        ]
      );
    }

    for (const record of normalizedRecords) {
      await client.query(
        `
        INSERT INTO ai_knowledge_records (
          dataset_id,
          record_id,
          norma,
          norma_key,
          edicion_estado,
          coverage_type,
          clausula_o_control,
          titulo,
          descripcion_resumen,
          que_exige,
          ejemplos_evidencia_json,
          hallazgos_tipicos_json,
          acciones_correctivas_sugeridas_json,
          palabras_clave_tags_json,
          related_norms_json,
          source_refs_json,
          standard_type,
          uses_hls_annex_sl,
          norma_objetivo,
          scope_public_summary,
          verified_public_crosswalks_json,
          embedding_text,
          search_text,
          is_draft,
          is_active,
          raw_json
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
          $17,$18,$19,$20,$21::jsonb,$22,$23,$24,true,$25::jsonb
        )
        `,
        [
          datasetId,
          record.record_id,
          record.norma,
          normalizeStandardKey(record.norma),
          record.edicion_estado || null,
          record.coverage_type || null,
          record.clausula_o_control || null,
          record.titulo || null,
          record.descripcion_resumen || null,
          record.que_exige || null,
          jsonb(record.ejemplos_evidencia, []),
          jsonb(record.hallazgos_tipicos, []),
          jsonb(record.acciones_correctivas_sugeridas, []),
          jsonb(record.palabras_clave_tags, []),
          jsonb(record.related_norms, []),
          jsonb(record.source_refs, []),
          record.standard_type || null,
          record.uses_hls_annex_sl === true,
          record.norma_objetivo || null,
          record.scope_public_summary || null,
          jsonb(record.verified_public_crosswalks, []),
          record.embedding_text || null,
          buildSearchText(record),
          isDraftRecord(record),
          jsonb(
            {
              ...record,
              _import_meta: {
                source_record_id: record.source_record_id || record.record_id,
              },
            },
            {}
          ),
        ]
      );
    }

    await client.query('COMMIT');

    console.log('OK dataset importado');
    console.log(`standards: ${data.standards.length}`);
    console.log(`records_flat originales: ${data.records_flat.length}`);
    console.log(`records_flat importados: ${normalizedRecords.length}`);
    console.log(`duplicados corregidos: ${duplicates.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERROR IMPORT GLOBAL KNOWLEDGE:', err);
    process.exit(1);
  });
