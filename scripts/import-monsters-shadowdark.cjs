// One-time conversion: .claude/Shadowdark Monster Database.xlsx ("All"
// sheet) -> public/data/monsters-shadowdark.json
//
// Source: the "Unofficial Shadowdark Monster List" by Michael Putlack
// (Night Noon Games) — every row's Source column reads "CR" (Core
// Rulebook), i.e. this is the official Shadowdark monster list, not the
// compiler's own homebrew. Two licenses apply and both get surfaced in the
// app's Credits section (see name-generator.html):
//   1. The monster text itself (official Shadowdark content) is used
//      under the Shadowdark RPG Third-Party License.
//   2. This particular compilation/spreadsheet is CC BY-SA 4.0 licensed by
//      its author — ShareAlike means the JSON this script produces carries
//      that same license forward.
//
// DO NOT RE-RUN this against the current monsters-shadowdark.json without
// checking first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md), and re-running this would silently discard anything
// added/edited in it since (including any `homebrew: true` monster — see
// MonsterTemplate in DATA_MODEL.md).
//
// Usage: node scripts/import-monsters-shadowdark.cjs [path-to-xlsx] [path-to-output-json]

const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');

const inputPath =
  process.argv[2] ?? path.join(__dirname, '..', '.claude', 'Shadowdark Monster Database.xlsx');
const outputPath =
  process.argv[3] ?? path.join(__dirname, '..', 'public', 'data', 'monsters-shadowdark.json');

const HEADER_ROW = 4;
const FIRST_DATA_ROW = 5;
const COL = {
  name: 1,
  ac: 5,
  hp: 6,
  atk: 7,
  mv: 8,
  str: 9,
  dex: 10,
  con: 11,
  int: 12,
  wis: 13,
  cha: 14,
  alignment: 15,
  level: 16,
  talentsStart: 17,
  talentsEnd: 26,
};

const ALIGNMENT_NAMES = { L: 'Lawful', N: 'Neutral', C: 'Chaotic' };

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A cell holding a formula (every ability-score modifier column does)
// comes back as { formula, result } — except every ability modifier in
// this sheet is a literal "+0"/"-1"/etc. formula, not a real calculation,
// and a large fraction of them (184 of the ~1400 ability-score cells) have
// no cached `result` at all, so the formula text itself has to be the
// fallback. Cells covered by a *shared* formula (one formula authored once,
// applied to a range) instead carry { sharedFormula: '<master cell address>' }
// with neither `formula` nor `result` of their own — sheet is passed in so
// those can look up the master cell and recurse.
function numericCellValue(raw, sheet) {
  if (typeof raw === 'number') return raw;
  // A handful of cells (Oni, Ochre Jelly, Shambling Mound, ...) hold the
  // modifier as a plain string ("5", "-1") instead of a number or formula —
  // apparently typed in directly rather than via the "+0"-style formula
  // most rows use.
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.result === 'number') return raw.result;
    if (typeof raw.formula === 'string') {
      const parsed = Number(raw.formula);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (typeof raw.sharedFormula === 'string' && sheet) {
      return numericCellValue(sheet.getCell(raw.sharedFormula).value, sheet);
    }
  }
  return null;
}

// AC/HP are usually plain numbers but sometimes a string like "18 (+3
// plate mail)" (armor called out) or "*" (the four Elementals/Hydra, whose
// stats scale with context rather than being fixed — see MonsterTemplate's
// difficulty field comment).
function leadingInt(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const match = /^(\d+)/.exec(raw.trim());
    if (match) return Number(match[1]);
  }
  return null;
}

function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Talents are one free-text cell per talent, formatted as either "Name:
// description" or "Name. description" (both appear throughout the source
// spreadsheet) — split on whichever delimiter comes first.
function splitTalent(text) {
  const match = /^([^.:]+)[.:]\s*(.*)$/s.exec(text.trim());
  if (!match) return { name: text.trim(), desc: '' };
  return { name: match[1].trim(), desc: match[2].trim() };
}

function buildStatBlock(row, sheet) {
  const entries = [];
  const alignment = row[COL.alignment];
  if (alignment)
    entries.push({ label: 'Alignment', value: ALIGNMENT_NAMES[alignment] ?? alignment });
  if (row[COL.atk]) entries.push({ label: 'Attack', value: String(row[COL.atk]) });
  if (row[COL.mv]) entries.push({ label: 'Move', value: String(row[COL.mv]) });

  const abilities = [
    ['S', COL.str],
    ['D', COL.dex],
    ['C', COL.con],
    ['I', COL.int],
    ['W', COL.wis],
    ['Ch', COL.cha],
  ]
    .map(([short, col]) => [short, numericCellValue(row[col], sheet)])
    .filter(([, mod]) => mod !== null);
  if (abilities.length > 0) {
    entries.push({
      label: 'Ability Scores',
      value: abilities.map(([short, mod]) => `${short} ${formatModifier(mod)}`).join(', '),
    });
  }

  for (let col = COL.talentsStart; col <= COL.talentsEnd; col++) {
    const raw = row[col];
    if (!raw) continue;
    const { name, desc } = splitTalent(String(raw));
    entries.push({ label: name, value: desc });
  }

  return entries;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const sheet = workbook.getWorksheet('All');

  const templates = [];
  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const name = excelRow.getCell(COL.name).value;
    if (!name) continue;

    const row = {};
    for (const col of Object.values(COL)) {
      if (typeof col === 'number') row[col] = excelRow.getCell(col).value;
    }

    const level = numericCellValue(row[COL.level], sheet);

    templates.push({
      id: `shadowdark-${slugify(String(name))}`,
      source: 'shadowdark',
      name: String(name),
      difficulty: level,
      ac: leadingInt(row[COL.ac]),
      maxHp: leadingInt(row[COL.hp]),
      initiativeModifier: numericCellValue(row[COL.dex], sheet) ?? 0,
      statBlock: buildStatBlock(row, sheet),
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2) + '\n');
  console.log(
    `Wrote ${templates.length} Shadowdark monster templates to ${path.relative(process.cwd(), outputPath)}`,
  );
  const noLevel = templates.filter((t) => t.difficulty === null).map((t) => t.name);
  if (noLevel.length > 0) {
    console.log(`\nNo fixed level (stats scale with context): ${noLevel.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
