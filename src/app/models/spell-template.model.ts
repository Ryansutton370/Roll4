export type SpellSource = '5e-srd' | 'shadowdark';

/**
 * One labeled fact about a spell that doesn't need to be sorted/grouped/
 * filtered on and doesn't line up cleanly between the two source systems —
 * 5e has Casting Time/Components/Concentration/Ritual/a rulebook page
 * reference, Shadowdark just has Duration/Range. Same "loose label/value
 * list" approach as MonsterTemplate.statBlock, for the same reason: a
 * rigid shared schema would mean a lot of always-empty fields on one
 * source or the other. The spell detail dialog renders these in order.
 */
export interface SpellDetailEntry {
  label: string;
  value: string;
}

/**
 * Loaded read-only via SpellStore from public/data/spells-5e-srd.json /
 * spells-shadowdark.json — see DATA_MODEL.md's SpellTemplate section.
 */
export interface SpellTemplate {
  id: string;
  source: SpellSource;
  /** `true` for a GM-added spell, as opposed to one from the licensed import — same meaning as MonsterTemplate.homebrew. */
  homebrew: boolean;
  name: string;
  /** 0 = Cantrip (5e only). Shadowdark's Tier is 1-5, never 0. */
  level: number;
  /** 5e school (Evocation, ...). `null` for Shadowdark — that system has no school concept. */
  school: string | null;
  /** e.g. ['Sorcerer', 'Wizard'] or ['Priest'] or ['Priest', 'Wizard'] — a spell can belong to more than one class's list. */
  classes: string[];
  description: string;
  details: SpellDetailEntry[];
}

/**
 * "Cantrip" / "Level 3" for 5e; a plain "2" for Shadowdark — the one place
 * this label is built, same precedent as monsterDifficultyLabel in
 * monster-template.model.ts. Deliberately no "Tier" word prefix: Shadowdark
 * only ever has 5 tiers (unlike 5e's 0-9), so the bare number reads fine on
 * its own in the Level column/group headers, and sorts/scans as a plain
 * number instead of text a GM has to parse past.
 */
export function spellLevelLabel(template: SpellTemplate): string {
  if (template.source === '5e-srd') {
    return template.level === 0 ? 'Cantrip' : `Level ${template.level}`;
  }
  return `${template.level}`;
}
