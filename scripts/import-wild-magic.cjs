// One-time conversion: .claude/NLRMEv2.pdf -> public/data/wild-magic.json
//
// Source: "The Net Libram of Random Magical Effects" v2.00 by Orrex — a
// free, non-OGL fan document listing 10,000 numbered "Chaos Burst" magic
// mishap effects (a d10000 table: 0001-9999, then 0000 standing in for the
// 10,000th result), plus a bonus d100 table of conditions that can end a
// Burst with no stated duration. See the Credits section on the Wild Magic
// generator page for the attribution this requires.
//
// The PDF renders as two side-by-side columns per page, but pdftotext's
// default (non "-layout") mode already emits the text in one flowing,
// strictly-ascending-by-entry-number stream — column order turns out to
// match reading/entry order, so no column-boundary splitting is needed.
// Page-footer numbers (a bare "76", "77", ... on their own line) are the
// only noise mixed into that stream; they're stripped by line before
// tokenizing rather than relying on the entry-number matching to skip them,
// since a stray page number would otherwise glue onto the end of whichever
// entry happened to finish right before the page break.
//
// Requires the `pdftotext` binary (poppler-utils) on PATH — a one-time-script
// dependency, same spirit as import-names.cjs's exceljs devDependency.
//
// DO NOT RE-RUN this against the current wild-magic.json without checking
// first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md), and re-running this would silently discard anything
// added/edited in it since.
//
// Usage: node scripts/import-wild-magic.cjs [path-to-pdf] [path-to-output-json]

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const inputPath = process.argv[2] ?? path.join(__dirname, '..', '.claude', 'NLRMEv2.pdf');
const outputPath =
  process.argv[3] ?? path.join(__dirname, '..', 'public', 'data', 'wild-magic.json');

/**
 * Pulls one sequentially-numbered table (e.g. "0001".."9999" then "0000",
 * or "01".."99" then "00") out of a token stream. `formatId(n)` produces
 * the exact zero-padded label to look for at each step, so an entry is only
 * ever recognized by matching the *expected next* id — not just "looks like
 * a number" — which is what makes this immune to ordinary numbers
 * (dice sizes, gold piece amounts, etc.) inside the entry text itself.
 *
 * `afterTableToken` is the literal token immediately following the table's
 * very last entry (there's no "expected next id" to bound that one by, so
 * without this its while loop would run off the end and swallow whatever
 * comes next in the document); omit it to just run to the end of `tokens`.
 */
function extractSequentialTable(tokens, startIndex, count, formatId, afterTableToken) {
  let i = startIndex;
  const entries = [];
  for (let n = 0; n < count; n++) {
    const expectedId = formatId(n);
    if (tokens[i] !== expectedId) {
      throw new Error(
        `Expected id "${expectedId}" (entry ${n + 1}/${count}) at token ${i}, found "${tokens[i]}"`,
      );
    }
    i++;
    const isLastEntry = n === count - 1;
    const stopToken = isLastEntry ? afterTableToken : formatId(n + 1);
    const words = [];
    while (i < tokens.length && tokens[i] !== stopToken) {
      words.push(tokens[i]);
      i++;
    }
    entries.push(words.join(' ').trim());
  }
  return { entries, nextIndex: i };
}

/**
 * The source PDF's font encodes a handful of glyphs pdftotext can't map,
 * which come through as the Unicode replacement character. Every instance
 * immediately after a digit is a degree symbol (e.g. "360�" -> "360°",
 * "70� Fahrenheit"); the source has exactly two other instances, both
 * accented letters in ordinary words ("risqu�" -> "risqué", "d�j� vu" ->
 * "déjà vu") rather than anything numeric — confirmed by checking every
 * occurrence in the extracted text by hand, not inferred from a pattern.
 */
function fixEncodingArtifacts(text) {
  return text.replace(/(\d)�/g, '$1°').replace('risqu�', 'risqué').replace('d�j� vu', 'déjà vu');
}

function main() {
  const rawText = execFileSync('pdftotext', [inputPath, '-'], {
    maxBuffer: 1024 * 1024 * 16,
  }).toString('utf8');

  // Page-footer numbers sit alone on their own line between blank lines —
  // strip any such line before tokenizing so they can't glue onto an entry.
  const cleaned = rawText
    .split('\n')
    .filter((line) => !/^\s*\d{1,3}\s*$/.test(line))
    .join('\n');

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const chaosBurstStart = tokens.indexOf('0001', tokens.indexOf('10,000'));
  if (chaosBurstStart === -1) {
    throw new Error('Could not find the start of the Chaos Burst table ("0001 ...")');
  }
  const chaosBurst = extractSequentialTable(
    tokens,
    chaosBurstStart,
    10000,
    (n) => (n === 9999 ? '0000' : String(n + 1).padStart(4, '0')),
    'Sample', // first word of "Sample conditions governing the duration..."
  );

  const durationStart = tokens.indexOf('01', chaosBurst.nextIndex);
  if (durationStart === -1) {
    throw new Error('Could not find the start of the Duration Condition table ("01 ...")');
  }
  const duration = extractSequentialTable(tokens, durationStart, 100, (n) =>
    n === 99 ? '00' : String(n + 1).padStart(2, '0'),
  );

  /** @type {Array<{id: string, setName: string, tableName: string, description: string, entries: string[]}>} */
  const tables = [
    {
      id: 'wild-magic-chaos-burst',
      setName: 'Wild Magic',
      tableName: 'Chaos Burst',
      description:
        'Wild magic mishap effects. Roll on this table whenever a spellcaster triggers a Chaos Burst — an eruption of magical chaos from poorly controlled spellcasting.',
      entries: chaosBurst.entries.map(fixEncodingArtifacts),
    },
    {
      id: 'wild-magic-duration-condition',
      setName: 'Wild Magic',
      tableName: 'Burst Duration Condition',
      description:
        'For a Chaos Burst with no stated duration: possible conditions that must be met before the effect is dispelled on its own.',
      entries: duration.entries.map(fixEncodingArtifacts),
    },
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(tables, null, 2) + '\n');

  console.log(`Wrote ${outputPath}`);
  for (const table of tables) {
    console.log(`  ${table.setName} / ${table.tableName}: ${table.entries.length} entries`);
  }
}

main();
