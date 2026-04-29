require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const db = require('../config/db');

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Uso: node src/scripts/import-kpi-staging.js /ruta/KPI_ISO_ADVANCED.xlsx');
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  if (!rows.length) {
    console.log('El Excel no tiene filas para importar.');
    process.exit(0);
  }

  const batchId = crypto.randomUUID();
  const sourceFileName = path.basename(filePath);

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      await client.query(
        `
        INSERT INTO kpi_staging_import (
          batch_id,
          source_file_name,
          row_number,
          norma,
          kpi,
          descripcion,
          formula,
          tipo,
          frecuencia,
          unidad,
          fuente_datos,
          relacionado_con,
          umbral_verde,
          umbral_amarillo,
          umbral_rojo,
          raw_json
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        )
        `,
        [
          batchId,
          sourceFileName,
          i + 2,
          row['Norma'] || '',
          row['KPI'] || '',
          row['Descripción'] || '',
          row['Fórmula'] || '',
          row['Tipo'] || '',
          row['Frecuencia'] || '',
          row['Unidad'] || '',
          row['Fuente Datos'] || '',
          row['Relacionado con'] || '',
          row['Umbral Verde'] || '',
          row['Umbral Amarillo'] || '',
          row['Umbral Rojo'] || '',
          JSON.stringify(row)
        ]
      );
    }

    await client.query('COMMIT');

    console.log(`Importación staging OK`);
    console.log(`Batch ID: ${batchId}`);
    console.log(`Filas importadas: ${rows.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importando staging:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
