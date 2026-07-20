// One-time conversion: Open5e's API (https://api.open5e.com) -> public/data/monsters-5e-srd.json
//
// Open5e serves the D&D 5e System Reference Document 5.1 under the Open
// Game License — see the required Section 15 notice this script embeds
// into every MonsterTemplate's own attribution, and the same text surfaced
// in the app's Credits section (see name-generator.html).
//
// Usage: node scripts/import-monsters-5e-srd.cjs [output-path]

const path = require('node:path');
const fs = require('node:fs');

const outputPath =
  process.argv[2] ?? path.join(__dirname, '..', 'public', 'data', 'monsters-5e-srd.json');

const API_BASE = 'https://api.open5e.com/v1/monsters/';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatSpeed(speed) {
  return Object.entries(speed ?? {})
    .map(([type, value]) => (type === 'walk' ? `${value} ft.` : `${type} ${value} ft.`))
    .join(', ');
}

const ABILITIES = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
];

function buildStatBlock(m) {
  const entries = [];

  entries.push({ label: 'Type', value: [m.size, m.type, m.subtype].filter(Boolean).join(', ') });
  entries.push({ label: 'Alignment', value: m.alignment || 'unaligned' });
  entries.push({
    label: 'Armor Class',
    value: m.armor_desc ? `${m.armor_class} (${m.armor_desc})` : `${m.armor_class}`,
  });
  entries.push({
    label: 'Hit Points',
    value: m.hit_dice ? `${m.hit_points} (${m.hit_dice})` : `${m.hit_points}`,
  });
  if (formatSpeed(m.speed)) entries.push({ label: 'Speed', value: formatSpeed(m.speed) });

  entries.push({
    label: 'Ability Scores',
    value: ABILITIES.map(
      ([key, short]) => `${short} ${m[key]} (${formatModifier(abilityModifier(m[key]))})`,
    ).join(', '),
  });

  const saves = ABILITIES.filter(([key]) => m[`${key}_save`] != null).map(
    ([key, short]) => `${short} ${formatModifier(m[`${key}_save`])}`,
  );
  if (saves.length > 0) entries.push({ label: 'Saving Throws', value: saves.join(', ') });

  const skillEntries = Object.entries(m.skills ?? {});
  if (skillEntries.length > 0) {
    entries.push({
      label: 'Skills',
      value: skillEntries
        .map(
          ([skill, bonus]) => `${skill[0].toUpperCase()}${skill.slice(1)} ${formatModifier(bonus)}`,
        )
        .join(', '),
    });
  }

  for (const [label, field] of [
    ['Damage Vulnerabilities', 'damage_vulnerabilities'],
    ['Damage Resistances', 'damage_resistances'],
    ['Damage Immunities', 'damage_immunities'],
    ['Condition Immunities', 'condition_immunities'],
  ]) {
    if (m[field]) entries.push({ label, value: m[field] });
  }

  if (m.senses) entries.push({ label: 'Senses', value: m.senses });
  if (m.languages) entries.push({ label: 'Languages', value: m.languages });
  entries.push({ label: 'Challenge Rating', value: m.challenge_rating ?? '' });

  for (const trait of m.special_abilities ?? []) {
    entries.push({ label: trait.name, value: trait.desc });
  }
  for (const action of m.actions ?? []) {
    entries.push({ label: `Action: ${action.name}`, value: action.desc });
  }
  for (const action of m.bonus_actions ?? []) {
    entries.push({ label: `Bonus Action: ${action.name}`, value: action.desc });
  }
  for (const reaction of m.reactions ?? []) {
    entries.push({ label: `Reaction: ${reaction.name}`, value: reaction.desc });
  }
  if (m.legendary_desc) entries.push({ label: 'Legendary Actions', value: m.legendary_desc });
  for (const action of m.legendary_actions ?? []) {
    entries.push({ label: `Legendary Action: ${action.name}`, value: action.desc });
  }

  return entries;
}

async function fetchAllMonsters() {
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
  const monsters = await fetchAllMonsters();

  const templates = monsters.map((m) => ({
    id: `5e-srd-${m.slug ?? slugify(m.name)}`,
    source: '5e-srd',
    name: m.name,
    difficulty: typeof m.cr === 'number' ? m.cr : null,
    ac: typeof m.armor_class === 'number' ? m.armor_class : null,
    maxHp: typeof m.hit_points === 'number' ? m.hit_points : null,
    initiativeModifier: abilityModifier(m.dexterity),
    statBlock: buildStatBlock(m),
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(templates, null, 2) + '\n');
  console.log(
    `Wrote ${templates.length} 5e SRD monster templates to ${path.relative(process.cwd(), outputPath)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
