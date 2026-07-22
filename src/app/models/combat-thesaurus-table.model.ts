/**
 * One category of the Combat Thesaurus data (public/data/
 * combat-thesaurus.json) — GM-provided flavor verbs for narrating combat
 * (e.g. Blade: "slash", "skewer"), grouped by category. Unlike Treasure,
 * there was never a bulk external file to convert, so this JSON has been
 * hand-edited from the start — no import script/`.claude/*.txt` precursor
 * exists or is needed (see TreasureTable's doc comment for that pattern,
 * which doesn't apply here).
 */
export type CombatThesaurusIcon =
  | 'blade'
  | 'blunt'
  | 'defense'
  | 'impairment'
  | 'magic'
  | 'range';

export interface CombatThesaurusTable {
  id: string;
  setName: string;
  tableName: string;
  /** Which hand-authored inline SVG to show next to this category — see CombatThesaurusGenerator's template. */
  icon: CombatThesaurusIcon;
  entries: string[];
}
