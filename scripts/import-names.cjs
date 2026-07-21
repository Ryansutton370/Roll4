// One-time conversion: .claude/Names.xlsx -> public/data/name-tables.json
//
// Parses every worksheet tab into NameTable entries (see
// src/app/models/name-table.model.ts). Deliberately mechanical (row/column
// reads only, no re-typing of any name by hand) so a 100-entry column can't
// pick up a transcription error.
//
// DO NOT RE-RUN this against the current name-tables.json without checking
// first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md), and re-running this would silently discard anything
// added/edited in it since this script last ran (including the "Places"
// tables, added straight to the JSON, that this script never produced).
//
// Usage: node scripts/import-names.cjs [path-to-xlsx] [path-to-output-json]

const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');

const inputPath = process.argv[2] ?? path.join(__dirname, '..', '.claude', 'Names.xlsx');
const outputPath =
  process.argv[3] ?? path.join(__dirname, '..', 'public', 'data', 'name-tables.json');

const GENDER_SUFFIX = /\s*\((M|F)\)\s*$/i;

function slugify(...parts) {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseHeader(header) {
  const match = GENDER_SUFFIX.exec(header);
  if (!match) {
    return { tableName: header.trim(), gender: null };
  }
  const gender = match[1].toUpperCase() === 'M' ? 'male' : 'female';
  return { tableName: header.slice(0, match.index).trim(), gender };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  /** @type {Array<{id: string, setName: string, tableName: string, gender: 'male' | 'female' | null, entries: string[]}>} */
  const tables = [];
  const skipped = [];

  for (const sheet of workbook.worksheets) {
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = typeof cell.value === 'string' ? cell.value : null;
    });

    // Column 1 is the "d100" row-index column; find how many data rows
    // actually have a roll number rather than trusting sheet.rowCount
    // (worksheets can report many more rows than are actually filled in).
    let lastDataRow = 1;
    for (let r = 2; r <= sheet.rowCount; r++) {
      if (typeof sheet.getRow(r).getCell(1).value === 'number') {
        lastDataRow = r;
      } else {
        break;
      }
    }

    for (let col = 2; col < headers.length; col++) {
      const header = headers[col];
      if (!header) continue;

      const entries = [];
      for (let r = 2; r <= lastDataRow; r++) {
        const value = sheet.getRow(r).getCell(col).value;
        if (typeof value === 'string' && value.trim() !== '') {
          entries.push(value.trim());
        }
      }

      if (entries.length === 0) {
        skipped.push(`${sheet.name} / ${header} (0 entries)`);
        continue;
      }

      const { tableName, gender } = parseHeader(header);
      tables.push({
        id: slugify(sheet.name, tableName, gender ?? ''),
        setName: sheet.name,
        tableName,
        gender,
        entries,
      });

      if (entries.length < 100) {
        skipped.push(`${sheet.name} / ${header} (only ${entries.length} entries, imported as-is)`);
      }
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(tables, null, 2) + '\n');

  console.log(`Wrote ${tables.length} name tables to ${path.relative(process.cwd(), outputPath)}`);
  if (skipped.length > 0) {
    console.log('\nFlagged during import:');
    for (const line of skipped) console.log(`  - ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
