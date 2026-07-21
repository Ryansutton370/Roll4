import { MonsterTemplate } from '../models/monster-template.model';

/**
 * One monster template plus how many of it the generator picked — the
 * Encounter Generator's candidate list is an array of these, not one entry
 * per individual monster, so "3 Goblins" is a single row the GM can bump
 * up/down rather than three separate rows.
 */
export interface GeneratedMonsterEntry {
  template: MonsterTemplate;
  count: number;
}

export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

// ---------------------------------------------------------------------
// 5e SRD — the actual D&D 5e DMG encounter-building math (Basic Rules,
// "Building Combat Encounters" + "Monsters" chapters, cross-checked
// directly against two independent D&D Beyond pages while building this).
// Fixed game-rules data, not GM-editable, so it's a constant here rather
// than seed data like MonsterTemplate.
// ---------------------------------------------------------------------

/** XP Thresholds by Character Level, DMG p.82 — one row per PC level, 1-20. */
const XP_THRESHOLDS_BY_LEVEL: Record<number, Record<EncounterDifficulty, number>> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

/** Experience Points by Challenge Rating, DMG p.275 — CR 0 uses 10 XP (the value for a CR 0 monster with at least one notable trait; there's no way to distinguish those from a true 0-XP CR 0 monster in the imported data). */
const CR_TO_XP: Record<string, number> = {
  '0': 10,
  '0.125': 25,
  '0.25': 50,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

function xpForCr(cr: number): number {
  return CR_TO_XP[String(cr)] ?? 0;
}

/** DMG p.82 — a group of monsters is tougher than the sum of their individual XP suggests; this multiplier is applied to the raw total before comparing it to the party's budget. */
export function encounterMultiplier(monsterCount: number): number {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

/** The party's total XP budget for one difficulty tier — DMG's method sums each individual character's threshold; for a same-level party that's just the per-level threshold times party size. */
export function xpBudget(
  partyLevel: number,
  partySize: number,
  difficulty: EncounterDifficulty,
): number {
  const level = Math.min(Math.max(partyLevel, 1), 20);
  return XP_THRESHOLDS_BY_LEVEL[level][difficulty] * partySize;
}

function totalRawXp(entries: GeneratedMonsterEntry[]): number {
  return entries.reduce((sum, e) => sum + xpForCr(e.template.difficulty ?? 0) * e.count, 0);
}

function totalMonsterCount(entries: GeneratedMonsterEntry[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

/** The DMG-defined "does this encounter actually hit the target difficulty" number — raw monster XP total, scaled by the group-size multiplier. */
export function adjustedXp(entries: GeneratedMonsterEntry[]): number {
  return totalRawXp(entries) * encounterMultiplier(totalMonsterCount(entries));
}

/**
 * Randomly assembles a candidate monster list whose adjustedXp lands at or
 * near (never more than ~10% over) the party's budget for the chosen
 * difficulty — a stochastic bin-packing pass, not an exhaustive search:
 * repeatedly picks a random template from the pool (filtered to CR <= the
 * budget itself, so a single pick can never blow the budget on its own)
 * and adds one copy, stopping once the budget's reached or a sane monster
 * count cap (15, matching the top of the DMG's own multiplier table) is
 * hit. Pool monsters with a `null` difficulty are excluded — there's no
 * fixed XP value to weigh them against a budget.
 */
export function generate5eEncounter(params: {
  partyLevel: number;
  partySize: number;
  difficulty: EncounterDifficulty;
  pool: MonsterTemplate[];
}): GeneratedMonsterEntry[] {
  const budget = xpBudget(params.partyLevel, params.partySize, params.difficulty);
  const candidates = params.pool.filter(
    (m) => m.difficulty !== null && xpForCr(m.difficulty) <= budget,
  );
  if (candidates.length === 0) return [];

  const entries: GeneratedMonsterEntry[] = [];
  const MAX_MONSTERS = 15;

  while (totalMonsterCount(entries) < MAX_MONSTERS) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const existing = entries.find((e) => e.template.id === pick.id);
    const nextEntries = existing
      ? entries.map((e) => (e.template.id === pick.id ? { ...e, count: e.count + 1 } : e))
      : [...entries, { template: pick, count: 1 }];

    // Accept the pick if it doesn't overshoot the budget by more than 10%,
    // or if the list is still empty (always take at least one monster
    // rather than returning nothing because the very first roll was
    // already close to the whole budget).
    if (entries.length === 0 || adjustedXp(nextEntries) <= budget * 1.1) {
      entries.length = 0;
      entries.push(...nextEntries);
      if (adjustedXp(entries) >= budget) break;
    } else {
      break;
    }
  }

  return entries;
}

// ---------------------------------------------------------------------
// Shadowdark — there is no DMG-style XP-budget system in Shadowdark's own
// rules (confirmed while researching this milestone: the Core Rulebook's
// stance is explicitly to let the world/dice decide an encounter rather
// than balance it mathematically). Building a fake "difficulty" score for
// it would misrepresent the game, so this is a level-range random draw
// instead — the GM picks a Level band and a monster count, and this fills
// it in, same spirit as an official Shadowdark random-encounter table.
// ---------------------------------------------------------------------

export function generateShadowdarkEncounter(params: {
  minLevel: number;
  maxLevel: number;
  monsterCount: number;
  pool: MonsterTemplate[];
}): GeneratedMonsterEntry[] {
  const candidates = params.pool.filter(
    (m) =>
      m.difficulty !== null && m.difficulty >= params.minLevel && m.difficulty <= params.maxLevel,
  );
  if (candidates.length === 0) return [];

  const entries: GeneratedMonsterEntry[] = [];
  for (let i = 0; i < params.monsterCount; i++) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const existing = entries.find((e) => e.template.id === pick.id);
    if (existing) {
      existing.count++;
    } else {
      entries.push({ template: pick, count: 1 });
    }
  }
  return entries;
}
