/**
 * One roll on a Quests, Rumors and Gossip table. Same `{ text, detail }`
 * shape as `TreasureEntry` — `detail` is a second field for tables where an
 * entry needs a name plus a payoff (e.g. a rumor plus what's actually true),
 * `null` for tables like Warmup Prompts that are just one line each.
 */
export interface QuestsRumorsGossipEntry {
  text: string;
  detail: string | null;
}

/**
 * One category of the imported Quests, Rumors and Gossip data — flat,
 * GM-provided lists, same "no external source document" situation as
 * `TreasureTable`/`CombatThesaurusTable` post-initial-batch. Currently just
 * Warmup Prompts (session-opener roleplay questions), with more tables
 * (rumors, quest hooks, gossip) to follow.
 *
 * Its own model rather than reusing `TreasureTable`, same reasoning as
 * `CombatThesaurusTable`: a different domain than Treasure, and
 * `NameTableStore.setNames()` shouldn't be fed a rumor prompt any more than
 * a Trinket or a flavor verb.
 */
export interface QuestsRumorsGossipTable {
  id: string;
  setName: string;
  tableName: string;
  entries: QuestsRumorsGossipEntry[];
}
