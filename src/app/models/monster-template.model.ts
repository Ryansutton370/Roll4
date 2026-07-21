export type MonsterSource = '5e-srd' | 'shadowdark';

/**
 * One labeled section of a monster's stat block (Speed, Saving Throws, a
 * named trait/action, ...). Deliberately a flat, loose list rather than a
 * rigid per-field schema — 5e and Shadowdark stat blocks don't share a
 * section layout (ability scores vs. flat bonuses, saves/skills vs. none,
 * numbered actions vs. numbered "Talents"), so forcing one shape onto both
 * would mean a lot of always-empty fields on one source or the other. The
 * stat-block modal (Milestone 4) just renders these label/value pairs in
 * order.
 */
export interface MonsterStatBlockEntry {
  label: string;
  value: string;
}

/**
 * Loaded read-only via MonsterStore from public/data/monsters-5e-srd.json /
 * monsters-shadowdark.json — GM-editable directly (see DATA_MODEL.md's
 * MonsterTemplate section for the policy and the one caveat specific to
 * this data: the OGL/CC BY-SA Credits notices only cover `homebrew: false`
 * entries).
 */
export interface MonsterTemplate {
  id: string;
  source: MonsterSource;
  /**
   * `true` for a GM-added monster, as opposed to one from the licensed
   * 5e SRD/Shadowdark import. Still uses `source` to say which system's
   * difficulty/stat-block conventions it follows (CR vs. Level, ability
   * scores vs. flat bonuses) — this is a provenance/attribution flag, not
   * a third value alongside 5e-srd/shadowdark, so every other branch in
   * the app that reads `source` (Encounter Generator, stat-block dialog)
   * needs no change to already handle a homebrew entry correctly.
   */
  homebrew: boolean;
  name: string;
  /**
   * CR for '5e-srd' (e.g. 0.25, 10), Level for 'shadowdark'. `null` for a
   * handful of Shadowdark monsters (the four Elementals, the Hydra) whose
   * stats scale with context (summoner level, number of heads) rather than
   * having one fixed difficulty.
   */
  difficulty: number | null;
  ac: number | null;
  maxHp: number | null;
  /** DEX modifier — both systems key Roll4's d20 initiative roll off it, even though neither RAW system rolls initiative exactly this way. */
  initiativeModifier: number;
  statBlock: MonsterStatBlockEntry[];
}

/**
 * "CR 0.25" / "LV 3" — the CR-vs-Level label shared by every place a
 * MonsterTemplate's difficulty is shown outside the stat-block dialog
 * (which formats it slightly differently). Centralized here since it was
 * duplicated (and, in one spot, missing its null guard — see
 * docs/DATA_MODEL.md) across AddCombatantDialog, the Encounter Generator,
 * and now MonsterPickerTable. `null` covers the handful of context-scaling
 * monsters (the four Elementals, the Hydra) with no fixed difficulty.
 */
export function monsterDifficultyLabel(template: MonsterTemplate): string {
  if (template.difficulty === null) return '';
  return template.source === '5e-srd' ? `CR ${template.difficulty}` : `LV ${template.difficulty}`;
}
