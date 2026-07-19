// Plain TypeScript interfaces describing our data shapes (see docs/DATA_MODEL.md).
// These aren't Angular-specific — just types the services and components share.

/**
 * A reusable library entry for a character controlled by a player. Not
 * tied to any one Party — see Party.playerIds below for how membership
 * works (many-to-many: a Player can belong to zero or more Parties).
 */
export interface Player {
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
 * A named grouping of Players a GM can pull into an Encounter as a unit.
 * playerIds is the *owning* side of the many-to-many relationship —
 * Player has no back-reference field, so "which Parties is this Player
 * in" is always derived by scanning Party.playerIds (see
 * PartyStore.partiesForPlayer).
 */
export interface Party {
  id: string;
  name: string;
  playerIds: string[];
}
