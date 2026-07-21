// Structural mirror of party.model.ts's Player/Party — see that file's
// comments for the reasoning (reusable library entry + a many-to-many
// grouping owned by the group's own id list) that applies equally here.

export interface Npc {
  id: string;
  name: string;
  /** Signed integer added to a d20 roll, e.g. 3, 0, -1. */
  initiativeModifier: number;
  /** Optional combat stats — null means "not set", not "zero". */
  ac: number | null;
  maxHp: number | null;
  /** '' means "not set" — a plain string is enough here (no null variant needed). */
  notes: string;
  /** Set when this Npc was generated from a MonsterTemplate (the Encounter
   *  Generator's "Save as Troop" step) — references MonsterTemplate.id, for
   *  the combatant bubble's Eye icon to look up the full stat block. `null`
   *  for every hand-entered Npc. */
  monsterTemplateId: string | null;
  /** The creature type name from the template (e.g. "Goblin"), kept
   *  separate from `name` (e.g. "Barry") so the combatant bubble can show
   *  both — "Barry" prominently, "Goblin" as a smaller subtitle. `null`
   *  unless monsterTemplateId is also set. */
  monsterName: string | null;
}

/**
 * A named grouping of NPCs a GM can pull into an Encounter as a unit —
 * the NPC-side equivalent of Party. npcIds is the owning side of the
 * many-to-many relationship, same convention as Party.playerIds.
 */
export interface Troop {
  id: string;
  name: string;
  npcIds: string[];
}
