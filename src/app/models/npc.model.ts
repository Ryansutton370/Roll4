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
