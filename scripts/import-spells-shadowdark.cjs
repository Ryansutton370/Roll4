// One-time conversion: .claude/Unofficial Shadowdark Spell List.xlsx
// ("Spells List" sheet) -> public/data/spells-shadowdark.json
//
// Source: the "Unofficial Shadowdark Spell List" by Michael Putlack (Night
// Noon Games) — the same compiler as the Unofficial Shadowdark Monster
// List (see scripts/import-monsters-shadowdark.cjs). Every row's Source
// column reads "CR" (Core Rulebook), i.e. this is the official Shadowdark
// spell list, not the compiler's own homebrew. Two licenses apply, same
// shape as the monster data, both surfaced in the app's Credits section
// (see spell-credits.html):
//   1. The spell text itself (official Shadowdark content, written by
//      Kelsey Dionne of The Arcane Library) is used under the Shadowdark
//      RPG Third-Party License.
//   2. This particular compilation/spreadsheet is CC BY-SA 4.0 licensed by
//      its author — ShareAlike means the JSON this script produces carries
//      that same license forward (see spells-shadowdark.LICENSE.txt).
//
// DO NOT RE-RUN this against the current spells-shadowdark.json without
// checking first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md), and re-running this would silently discard anything
// added/edited in it since (including any `homebrew: true` spell).
//
// Usage: node scripts/import-spells-shadowdark.cjs [path-to-xlsx] [path-to-output-json]

const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');

const inputPath =
  process.argv[2] ?? path.join(__dirname, '..', '.claude', 'Unofficial Shadowdark Spell List.xlsx');
const outputPath =
  process.argv[3] ?? path.join(__dirname, '..', 'public', 'data', 'spells-shadowdark.json');

const FIRST_DATA_ROW = 4;
const COL = {
  name: 2,
  tier: 3,
  type: 4,
  duration: 5,
  range: 6,
  description: 7,
  // Column 1 ("Source") is always "CR" (Core Rulebook) for every row in
  // this sheet — not worth carrying per-spell. Columns 8/9 are duplicate
  // Description columns (a merged-cell rendering artifact) and are ignored.
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Duration cells occasionally contain a literal newline (e.g. "1 hour
// \nreal time") from how the sheet wraps text — collapse to one space.
function cleanText(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDetails(row) {
  return [
    { label: 'Duration', value: cleanText(row[COL.duration]) },
    { label: 'Range', value: cleanText(row[COL.range]) },
  ];
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const sheet = workbook.getWorksheet('Spells List');

  const templates = [];
  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const name = excelRow.getCell(COL.name).value;
    if (!name) continue;

    const row = {};
    for (const col of Object.values(COL)) {
      row[col] = excelRow.getCell(col).value;
    }

    templates.push({
      id: `shadowdark-${slugify(String(name))}`,
      source: 'shadowdark',
      homebrew: false,
      name: String(name),
      level: Number(row[COL.tier]),
      school: null,
      classes: String(row[COL.type])
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      description: cleanText(row[COL.description]),
      details: buildDetails(row),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2) + '\n');
  console.log(
    `Wrote ${templates.length} Shadowdark spell templates to ${path.relative(process.cwd(), outputPath)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
