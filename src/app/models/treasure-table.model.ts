/**
 * One roll on a Treasure table. `detail` holds a second field alongside
 * `text` for tables that have one — Potions are a name ("Healing") plus an
 * effect ("Heal 1d8 HP"), whereas Trinkets/Wondrous Items are just one
 * descriptive line, so `detail` is `null` there. Kept as one shape rather
 * than a name-only entry plus a separate name+effect entry type so
 * `TreasureTable.entries`/`TreasureStore.roll` don't need to be a union —
 * the UI just renders `detail` when present.
 */
export interface TreasureEntry {
  text: string;
  detail: string | null;
}

/**
 * One category of the imported Treasure data (see
 * scripts/import-treasure.cjs) — flat, GM-provided lists. Currently
 * Trinkets and Potions, with Wondrous Items to follow once the GM provides
 * that data too.
 *
 * Deliberately its own model rather than reusing `NameTable`, same
 * reasoning as `WildMagicTable`: `NameTableStore.setNames()` feeds the
 * inline 🎲 popover on every Name field, and "Trinkets"/"Potions" aren't
 * names a GM would pick there.
 */
export interface TreasureTable {
  id: string;
  setName: string;
  tableName: string;
  entries: TreasureEntry[];
}
