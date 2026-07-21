// One-time conversion: .claude/treasure-*.txt -> public/data/treasure.json
//
// Unlike Names/Monsters/Wild Magic, there's no single source document to
// parse — the GM pastes each category as plain text, saved verbatim into
// its own .claude/treasure-<category>.txt. This script just assembles
// whichever of those files currently exist into one JSON file (see
// src/app/models/treasure-table.model.ts); categories not yet provided are
// skipped rather than erroring, since the GM is delivering them
// incrementally.
//
// Each category's source file uses whichever plain-text shape the GM
// happened to paste it in — `format` below picks how it's parsed:
//   - 'lines': one entry per line (Trinkets). `detail` is always null.
//   - 'tab': one entry per line, "name\teffect" (Potions).
//   - 'blocks': entries separated by a blank line, each block's first line
//     the name and the rest (joined with spaces, in case a description
//     wraps across lines) the detail (Wondrous Items).
//
// DO NOT RE-RUN this against the current treasure.json without checking
// first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md and DATA_MODEL.md's TreasureTable section), and
// re-running this would silently discard anything added/edited in it
// since (this has already happened once — see DATA_MODEL.md for how it
// was recovered).
//
// Usage: node scripts/import-treasure.cjs [path-to-.claude-dir] [path-to-output-json]

const path = require('node:path');
const fs = require('node:fs');

const claudeDir = process.argv[2] ?? path.join(__dirname, '..', '.claude');
const outputPath = process.argv[3] ?? path.join(__dirname, '..', 'public', 'data', 'treasure.json');

const CATEGORIES = [
  { tableName: 'Trinkets', file: 'treasure-trinkets.txt', format: 'lines' },
  { tableName: 'Wondrous Items', file: 'treasure-wondrous-items.txt', format: 'blocks' },
  { tableName: 'Potions', file: 'treasure-potions.txt', format: 'tab' },
];

function slugify(...parts) {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** @returns {Array<{text: string, detail: string | null}>} */
function parseFile(content, format) {
  if (format === 'blocks') {
    return content
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const [name, ...rest] = block.split('\n');
        if (rest.length === 0) {
          throw new Error(`Expected a "Name\\nDescription" block, got only: "${name}"`);
        }
        return { text: name.trim(), detail: rest.join(' ').trim() };
      });
  }

  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (format === 'lines') {
    return lines.map((line) => ({ text: line, detail: null }));
  }

  // format === 'tab'
  return lines.map((line) => {
    const tabIndex = line.indexOf('\t');
    if (tabIndex === -1) {
      throw new Error(`Expected a tab-separated "name\\teffect" line, got: "${line}"`);
    }
    return { text: line.slice(0, tabIndex).trim(), detail: line.slice(tabIndex + 1).trim() };
  });
}

function main() {
  /** @type {Array<{id: string, setName: string, tableName: string, entries: Array<{text: string, detail: string | null}>}>} */
  const tables = [];
  const skipped = [];

  for (const { tableName, file, format } of CATEGORIES) {
    const filePath = path.join(claudeDir, file);
    if (!fs.existsSync(filePath)) {
      skipped.push(`${tableName} (${file} not found yet)`);
      continue;
    }
    const entries = parseFile(fs.readFileSync(filePath, 'utf8'), format);

    tables.push({
      id: slugify('treasure', tableName),
      setName: 'Treasure',
      tableName,
      entries,
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(tables, null, 2) + '\n');

  console.log(`Wrote ${outputPath}`);
  for (const table of tables) {
    console.log(`  ${table.setName} / ${table.tableName}: ${table.entries.length} entries`);
  }
  if (skipped.length > 0) {
    console.log('Skipped (not provided yet):');
    for (const s of skipped) console.log(`  ${s}`);
  }
}

main();
