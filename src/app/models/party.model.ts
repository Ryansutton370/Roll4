// Plain TypeScript interfaces describing our data shapes (see docs/DATA_MODEL.md).
// These aren't Angular-specific — just types the services and components share.

export interface PlayerCharacter {
  id: string;
  partyId: string;
  name: string;
  /** Signed integer added to a d20 roll, e.g. 3, 0, -1. */
  initiativeModifier: number;
  /** Optional combat stats — null means "not set", not "zero". */
  ac: number | null;
  maxHp: number | null;
  /** '' means "not set" — a plain string is enough here (no null variant needed). */
  notes: string;
}

export interface Party {
  id: string;
  name: string;
  pcIds: string[];
}
