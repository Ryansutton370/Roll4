// One-time conversion: Open5e's API (https://api.open5e.com) -> public/data/spells-5e-srd.json
//
// Open5e serves the D&D 5e System Reference Document 5.1 under the Open
// Game License — see the required Section 15 notice this script embeds
// into the app's Credits section (see spell-credits.html), same source as
// scripts/import-monsters-5e-srd.cjs.
//
// DO NOT RE-RUN this against the current spells-5e-srd.json without
// checking first — that file is now the GM-editable source directly (see
// ARCHITECTURE.md), and re-running this would silently discard anything
// added/edited in it since (including any `homebrew: true` spell), on top
// of re-fetching a live API whose contents aren't guaranteed to match what
// was originally imported.
//
// Usage: node scripts/import-spells-5e-srd.cjs [output-path]

const path = require('node:path');
const fs = require('node:fs');

const outputPath =
  process.argv[2] ?? path.join(__dirname, '..', 'public', 'data', 'spells-5e-srd.json');

const API_BASE = 'https://api.open5e.com/v1/spells/';

function buildDetails(s) {
  const details = [];

  details.push({ label: 'Casting Time', value: s.casting_time ?? '' });
  details.push({ label: 'Range', value: s.range ?? '' });

  const components = s.requires_material_components
    ? `${s.components} (${s.material})`
    : s.components;
  details.push({ label: 'Components', value: components ?? '' });

  const duration = s.requires_concentration ? `Concentration, ${s.duration}` : s.duration;
  details.push({ label: 'Duration', value: duration ?? '' });

  if (s.can_be_cast_as_ritual) details.push({ label: 'Ritual', value: 'Yes' });
  if (s.higher_level) details.push({ label: 'At Higher Levels', value: s.higher_level });
  if (s.page) details.push({ label: 'Source', value: s.page });

  return details;
}

async function fetchAllSpells() {
  const results = [];
  let url = `${API_BASE}?document__slug=wotc-srd&limit=100`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open5e request failed: ${res.status} ${url}`);
    const page = await res.json();
    results.push(...page.results);
    url = page.next;
  }
  return results;
}

async function main() {
  const spells = await fetchAllSpells();

  const templates = spells.map((s) => ({
    id: `5e-srd-${s.slug}`,
    source: '5e-srd',
    homebrew: false,
    name: s.name,
    level: s.level_int,
    school: s.school,
    // dnd_class (not spell_lists) — spell_lists omits Paladin entirely on
    // some spells (e.g. Branding Smite, Find Steed only have dnd_class:
    // "Paladin"), while dnd_class also carries "Ritual Caster" for a
    // couple of feat-granted spells. Left as-is; that's what the source
    // data says.
    classes: s.dnd_class
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    description: s.desc,
    details: buildDetails(s),
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2) + '\n');
  console.log(
    `Wrote ${templates.length} 5e SRD spell templates to ${path.relative(process.cwd(), outputPath)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
