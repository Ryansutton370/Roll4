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
 * Seed data imported from an open-license source (see
 * scripts/import-monsters-5e-srd.cjs / import-monsters-shadowdark.cjs) —
 * not GM-editable, loaded read-only via MonsterStore.
 */
export interface MonsterTemplate {
  id: string;
  source: MonsterSource;
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
