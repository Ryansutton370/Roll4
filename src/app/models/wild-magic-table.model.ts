/**
 * One table from the imported Wild Magic data (see
 * scripts/import-wild-magic.cjs) — currently the "Chaos Burst" table (a
 * d10000 magic-mishap effect list) and its companion "Burst Duration
 * Condition" table (a d100 list of conditions that end a Burst with no
 * stated duration).
 *
 * Deliberately its own model rather than reusing `NameTable` even though
 * the shape is nearly identical: `NameTableStore`'s `setNames()` feeds the
 * inline 🎲 popover on every Name field (see `NameGeneratorButton`), so
 * folding Wild Magic tables into that same list would surface "Chaos
 * Burst" as a pickable *name* there. A separate model/store keeps that
 * popover's set list scoped to what a GM would actually pick to name
 * someone.
 */
export interface WildMagicTable {
  id: string;
  setName: string;
  tableName: string;
  /** GM-facing explanation of what this table is for, shown on the Wild Magic generator page under the Table picker. */
  description: string;
  entries: string[];
}
